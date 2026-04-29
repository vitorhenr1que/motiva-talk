import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { handleApiError, AppError } from '@/lib/api-errors'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic';

const ROUTE = '/api/auth/session';

export async function POST(req: Request) {
  try {
    const body = await req.json()
    console.log(`[API] ${req.method} ${ROUTE}:`, body);

    const { session } = body
    const cookieStore = await cookies()

    // Verificar se a organização está ativa antes de criar o cookie
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(session.access_token)
    
    if (authError || !user) {
      throw new AppError('Token inválido', 401, 'AUTH_REQUIRED');
    }

    const { data: appUser } = await supabaseAdmin
      .from('User')
      .select('isPlatformAdmin, organization:Organization(status)')
      .eq('email', user.email)
      .maybeSingle()

    if (appUser && !appUser.isPlatformAdmin) {
      const organization = appUser.organization as any;
      
      if (!organization) {
        throw new AppError('Sua conta não está vinculada a nenhuma organização.', 403, 'ORGANIZATION_NOT_FOUND');
      }

      const orgStatus = organization.status ?? 'ACTIVE'
      if (orgStatus !== 'ACTIVE') {
        throw new AppError('Organização bloqueada. Entre em contato com o suporte.', 403, 'ORGANIZATION_BLOCKED');
      }
    }

    // Configurar cookie de acesso
    cookieStore.set('sb-access-token', session.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: session.expires_in,
      path: '/'
    })

    return NextResponse.json({ success: true, message: 'Sessão iniciada com sucesso' })
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE })
  }
}

export async function DELETE(req: Request) {
  try {
    const cookieStore = await cookies()
    cookieStore.delete('sb-access-token')
    return NextResponse.json({ success: true, message: 'Sessão encerrada com sucesso' })
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE })
  }
}
