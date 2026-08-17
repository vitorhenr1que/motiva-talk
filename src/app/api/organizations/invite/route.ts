import { NextResponse } from 'next/server';
import { requireAdminOrOwner } from '@/lib/tenant';
import { inviteRepository } from '@/repositories/inviteRepository';
import { LimitsService } from '@/services/limits.service';

export async function POST(request: Request) {
  try {
    const user = await requireAdminOrOwner();
    const { email, role, channelIds, sectorId } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'E-mail é obrigatório' }, { status: 400 });
    }

    const organizationId = user.organizationId!;
    await LimitsService.checkCanInviteUser(organizationId);

    const invite = await inviteRepository.create({
      organizationId,
      email,
      role: role || 'AGENT',
      channelIds: channelIds || [],
      sectorId: sectorId || null
    });

    // O link é entregue pelo administrador ao novo membro da equipe.
    // For now, we just return the invite details (including token/URL)
    const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL || ''}/invite/${invite.token}`;

    return NextResponse.json({ 
      success: true, 
      invite,
      inviteUrl
    });
  } catch (error: any) {
    console.error('Invite error:', error);
    return NextResponse.json({ 
      error: error.message || 'Erro ao criar convite' 
    }, { status: error.status || 500 });
  }
}

export async function GET() {
  try {
    const user = await requireAdminOrOwner();
    const invites = await inviteRepository.findByOrganization(user.organizationId!);
    return NextResponse.json({ data: invites });
  } catch (error: any) {
    return NextResponse.json({ 
      error: error.message || 'Erro ao buscar convites' 
    }, { status: error.status || 500 });
  }
}
