import { ConversationRepository } from '@/repositories/conversationRepository'
import { ConversationSectorHistoryRepository } from '@/repositories/conversationSectorHistoryRepository'

export class ConversationService {
  /**
   * Aplica reset de setor no fechamento da conversa.
   * Por regra de negócio, ao fechar a conversa o currentSectorId volta para o
   * setor padrão do canal (Channel.defaultSectorId) e um novo tenure é registrado.
   * Idempotente: se já está no setor padrão, não faz nada.
   */
  private static async applySectorResetOnClose(conversationId: string) {
    const conversation = await ConversationRepository.findById(conversationId);
    if (!conversation || conversation.status === 'CLOSED') return;

    const { ChannelRepository } = await import('@/repositories/channelRepository');
    const channel = await ChannelRepository.findById(conversation.channelId);
    const defaultSectorId: string | null = channel?.defaultSectorId || null;

    const closeAt = new Date().toISOString();
    
    // Armazena qual era o setor ativo no momento da finalização
    const finalizedBySectorId = conversation.currentSectorId;

    await ConversationSectorHistoryRepository.closeActive(conversationId, closeAt);
    
    const updateData: any = { 
      status: 'CLOSED',
      finalizedAt: closeAt,
      finalizedBySectorId: finalizedBySectorId
    };

    if (conversation.currentSectorId !== defaultSectorId) {
      await ConversationSectorHistoryRepository.insert({
        conversationId,
        sectorId: defaultSectorId,
        enteredAt: closeAt
      });
      updateData.currentSectorId = defaultSectorId;
    }

    await ConversationRepository.update(conversationId, updateData);
    console.log(`[CONVERSA] Finalização Global: Setor=${finalizedBySectorId || 'NULL'} -> Reset para ${defaultSectorId || 'NULL'}`);

    // ENVIAR FEEDBACK (Apenas uma vez, na transição para CLOSED)
    if (conversation.contactId && conversation.contact?.phone) {
      try {
        const { FeedbackService } = await import('@/services/feedback.service');
        const { SettingRepository } = await import('@/repositories/settingRepository');
        const { MessageService } = await import('@/services/messages');

        // 1. Gera o link público com o atendente responsável
        const feedback = await FeedbackService.requestFeedback(
          conversation.contactId, 
          conversation.contact.phone, 
          conversationId,
          conversation.assignedTo,
          conversation.agent?.name
        );
        
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://motiva-talk.vercel.app';
        const feedbackLink = `${baseUrl}/feedback/${feedback.token}`;

        // 2. Busca a mensagem configurada pelo admin
        const settings = await SettingRepository.getChatSettings();
        const finishMessageBase = settings?.finishMessage || 'Seu atendimento foi finalizado. Gostaríamos de saber sua opinião sobre o nosso atendimento:';

        // 3. Monta e envia a mensagem final
        const finalMessage = `${finishMessageBase}\n\n${feedbackLink}`;
        
        await MessageService.createMessage({
          conversationId,
          channelId: conversation.channelId,
          senderType: 'SYSTEM',
          content: finalMessage,
          type: 'TEXT',
          isInternal: false
        });

        console.log(`[FEEDBACK] Mensagem automática enviada com sucesso para ${conversation.contact.phone}`);
      } catch (e: any) {
        console.warn(`[FEEDBACK] Erro no fluxo de pós-finalização: ${e.message}`);
      }
    }
  }

  /**
   * Lista conversas por filtro genérico (suporta RBAC)
   */
  static async listByFilter(where: any) {
    return await ConversationRepository.findMany(where)
  }

  /**
   * Lista conversas por canal
   */
  static async listByChannel(channelId: string, status?: string) {
    return await ConversationRepository.findMany({
       channelId,
       status: status || undefined
    })
  }

  /**
   * Atribui um atendente à conversa
   */
  static async assignAgent(conversationId: string, agentId: string) {
    return await ConversationRepository.update(conversationId, {
      assignedTo: agentId,
      status: 'IN_PROGRESS'
    })
  }

  /**
   * Altera o status da conversa (Ex: Fechar atendimento)
   */
  static async updateStatus(conversationId: string, status: string) {
    console.log(`[CONVERSA] Alterando status da conversa ${conversationId} para: ${status}`);

    if (status === 'CLOSED') {
      await this.applySectorResetOnClose(conversationId);
      return await ConversationRepository.findById(conversationId);
    }

    return await ConversationRepository.update(conversationId, { status });
  }

  /**
   * Busca conversa detalhada por ID
   */
  static async getById(id: string) {
    return await ConversationRepository.findById(id)
  }

