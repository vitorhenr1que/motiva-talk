export type WhatsAppDisplayName = {
  verifiedName: string | null;
  nameStatus: string | null;
  requestedName: string | null;
  requestedNameStatus: string | null;
};

export function validateWhatsAppDisplayName(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error('Informe o novo nome de exibição.');
  const name = value.trim();
  if (name.length > 512) throw new Error('O nome deve ter no máximo 512 caracteres.');
  if (/[\u0000-\u001f\u007f]/.test(name)) throw new Error('O nome não pode conter quebras de linha ou caracteres de controle.');
  return name;
}

export function displayNameStatusLabel(status: string | null): string {
  const labels: Record<string, string> = {
    APPROVED: 'Aprovado', AVAILABLE_WITHOUT_REVIEW: 'Disponível sem análise',
    DECLINED: 'Reprovado', PENDING_REVIEW: 'Em análise', EXPIRED: 'Certificado expirado', NONE: 'Sem certificado',
  };
  return status ? labels[status] || status : 'Não informado pela Meta';
}
