import { supabaseAdmin } from '@/lib/supabase-admin';
import { WebhookEvent } from './provider';
import { evolutionApi } from '@/lib/evolution-api-client';

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
    let localBase64 = event.base64;

    // --- TRATAMENTO DE MÍDIA: Download do WhatsApp -> Upload pro Nosso Storage (Supabase) ---
    // Se for URL do WhatsApp (mmg.whatsapp.net), ela está criptografada.
    // Solicitamos a versão descriptografada via API da Evolution se não vier no Webhook.
    if (finalMediaUrl?.includes('mmg.whatsapp.net') && !localBase64) {
       console.log(`[INGEST] Mídia criptografada detectada (AUDIO/MEDIA). Solicitando via API...`);
       localBase64 = await evolutionApi.getMediaBase64(channelId, metadata);
    }

    if ((finalMediaUrl || localBase64) && !finalMediaUrl?.includes('supabase.co')) {
      try {
        const { generateId: genId } = await import('@/lib/utils');
        let buffer: any;

        // Normalização do localBase64 (caso venha objeto da Evolution ou com prefixo data:)
        if (localBase64) {
          console.log(`[INGEST] Processando localBase64...`);
          
          let rawBase64 = '';
          const obj = localBase64 as any;
          if (typeof localBase64 === 'object') {
             rawBase64 = obj.base64 || obj.response?.base64 || JSON.stringify(localBase64);
          } else {
             rawBase64 = localBase64 as string;
          }

          const base64Clean = rawBase64.split(',').pop() || '';
          buffer = Buffer.from(base64Clean, 'base64');
          console.log(`[INGEST] Buffer criado via Base64. Tamanho: ${buffer.length} bytes`);
        } else if (finalMediaUrl) {
          console.log(`[INGEST] Baixando mídia via URL: ${finalMediaUrl}...`);
          
          const fetchHeaders: any = {};
          if (finalMediaUrl.includes('evolution.fazag.edu.br')) {
            fetchHeaders['apikey'] = process.env.EVOLUTION_API_KEY;
          }

          const response = await fetch(finalMediaUrl, { headers: fetchHeaders });
          if (!response.ok) throw new Error(`Falha no download da mídia: ${response.statusText}`);
          
          const arrayBuffer = await response.arrayBuffer();
          buffer = Buffer.from(arrayBuffer);
          
          const contentType = response.headers.get('content-type');
          console.log(`[INGEST] Download concluído. Status=${response.status}, ContentType=${contentType}, Size=${buffer.length} bytes`);
          
          if (contentType && contentType !== 'application/octet-stream') {
            finalMimeType = contentType;
          }
        }

        if (!buffer || buffer.length === 0) {
          throw new Error('Buffer de mídia está vazio após processamento.');
        }

        // --- Diagnóstico de Conteúdo (Magic Bytes) ---
        const magic = buffer.slice(0, 4).toString('hex');
        console.log(`[INGEST] Diagnóstico de Buffer - Magic Bytes: ${magic} | ASCII: ${buffer.slice(0, 4).toString()}`);

        if (messageType === 'AUDIO') {
          // WhatsApp Audio standard is OGG/Opus. Magic: 4f676753 (OggS)
          if (magic === '4f676753') {
             console.log(`[INGEST] Detectado container OGG válido.`);
             finalMimeType = 'audio/ogg';
          } else if (magic.startsWith('1a45df')) {
             console.log(`[INGEST] Detectado container WebM.`);
             finalMimeType = 'audio/webm';
          } else if (magic.includes('66747970')) {
             console.log(`[INGEST] Detectado container MP4.`);
             finalMimeType = 'audio/mp4';
          } else if (finalMimeType === 'application/octet-stream' || !finalMimeType.includes('audio')) {
             // Fallback se não detectou magic conhecido mas é audio
             finalMimeType = 'audio/ogg'; 
          }
        }
        
        // --- Custom normalization for extensions ---
        let extension = 'bin';
        if (finalMimeType.includes('audio/ogg') || finalMimeType.includes('audio/opus')) extension = 'ogg';
        else if (finalMimeType.includes('audio/mp4')) extension = 'mp4';
        else if (finalMimeType.includes('audio/mpeg')) extension = 'mp3';
        else if (finalMimeType.includes('image/jpeg')) extension = 'jpg';
        else if (finalMimeType.includes('image/png')) extension = 'png';
        else if (finalMimeType.includes('video/mp4')) extension = 'mp4';
        else {
          extension = finalMimeType.split('/')[1]?.split(';')[0] || 'bin';
          if (extension === 'octet-stream') extension = 'bin';
        }

        const fileName = `${genId()}.${extension}`;
        const filePath = `received/${channel.id}/${fileName}`;
        
        console.log(`[INGEST] Enviando para Supabase: ${filePath} | Mime: ${finalMimeType}`);

        // Upload para o Supabase Storage (Bucket: chat-media)
        const { error: uploadError } = await supabaseAdmin.storage
          .from('chat-media')
          .upload(filePath, buffer, {
            contentType: finalMimeType,
            cacheControl: '3600',
            upsert: true
          });
          
        if (uploadError) throw uploadError;
        
        const { data: { publicUrl } } = supabaseAdmin.storage
          .from('chat-media')
          .getPublicUrl(filePath);
          
        console.log(`[INGEST] Sucesso! URL Final: ${publicUrl}`);
        finalMediaUrl = publicUrl;
      } catch (err) {
        console.error(`[INGEST] Erro crítico no pipeline de mídia:`, err);
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

      // --- TRATAMENTO ESPECIAL PARA REAÇÕES ---
      if (dbMessageType === 'REACTION') {
        const targetExternalId = event.targetMessageId;
        console.log(`[INGEST] Processando REAÇÃO "${content}" para mensagem original ${targetExternalId}`);
        
        if (targetExternalId) {
          const { data: targetMsg } = await supabaseAdmin
            .from('Message')
            .select('id, reactions')
            .eq('externalMessageId', targetExternalId)
            .maybeSingle();

          if (targetMsg) {
            const currentReactions = Array.isArray(targetMsg.reactions) ? targetMsg.reactions : [];
            // Adiciona a nova reação (ou atualiza se for do mesmo remetente, mas aqui simplificaremos adicionando)
            const newReactions = [...currentReactions, { emoji: content, sender: senderPhone, timestamp: event.timestamp }];
            
            await supabaseAdmin
              .from('Message')
              .update({ reactions: newReactions })
              .eq('id', targetMsg.id);
            
            console.log(`[INGEST] Reação persistida na mensagem ${targetMsg.id}`);
            return { conversation }; // Retorna cedo, pois não queremos criar uma nova mensagem
          }
        }
        return { conversation };
      }
      // ----------------------------------------

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
          metadata: metadata,
          createdAt: new Date(event.timestamp).toISOString()
        }])
        .select('*, replyToMessage:replyToMessageId(*)')
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
      
      // Cancelar agendamentos se o cliente responder
      if (senderType === 'USER') {
        const { MessageService } = await import('@/services/messages');
        await MessageService.cancelScheduledByCustomerReply(conversation.id);
      }

      // 8. Notificação em Tempo Real
      const { RealtimeService } = await import('@/services/realtime.service');
      console.log(`[INGEST] Disparando Realtime para conversa ${conversation.id}...`);
      await RealtimeService.notifyNewMessage(conversation.id, newMessage);
      console.log(`[INGEST] Fluxo concluído com sucesso para ${newMessage.id}.`);

      // 9. Resposta Automática (Auto-Reply)
      if (senderType === 'USER') {
        // Dispara de forma assíncrona para não atrasar o retorno do webhook
        this.handleAutoReply(channel, contact, conversation).catch(err => {
          console.error(`[INGEST] Erro ao processar Auto-Reply:`, err);
        });
      }

      return { conversation, message: newMessage };

    } catch (error) {
      console.error('CRITICAL: Message ingestion failed:', error);
      throw error;
    }
  }

  /**
   * Processa e envia uma resposta automática se as condições forem atendidas.
   */
  private static async handleAutoReply(channel: any, contact: any, conversation: any) {
    try {
      console.log(`[AUTO-REPLY] Verificando configuração para canal ${channel.id}...`);
      
      // 1. Buscar configuração em auto_reply_settings
      const { data: settings } = await supabaseAdmin
        .from('auto_reply_settings')
        .select('*')
        .eq('channelId', channel.id)
        .maybeSingle();

      if (!settings || !settings.enabled || !settings.message) {
        console.log(`[AUTO-REPLY] Configuração desativada ou mensagem vazia para canal ${channel.id}.`);
        return;
      }

      // 2. Verificar cooldown em contact_auto_replies
      const { data: lastReply } = await supabaseAdmin
        .from('contact_auto_replies')
        .select('*')
        .eq('contactId', contact.id)
        .eq('channelId', channel.id)
        .maybeSingle();

      const cooldownMs = (settings.cooldownHours || 24) * 60 * 60 * 1000;
      const now = new Date();

      if (lastReply) {
        const lastReplyAt = new Date(lastReply.lastAutoReplyAt);
        const timeSinceLastReply = now.getTime() - lastReplyAt.getTime();

        if (timeSinceLastReply < cooldownMs) {
          const remainingMinutes = Math.round((cooldownMs - timeSinceLastReply) / 1000 / 60);
          console.log(`[AUTO-REPLY] Cooldown ativo para contato ${contact.id}. Faltam ${remainingMinutes} minutos.`);
          return;
        }
      }

      // 3. Enviar mensagem via Evolution API
      const instanceName = channel.providerSessionId || channel.id;
      console.log(`[AUTO-REPLY] Enviando mensagem automática no canal ${channel.name} para ${contact.phone}...`);
      
      try {
        await evolutionApi.sendMessage(instanceName, {
          number: contact.phone,
          text: settings.message
        });
      } catch (evoError) {
        console.error(`[AUTO-REPLY] Erro da Evolution API:`, evoError);
        return; // Se falhou o envio externo, não registramos no banco
      }

      const { generateId } = await import('@/lib/utils');
      const { ConversationRepository } = await import('@/repositories/conversationRepository');
      const { RealtimeService } = await import('@/services/realtime.service');

      // 4. Salvar no banco como mensagem enviada pelo sistema
      const { data: autoMsg, error: autoMsgError } = await supabaseAdmin
        .from('Message')
        .insert([{
          id: generateId(),
          conversationId: conversation.id,
          channelId: channel.id,
          senderType: 'SYSTEM',
          content: settings.message,
          type: 'TEXT',
          sendStatus: 'sent',
          metadata: { isAutoReply: true },
          createdAt: now.toISOString()
        }])
        .select()
        .single();

      if (autoMsgError) throw autoMsgError;

      // 5. Atualizar contact_auto_replies.lastAutoReplyAt
      if (lastReply) {
        await supabaseAdmin
          .from('contact_auto_replies')
          .update({ lastAutoReplyAt: now.toISOString(), updatedAt: now.toISOString() })
          .eq('id', lastReply.id);
      } else {
        await supabaseAdmin
          .from('contact_auto_replies')
          .insert([{
            contactId: contact.id,
            channelId: channel.id,
            lastAutoReplyAt: now.toISOString()
          }]);
      }

      // 6. Atualizar conversa (lastMessageAt para subir no topo)
      await ConversationRepository.update(conversation.id, {
        lastMessageAt: now.toISOString(),
        lastMessagePreview: settings.message.substring(0, 100)
      });

      // 7. Notificar via Realtime para aparecer no chat imediatamente
      await RealtimeService.notifyNewMessage(conversation.id, autoMsg);
      
      console.log(`[AUTO-REPLY] Sucesso! Mensagem automática registrada: ${autoMsg.id}`);

    } catch (error) {
      console.error(`[AUTO-REPLY] Erro crítico no fluxo:`, error);
    }
  }
}
