# Listagem de contatos

A tela `/contacts` usa `GET /api/contacts?paginate=true&search=...&cursor=...`.
O modo antigo da API continua compatível com dashboard e seletores do chat.

- Páginas de 30 registros; o banco retorna até 31 para detectar a próxima página.
- Ordenação alfabética por `(name, id)`, com comparação de tupla e sem OFFSET.
- Busca literal por nome com ILIKE em toda a organização, a partir de 2 caracteres.
- Debounce de 300 ms; cache de 60 segundos e descarte após 5 minutos sem uso.
- AbortSignal cancela buscas antigas; as chaves de cache isolam os resultados.
- IntersectionObserver acompanha o `main` rolável do dashboard, com margem de 300 px.
- Criar contato reinicia os cursores para respeitar a posição alfabética do novo registro.

## Banco e deploy

Migration `supabase/migrations/20261106145322_contact_cursor_pagination.sql`
aplicada em 06/11/2026 pelo plugin Supabase no projeto `jakihsmncajylbdgafvr`.
O nome do arquivo local foi alinhado à versão registrada pelo Supabase.
Ela cria o índice B-tree `(organizationId, name, id)` e a RPC `list_contact_page`,
restrita a `service_role`, chamada somente pelo repository no servidor.
Seleciona apenas `id`, `name` e `phone`; não faz contagem total.

No banco inspecionado, `pg_trgm` e `idx_contact_name_trgm` já existem.
Não é necessário duplicar esse índice GIN. Buscas de dois caracteres funcionam,
mas têm menor seletividade para trigramas do que buscas com três ou mais caracteres.

A autenticação, a organização derivada da sessão e o cliente administrativo
existente foram preservados. A tabela real `Contact` estava com RLS desativada;
esta migration não altera esse estado nem introduz políticas.

A ordenação é determinística, inclusive com nomes iguais. Como em qualquer
paginação por nome sem snapshot, alterações concorrentes de nomes ou inserções
anteriores ao cursor exigem atualizar a listagem para visualizar a nova posição.
A interface remove IDs repetidos defensivamente.

## Validação

- `npm test`: 42 testes, incluindo nove novos para cursores, limites de página,
  escape de busca, cache, deduplicação de requisições e cancelamento.
- `npx tsc --noEmit` e `npm run build` passaram.
- ESLint passou para a tela, API, hook e novos helpers/testes. O repository mantém
  os usos de `any` anteriores, apontados pela regra `no-explicit-any`.
- A migration foi executada duas vezes em PostgreSQL isolado via PGlite: três
  páginas com nomes iguais, ordem completa, isolamento de organizações, ILIKE,
  caracteres literais, resultados vazios e permissões da RPC validados.
- Consulta somente de leitura no Supabase real confirmou duas páginas/60 contatos
  sem IDs duplicados ou ausentes em relação à mesma ordenação.

- Após aplicar a migration, a RPC real confirmou duas páginas sem IDs duplicados
  ou ausentes, índice válido e execução restrita ao papel `service_role` entre
  os papéis da API. A chamada pelo PostgREST validou paginação, busca e retorno
  exclusivo dos três campos previstos.

O fluxo visual autenticado ainda precisa de validação. Não foi adicionada
virtualização sem evidência de lentidão de renderização.
