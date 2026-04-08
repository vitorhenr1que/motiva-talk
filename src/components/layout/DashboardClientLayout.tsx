'use client';

import React, { useState, useEffect } from 'react';
import { 
  Menu, 
  HelpCircle, 
  ChevronLeft, 
  ChevronRight,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';
import { SidebarItem } from './SidebarItem';
import { LogoutButton } from '@/components/auth/LogoutButton';

interface DashboardClientLayoutProps {
  children: React.ReactNode;
  user: any;
  role: string;
  visibility: any;
}

export default function DashboardClientLayout({ 
  children, 
  user, 
  role, 
  visibility 
}: DashboardClientLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Load sidebar state from localStorage on mount
  useEffect(() => {
    const savedState = localStorage.getItem('sidebarOpen');
    if (savedState !== null) {
      setIsSidebarOpen(savedState === 'true');
    }
  }, []);

  const toggleSidebar = () => {
    const newState = !isSidebarOpen;
    setIsSidebarOpen(newState);
    localStorage.setItem('sidebarOpen', String(newState));
  };

  const isVisible = (key: string) => {
    if (role === 'ADMIN' || role === 'SUPERVISOR') return true;
    return !!(visibility as any)[key];
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      {/* Dashboard Sidebar */}
      <aside 
        className={`${
          isSidebarOpen ? 'w-64' : 'w-0 md:w-20'
        } flex flex-col border-r bg-white transition-all duration-300 ease-in-out relative overflow-hidden hidden md:flex`}
      >
        <div className="flex h-16 items-center justify-between border-b px-4">
          <div className="flex items-center gap-2 overflow-hidden">
            {isSidebarOpen && (
              <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent whitespace-nowrap ml-2">
                Motiva Talk
              </h1>
            )}
            {!isSidebarOpen && (
               <div className="h-8 w-8 ml-2 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-xs shrink-0">
                 MT
               </div>
            )}
          </div>
          <button 
            onClick={toggleSidebar}
            className="rounded-lg p-2 hover:bg-slate-100 text-slate-500 transition-colors"
            title={isSidebarOpen ? "Recolher menu" : "Expandir menu"}
          >
            {isSidebarOpen ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
          </button>
        </div>
        
        <nav className="flex-1 space-y-1 p-4 overflow-y-auto overflow-x-hidden">
          {isVisible('conversations') && (
            <SidebarItem 
              href="/inbox" 
              iconName="inbox" 
              label={isSidebarOpen ? "Conversas" : ""} 
            />
          )}

          {isVisible('funnel') && (
            <SidebarItem 
              href="/funnel" 
              iconName="trending" 
              label={isSidebarOpen ? "Fluxo Kanban" : ""} 
            />
          )}
          
          {isVisible('reports') && (
            <SidebarItem 
              href="/reports" 
              iconName="reports" 
              label={isSidebarOpen ? "Relatórios" : ""} 
            />
          )}

          {isVisible('reports') && (
            <SidebarItem 
              href="/reports/feedbacks" 
              iconName="feedback" 
              label={isSidebarOpen ? "Avaliações" : ""} 
            />
          )}

          {isVisible('channels') && (
            <SidebarItem 
              href="/channels" 
              iconName="channels" 
              label={isSidebarOpen ? "Canais" : ""} 
            />
          )}

          {isVisible('contacts') && (
            <SidebarItem 
              href="/contacts" 
              iconName="contacts" 
              label={isSidebarOpen ? "Contatos" : ""} 
            />
          )}

          {role === 'ADMIN' && (
            <SidebarItem 
              href="/settings/users" 
              iconName="contacts" 
              label={isSidebarOpen ? "Usuários" : ""} 
            />
          )}

          {isVisible('suggestions') && (
            <SidebarItem 
              href="/settings/suggestions" 
              iconName="suggestions" 
              label={isSidebarOpen ? "Sugestões" : ""} 
            />
          )}

          {isVisible('settings') && (
            <SidebarItem 
              href="/settings" 
              iconName="settings" 
              label={isSidebarOpen ? "Configurações" : ""} 
            />
          )}
        </nav>

        <div className="p-4 border-t space-y-2">
          <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors">
            <HelpCircle size={20} />
            {isSidebarOpen && <span>Ajuda</span>}
          </button>
          <LogoutButton hideLabel={!isSidebarOpen} />
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-16 items-center justify-between border-b bg-white px-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-4 md:hidden">
              <button className="rounded-lg p-2 hover:bg-slate-100">
                <Menu size={24} className="text-slate-600" />
              </button>
              <h1 className="text-lg font-bold text-slate-800">Motiva Talk</h1>
            </div>
          </div>
          
          <div className="flex-1 md:flex-none" />
          
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-end mr-2">
              <span className="text-sm font-bold text-slate-700 leading-tight">
                {user?.user_metadata?.full_name || user?.email?.split('@')[0]}
              </span>
              <span className={`text-[10px] font-extrabold uppercase tracking-widest leading-none px-1.5 py-0.5 rounded ${
                role === 'ADMIN' ? 'bg-indigo-100 text-indigo-600' : 
                role === 'SUPERVISOR' ? 'bg-blue-100 text-blue-600' : 
                'bg-slate-100 text-slate-500'
              }`}>
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
