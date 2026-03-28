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
      // console.log(`[EVO_DEBUG] Response Body:`, responseText);

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
          ...data.webhook,
          webhookByEvents: data.webhook.webhookByEvents ?? true,
          webhookBase64: data.webhook.webhookBase64 ?? true
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

  // --- Chat Advanced ---

  async deleteMessage(instanceName: string, payload: { number: string; id: string; fromMe: boolean }) {
    return this.request<any>(`/chat/deleteMessage/${instanceName}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async sendPresence(instanceName: string, payload: { number: string; presence: 'composing' | 'paused' }) {
    return this.request<any>(`/chat/presence/${instanceName}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
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
        ...data,
        webhookByEvents: data.webhookByEvents ?? true,
        webhookBase64: data.webhookBase64 ?? true
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
