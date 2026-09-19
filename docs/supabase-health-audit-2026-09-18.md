# Investigação de saúde e desempenho do Supabase

Projeto: `jakihsmncajylbdgafvr` — motiva-talk. Data: 18/09/2026.

## Evidências da indisponibilidade

- O painel marcou PostgREST, Auth e Storage como Unhealthy, apesar de a API de gerenciamento inicialmente retornar ACTIVE_HEALTHY.
- O Advisor mostrou `Connection failed at the TCP layer (CONNECT_TIMEOUT) after 5019ms`.
- Logs do API Gateway mostraram 31 respostas 5xx entre 36 requisições na janela de uma hora inspecionada: 504/522 em login, refresh de sessão e leitura de Channel. Também houve 522 em uma rota administrativa do próprio Supabase.
- Health checks internos do Storage alternaram entre 200 e requisições abortadas.
- Uma consulta SQL respondeu às 22:02:29 UTC: banco com 182 MB e início do Postgres em 17/09 às 23:01:06 UTC. Outra amostra apresentou seis conexões cliente (uma ativa e cinco ociosas); consultas posteriores falharam por timeout. A amostra não prova ausência de picos anteriores.
- O painel exibiu CPU 36%, RAM 64% e disco 6% em uma instância Nano. Isso não basta para diagnosticar créditos de CPU, I/O ou memória em momentos anteriores.
- A configuração local aponta para o projeto correto.

Conclusão: falha real e intermitente de acesso aos serviços. As evidências disponíveis não comprovam que uma consulta ou rotina do aplicativo causou a indisponibilidade.

## Pontos de otimização encontrados no código

### 1. Canais Realtime no servidor sem limpeza em falhas

`src/services/realtime.service.ts:13`: cada publicação se inscreve em um canal WebSocket. `subscribe()` retorna o canal, portanto o `await` não aguarda a conexão nem o envio. A remoção só ocorre em SUBSCRIBED, após envio bem-sucedido. Erros de conexão/envio podem deixar canais registrados e tentativas de reconexão; o catch externo não captura a rejeição do callback assíncrono.

Melhoria: publicar via REST Broadcast com timeout e tratamento de falhas, sem assinatura WebSocket no servidor. Preservar tópicos/eventos e não propagar falha de notificação como falha da gravação da mensagem. A documentação atual oferece `httpSend`; confirmar compatibilidade com a versão travada no lockfile antes de adotar.

Impacto: tráfego e recursos de Realtime/aplicação. Não é evidência direta de esgotamento de conexões Postgres.

### 2. Listar templates provoca gravações mesmo sem alteração

`src/services/whatsapp-templates.ts:223`: toda listagem consulta a Meta e atualiza cada template encontrado, inclusive quando status e motivo de rejeição não mudaram. `lastSyncedAt` sempre muda. As gravações usam Promise.all sem limite e retornam dados com join.

`src/components/chat/MessageTemplateMenu.tsx:466`: enquanto o menu está montado, essa listagem se repete a cada 60 segundos, por usuário. Pode haver sobreposição se uma execução demorar mais que o intervalo.

Melhoria: coalescer sincronizações por organização/canal, evitar atualização de linhas sem mudança relevante, limitar concorrência e impedir polling sobreposto. Manter informação de última sincronização em nível adequado e preservar atualização de status por webhook. A carga cresce aproximadamente com usuários simultâneos × templates por consulta.

### 3. Contagens repetidas e consultas de perfil amplas

`src/components/layout/InboxSidebar.tsx:347`: troca de aba refaz as contagens, mesmo sem mudança dos filtros.

`src/repositories/conversationRepository.ts:328`: o caminho materializado é ignorado para agentes. `countByStatus` executa três contagens exatas em paralelo, além das consultas auxiliares.

`src/app/api/conversations/counts/route.ts:26` usa `UserRepository.findMany`, que carrega usuário, canais e todos os campos de cada canal, embora ali só seja necessário o ID; depois consulta novamente permissões de canais e setores.

