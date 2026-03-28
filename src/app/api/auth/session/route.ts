import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { handleApiError, AppError } from '@/lib/api-errors'

export const dynamic = 'force-dynamic';

const ROUTE = '/api/auth/session';

export async function POST(req: Request) {
  try {
    const body = await req.json()
    console.log(`[API] ${req.method} ${ROUTE}:`, body);

    const { session } = body
    const cookieStore = await cookies()

    if (!session?.access_token) {
      throw new AppError('Sessão inválida', 400, 'VALIDATION_ERROR');
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
