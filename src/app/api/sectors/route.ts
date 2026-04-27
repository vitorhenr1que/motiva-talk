import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getServerSession, getUserRole } from '@/lib/auth-server';
import { AppError, handleApiError } from '@/lib/api-errors';

const ROUTE = '/api/sectors';

export async function GET(req: Request) {
  try {
    const user = await getServerSession();
    if (!user) throw new AppError('Não autorizado', 401, 'AUTH_ERROR');

    const role = await getUserRole(user.email!);
    const { searchParams } = new URL(req.url);
    const onlyMine = searchParams.get('mine') === 'true';
    
    let query = supabaseAdmin
      .from('Sector')
      .select('*, users:UserSector(userId, user:User(id, name, email))')
      .order('createdAt', { ascending: true });

    // Se for AGENTE e estiver pedindo "mine", ou se for ADMIN mas quiser filtrar os dele
    if (onlyMine && role !== 'ADMIN') {
      const { data: userSectors } = await supabaseAdmin
        .from('UserSector')
        .select('sectorId')
        .eq('userId', user.id);
      
      const allowedIds = userSectors?.map(us => us.sectorId) || [];
      
      if (allowedIds.length > 0) {
        query = query.in('id', allowedIds);
      } else {
        return NextResponse.json({ success: true, data: [] });
      }
    }

    const { data: sectors, error } = await query;

    if (error) throw error;

    return NextResponse.json({ success: true, data: sectors });
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getServerSession();
    if (!user) throw new AppError('Não autorizado', 401, 'AUTH_ERROR');

    const role = await getUserRole(user.email!);
    if (role !== 'ADMIN') {
      throw new AppError('Apenas administradores podem criar setores', 403, 'FORBIDDEN');
    }

    const { name, userIds } = await req.json();

    if (!name) {
      throw new AppError('O nome do setor é obrigatório', 400, 'VALIDATION_ERROR');
    }

    // 1. Create Sector
    const { data: sector, error: sectorError } = await supabaseAdmin
      .from('Sector')
      .insert([{ name }])
      .select()
      .single();

    if (sectorError) throw sectorError;

    // 2. Assign Users
    if (userIds && Array.isArray(userIds)) {
      const validUserIds = userIds.filter((uid: any) => uid && uid !== 'undefined');
      
      if (validUserIds.length > 0) {
        const userSectors = validUserIds.map((userId: string) => ({
          userId,
          sectorId: sector.id
        }));

        const { error: usersError } = await supabaseAdmin
          .from('UserSector')
          .insert(userSectors);

        if (usersError) console.error('Error assigning users to sector:', usersError);
      }
    }

    return NextResponse.json({ success: true, data: sector }, { status: 201 });
  } catch (error) {
    return handleApiError(error, req, { route: ROUTE });
  }
}
