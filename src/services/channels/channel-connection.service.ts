import { supabaseAdmin } from '@/lib/supabase-admin';
import { evolutionProvider } from '@/services/whatsapp/evolution-provider';
import { evolutionApi } from '@/lib/evolution-api-client';
import { Channel } from '@/types/chat';

export class ChannelConnectionService {
  /**
   * High-level orchestration for connecting a channel.
   * Logic: Only creates instance if providerSessionId is missing.
   */
  static async connectChannel(channelId: string) {
    console.log(`[SERVICE] connectChannel iniciado para canal ID: ${channelId}`);
    
    const { data: channel, error: fetchError } = await supabaseAdmin
      .from('Channel')
      .select('*')
      .eq('id', channelId)
      .single()

    if (fetchError || !channel) {
      throw new Error(`Canal ${channelId} não encontrado`);
    }

    const instanceName = evolutionProvider.getInstanceName(channel as any);

    try {
      // REGRA 1 & 2: Criar instância apenas se não houver providerSessionId no banco
      if (!channel.providerSessionId) {
        console.log(`[SERVICE] [REGRA 1] Primeira conexão detectada. Criando instância na Evolution API...`);
        await evolutionProvider.createSession(channel as any);
        
        // Salvar o providerSessionId gerado
        await supabaseAdmin
          .from('Channel')
          .update({ providerSessionId: instanceName })
          .eq('id', channelId)
        
        channel.providerSessionId = instanceName;
      } else {
        console.log(`[SERVICE] [REGRA 2] Reconexão detectada. Reutilizando instância: ${channel.providerSessionId}`);
        // Apenas para garantir que os webhooks estejam configurados na instância já existente
        await evolutionProvider.createSession(channel as any);
      }

      // 3. Sincronizar status inicial
      console.log(`[SERVICE] Sincronizando status de conexão inicial...`);
      const statusResult = await evolutionProvider.getSessionStatus(channel as any);
      
      const { data: updatedChannel, error: updateError } = await supabaseAdmin
        .from('Channel')
        .update({
          connectionStatus: statusResult.status,
          isActive: true
        })
        .eq('id', channelId)
        .select()
        .single()

      if (updateError) throw updateError

      console.log(`[SERVICE] Fluxo de conexão do canal finalizado com sucesso. Status: ${statusResult.status}`);
      return updatedChannel;
    } catch (error: any) {
      console.error(`[SERVICE] Falha em connectChannel: ${error.message}`);
      throw error;
    }
  }

  /**
   * Fetches the QR code.
   */
  static async getChannelQrCode(channelId: string) {
    const { data: channel, error: fetchError } = await supabaseAdmin
      .from('Channel')
      .select('*')
      .eq('id', channelId)
      .single()

    if (fetchError || !channel) throw new Error('Canal não encontrado');

    console.log(`[SERVICE] getChannelQrCode para ${channelId}. Status atual: ${channel.connectionStatus}`);

    try {
      // REGRA 3: Se o canal estiver CONNECTED e pedirmos QR Code, desconectar primeiro
      if (channel.connectionStatus === 'CONNECTED') {
        console.log(`[SERVICE] [REGRA 3] Canal está CONECTADO. Desconectando para gerar novo QR Code...`);
        await evolutionProvider.disconnectSession(channel as any);
        await supabaseAdmin
          .from('Channel')
          .update({ connectionStatus: 'DISCONNECTED' })
          .eq('id', channelId)
      }

      // Se não tiver providerSessionId, cria agora (Primeira conexão através do modal de QR Code)
      if (!channel.providerSessionId) {
        console.log(`[SERVICE] Criando sessão inicial para obter QR Code...`);
        await evolutionProvider.createSession(channel as any);
        const providerSessionId = evolutionProvider.getInstanceName(channel as any);
        await supabaseAdmin
          .from('Channel')
          .update({ providerSessionId })
          .eq('id', channelId)
      } else {
        console.log(`[SERVICE] Usando instância existente para QR Code: ${channel.providerSessionId}`);
      }

      const qrData = await evolutionProvider.getQrCode(channel as any);
      console.log(`[SERVICE] QR Code obtido.`);
      return qrData;
    } catch (error: any) {
      console.error(`[SERVICE] Falha ao obter QR Code: ${error.message}`);
      throw error;
    }
  }

