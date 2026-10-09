# Plano de migração do motiva-talk para Supabase na VPS

Data: 07/10/2026. Status: planejamento; nenhuma instalação ou migração executada.

Objetivo: substituir o Supabase Cloud Nano pelo Supabase hospedado na VPS Contabo, preservando contas, permissões, conversas, mensagens, arquivos e atualizações em tempo real. A migração será condicionada à restauração validada e à capacidade do servidor sob carga.

## 1. Premissas e capacidade

Origem: projeto `jakihsmncajylbdgafvr`, Postgres 17. A indisponibilidade precisa ser resolvida o suficiente para obter uma cópia íntegra; o reinício da origem não foi autorizado nem executado nesta investigação.

Destino: VPS `173.249.23.182`, Ubuntu 24.04, 4 CPUs, 7,8 GiB de RAM utilizável e disco de 75 GB. Medição SSH: 3,4 GiB usados, 4,3 GiB disponíveis, 51 GB livres, CPU baixa e sem espera significativa por disco na amostra. Não há swap configurado. Essa medição curta não demonstra capacidade nos picos.

Serviços existentes: Formbricks, n8n editor/webhook/worker, Redis, Postgres 14, Postgres 16 com pgvector, Evolution API, MinIO, Portainer e Traefik. Os nomes dos containers indicam uso de Docker Swarm; confirmar topologia e redes antes da instalação. O Formbricks estava usando aproximadamente 909 MiB do limite de 1 GiB.

Decisão inicial: testar na VPS atual, com banco e volumes próprios. Não usar o Postgres 14/pgvector existente como banco do Supabase nem alterar seus volumes. Não mover também o frontend para essa VPS nesta etapa. Se a soma dos serviços não couber com folga, aumentar RAM ou separar o Supabase antes da troca.

## 2. Inventário e preparação

- Confirmar onde a aplicação está publicada, onde suas variáveis são configuradas e como restaurar a versão anterior.
- Definir subdomínio próprio para a API Supabase, acesso administrativo restrito ao Studio e controle do DNS. O domínio ainda precisa ser informado.
- Inventariar na origem: tabelas e volumes atuais, índices, views/RPCs, políticas RLS, grants, extensões, triggers, sequências, jobs pg_cron, pg_net/webhooks de banco, publicações Realtime, replica identity e eventual uso de Edge Functions.
- Medir tamanho e quantidade dos objetos em todos os buckets, especialmente `chat-media`. O tamanho atual do banco/Storage ainda não foi confirmado; não reutilizar como atual a medição de setembro.
- Levantar Auth: usuários, identidades, configuração de cadastro/convites, SMTP, redirects e provedores externos, se usados.
- Mapear todos os produtores de escrita: usuários, webhook Meta, agendamento de mensagens, disparos em massa, automações e integrações.
- Definir destino externo para backup, retenção e responsável operacional. MinIO no mesmo servidor não protege contra perda da VPS.
- Observar um período representativo de uso, idealmente 24–48 horas, e registrar memória disponível, CPU, I/O, rede e consumo dos containers. Não instalar coleta recorrente antes de confirmar a configuração existente.

Saída: inventário e estimativas de duração, armazenamento e capacidade. A janela de migração só será fixada após o ensaio.

## 3. Instalação isolada na VPS

- Usar a distribuição oficial de self-hosting com imagens fixadas por versão; confirmar Postgres 17 e compatibilidade de Auth/Storage no release escolhido.
- Manter Postgres, Auth, PostgREST, Realtime, Storage, gateway e dependências requeridas pelo Compose oficial. Manter Studio para administração com acesso restrito. Não ativar Analytics/Edge Runtime adicionais sem necessidade comprovada.
- Preferir Compose oficial como projeto separado coexistindo com o Swarm. Verificar redes compartilhadas e configuração efetiva do Traefik; não presumir que labels de Compose e Swarm funcionam da mesma forma.
- Criar volumes exclusivos e rede interna; encaminhar API/Storage/WebSocket pelo Traefik com HTTPS, sem disputar portas com os serviços atuais. Não publicar Postgres, Redis ou outros serviços internos na Internet.
- Gerar segredos próprios e armazená-los fora do Git. Configurar SMTP e redirects do Auth. Separar chaves públicas das administrativas.
- Dimensionar limites de memória e conexões a partir do ensaio. Não distribuir todos os 4,3 GiB disponíveis: preservar margem para o sistema e picos dos outros serviços. Não tratar swap como solução de desempenho; qualquer configuração será uma decisão operacional separada.
- Usar inicialmente armazenamento persistente dedicado ao Supabase Storage. Avaliar o MinIO existente apenas se isolamento de buckets, credenciais, capacidade e compatibilidade forem demonstrados.

Saída: destino responde a health checks e HTTPS/WebSocket; serviços atuais continuam funcionando.

## 4. Ensaio de restauração

