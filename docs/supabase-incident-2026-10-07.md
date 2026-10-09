# Indisponibilidade Supabase — 07/10/2026

Projeto motiva-talk: `jakihsmncajylbdgafvr`, região `us-west-2`, organização no plano Free, instância Nano.

## Evidências coletadas

- Às 17h18 de São Paulo (20:18 UTC), o monitor local registrou timeout em Auth e Data API após 8 segundos. Storage respondeu HTTP 200 em 522 ms; esse endpoint sozinho não confirma acesso do Storage ao banco.
- Uma consulta SQL mínima (`select now(), pg_postmaster_start_time()`) falhou por timeout de conexão.
- A API de gerenciamento informou `ACTIVE_HEALTHY`, mas o painel marcou o projeto como `Unhealthy`.
- Na janela 16h20–17h20 de São Paulo, os logs do gateway mostraram 114 requisições: 48 com 522, 17 com 520, uma com 504, 47 com 200 e uma com 101. São 66 respostas 5xx.
- Logs Realtime registraram perda de conexão com o banco e filas expirando após aproximadamente 10–12 segundos. Isso não comprova que o limite numérico de conexões tenha sido atingido.
- Logs Postgres mostraram timeout de inicialização do cron job 2 às 16h22, seguido de uma execução concluída às 16h23. PostgREST também registrou timeouts.
- A última amostra de métricas exibida no painel era das 16h23: swap 427,75 MB; memória comprometida 1,36 GB contra limite de 1,2 GB (113,55%); IOwait 45,79%; CPU total 47%. A série visível só cobria 16h20–16h23, apesar do filtro de uma hora. Não representa necessariamente o estado às 17h20.
- O painel de visão geral exibiu disco ocupado em 6%. Espaço ocupado é diferente de orçamento de I/O. Não foi possível recuperar o percentual exato de orçamento consumido.

## Interpretação

Falha real de acesso ao banco e Auth, consistente com pressão de memória e espera por I/O na Nano, somada ao alerta de Disk IO Budget informado pelo usuário. Não há evidência suficiente para atribuir o incidente a uma consulta específica, confirmar crash/OOM ou afirmar perda de dados. Sem conexão SQL, não foi possível consultar atividade, estatísticas de consultas, cache ou jobs atuais.

## Estado das ações

Diagnóstico somente de leitura. O monitor acrescentou uma amostra local. Nenhuma alteração no banco, aplicação ou cobrança. A confirmação de Restart project foi aberta no painel, sem envio; autorização solicitada porque o diálogo exige confirmação e informa alguns minutos de indisponibilidade.

O reinício pode recuperar acesso, mas não garante reposição do orçamento de I/O nem correção da carga. Após recuperação, verificar SQL, Auth e Data API e então coletar consultas por leituras de disco, uso de temporários, atividade e jobs antes de escolher otimizações.

## Referências

- [High Disk I/O](https://supabase.com/docs/guides/troubleshooting/exhaust-disk-io)
- [Compute and Disk](https://supabase.com/docs/guides/platform/compute-and-disk)
- [Métricas do projeto](https://supabase.com/dashboard/project/jakihsmncajylbdgafvr/observability/database)
