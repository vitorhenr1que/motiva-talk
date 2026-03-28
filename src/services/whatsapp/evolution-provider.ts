import { Channel, MessageType } from '@/types/chat';
import { WhatsAppProvider, SessionStatus, QrCodeData, WebhookEvent } from './provider';
import { evolutionApi } from '@/lib/evolution-api-client';

export class EvolutionProvider implements WhatsAppProvider {
  /**
   * Translates Evolution API status to our internal SessionStatus
   */
  public mapStatus(evolutionStatus: string): SessionStatus['status'] {
    const raw = (evolutionStatus || '').toLowerCase();
    let internal: SessionStatus['status'] = 'PENDING';

    switch (raw) {
      case 'open':
      case 'connected':
        internal = 'CONNECTED';
        break;
      case 'connecting':
        internal = 'CONNECTING';
        break;
      case 'qrcode':
      case 'qr':
        internal = 'QR_CODE';
        break;
      case 'close':
      case 'disconnected':
      case 'unpaired':
        internal = 'DISCONNECTED';
        break;
      case 'refused':
      case 'error':
      case 'failed':
        internal = 'ERROR';
        break;
      default:
        internal = 'PENDING';
    }

    console.log(`[EVO_DEBUG] mapStatus: Ext[${raw}] -> Int[${internal}]`);
    return internal;
  }

  /**
   * Instance name is based on the channel ID for uniqueness and consistency.
   * Also ensures it follows valid naming conventions (alphanumeric).
   */
  public getInstanceName(channel: Channel): string {
    // Priority 1: Use the ID already persisted in DB
    if (channel.providerSessionId) return channel.providerSessionId;
    
    // Priority 2: Generate based on channel.id
    return `${channel.id.replace(/[^a-zA-Z0-9]/g, '')}`;
  }

  async createSession(channel: Channel): Promise<void> {
    const instanceName = this.getInstanceName(channel);
    console.log(`[EVO_PROVIDER] Chamando createSession para: ${instanceName}`);
    
    try {
      // 1. Criar instância (ou verificar se existe)
      let exists = false;
      try {
        await evolutionApi.getInstance(instanceName);
        console.log(`[EVO_PROVIDER] Instância ${instanceName} já existe na Evolution API.`);
        exists = true;
      } catch (e: any) {
        if (e.message !== 'NOT_FOUND') throw e;
      }

      if (!exists) {
        console.log(`[EVO_PROVIDER] Criando instância via API: ${instanceName}`);
        try {
          await evolutionApi.createInstance({
            instanceName,
            token: instanceName,
            webhook: {
              url: process.env.EVOLUTION_WEBHOOK_URL!,
              enabled: true,
              webhookBase64: true,
              webhookByEvents: true,
              events: [
                'QRCODE_UPDATED',
                'CONNECTION_UPDATE',
                'MESSAGES_UPSERT'
              ]
            }
          });
        } catch (e: any) {
          if (e.message?.toLowerCase().includes('already in use')) {
            console.log(`[EVO_PROVIDER] Conflito resolvido: A API relata que "${instanceName}" já existe. Prosseguindo...`);
          } else {
            throw e;
          }
        }
      }

      // 2. Configurar webhook (imediatamente após criação ou para garantir consistência)
      if (!process.env.EVOLUTION_WEBHOOK_URL) {
        throw new Error('EVOLUTION_WEBHOOK_URL não definida');
      }

      console.log(`[EVO_PROVIDER] Configurando webhook obrigatório para: ${instanceName}`);
      await evolutionApi.setWebhook(instanceName, {
        enabled: true,
        url: process.env.EVOLUTION_WEBHOOK_URL,
        webhookByEvents: true,
        webhookBase64: true,
        events: [
          'QRCODE_UPDATED',
          'CONNECTION_UPDATE',
          'MESSAGES_UPSERT'
        ]
      });

      // 3. Validar webhook automaticamente
      const webhook = await evolutionApi.findWebhook(instanceName);
      
      // 4. Logar resposta completa se necessário (facilitado pelo debug do client, mas aqui reforçamos)
      if (!webhook) {
        console.error(`[EVO_DEBUG] Webhook não encontrado para ${instanceName}`);
        throw new Error(`Falha crítica: Configuração de webhook não encontrada para ${instanceName}.`);
      }

      // 5. Validação rigorosa dos campos
      const expectedUrl = process.env.EVOLUTION_WEBHOOK_URL;
      const requiredEvents = ['QRCODE_UPDATED', 'CONNECTION_UPDATE', 'MESSAGES_UPSERT'];
      
      // Verificar enabled
      if (webhook.enabled !== true) {
        console.error('[EVO_DEBUG] Webhook inválido (desabilitado):', JSON.stringify(webhook, null, 2));
        throw new Error(`Falha crítica: Webhook para ${instanceName} está desabilitado (enabled=false).`);
      }

      // Verificar URL
      if (webhook.url !== expectedUrl) {
        console.error('[EVO_DEBUG] Webhook com URL incorreta:', { esperada: expectedUrl, recebida: webhook.url });
        throw new Error(`Falha crítica: URL do webhook incorreta para ${instanceName}.`);
      }

      // Verificar Eventos
      const currentEvents = Array.isArray(webhook.events) ? webhook.events : [];
      const missingEvents = requiredEvents.filter(event => !currentEvents.includes(event));
      
      if (missingEvents.length > 0) {
        console.error('[EVO_DEBUG] Webhook com eventos faltando:', missingEvents);
        throw new Error(`Falha crítica: Webhook de ${instanceName} não contém eventos obrigatórios: ${missingEvents.join(', ')}`);
      }

      console.log('[EVO_DEBUG] Webhook validado com sucesso');
      console.log(`[EVO_PROVIDER] Sessão e Webhook prontos para ${instanceName}`);
    } catch (error: any) {
      console.error(`[EVO_PROVIDER] Falha crítica em createSession (${instanceName}): ${error.message}`);
      throw error;
    }
  }