- Recuperar conexão estável com a origem antes da exportação. Preferir janela com escritas suspensas para a cópia consistente; uma cópia inicial com origem ativa serve somente para ensaio, não como garantia de consistência final.
- Exportar roles, esquema e dados com a ferramenta Supabase indicada no guia oficial; verificar a inclusão de usuários Auth e políticas. Manter cópia externa protegida e registrar hashes dos arquivos.
- Restaurar no destino isolado usando procedimento compatível com as versões escolhidas e falha imediata em erro. Resolver incompatibilidades explicitamente; não omitir tabelas/colunas da aplicação para fazer o import passar.
- Desabilitar jobs, envio de mensagens e chamadas externas no ensaio. A cópia de dados reais não pode executar novamente automações da produção.
- Comparar contagens e IDs de entidades críticas, relacionamentos, sequências, usuários, políticas, grants, funções e extensões. Recriar/configurar publicações e infraestrutura de replicação para o destino; não copiar slots do Cloud como se fossem portáveis.
- Copiar arquivos via API Storage ou protocolo S3 suportado, com concorrência limitada. Se S3 não estiver disponível no plano/configuração da origem, usar a API. Não copiar arquivos diretamente para o volume interno do Storage.
- Verificar manifesto de caminhos, contagens, tamanhos e checksums quando suportados; testar download, upload e exclusão com autorização adequada. Ensaiar a sincronização final e o tratamento de arquivos removidos.
- Medir exportação, restauração, cópia de arquivos e validação. Essas medidas definem a janela de indisponibilidade.

Saída: cópia restaurável e ensaio sem perda ou inconsistência identificada.

## 5. Compatibilidade do aplicativo

Preparar um ambiente de teste do motiva-talk apontando para o destino, sem consumidores reais ou envio automático de mensagens.

Pontos confirmados no código:

- Clientes usam `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY`. Verificar compatibilidade dos formatos de chave com chamadas manuais que montam Authorization. As variáveis públicas são incorporadas ao build Next.js: é necessário reconstruir o frontend.
- `src/lib/supabase-jwt.ts` valida issuer e JWKS, com alternativa HS256 via `SUPABASE_AUTH_JWT_SECRET`. Validar autenticação contra o novo domínio e algoritmo de assinatura sem enfraquecer a validação. Invalidar sessões antigas e solicitar novo login; preservar contas e hashes de senha pela migração Auth.
- `src/hooks/useRealtimeInbox.ts` depende de `postgres_changes` em `Conversation` e `Message`, além de Broadcast. Testar ambos e transferência de setor, não apenas conexão WebSocket.
- `src/services/realtime.service.ts` publica por canais WebSocket e pode deixar canais em falhas. Corrigir/validar timeout e limpeza, ou publicação HTTP compatível com a versão instalada, como alteração separada e testada antes da troca.
- `src/services/whatsapp/webhook-ingestion.service.ts` identifica mídia interna por `includes('supabase.co')`. Trocar essa suposição por identificação baseada no domínio/base de Storage configurado, com validação de URL.
- Há URLs absolutas de mídia persistidas. Preparar transformação restrita ao host antigo e caminhos Storage esperados, com registro reversível das alterações. Não fazer substituição genérica em todo o banco. O script `migrate-media-paths.ts` existente muda caminhos e não é, por si só, um migrador entre hosts.
- Garantir continuidade de links antigos usados fora da aplicação: o domínio `*.supabase.co` não pode ser redirecionado por nós. Manter arquivos na origem durante a transição e definir prazo de retenção conforme o uso desses links.
- Revisar jobs de mensagens agendadas e integração `/api/webhooks/meta`. Não mudar endpoints dos provedores se o domínio da aplicação continuar igual e a integração só exigir troca de backend.

Saída: versão do aplicativo compatível, preparada para publicação e retorno.

## 6. Testes e critérios para prosseguir

Testar login, refresh, logout, convite/recuperação de senha quando usados; isolamento entre organizações e papéis; criação e atualização de conversas; envio/recebimento de mensagem com canal de teste; imagem/áudio/documento; entrega e deduplicação de webhooks; filtros e transferência de setor; Broadcast e eventos do Postgres em dois navegadores; reconexão; relatórios e agendamentos controlados.

Executar carga representativa com o pico observado de usuários, mensagens e arquivos, incluindo atividade concorrente de n8n/Formbricks. Usar dados/canais de teste e nunca disparar carga contra destinatários reais. Comparar latência p95, erros e tempo de atualização Realtime com o fluxo esperado.

Critérios propostos de aceitação, a ajustar ao ensaio:

