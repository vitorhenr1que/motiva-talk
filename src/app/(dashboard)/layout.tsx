import React from 'react';
import { getServerSession, getUserWithOrg } from '@/lib/auth-server';
import { SettingRepository } from '@/repositories/settingRepository';
import DashboardClientLayout from '@/components/layout/DashboardClientLayout';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getServerSession();
  const appUser = user?.email ? await getUserWithOrg(user.email) : null;
  const role = appUser?.role || 'AGENT';
  const organizationId = appUser?.organizationId || null;

  // Buscar configurações de visibilidade do menu
  const settings = organizationId ? await SettingRepository.findByOrganization(organizationId) : null;

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
