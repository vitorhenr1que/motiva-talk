import assert from 'node:assert/strict'
import test from 'node:test'
import { getBulkDeliveryError, getBulkDeliveryState } from './bulk-message-delivery'

test('classifica estados assíncronos da Meta', () => {
  assert.equal(getBulkDeliveryState({ sendStatus: 'sending' }), 'pending')
  assert.equal(getBulkDeliveryState({ sendStatus: 'sent', metadata: { deliveryStatus: 'delivered' } }), 'confirmed')
  assert.equal(getBulkDeliveryState({ sendStatus: 'failed', metadata: { deliveryStatus: 'failed' } }), 'failed')
})

test('transforma erro de pagamento da Meta em orientação acionável', () => {
  const actionUrl = 'https://business.facebook.com/billing_hub/example'
  const result = getBulkDeliveryError({
    errorMessage: 'raw error',
    metadata: { deliveryErrors: [{ code: 131042, href: actionUrl }] },
  })

  assert.equal(result.code, 131042)
  assert.equal(result.actionUrl, actionUrl)
  assert.match(result.message, /método de pagamento/i)
})

test('não repassa links externos arbitrários como ação', () => {
  const result = getBulkDeliveryError({
    metadata: { deliveryErrors: [{ code: 999, href: 'https://example.com/phishing', message: 'Falha específica' }] },
  })

  assert.equal(result.actionUrl, undefined)
  assert.equal(result.message, 'Falha específica')
})
