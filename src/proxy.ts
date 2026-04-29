import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { User } from '@supabase/supabase-js'
import { verifySupabaseAccessToken } from '@/lib/supabase-jwt'



const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

interface UserOrganizationLookup {
  organizationId: string | null
  isPlatformAdmin: boolean | null
  organization: { id: string; status: string | null } | null
}

const CACHE_COOKIE_NAME = 'mt-org-cache'
const CACHE_TTL = 60 * 5 // 5 minutos

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false
  }
})

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

export default async function proxy(req: NextRequest) {
  const start = Date.now()
  const res = NextResponse.next()
  const pathname = req.nextUrl.pathname
  
  const log = (msg: string) => {
    const duration = Date.now() - start
    console.log(`[PROXY] ${pathname} - ${msg} (+${duration}ms)`)
  }

  // Rotas que não precisam de autenticação
  const publicRoutes = ['/login', '/register', '/invite', '/onboarding', '/api/auth/session']
  const publicRoutePrefixes = ['/register/', '/invite/', '/onboarding/', '/api/invite']
  const isPublicRoute = 
    publicRoutes.some(route => pathname === route) || 
    publicRoutePrefixes.some(route => pathname.startsWith(route)) ||
    pathname.startsWith('/api/webhooks') || 
    pathname.startsWith('/api/public') || 
    pathname.startsWith('/api/messages/process-scheduled') ||
    pathname.startsWith('/feedback') || 
    pathname.startsWith('/_next') || 
    pathname.includes('.')

  if (isPublicRoute) {
    const token = req.cookies.get('sb-access-token')?.value
    const guestOnlyRoutes = ['/login', '/register']
    
    if (token && guestOnlyRoutes.includes(pathname)) {
      const url = req.nextUrl.clone()
      url.pathname = '/inbox'
      return NextResponse.redirect(url)
    }
    return res
  }

  const token = req.cookies.get('sb-access-token')?.value

  if (!token) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { success: false, message: 'Não autorizado', code: 'AUTH_REQUIRED' },
        { status: 401 }
      )
    }

    const url = req.nextUrl.clone()
    url.pathname = '/login'
    // Preservar a URL original para redirecionamento pós login
    url.searchParams.set('redirect', pathname)
    return NextResponse.redirect(url)
  }

  log('Authenticating token')
  let user: User | null = null

  // 1. Tentar validação criptográfica local/JWKS antes de chamar o Auth server.
  try {
    user = await verifySupabaseAccessToken(token)
    if (user) {
      log('Token verified locally (fast)')
    }
  } catch {
    log('Local verification failed, falling back to network')
  }

  // 2. Fallback para rede (Lento)
  if (!user) {
    const { data: { user: supabaseUser }, error } = await supabase.auth.getUser(token)
    if (error || !supabaseUser?.email) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { success: false, message: 'Não autorizado', code: 'AUTH_REQUIRED' },
          { status: 401 }
        )
      }

      const url = req.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('redirect', pathname)
      return NextResponse.redirect(url)
    }
    user = supabaseUser
    log('Token verified via network (slow)')
  }

  log('Token authenticated, checking API route')
  // Para rotas de API, fazemos apenas o check de autenticação básico.
  if (pathname.startsWith('/api/')) {
    return res
  }

  // Tentar obter perfil do cache (cookie) para evitar latência extrema
  const cachedProfile = req.cookies.get(CACHE_COOKIE_NAME)?.value
  let userOrganization: UserOrganizationLookup | null = null

  if (cachedProfile) {
    try {
      userOrganization = JSON.parse(atob(cachedProfile))
      log('Profile loaded from cache')
    } catch {
      log('Failed to parse cached profile')
    }
  }

  if (!userOrganization) {
    log('Fetching user organization profile from DB')
    const { data: appUser } = await supabaseAdmin
      .from('User')
      .select('organizationId, isPlatformAdmin, organization:Organization(id, status)')
      .eq('id', user.id)
      .maybeSingle()
    
    userOrganization = appUser as UserOrganizationLookup | null
    log('Profile fetched from DB')

    // Salvar no cache para as próximas requisições
    if (userOrganization) {
      const cacheValue = btoa(JSON.stringify(userOrganization))
      res.cookies.set(CACHE_COOKIE_NAME, cacheValue, {
        maxAge: CACHE_TTL,
        path: '/',
        httpOnly: true,
        sameSite: 'lax'
      })
    }
  }
  const isPlatformAdmin = userOrganization?.isPlatformAdmin === true
  const isPlatformRoute = pathname.startsWith('/platform')

  if (isPlatformAdmin) {
    return res
  }

  if (isPlatformRoute) {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('error', 'platform_admin_required')
    return NextResponse.redirect(url)
  }

  if (!userOrganization?.organizationId || !userOrganization.organization) {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('error', 'organization_not_found')
    return NextResponse.redirect(url)
  }

  const orgStatus = userOrganization.organization.status ?? 'ACTIVE'
  if (orgStatus !== 'ACTIVE') {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('error', 'organization_blocked')
    const response = NextResponse.redirect(url)
    response.cookies.delete('sb-access-token')
    return response
  }

  return res
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/webhooks (webhook handlers)
     * - api/public (public api)
     * - api/messages/process-scheduled (cron job)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files (images, etc)
     */
    '/((?!api/webhooks|api/public|api/messages/process-scheduled|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$|feedback/.*).*)',
  ],
}