  /**
   * Syncs status between Provider and DB.
   */
  static async getChannelStatus(channelId: string) {
    const { data: channel, error: fetchError } = await supabaseAdmin
      .from('Channel')
      .select('*')
      .eq('id', channelId)
      .single()

    if (fetchError || !channel) throw new Error('Canal não encontrado');

    try {
      const statusResult = await evolutionProvider.getSessionStatus(channel as any);

      if (channel.connectionStatus !== statusResult.status) {
        console.log(`[SERVICE] Mudança de status detectada: ${channel.connectionStatus} -> ${statusResult.status}`);
        await supabaseAdmin
          .from('Channel')
          .update({ connectionStatus: statusResult.status })
          .eq('id', channelId)
      }

      return statusResult;
    } catch (error: any) {
      console.warn(`[SERVICE] Falha ao sincronizar status: ${error.message}`);
      return { status: 'DISCONNECTED', details: error.message };
    }
  }

  /**
   * Disconnects the session.
   */
  static async disconnectChannel(channelId: string) {
    const { data: channel, error: fetchError } = await supabaseAdmin
      .from('Channel')
      .select('*')
      .eq('id', channelId)
      .single()

    if (fetchError || !channel) throw new Error('Canal não encontrado');

    try {
      await evolutionProvider.disconnectSession(channel as any);
      
      await supabaseAdmin
        .from('Channel')
        .update({ connectionStatus: 'DISCONNECTED' })
        .eq('id', channelId)
      
      console.log(`[SERVICE] Canal ${channelId} desconectado.`);
    } catch (error: any) {
      console.error(`[SERVICE] Erro ao desconectar: ${error.message}`);
      throw error;
    }
  }

  /**
   * Resets the channel by deleting the instance and creating a new one.
   */
  static async resetChannel(channelId: string) {
    console.log(`[SERVICE] Iniciando RESET de canal: ${channelId}`);
    
    const { data: channel, error: fetchError } = await supabaseAdmin
      .from('Channel')
      .select('*')
      .eq('id', channelId)
      .single()

    if (fetchError || !channel) throw new Error('Canal não encontrado');

    try {
      console.log(`[SERVICE] [RESET] 1. Removendo instância externa...`);
      try {
        await evolutionProvider.deleteSession(channel as any);
      } catch (e: any) {
        console.warn(`[SERVICE] [RESET] Aviso: Instância externa não pôde ser removida: ${e.message}`);
      }

      console.log(`[SERVICE] [RESET] 2. Limpando dados locais...`);
      await supabaseAdmin
        .from('Channel')
        .update({ 
          providerSessionId: null,
          connectionStatus: 'PENDING'
        })
        .eq('id', channelId)

      console.log(`[SERVICE] [RESET] 3. Recriando instância base...`);
      const updatedChannel = await this.connectChannel(channelId);

      return updatedChannel;
    } catch (error: any) {
      console.error(`[SERVICE] [RESET] Falha crítica no reset: ${error.message}`);
      throw error;
    }
  }

  /**
   * Full removal.
   */
  static async deleteChannel(channelId: string) {
    console.log(`[SERVICE] Full Delete para: ${channelId}`);
    const { data: channel, error: fetchError } = await supabaseAdmin
      .from('Channel')
      .select('*')
      .eq('id', channelId)
      .single()

    if (fetchError || !channel) throw new Error('Canal não encontrado');

    try {
      await evolutionProvider.deleteSession(channel as any);
    } catch (e: any) {
      console.warn(`[SERVICE] Falha ao remover instância: ${e.message}`);
    }

    await supabaseAdmin.from('Channel').delete().eq('id', channelId)
    console.log(`[SERVICE] Canal removido do banco.`);
    return { success: true };
  }

  /**
   * Obter configuração de webhook diretamente da Evolution API
   */
  static async getWebhookConfig(channelId: string) {
    const { data: channel } = await supabaseAdmin
      .from('Channel')
      .select('*')
      .eq('id', channelId)
      .single()

    if (!channel) throw new Error('Canal não encontrado');
    
    const instanceName = evolutionProvider.getInstanceName(channel as any);
    try {
      return await evolutionApi.findWebhook(instanceName);
    } catch (e: any) {
      if (e.message === 'NOT_FOUND') {
        return { enabled: false, url: '', webhookByEvents: true, webhookBase64: true, events: [] };
      }
      throw e;
    }
  }

  /**
   * Atualizar configuração de webhook na Evolution API
   */
  static async setWebhookConfig(channelId: string, config: any) {
    const { data: channel } = await supabaseAdmin
      .from('Channel')
      .select('*')
      .eq('id', channelId)
      .single()

    if (!channel) throw new Error('Canal não encontrado');
    
    const instanceName = evolutionProvider.getInstanceName(channel as any);
    return await evolutionApi.setWebhook(instanceName, config);
  }
}
