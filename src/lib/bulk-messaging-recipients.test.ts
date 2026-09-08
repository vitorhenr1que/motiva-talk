import assert from 'node:assert/strict'
import test from 'node:test'
import { selectBulkMessagingRecipients } from './bulk-messaging-recipients'

const contact = { id: 'contact-1', phone: '5511999999999' }
const channel = { id: 'channel-1' }

test('inclui contato cuja única conversa está finalizada', () => {
  const recipients = selectBulkMessagingRecipients([{
    id: 'closed-1',
    status: 'CLOSED',
    contact,
    channel,
    lastMessageAt: '2026-09-01T12:00:00.000Z',
  }])

  assert.deepEqual(recipients.map(item => item.id), ['closed-1'])
})

test('prefere conversa ativa e usa a finalizada mais recente como fallback', () => {
  const recipients = selectBulkMessagingRecipients([
    { id: 'closed-old', status: 'CLOSED', contact, channel, lastMessageAt: '2026-08-01T12:00:00.000Z' },
    { id: 'closed-new', status: 'CLOSED', contact, channel, lastMessageAt: '2026-09-01T12:00:00.000Z' },
    { id: 'active', status: 'IN_PROGRESS', contact, channel, lastMessageAt: '2026-07-01T12:00:00.000Z' },
  ])

  assert.deepEqual(recipients.map(item => item.id), ['active'])

  const closedOnly = selectBulkMessagingRecipients([
    { id: 'closed-old', status: 'CLOSED', contact, channel, lastMessageAt: '2026-08-01T12:00:00.000Z' },
    { id: 'closed-new', status: 'CLOSED', contact, channel, lastMessageAt: '2026-09-01T12:00:00.000Z' },
  ])
  assert.deepEqual(closedOnly.map(item => item.id), ['closed-new'])
})
