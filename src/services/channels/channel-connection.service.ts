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

    // 1. Apagar sessão externa na Evolution API
    try {
      await evolutionProvider.deleteSession(channel as any);
      console.log(`[SERVICE] Instância externa removida da Evolution API com sucesso.`);
    } catch (e: any) {
      console.warn(`[SERVICE] Falha ao remover instância: ${e.message} (Isso será ignorado no fluxo local)`);
    }

    // 2. Limpeza local: Descobrir e remover arquivos vinculados ao canal no Storage
    try {
      console.log(`[SERVICE] Descobrindo arquivos relacionados ao canal ${channelId} no Storage...`);
      const bucket = 'chat-media';
      const pathsToRemoval: string[] = [];

      const { data: mediaMessages, error: mediaError } = await supabaseAdmin
        .from('Message')
        .select('mediaUrl, thumbnailUrl')
        .eq('channelId', channelId);

      if (mediaError) {
        console.error(`[SERVICE] Falha ao buscar mediaUrl/thumbnailUrl das mensagens:`, mediaError);
      } else if (mediaMessages && mediaMessages.length > 0) {
        mediaMessages.forEach((m: any) => {
          [m.mediaUrl, m.thumbnailUrl].forEach(url => {
            if (url && typeof url === 'string' && url.includes(bucket)) {
              let path = url;
              if (url.includes(`${bucket}/`)) {
                path = url.split(`${bucket}/`).pop() || url;
              }
              if (!pathsToRemoval.includes(path)) {
                pathsToRemoval.push(path);
              }
            }
          });
        });
      }

      console.log(`[SERVICE] Quantidade de arquivos encontrados no banco para o canal ${channelId}: ${pathsToRemoval.length}`);

      if (pathsToRemoval.length > 0) {
        // Batching the removal in chunks of 50 paths at a time
        const CHUNK_SIZE = 50;
        let successCount = 0;
        const allFailed: string[] = [];

        for (let i = 0; i < pathsToRemoval.length; i += CHUNK_SIZE) {
          const chunk = pathsToRemoval.slice(i, i + CHUNK_SIZE);
          const { data, error } = await supabaseAdmin.storage.from(bucket).remove(chunk);

          if (error) {
            console.error(`[SERVICE] Erro ao remover lote do storage:`, error.message);
            // Salvar para log as que caíram em falha
            chunk.forEach(p => allFailed.push(p));
          } else if (data) {
            successCount += data.length;
            // Registrar arquivos que não vieram como sucesso
            const succeededNames = data.map((f: any) => f.name);
            const chunkFailures = chunk.filter(p => !succeededNames.includes(p));
            chunkFailures.forEach(f => allFailed.push(f));
          }
        }

        console.log(`[SERVICE] Relatório Storage: ${successCount} paths removidos com sucesso de ${pathsToRemoval.length}.`);
        if (allFailed.length > 0) {
            console.warn(`[SERVICE] Relatório Storage: ${allFailed.length} arquivos não puderam ser excluídos (podem já ter sido apagados ou apresentar erro). Exemplos:`, allFailed.slice(0, 5));
        }
      } else {
        console.log(`[SERVICE] Nenhum arquivo para deletar do Storage neste canal.`);
      }

    } catch (storageException: any) {
       console.error(`[SERVICE] Erro crítico isolado na limpeza de storage:`, storageException.message);
       // Continuar para apagar os registros de BD mesmo se houver erro extremo
    }

    // 3. Exclusão dos registros no banco (Cascata Manual)
    console.log(`[SERVICE] Iniciando limpeza das tabelas relacionais do canal ${channelId}`);
    
    // a. Buscar metadados de Conversas e Contatos vinculados
    const { data: conversations } = await supabaseAdmin
      .from('Conversation')
      .select('id, contactId')
      .eq('channelId', channelId);

    const conversationIds = conversations?.map(c => c.id) || [];
    // Filtrar contactIds nulos e remover duplicatas
    const contactIds = Array.from(new Set(conversations?.map(c => c.contactId).filter(Boolean)));

    console.log(`[SERVICE] Metadados Coletados: ${conversationIds.length} conversas, ${contactIds.length} contatos únicos.`);

    // b. Excluir relações auxiliares das Conversas em Lotes
    if (conversationIds.length > 0) {
      console.log(`[SERVICE] Excluindo relações de conversas (Notas, Tags, Funil, Feedback)...`);
      const BATCH_SIZE = 500;
      for (let i = 0; i < conversationIds.length; i += BATCH_SIZE) {
        const batch = conversationIds.slice(i, i + BATCH_SIZE);
        await supabaseAdmin.from('InternalNote').delete().in('conversationId', batch);
        await supabaseAdmin.from('ConversationTag').delete().in('conversationId', batch);
        await supabaseAdmin.from('ConversationFunnel').delete().in('conversationId', batch);
        await supabaseAdmin.from('Feedback').delete().in('conversationId', batch);
      }
    }

    // c. Excluir Mensagens e as próprias Conversas do canal
    console.log(`[SERVICE] Excluindo Mensagens e Conversas...`);
    await supabaseAdmin.from('Message').delete().eq('channelId', channelId);
    await supabaseAdmin.from('Conversation').delete().eq('channelId', channelId);

    // d. Excluir Links Globais e Auxiliares do Canal (Permissões de User, IA, Quick Reply)
    console.log(`[SERVICE] Excluindo vínculos de Usuários, Respostas Rápidas e Sugestões vinculadas ao Canal...`);
    await supabaseAdmin.from('UserChannel').delete().eq('channelId', channelId);
    await supabaseAdmin.from('KeywordSuggestion').delete().eq('channelId', channelId);
    await supabaseAdmin.from('QuickReply').delete().eq('channelId', channelId);

    // e. Validação Fina de Contatos Órfãos (Regra: Excluir se for unicamente deste canal)
    console.log(`[SERVICE] Verificando ${contactIds.length} contatos para possível exclusão...`);
    let deletedContacts = 0;
    let preservedContacts = 0;

    if (contactIds.length > 0) {
      for (const contactId of contactIds as string[]) {
        const { count, error } = await supabaseAdmin
          .from('Conversation')
          .select('id', { count: 'exact', head: true })
          .eq('contactId', contactId);
        
        // Após deletarmos as conversas deste canal: se o count é 0, significa exclusividade prévia. Se há outras conversas, ele atende a outros canais.
        if (!error && count === 0) {
          await supabaseAdmin.from('Contact').delete().eq('id', contactId);
          deletedContacts++;
        } else {
          preservedContacts++;
        }
      }
    }
    console.log(`[SERVICE] Resumo Contatos: Apagados (exclusivos) = ${deletedContacts} | Preservados (ativos noutros canais) = ${preservedContacts}`);

    // 4. Exclusão do Canal Principal (Ponto de Não Retorno final)
    console.log(`[SERVICE] Excluindo registro principal do Canal...`);
    const { error: deleteError } = await supabaseAdmin.from('Channel').delete().eq('id', channelId)
    
    if (deleteError) {
       console.error(`[SERVICE] Erro fatal ao apagar a instância "Channel" no banco de dados:`, deleteError);
       throw deleteError;
    }

    console.log(`[SERVICE] Dados do Canal e toda cascata local removidos com sucesso histórico.`);
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
