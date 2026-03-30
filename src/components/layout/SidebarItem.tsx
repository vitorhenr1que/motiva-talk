'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  MessageSquare, 
  Settings, 
  Users, 
  Phone, 
  Zap,
  SquareKanban,
  BarChart3,
  Star
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const Icons: Record<string, any> = {
  inbox: MessageSquare,
  channels: Phone,
  contacts: Users,
  suggestions: Zap,
  settings: Settings,
  trending: SquareKanban,
  reports: BarChart3,
  feedback: Star
};

interface SidebarItemProps {
  href: string;
  iconName: string;
  label: string;
}

export const SidebarItem = ({ href, iconName, label }: SidebarItemProps) => {
  const pathname = usePathname();
  const active = pathname.includes(href);
  const Icon = Icons[iconName] || MessageSquare;

  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active 
          ? "bg-blue-600 text-white shadow-sm shadow-blue-200" 
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      )}
    >
      <Icon size={20} />
      <span>{label}</span>
    </Link>
  );
};
