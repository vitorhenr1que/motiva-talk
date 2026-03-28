'use client';

import { useSettingsStore } from '@/store/useSettingsStore';
import { useEffect } from 'react';

/**
 * Client component to apply global themes and accessibility settings 
 * to the DOM from the global Zustand store.
 */
export const ThemeApplier = ({ children }: { children: React.ReactNode }) => {
  const { theme, fontSize } = useSettingsStore();

  useEffect(() => {
    // 1. Theme Management
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    // 2. Font Size Management 
    // We apply base font-size classes to the HTML element
    const htmlClasses = ['font-normal', 'font-large', 'font-extra-large'];
    document.documentElement.classList.remove(...htmlClasses);
    
    if (fontSize === 'large') document.documentElement.classList.add('font-large');
    if (fontSize === 'extra-large') document.documentElement.classList.add('font-extra-large');
  }, [theme, fontSize]);

  return <>{children}</>;
};
