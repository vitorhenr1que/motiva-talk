import { NextRequest, NextResponse } from 'next/server'
import { getServerSession, getUserRole } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase-admin'

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
      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(id, updateData)
      // Nota: Falha pode ocorrer se o ID for do Seed (não existe no Auth)
    }

    // 2. Atualizar Prisma
    const prisma = (await import('@/lib/prisma')).default
    const updated = await prisma.user.update({
      where: { id },
      data: {
        name: name || undefined,
        email: email || undefined,
        role: userRole || undefined
      }
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
    const prisma = (await import('@/lib/prisma')).default
    await prisma.user.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('API Error (Users DELETE):', error)
    return NextResponse.json({ error: 'Erro ao excluir usuário' }, { status: 500 })
  }
}
