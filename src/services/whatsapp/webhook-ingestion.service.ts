import { supabaseAdmin } from '@/lib/supabase-admin';
import { WebhookEvent } from './provider';
import { evolutionApi } from '@/lib/evolution-api-client';
import { TenantChannel } from './tenant-resolver';

export class WebhookIngestionService {
  /**
   * Ingere mensagens recebidas via webhook.
   *
   * O Channel é resolvido pelo route a partir do instanceName/providerSessionId
   * e passado aqui já validado. NÃO refazemos a query de canal e NÃO confiamos
   * em organizationId vindo do payload — a fonte de verdade é o `channel` arg.
   */
  static async ingestMessage(event: WebhookEvent, channel: TenantChannel) {
    const { senderPhone, senderName, content, messageType, metadata } = event;
    const organizationId = channel.organizationId;
    const channelId = channel.id;
    const instanceName = channel.providerSessionId || channel.id;

    if (!senderPhone || (!content && !event.mediaUrl)) {
      console.warn(
        `[INGEST] org=${organizationId} channel=${channelId} skip: missing senderPhone ou content/media`
      );
      return;
    }

    // Mensagens recebidas NUNCA são bloqueadas por quota — perderíamos dados
    // do cliente. Apenas sinalizamos no log para o Super Admin acompanhar.
    try {
      const { LimitsService } = await import('@/services/limits.service');
      const status = await LimitsService.getMonthlyMessageStatus(organizationId);
      if (status.overQuota) {
        console.warn(
          `[INGEST][OVER_QUOTA] org=${organizationId} channel=${channelId} ` +
          `monthlyMessages=${status.current}/${status.max} — recebendo mesmo assim.`
        );
      }
    } catch (e: any) {
      console.error(`[INGEST] erro ao consultar quota org=${organizationId}:`, e?.message || e);
    }

    let finalMediaUrl = event.mediaUrl;
    let finalMimeType = event.mimeType || 'application/octet-stream';
    let localBase64 = event.base64;

    // Geramos o messageId antecipadamente para usá-lo como pasta no Storage
    // (organizationId/channelId/messageId/filename).
    const { generateId } = await import('@/lib/utils');
    const messageId = generateId();

    // --- TRATAMENTO DE MÍDIA: Download do WhatsApp -> Upload pro Storage interno ---
    if (finalMediaUrl?.includes('mmg.whatsapp.net') && !localBase64) {
      console.log(`[INGEST] org=${organizationId} channel=${channelId} mídia criptografada detectada, solicitando via Evolution API...`);
      localBase64 = await evolutionApi.getMediaBase64(instanceName, metadata);
    } else if ((channel as any).whatsappProvider === 'META_CLOUD' && finalMediaUrl && !localBase64) {
      console.log(`[INGEST] org=${organizationId} channel=${channelId} mídia Meta Cloud detectada, baixando...`);
      try {
        const { getWhatsAppProvider } = await import('./providers');
        const provider = getWhatsAppProvider('META_CLOUD');
        const buffer = await (provider as any).downloadMedia(channel, finalMediaUrl);
        localBase64 = buffer.toString('base64');
      } catch (err: any) {
        console.error(`[INGEST] Erro ao baixar mídia da Meta:`, err.message);
      }
    }

    if ((finalMediaUrl || localBase64) && !finalMediaUrl?.includes('supabase.co')) {
      try {
        let buffer: any;

        if (localBase64) {
          console.log(`[INGEST] org=${organizationId} channel=${channelId} processando localBase64...`);

          let rawBase64 = '';
          const obj = localBase64 as any;
          if (typeof localBase64 === 'object') {
            rawBase64 = obj.base64 || obj.response?.base64 || JSON.stringify(localBase64);
          } else {
            rawBase64 = localBase64 as string;
          }

          const base64Clean = rawBase64.split(',').pop() || '';
          buffer = Buffer.from(base64Clean, 'base64');
          console.log(`[INGEST] Buffer Base64 size=${buffer.length} bytes`);
        } else if (finalMediaUrl) {
          console.log(`[INGEST] org=${organizationId} channel=${channelId} baixando mídia de URL: ${finalMediaUrl}`);

          const fetchHeaders: any = {};
          if (finalMediaUrl.includes('evolution.fazag.edu.br')) {
            fetchHeaders['apikey'] = process.env.EVOLUTION_API_KEY;
          }

          const response = await fetch(finalMediaUrl, { headers: fetchHeaders });
          if (!response.ok) throw new Error(`Falha no download da mídia: ${response.statusText}`);

          const arrayBuffer = await response.arrayBuffer();
          buffer = Buffer.from(arrayBuffer);

          const contentType = response.headers.get('content-type');
          console.log(`[INGEST] Download ok status=${response.status} contentType=${contentType} size=${buffer.length}`);

          if (contentType && contentType !== 'application/octet-stream') {
            finalMimeType = contentType;
          }
        }

        if (!buffer || buffer.length === 0) {
          throw new Error('Buffer de mídia está vazio após processamento.');
        }

        const magic = buffer.slice(0, 4).toString('hex');
        console.log(`[INGEST] Magic bytes: ${magic} | ASCII: ${buffer.slice(0, 4).toString()}`);

        if (messageType === 'AUDIO') {
          if (magic === '4f676753') {
            finalMimeType = 'audio/ogg';
          } else if (magic.startsWith('1a45df')) {
            finalMimeType = 'audio/webm';
          } else if (magic.includes('66747970')) {
            finalMimeType = 'audio/mp4';
          } else if (finalMimeType === 'application/octet-stream' || !finalMimeType.includes('audio')) {
            finalMimeType = 'audio/ogg';
          }
        }

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

        const fileName = `${generateId()}.${extension}`;
        // Layout multi-tenant: organizationId/channelId/messageId/filename
        const filePath = `${organizationId}/${channelId}/${messageId}/${fileName}`;

        console.log(`[INGEST] Upload Storage path=${filePath} mime=${finalMimeType} org=${organizationId}`);

        const { error: uploadError } = await supabaseAdmin.storage
          .from('chat-media')
          .upload(filePath, buffer, {
            contentType: finalMimeType,
            cacheControl: '3600',
            upsert: true,
          });

        if (uploadError) throw uploadError;

        const {
          data: { publicUrl },
        } = supabaseAdmin.storage.from('chat-media').getPublicUrl(filePath);

        console.log(`[INGEST] Upload ok url=${publicUrl}`);
        finalMediaUrl = publicUrl;
      } catch (err) {
        console.error(
          `[INGEST] Erro crítico no pipeline de mídia (org=${organizationId} channel=${channelId}):`,
          err
        );
      }
    }

    // --- FILTER: Only Personal Contacts (~10-15 dígitos, exclude grupos/status) ---
    const jid = metadata?.jid || '';
    const isPersonal = jid.endsWith('@s.whatsapp.net');
    const numericOnly = senderPhone.replace(/\D/g, '');
    const hasValidLength = numericOnly.length >= 10 && numericOnly.length <= 15;

    if (!isPersonal || !hasValidLength) {
      console.log(
        `[INGEST] Ignorando contato não pessoal: ${senderPhone} (jid=${jid}, len=${numericOnly.length}, org=${organizationId})`
      );
      return;
    }

    try {
      const { ContactRepository } = await import('@/repositories/contactRepository');
      const { ConversationRepository } = await import('@/repositories/conversationRepository');
      const { SettingRepository } = await import('@/repositories/settingRepository');

      console.log(`[INGEST] 1. Canal validado: ${channel.name} (${channelId}) org=${organizationId}`);

      const isFromMe = !!metadata?.fromMe;
      const senderType = isFromMe ? 'AGENT' : 'USER';
      const externalId = metadata?.externalId;
      const dbMessageType = event.messageType || 'TEXT';

      console.log(`[INGEST] Mensagem ${externalId || 'sem ID'} sender=${senderType} org=${organizationId}`);
      if (externalId) {
        const { data: existing } = await supabaseAdmin
          .from('Message')
          .select('id')
          .eq('externalMessageId', externalId)
          .eq('organizationId', organizationId)
          .maybeSingle();

        if (existing) {
          console.log(`[INGEST] Deduplicação: mensagem ${externalId} já existe em org=${organizationId}. Ignorando.`);
          return;
        }
      }

      const contact = await ContactRepository.findOrCreateByPhone(
        senderPhone,
        senderName || senderPhone,
        organizationId
      );
      console.log(`[INGEST] 2. Contato ${contact.name} (${contact.id}) org=${organizationId}`);

      const { data: lastConversations } = await supabaseAdmin
        .from('Conversation')
        .select(`
          *,
          contact:Contact(*),
          channel:Channel(*),
          agent:User(*),
          sector:Sector!Conversation_currentSectorId_fkey(*),
          tags:ConversationTag(*, tag:Tag(*))
        `)
        .eq('organizationId', organizationId)
        .eq('contactId', contact.id)
        .eq('channelId', channelId)
        .order('lastMessageAt', { ascending: false })
        .limit(1);

      let conversation = lastConversations?.[0];

      if (!conversation) {
        console.log(`[INGEST] Criando nova conversa org=${organizationId}...`);
        const globalSettings = await SettingRepository.findByOrganization(organizationId);
        const initialSectorId: string | null =
          channel.defaultSectorId || globalSettings?.defaultTriageSectorId || null;

        conversation = await ConversationRepository.create(organizationId, {
          contactId: contact.id,
          channelId,
          currentSectorId: initialSectorId,
          status: 'OPEN',
          lastMessageAt: new Date().toISOString(),
        });

        const { ConversationSectorHistoryRepository } = await import(
          '@/repositories/conversationSectorHistoryRepository'
        );
        await ConversationSectorHistoryRepository.insert({
          conversationId: conversation.id,
          organizationId,
          sectorId: initialSectorId,
          enteredAt: conversation.createdAt,
        });

        console.log(
          `[INGEST] 3. Conversa criada: ${conversation.id} setor=${initialSectorId || 'NULL'} org=${organizationId}`
        );
      } else if (conversation.status === 'CLOSED') {
        console.log(`[INGEST] Reabrindo conversa ${conversation.id} (org=${organizationId})...`);

        const globalSettings = await SettingRepository.findByOrganization(organizationId);
        const triageSectorId =
          channel.defaultSectorId || globalSettings?.defaultTriageSectorId || null;

        const { data: reopened } = await supabaseAdmin
          .from('Conversation')
          .update({
            status: 'OPEN',
            assignedTo: null,
            finalizedBySectorId: null,
            currentSectorId: triageSectorId,
            unreadCount: 1,
          })
          .eq('id', conversation.id)
          .eq('organizationId', organizationId)
          .select(`
            *,
            contact:Contact(*),
            channel:Channel(*),
            agent:User(*),
            sector:Sector!Conversation_currentSectorId_fkey(*),
            tags:ConversationTag(*, tag:Tag(*))
          `)
          .single();

        conversation = reopened;

        const { ConversationSectorHistoryRepository } = await import(
          '@/repositories/conversationSectorHistoryRepository'
        );
        await ConversationSectorHistoryRepository.insert({
          conversationId: conversation.id,
          organizationId,
          sectorId: triageSectorId,
          enteredAt: new Date().toISOString(),
        });
      } else {
        console.log(`[INGEST] 3. Conversa ativa: ${conversation.id} org=${organizationId}`);

        if (!conversation.currentSectorId) {
          const globalSettings = await SettingRepository.findByOrganization(organizationId);
          const initialSectorId =
            channel.defaultSectorId || globalSettings?.defaultTriageSectorId || null;

          if (initialSectorId) {
            console.log(
              `[INGEST] Movendo conversa ${conversation.id} para triagem ${initialSectorId} (org=${organizationId})`
            );
            await ConversationRepository.update(conversation.id, organizationId, {
              currentSectorId: initialSectorId,
            });

            const { ConversationSectorHistoryRepository } = await import(
              '@/repositories/conversationSectorHistoryRepository'
            );
            await ConversationSectorHistoryRepository.insert({
              conversationId: conversation.id,
              organizationId,
              sectorId: initialSectorId,
              enteredAt: new Date().toISOString(),
            });

            conversation.currentSectorId = initialSectorId;
          }
        }
      }

      // --- TRATAMENTO ESPECIAL PARA REAÇÕES ---
      if (dbMessageType === 'REACTION') {
        const targetExternalId = event.targetMessageId;
        console.log(
          `[INGEST] Reação "${content}" -> mensagem ${targetExternalId} (org=${organizationId})`
        );

        if (targetExternalId) {
          const { data: targetMsg } = await supabaseAdmin
            .from('Message')
            .select('id, reactions')
            .eq('externalMessageId', targetExternalId)
            .eq('organizationId', organizationId)
            .maybeSingle();

          if (targetMsg) {
            const currentReactions = Array.isArray(targetMsg.reactions) ? targetMsg.reactions : [];
            const newReactions = [
              ...currentReactions,
              { emoji: content, sender: senderPhone, timestamp: event.timestamp },
            ];

            await supabaseAdmin
              .from('Message')
              .update({ reactions: newReactions })
              .eq('id', targetMsg.id)
              .eq('organizationId', organizationId);

            console.log(`[INGEST] Reação persistida em ${targetMsg.id} (org=${organizationId})`);
            return { conversation };
          }
        }
        return { conversation };
      }

      const replyToMessageId = metadata?.resolvedReplyToId;

      console.log(
        `[INGEST] Salvando msg conv=${conversation.id} type=${dbMessageType} extId=${externalId || 'NONE'} org=${organizationId}`
      );

      const normalizeNumber = (val: any) => {
        if (val && typeof val === 'object' && 'low' in val) return val.low;
        return typeof val === 'number' ? val : null;
      };

      const { data: newMessage, error: msgError } = await supabaseAdmin
        .from('Message')
        .insert([
          {
            id: messageId,
            organizationId,
            conversationId: conversation.id,
            channelId,
            sectorId: conversation.currentSectorId || null,
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
            createdAt: new Date(event.timestamp).toISOString(),
          },
        ])
        .select('*, replyToMessage:replyToMessageId(*)')
        .single();

      if (msgError) {
        console.error(`[INGEST] ERRO ao inserir mensagem (org=${organizationId}):`, msgError);
        throw msgError;
      }
      const { BillingService } = await import('@/services/billing.service');
      await BillingService.incrementMessageUsage(organizationId);
      console.log(`[INGEST] Mensagem persistida id=${newMessage.id} hasMedia=${!!newMessage.mediaUrl}`);

      const updateData: any = {
        lastMessageAt: new Date(event.timestamp).toISOString(),
      };

      if (senderType === 'USER') {
        const currentUnread = conversation.unreadCount || 0;
        updateData.unreadCount = currentUnread + 1;
        console.log(`[INGEST] unreadCount=${updateData.unreadCount} conv=${conversation.id}`);
      }

      await ConversationRepository.update(conversation.id, organizationId, updateData);

      if (senderType === 'USER') {
        const { MessageService } = await import('@/services/messages');
        await MessageService.cancelScheduledByCustomerReply(conversation.id, organizationId);
      }

      const { RealtimeService } = await import('@/services/realtime.service');
      console.log(`[INGEST] Realtime conv=${conversation.id} org=${organizationId}`);
      await RealtimeService.notifyNewMessage(conversation.id, newMessage);
      console.log(`[INGEST] Fluxo concluído msg=${newMessage.id} org=${organizationId}`);

      if (senderType === 'USER') {
        this.handleAutoReply(channel, contact, conversation).catch((err) => {
          console.error(
            `[INGEST] Erro Auto-Reply (org=${organizationId} channel=${channelId}):`,
            err
          );
        });
      }

      return { conversation, message: newMessage };
    } catch (error) {
      console.error(
        `[INGEST] CRITICAL: ingestion failed (org=${organizationId} channel=${channelId}):`,
        error
      );
      throw error;
    }
  }

