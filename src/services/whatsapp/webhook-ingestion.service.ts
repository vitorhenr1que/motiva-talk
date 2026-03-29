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

    let finalMediaUrl = event.mediaUrl;
    let finalMimeType = event.mimeType || 'application/octet-stream';

    // --- TRATAMENTO DE MÍDIA: Download do WhatsApp -> Upload pro Nosso Storage (Supabase) ---
    if ((event.mediaUrl || event.base64) && !event.mediaUrl?.includes('supabase.co')) {
      try {
        const { generateId: genId } = await import('@/lib/utils');
        let buffer: ArrayBuffer;

        if (event.base64) {
          console.log(`[INGEST] Usando Base64 para mídia (${event.messageType})...`);
          const base64Data = event.base64.split(',').pop() || event.base64;
          const binaryBuffer = Buffer.from(base64Data, 'base64');
          buffer = binaryBuffer.buffer.slice(binaryBuffer.byteOffset, binaryBuffer.byteOffset + binaryBuffer.byteLength) as ArrayBuffer;
        } else if (event.mediaUrl) {
          console.log(`[INGEST] Baixando mídia externa via URL (${event.messageType}): ${event.mediaUrl}...`);
          
          const fetchHeaders: any = {};
          if (event.mediaUrl.includes('evolution.fazag.edu.br')) {
            fetchHeaders['apikey'] = process.env.EVOLUTION_API_KEY;
          }

          const response = await fetch(event.mediaUrl, { headers: fetchHeaders });
          if (!response.ok) throw new Error(`Falha no download da mídia: ${response.statusText}`);
          buffer = await response.arrayBuffer();
          const contentType = response.headers.get('content-type');
          if (contentType && contentType !== 'application/octet-stream') {
            finalMimeType = contentType;
          }
        } else {
          throw new Error('Nenhuma fonte de mídia (URL ou Base64) disponível.');
        }

        // --- Normalização do MimeType e Extensão ---
        if (event.messageType === 'AUDIO' && (finalMimeType === 'application/octet-stream' || !finalMimeType.includes('audio'))) {
          finalMimeType = 'audio/ogg'; // Default para WhatsApp
        }
        
        let extension = finalMimeType.split('/')[1]?.split(';')[0] || 'bin';
        if (extension === 'octet-stream' || extension === 'bin') {
          extension = event.messageType === 'AUDIO' ? 'ogg' : 'bin';
        }
        const fileName = `${genId()}.${extension}`;
        const filePath = `received/${channel.id}/${fileName}`;
        
        // Upload para o Supabase Storage (Bucket: chat-media)
        const { error: uploadError } = await supabaseAdmin.storage
          .from('chat-media')
          .upload(filePath, buffer, {
            contentType: finalMimeType,
            cacheControl: '3600',
            upsert: true
          });
          
        if (uploadError) throw uploadError;
        
        // Obter URL pública
        const { data: { publicUrl } } = supabaseAdmin.storage
          .from('chat-media')
          .getPublicUrl(filePath);
          
        console.log(`[INGEST] Transferência concluída. Novo URL: ${publicUrl}`);
        finalMediaUrl = publicUrl;
      } catch (err) {
        console.error(`[INGEST] Erro (não impeditivo) ao transferir mídia para storage permanente:`, err);
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

      console.log(`[INGEST] 1. Canal validado e pronto: ${channel.name} (${channel.id})`);

      // 2. Extrair metadados normalizados
      const isFromMe = !!metadata?.fromMe;
      const senderType = isFromMe ? 'AGENT' : 'USER';
      const externalId = metadata?.externalId;
      const dbMessageType = event.messageType || 'TEXT';
      
      console.log(`[INGEST] Processando mensagem ${externalId || 'sem ID'} do ${senderType}...`);
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

      // 6. Salvar Mensagem
      console.log(`[INGEST] Salvando no banco: Conv:${conversation.id} | Tipo:${dbMessageType} | ExternalId:${externalId || 'NONE'}`);
      
      // Normalização de campos que podem vir como objetos da Evolution (Long/Int64)
      const normalizeNumber = (val: any) => {
        if (val && typeof val === 'object' && 'low' in val) return val.low;
        return typeof val === 'number' ? val : null;
      };

      const { data: newMessage, error: msgError } = await supabaseAdmin
        .from('Message')
        .insert([{
          id: generateId(),
          conversationId: conversation.id,
          channelId: channel.id,
          senderType,
          content: content || '[Arquivo de Mídia]',
          type: dbMessageType,
          externalMessageId: externalId,
          replyToMessageId: replyToMessageId,
          mediaUrl: finalMediaUrl,
          fileName: event.fileName,
          mimeType: finalMimeType,
          fileSize: normalizeNumber(event.fileSize),
          duration: normalizeNumber(event.duration),
          thumbnailUrl: event.thumbnailUrl,
          createdAt: new Date(event.timestamp).toISOString()
        }])
        .select('*, replyTo:replyToMessageId(*)')
        .single()

      if (msgError) {
        console.error(`[INGEST] ERRO ao inserir mensagem:`, msgError);
        throw msgError;
      }
      console.log(`[INGEST] Mensagem persistida! ID: ${newMessage.id} | Media: ${!!newMessage.mediaUrl}`);

      // 7. Atualizar lastMessageAt e unreadCount da Conversa
      const updateData: any = { 
        lastMessageAt: new Date(event.timestamp).toISOString() 
      };
      
      if (senderType === 'USER') {
        const currentUnread = conversation.unreadCount || 0;
        updateData.unreadCount = currentUnread + 1;
        console.log(`[INGEST] Novo unreadCount: ${updateData.unreadCount}`);
      }
      
      await ConversationRepository.update(conversation.id, updateData);

      // 8. Notificação em Tempo Real
      const { RealtimeService } = await import('@/services/realtime.service');
      console.log(`[INGEST] Disparando Realtime para conversa ${conversation.id}...`);
      await RealtimeService.notifyNewMessage(conversation.id, newMessage);
      console.log(`[INGEST] Fluxo concluído com sucesso para ${newMessage.id}.`);

      return { conversation, message: newMessage };

    } catch (error) {
      console.error('CRITICAL: Message ingestion failed:', error);
      throw error;
    }
  }
}
