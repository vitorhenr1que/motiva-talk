import {
  AutoReplySettings,
  BUSINESS_DAY_KEYS,
  BusinessDayKey,
  normalizeAutoReplySettings,
} from '@/types/auto-reply';

export type AutoReplyReason = 'disabled' | 'recess' | 'outside_hours' | 'standard';

export interface AutoReplyDecision {
  message: string | null;
  reason: AutoReplyReason;
}

const WEEKDAY_TO_KEY: Record<string, BusinessDayKey> = {
  Mon: 'monday', Tue: 'tuesday', Wed: 'wednesday', Thu: 'thursday',
  Fri: 'friday', Sat: 'saturday', Sun: 'sunday',
};
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function getLocalParts(date: Date, timezone: string) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone, weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  });
  const parts = Object.fromEntries(formatter.formatToParts(date)
    .filter(({ type }) => type !== 'literal').map(({ type, value }) => [type, value]));
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    day: WEEKDAY_TO_KEY[parts.weekday],
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

export function decideAutoReply(
  input: Partial<AutoReplySettings> | null | undefined,
  now = new Date()
): AutoReplyDecision {
  const settings = normalizeAutoReplySettings(input);
  const standardMessage = settings.message.trim();
  if (!settings.enabled || !standardMessage) return { message: null, reason: 'disabled' };

  const local = getLocalParts(now, settings.timezone);
  const recessMessage = settings.recessMessage.trim();
  if (settings.recessEnabled && settings.recessStart && settings.recessEnd && recessMessage &&
      local.date >= settings.recessStart && local.date <= settings.recessEnd) {
    return { message: recessMessage, reason: 'recess' };
  }

  if (settings.scheduleEnabled) {
    const schedule = settings.businessHours[local.day];
    const inside = schedule?.enabled && local.minutes >= timeToMinutes(schedule.start) &&
      local.minutes <= timeToMinutes(schedule.end);
    if (!inside) {
      const outsideMessage = settings.outsideHoursMessage.trim();
      if (settings.outsideHoursEnabled && outsideMessage) {
        return { message: outsideMessage, reason: 'outside_hours' };
      }
    }
  }
  return { message: standardMessage, reason: 'standard' };
}

export function validateAutoReplySettings(input: Partial<AutoReplySettings>) {
  const settings = normalizeAutoReplySettings(input);
  const errors: string[] = [];
  if (!Number.isInteger(settings.cooldownHours) || settings.cooldownHours < 0) {
    errors.push('O cooldown deve ser um número inteiro maior ou igual a zero.');
  }
  if (settings.enabled && !settings.message.trim()) {
    errors.push('Informe a mensagem padrão antes de ativar as mensagens automáticas.');
  }
  try {
    new Intl.DateTimeFormat('pt-BR', { timeZone: settings.timezone }).format();
  } catch {
    errors.push('Informe um timezone IANA válido.');
  }
  if (settings.scheduleEnabled) {
    for (const day of BUSINESS_DAY_KEYS) {
      const schedule = settings.businessHours[day];
      if (!schedule.enabled) continue;
      if (!TIME_PATTERN.test(schedule.start) || !TIME_PATTERN.test(schedule.end)) {
        errors.push(`Informe horários válidos para ${day}.`);
      } else if (timeToMinutes(schedule.end) <= timeToMinutes(schedule.start)) {
        errors.push(`O término deve ser posterior ao início em ${day}.`);
      }
    }
  }
  if (settings.outsideHoursEnabled && !settings.outsideHoursMessage.trim()) {
    errors.push('Informe a mensagem fora do horário antes de ativá-la.');
  }
  if (settings.recessEnabled) {
    if (!settings.recessStart || !settings.recessEnd || !DATE_PATTERN.test(settings.recessStart) ||
        !DATE_PATTERN.test(settings.recessEnd)) {
      errors.push('Informe as datas inicial e final do recesso.');
    } else if (settings.recessEnd < settings.recessStart) {
      errors.push('A data final do recesso não pode ser anterior à data inicial.');
    }
    if (!settings.recessMessage.trim()) {
      errors.push('Informe a mensagem de recesso antes de ativá-lo.');
    }
  }
  return { settings, errors };
}
