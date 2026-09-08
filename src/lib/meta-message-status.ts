export type MetaMessageStatus = 'sent' | 'delivered' | 'read' | 'failed' | 'deleted' | string

export type MetaMessageStatusPayload = {
  id?: string
  status?: MetaMessageStatus
  timestamp?: string
  errors?: Array<{
    title?: string
    message?: string
    error_data?: { details?: string }
    [key: string]: unknown
  }>
  [key: string]: unknown
}

export function toMessageSendStatus(status: MetaMessageStatus) {
  return status === 'failed' ? 'failed' : 'sent'
}

export function getMetaMessageError(status: MetaMessageStatusPayload): string | null {
  if (status?.status !== 'failed') return null
  const error = Array.isArray(status.errors) ? status.errors[0] : null
  return error?.error_data?.details || error?.message || error?.title || 'A Meta informou falha na entrega.'
}

const DELIVERY_RANK: Record<string, number> = {
  sent: 1,
  delivered: 2,
  read: 3,
  failed: 4,
}

export function shouldApplyMetaMessageStatus(currentStatus: string | undefined, nextStatus: string) {
  if (!currentStatus) return true
  return (DELIVERY_RANK[nextStatus] || 0) >= (DELIVERY_RANK[currentStatus] || 0)
}
