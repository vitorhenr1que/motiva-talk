import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { getContactPhoneVariants } from '@/lib/contact-phone';

// Os testes usam apenas o cliente simulado, sem credenciais ou acesso ao banco.
process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test-key';
const modules = Promise.all([
  import('@/lib/supabase-admin'),
  import('@/repositories/contactRepository'),
  import('@/repositories/conversationRepository'),
]);

type Row = Record<string, any>;
function mockDatabase(t: TestContext, client: any, tables: Record<string, Row[]>, failure?: string) {
  t.mock.method(client, 'from', (table: string) => {
    const filters: Array<(row: Row) => boolean> = [];
    const orders: Array<{ field: string; ascending: boolean }> = [];
    let limit = Infinity;
    const result = () => {
      if (table === failure) return { data: null, error: new Error('database unavailable') };
      const rows = (tables[table] || []).filter(row => filters.every(filter => filter(row)));
      rows.sort((a, b) => {
        for (const { field, ascending } of orders) {
          if (a[field] === b[field]) continue;
          if (a[field] == null) return 1;
          if (b[field] == null) return -1;
          return (a[field] > b[field] ? 1 : -1) * (ascending ? 1 : -1);
        }
        return 0;
      });
      return { data: rows.slice(0, limit), error: null };
    };
    const query: any = {
      select: () => query,
      eq: (field: string, value: unknown) => { filters.push(row => row[field] === value); return query; },
      in: (field: string, values: unknown[]) => { filters.push(row => values.includes(row[field])); return query; },
      order: (field: string, options: { ascending: boolean }) => { orders.push({ field, ...options }); return query; },
      limit: (value: number) => { limit = value; return query; },
      maybeSingle: async () => { const response = result(); return { ...response, data: response.data?.[0] || null }; },
      then: (resolve: any, reject: any) => Promise.resolve(result()).then(resolve, reject),
    };
    return query;
  });
}

const contacts = [
  { id: 'old-contact', organizationId: 'org', phone: '557398765432', name: 'Pedro' },
  { id: 'template-contact', organizationId: 'org', phone: '5573998765432', name: 'PEDRO' },
  { id: 'other-org-contact', organizationId: 'other-org', phone: '557398765432' },
];
const conversations = [
  { id: 'old-conversation', contactId: 'old-contact', organizationId: 'org', channelId: 'channel', lastMessageAt: '2026-10-09T14:00:00Z' },
  { id: 'template-conversation', contactId: 'template-contact', organizationId: 'org', channelId: 'channel', lastMessageAt: '2026-10-09T14:32:00Z' },
  { id: 'other-channel', contactId: 'old-contact', organizationId: 'org', channelId: 'other-channel', lastMessageAt: '2026-10-09T15:00:00Z' },
  { id: 'other-org', contactId: 'old-contact', organizationId: 'other-org', channelId: 'channel', lastMessageAt: '2026-10-09T16:00:00Z' },
];

test('recognizes both Brazilian mobile forms without conflating landlines or foreign numbers', () => {
  assert.deepEqual(getContactPhoneVariants('557398765432'), ['557398765432', '5573998765432']);
  assert.deepEqual(getContactPhoneVariants('5573998765432'), ['5573998765432', '557398765432']);
  assert.ok(getContactPhoneVariants('+55 (73) 99876-5432').includes('557398765432'));
  for (const phone of ['557332345678', '14155552671', '5599123456789']) {
    assert.deepEqual(getContactPhoneVariants(phone), [phone]);
  }
});

test('a plain reply reuses the template conversation across ninth-digit contact duplicates', async (t) => {
  const [{ supabaseAdmin }, { ContactRepository }, { ConversationRepository }] = await modules;
  mockDatabase(t, supabaseAdmin, { Contact: contacts, Conversation: conversations });
  const matches = await ContactRepository.findAllByPhone('557398765432', 'org');
  assert.equal(matches.length, 2);
  const conversation = await ConversationRepository.findForIncomingMessage(matches.map(contact => contact.id), 'org', 'channel');
  assert.equal(conversation?.id, 'template-conversation');
});