  /**
   * Cria uma nova conversa (ex: contato enviou mensagem pela primeira vez).
   * Já gera o tenure inicial em ConversationSectorHistory usando o setor padrão do canal.
   */
  static async startConversation(contactId: string, channelId: string) {
    const existing = await ConversationRepository.findActive(contactId, channelId)
    if (existing) return existing

    const { ChannelRepository } = await import('@/repositories/channelRepository');
    const channel = await ChannelRepository.findById(channelId);
    const initialSectorId: string | null = channel?.defaultSectorId || null;

    const created = await ConversationRepository.create({
      contactId: contactId,
      channelId: channelId,
      status: 'OPEN',
      currentSectorId: initialSectorId
    });

    // Tenure inicial: o setor padrão "entrou" no momento da criação
    await ConversationSectorHistoryRepository.insert({
      conversationId: created.id,
      sectorId: initialSectorId,
      enteredAt: created.createdAt
    });

    return created;
  }

  /**
   * Atualiza unreadCount de uma conversa
   */
  static async setUnreadCount(id: string, count: number) {
    return await ConversationRepository.update(id, { unreadCount: count });
  }

  /**
   * Atualização genérica de conversa
   */
  static async updateConversation(id: string, data: any) {
    if (data.status === 'CLOSED') {
      await this.applySectorResetOnClose(id);
      // Remove status do data para não tentar atualizar novamente no repo se já foi feito
      delete data.status;
    }

    return await ConversationRepository.update(id, data);
  }

  /**
   * Remove permanentemente a conversa e todos os dados vinculados (mensagens, mídias, etc)
   * Preserva Contato e Feedbacks
   */
  static async deleteConversation(id: string) {
    const { ConversationRepository } = await import('@/repositories/conversationRepository');
    const { MessageService } = await import('@/services/messages');
    const { MessageRepository } = await import('@/repositories/messageRepository');
    const { FeedbackRepository } = await import('@/repositories/feedbackRepository');

    // 1. Obter detalhes para logs e contexto
    const conversation = await ConversationRepository.findById(id);
    if (!conversation) throw new Error('Conversa não encontrada');

    const conversationId = conversation.id;
    const channelId = conversation.channelId;

    console.log(`[DELETE_CONV] Iniciando exclusão completa: ID=${conversationId} Canal=${channelId}`);

    // 2. Limpeza física de mídia no Storage
    const filesRemoved = await MessageService.deleteAllMediaByConversation(id);
    
    // 3. Obter contagem de mensagens para log
    const allMessages = await MessageRepository.findAllByConversation(id);
    const messagesCount = allMessages.length;

    // 4. Desvincular Feedbacks (Importante: manter o feedback mas remover a FK da conversa que será deletada)
    await FeedbackRepository.nullifyConversation(id);

    // 5. Exclusão física no Banco de Dados
    // Obs: Tabelas como Message, ConversationTag, etc devem ter ON DELETE CASCADE
    // Se não tiverem, o repo executará a limpeza ou lançará erro.
    const success = await ConversationRepository.delete(id);

    if (success) {
      console.log(`[DELETE_CONV] Sucesso ao apagar conversa!
        - ConversationId: ${conversationId}
        - ChannelId: ${channelId}
        - Mensagens removidas: ${messagesCount}
        - Arquivos removidos: ${filesRemoved}
      `);
    }

    return success;
  }

  /**
   * Transfere uma conversa (Referral Mode): Mantém a conversa original no canal atual
   * e cria/encontra uma conversa no canal de destino para enviar a Nota Interna.
   */
  static async transferToChannel(conversationId: string, targetChannelId: string, agentId?: string, note?: string) {
    const { MessageService } = await import('@/services/messages');
    const { ChannelRepository } = await import('@/repositories/channelRepository');

    // 1. Buscar a conversa de origem
    const sourceConversation = await ConversationRepository.findById(conversationId);
    if (!sourceConversation) throw new Error('Conversa de origem não encontrada');

    const contactId = sourceConversation.contactId;
    if (!contactId) throw new Error('Contato não identificado na conversa');

    const oldChannelId = sourceConversation.channelId;
    if (oldChannelId === targetChannelId) return sourceConversation;

    // 2. Buscar detalhes dos canais para a mensagem do sistema
    const [oldChannel, newChannel] = await Promise.all([
      ChannelRepository.findById(oldChannelId),
      ChannelRepository.findById(targetChannelId)
    ]);

    // 3. Encontrar ou Criar a conversa no canal de destino
    const targetConversation = await this.startConversation(contactId, targetChannelId);

    // 4. Criar a Nota Interna na conversa de DESTINO
    const transferMsgTarget = `📥 Conversa referenciada do canal "${oldChannel?.name || 'Desconhecido'}".${note ? `\n\nNota: ${note}` : '\n\nSem nota adicional.'}`;
    
    await MessageService.createMessage({
      conversationId: targetConversation.id,
      channelId: targetChannelId,
      senderType: 'SYSTEM',
      content: transferMsgTarget,
      type: 'SYSTEM',
      isInternal: true,
      metadata: { 
        isTransfer: true, 
        sourceConversationId: conversationId,
        sourceChannelId: oldChannelId,
        transferredBy: agentId 
      }
    });

    // 5. Criar uma Nota Interna na conversa de ORIGEM (para histórico)
    const transferMsgSource = `📤 Conversa referenciada para o canal "${newChannel?.name || 'Desconhecido'}".${note ? `\n\nNota enviada: ${note}` : ''}`;
    
    await MessageService.createMessage({
      conversationId: sourceConversation.id,
      channelId: oldChannelId,
      senderType: 'SYSTEM',
      content: transferMsgSource,
      type: 'SYSTEM',
      isInternal: true,
      metadata: { 
        isTransfer: true, 
        targetConversationId: targetConversation.id,
        targetChannelId,
        transferredBy: agentId 
      }
    });

    // Retorna a conversa de origem (que permanece ativa no canal atual)
    return sourceConversation;
  }

