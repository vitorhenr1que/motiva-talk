import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formata um número de telefone para o padrão brasileiro (75) 9xxxx-xxxx.
 * Trata casos com e sem o nono dígito e remove o código do país (55).
 */
export function formatPhone(phone: string): string {
  if (!phone) return '';
  
  // Remove tudo que não for dígito
  let cleaned = phone.replace(/\D/g, '');
  
  // Remove código do país 55 se estiver presente
  if (cleaned.startsWith('55') && (cleaned.length === 12 || cleaned.length === 13)) {
    cleaned = cleaned.substring(2);
  }

  // Se tiver 10 dígitos (DDD + 8), insere o 9 no início do número
  if (cleaned.length === 10) {
    cleaned = cleaned.substring(0, 2) + '9' + cleaned.substring(2);
  }

  // Se tiver 11 dígitos (DDD + 9), aplica a máscara: (XX) 9XXXX-XXXX
  if (cleaned.length === 11) {
    return `(${cleaned.substring(0, 2)}) ${cleaned.substring(2, 7)}-${cleaned.substring(7)}`;
  }

  // Fallback para números que não se encaixam ou internacionais
  return phone;
}

export function generateId() {
  return crypto.randomUUID().replace(/-/g, '');
}
