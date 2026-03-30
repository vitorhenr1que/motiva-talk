import React from 'react';
import { 
  MessageSquare, 
  Settings, 
  Users, 
  Phone, 
  HelpCircle, 
  Menu,
  Zap,
  LogOut
} from 'lucide-react';
import Link from 'next/link';
import { headers, cookies } from 'next/headers';
import { getServerSession, getUserRole } from '@/lib/auth-server';
import { LogoutButton } from '@/components/auth/LogoutButton';
import { SidebarItem } from '@/components/layout/SidebarItem';
import { supabaseAdmin } from '@/lib/supabase-admin';

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

  const isVisible = (key: string) => {
    if (role === 'ADMIN' || role === 'SUPERVISOR') return true;
    return !!(visibility as any)[key];
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      {/* Dashboard Sidebar */}
      <aside className="w-64 flex-col border-r bg-white hidden md:flex">
        <div className="flex h-16 items-center border-b px-6">
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Motiva Talk
          </h1>
        </div>
        
        <nav className="flex-1 space-y-1 p-4">
          {isVisible('conversations') && (
            <SidebarItem 
              href="/inbox" 
              iconName="inbox" 
              label="Conversas" 
            />
          )}

          {isVisible('funnel') && (
            <SidebarItem 
              href="/funnel" 
              iconName="trending" 
              label="Fluxo Kanban" 
            />
          )}
          
          {isVisible('reports') && (role === 'ADMIN' || role === 'SUPERVISOR') && (
            <SidebarItem 
              href="/reports" 
              iconName="reports" 
              label="Relatórios" 
            />
          )}

          {isVisible('reports') && (role === 'ADMIN' || role === 'SUPERVISOR') && (
            <SidebarItem 
              href="/reports/feedbacks" 
              iconName="feedback" 
              label="Avaliações" 
            />
          )}

          {isVisible('channels') && (role === 'ADMIN' || role === 'SUPERVISOR') && (
            <SidebarItem 
              href="/channels" 
              iconName="channels" 
              label="Canais" 
            />
          )}

          {isVisible('contacts') && (role === 'ADMIN' || role === 'SUPERVISOR') && (
            <SidebarItem 
              href="/contacts" 
              iconName="contacts" 
              label="Contatos" 
            />
          )}

          {role === 'ADMIN' && (
            <SidebarItem 
              href="/settings/users" 
              iconName="contacts" 
              label="Usuários" 
            />
          )}

          {isVisible('suggestions') && (
            <SidebarItem 
              href="/settings/suggestions" 
              iconName="suggestions" 
              label="Sugestões" 
            />
          )}

          {isVisible('settings') && (
            <SidebarItem 
              href="/settings" 
              iconName="settings" 
              label="Configurações" 
            />
          )}
        </nav>

        <div className="p-4 border-t space-y-2">
          <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors">
            <HelpCircle size={20} />
            <span>Ajuda</span>
          </button>
          <LogoutButton />
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-16 items-center justify-between border-b bg-white px-6">
          <div className="flex items-center gap-4 md:hidden">
            <button className="rounded-lg p-2 hover:bg-slate-100">
              <Menu size={24} className="text-slate-600" />
            </button>
            <h1 className="text-lg font-bold text-slate-800">Motiva Talk</h1>
          </div>
          
          <div className="flex-1 md:flex-none" />
          
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-end mr-2">
              <span className="text-sm font-bold text-slate-700 leading-tight">
                {user?.user_metadata?.full_name || user?.email?.split('@')[0]}
              </span>
              <span className={(`text-[10px] font-extrabold uppercase tracking-widest leading-none px-1.5 py-0.5 rounded ${
                role === 'ADMIN' ? 'bg-indigo-100 text-indigo-600' : 
                role === 'SUPERVISOR' ? 'bg-blue-100 text-blue-600' : 
                'bg-slate-100 text-slate-500'
              }`)}>
                {role}
              </span>
            </div>
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-bold shadow-lg shadow-blue-100 border-2 border-white">
              {(user?.email?.[0] || 'U').toUpperCase()}
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
