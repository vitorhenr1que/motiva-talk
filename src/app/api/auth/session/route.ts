import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { session } = await req.json()
    const cookieStore = await cookies()

    if (!session?.access_token) {
      return NextResponse.json({ error: 'Sessão inválida' }, { status: 400 })
    }

    // Configurar cookie de acesso
    cookieStore.set('sb-access-token', session.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: session.expires_in,
      path: '/'
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function DELETE() {
  const cookieStore = await cookies()
  cookieStore.delete('sb-access-token')
  return NextResponse.json({ success: true })
}
