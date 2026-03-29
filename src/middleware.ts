import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const pathname = req.nextUrl.pathname

  // Rotas que não precisam de autenticação
  const publicRoutes = ['/login', '/api/auth/session']
  const isPublicRoute = 
    publicRoutes.some(route => pathname === route) || 
    pathname.startsWith('/api/webhooks') || 
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

  return res
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