  /**
   * Auto-reply escopado por organização. O channel já vem resolvido — usamos
   * channel.organizationId como tenant e channel.providerSessionId como instance
   * para o envio externo.
   */
  private static async handleAutoReply(
    channel: TenantChannel,
    contact: any,
    conversation: any
  ) {
    const organizationId = channel.organizationId;
    const channelId = channel.id;

    try {
      console.log(`[AUTO-REPLY] Verificando config org=${organizationId} channel=${channelId}`);

      const { data: settings } = await supabaseAdmin
        .from('auto_reply_settings')
        .select('*')
        .eq('organizationId', organizationId)
        .eq('channelId', channelId)
        .maybeSingle();

      if (!settings || !settings.enabled || !settings.message) {
        console.log(`[AUTO-REPLY] Desativado/sem mensagem org=${organizationId} channel=${channelId}`);
        return;
      }

      const { data: lastReply } = await supabaseAdmin
        .from('contact_auto_replies')
        .select('*')
        .eq('organizationId', organizationId)
        .eq('contactId', contact.id)
        .eq('channelId', channelId)
        .maybeSingle();

      const cooldownMs = (settings.cooldownHours || 24) * 60 * 60 * 1000;
      const now = new Date();

      if (lastReply) {
        const lastReplyAt = new Date(lastReply.lastAutoReplyAt);
        const timeSinceLastReply = now.getTime() - lastReplyAt.getTime();

        if (timeSinceLastReply < cooldownMs) {
          const remainingMinutes = Math.round((cooldownMs - timeSinceLastReply) / 1000 / 60);
          console.log(
            `[AUTO-REPLY] Cooldown ativo contact=${contact.id} org=${organizationId} restam=${remainingMinutes}min`
          );
          return;
        }
      }

      const instanceName = channel.providerSessionId || channel.id;
      console.log(
        `[AUTO-REPLY] Enviando org=${organizationId} channel=${channel.name}(${channelId}) -> ${contact.phone}`
      );

      try {
        const { getWhatsAppProvider } = await import('./providers');
        const provider = getWhatsAppProvider((channel as any).whatsappProvider);
        await provider.sendTextMessage(channel as any, contact.phone, settings.message);
      } catch (evoError) {
        console.error(
          `[AUTO-REPLY] Falha ao enviar mensagem automática (org=${organizationId} channel=${channelId}):`,
          evoError
        );
        return;
      }

      const { generateId } = await import('@/lib/utils');
      const { ConversationRepository } = await import('@/repositories/conversationRepository');
      const { RealtimeService } = await import('@/services/realtime.service');

      const { data: autoMsg, error: autoMsgError } = await supabaseAdmin
        .from('Message')
        .insert([
          {
            id: generateId(),
            organizationId,
            conversationId: conversation.id,
            channelId,
            senderType: 'SYSTEM',
            content: settings.message,
            type: 'TEXT',
            sendStatus: 'sent',
            metadata: { isAutoReply: true },
            createdAt: now.toISOString(),
          },
        ])
        .select()
        .single();

      if (autoMsgError) throw autoMsgError;

      if (lastReply) {
        await supabaseAdmin
          .from('contact_auto_replies')
          .update({ lastAutoReplyAt: now.toISOString(), updatedAt: now.toISOString() })
          .eq('id', lastReply.id)
          .eq('organizationId', organizationId);
      } else {
        await supabaseAdmin
          .from('contact_auto_replies')
          .insert([
            {
              organizationId,
              contactId: contact.id,
              channelId,
              lastAutoReplyAt: now.toISOString(),
            },
          ]);
      }

      await ConversationRepository.update(conversation.id, organizationId, {
        lastMessageAt: now.toISOString(),
        lastMessagePreview: settings.message.substring(0, 100),
      });

      await RealtimeService.notifyNewMessage(conversation.id, autoMsg);

      console.log(`[AUTO-REPLY] Sucesso msg=${autoMsg.id} org=${organizationId} channel=${channelId}`);
    } catch (error) {
      console.error(
        `[AUTO-REPLY] Erro crítico (org=${organizationId} channel=${channelId}):`,
        error
      );
    }
  }
}
