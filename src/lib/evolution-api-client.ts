/**
 * Evolution API HTTP Client
 * Fixed version with correct endpoints and URL sanitization.
 */

const API_URL = process.env.EVOLUTION_API_URL;
const API_KEY = process.env.EVOLUTION_API_KEY;

export interface Instance {
  instanceName: string;
  instanceId?: string;
  status?: string;
  token?: string;
}

export interface QrCodeResponse {
  base64: string;
  code: string;
  instance: string;
}

export interface ConnectionState {
  status: 'open' | 'close' | 'connecting' | 'disconnecting' | 'qrcode' | 'refused';
  instance: string;
}

export interface SendMessagePayload {
  number: string;
  text: string;
  linkPreview?: boolean;
  quoted?: {
    key: { id: string; fromMe?: boolean };
    message: { [key: string]: any };
  };
}

class EvolutionApiClient {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    if (!API_URL || !API_KEY) {
      console.warn('EVOLUTION_API_URL or EVOLUTION_API_KEY is not defined in environment variables.');
    }
    // Remove trailing slash to avoid double slashes in requests
    this.baseUrl = (API_URL || '').replace(/\/$/, '');
    this.apiKey = API_KEY || '';
  }

  /**
   * Generic request method with standardized error handling and auth headers
   */
  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const url = `${this.baseUrl}${normalizedPath}`;
    
    const headers = {
      'Content-Type': 'application/json',
      'apikey': this.apiKey,
      ...options.headers,
    };

    console.log(`[EVO_DEBUG] Request: ${options.method || 'GET'} ${url}`);
    if (options.body) {
      console.log(`[EVO_DEBUG] Request Body:`, options.body);
    }

    try {
      const response = await fetch(url, { 
        ...options, 
        headers,
        cache: 'no-store' 
      });

      console.log(`[EVO_DEBUG] Response Status: ${response.status} ${response.statusText}`);

      const responseText = await response.text();
      console.log(`[EVO_DEBUG] Response Body:`, responseText);

      let responseData: any = {};
      try {
        responseData = JSON.parse(responseText);
      } catch (e) {
        responseData = { message: responseText || `HTTP Error ${response.status}` };
      }

      if (!response.ok) {
        if (response.status === 403) {
          console.error('[EVO_DEBUG] Error 403: Forbidden. Check API Key or Admin permissions.');
        } else if (response.status === 400) {
          console.error('[EVO_DEBUG] Error 400: Bad Request. Check payload structure.');
        }

        if (response.status === 404) {
          throw new Error('NOT_FOUND');
        }

        throw new Error(
          responseData.message || 
          responseData.error || 
          (typeof responseData === 'string' ? responseData : JSON.stringify(responseData)) ||
          `Evolution API error: ${response.status} ${response.statusText}`
        );
      }

      return (responseData.response !== undefined ? responseData.response : responseData) as T;
    } catch (error: any) {
      if (error.message !== 'NOT_FOUND') {
        console.error(`[EVO_DEBUG] Request failed (${path}):`, error.message);
      }
      throw error;
    }
  }

  // --- Instance Management ---

  async createInstance(data: { 
    instanceName: string; 
    token?: string; 
    number?: string;
    webhook?: {
      url: string;
      enabled: boolean;
      webhookByEvents?: boolean;
      webhookBase64?: boolean;
      events: string[];
    }
  }) {
    return this.request<any>('/instance/create', {
      method: 'POST',
      body: JSON.stringify({
        instanceName: data.instanceName,
        token: data.token || data.instanceName,
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS',
        webhook: data.webhook ? {
          url: data.webhook.url,
          enabled: data.webhook.enabled,
          webhook_by_events: data.webhook.webhookByEvents ?? true,
          webhook_by_base64: data.webhook.webhookBase64 ?? true,
          events: data.webhook.events
        } : undefined
      }),
    });
  }

  async getInstance(instanceName: string) {
    const instances = await this.request<any[]>('/instance/fetchInstances', {
      method: 'GET',
    });
    
    const instance = instances.find(i => 
      i.instanceName === instanceName || 
      i.name === instanceName || 
      i.instance?.instanceName === instanceName
    );
    
    if (!instance) {
      throw new Error('NOT_FOUND');
    }
    
    return instance as Instance;
  }

  async listInstances() {
    return this.request<any[]>('/instance/fetchInstances', {
      method: 'GET',
    });
  }

  async getQrCode(instanceName: string) {
    return this.request<QrCodeResponse>(`/instance/connect/${instanceName}`, {
      method: 'GET',
    });
  }

  async getConnectionState(instanceName: string) {
    return this.request<ConnectionState>(`/instance/connectionState/${instanceName}`, {
      method: 'GET',
    });
  }

  async deleteInstance(instanceName: string) {
    return this.request<any>(`/instance/delete/${instanceName}`, {
      method: 'DELETE',
    });
  }

  async logoutInstance(instanceName: string) {
    return this.request<any>(`/instance/logout/${instanceName}`, {
      method: 'DELETE',
    });
  }

  // --- Messaging ---

  async sendMessage(instanceName: string, payload: SendMessagePayload) {
    return this.request<any>(`/message/sendText/${instanceName}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async sendMedia(instanceName: string, payload: {
    number: string;
    mediatype: 'image' | 'video' | 'audio' | 'document';
    media: string;
    fileName?: string;
    caption?: string;
    ptt?: boolean;
    quoted?: any;
  }) {
    return this.request<any>(`/message/sendMedia/${instanceName}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async sendContact(instanceName: string, payload: {
    number: string;
    contact: {
      fullName: string;
      wuid: string;
      phoneNumber: string;
    }[];
    quoted?: any;
  }) {
    return this.request<any>(`/message/sendContact/${instanceName}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // --- Chat Advanced ---

  async fetchProfilePictureUrl(instanceName: string, number: string) {
    try {
      console.log(`[EVO_DEBUG] Buscando foto de perfil para ${number} na instância ${instanceName}...`);
      const response = await this.request<any>(`/chat/fetchProfilePictureUrl/${instanceName}`, {
        method: 'POST',
        body: JSON.stringify({ number }),
      });
      
      // A Evolution API pode retornar em diferentes formatos dependendo da versão
      return response.profilePictureUrl || response.url || response.response?.url || null;
    } catch (error: any) {
      console.error(`[EVO_DEBUG] Erro ao buscar foto de perfil:`, error.message);
      return null;
    }
  }

  async deleteMessage(instanceName: string, payload: { remoteJid: string; id: string; fromMe: boolean; participant?: string }) {
    return this.request<any>(`/chat/deleteMessageForEveryone/${instanceName}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  async sendPresence(instanceName: string, payload: { number: string; presence: 'composing' | 'paused' }) {
    return this.request<any>(`/chat/presence/${instanceName}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  /**
   * Decrypts a WhatsApp media message and returns its base64 data.
   * Essential when receiving encrypted media URLs from WhatsApp (mmg.whatsapp.net).
   */
  async getMediaBase64(instanceName: string, message: any) {
    try {
      console.log(`[EVO_DEBUG] Solicitando descriptografia de mídia para ${instanceName}...`);
      const response = await this.request<any>(`/chat/getBase64FromMediaMessage/${instanceName}`, {
        method: 'POST',
        body: JSON.stringify({ message }),
      });
      
      return response.base64 || response.response?.base64 || response;
    } catch (error: any) {
      console.error(`[EVO_DEBUG] Erro ao obter base64 da mídia:`, error.message);
      return null;
    }
  }

  // --- Webhooks ---
  
  async findWebhook(instanceName: string) {
    return this.request<any>(`/webhook/find/${instanceName}`, {
      method: 'GET',
    });
  }

  async setWebhook(instanceName: string, data: { 
    url: string; 
    enabled: boolean; 
    webhookByEvents?: boolean;
    webhookBase64?: boolean;
    webhookByStatus?: boolean;
    events: string[];
  }) {
    const payload = {
      webhook: {
        url: data.url,
        enabled: data.enabled,
        webhookByEvents: data.webhookByEvents ?? true,
        webhookBase64: data.webhookBase64 ?? true,
        webhookByStatus: data.webhookByStatus ?? false,
        
        // Fallback para versões com underscore (padrão principal)
        webhook_by_events: data.webhookByEvents ?? true,
        webhook_by_base64: data.webhookBase64 ?? true,
        webhook_by_status: data.webhookByStatus ?? false,

        // Variantes extras de compatibilidade profunda
        webhook_base64: data.webhookBase64 ?? true,
        base64: data.webhookBase64 ?? true,
        
        events: data.events
      }
    };
    
    return this.request<any>(`/webhook/set/${instanceName}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }
}

// Export singleton instance
export const evolutionApi = new EvolutionApiClient();
