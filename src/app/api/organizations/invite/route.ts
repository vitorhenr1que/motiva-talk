import { NextResponse } from 'next/server';
import { requireAdminOrOwner } from '@/lib/tenant';
import { inviteRepository } from '@/repositories/inviteRepository';
import { LimitsService } from '@/services/limits.service';

// IMPORTANTE: nenhum endpoint sob /api/organizations pode aceitar payloads que
// alterem maxChannels/maxUsers/maxMsgPerMonth/status/blockedReason. Esses campos
// são exclusivos do painel de Super Admin (/api/platform/*). ADMIN da empresa
// nunca pode editar os próprios limites.

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

    // In a real SaaS, we would send an email here.
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
