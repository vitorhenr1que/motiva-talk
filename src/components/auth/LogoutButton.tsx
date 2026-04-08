'use client';

import React from 'react';
import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';

export const LogoutButton = ({ hideLabel }: { hideLabel?: boolean }) => {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/session', { method: 'DELETE' });
      router.push('/login');
      router.refresh();
    } catch (error) {
       console.error('Erro ao sair');
    }
  };

  return (
    <button 
      onClick={handleLogout}
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-red-500 hover:bg-red-50 transition-colors ${hideLabel ? 'justify-center' : ''}`}
      title={hideLabel ? "Sair" : ""}
    >
      <LogOut size={20} className="shrink-0" />
      {!hideLabel && <span>Sair</span>}
    </button>
  );
};
