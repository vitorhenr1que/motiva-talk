import { supabaseAdmin } from '@/lib/supabase-admin';
import { WebhookEvent } from './provider';

export class WebhookIngestionService {
  /**
   * Main entry point for ingesting incoming messages from WhatsApp.
   */
  static async ingestMessage(event: WebhookEvent) {
    const { channelId, senderPhone, senderName, content, messageType, metadata } = event;
    const externalMessageId = metadata?.key?.id;

    if (!senderPhone || !content) {
      console.warn('Skipping message ingestion: missing senderPhone or content');
      return;
    }

    try {
      const { ContactRepository } = await import('@/repositories/contactRepository');
      const { ConversationRepository } = await import('@/repositories/conversationRepository');
      const { generateId } = await import('@/lib/utils');

      // 1. Identificar canal (handles UUID dash differences)
      const { data: channels } = await supabaseAdmin
        .from('Channel')
        .select('*')

      const channel = channels?.find(c => 
        c.id === channelId || 
        c.id.replace(/-/g, '') === channelId ||
        c.providerSessionId === channelId
      );

      if (!channel) {
        console.error(`[INGEST] ERRO: Canal ${channelId} não encontrado no banco.`);
        return;
      }
      console.log(`[INGEST] 1. Canal encontrado: ${channel.name} (${channel.id})`);

      // 2. Extrair metadados normalizados
      const isFromMe = !!metadata?.fromMe;
      const senderType = isFromMe ? 'AGENT' : 'USER';
      const externalId = metadata?.externalId;

      // 3. Deduplicação por externalId
      if (externalId) {
        const { data: existing } = await supabaseAdmin
          .from('Message')
          .select('id')
          .eq('externalMessageId', externalId)
          .maybeSingle()
        
        if (existing) {
          console.log(`[INGEST] Deduplicação aplicada: Mensagem ${externalId} já existe. Ignorando.`);
          return;
        }
      }

      // 4. Identificar ou Criar Contato
      const contact = await ContactRepository.findOrCreateByPhone(
        senderPhone, 
        senderName || senderPhone
      );
      console.log(`[INGEST] 2. Contato encontrado/criado: ${contact.name} (${contact.id})`);

      // 5. Identificar ou Criar Conversa Aberta
      let conversation = await ConversationRepository.findActive(contact.id, channel.id);

      if (!conversation) {
        console.log(`[INGEST] Criando nova conversa para o contato...`);
        conversation = await ConversationRepository.create({
          contactId: contact.id,
          channelId: channel.id,
          status: 'OPEN',
          lastMessageAt: new Date().toISOString()
        });
        console.log(`[INGEST] 3. Conversa criada: ${conversation.id}`);
      } else {
        console.log(`[INGEST] 3. Conversa ativa encontrada: ${conversation.id}`);
      }

      // 5.5 Identificar se é uma resposta (Reply)
      let replyToMessageId: string | undefined = undefined;
      const quotedId = metadata?.quoted?.key?.id;
      if (quotedId) {
        const { data: quotedMsg } = await supabaseAdmin
          .from('Message')
          .select('id')
          .eq('externalMessageId', quotedId)
          .maybeSingle();
        
        if (quotedMsg) {
          replyToMessageId = quotedMsg.id;
          console.log(`[INGEST] Mensagem citada encontrada no banco (ID: ${replyToMessageId})`);
        }
      }

      // 6. Salvar Mensagem
      const { data: newMessage, error: msgError } = await supabaseAdmin
        .from('Message')
        .insert([{
          id: generateId(),
          conversationId: conversation.id,
          channelId: channel.id,
          senderType,
          content: content,
          type: messageType || 'TEXT',
          externalMessageId: externalId,
          replyToMessageId: replyToMessageId
        }])
        .select('*, replyTo:replyToMessageId(*)')
        .single()

      if (msgError) throw msgError
      console.log(`[INGEST] 4. Mensagem salva com sucesso! (ID: ${newMessage.id})`);

      // 7. Atualizar lastMessageAt da Conversa
      await ConversationRepository.update(conversation.id, { 
        lastMessageAt: new Date().toISOString() 
      });

      // 8. Notificação em Tempo Real
      const { RealtimeService } = await import('@/services/realtime.service');
      await RealtimeService.notifyNewMessage(conversation.id, newMessage);

      return { conversation, message: newMessage };

    } catch (error) {
      console.error('CRITICAL: Message ingestion failed:', error);
      throw error;
    }
  }
}