  async getQrCode(channel: Channel): Promise<QrCodeData> {
    const instanceName = this.getInstanceName(channel);
    console.log(`[EVO_PROVIDER] Chamando getQrCode para: ${instanceName}`);
    
    try {
      // Rule: getQrCode should NEVER create instance. 
      const data = await evolutionApi.getQrCode(instanceName);
      if (!data?.base64) {
        throw new Error('QR Code não retornado pela API. Verifique o status da instância.');
      }
      return {
        base64: data.base64,
        code: data.code || '',
      };
    } catch (error: any) {
      console.error(`[EVO_PROVIDER] Falha em getQrCode (${instanceName}): ${error.message}`);
      throw error;
    }
  }

  async getSessionStatus(channel: Channel): Promise<SessionStatus> {
    const instanceName = this.getInstanceName(channel);
    console.log(`[EVO_PROVIDER] getSessionStatus para: ${instanceName}`);
    
    try {
      const state: any = await evolutionApi.getConnectionState(instanceName);
      console.log(`[EVO_DEBUG] connectionState raw response:`, JSON.stringify(state));

      // Robust field resolution for Evolution v1/v2/v2.1
      const rawStatus = 
        state.status || 
        state.state || 
        state.instance?.status || 
        state.instance?.state || 
        state.connection || 
        'DISCONNECTED';
      
      const internalStatus = this.mapStatus(rawStatus);

      console.log(`[EVO_DEBUG] Status Resolvido: Instance[${instanceName}] Raw[${rawStatus}] Int[${internalStatus}]`);

      return {
        status: internalStatus,
      };
    } catch (e: any) {
      console.warn(`[EVO_PROVIDER] Falha em getSessionStatus (${instanceName}): ${e.message}`);
      return { 
        status: 'DISCONNECTED', 
        details: e.message || 'Instância não encontrada ou offline' 
      };
    }
  }

