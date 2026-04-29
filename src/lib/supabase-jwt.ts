import { createRemoteJWKSet, decodeProtectedHeader, jwtVerify } from 'jose'
import type { JWTPayload } from 'jose'
import type { User } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const jwtSecret = process.env.SUPABASE_AUTH_JWT_SECRET
const issuer = `${supabaseUrl}/auth/v1`

const jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`))

function payloadToUser(payload: JWTPayload): User | null {
  if (!payload.sub || typeof payload.email !== 'string') return null

  return {
    id: payload.sub,
    email: payload.email,
    role: typeof payload.role === 'string' ? payload.role : undefined,
    app_metadata: typeof payload.app_metadata === 'object' && payload.app_metadata ? payload.app_metadata : {},
    user_metadata: typeof payload.user_metadata === 'object' && payload.user_metadata ? payload.user_metadata : {},
    aud: typeof payload.aud === 'string' ? payload.aud : 'authenticated',
    created_at: '',
  } as User
}

export async function verifySupabaseAccessToken(token: string): Promise<User | null> {
  const { alg } = decodeProtectedHeader(token)
  const verifyOptions = { issuer }

  if (alg === 'HS256') {
    if (!jwtSecret) return null

    const secret = new TextEncoder().encode(jwtSecret)
    const { payload } = await jwtVerify(token, secret, verifyOptions)
    return payloadToUser(payload)
  }

  const { payload } = await jwtVerify(token, jwks, verifyOptions)
  return payloadToUser(payload)
}
