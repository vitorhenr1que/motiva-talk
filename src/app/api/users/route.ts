import { NextResponse } from 'next/server'
import { UserService } from '@/services/users'
import { getServerSession, getUserRole } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { UserRepository } from '@/repositories/userRepository'
import { handleApiError, validateBody, AppError } from '@/lib/api-errors'

export const dynamic = 'force-dynamic';

const ROUTE = '/api/users';

export async function GET(req: Request) {
  try {
    const userSession = await getServerSession()
    if (!userSession) throw new AppError('Não autorizado', 401, 'AUTH_ERROR');

    const role = await getUserRole(userSession.email!)
    if (role !== 'ADMIN') throw new AppError('Acesso negado', 403, 'FORBIDDEN');

    const users = await UserService.listAll()
    return NextResponse.json({ success: true, data: users })
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE })
  }
}

export async function POST(req: Request) {
  try {
    const userSession = await getServerSession()
    if (!userSession) throw new AppError('Não autorizado', 401, 'AUTH_ERROR');

    const currentRole = await getUserRole(userSession.email!)
    if (currentRole !== 'ADMIN') throw new AppError('Acesso negado', 403, 'FORBIDDEN');

    const body = await req.json()
    console.log(`[API] ${req.method} ${ROUTE}:`, body);
    
    validateBody(body, ['name', 'email', 'role', 'password'])
    const { name, email, role, password } = body

    // 1. Criar no Supabase Auth via Admin SDK
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: name }
    })

    if (authError) throw authError;

    // 2. Criar no Banco usando o ID gerado pelo Auth para sincronia total
    const newUser = await UserRepository.create({
      id: authUser.user.id,
      name,
      email,
      role
    })
    
    return NextResponse.json({ success: true, data: newUser }, { status: 201 })
  } catch (error: any) {
    return handleApiError(error, req, { route: ROUTE })
  }
}