  /**
   * Transfere uma conversa para outro setor (Modo Handoff):
   * 1. Mantém a mesma conversa.
   * 2. Atualiza o currentSectorId e assignedTo.
   * 3. Registra as notas de transferência.
   */
  static async transferToSector(params: {
    conversationId: string,
    targetSectorId: string,
    targetAgentId?: string,
    note?: string,
    /** ID do atendente que está realizando a transferência */
    transferredById?: string | null
  }) {
    const { MessageService } = await import('@/services/messages');
    const { supabaseAdmin } = await import('@/lib/supabase-admin');

    // 1. Buscar a conversa
    const conversation = await ConversationRepository.findById(params.conversationId);
    if (!conversation) throw new Error('Conversa não encontrada');

    const channelId = conversation.channelId;
    const originSectorId: string | null = conversation.currentSectorId || null;

    // Idempotência: se já está no setor destino, não duplica history nem note
    if (originSectorId === params.targetSectorId) {
      console.log(`[CONVERSA] Transferência ignorada — conversa ${conversation.id} já está no setor ${params.targetSectorId}`);
      return conversation;
    }

    // 2. Buscar nomes para a nota privada
    const sectorIds = [originSectorId, params.targetSectorId].filter(Boolean) as string[];
    const { data: sectors } = await supabaseAdmin
      .from('Sector')
      .select('id, name')
      .in('id', sectorIds);
    const originName = sectors?.find(s => s.id === originSectorId)?.name || 'Geral';
    const targetName = sectors?.find(s => s.id === params.targetSectorId)?.name || 'Setor';

    let agentName = 'Sistema';
    if (params.transferredById) {
      const { data: u } = await supabaseAdmin
        .from('User')
        .select('name')
        .eq('id', params.transferredById)
        .maybeSingle();
      if (u?.name) agentName = u.name;
    }

    // 3. Transição de tenure: encerra o tenure atual ANTES de mexer em qualquer outra coisa
    const transferAt = new Date().toISOString();
    await ConversationSectorHistoryRepository.closeActive(params.conversationId, transferAt);

    // 4. Atualiza a conversa (ownership)
    const updatedConversation = await ConversationRepository.update(params.conversationId, {
      currentSectorId: params.targetSectorId,
      assignedTo: params.targetAgentId || null,
      status: 'OPEN',
      unreadCount: 1,
      updatedAt: transferAt
    });

    // 5. Insere o novo tenure (setor destino é o atual a partir de transferAt)
    await ConversationSectorHistoryRepository.insert({
      conversationId: params.conversationId,
      sectorId: params.targetSectorId,
      enteredAt: transferAt,
      transferredById: params.transferredById || null
    });

    console.log(`[CONVERSA] Transferência ${conversation.id}: ${originSectorId || 'NULL'} -> ${params.targetSectorId}`);

    // 6. ÚNICA private note (criada APÓS transferAt → invisível ao setor de origem,
    //    visível apenas ao setor destino, que vê tudo a partir de enteredAt = transferAt).
    const reasonPart = params.note?.trim() ? params.note.trim() : 'Não informado';
    const noteContent = `🔄 Conversa transferida de ${originName} para ${targetName} por ${agentName}. Motivo: ${reasonPart}`;

    await MessageService.createMessage({
      conversationId: conversation.id,
      channelId: channelId,
      content: noteContent,
      type: 'SYSTEM',
      senderType: 'SYSTEM',
      isInternal: true,
      sectorId: params.targetSectorId
    });

    return updatedConversation;
  }
}