Melhoria: separar atualização dos contadores da troca de aba, deduplicar requisições e usar consulta enxuta de perfil. Só consolidar contagens em RPC após preservar integralmente as regras de acesso e validar planos de execução.

### 4. Relatórios filtram e agregam dados na aplicação

`src/repositories/reportsRepository.ts:24`: carrega ConversationFunnel com vários joins e aplica parte dos filtros/agregações em JavaScript. A limitação a 50 leads ocorre apenas ao final, sem reduzir o trabalho de banco/transferência. O limite padrão da Data API também pode truncar o conjunto usado nos totais.

Melhoria: agregação e filtragem no banco, paginação dos detalhes e projeção explícita das colunas necessárias. Não basta acrescentar LIMIT à consulta, pois isso alteraria os totais.

### 5. Limites e fallbacks

`src/app/api/conversations/route.ts:29`: o limite recebido do cliente é convertido com parseInt, mas não tem faixa validada na aplicação.

`src/repositories/conversationRepository.ts:54` e `:202`: o histórico recorre a uma lista de IDs para filtros não suportados pela RPC; pode crescer e atingir o limite de linhas da API. Busca por nome/telefone também usa ILIKE com curinga inicial e transfere IDs intermediários.

Melhoria: validar limites, mover filtros de histórico para SQL e confirmar índices/planos antes de criar índices novos. Esses são riscos de crescimento, não causa demonstrada do incidente.

## Otimizações já presentes

- Cliente administrativo Supabase compartilhado por módulo, sem persistência/renovação de sessão.
- Paginação por cursor e projeção reduzida nas listagens principais.
- Debounce de busca de 500 ms.
- Assinaturas do inbox filtradas por canal/setor/conversa, com remoção ao desmontar.
- Verificação local de JWT/JWKS com fallback de rede.
- Migração local de retenção de cron.job_run_details por 30 dias e otimização de auth.jwt() em políticas de WhatsAppTemplate. A existência dos arquivos não confirma sua aplicação no banco remoto.
- Não foi encontrado uso de conexões diretas via pg no código de execução em src; o acesso ocorre pelo cliente Supabase/Data API.

## Resultados após o reinício

- Reinício confirmado por `pg_postmaster_start_time()`: **18/09/2026 22:12:26 UTC (19:12:26 em São Paulo)**. O painel voltou a **Healthy**.
- Auth `/auth/v1/health`, Data API `/rest/v1/Channel?select=id&limit=1` e Storage `/storage/v1/status` responderam HTTP 200. Auth e REST levaram aproximadamente 3,7 s e 2,5 s na amostra de recuperação; isso confirma disponibilidade, não desempenho sustentado.
- Primeira amostra do banco: **5 conexões cliente / max_connections 60**, nenhuma espera por lock. Uma transação ociosa apareceu inicialmente e já não constava na amostra seguinte. O painel depois mostrou 22/60 conexões, CPU 59%, RAM 53% e disco 6%.
- `cron.job` tem duas tarefas ativas: processamento de mensagens a cada minuto e limpeza do histórico às 03:17 UTC. A limpeza executou com sucesso em 18/09, em 5,283 s.
- O histórico do cron ocupa **87 MB (82 MB de heap)**, com 43.797 execuções bem-sucedidas e 509 falhas na janela retida. Dessas falhas, 508 dizem `job startup timeout`; 94 falhas ocorreram no dia UTC da investigação. Não são 508 mensagens que falharam: o cron enfileira uma chamada HTTP, e seu sucesso não comprova a entrega das mensagens.
- A média das execuções bem-sucedidas do cron foi de 0,06 s. A retenção de aproximadamente 30 dias está funcionando. O espaço ocupado, isoladamente, não demonstra sobrecarga nem justifica VACUUM FULL em produção.
- Na amostra de pg_stat_statements após a subida, uma consulta administrativa a extensões levou **47,9 s**, e consultas de descoberta de esquema levaram aproximadamente 4,5 s em média. Já a leitura de mensagens agendadas teve **3,94 ms em média / 7,84 ms máximo (2 chamadas)**; a leitura mínima de Channel levou **3,48 ms (1 chamada)**. A amostra é pequena e dominada pela inicialização; não reconstrói a carga anterior ao reinício.
- Há índices de paginação de Conversation, mensagens por conversa/data, histórico de setores e mensagens agendadas. Channel não possui índice de metaPhoneNumberId, mas tem apenas **5 linhas**; portanto não é uma explicação plausível, sozinha, para timeouts de dezenas de segundos. Há **16 templates** no banco.
- Não havia slots de replicação na amostra inicial após a subida. Isso não mede retenção de WAL antes da falha.

