/**
 * Migra arquivos do bucket `chat-media` do layout antigo para o multi-tenant.
 *
 *   Antes:  received/<organizationId>/<channelId>/<filename>
 *   Depois: <organizationId>/<channelId>/<messageId>/<filename>
 *
 * Para cada Message cuja `mediaUrl` aponta para o caminho antigo:
 *   1. move() o arquivo no Supabase Storage (operação server-side, não baixa
 *      o conteúdo).
 *   2. atualiza Message.mediaUrl para o novo getPublicUrl.
 *
 * Uso:
 *   npx tsx scripts/migrate-media-paths.ts            # dry-run (default)
 *   npx tsx scripts/migrate-media-paths.ts --apply    # executa de fato
 *   npx tsx scripts/migrate-media-paths.ts --apply --limit 50
 *
 * Variáveis de ambiente lidas de .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

function loadDotEnv() {
  const candidates = ['.env.local', '.env'];
  for (const file of candidates) {
    const p = resolve(process.cwd(), file);
    if (!existsSync(p)) continue;
    const txt = readFileSync(p, 'utf8');
    for (const line of txt.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      const key = m[1];
      let val = m[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = val;
    }
  }
}
loadDotEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Faltam NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY no .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const BUCKET = 'chat-media';
const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const LIMIT = (() => {
  const i = args.indexOf('--limit');
  if (i === -1) return 500;
  const n = Number(args[i + 1]);
  return Number.isFinite(n) && n > 0 ? n : 500;
})();

interface MessageRow {
  id: string;
  organizationId: string | null;
  channelId: string | null;
  mediaUrl: string;
}

/**
 * Extrai o path interno do bucket a partir de uma URL pública do Supabase.
 * Ex.: https://xxx.supabase.co/storage/v1/object/public/chat-media/received/org/chan/file.jpg
 *      -> "received/org/chan/file.jpg"
 */
function extractStoragePath(publicUrl: string): string | null {
  const marker = `/object/public/${BUCKET}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return null;
  return publicUrl.substring(idx + marker.length);
}

async function fetchLegacyRows(limit: number): Promise<MessageRow[]> {
  const { data, error } = await supabase
    .from('Message')
    .select('id, organizationId, channelId, mediaUrl')
    .ilike('mediaUrl', '%/chat-media/received/%')
    .limit(limit);
  if (error) throw error;
  return (data || []) as MessageRow[];
}

async function moveObject(oldPath: string, newPath: string) {
  const { error } = await supabase.storage.from(BUCKET).move(oldPath, newPath);
  if (error) throw new Error(`storage.move falhou: ${error.message}`);
}

async function objectExists(path: string): Promise<boolean> {
  const slash = path.lastIndexOf('/');
  const dir = slash >= 0 ? path.substring(0, slash) : '';
  const file = slash >= 0 ? path.substring(slash + 1) : path;
  const { data, error } = await supabase.storage.from(BUCKET).list(dir, {
    search: file,
    limit: 1,
  });
  if (error) return false;
  return !!data?.some((entry) => entry.name === file);
}

async function updateMessageUrl(id: string, organizationId: string, newUrl: string) {
  const { error } = await supabase
    .from('Message')
    .update({ mediaUrl: newUrl })
    .eq('id', id)
    .eq('organizationId', organizationId);
  if (error) throw error;
}

async function main() {
  console.log(`[MIGRATE] Modo: ${APPLY ? 'APPLY (escreve no banco/storage)' : 'DRY-RUN'} | limit=${LIMIT}`);

  const rows = await fetchLegacyRows(LIMIT);
  console.log(`[MIGRATE] Encontradas ${rows.length} mensagens com layout antigo.`);
  if (rows.length === 0) return;

  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows) {
    const ctx = `msg=${row.id} org=${row.organizationId ?? '∅'} channel=${row.channelId ?? '∅'}`;

    if (!row.organizationId || !row.channelId) {
      console.warn(`[SKIP] ${ctx} :: organizationId/channelId vazios.`);
      skipped++;
      continue;
    }

    const oldPath = extractStoragePath(row.mediaUrl);
    if (!oldPath) {
      console.warn(`[SKIP] ${ctx} :: não foi possível extrair path da URL ${row.mediaUrl}`);
      skipped++;
      continue;
    }

    // received/<org>/<channel>/<file>  ->  pegamos só o nome do arquivo
    const fileName = oldPath.substring(oldPath.lastIndexOf('/') + 1);
    if (!fileName) {
      console.warn(`[SKIP] ${ctx} :: filename vazio em ${oldPath}`);
      skipped++;
      continue;
    }

    const newPath = `${row.organizationId}/${row.channelId}/${row.id}/${fileName}`;
    const { data: { publicUrl: newUrl } } = supabase.storage.from(BUCKET).getPublicUrl(newPath);

    if (!APPLY) {
      console.log(`[DRY] ${ctx} :: ${oldPath}  ->  ${newPath}`);
      migrated++;
      continue;
    }

    try {
      const exists = await objectExists(oldPath);
      if (!exists) {
        // Pode já ter sido migrado em uma execução anterior; se a row ainda
        // tem URL antiga, só corrigimos a URL apontando para o novo path se
        // o objeto novo existir.
        const newExists = await objectExists(newPath);
        if (newExists) {
          await updateMessageUrl(row.id, row.organizationId, newUrl);
          console.log(`[FIX-URL] ${ctx} :: storage já no novo layout, atualizada apenas a URL.`);
          migrated++;
          continue;
        }
        console.warn(`[MISS] ${ctx} :: objeto não existe nem em ${oldPath} nem em ${newPath}.`);
        skipped++;
        continue;
      }

      await moveObject(oldPath, newPath);
      await updateMessageUrl(row.id, row.organizationId, newUrl);
      console.log(`[OK] ${ctx} :: movido para ${newPath}`);
      migrated++;
    } catch (err) {
      failed++;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[FAIL] ${ctx} :: ${msg}`);
    }
  }

  console.log(`\n[MIGRATE] Resumo: migrated=${migrated} skipped=${skipped} failed=${failed} mode=${APPLY ? 'APPLY' : 'DRY-RUN'}`);
  if (!APPLY) {
    console.log(`[MIGRATE] Rode novamente com --apply para executar de fato.`);
  }
}

main().catch((err) => {
  console.error('[MIGRATE] Erro fatal:', err);
  process.exit(1);
});