  async disconnectSession(channel: Channel): Promise<void> {
    const instanceName = this.getInstanceName(channel);
    console.log(`[EVO_PROVIDER] Chamando disconnectSession (Logout) para: ${instanceName}`);
    
    try {
      await evolutionApi.logoutInstance(instanceName);
    } catch (e: any) {
      console.error(`[EVO_PROVIDER] Falha em disconnectSession (${instanceName}): ${e.message}`);
    }
  }

  async deleteSession(channel: Channel): Promise<void> {
    const instanceName = this.getInstanceName(channel);
    console.log(`[EVO_PROVIDER] Chamando deleteSession (Permanent) para: ${instanceName}`);
    
    try {
      await evolutionApi.deleteInstance(instanceName);
    } catch (e: any) {
      console.error(`[EVO_PROVIDER] Falha em deleteSession (${instanceName}): ${e.message}`);
    }
  }

  async sendMessage(channel: Channel, recipient: string, content: string, type: MessageType = 'TEXT'): Promise<any> {
    const instanceName = this.getInstanceName(channel);
    
    // Ensure number is in correct format for Evolution API (digits only)
    const cleanNumber = recipient.replace(/\D/g, '');
    
    if (type !== 'TEXT') {
       throw new Error(`Tipo de mensagem ${type} ainda não implementado no EvolutionProvider.`);
    }

    return evolutionApi.sendMessage(instanceName, {
      number: cleanNumber,
      text: content
    });
  }

  /**
   * Parses various Evolution API events into our generic WebhookEvent format.
   * Handles both v1 and potentially v2 payload structures.
   */
  async parseIncomingWebhook(payload: any): Promise<WebhookEvent> {
    // Common Evolution v1 pattern: { event: "...", data: { ... }, instance: "..." }
    const eventType = payload.event || payload.type;
    const data = payload.data || payload; 
    const instanceName = payload.instance || payload.instanceName;
    
    // Use instance name directly as it is now just our channel ID 
    const channelId = instanceName || '';
    
    const base: WebhookEvent = {
      channelId: channelId,
      timestamp: Date.now(),
      type: 'STATUS',
      metadata: data
    };

    switch (eventType) {
      case 'MESSAGES_UPSERT':
      case 'messages.upsert': {
        const message = data.message || data.messages?.[0];
        if (!message) return base;

        const key = message.key || data.key;
        if (key?.fromMe) {
          // You could return an AGENT message type here if tracking outgoing is needed
        }

        return {
          ...base,
          type: 'MESSAGE',
          senderPhone: (key.remoteJid || key.participant || '').split('@')[0],
          senderName: data.pushName || 'Contato WhatsApp',
          content: message.conversation || 
                   message.extendedTextMessage?.text || 
                   message.message?.conversation || 
                   '',
          messageType: 'TEXT',
          metadata: { ...data, externalId: key.id }
        };
      }

      case 'CONNECTION_UPDATE':
      case 'connection.update': {
        const state = data.state || data.status || data.connection;
        return {
          ...base,
          type: 'CONNECTION',
          metadata: { status: this.mapStatus(state) }
        };
      }

      case 'QRCODE_UPDATED':
      case 'qrcode.updated': {
        return {
          ...base,
          type: 'STATUS',
          metadata: { qrcode: data.qrcode?.base64 || data.base64 }
        };
      }

      default:
        console.log(`Unhandled Evolution webhook event: ${eventType}`);
        return base;
    }
  }
  async setWebhook(channel: Channel, url: string, events: string[]): Promise<void> {
    const instanceName = this.getInstanceName(channel);
    console.log(`[EVO_PROVIDER] Configurando webhook para: ${instanceName} -> ${url}`);
    
    try {
      await evolutionApi.setWebhook(instanceName, {
        url: url,
        enabled: true,
        webhookByEvents: true,
        webhookBase64: true,
        events: events
      });
      console.log(`[EVO_PROVIDER] Webhook configurado com sucesso para ${instanceName}`);
    } catch (error: any) {
      console.error(`[EVO_PROVIDER] Erro ao configurar webhook para ${instanceName}: ${error.message}`);
      throw error;
    }
  }
}

export const evolutionProvider = new EvolutionProvider();