test('a quoted template reply stays in its original conversation even if another duplicate is newer', async (t) => {
  const [{ supabaseAdmin }, , { ConversationRepository }] = await modules;
  mockDatabase(t, supabaseAdmin, {
    Conversation: conversations.map(row => row.id === 'old-conversation' ? { ...row, lastMessageAt: '2026-10-09T18:00:00Z' } : row),
    Message: [{ id: 'template-message', organizationId: 'org', channelId: 'channel', conversationId: 'template-conversation' }],
  });
  const conversation = await ConversationRepository.findForIncomingMessage(['old-contact', 'template-contact'], 'org', 'channel', 'template-message');
  assert.equal(conversation?.id, 'template-conversation');
});

test('reply context cannot route to another organization, channel or contact', async (t) => {
  const [{ supabaseAdmin }, , { ConversationRepository }] = await modules;
  mockDatabase(t, supabaseAdmin, {
    Conversation: [...conversations, { id: 'unrelated', contactId: 'unrelated-contact', organizationId: 'org', channelId: 'channel' }],
    Message: [
      { id: 'wrong-org', organizationId: 'other-org', channelId: 'channel', conversationId: 'other-org' },
      { id: 'wrong-channel', organizationId: 'org', channelId: 'other-channel', conversationId: 'other-channel' },
      { id: 'wrong-contact', organizationId: 'org', channelId: 'channel', conversationId: 'unrelated' },
    ],
  });
  for (const quotedId of ['wrong-org', 'wrong-channel', 'wrong-contact', 'missing']) {
    const conversation = await ConversationRepository.findForIncomingMessage(['old-contact', 'template-contact'], 'org', 'channel', quotedId);
    assert.equal(conversation?.id, 'template-conversation');
  }
});

test('an equivalent existing contact is reused instead of creating a second contact', async (t) => {
  const [{ supabaseAdmin }, { ContactRepository }] = await modules;
  mockDatabase(t, supabaseAdmin, { Contact: [contacts[1]] });
  t.mock.method(ContactRepository, 'create', async () => { throw new Error('must not create'); });
  const contact = await ContactRepository.findOrCreateByPhone('557398765432', 'Pedro', 'org');
  assert.equal(contact.id, 'template-contact');
});

test('database failures propagate instead of being mistaken for a missing conversation', async (t) => {
  const [{ supabaseAdmin }, , { ConversationRepository }] = await modules;
  mockDatabase(t, supabaseAdmin, {}, 'Conversation');
  await assert.rejects(ConversationRepository.findForIncomingMessage(['old-contact'], 'org', 'channel'), /database unavailable/);
});

test('a finalized template conversation is found for reopening with its original ID', async (t) => {
  const [{ supabaseAdmin }, , { ConversationRepository }] = await modules;
  mockDatabase(t, supabaseAdmin, {
    Conversation: [{ ...conversations[1], status: 'CLOSED', conversationWindowStartedAt: null }],
  });
  const conversation = await ConversationRepository.findForIncomingMessage(['old-contact', 'template-contact'], 'org', 'channel');
  assert.equal(conversation?.id, 'template-conversation');
  assert.equal(conversation?.status, 'CLOSED');
});

test('an unknown phone has no matching conversation and contact lookup failures are not ignored', async (t) => {
  const [{ supabaseAdmin }, { ContactRepository }, { ConversationRepository }] = await modules;
  mockDatabase(t, supabaseAdmin, {}, 'Contact');
  assert.equal(await ConversationRepository.findForIncomingMessage([], 'org', 'channel'), null);
  await assert.rejects(ContactRepository.findOrCreateByPhone('557398765432', 'Pedro', 'org'), /database unavailable/);
});
