/** Variantes internacionais usadas pela Meta para celulares brasileiros. */
export function getContactPhoneVariants(phone: string): string[] {
  const digits = phone.replace(/\D/g, '');
  const variants = new Set([phone, digits]);

  // Não aplicar a regra do nono dígito a fixos nem a outros países.
  if (digits.startsWith('55')) {
    if (digits.length === 12 && /^[6-9]/.test(digits.slice(4))) {
      variants.add(`${digits.slice(0, 4)}9${digits.slice(4)}`);
    } else if (digits.length === 13 && /^9[6-9]/.test(digits.slice(4))) {
      variants.add(`${digits.slice(0, 4)}${digits.slice(5)}`);
    }
  }

  return [...variants].filter(Boolean);
}
