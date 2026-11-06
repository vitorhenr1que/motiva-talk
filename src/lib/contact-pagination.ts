export const CONTACT_PAGE_SIZE = 30;

export interface ContactListItem {
  id: string;
  name: string;
  phone: string;
  tags?: { id: string; name: string }[];
}

export interface ContactPage {
  data: ContactListItem[];
  nextCursor: string | null;
}

export interface ContactCursor {
  name: string;
  id: string;
  search: string;
}

export function normalizeContactSearch(value: string): string {
  const search = value.trim();
  return search.length >= 2 ? search : '';
}

// Treat user input as a literal substring, including SQL wildcard characters.
export function escapeContactSearch(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&');
}

// These two helpers are used only by the server repository/API.
export function encodeContactCursor(cursor: ContactCursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

export function decodeContactCursor(value: string, search: string): ContactCursor {
  try {
    if (value.length > 16384 || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error();
    const cursor = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    if (typeof cursor?.name !== 'string' || typeof cursor?.id !== 'string' ||
        !cursor.id || cursor.search !== search) throw new Error();
    return { name: cursor.name, id: cursor.id, search };
  } catch {
    throw new Error('Cursor de contatos inválido.');
  }
}

export function buildContactPage(rows: ContactListItem[], search: string): ContactPage {
  const data = rows.slice(0, CONTACT_PAGE_SIZE);
  const last = data.at(-1);
  return {
    data,
    nextCursor: rows.length > CONTACT_PAGE_SIZE && last
      ? encodeContactCursor({ name: last.name, id: last.id, search })
      : null,
  };
}
