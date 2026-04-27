import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getServerSession, getUserRole } from '@/lib/auth-server';
import { AppError, handleApiError } from '@/lib/api-errors';

const ROUTE = '/api/sectors/[id]';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getServerSession();
    if (!user) throw new AppError('Não autorizado', 401, 'AUTH_ERROR');

    const role = await getUserRole(user.email!);
    if (role !== 'ADMIN') {
      throw new AppError('Apenas administradores podem editar setores', 403, 'FORBIDDEN');
    }

    const { id } = await params;
    const { name, userIds } = await req.json();

    if (!name) {
      throw new AppError('O nome do setor é obrigatório', 400, 'VALIDATION_ERROR');
    }

    // 1. Update Sector name
    const { data: sector, error: sectorError } = await supabaseAdmin
      .from('Sector')
      .update({ name, updatedAt: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (sectorError) throw sectorError;

    // 2. Update Users
    if (userIds && Array.isArray(userIds)) {
      // Remover todos os usuários atuais
      await supabaseAdmin.from('UserSector').delete().eq('sectorId', id);

      // Adicionar os novos
      const validUserIds = userIds.filter((uid: any) => uid && uid !== 'undefined');
      
      if (validUserIds.length > 0) {
        const userSectors = validUserIds.map((userId: string) => ({
          userId,
          sectorId: id
        }));

        await supabaseAdmin.from('UserSector').insert(userSectors);
      }
    }

    return NextResponse.json({ success: true, data: sector });
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getServerSession();
    if (!user) throw new AppError('Não autorizado', 401, 'AUTH_ERROR');

    const role = await getUserRole(user.email!);
    if (role !== 'ADMIN') {
      throw new AppError('Apenas administradores podem remover setores', 403, 'FORBIDDEN');
    }

    const { id } = await params;

    const { error } = await supabaseAdmin.from('Sector').delete().eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE });
  }
}
