import { MessageRepository } from '@/repositories/messageRepository'
import { Channel } from '@/types/chat';

export interface CreateMessageData {
  conversationId: string;
  channelId: string;
  senderType: string;
  content: string;
  type?: string;
  externalMessageId?: string;
}

export class MessageService {
  /**
   * Lista histórico de mensagens paginado
   * Filtra mensagens apagadas (me/todos)
   */
  static async listByConversation(conversationId: string) {
    const messages = await MessageRepository.findMany({ conversationId })
    // Filtro básico na camada de serviço (podemos mover para o Repo depois se necessário)
    return messages.filter((m: any) => !m.deletedForMe)
  }

  /**
   * Registra uma nova mensagem no banco e envia via API se for do atendente
   */
  static async createMessage(data: CreateMessageData & { replyToMessageId?: string }) {
    const { conversationId, channelId, senderType, content, type, replyToMessageId } = data
    
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

    if (senderType === 'AGENT') {
      try {
        const { ConversationRepository } = await import('@/repositories/conversationRepository')
        const { evolutionProvider } = await import('@/services/whatsapp/evolution-provider')
        
        const conversation = await ConversationRepository.findById(conversationId)
        if (!conversation || !conversation.contact || !conversation.channel) {
          throw new Error('Conversa, contato ou canal não encontrados.')
        }

        const result = await evolutionProvider.sendMessage(
          conversation.channel,
          conversation.contact.phone,
          content,
          (type as any) || 'TEXT',
          quoted
        )

        externalMessageId = result?.key?.id || result?.message?.key?.id
      } catch (error) {
        console.error('[MSG_SERVICE] Erro ao enviar mensagem:', error)
      }
    }

    const newMessage = await MessageRepository.create({
      conversationId,
      channelId,
      senderType,
      content,
      type: type || 'TEXT',
      externalMessageId,
      replyToMessageId
    })

    if (senderType === 'AGENT') {
      const { ConversationRepository } = await import('@/repositories/conversationRepository')
      await ConversationRepository.update(conversationId, { 
        lastMessageAt: new Date().toISOString(),
        unreadCount: 0 
      })
    }

    return newMessage
  }

  /**
   * Apaga mensagem apenas para o atendente (localmente)
   */
  static async deleteForMe(id: string) {
    return await MessageRepository.update(id, { deletedForMe: true })
  }

  /**
   * Apaga mensagem para todos (Evolution API + Banco)
   */
  static async deleteForEveryone(id: string) {
    const message = await MessageRepository.findById(id);
    if (!message) throw new Error('Mensagem não encontrada');

    // 1. Apagar no WhatsApp via Evolution API se tiver ID externo
    if (message.externalMessageId) {
      try {
        const { ConversationRepository } = await import('@/repositories/conversationRepository');
        const { evolutionProvider } = await import('@/services/whatsapp/evolution-provider');
        
        const conversation = await ConversationRepository.findById(message.conversationId);
        if (conversation && conversation.contact && conversation.channel) {
           await evolutionProvider.deleteMessage(
             conversation.channel, 
             conversation.contact.phone, 
             message.externalMessageId,
             message.senderType === 'AGENT'
           );
        }
      } catch (error) {
        console.error('[MSG_SERVICE] Erro ao apagar no WhatsApp:', error);
      }
    }

    // 2. Atualizar no Banco (Marcamos como deletada para todos)
    return await MessageRepository.update(id, { 
      deletedForEveryone: true,
      content: '🚫 Mensagem apagada' 
    });
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

  static async getMessageById(id: string) {
    return await MessageRepository.findById(id)
  }

  static async deleteMessage(id: string) {
    return await MessageRepository.delete(id)
  }

  static async getLastMessage(conversationId: string) {
    return await MessageRepository.findLastByConversation(conversationId)
  }
}
