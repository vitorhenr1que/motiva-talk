/**
 * Utilitários de data e hora para garantir consistência em todo o sistema.
 * Fuso horário padrão: America/Bahia (UTC-3).
 */

/**
 * Garante que uma string de data seja interpretada como UTC se não tiver timezone explicito,
 * evitando que o JavaScript aplique o fuso local do navegador incorretamente.
 */
export function parseSafeDate(dateStr: string | Date | null | undefined): Date {
  if (!dateStr) return new Date();
  if (dateStr instanceof Date) return dateStr;

  // Se não tem 'Z' nem offset (+/-HH:mm), assumimos que é UTC (padrao do Supabase/Prisma)
  const hasTZ = /Z$|[+-]\d{2}:?\d{2}$/.test(dateStr);
  const normalized = hasTZ ? dateStr : `${dateStr}Z`;
  
  return new Date(normalized);
}

/**
 * Formata o horário (HH:mm) para o fuso da Bahia.
 */
export function formatTimeBahia(date: Date | string): string {
  const d = parseSafeDate(date);
  return d.toLocaleTimeString('pt-BR', { 
    hour: '2-digit', 
    minute: '2-digit',
    timeZone: 'America/Bahia' 
  });
}

/**
 * Formata a data para os separadores do chat (Hoje, Ontem ou Data Completa).
 */
export function formatDateDivider(date: Date | string): string {
  const target = parseSafeDate(date);
  const now = new Date();
  
  // Helper para zerar as horas considerando o fuso da Bahia
  const getMidnightBahia = (d: Date) => {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Bahia',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    });
    const parts = formatter.formatToParts(d);
    const dateObj: any = {};
    parts.forEach(p => dateObj[p.type] = p.value);
    return new Date(dateObj.year, dateObj.month - 1, dateObj.day).getTime();
  };

  const todayMidnight = getMidnightBahia(now);
  const targetMidnight = getMidnightBahia(target);
  
  const diffDays = Math.round((todayMidnight - targetMidnight) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Hoje';
  if (diffDays === 1) return 'Ontem';

  const dayOfWeek = target.toLocaleDateString('pt-BR', { weekday: 'long', timeZone: 'America/Bahia' });
  const dayMonthYear = target.toLocaleDateString('pt-BR', { 
    day: '2-digit', 
    month: '2-digit', 
    year: 'numeric',
    timeZone: 'America/Bahia'
  });
  
  return `${dayOfWeek}, ${dayMonthYear}`;
}
