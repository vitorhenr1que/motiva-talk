export type BulkDeliveryState = 'pending' | 'confirmed' | 'failed'

type DeliveryMessage = {
  sendStatus?: string | null
  errorMessage?: string | null
  metadata?: {
    deliveryStatus?: string | null
    deliveryErrors?: Array<{
      code?: number
      href?: string
      title?: string
      message?: string
      error_data?: { details?: string }
    }>
  } | null
}

export function getBulkDeliveryState(message: DeliveryMessage): BulkDeliveryState {
  const deliveryStatus = String(message.metadata?.deliveryStatus || '').toLowerCase()
  const sendStatus = String(message.sendStatus || '').toLowerCase()

  if (deliveryStatus === 'failed' || sendStatus === 'failed') return 'failed'
  if (['sent', 'delivered', 'read'].includes(deliveryStatus) || sendStatus === 'sent') return 'confirmed'
  return 'pending'
}

export function getBulkDeliveryError(message: DeliveryMessage) {
  const metaError = message.metadata?.deliveryErrors?.[0]
  const code = typeof metaError?.code === 'number' ? metaError.code : undefined
  const actionUrl = typeof metaError?.href === 'string' && metaError.href.startsWith('https://business.facebook.com/')
    ? metaError.href
    : undefined

  if (code === 131042) {
    return {
      code,
      actionUrl,
      message: 'O método de pagamento da conta WhatsApp Business está inválido. Atualize o pagamento na Meta e tente novamente.',
    }
  }

  return {
    code,
    actionUrl,
    message: message.errorMessage
      || metaError?.error_data?.details
      || metaError?.message
      || metaError?.title
      || 'A Meta informou uma falha na entrega.',
  }
}
