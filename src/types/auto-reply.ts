export const BUSINESS_DAY_KEYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

export type BusinessDayKey = (typeof BUSINESS_DAY_KEYS)[number];

export interface BusinessDaySchedule {
  enabled: boolean;
  start: string;
  end: string;
}

export type BusinessHours = Record<BusinessDayKey, BusinessDaySchedule>;

export interface AutoReplySettings {
  id?: string;
  organizationId?: string;
  channelId?: string;
  enabled: boolean;
  message: string;
  cooldownHours: number;
  scheduleEnabled: boolean;
  businessHours: BusinessHours;
  outsideHoursEnabled: boolean;
  outsideHoursMessage: string;
  recessEnabled: boolean;
  recessStart: string | null;
  recessEnd: string | null;
  recessMessage: string;
  timezone: string;
}

export const DEFAULT_BUSINESS_HOURS: BusinessHours = {
  monday: { enabled: true, start: '08:00', end: '18:00' },
  tuesday: { enabled: true, start: '08:00', end: '18:00' },
  wednesday: { enabled: true, start: '08:00', end: '18:00' },
  thursday: { enabled: true, start: '08:00', end: '18:00' },
  friday: { enabled: true, start: '08:00', end: '18:00' },
  saturday: { enabled: true, start: '08:00', end: '12:00' },
  sunday: { enabled: false, start: '08:00', end: '18:00' },
};

export const DEFAULT_AUTO_REPLY_SETTINGS: AutoReplySettings = {
  enabled: false,
  message: '',
  cooldownHours: 24,
  scheduleEnabled: false,
  businessHours: DEFAULT_BUSINESS_HOURS,
  outsideHoursEnabled: false,
  outsideHoursMessage: '',
  recessEnabled: false,
  recessStart: null,
  recessEnd: null,
  recessMessage: '',
  timezone: 'America/Sao_Paulo',
};

export function normalizeAutoReplySettings(
  value: Partial<AutoReplySettings> | null | undefined
): AutoReplySettings {
  const rawHours = value?.businessHours as Partial<BusinessHours> | undefined;
  const businessHours = BUSINESS_DAY_KEYS.reduce((result, day) => {
    result[day] = {
      ...DEFAULT_BUSINESS_HOURS[day],
      ...(rawHours?.[day] || {}),
    };
    return result;
  }, {} as BusinessHours);

  return {
    ...DEFAULT_AUTO_REPLY_SETTINGS,
    ...value,
    message: value?.message ?? '',
    outsideHoursMessage: value?.outsideHoursMessage ?? '',
    recessMessage: value?.recessMessage ?? '',
    recessStart: value?.recessStart ?? null,
    recessEnd: value?.recessEnd ?? null,
    businessHours,
  };
}
