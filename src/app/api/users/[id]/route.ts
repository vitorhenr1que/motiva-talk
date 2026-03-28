import { NextRequest, NextResponse } from 'next/server'
import { getServerSession, getUserRole } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { UserRepository } from '@/repositories/userRepository'

export const dynamic = 'force-dynamic';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userSession = await getServerSession()
    const role = userSession ? await getUserRole(userSession.email!) : null
    
    if (role !== 'ADMIN') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const { id } = await params
    const body = await req.json()
    const { name, email, password, userRole } = body

    // 1. Atualizar Supabase se e-mail ou senha mudaram
    const updateData: any = {}
    if (email) updateData.email = email
    if (password) updateData.password = password
    if (name) updateData.user_metadata = { full_name: name }

    if (Object.keys(updateData).length > 0) {
      await supabaseAdmin.auth.admin.updateUserById(id, updateData)
    }

    // 2. Atualizar no Banco
    const updated = await UserRepository.update(id, {
      name: name || undefined,
      email: email || undefined,
      role: userRole || undefined
    })
    
    return NextResponse.json(updated)
  } catch (error) {
    console.error('API Error (Users PATCH):', error)
    return NextResponse.json({ error: 'Erro ao atualizar usuário' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userSession = await getServerSession()
    const role = userSession ? await getUserRole(userSession.email!) : null
    
    if (role !== 'ADMIN') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const { id } = await params
    
    // Deletar do Auth
    await supabaseAdmin.auth.admin.deleteUser(id)

    // Deletar do Banco
    await UserRepository.delete(id)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('API Error (Users DELETE):', error)
    return NextResponse.json({ error: 'Erro ao excluir usuário' }, { status: 500 })
  }
}
