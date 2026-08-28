import assert from 'node:assert/strict';
import test from 'node:test';
import { decideAutoReply, validateAutoReplySettings } from './auto-reply-policy';
import { normalizeAutoReplySettings } from '@/types/auto-reply';

const base = normalizeAutoReplySettings({
  enabled: true,
  message: 'Mensagem padrão',
  scheduleEnabled: true,
  outsideHoursEnabled: true,
  outsideHoursMessage: 'Fora do horário',
  timezone: 'America/Sao_Paulo',
});

const atSaoPaulo = (isoLocal: string) => new Date(`${isoLocal}-03:00`);

test('usa a mensagem padrão nos limites e dentro do horário de segunda-feira', () => {
  for (const time of ['08:00', '10:00', '18:00']) {
    assert.deepEqual(decideAutoReply(base, atSaoPaulo(`2026-08-24T${time}:00`)), {
      message: 'Mensagem padrão', reason: 'standard',
    });
  }
});

test('usa fora do horário antes e depois do expediente de segunda-feira', () => {
  for (const time of ['07:59', '18:01']) {
    assert.deepEqual(decideAutoReply(base, atSaoPaulo(`2026-08-24T${time}:00`)), {
      message: 'Fora do horário', reason: 'outside_hours',
    });
  }
});

test('aplica o horário específico de sábado e bloqueia domingo', () => {
  for (const time of ['08:00', '10:00', '12:00']) {
    assert.equal(decideAutoReply(base, atSaoPaulo(`2026-08-29T${time}:00`)).reason, 'standard');
  }
  assert.equal(decideAutoReply(base, atSaoPaulo('2026-08-29T12:01:00')).reason, 'outside_hours');
  assert.equal(decideAutoReply(base, atSaoPaulo('2026-08-30T10:00:00')).reason, 'outside_hours');
});

test('considera início e fim do recesso inclusivos e retorna ao normal no dia seguinte', () => {
  const settings = { ...base, recessEnabled: true, recessStart: '2026-12-20', recessEnd: '2027-01-05', recessMessage: 'Recesso' };
  assert.notEqual(decideAutoReply(settings, atSaoPaulo('2026-12-19T10:00:00')).reason, 'recess');
  assert.equal(decideAutoReply(settings, atSaoPaulo('2026-12-20T00:00:00')).reason, 'recess');
  assert.equal(decideAutoReply(settings, atSaoPaulo('2026-12-28T10:00:00')).reason, 'recess');
  assert.equal(decideAutoReply(settings, atSaoPaulo('2027-01-05T23:59:00')).reason, 'recess');
  assert.notEqual(decideAutoReply(settings, atSaoPaulo('2027-01-06T10:00:00')).reason, 'recess');
});

test('recesso tem prioridade sobre horário normal e fora do horário', () => {
  const settings = { ...base, recessEnabled: true, recessStart: '2026-08-24', recessEnd: '2026-08-24', recessMessage: 'Recesso' };
  assert.equal(decideAutoReply(settings, atSaoPaulo('2026-08-24T10:00:00')).reason, 'recess');
  assert.equal(decideAutoReply(settings, atSaoPaulo('2026-08-24T22:00:00')).reason, 'recess');
});

test('sem novas configurações preserva o comportamento antigo em qualquer horário', () => {
  const legacy = { enabled: true, message: 'Legada', cooldownHours: 24 };
  assert.deepEqual(decideAutoReply(legacy, atSaoPaulo('2026-08-30T03:00:00')), {
    message: 'Legada', reason: 'standard',
  });
});

test('sem mensagem fora do horário ativa faz fallback seguro para a padrão', () => {
  const settings = { ...base, outsideHoursEnabled: false, outsideHoursMessage: '' };
  assert.equal(decideAutoReply(settings, atSaoPaulo('2026-08-30T10:00:00')).reason, 'standard');
});

test('respeita o timezone configurado ao determinar dia e hora', () => {
  const settings = { ...base, timezone: 'America/Manaus' };
  const instant = new Date('2026-08-24T11:30:00Z'); // 07:30 em Manaus
  assert.equal(decideAutoReply(settings, instant).reason, 'outside_hours');
});

test('valida datas, horários, mensagens e timezone inválidos', () => {
  const validation = validateAutoReplySettings({
    ...base,
    timezone: 'Timezone/Inexistente',
    businessHours: { ...base.businessHours, monday: { enabled: true, start: '18:00', end: '08:00' } },
    recessEnabled: true,
    recessStart: '2027-01-05',
    recessEnd: '2026-12-20',
    recessMessage: '',
  });
  assert.ok(validation.errors.length >= 4);
});
