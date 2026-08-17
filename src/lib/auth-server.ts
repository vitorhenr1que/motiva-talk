import { cache } from 'react'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { verifySupabaseAccessToken } from '@/lib/supabase-jwt'

export type AppUserRole = 'ADMIN' | 'SUPERVISOR' | 'AGENT' | 'OWNER'

export interface OrganizationContext {
  id: string
  name: string
  slug: string
  ownerId: string | null
  createdAt: string | null
}

export interface UserWithOrganization {
  id: string
  name: string
  email: string
  role: AppUserRole
  organizationId: string | null
  organization: OrganizationContext | null
}

const USER_WITH_ORG_SELECT = `
  id,
  name,
  email,
  role,
  organizationId,
  organization:Organization (
    id,
    name,
    slug,
    ownerId,
    createdAt
  )
`

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const getServerSession = cache(async () => {
  const cookieStore = await cookies()
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false
    }
  })

  const token = cookieStore.get('sb-access-token')?.value

  if (!token) return null

  try {
    const verifiedUser = await verifySupabaseAccessToken(token)
    if (verifiedUser) return verifiedUser
  } catch {
    // Fallback abaixo mantém compatibilidade se a verificação local/JWKS falhar.
  }

  const { data: { user }, error } = await supabase.auth.getUser(token)
  
  if (error || !user) return null

  return user
})

export const getUserRole = cache(async (email: string, organizationId?: string) => {
  const { supabaseAdmin } = await import('@/lib/supabase-admin')
  let query = supabaseAdmin
    .from('User')
    .select('role')
    .eq('email', email)

  if (organizationId) query = query.eq('organizationId', organizationId)

  const { data: user } = await query.single()
  
  return user?.role || 'AGENT'
})

export const getUserWithOrg = cache(async (email: string): Promise<UserWithOrganization | null> => {
  const { supabaseAdmin } = await import('@/lib/supabase-admin')
  const { data: user } = await supabaseAdmin
    .from('User')
    .select(USER_WITH_ORG_SELECT)
    .eq('email', email)
    .maybeSingle()

  return (user as UserWithOrganization | null) ?? null
})

export async function getOrganizationId(email: string): Promise<string | null> {
  const user = await getUserWithOrg(email)

  return user?.organizationId ?? null
}
