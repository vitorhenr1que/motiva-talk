import { AutoReplyRepository } from '@/repositories/autoReplyRepository';
import { ConversationRepository } from '@/repositories/conversationRepository';
import { RealtimeService } from '@/services/realtime.service';
import { TenantChannel } from '@/services/whatsapp/tenant-resolver';
import { AutoReplySettings, normalizeAutoReplySettings } from '@/types/auto-reply';
import { generateId } from '@/lib/utils';
import { decideAutoReply, validateAutoReplySettings } from '@/services/auto-reply-policy';
import { Channel } from '@/types/chat';

interface AutoReplyContact {
  id: string;
  phone: string;
}

interface AutoReplyConversation {
  id: string;
}

export class AutoReplyService {
  static async listChannelSettings(
    organizationId: string,
    userId: string,
    isAdmin: boolean
  ) {
    const [channels, allSettings] = await Promise.all([
      AutoReplyRepository.findAccessibleChannels(organizationId, userId, isAdmin),
      AutoReplyRepository.findAllSettings(organizationId),
    ]);

    return channels.map((channel) => ({
      ...channel,
      autoReply: normalizeAutoReplySettings(
        allSettings.find((settings) => settings.channelId === channel.id)
      ),
    }));
  }

  static async saveChannelSettings(
    organizationId: string,
    channelId: string,
    userId: string,
    isAdmin: boolean,
    input: Partial<AutoReplySettings>
  ) {
    const access = await AutoReplyRepository.canAccessChannel(
      organizationId,
      channelId,
      userId,
      isAdmin
    );
    if (!access.exists) return { status: 404 as const, error: 'Canal não encontrado' };
    if (!access.allowed) return { status: 403 as const, error: 'Acesso negado ao canal' };

    const validation = validateAutoReplySettings(input);
    if (validation.errors.length > 0) {
      return { status: 400 as const, error: validation.errors[0], details: validation.errors };
    }

    const data = await AutoReplyRepository.upsertSettings(
      organizationId,
      channelId,
      userId,
      validation.settings
    );
    return { status: 200 as const, data: normalizeAutoReplySettings(data) };
  }

  static async handleIncomingMessage(
    channel: TenantChannel,
    contact: AutoReplyContact,
    conversation: AutoReplyConversation
  ) {
    const organizationId = channel.organizationId;
    const channelId = channel.id;

    try {
      console.log(`[AUTO-REPLY] Verificando config org=${organizationId} channel=${channelId}`);
      const rawSettings = await AutoReplyRepository.findSettings(organizationId, channelId);
      const decision = decideAutoReply(rawSettings);
      if (!decision.message) {
        console.log(`[AUTO-REPLY] Desativado/sem mensagem org=${organizationId} channel=${channelId}`);
        return;
      }

      const settings = normalizeAutoReplySettings(rawSettings);
      const lastReply = await AutoReplyRepository.findLastReply(
        organizationId,
        contact.id,
        channelId
      );
      // Mantém a semântica legada: valor ausente ou zero usa o padrão de 24 horas.
      const cooldownMs = (settings.cooldownHours || 24) * 60 * 60 * 1000;
      const now = new Date();

      if (lastReply) {
        const elapsed = now.getTime() - new Date(lastReply.lastAutoReplyAt).getTime();
        if (elapsed < cooldownMs) {
          const remainingMinutes = Math.round((cooldownMs - elapsed) / 60_000);
          console.log(
            `[AUTO-REPLY] Cooldown ativo contact=${contact.id} org=${organizationId} restam=${remainingMinutes}min`
          );
          return;
        }
      }

      console.log(
        `[AUTO-REPLY] Enviando tipo=${decision.reason} org=${organizationId} channel=${channel.name}(${channelId}) -> ${contact.phone}`
      );

      const { getWhatsAppProvider, resolveWhatsAppProviderType } = await import(
        '@/services/whatsapp/providers'
      );
      const provider = getWhatsAppProvider(resolveWhatsAppProviderType(channel));
      await provider.sendTextMessage(channel as unknown as Channel, contact.phone, decision.message);

      const autoMessage = await AutoReplyRepository.createSystemMessage({
        id: generateId(),
        organizationId,
        conversationId: conversation.id,
        channelId,
        senderType: 'SYSTEM',
        content: decision.message,
        type: 'TEXT',
        sendStatus: 'sent',
        metadata: { isAutoReply: true, autoReplyReason: decision.reason },
        createdAt: now.toISOString(),
      });

      await AutoReplyRepository.recordReply(organizationId, contact.id, channelId, now);
      await ConversationRepository.updateFields(conversation.id, organizationId, {
        lastMessageAt: now.toISOString(),
        lastMessagePreview: decision.message.substring(0, 100),
      });
      await RealtimeService.notifyNewMessage(conversation.id, autoMessage);

      console.log(
        `[AUTO-REPLY] Sucesso msg=${autoMessage.id} tipo=${decision.reason} org=${organizationId} channel=${channelId}`
      );
    } catch (error) {
      console.error(
        `[AUTO-REPLY] Erro crítico (org=${organizationId} channel=${channelId}):`,
        error
      );
    }
  }
}
