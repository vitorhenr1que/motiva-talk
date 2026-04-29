import { NextResponse } from 'next/server';
import { inviteRepository } from '@/repositories/inviteRepository';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { UserRepository } from '@/repositories/userRepository';
import { LimitsService } from '@/services/limits.service';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const invite = await inviteRepository.findByToken(token);

    if (!invite) {
      return NextResponse.json({ error: 'Convite não encontrado' }, { status: 404 });
    }

    if (invite.acceptedAt) {
      return NextResponse.json({ error: 'Convite já foi utilizado' }, { status: 400 });
    }

    const expiresAt = new Date(invite.expiresAt);
    if (expiresAt < new Date()) {
      return NextResponse.json({ error: 'Convite expirado' }, { status: 400 });
    }

    return NextResponse.json({ data: invite });
  } catch (error: any) {
    return NextResponse.json({ error: 'Erro ao buscar convite' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const { password, name } = await request.json();

    const invite = await inviteRepository.findByToken(token);

    if (!invite || invite.acceptedAt || new Date(invite.expiresAt) < new Date()) {
      return NextResponse.json({ error: 'Convite inválido ou expirado' }, { status: 400 });
    }

    // Re-checa limites: a org pode ter sido bloqueada ou ter atingido o limite
    // entre o envio do convite e a aceitação.
    try {
      await LimitsService.checkCanInviteUser(invite.organizationId);
    } catch (err: any) {
      return NextResponse.json(
        { error: err.message || 'Não é possível concluir o convite no momento.', code: err.type },
        { status: err.statusCode || 429 }
      );
    }

    // 1. Criar usuário no Supabase Auth
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: invite.email,
      password,
      email_confirm: true,
      user_metadata: { name }
    });

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    const userId = authUser.user.id;

    // 2. Criar perfil do Usuário vinculado à organização do convite
    await UserRepository.create(invite.organizationId, {
      id: userId,
      name,
      email: invite.email,
      role: invite.role,
      channelIds: invite.channelIds,
      sectorId: invite.sectorId
    });

    // 3. Marcar convite como aceito
    await inviteRepository.accept(invite.id);

    return NextResponse.json({ success: true, userId });
  } catch (error: any) {
    console.error('Accept invite error:', error);
    return NextResponse.json({ error: 'Erro ao aceitar convite' }, { status: 500 });
  }
}
