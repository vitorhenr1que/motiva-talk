import { NextResponse } from 'next/server'
import { UserService } from '@/services/users'
import { getServerSession, getUserRole } from '@/lib/auth-server'

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const userSession = await getServerSession()
    const role = userSession ? await getUserRole(userSession.email!) : null
    
    if (role !== 'ADMIN') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const users = await UserService.listAll()
    return NextResponse.json(users)
  } catch (error) {
    console.error('API Error (Users GET):', error)
    return NextResponse.json({ error: 'Erro ao listar usuários' }, { status: 500 })
  }
}

import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(req: Request) {
  try {
    const userSession = await getServerSession()
    const currentRole = userSession ? await getUserRole(userSession.email!) : null
    
    if (currentRole !== 'ADMIN') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const body = await req.json()
    const { name, email, role, password } = body

    if (!name || !email || !role || !password) {
      return NextResponse.json({ error: 'Campos obrigatórios ausentes' }, { status: 400 })
    }

    // 1. Criar no Supabase Auth via Admin SDK
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: name }
    })

    if (authError) {
      return NextResponse.json({ error: `Erro no Supabase: ${authError.message}` }, { status: 400 })
    }

    // 2. Criar no Banco (Prisma) usando o ID gerado pelo Auth para sincronia total
    const prisma = (await import('@/lib/prisma')).default
    const newUser = await prisma.user.create({
      data: {
        id: authUser.user.id,
        name,
        email,
        role
      }
    })
    
    return NextResponse.json(newUser, { status: 201 })
  } catch (error: any) {
    if (error.code === 'P2002') return NextResponse.json({ error: 'E-mail em uso no Prisma' }, { status: 400 })
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
