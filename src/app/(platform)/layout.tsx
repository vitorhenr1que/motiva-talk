import React from 'react';
import { redirect } from 'next/navigation';
import { ShieldAlert } from 'lucide-react';
import { getServerSession, getUserWithOrg } from '@/lib/auth-server';
import { LogoutButton } from '@/components/auth/LogoutButton';

export const metadata = {
  title: '[PLATAFORMA] Motiva Talk',
};

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession();
  if (!session?.email) redirect('/login?redirect=/platform');

  const appUser = await getUserWithOrg(session.email);
  if (!appUser?.isPlatformAdmin) {
    redirect('/login?error=platform_admin_required');
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      {/* Banner de reforço visual: deixa inequívoco que o super admin está
          fora do dashboard de empresa. */}
      <div className="sticky top-0 z-50 flex items-center justify-between gap-4 bg-amber-500 px-6 py-3 text-slate-900 shadow-lg">
        <div className="flex items-center gap-3">
          <ShieldAlert className="h-5 w-5 text-red-700" strokeWidth={2.5} />
          <span className="text-sm font-bold uppercase tracking-wide">
            Painel da Plataforma · Motiva Talk
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <span className="rounded bg-slate-900/10 px-2 py-1 font-mono">
            super admin · {appUser.email}
          </span>
          <LogoutButton />
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </div>
  );
}
