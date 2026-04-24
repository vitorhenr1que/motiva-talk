import { supabaseAdmin } from '@/lib/supabase-admin';
import { generateId } from '@/lib/utils';
import { AppError } from '@/lib/api-errors';
import { ConversationRepository } from '@/repositories/conversationRepository';
import { MessageRepository } from '@/repositories/messageRepository';
import { evolutionProvider } from '@/services/whatsapp/evolution-provider';
import type { Channel, MessageType } from '@/types/chat';

type SendStatus = 'sending' | 'sent' | 'failed';

interface ForwardBatchInput {
  messageIds: string[];
  targetContactIds: string[];
  channelId: string;
}

interface ForwardedRow {
  id: string;
  conversationId: string;
  channelId: string;
  type: MessageType;
  content: string;
  mediaUrl: string | null;
  fileName: string | null;
  mimeType: string | null;
  fileSize: number | null;
  duration: number | null;
  thumbnailUrl: string | null;
  forwardedFromMessageId: string;
  sendStatus: SendStatus;
}

/**
 * Concurrency limits tuned per media-weight class.
 * Text is cheap; media hits the provider harder.
 */
const CONCURRENCY = {
  TEXT: 3,
  MEDIA: 2,
};

const BATCH_DELAY_MS = 150;

export class ForwardService {
  /**
   * Entry point for POST /api/messages/forward-batch.
   * Resolves destinations, inserts all forwarded rows as sendStatus='sending',
   * and dispatches Evolution sends with bounded concurrency in the background.
   * Returns as soon as the DB rows exist so realtime can paint the chat.
   */
  static async forwardBatch(input: ForwardBatchInput) {
    const { messageIds, targetContactIds, channelId } = input;

    if (!messageIds?.length) throw new AppError('messageIds é obrigatório', 400, 'VALIDATION_ERROR');
    if (!targetContactIds?.length) throw new AppError('targetContactIds é obrigatório', 400, 'VALIDATION_ERROR');
    if (!channelId) throw new AppError('channelId é obrigatório', 400, 'VALIDATION_ERROR');

    const originals = await this.loadOriginals(messageIds);
    if (!originals.length) throw new AppError('Nenhuma mensagem válida encontrada', 404, 'NOT_FOUND');

    const channel = await this.loadChannel(channelId);

    const conversationByContact = await this.resolveConversations(targetContactIds, channelId);

    const rows = this.buildForwardedRows(originals, conversationByContact, channelId);

    if (rows.length === 0) {
      return { enqueued: 0, conversationIds: [] };
    }

    await this.insertRows(rows);

    void this.dispatchAll(rows, channel, conversationByContact).catch((err) => {
      console.error('[FORWARD] Dispatch loop crashed:', err);
    });

    return {
      enqueued: rows.length,
      conversationIds: Array.from(new Set(rows.map((r) => r.conversationId))),
    };
  }

  private static async loadOriginals(messageIds: string[]) {
    const { data, error } = await supabaseAdmin
      .from('Message')
      .select('id, type, content, mediaUrl, fileName, mimeType, fileSize, duration, thumbnailUrl, metadata')
      .in('id', messageIds);

    if (error) throw error;

    const byId = new Map<string, any>((data || []).map((m: any) => [m.id, m]));
    return messageIds.map((id) => byId.get(id)).filter(Boolean);
  }

  private static async loadChannel(channelId: string): Promise<Channel> {
    const { data, error } = await supabaseAdmin
      .from('Channel')
      .select('*')
      .eq('id', channelId)
      .single();
    if (error || !data) throw new AppError('Canal não encontrado', 404, 'NOT_FOUND');
    return data as Channel;
  }

  /**
   * For each target contact, reuse active (OPEN/IN_PROGRESS) conversation
   * or create a new OPEN one. Never duplicate.
   */
  private static async resolveConversations(
    contactIds: string[],
    channelId: string
  ): Promise<Map<string, { id: string; phone: string }>> {
    const uniqueContactIds = Array.from(new Set(contactIds));

    const { data: contacts, error: cErr } = await supabaseAdmin
      .from('Contact')
      .select('id, phone')
      .in('id', uniqueContactIds);
    if (cErr) throw cErr;

    const phoneByContact = new Map<string, string>((contacts || []).map((c: any) => [c.id, c.phone]));

    const result = new Map<string, { id: string; phone: string }>();

    for (const contactId of uniqueContactIds) {
      const phone = phoneByContact.get(contactId);
      if (!phone) {
        console.warn(`[FORWARD] Contato ${contactId} sem telefone — ignorado`);
        continue;
      }

      const existing = await ConversationRepository.findActive(contactId, channelId);
      if (existing) {
        result.set(contactId, { id: existing.id, phone });
        continue;
      }

      const created = await ConversationRepository.create({
        contactId,
        channelId,
        status: 'OPEN',
      });
      result.set(contactId, { id: created.id, phone });
    }

    return result;
  }

