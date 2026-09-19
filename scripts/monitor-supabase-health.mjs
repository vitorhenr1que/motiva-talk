import { appendFile, mkdir, readFile, readdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseEnv } from 'node:util'

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const LOG_DIR = path.join(ROOT_DIR, 'logs', 'supabase-health')
const RETENTION_DAYS = 14
const REQUEST_TIMEOUT_MS = 8_000
const SLOW_REQUEST_MS = 3_000

async function readEnvironment() {
  const environment = { ...process.env }

  for (const fileName of ['.env', '.env.local']) {
    try {
      const contents = await readFile(path.join(ROOT_DIR, fileName), 'utf8')
      Object.assign(environment, parseEnv(contents))
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error
    }
  }

  return environment
}

async function checkService(baseUrl, apiKey, service) {
  const startedAt = performance.now()

  try {
    const response = await fetch(`${baseUrl}${service.path}`, {
      cache: 'no-store',
      headers: {
        apikey: apiKey,
        Authorization: `Bearer ${apiKey}`,
        'User-Agent': 'motiva-talk-health-monitor/1.0',
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })

    await response.arrayBuffer()

    return {
      name: service.name,
      ok: response.ok,
      statusCode: response.status,
      latencyMs: Math.round(performance.now() - startedAt),
      error: null,
    }
  } catch (error) {
    return {
      name: service.name,
      ok: false,
      statusCode: null,
      latencyMs: Math.round(performance.now() - startedAt),
      error: error instanceof Error ? error.name : 'UnknownError',
    }
  }
}

async function pruneOldLogs() {
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1_000
  const fileNames = await readdir(LOG_DIR)

  await Promise.all(fileNames.map(async (fileName) => {
    const match = /^(\d{4}-\d{2}-\d{2})\.jsonl$/.exec(fileName)
    if (!match) return

    const fileDate = Date.parse(`${match[1]}T00:00:00.000Z`)
    if (Number.isFinite(fileDate) && fileDate < cutoff) {
      await rm(path.join(LOG_DIR, fileName))
    }
  }))
}

async function writeEntry(entry) {
  await mkdir(LOG_DIR, { recursive: true })
  const day = entry.checkedAt.slice(0, 10)
  await appendFile(path.join(LOG_DIR, `${day}.jsonl`), `${JSON.stringify(entry)}\n`, 'utf8')
  await pruneOldLogs()
}

async function main() {
  const checkedAt = new Date().toISOString()
  const environment = await readEnvironment()
  const baseUrl = environment.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '')
  const apiKey = environment.SUPABASE_SERVICE_ROLE_KEY || environment.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!baseUrl || !apiKey) {
    const entry = {
      checkedAt,
      status: 'configuration_error',
      projectRef: null,
      services: [],
      error: 'NEXT_PUBLIC_SUPABASE_URL or Supabase API key is missing',
    }
    await writeEntry(entry)
    console.log(JSON.stringify(entry))
    return
  }

  const projectRef = new URL(baseUrl).hostname.split('.')[0]
  const services = await Promise.all([
    checkService(baseUrl, apiKey, { name: 'auth', path: '/auth/v1/health' }),
    checkService(baseUrl, apiKey, { name: 'database', path: '/rest/v1/Channel?select=id&limit=1' }),
    checkService(baseUrl, apiKey, { name: 'storage', path: '/storage/v1/status' }),
  ])

  const allHealthy = services.every((service) => service.ok)
  const hasSlowService = services.some((service) => service.latencyMs >= SLOW_REQUEST_MS)
  const status = !allHealthy ? 'unhealthy' : hasSlowService ? 'degraded' : 'healthy'
  const entry = { checkedAt, status, projectRef, services }

  await writeEntry(entry)
  console.log(JSON.stringify(entry))
}

main().catch((error) => {
  console.error(JSON.stringify({
    checkedAt: new Date().toISOString(),
    status: 'monitor_error',
    error: error instanceof Error ? error.message : String(error),
  }))
  process.exitCode = 1
})
