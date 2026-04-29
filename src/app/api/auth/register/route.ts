import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { slugify } from '@/lib/utils';
import { organizationRepository } from '@/repositories/organizationRepository';
import { UserRepository } from '@/repositories/userRepository';
import { SettingRepository } from '@/repositories/settingRepository';

export async function POST(request: Request) {
  try {
    const { name, email, password, companyName } = await request.json();

    if (!name || !email || !password || !companyName) {
      return NextResponse.json({ error: 'Todos os campos são obrigatórios' }, { status: 400 });
    }

    // 1. Gerar slug único
    let slug = slugify(companyName);
    let originalSlug = slug;
    let counter = 1;
    
    // Check if slug exists
    let existingOrg = await organizationRepository.findBySlug(slug);
    while (existingOrg) {
      slug = `${originalSlug}-${counter}`;
      counter++;
      existingOrg = await organizationRepository.findBySlug(slug);
    }

    // 2. Criar usuário no Supabase Auth
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name }
    });

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    const userId = authUser.user.id;

    // 3. Criar Organização (defaults do plano FREE)
    const organization = await organizationRepository.create({
      name: companyName,
      slug,
      ownerId: userId,
      plan: 'FREE',
      status: 'ACTIVE',
      maxChannels: 1,
      maxUsers: 3,
      maxMsgPerMonth: 1000
    });

    // 4. Criar perfil do Usuário
    await UserRepository.create(organization.id, {
      id: userId,
      name,
      email,
      role: 'ADMIN'
    });

    // 5. Criar ChatSetting padrão
    await SettingRepository.createDefaultForOrganization(organization.id);

    return NextResponse.json({ 
      success: true, 
      organizationId: organization.id,
      userId: userId
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    return NextResponse.json({ error: error.message || 'Erro interno ao registrar' }, { status: 500 });
  }
}
