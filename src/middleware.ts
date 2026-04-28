import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

import { ORGANIZATION_NOT_FOUND_MESSAGE } from '@/lib/api-errors'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

interface UserOrganizationLookup {
  organizationId: string | null
  organization: { id: string } | null
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
    .select('organizationId, organization:Organization(id)')
    .eq('email', user.email)
    .maybeSingle()

  const userOrganization = appUser as UserOrganizationLookup | null

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

  return res
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
