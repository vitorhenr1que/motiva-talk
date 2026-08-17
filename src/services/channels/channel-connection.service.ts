import { supabaseAdmin } from '@/lib/supabase-admin';

export class ChannelConnectionService {
  /**
   * Syncs status between Provider and DB.
   */
  static async getChannelStatus(channelId: string, organizationId: string) {
    const { data: channel, error: fetchError } = await supabaseAdmin
      .from('Channel')
      .select('*')
      .eq('id', channelId)
      .eq('organizationId', organizationId)
      .single()

    if (fetchError || !channel) throw new Error('Canal não encontrado');

    const hasCredentials = Boolean(
      (channel.metaPhoneNumberId || process.env.META_PHONE_NUMBER_ID)
      && (process.env.META_ACCESS_TOKEN || channel.metaAccessToken)
    );
    return {
      status: hasCredentials ? channel.connectionStatus || 'CONNECTED' : 'DISCONNECTED',
      details: 'Meta Cloud API',
    };
  }

  /**
   * Disconnects the session.
   */
  static async disconnectChannel(channelId: string, organizationId: string) {
    const { data: channel, error: fetchError } = await supabaseAdmin
      .from('Channel')
      .select('*')
      .eq('id', channelId)
      .eq('organizationId', organizationId)
      .single()

    if (fetchError || !channel) throw new Error('Canal não encontrado');

    try {
      await supabaseAdmin
        .from('Channel')
        .update({ connectionStatus: 'DISCONNECTED' })
        .eq('id', channelId)
        .eq('organizationId', organizationId)
      
      console.log(`[SERVICE] Canal ${channelId} desconectado.`);
    } catch (error: any) {
      console.error(`[SERVICE] Erro ao desconectar: ${error.message}`);
      throw error;
    }
  }

  /**
   * Full removal.
   */
  static async deleteChannel(channelId: string, organizationId: string) {
    console.log(`[SERVICE] Full Delete para: ${channelId}`);
    const { data: channel, error: fetchError } = await supabaseAdmin
      .from('Channel')
      .select('*')
      .eq('id', channelId)
      .eq('organizationId', organizationId)
      .single()

    if (fetchError || !channel) throw new Error('Canal não encontrado');

    // Limpeza local: descobrir e remover arquivos vinculados ao canal no Storage.
    try {
      console.log(`[SERVICE] Descobrindo arquivos relacionados ao canal ${channelId} no Storage...`);
      const bucket = 'chat-media';
      const pathsToRemoval: string[] = [];

      const { data: mediaMessages, error: mediaError } = await supabaseAdmin
        .from('Message')
        .select('mediaUrl, thumbnailUrl')
        .eq('channelId', channelId)
        .eq('organizationId', organizationId);

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
      .eq('channelId', channelId)
      .eq('organizationId', organizationId);

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
        await supabaseAdmin.from('InternalNote').delete().eq('organizationId', organizationId).in('conversationId', batch);
        await supabaseAdmin.from('ConversationTag').delete().eq('organizationId', organizationId).in('conversationId', batch);
        await supabaseAdmin.from('ConversationFunnel').delete().eq('organizationId', organizationId).in('conversationId', batch);
        await supabaseAdmin.from('Feedback').delete().eq('organizationId', organizationId).in('conversationId', batch);
      }
    }

    // c. Excluir Mensagens e as próprias Conversas do canal
    console.log(`[SERVICE] Excluindo Mensagens e Conversas...`);
    await supabaseAdmin.from('Message').delete().eq('channelId', channelId).eq('organizationId', organizationId);
    await supabaseAdmin.from('Conversation').delete().eq('channelId', channelId).eq('organizationId', organizationId);

    // d. Excluir Links Globais e Auxiliares do Canal (Permissões de User, IA, Quick Reply)
    console.log(`[SERVICE] Excluindo vínculos de Usuários, Respostas Rápidas e Sugestões vinculadas ao Canal...`);
    await supabaseAdmin.from('UserChannel').delete().eq('channelId', channelId).eq('organizationId', organizationId);
    await supabaseAdmin.from('KeywordSuggestion').delete().eq('channelId', channelId).eq('organizationId', organizationId);
    await supabaseAdmin.from('QuickReply').delete().eq('channelId', channelId).eq('organizationId', organizationId);

    // e. Validação Fina de Contatos Órfãos (Regra: Excluir se for unicamente deste canal)
    console.log(`[SERVICE] Verificando ${contactIds.length} contatos para possível exclusão...`);
    let deletedContacts = 0;
    let preservedContacts = 0;

    if (contactIds.length > 0) {
      for (const contactId of contactIds as string[]) {
        const { count, error } = await supabaseAdmin
          .from('Conversation')
          .select('id', { count: 'exact', head: true })
          .eq('contactId', contactId)
          .eq('organizationId', organizationId);
        
        // Após deletarmos as conversas deste canal: se o count é 0, significa exclusividade prévia. Se há outras conversas, ele atende a outros canais.
        if (!error && count === 0) {
          await supabaseAdmin.from('Contact').delete().eq('id', contactId).eq('organizationId', organizationId);
          deletedContacts++;
        } else {
          preservedContacts++;
        }
      }
    }
    console.log(`[SERVICE] Resumo Contatos: Apagados (exclusivos) = ${deletedContacts} | Preservados (ativos noutros canais) = ${preservedContacts}`);

    // 4. Exclusão do Canal Principal (Ponto de Não Retorno final)
    console.log(`[SERVICE] Excluindo registro principal do Canal...`);
    const { error: deleteError } = await supabaseAdmin.from('Channel').delete().eq('id', channelId).eq('organizationId', organizationId)
    
    if (deleteError) {
       console.error(`[SERVICE] Erro fatal ao apagar a instância "Channel" no banco de dados:`, deleteError);
       throw deleteError;
    }

    console.log(`[SERVICE] Dados do Canal e toda cascata local removidos com sucesso histórico.`);
    return { success: true };
  }

}