- Sem divergências não explicadas de dados/arquivos e sem acesso indevido entre organizações.
- Sem OOM, reinícios inesperados ou fila crescente de requisições.
- Pelo menos 1 GiB de memória disponível sustentada no pico testado; maior margem se o n8n tiver picos ainda desconhecidos. Esse valor é uma margem inicial, não garantia universal de capacidade.
- Sem espera por I/O sustentada que degrade as operações; sem crescimento descontrolado de WAL/slots ou fila Realtime.
- Nenhum timeout nos fluxos críticos do ensaio; meta inicial p95 abaixo de 2 segundos para operações leves da API e atualizações Realtime, excluindo envio externo e transferência de mídia. Recalibrar com as medidas reais.
- Backup externo e restauração de prova concluídos.
- Formbricks, n8n e demais serviços continuam dentro de seus níveis anteriores de funcionamento.

Se falhar por recursos, adiar a troca e ampliar/separar infraestrutura; não tentar compensar apenas aumentando timeouts.

## 7. Troca de produção

1. Definir janela e preservar build/configuração anteriores. Verificar origem e destino antes de começar.
2. Colocar aplicação em manutenção e impedir escritas por todos os produtores, inclusive cron, campanhas, n8n e webhooks. Drenar requisições em andamento.
3. Para mensagens recebidas durante a janela, usar fila durável já validada ou uma política de retry do provedor comprovada. Não responder sucesso a uma mensagem não persistida. Se não houver estratégia confiável, bloquear a migração até resolvê-la.
4. Com a origem sem escritas, gerar exportação final consistente. Conservar backup externo. Restaurar em destino limpo preparado, substituindo somente a cópia de ensaio. Capturar alterações e exclusões finais de arquivos; reaplicar ajustes de URLs e configurações de forma reproduzível.
5. Comparar dados/arquivos novamente, verificar Auth, API e Realtime. Manter jobs desativados nos dois lados nesta etapa.
6. Publicar o build e configurações apontando para o novo host; reiniciar apenas componentes do aplicativo que precisem ler novas variáveis. Não há troca do DNS da aplicação se ela permanecer na hospedagem atual.
7. Executar verificações controladas. Antes de liberar público, validar a escolha de retornar ou prosseguir.
8. Liberar somente o destino para escrita, retomar consumidores e agendamentos exatamente uma vez e processar mensagens pendentes com deduplicação. Solicitar novo login aos usuários.
9. Observar ativamente as primeiras horas e coletar métricas durante 24–72 horas, incluindo horários de pico. Manter origem preservada, sem produtores de escrita.

Não prometer migração sem interrupção. A duração será calculada pelo ensaio; banco, arquivos e fila podem exigir janelas diferentes.

## 8. Plano de retorno

- Antes de liberar escrita na VPS: voltar ao build/configuração anterior, confirmar que o Cloud está acessível e retomar os produtores somente na origem. Conservar fila da janela e garantir deduplicação.
- Depois de liberar escrita na VPS: não basta trocar a URL, pois existem mensagens novas. Suspender escritas, fazer backup do destino e reconciliar novos/alterados/excluídos e arquivos com IDs preservados, inclusive alterações Auth. Só então reativar a origem. Preparar e ensaiar esse procedimento antes da troca.
- Se a origem continuar indisponível ou a reconciliação não for segura, manter manutenção e corrigir/restaurar o destino. Não declarar rollback disponível sem origem saudável.
- Usar falhas de login, perda/duplicação de mensagens, violação de isolamento ou falta sustentada de recursos como motivos para interromper a liberação.
- Preservar Cloud e backups por pelo menos 7 dias após a troca e por mais tempo se existirem links antigos dependentes dele. Retirada definitiva será uma ação posterior.

## 9. Operação após migração

Configurar backups automáticos criptografados fora da VPS para banco e arquivos, testar restauração periodicamente e definir objetivos de perda de dados/tempo de recuperação. Escolher frequência ou WAL/PITR conforme esses objetivos; backup diário sozinho permite perder até um dia de alterações.

Monitorar RAM disponível, OOM, memória por container, CPU, I/O, espaço livre, conexões, consultas lentas, jobs, WAL/replicação e latência de Auth/API/Realtime. Manter health check externo à VPS. Estabelecer retenção de logs, alertas e atualização controlada de imagens com restauração de prova.

## Pendências para executar

Subdomínio e DNS; hospedagem/build do aplicativo; conexão/credenciais do banco origem (a senha SSH não é a senha do Postgres); volume atual de arquivos/dados; SMTP; pico de usuários e mensagens; janela aceitável; estratégia de fila/retry; destino e metas de backup. Não registrar senhas neste documento.

## Referências oficiais

- [Instalação Docker e requisitos](https://supabase.com/docs/guides/self-hosting/docker)
- [Restauração do Cloud para self-hosted](https://supabase.com/docs/guides/self-hosting/restore-from-platform)
- [Postgres 17](https://supabase.com/docs/guides/self-hosting/postgres-upgrade-17)
- [Cópia dos objetos Storage](https://supabase.com/docs/guides/self-hosting/copy-from-platform-s3)
