import React from 'react';
import { redirect } from 'next/navigation';
import { ShieldAlert, Globe, UserCircle } from 'lucide-react';
import { getServerSession, getUserWithOrg } from '@/lib/auth-server';
import { LogoutButton } from '@/components/auth/LogoutButton';
import { cn } from '@/lib/utils';

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
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Premium Admin Header */}
      <header className="sticky top-0 z-50 border-b border-amber-500/30 bg-slate-900/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-amber-400 to-amber-600 text-slate-950 shadow-lg shadow-amber-500/20">
              <ShieldAlert size={20} strokeWidth={2.5} />
            </div>
            <div className="hidden flex-col sm:flex">
              <span className="text-xs font-black uppercase tracking-[0.2em] text-amber-500">
                Sistema Central
              </span>
              <span className="text-sm font-bold text-white">
                Motiva Talk <span className="text-slate-600 font-medium ml-1">Platform</span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="hidden items-center gap-2 rounded-full border border-slate-800 bg-slate-900 px-4 py-1.5 lg:flex">
              <Globe size={14} className="text-slate-500" />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Global Infrastructure
              </span>
            </div>

            <div className="flex items-center gap-4 border-l border-slate-800 pl-6">
              <div className="flex items-center gap-3">
                <div className="flex flex-col items-end text-right">
                  <span className="text-[10px] font-black uppercase tracking-widest text-amber-500">
                    Super Admin
                  </span>
                  <span className="text-xs font-medium text-slate-300">
                    {appUser.email}
                  </span>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-800 border border-slate-700">
                  <UserCircle size={20} className="text-slate-400" />
                </div>
              </div>
              <LogoutButton />
            </div>
          </div>
        </div>
      </header>

      {/* Visual Reinforcement of Admin Context */}
      <div className="relative pointer-events-none fixed inset-x-0 top-18 z-40 h-px bg-linear-to-r from-transparent via-amber-500/50 to-transparent shadow-[0_0_15px_rgba(245,158,11,0.3)]" />

      <main className="relative mx-auto max-w-7xl px-6 py-12">
        {/* Abstract background elements */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-[10%] -left-[10%] h-[40%] w-[40%] rounded-full bg-amber-500/5 blur-[120px]" />
          <div className="absolute top-[20%] -right-[5%] h-[30%] w-[30%] rounded-full bg-blue-500/5 blur-[100px]" />
        </div>
        
        <div className="relative z-10">
          {children}
        </div>
      </main>

      <footer className="mx-auto max-w-7xl border-t border-slate-900 px-6 py-12">
        <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Core Services Operational
          </div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-700">
            © 2026 Motiva Talk Infrastructure · Confidential Admin Panel
          </div>
        </div>
      </footer>
    </div>
  );
}
