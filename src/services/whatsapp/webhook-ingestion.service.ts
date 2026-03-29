import { supabaseAdmin } from '@/lib/supabase-admin';
import { WebhookEvent } from './provider';

export class WebhookIngestionService {
  /**
   * Main entry point for ingesting incoming messages from WhatsApp.
   */
  static async ingestMessage(event: WebhookEvent) {
    const { channelId, senderPhone, senderName, content, messageType, metadata } = event;
    const externalMessageId = metadata?.key?.id;

    if (!senderPhone || (!content && !event.mediaUrl)) {
      console.warn('Skipping message ingestion: missing senderPhone or content/media');
      return;
    }

    // --- Identificar ou Criar Canal (antes de qualquer coisa pra ter o ID) ---
    const { data: channels } = await supabaseAdmin.from('Channel').select('*');
    const channel = channels?.find(c => 
      c.id === channelId || 
      c.id.replace(/-/g, '') === channelId ||
      c.providerSessionId === channelId
    );

    if (!channel) {
      console.error(`[INGEST] ERRO: Canal ${channelId} não encontrado no banco.`);
      return;
    }

    // --- TRATAMENTO DE MÍDIA: Download do WhatsApp -> Upload pro Nosso Storage (Supabase) ---
    if (event.mediaUrl && !event.mediaUrl.includes('supabase.co')) {
      try {
        console.log(`[INGEST] Detectada mídia externa (${messageType}): ${event.mediaUrl}. Transferindo para o Supabase Storage...`);
        const { generateId } = await import('@/lib/utils');
        
        // 1. Download do arquivo
        const response = await fetch(event.mediaUrl);
        if (!response.ok) throw new Error(`Falha no download da mídia: ${response.statusText}`);
        
        const buffer = await response.arrayBuffer();
        const mimeType = event.mimeType || response.headers.get('content-type') || 'application/octet-stream';
        const extension = mimeType.split('/')[1]?.split(';')[0] || 'bin';
        const fileName = `${generateId()}.${extension}`;
        const filePath = `received/${channel.id}/${fileName}`;
        
        // 2. Upload para o Supabase Storage (Bucket: chat-media)
        const { error: uploadError } = await supabaseAdmin.storage
          .from('chat-media')
          .upload(filePath, buffer, {
            contentType: mimeType,
            cacheControl: '3600',
            upsert: true
          });
          
        if (uploadError) throw uploadError;
        
        // 3. Obter URL pública
        const { data: { publicUrl } } = supabaseAdmin.storage
          .from('chat-media')
          .getPublicUrl(filePath);
          
        console.log(`[INGEST] Transferência concluída. Novo URL: ${publicUrl}`);
        event.mediaUrl = publicUrl;
      } catch (err) {
        console.error(`[INGEST] Erro crítico ao transferir mídia externa:`, err);
        // Mantemos o URL original se falhar, na esperança de que ainda funcione temporariamente
      }
    }
    // --------------------------------------------------------------------------------------

    // --- FILTER: Only Personal Contacts (roughly 12 digits, exclude groups/status) ---
    const jid = metadata?.jid || '';
    const isPersonal = jid.endsWith('@s.whatsapp.net');
    const numericOnly = senderPhone.replace(/\D/g, '');
    const hasValidLength = numericOnly.length >= 10 && numericOnly.length <= 15;

    if (!isPersonal || !hasValidLength) {
      console.log(`[INGEST] Ignorando contato não pessoal: ${senderPhone} (JID: ${jid}, Len: ${numericOnly.length})`);
      return;
    }
    // ---------------------------------------------------------------------------------

    try {
      const { ContactRepository } = await import('@/repositories/contactRepository');
      const { ConversationRepository } = await import('@/repositories/conversationRepository');
      const { generateId } = await import('@/lib/utils');

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
      const replyToMessageId = metadata?.resolvedReplyToId;
      if (replyToMessageId) {
        console.log(`[INGEST] Persistindo vínculo com mensagem original: DB ID ${replyToMessageId}`);
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
          replyToMessageId: replyToMessageId,
          mediaUrl: event.mediaUrl,
          fileName: event.fileName,
          mimeType: event.mimeType,
          fileSize: event.fileSize,
          duration: event.duration,
          thumbnailUrl: event.thumbnailUrl,
          createdAt: new Date(event.timestamp).toISOString()
        }])
        .select('*, replyTo:replyToMessageId(*)')
        .single()

      if (msgError) throw msgError
      console.log(`[INGEST] 4. Mensagem salva com sucesso! (ID: ${newMessage.id})`);

      // 7. Atualizar lastMessageAt e unreadCount da Conversa
      const updateData: any = { 
        lastMessageAt: new Date(event.timestamp).toISOString() 
      };
      
      // Incrementa não lidas se a mensagem for do usuário e não estivermos com a conversa aberta no momento
      // (A lógica de resetar pra 0 ao ler será feita no frontend/API de leitura)
      if (senderType === 'USER') {
        const currentUnread = conversation.unreadCount || 0;
        updateData.unreadCount = currentUnread + 1;
        console.log(`[INGEST] Incrementando não lidas para conversa ${conversation.id}: ${currentUnread} -> ${updateData.unreadCount}`);
      }
      
      await ConversationRepository.update(conversation.id, updateData);

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
