import { NextRequest, NextResponse } from 'next/server'
import { getServerSession, getUserRole } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { UserRepository } from '@/repositories/userRepository'
import { handleApiError, AppError } from '@/lib/api-errors'

export const dynamic = 'force-dynamic';

const ROUTE = '/api/users/[id]';

/**
 * GET: Retorna os dados de um usuário específico
 * Qualquer usuário autenticado pode ver seu próprio perfil
 * Apenas ADMINs podem ver perfis de outros
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userSession = await getServerSession()
    if (!userSession) throw new AppError('Não autorizado', 401, 'AUTH_ERROR');

    const currentUserEmail = userSession.email!;
    const { id: targetUserId } = await params;

    // 1. Buscar informações do requisitante
    const { data: currentUser } = await supabaseAdmin.from('User').select('id, role').eq('email', currentUserEmail).single();
    
    const isSelf = currentUser?.id === targetUserId;
    const isAdmin = currentUser?.role === 'ADMIN';

    if (!isSelf && !isAdmin) {
      throw new AppError('Acesso negado: Você só pode visualizar seu próprio perfil', 403, 'FORBIDDEN');
    }

    // 2. Buscar o usuário alvo
    const user = await UserRepository.findById(targetUserId);
    if (!user) throw new AppError('Usuário não encontrado', 404, 'NOT_FOUND');

    return NextResponse.json({ success: true, data: user });
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userSession = await getServerSession()
    if (!userSession) throw new AppError('Não autorizado', 401, 'AUTH_ERROR');

    const currentUserEmail = userSession.email!;
    const { id: targetUserId } = await params;
    
    // 1. Buscar informações de quem está fazendo a requisição
    const { data: currentUser } = await supabaseAdmin.from('User').select('id, role').eq('email', currentUserEmail).single();
    const currentRole = currentUser?.role || 'AGENT';
    const isSelfUpdate = currentUser?.id === targetUserId;

    const body = await req.json()
    const { name, email, password, role, channelIds } = body

    // 2. Lógica de Permissões
    if (currentRole !== 'ADMIN') {
      // Se não for ADMIN:
      // a) Só pode editar a si mesmo
      if (!isSelfUpdate) throw new AppError('Acesso negado: Você só pode editar seu próprio perfil', 403, 'FORBIDDEN');
      
      // b) Só pode editar o NOME (e-mail, senha e role são travados para ADMINs)
      if (email || password || role) throw new AppError('Acesso negado: Apenas administradores podem alterar e-mail, senha ou cargo', 403, 'FORBIDDEN');
      
      // c) Verificar se a edição de nome está liberada globalmente
      const { data: settings } = await supabaseAdmin.from('ChatSetting').select('allowAgentNameEdit').single();
      const canEditName = settings?.allowAgentNameEdit ?? false;
      
      if (!canEditName) throw new AppError('Edição de nome desativada pelo administrador', 403, 'FORBIDDEN');
    }

    // 3. Preparar atualização para o Supabase Auth (se necessário)
    const updateAuthData: any = {}
    if (currentRole === 'ADMIN') {
        if (email) updateAuthData.email = email
        if (password) updateAuthData.password = password
    }
    if (name) updateAuthData.user_metadata = { full_name: name }

    try {
      if (Object.keys(updateAuthData).length > 0) {
        await supabaseAdmin.auth.admin.updateUserById(targetUserId, updateAuthData)
      }
    } catch (e) {
      console.warn('[API] Auth update failed (perhaps seed user):', e);
    }

    // 4. Atualizar no Banco de Dados
    const updateDbData: any = {}
    if (name) updateDbData.name = name;
    
    // Apenas ADMIN pode mudar email ou role no banco
    if (currentRole === 'ADMIN') {
        if (email) updateDbData.email = email;
        if (role) updateDbData.role = role;
        if (channelIds !== undefined) updateDbData.channelIds = channelIds;
    }

    const updated = await UserRepository.update(targetUserId, updateDbData)
    
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
