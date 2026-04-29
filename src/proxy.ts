import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'



const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

interface UserOrganizationLookup {
  organizationId: string | null
  isPlatformAdmin: boolean | null
  organization: { id: string; status: string | null } | null
}

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
  const { data: { user }, error } = await supabase.auth.getUser(token)

  if (error || !user?.email) {
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

  log('Token authenticated, checking API route')
  // Para rotas de API, fazemos apenas o check de autenticação básico.
  // A validação de organização e permissões será feita dentro dos handlers para evitar double-query e timeouts.
  if (pathname.startsWith('/api/')) {
    return res
  }

  log('Fetching user organization profile')
  // Para páginas, ainda fazemos o check de organização para evitar flashes de conteúdo ou redirecionar cedo.
  // Mas usamos o ID do usuário se possível (ou e-mail como fallback)
  const { data: appUser } = await supabaseAdmin
    .from('User')
    .select('organizationId, isPlatformAdmin, organization:Organization(id, status)')
    .eq('email', user.email)
    .maybeSingle()
  
  log('Profile fetched')

  const userOrganization = appUser as UserOrganizationLookup | null
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