  /**
   * Build one forwarded row per (original × target conversation).
   * Reuses mediaUrl — no storage copy, no re-upload.
   */
  private static buildForwardedRows(
    originals: any[],
    convByContact: Map<string, { id: string; phone: string }>,
    channelId: string
  ): ForwardedRow[] {
    const rows: ForwardedRow[] = [];

    for (const [, { id: conversationId }] of convByContact) {
      for (const orig of originals) {
        rows.push({
          id: generateId(),
          conversationId,
          channelId,
          type: orig.type,
          content: orig.content || '',
          mediaUrl: orig.mediaUrl || null,
          fileName: orig.fileName || null,
          mimeType: orig.mimeType || null,
          fileSize: orig.fileSize || null,
          duration: orig.duration || null,
          thumbnailUrl: orig.thumbnailUrl || null,
          forwardedFromMessageId: orig.id,
          sendStatus: 'sending',
        });
      }
    }

    return rows;
  }

  private static async insertRows(rows: ForwardedRow[]) {
    const payload = rows.map((r) => ({
      id: r.id,
      conversationId: r.conversationId,
      channelId: r.channelId,
      senderType: 'AGENT',
      type: r.type,
      content: r.content,
      mediaUrl: r.mediaUrl,
      fileName: r.fileName,
      mimeType: r.mimeType,
      fileSize: r.fileSize,
      duration: r.duration,
      thumbnailUrl: r.thumbnailUrl,
      isForwarded: true,
      forwardedFromMessageId: r.forwardedFromMessageId,
      sendStatus: r.sendStatus,
      createdAt: new Date().toISOString(),
    }));

    const { error } = await supabaseAdmin.from('Message').insert(payload);
    if (error) {
      console.error('[FORWARD] Falha ao inserir mensagens encaminhadas em lote:', error);
      throw error;
    }
  }

  /**
   * Splits rows into TEXT vs MEDIA lanes, runs each lane with its own
   * concurrency cap and inter-batch delay. Each row's status is flipped
   * to 'sent' or 'failed' independently, so realtime sees a rolling update.
   */
  private static async dispatchAll(
    rows: ForwardedRow[],
    channel: Channel,
    convByContact: Map<string, { id: string; phone: string }>
  ) {
    const phoneByConv = new Map<string, string>();
    for (const [, { id, phone }] of convByContact) phoneByConv.set(id, phone);

    const textRows = rows.filter((r) => r.type === 'TEXT');
    const mediaRows = rows.filter((r) => r.type !== 'TEXT');

    await Promise.all([
      this.runLane(textRows, CONCURRENCY.TEXT, channel, phoneByConv),
      this.runLane(mediaRows, CONCURRENCY.MEDIA, channel, phoneByConv),
    ]);
  }

  private static async runLane(
    rows: ForwardedRow[],
    concurrency: number,
    channel: Channel,
    phoneByConv: Map<string, string>
  ) {
    for (let i = 0; i < rows.length; i += concurrency) {
      const batch = rows.slice(i, i + concurrency);
      await Promise.all(batch.map((r) => this.dispatchOne(r, channel, phoneByConv)));
      if (i + concurrency < rows.length) {
        await delay(BATCH_DELAY_MS);
      }
    }
  }

  private static async dispatchOne(
    row: ForwardedRow,
    channel: Channel,
    phoneByConv: Map<string, string>
  ) {
    const phone = phoneByConv.get(row.conversationId);
    if (!phone) {
      await this.markFailed(row.id, 'Telefone do destinatário não encontrado');
      return;
    }

    try {
      const result = await evolutionProvider.sendMessage(
        channel,
        phone,
        row.content,
        row.type,
        undefined,
        {
          mediaUrl: row.mediaUrl || row.content,
          fileName: row.fileName || undefined,
          mimeType: row.mimeType || undefined,
          fileSize: row.fileSize || undefined,
          duration: row.duration || undefined,
        }
      );

      console.log(`[FORWARD] Resultado Evolution para ${row.id}:`, JSON.stringify(result));

      // Busca o ID em múltiplos lugares possíveis dependendo da versão/tipo da mensagem
      const externalMessageId = 
        result?.key?.id || 
        result?.message?.key?.id || 
        result?.data?.key?.id ||
        (typeof result === 'string' ? result : null);

      await MessageRepository.update(row.id, {
        sendStatus: 'sent',
        errorMessage: null,
        externalMessageId: externalMessageId || 'sent_via_evolution',
      });
    } catch (err: any) {
      const msg = err?.message || 'Falha desconhecida no envio';
      console.error(`[FORWARD] Falha ao enviar ${row.id} (${row.type}):`, msg);
      
      // Se falhou, atualizamos no banco para o usuário ver o erro em vez de carregar para sempre
      await MessageRepository.update(row.id, {
        sendStatus: 'failed',
        errorMessage: msg
      });
    }
  }

  private static async markFailed(id: string, errorMessage: string) {
    try {
      await MessageRepository.update(id, {
        sendStatus: 'failed',
        errorMessage: errorMessage.substring(0, 500),
      });
    } catch (e) {
      console.error(`[FORWARD] Falha ao marcar mensagem ${id} como failed:`, e);
    }
  }
}

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}
