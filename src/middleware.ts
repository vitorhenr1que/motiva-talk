import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

import { ORGANIZATION_NOT_FOUND_MESSAGE } from '@/lib/api-errors'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

interface UserOrganizationLookup {
  organizationId: string | null
  isPlatformAdmin: boolean | null
  organization: { id: string; status: string | null } | null
}

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const pathname = req.nextUrl.pathname

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

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false
    }
  })

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

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })

  const { data: appUser } = await supabaseAdmin
    .from('User')
    .select('organizationId, isPlatformAdmin, organization:Organization(id, status)')
    .eq('email', user.email)
    .maybeSingle()

  const userOrganization = appUser as UserOrganizationLookup | null
  const isPlatformAdmin = userOrganization?.isPlatformAdmin === true
  const isPlatformRoute =
    pathname.startsWith('/platform') || pathname.startsWith('/api/platform')

  // Super admin: passa em qualquer rota, mesmo sem org ativa.
  if (isPlatformAdmin) {
    return res
  }

  // Rotas /platform e /api/platform exigem auth, mas a guarda final é
  // requirePlatformAdmin() dentro de cada handler. Aqui só checamos auth.
  if (isPlatformRoute) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        {
          success: false,
          message: 'Acesso restrito ao painel da plataforma',
          code: 'PLATFORM_ADMIN_REQUIRED',
        },
        { status: 403 }
      )
    }
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('error', 'platform_admin_required')
    return NextResponse.redirect(url)
  }

  if (!userOrganization?.organizationId || !userOrganization.organization) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { success: false, message: ORGANIZATION_NOT_FOUND_MESSAGE, code: 'ORGANIZATION_NOT_FOUND' },
        { status: 403 }
      )
    }

    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('error', 'organization_not_found')
    return NextResponse.redirect(url)
  }

  // Bloqueio de organização: status != ACTIVE bloqueia tudo (exceto super admin, já tratado acima).
  const orgStatus = userOrganization.organization.status ?? 'ACTIVE'
  if (orgStatus !== 'ACTIVE') {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        {
          success: false,
          message: 'Organização bloqueada. Entre em contato com o suporte.',
          code: 'ORGANIZATION_BLOCKED',
        },
        { status: 403 }
      )
    }
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
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
