type UnknownRecord = Record<string, unknown>;

export type WhatsAppContactCard = {
  fullName: string;
  wuid: string;
  phoneNumber: string;
  phoneType?: string;
};

function asRecord(value: unknown): UnknownRecord | undefined {
  return value !== null && typeof value === 'object' ? value as UnknownRecord : undefined;
}

function firstText(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}

export function getWhatsAppReplyContent(metadata: unknown): string | undefined {
  const message = asRecord(metadata);
  const messageType = String(message?.type || '').trim().toLowerCase();

  if (messageType === 'button') {
    const button = asRecord(message?.button);
    return firstText(button?.text, button?.payload);
  }

  if (messageType === 'interactive') {
    const interactive = asRecord(message?.interactive);
    const reply = asRecord(interactive?.button_reply) || asRecord(interactive?.list_reply);
    return firstText(reply?.title, reply?.id);
  }

  return undefined;
}

export function getWhatsAppContactCards(metadata: unknown): WhatsAppContactCard[] {
  const message = asRecord(metadata);
  const localContact = asRecord(message?.contact);

  if (localContact) {
    const phone = firstText(localContact.wuid, localContact.phoneNumber)?.replace(/\D/g, '') || '';
    if (!phone) return [];
    return [{
      fullName: firstText(localContact.fullName, localContact.name) || 'Sem nome',
      wuid: phone,
      phoneNumber: phone,
      phoneType: firstText(localContact.phoneType),
    }];
  }

  const rawContacts = Array.isArray(message?.contacts) ? message.contacts : [];
  return rawContacts.flatMap(rawContact => {
    const contact = asRecord(rawContact);
    const name = asRecord(contact?.name);
    const phones = Array.isArray(contact?.phones) ? contact.phones : [];
    const phone = asRecord(phones[0]);
    const number = firstText(phone?.wa_id, phone?.phone)?.replace(/\D/g, '') || '';
    if (!number) return [];

    return [{
      fullName: firstText(name?.formatted_name, name?.first_name) || 'Sem nome',
      wuid: number,
      phoneNumber: number,
      phoneType: firstText(phone?.type),
    }];
  });
}

export function normalizeStoredWhatsAppMessage<T extends {
  content?: string;
  type?: string;
  metadata?: unknown;
}>(message: T): T {
  const replyContent = getWhatsAppReplyContent(message.metadata);
  if (replyContent) {
    return {
      ...message,
      content: replyContent,
      type: 'TEXT',
    };
  }

  const metadataRecord = asRecord(message.metadata);
  const metadataType = String(metadataRecord?.type || '').trim().toLowerCase();
  const contacts = getWhatsAppContactCards(message.metadata);
  if (contacts.length && (metadataType === 'contacts' || metadataType === 'contact' || message.type === 'CONTACT')) {
    return {
      ...message,
      content: contacts.length === 1 ? `Contato: ${contacts[0].fullName}` : `${contacts.length} contatos`,
      type: 'CONTACT',
    };
  }

  return message;
}