Conclusão atual: a recuperação foi validada. Há desperdícios concretos no aplicativo, mas não foi demonstrado nexo causal com a queda. Os timeouts administrativos e de inicialização justificam investigar recursos/infraestrutura do Supabase se o problema voltar.

## Validações restantes sob carga normal

Coletar uma janela representativa de pg_stat_statements, validar planos das consultas do inbox/relatórios e observar concorrência durante o uso normal. Os contadores de tabelas estavam zerados na primeira amostra da subida e não servem para inferir ausência de leituras sequenciais ou linhas mortas antes da falha. Não executar carga de estresse em produção durante recuperação.

Verificar também a linha do tempo de CPU, créditos de CPU, memória e I/O. O painel de Observability foi consultado, mas CPU/rede não tinham dados e IOPS/throughput/conexões não carregaram; a memória mostrava apenas a amostra das 19:15. Não foi possível recuperar uma série histórica suficiente para confirmar saturação. Estatísticas após reinício podem não conservar toda a evidência do incidente.

## Ações realizadas

- Reinício solicitado a pedido do usuário e concluído; recuperação validada no painel, no banco e por requisições HTTP.
- Revisão estática do aplicativo e consultas diagnósticas somente de leitura.
- Nenhuma alteração de comportamento do aplicativo, esquema, políticas, dados ou plano de cobrança.

## Monitor local para investigações futuras

O comando `npm run health:check` testa Auth, Data API/banco e Storage em paralelo, com timeout de 8 segundos. Cada execução adiciona uma linha JSON em `logs/supabase-health/AAAA-MM-DD.jsonl`. Os arquivos ficam fora do Git, não contêm chaves nem dados retornados pelas APIs e são mantidos por 14 dias.

Classificação de cada amostra:

- `healthy`: todos os componentes responderam em menos de 3 segundos;
- `degraded`: todos responderam, mas algum levou 3 segundos ou mais;
- `unhealthy`: timeout ou resposta não-2xx;
- `configuration_error` / `monitor_error`: o próprio monitor não conseguiu executar corretamente.

Esse registro é externo ao banco. Portanto, continua registrando timeouts mesmo quando o Supabase não consegue executar o próprio pg_cron, desde que o computador e a automação local estejam em execução.

Também foi ativada a tarefa recorrente do Codex `Saúde Supabase motiva-talk`, a cada 2 minutos, neste task. Ela executa o monitor, lê o histórico e só envia aviso quando detecta transição para falha/degradação, persistência relevante ou recuperação. Para manter as coletas, o aplicativo do Codex precisa permanecer aberto e o computador ligado; essa é uma limitação das tarefas locais agendadas.

## Referências

- [Supabase: serviços Unhealthy](https://supabase.com/docs/guides/troubleshooting/project-status-reports-unhealthy-services)
- [Supabase: Broadcast via REST](https://supabase.com/docs/guides/realtime/broadcast)
- [Logs do projeto](https://supabase.com/dashboard/project/jakihsmncajylbdgafvr/logs)
