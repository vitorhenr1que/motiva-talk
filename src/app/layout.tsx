import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Motiva Talk - CRM Multicanal',
  description: 'Sistema de atendimento multicanal para instituições educacionais',
};

import { ThemeApplier } from '@/components/layout/ThemeApplier';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className={`${inter.className} transition-colors duration-200 antialiased`}>
        <ThemeApplier>
          {children}
        </ThemeApplier>
      </body>
    </html>
  );
}
