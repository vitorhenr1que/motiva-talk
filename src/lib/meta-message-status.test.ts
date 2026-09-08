import assert from 'node:assert/strict'
import test from 'node:test'
import { getMetaMessageError, shouldApplyMetaMessageStatus, toMessageSendStatus } from './meta-message-status'

test('mapeia confirmação e falha da Meta para o status interno', () => {
  assert.equal(toMessageSendStatus('delivered'), 'sent')
  assert.equal(toMessageSendStatus('read'), 'sent')
  assert.equal(toMessageSendStatus('failed'), 'failed')
})

test('extrai o detalhe de falha e impede regressão de read para sent', () => {
  assert.equal(getMetaMessageError({
    status: 'failed',
    errors: [{ error_data: { details: 'Número não está no WhatsApp.' } }],
  }), 'Número não está no WhatsApp.')
  assert.equal(shouldApplyMetaMessageStatus('read', 'sent'), false)
  assert.equal(shouldApplyMetaMessageStatus('sent', 'delivered'), true)
})
