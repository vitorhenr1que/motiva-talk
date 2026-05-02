import { MessageRepository } from '@/repositories/messageRepository'
import { AppError } from '@/lib/api-errors';

const CONVERSATION_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface CreateMessageData {
  conversationId: string;
  channelId: string;
  senderType: string;
  content: string;
  type?: string;
  externalMessageId?: string;
  mediaUrl?: string;
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
  duration?: number;
  thumbnailUrl?: string;
  metadata?: any;
  isInternal?: boolean;
  sectorId?: string | null;
}

export class MessageService {
  private static isConversationWindowOpen(startedAt?: string | null, nowMs = Date.now()) {
    if (!startedAt) return false;
    const startedMs = new Date(startedAt).getTime();
    if (Number.isNaN(startedMs)) return false;
    return nowMs - startedMs < CONVERSATION_WINDOW_MS;
  }

  private static assertCanSendFreeformMessage(conversation: any) {
    if (this.isConversationWindowOpen(conversation?.conversationWindowStartedAt)) return;

    throw new AppError(
      'A janela de 24h desta conversa esta fechada. Envie um template aprovado e aguarde o cliente responder para liberar mensagens livres.',
      403,
      'CONVERSATION_WINDOW_CLOSED'
    );
  }

  /**
   * Lista histórico de mensagens paginado
   * Filtra mensagens apagadas (me/todos)
   */
  static async listByConversation(organizationId: string, conversationId: string, limit: number = 20, before?: string, allowedSectorIds?: string[], sectorId?: string) {
    // Quando um setor específico é solicitado (ex: filtro na barra lateral ou visão histórica),
    // restringimos as mensagens para aquele setor. 
    // Caso contrário, usamos a lista de setores permitidos do usuário (RBAC).
    const filterSectorIds = sectorId ? [sectorId] : allowedSectorIds;

    const messages = await MessageRepository.findMany(organizationId, {
      conversationId,
      limit,
      before,
      allowedSectorIds: filterSectorIds
    })

    // Filtrar localmente as deletadas para o atendente
    const filtered = messages.filter((m: any) => !m.deletedForMe);

    // Inverter para ASC antes de retornar para renderizar corretamente no chat (o repo mandou DESC)
    const sorted = [...filtered].sort((a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    // O cursor para a PRÓXIMA página (anterior no tempo) é a createdAt da mensagem MAIS ANTIGA deste lote (última do array original DESC)
    const hasMore = messages.length === limit;
    const nextCursor = hasMore ? messages[messages.length - 1].createdAt : null;

    return {
      messages: sorted,
      nextCursor,
      hasMore
    }
  }

  /**
   * Registra uma nova mensagem no banco e envia via API se for do atendente
   */
  static async createMessage(organizationId: string, data: CreateMessageData & { replyToMessageId?: string }) {
    const { 
      conversationId, 
      channelId, 
      senderType, 
      content, 
      type, 
      replyToMessageId, 
      metadata,
      mediaUrl,
      fileName,
      mimeType,
      fileSize,
      thumbnailUrl,
      duration,
      isInternal,
      sectorId
    } = data
    
    let externalMessageId: string | undefined = data.externalMessageId
    let quoted: { id: string, content: string, fromMe: boolean, type?: string } | undefined = undefined;

    if (replyToMessageId) {
      const originalMsg = await MessageRepository.findById(replyToMessageId, organizationId);
      if (originalMsg && originalMsg.externalMessageId) {
        quoted = {
          id: originalMsg.externalMessageId,
          content: originalMsg.content,
          fromMe: originalMsg.senderType === 'AGENT' || originalMsg.senderType === 'SYSTEM',
          type: originalMsg.type
        };
      }
    }

    const isActuallyInternal = isInternal !== undefined ? isInternal : (senderType === 'SYSTEM' || !!metadata?.isInternal);

    // OTIMIZAÇÃO: a conversa pode ser necessária em DOIS lugares — para enviar via Evolution
    // (envia mídia/texto pro contato) e para resolver o sectorId (caso não venha explícito).
    // Antes: 2 findById; agora: 1 findById preguiçoso, reaproveitado.
    let cachedConversation: any = null;
    const getConversation = async () => {
      if (cachedConversation) return cachedConversation;
      const { ConversationRepository } = await import('@/repositories/conversationRepository');
      cachedConversation = await ConversationRepository.findByIdForMessaging(conversationId, organizationId);
      return cachedConversation;
    };

    if (!isActuallyInternal && senderType === 'AGENT') {
      // FREE acima da franquia não responde; planos pagos continuam respondendo e
      // o excedente fica registrado para billing. Recebimento nunca é bloqueado.
      const { LimitsService } = await import('@/services/limits.service');
      await LimitsService.checkCanSendMessage(organizationId);
    }

    if (!isActuallyInternal && (senderType === 'AGENT' || senderType === 'SYSTEM')) {

      try {
        const { getWhatsAppProvider, resolveWhatsAppProviderType } = await import('@/services/whatsapp/providers')

        const conversation = await getConversation();
        if (!conversation || !conversation.contact || !conversation.channel) {
          throw new AppError('Conversa, contato ou canal não encontrados.', 404, 'NOT_FOUND');
        }

        if (conversation.channelId !== channelId) {
          throw new AppError('Canal não pertence à conversa informada.', 400, 'VALIDATION_ERROR');
        }

        this.assertCanSendFreeformMessage(conversation);

        // Se for mídia, passamos as informações pro provider
        const providerType = resolveWhatsAppProviderType(conversation.channel);
        const provider = getWhatsAppProvider(providerType);
        console.log(
          `[MSG_SERVICE] Enviando mensagem via ${providerType} channel=${conversation.channel.id} conversation=${conversation.id}`
        );
        
        let result: any;
        if (!type || type === 'TEXT') {
          result = await provider.sendTextMessage(
            conversation.channel,
            conversation.contact.phone,
            content,
            quoted?.id
          );
        } else if (type === 'CONTACT') {
          result = await provider.sendContactMessage(
            conversation.channel,
            conversation.contact.phone,
            {
              fullName: metadata?.contact?.fullName || content.replace('Contato: ', ''),
              phoneNumber: metadata?.contact?.phoneNumber || metadata?.contact?.wuid || conversation.contact.phone,
              wuid: metadata?.contact?.wuid || metadata?.contact?.phoneNumber
            },
            quoted?.id
          );
        } else {
          result = await provider.sendMediaMessage(
            conversation.channel,
            conversation.contact.phone,
            mediaUrl || content,
            type as any,
            fileName,
            content, // caption
            quoted?.id
          );
        }

        externalMessageId = typeof result === 'string' ? result : (result?.key?.id || result?.message?.key?.id);

        if (!externalMessageId) {
           console.error(`[MSG_SERVICE] Falha ao obter ID externo da mensagem via ${providerType}. Retorno bruto:`, result);
           throw new Error(`O provider ${providerType} nao retornou o ID da mensagem enviada.`);
        }

      } catch (error: any) {
        if (error instanceof AppError) throw error;
        console.error('[MSG_SERVICE] Erro ao enviar mensagem via WhatsApp provider:', error)
        throw new AppError(`Falha no envio via WhatsApp: ${error.message}`, 500, 'INTERNAL_ERROR');
      }
    }

    // Resolve o setor da mensagem: respeita sectorId explícito ou cai no currentSectorId
    // atual da conversa (reaproveita a conversa já carregada se houver).
    const conversationForInsert = await getConversation();
    if (!conversationForInsert || conversationForInsert.channelId !== channelId) {
      throw new AppError('Conversa ou canal não encontrados.', 404, 'NOT_FOUND');
    }

    let finalSectorId = sectorId;
    if (finalSectorId === undefined || finalSectorId === null) {
       finalSectorId = conversationForInsert.currentSectorId || null;
    }

    const newMessage = await MessageRepository.create(organizationId, {
      conversationId,
      channelId,
      senderType,
      content,
      type: type || 'TEXT',
      externalMessageId,
      replyToMessageId,
      metadata,
      mediaUrl,
      fileName,
      mimeType,
      fileSize,
      thumbnailUrl,
      duration,
      isInternal: isActuallyInternal,
      sectorId: finalSectorId,
      createdAt: new Date().toISOString()
    })

    if (!isActuallyInternal) {
      const { BillingService } = await import('@/services/billing.service');
      await BillingService.incrementMessageUsage(organizationId);
    }

    const { RealtimeService } = await import('@/services/realtime.service');
    await RealtimeService.notifyNewMessage(conversationId, newMessage);

    // Se for mensagem do CLIENTE, cancelar agendamentos que dependem de resposta
    if (senderType === 'USER') {
      try {
        await this.cancelScheduledByCustomerReply(conversationId, organizationId);
      } catch (e) {
        console.error('[MSG_SERVICE] Erro ao processar cancelamento por resposta:', e);
      }
    }

    return newMessage
  }

  /**
   * Executa a limpeza física e marcação de remoção local de uma mensagem
   */
  private static async performLocalRemoval(message: any, mode: 'me' | 'everyone', organizationId: string) {
    const { id, mediaUrl } = message;
    console.log(`[MSG_SERVICE] Iniciando soft-delete local da mensagem: ${id} Modo: ${mode}`);

    // 1. Remover arquivo do Storage para economizar espaço
    if (mediaUrl) {
      try {
        const { supabaseAdmin } = await import('@/lib/supabase-admin');
        const bucket = 'chat-media';
        let path = mediaUrl;
        if (mediaUrl.includes(`${bucket}/`)) {
          path = mediaUrl.split(`${bucket}/`).pop() || mediaUrl;
        }
        await supabaseAdmin.storage.from(bucket).remove([path]);
        console.log(`[MSG_SERVICE] Mídia removida: ${path}`);
      } catch (e) {
        console.error('[MSG_SERVICE] Erro ao limpar storage:', e);
      }
    }

    // 2. Atualizar o registro no Banco (Manter rastro mas zerar conteúdo e mídia)
    const updateData: any = {
      mediaUrl: null,
      thumbnailUrl: null,
      fileName: null,
      mimeType: null,
      fileSize: null,
      duration: null,
      metadata: null
    };

    if (mode === 'everyone') {
       updateData.deletedForEveryone = true;
       updateData.content = '🚫 Esta mensagem foi apagada';
    } else {
       updateData.deletedForMe = true;
       // O conteúdo para "mim" será decidido na UI baseada em quem enviou
    }

    return await MessageRepository.update(id, organizationId, updateData);
  }

  /**
   * Apaga mensagem (Soft-Delete) apenas para este sistema local
   */
  static async deleteForMe(id: string, organizationId: string) {
    const message = await MessageRepository.findById(id, organizationId);
    if (!message) throw new Error('Mensagem não encontrada');
    return await this.performLocalRemoval(message, 'me', organizationId);
  }

  /**
   * Apaga mensagem para todos (Evolution API + Soft-Delete)
   */
  static async deleteForEveryone(id: string, organizationId: string) {
    const message = await MessageRepository.findById(id, organizationId);
    if (!message) throw new Error('Mensagem não encontrada');

    // 1. Apagar no WhatsApp via Evolution API se tiver ID externo
    if (message.externalMessageId) {
      try {
        const { getWhatsAppProvider, resolveWhatsAppProviderType } = await import('@/services/whatsapp/providers');
        const { ConversationRepository } = await import('@/repositories/conversationRepository');
        const conversation = await ConversationRepository.findByIdForMessaging(message.conversationId, organizationId);
        
        if (conversation && conversation.contact && conversation.channel) {
           const providerType = resolveWhatsAppProviderType(conversation.channel);
           const provider = getWhatsAppProvider(providerType);
           await provider.deleteMessage(
             conversation.channel, 
             conversation.contact.phone, 
             message.externalMessageId,
             message.senderType === 'AGENT'
           );
        }
      } catch (error: any) {
        console.error('[API_DELETE_EVERYONE] Falha na Evolution API:', error.message);
        throw new Error(`WhatsApp não permitiu apagar: ${error.message}`);
      }
    }

    // 2. Soft-delete local
    return await this.performLocalRemoval(message, 'everyone', organizationId);
  }

  /**
   * Envia status de presença (digitando) para o contato
   */
  static async sendPresence(conversationId: string, presence: 'composing' | 'paused', organizationId: string) {
    const { ConversationRepository } = await import('@/repositories/conversationRepository');
    const { getWhatsAppProvider, resolveWhatsAppProviderType } = await import('@/services/whatsapp/providers');

    const conversation = await ConversationRepository.findByIdForMessaging(conversationId, organizationId);
    if (conversation && conversation.contact && conversation.channel) {
      const providerType = resolveWhatsAppProviderType(conversation.channel);
      const provider = getWhatsAppProvider(providerType);
      await provider.sendPresence(
        conversation.channel,
        conversation.contact.phone,
        presence
      );
    }
  }

  /**
   * Atualiza o conteúdo de uma mensagem (Edição)
   */
  static async updateMessage(id: string, newContent: string, organizationId: string) {
    const message = await MessageRepository.findById(id, organizationId);
    if (!message) throw new AppError('Mensagem não encontrada', 404, 'NOT_FOUND');

    // 1. Se for do atendente, tenta editar no WhatsApp via Evolution API
    if (message.senderType === 'AGENT' && message.externalMessageId) {
      try {
        const { getWhatsAppProvider, resolveWhatsAppProviderType } = await import('@/services/whatsapp/providers');
        const { ConversationRepository } = await import('@/repositories/conversationRepository');
        const conversation = await ConversationRepository.findByIdForMessaging(message.conversationId, organizationId);
        
        if (conversation && conversation.contact && conversation.channel) {
          const providerType = resolveWhatsAppProviderType(conversation.channel);
          const provider = getWhatsAppProvider(providerType);
          await provider.editMessage(
            conversation.channel,
            conversation.contact.phone,
            message.externalMessageId,
            true, // fromMe
            newContent
          );
        }
      } catch (error: any) {
        console.error('[MSG_SERVICE] Erro ao editar mensagem via Evolution API:', error);
        throw new AppError(`Falha na edição via WhatsApp: ${error.message}`, 500, 'INTERNAL_ERROR');
      }
    }

    // 2. Atualizar no banco de dados
    const updated = await MessageRepository.update(id, organizationId, { content: newContent });

    // 3. Notificar via Realtime
    const { RealtimeService } = await import('@/services/realtime.service');
    await RealtimeService.notifyMessageUpdate(message.conversationId, updated);

    return updated;
  }

  /**
   * Agenda uma nova mensagem
   */
  static async scheduleMessage(organizationId: string, data: any) {
    const { scheduledAt, ...rest } = data;
    const { ConversationRepository } = await import('@/repositories/conversationRepository');
    const conversation = await ConversationRepository.findByIdForMessaging(rest.conversationId, organizationId);
    if (!conversation || conversation.channelId !== rest.channelId) {
      throw new AppError('Conversa ou canal não encontrados.', 404, 'NOT_FOUND');
    }
    
    const message = await MessageRepository.create(organizationId, {
      ...rest,
      sendStatus: 'scheduled',
      scheduledAt,
      isScheduled: true
    });

    return message;
  }

  /**
   * Processa a fila de mensagens agendadas
   */
  static async processScheduledMessages() {
    const { supabaseAdmin } = await import('@/lib/supabase-admin');
    const { data: organizations, error } = await supabaseAdmin.from('Organization').select('id');
    if (error) throw error;

    const messagesByOrganization = await Promise.all(
      (organizations || []).map(async (org) => ({
        organizationId: org.id,
        messages: await MessageRepository.findScheduledReady(org.id, 10)
      }))
    );
    const messages = messagesByOrganization.flatMap(({ organizationId, messages }) =>
      messages.map((message: any) => ({ ...message, organizationId }))
    );
    if (!messages.length) return { processed: 0 };

    console.log(`[SCHEDULED] Processando ${messages.length} mensagens...`);

    // Atualiza status para 'sending' imediatamente para evitar processamento duplo
    await Promise.all(messages.map(m => 
      MessageRepository.update(m.id, m.organizationId, { sendStatus: 'sending' })
    ));

    const results = [];
    
    // Processamento com concorrência controlada
    for (const msg of messages) {
      try {
        const { getWhatsAppProvider, resolveWhatsAppProviderType } = await import('@/services/whatsapp/providers');
        const { ConversationRepository } = await import('@/repositories/conversationRepository');
        const conversation = await ConversationRepository.findByIdForMessaging(msg.conversationId, msg.organizationId);

        if (!conversation || !conversation.contact || !conversation.channel) {
           throw new Error('Conversa ou canal não encontrado');
        }

        this.assertCanSendFreeformMessage(conversation);

        const providerType = resolveWhatsAppProviderType(conversation.channel);
        const provider = getWhatsAppProvider(providerType);
        console.log(
          `[SCHEDULED] Enviando mensagem ${msg.id} via ${providerType} channel=${conversation.channel.id}`
        );
        let response: any;
        if (!msg.type || msg.type === 'TEXT') {
          response = await provider.sendTextMessage(
            conversation.channel,
            conversation.contact.phone,
            msg.content,
            msg.replyToMessage?.externalMessageId
          );
        } else if (msg.type === 'CONTACT') {
          response = await provider.sendContactMessage(
            conversation.channel,
            conversation.contact.phone,
            {
              fullName: msg.metadata?.contact?.fullName || msg.content.replace('Contato: ', ''),
              phoneNumber: msg.metadata?.contact?.phoneNumber || msg.metadata?.contact?.wuid || conversation.contact.phone,
              wuid: msg.metadata?.contact?.wuid || msg.metadata?.contact?.phoneNumber
            },
            msg.replyToMessage?.externalMessageId
          );
        } else {
          response = await provider.sendMediaMessage(
            conversation.channel,
            conversation.contact.phone,
            msg.mediaUrl || msg.content,
            msg.type as any,
            msg.fileName,
            msg.content, // caption
            msg.replyToMessage?.externalMessageId
          );
        }

        const externalId = typeof response === 'string' ? response : (response?.key?.id || response?.messageId);

        // Sucesso
        await MessageRepository.update(msg.id, msg.organizationId, {
          sendStatus: 'sent',
          sentAt: new Date().toISOString(),
          externalMessageId: externalId
        });

        // Notificar via Realtime
        const { RealtimeService } = await import('@/services/realtime.service');
        await RealtimeService.notifyMessageUpdate(msg.conversationId, { ...msg, sendStatus: 'sent', externalMessageId: externalId });

        results.push({ id: msg.id, success: true });
      } catch (error: any) {
        console.error(`[SCHEDULED_ERROR] Falha ao enviar mensagem ${msg.id}:`, error.message);
        
        await MessageRepository.update(msg.id, msg.organizationId, {
          sendStatus: 'failed',
          errorMessage: error.message
        });

        const { RealtimeService } = await import('@/services/realtime.service');
        await RealtimeService.notifyMessageUpdate(msg.conversationId, { ...msg, sendStatus: 'failed', errorMessage: error.message });

        results.push({ id: msg.id, success: false, error: error.message });
      }
    }

    return { processed: messages.length, results };
  }

  static async getMessageById(id: string, organizationId: string) {
    return await MessageRepository.findById(id, organizationId)
  }

  static async deleteMessage(id: string, organizationId: string) {
    return await MessageRepository.delete(id, organizationId)
  }

  static async getLastMessage(conversationId: string, organizationId: string) {
    return await MessageRepository.findLastByConversation(conversationId, organizationId)
  }

  static async searchMessages(conversationId: string, organizationId: string, query: string, sectorId?: string) {
    // Mesma regra de isolamento por tenure usada em listByConversation
    let range: { afterCreatedAt?: string; untilCreatedAt?: string } | undefined;
    if (sectorId) {
      const { ConversationSectorHistoryRepository } = await import('@/repositories/conversationSectorHistoryRepository');
      const tenure = await ConversationSectorHistoryRepository.findLatestRangeForSector(organizationId, conversationId, sectorId);
      if (!tenure) return [];
      range = {
        afterCreatedAt: tenure.enteredAt,
        untilCreatedAt: tenure.leftAt || undefined
      };
    }

    const results = await MessageRepository.search(organizationId, conversationId, query, range)

    // Filtrar mensagens apagadas para todos (opcional: o atendente pode querer saber que algo existiu, mas aqui limpamos)
    return results.filter((m: any) => !m.deletedForEveryone).map((m: any) => ({
      id: m.id,
      content: m.content,
      createdAt: m.createdAt,
      senderType: m.senderType,
      conversationId: m.conversationId
    }))
  }

  /**
   * Remove fisicamente todos os arquivos de mídia (media e thumbnail) de uma conversa no storage
   * Retorna a quantidade de arquivos removidos
   */
  static async deleteAllMediaByConversation(conversationId: string, organizationId: string) {
    const messages = await MessageRepository.findMediaByConversation(conversationId, organizationId);
    
    // Identificar todos os arquivos (Media e Thumbnail)
    const pathsToRemoval: string[] = [];
    const bucket = 'chat-media';

    messages.forEach((m: any) => {
      [m.mediaUrl, m.thumbnailUrl].forEach(url => {
        if (url && typeof url === 'string' && url.includes(bucket)) {
          let path = url;
          if (url.includes(`${bucket}/`)) {
            path = url.split(`${bucket}/`).pop() || url;
          }
          // Evitar duplicados
          if (!pathsToRemoval.includes(path)) {
            pathsToRemoval.push(path);
          }
        }
      });
    });

    if (pathsToRemoval.length === 0) {
      console.log(`[MSG_SERVICE] Nenhuma mídia identificada para a conversa ${conversationId}`);
      return 0;
    }

    console.log(`[MSG_SERVICE] Identificados ${pathsToRemoval.length} arquivos para a conversa ${conversationId}:`, pathsToRemoval);

    const { supabaseAdmin } = await import('@/lib/supabase-admin');
    let successCount = 0;

    // Removemos em lote para eficiência, mas logamos resultados
    const { data, error } = await supabaseAdmin.storage.from(bucket).remove(pathsToRemoval);
    
    if (error) {
      console.error('[MSG_SERVICE] Erro ao remover arquivos do storage (lote):', error);
      // O Supabase remove o que consegue mesmo se der erro em alguns
    }

    if (data) {
       successCount = data.length;
       console.log(`[MSG_SERVICE] Paths removidos com sucesso:`, data.map(f => f.name));
       
       if (data.length < pathsToRemoval.length) {
          const failed = pathsToRemoval.filter(p => !data.some(f => f.name === p));
          console.warn(`[MSG_SERVICE] ${pathsToRemoval.length - data.length} arquivos falharam ou não existiam:`, failed);
       }
    }

    return successCount;
  }

  static async cancelScheduledMessage(id: string, organizationId: string) {
    const msg = await MessageRepository.findById(id, organizationId);
    if (!msg) throw new AppError('Mensagem não encontrada', 404);
    if (msg.sendStatus !== 'scheduled') {
      throw new AppError('Apenas mensagens agendadas podem ser canceladas', 400);
    }

    const updated = await MessageRepository.update(id, organizationId, {
      sendStatus: 'cancelled'
    });

    const { RealtimeService } = await import('@/services/realtime.service');
    await RealtimeService.notifyMessageUpdate(msg.conversationId, updated);

    return updated;
  }

  static async cancelScheduledByCustomerReply(conversationId: string, organizationId: string) {
    const { supabaseAdmin } = await import('@/lib/supabase-admin');
    
    // Buscar mensagens agendadas desta conversa com cancelOnReply = true
    const { data: scheduled, error } = await supabaseAdmin
      .from('Message')
      .select('id')
      .eq('conversationId', conversationId)
      .eq('organizationId', organizationId)
      .eq('sendStatus', 'scheduled')
      .eq('cancelOnReply', true);

    if (error || !scheduled || scheduled.length === 0) return;

    console.log(`[MSG_SERVICE] Cancelando ${scheduled.length} mensagens agendadas por resposta do cliente na conv ${conversationId}`);

    for (const msg of scheduled) {
      await this.cancelScheduledMessage(msg.id, organizationId);
    }
  }
}
