import { NextRequest, NextResponse } from 'next/server'
import { getServerSession, getUserRole } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { UserRepository } from '@/repositories/userRepository'
import { handleApiError, AppError } from '@/lib/api-errors'

export const dynamic = 'force-dynamic';

const ROUTE = '/api/users/[id]';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userSession = await getServerSession()
    if (!userSession) throw new AppError('Não autorizado', 401, 'AUTH_ERROR');

    const role = await getUserRole(userSession.email!)
    if (role !== 'ADMIN') throw new AppError('Acesso negado', 403, 'FORBIDDEN');

    const { id } = await params
    const body = await req.json()
    console.log(`[API] ${req.method} ${ROUTE}:`, { id, body });

    const { name, email, password, userRole } = body

    // 1. Atualizar Supabase se e-mail ou senha mudaram
    const updateData: any = {}
    if (email) updateData.email = email
    if (password) updateData.password = password
    if (name) updateData.user_metadata = { full_name: name }

    try {
      if (Object.keys(updateData).length > 0) {
        await supabaseAdmin.auth.admin.updateUserById(id, updateData)
      }
    } catch (e) {
      console.warn('[API] Auth update failed (perhaps seed user):', e);
    }

    // 2. Atualizar no Banco
    const updated = await UserRepository.update(id, {
      name: name || undefined,
      email: email || undefined,
      role: userRole || undefined
    })
    
    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userSession = await getServerSession()
    if (!userSession) throw new AppError('Não autorizado', 401, 'AUTH_ERROR');

    const role = await getUserRole(userSession.email!)
    if (role !== 'ADMIN') throw new AppError('Acesso negado', 403, 'FORBIDDEN');

    const { id } = await params
    console.log(`[API] ${req.method} ${ROUTE}:`, { id });
    
    // Deletar do Auth
    try {
      await supabaseAdmin.auth.admin.deleteUser(id)
    } catch (e) {
      console.warn('[API] Auth delete failed:', e);
    }

    // Deletar do Banco
    await UserRepository.delete(id)

    return NextResponse.json({ success: true, message: 'Usuário excluído com sucesso' })
  } catch (error: any) {
    return handleApiError(error, req, { route: ROUTE })
  }
}
