import { MessageRepository } from '@/repositories/messageRepository'
import { Channel } from '@/types/chat';
import { AppError } from '@/lib/api-errors';

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
}

export class MessageService {
  /**
   * Lista histórico de mensagens paginado
   * Filtra mensagens apagadas (me/todos)
   */
  static async listByConversation(conversationId: string, limit: number = 20, before?: string) {
    const messages = await MessageRepository.findMany({ 
      conversationId,
      limit,
      before
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
  static async createMessage(data: CreateMessageData & { replyToMessageId?: string }) {
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
      duration
    } = data
    
    let externalMessageId: string | undefined = data.externalMessageId
    let quoted: { id: string, content: string, fromMe: boolean, type?: string } | undefined = undefined;

    if (replyToMessageId) {
      const originalMsg = await MessageRepository.findById(replyToMessageId);
      if (originalMsg && originalMsg.externalMessageId) {
        quoted = {
          id: originalMsg.externalMessageId,
          content: originalMsg.content,
          fromMe: originalMsg.senderType === 'AGENT' || originalMsg.senderType === 'SYSTEM',
          type: originalMsg.type
        };
      }
    }

    if (senderType === 'AGENT' || senderType === 'SYSTEM') {
      try {
        const { ConversationRepository } = await import('@/repositories/conversationRepository')
        const { evolutionProvider } = await import('@/services/whatsapp/evolution-provider')
        
        const conversation = await ConversationRepository.findById(conversationId)
        if (!conversation || !conversation.contact || !conversation.channel) {
          throw new AppError('Conversa, contato ou canal não encontrados.', 404, 'NOT_FOUND');
        }

        // Se for mídia, passamos as informações pro provider
        const result = await evolutionProvider.sendMessage(
          conversation.channel,
          conversation.contact.phone,
          content,
          (type as any) || 'TEXT',
          quoted,
          {
            ...metadata,
            mediaUrl: mediaUrl || content, // content pode ser a URL se for mídia
            fileName,
            mimeType,
            fileSize,
            duration
          }
        )

        externalMessageId = result?.key?.id || result?.message?.key?.id
        
        if (!externalMessageId) {
           console.error('[MSG_SERVICE] Falha ao obter ID externo da mensagem da Evolution API. Retorno bruto:', result);
           throw new Error('A Evolution API não retornou o ID da mensagem enviada.');
        }

      } catch (error: any) {
        console.error('[MSG_SERVICE] Erro ao enviar mensagem via Evolution API:', error)
        throw new AppError(`Falha no envio via WhatsApp: ${error.message}`, 500, 'INTERNAL_ERROR');
      }
    }

    const newMessage = await MessageRepository.create({
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
      createdAt: new Date().toISOString()
    })

    if (senderType === 'AGENT' || senderType === 'SYSTEM') {
      // O gatilho de banco de dados 'on_message_insert' já atualiza automaticamente:
      // - lastMessageAt
      // - lastMessagePreview
      // - unreadCount (zerando se for Agente/Sistema)
      // - updatedAt
    }

    const { RealtimeService } = await import('@/services/realtime.service');
    await RealtimeService.notifyNewMessage(conversationId, newMessage);

    // Se for mensagem do CLIENTE, cancelar agendamentos que dependem de resposta
    if (senderType === 'USER') {
      try {
        await this.cancelScheduledByCustomerReply(conversationId);
      } catch (e) {
        console.error('[MSG_SERVICE] Erro ao processar cancelamento por resposta:', e);
      }
    }

    return newMessage
  }

  /**
   * Executa a limpeza física e marcação de remoção local de uma mensagem
   */
  private static async performLocalRemoval(message: any, mode: 'me' | 'everyone') {
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

    return await MessageRepository.update(id, updateData);
  }

  /**
   * Apaga mensagem (Soft-Delete) apenas para este sistema local
   */
  static async deleteForMe(id: string) {
    const message = await MessageRepository.findById(id);
    if (!message) throw new Error('Mensagem não encontrada');
    return await this.performLocalRemoval(message, 'me');
  }

  /**
   * Apaga mensagem para todos (Evolution API + Soft-Delete)
   */
  static async deleteForEveryone(id: string) {
    const message = await MessageRepository.findById(id);
    if (!message) throw new Error('Mensagem não encontrada');

    // 1. Apagar no WhatsApp via Evolution API se tiver ID externo
    if (message.externalMessageId) {
      try {
        const { evolutionProvider } = await import('@/services/whatsapp/evolution-provider');
        const { ConversationRepository } = await import('@/repositories/conversationRepository');
        const conversation = await ConversationRepository.findById(message.conversationId);
        
        if (conversation && conversation.contact && conversation.channel) {
           await evolutionProvider.deleteMessage(
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
    return await this.performLocalRemoval(message, 'everyone');
  }

  /**
   * Envia status de presença (digitando) para o contato
   */
  static async sendPresence(conversationId: string, presence: 'composing' | 'paused') {
    const { ConversationRepository } = await import('@/repositories/conversationRepository');
    const { evolutionProvider } = await import('@/services/whatsapp/evolution-provider');

    const conversation = await ConversationRepository.findById(conversationId);
    if (conversation && conversation.contact && conversation.channel) {
      await evolutionProvider.sendPresence(
        conversation.channel,
        conversation.contact.phone,
        presence
      );
    }
  }

  /**
   * Atualiza o conteúdo de uma mensagem (Edição)
   */
  static async updateMessage(id: string, newContent: string) {
    const message = await MessageRepository.findById(id);
    if (!message) throw new AppError('Mensagem não encontrada', 404, 'NOT_FOUND');

    // 1. Se for do atendente, tenta editar no WhatsApp via Evolution API
    if (message.senderType === 'AGENT' && message.externalMessageId) {
      try {
        const { evolutionProvider } = await import('@/services/whatsapp/evolution-provider');
        const { ConversationRepository } = await import('@/repositories/conversationRepository');
        const conversation = await ConversationRepository.findById(message.conversationId);
        
        if (conversation && conversation.contact && conversation.channel) {
          await evolutionProvider.editMessage(
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
    const updated = await MessageRepository.update(id, { content: newContent });

    // 3. Notificar via Realtime
    const { RealtimeService } = await import('@/services/realtime.service');
    await RealtimeService.notifyMessageUpdate(message.conversationId, updated);

    return updated;
  }

  /**
   * Agenda uma nova mensagem
   */
  static async scheduleMessage(data: any) {
    const { scheduledAt, ...rest } = data;
    
    const message = await MessageRepository.create({
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
    const messages = await MessageRepository.findScheduledReady(10);
    if (!messages.length) return { processed: 0 };

    console.log(`[SCHEDULED] Processando ${messages.length} mensagens...`);

    // Atualiza status para 'sending' imediatamente para evitar processamento duplo
    await Promise.all(messages.map(m => 
      MessageRepository.update(m.id, { sendStatus: 'sending' })
    ));

    const results = [];
    
    // Processamento com concorrência controlada
    // Texto: até 3 simultâneos, Mídia: até 2 simultâneos
    // Aqui usaremos uma abordagem sequencial simples ou chunks para garantir estabilidade
    for (const msg of messages) {
      try {
        const { evolutionProvider } = await import('@/services/whatsapp/evolution-provider');
        const { ConversationRepository } = await import('@/repositories/conversationRepository');
        const conversation = await ConversationRepository.findById(msg.conversationId);

        if (!conversation || !conversation.contact || !conversation.channel) {
           throw new Error('Conversa ou canal não encontrado');
        }

        const metadata = {
          mediaUrl: msg.mediaUrl,
          fileName: msg.fileName,
          mimeType: msg.mimeType,
          fileSize: msg.fileSize,
          thumbnailUrl: msg.thumbnailUrl,
          duration: msg.duration
        };

        const response = await evolutionProvider.sendMessage(
          conversation.channel,
          conversation.contact.phone,
          msg.content,
          msg.type,
          msg.replyToMessage, // Pass quoted if available
          metadata
        );

        const externalId = response?.key?.id || response?.messageId;

        // Sucesso
        await MessageRepository.update(msg.id, {
          sendStatus: 'sent',
          sentAt: new Date().toISOString(),
          externalMessageId: externalId
        });

        // Notificar via Realtime
        const { RealtimeService } = await import('@/services/realtime.service');
        await RealtimeService.notifyMessageUpdate(msg.conversationId, { ...msg, sendStatus: 'sent' });

        results.push({ id: msg.id, success: true });
      } catch (error: any) {
        console.error(`[SCHEDULED_ERROR] Falha ao enviar mensagem ${msg.id}:`, error.message);
        
        await MessageRepository.update(msg.id, {
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

  static async getMessageById(id: string) {
    return await MessageRepository.findById(id)
  }

  static async deleteMessage(id: string) {
    return await MessageRepository.delete(id)
  }

  static async getLastMessage(conversationId: string) {
    return await MessageRepository.findLastByConversation(conversationId)
  }

  static async searchMessages(conversationId: string, query: string) {
    const results = await MessageRepository.search(conversationId, query)
    
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
  static async deleteAllMediaByConversation(conversationId: string) {
    const messages = await MessageRepository.findAllByConversation(conversationId);
    
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

  static async cancelScheduledMessage(id: string) {
    const msg = await MessageRepository.findById(id);
    if (!msg) throw new AppError('Mensagem não encontrada', 404);
    if (msg.sendStatus !== 'scheduled') {
      throw new AppError('Apenas mensagens agendadas podem ser canceladas', 400);
    }

    const updated = await MessageRepository.update(id, {
      sendStatus: 'cancelled'
    });

    const { RealtimeService } = await import('@/services/realtime.service');
    await RealtimeService.notifyMessageUpdate(msg.conversationId, updated);

    return updated;
  }

  static async cancelScheduledByCustomerReply(conversationId: string) {
    const { supabaseAdmin } = await import('@/lib/supabase-admin');
    
    // Buscar mensagens agendadas desta conversa com cancelOnReply = true
    const { data: scheduled, error } = await supabaseAdmin
      .from('Message')
      .select('id')
      .eq('conversationId', conversationId)
      .eq('sendStatus', 'scheduled')
      .eq('cancelOnReply', true);

    if (error || !scheduled || scheduled.length === 0) return;

    console.log(`[MSG_SERVICE] Cancelando ${scheduled.length} mensagens agendadas por resposta do cliente na conv ${conversationId}`);

    for (const msg of scheduled) {
      await this.cancelScheduledMessage(msg.id);
    }
  }
}
