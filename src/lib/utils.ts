/**
 * Gerador de IDs para substituir o comportamento do Prisma (CUID).
 * Como o banco de dados Postgres/Supabase configurado não gera IDs automaticamente para estas tabelas,
 * precisamos gerar no lado do servidor antes da inserção.
 */
export function generateId() {
  // Gera um UUID e remove os hifens para manter a estética compacta (32 caracteres)
  // Se preferir CUID real, precisaria de uma lib específica, mas UUIDv4 sem hífen resolve 99% dos casos.
  return crypto.randomUUID().replace(/-/g, '');
}
