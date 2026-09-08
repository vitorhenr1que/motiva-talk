export type BulkRecipientCandidate = {
  id: string
  status: string
  contact: { id: string; phone: string } | null
  channel: unknown | null
  lastMessageAt?: string | null
  finalizedAt?: string | null
}

function timestamp(value?: string | null) {
  if (!value) return 0
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? 0 : parsed
}

/**
 * Mantém um único destino por contato. Conversas ativas têm precedência; quando
 * só existem conversas finalizadas, usa a mais recente em vez de excluí-las.
 */
export function selectBulkMessagingRecipients<T extends BulkRecipientCandidate>(
  conversations: T[]
): T[] {
  const ordered = [...conversations].sort((left, right) => {
    const leftActive = left.status === 'CLOSED' ? 0 : 1
    const rightActive = right.status === 'CLOSED' ? 0 : 1
    if (leftActive !== rightActive) return rightActive - leftActive

    const leftTime = timestamp(left.lastMessageAt) || timestamp(left.finalizedAt)
    const rightTime = timestamp(right.lastMessageAt) || timestamp(right.finalizedAt)
    return rightTime - leftTime
  })

  const uniqueByContact = new Map<string, T>()
  for (const conversation of ordered) {
    if (!conversation.contact || !conversation.channel) continue
    const contactKey = conversation.contact.id || conversation.contact.phone
    if (!uniqueByContact.has(contactKey)) uniqueByContact.set(contactKey, conversation)
  }

  return Array.from(uniqueByContact.values())
}
