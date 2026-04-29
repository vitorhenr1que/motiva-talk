import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth-server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getCurrentOrganizationId, organizationNotFoundError } from '@/lib/tenant';
import { handleApiError, AppError } from '@/lib/api-errors';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const userSession = await getServerSession();
    if (!userSession) throw new AppError('Não autorizado', 401, 'AUTH_ERROR');
    
    const organizationId = await getCurrentOrganizationId();
    if (!organizationId) throw organizationNotFoundError();

    const { data: user, error } = await supabaseAdmin
      .from('User')
      .select('*, organization:Organization(*)')
      .eq('email', userSession.email)
      .eq('organizationId', organizationId)
      .single();

    if (error) throw error;
    if (!user) throw new AppError('Usuário não encontrado', 404, 'NOT_FOUND');

    return NextResponse.json({ success: true, data: user });
  } catch (error) {
    return handleApiError(error, req, { route: '/api/users/me' });
  }
}
