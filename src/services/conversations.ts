import { ConversationRepository } from '@/repositories/conversationRepository'

export class ConversationService {
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
    
    const updated = await ConversationRepository.update(conversationId, { status })
    
    // Se a conversa foi fechada, gera uma solicitação de feedback e envia a mensagem automática
    if (status === 'CLOSED' && updated.contactId && updated.contact?.phone) {
      console.log(`[CONVERSA] Conversa finalizada. Contato identificado: ${updated.contact.name || updated.contact.phone}`);
      
      try {
        const { FeedbackService } = await import('@/services/feedback.service');
        const { SettingRepository } = await import('@/repositories/settingRepository');
        const { MessageService } = await import('@/services/messages');

        // 1. Gera o link público com o atendente responsável
        const feedback = await FeedbackService.requestFeedback(
          updated.contactId, 
          updated.contact.phone, 
          conversationId,
          updated.assignedTo,
          updated.agent?.name
        );
        
        // Constrói a URL do feedback (pode ser configurada via env)
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://motiva-talk.vercel.app';
        const feedbackLink = `${baseUrl}/feedback/${feedback.token}`;
        console.log(`[FEEDBACK] Link gerado: ${feedbackLink}`);

        // 2. Busca a mensagem configurada pelo admin
        const settings = await SettingRepository.getChatSettings();
        const finishMessageBase = settings?.finishMessage || 'Seu atendimento foi finalizado. Gostaríamos de saber sua opinião sobre o nosso atendimento:';

        // 3. Monta e envia a mensagem final
        const finalMessage = `${finishMessageBase}\n\n${feedbackLink}`;
        
        console.log(`[FEEDBACK] Enviando mensagem de encerramento via Evolution API...`);
        
        await MessageService.createMessage({
          conversationId,
          channelId: updated.channelId,
          senderType: 'SYSTEM', // Ou AGENT se preferir, mas SYSTEM indica automação
          content: finalMessage,
          type: 'TEXT'
        });

        console.log(`[FEEDBACK] Mensagem automática enviada com sucesso para ${updated.contact.phone}`);

      } catch (e: any) {
        console.warn(`[FEEDBACK] Erro no fluxo de pós-finalização: ${e.message}`);
      }
    }

    return updated
  }

  /**
   * Busca conversa detalhada por ID
   */
  static async getById(id: string) {
    return await ConversationRepository.findById(id)
  }

  /**
   * Cria uma nova conversa (ex: contato enviou mensagem pela primeira vez)
   */
  static async startConversation(contactId: string, channelId: string) {
    const existing = await ConversationRepository.findActive(contactId, channelId)
    if (existing) return existing

    return await ConversationRepository.create({
      contactId: contactId,
      channelId: channelId,
      status: 'OPEN'
    })
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
    const updated = await ConversationRepository.update(id, data);

    // Mesma lógica caso o status venha no update genérico
    if (data.status === 'CLOSED' && updated.contactId && updated.contact?.phone) {
      try {
        const { FeedbackService } = await import('@/services/feedback.service');
        const { SettingRepository } = await import('@/repositories/settingRepository');
        const { MessageService } = await import('@/services/messages');

        // 1. Gera o link público com o atendente responsável
        const feedback = await FeedbackService.requestFeedback(
          updated.contactId, 
          updated.contact.phone, 
          id,
          updated.assignedTo,
          updated.agent?.name
        );
        
        // Constrói a URL do feedback
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://motiva-talk.vercel.app';
        const feedbackLink = `${baseUrl}/feedback/${feedback.token}`;

        // 2. Busca a mensagem configurada pelo admin
        const settings = await SettingRepository.getChatSettings();
        const finishMessageBase = settings?.finishMessage || 'Seu atendimento foi finalizado. Gostaríamos de saber sua opinião sobre o nosso atendimento:';

        // 3. Monta e envia a mensagem final
        const finalMessage = `${finishMessageBase}\n\n${feedbackLink}`;
        
        await MessageService.createMessage({
          conversationId: id,
          channelId: updated.channelId,
          senderType: 'SYSTEM',
          content: finalMessage,
          type: 'TEXT'
        });

        console.log(`[FEEDBACK] Mensagem automática (update genérico) enviada para ${id}`);

      } catch (e: any) {
         console.warn(`[FEEDBACK] Erro em update genérico ao gerar feedback: ${e.message}`);
      }
    }

    return updated;
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
}
