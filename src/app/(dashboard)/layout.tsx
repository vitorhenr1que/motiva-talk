import React from 'react';
import { getServerSession, getUserRole } from '@/lib/auth-server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import DashboardClientLayout from '@/components/layout/DashboardClientLayout';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getServerSession();
  const role = user ? await getUserRole(user.email!) : 'AGENT';

  // Buscar configurações de visibilidade do menu
  const { data: settings } = await supabaseAdmin
    .from('ChatSetting')
    .select('agentMenuVisibility')
    .single();

  const visibility = settings?.agentMenuVisibility || {
    conversations: true,
    funnel: true,
    reports: false,
    channels: false,
    contacts: false,
    suggestions: true,
    settings: true
  };

  return (
    <DashboardClientLayout 
      user={user} 
      role={role} 
      visibility={visibility}
    >
      {children}
    </DashboardClientLayout>
  );
}
