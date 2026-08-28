alter table public.auto_reply_settings
  add column if not exists "scheduleEnabled" boolean not null default false,
  add column if not exists "businessHours" jsonb not null default '{
    "monday": {"enabled": true, "start": "08:00", "end": "18:00"},
    "tuesday": {"enabled": true, "start": "08:00", "end": "18:00"},
    "wednesday": {"enabled": true, "start": "08:00", "end": "18:00"},
    "thursday": {"enabled": true, "start": "08:00", "end": "18:00"},
    "friday": {"enabled": true, "start": "08:00", "end": "18:00"},
    "saturday": {"enabled": true, "start": "08:00", "end": "12:00"},
    "sunday": {"enabled": false, "start": "08:00", "end": "18:00"}
  }'::jsonb,
  add column if not exists "outsideHoursEnabled" boolean not null default false,
  add column if not exists "outsideHoursMessage" text,
  add column if not exists "recessEnabled" boolean not null default false,
  add column if not exists "recessStart" date,
  add column if not exists "recessEnd" date,
  add column if not exists "recessMessage" text,
  add column if not exists timezone text not null default 'America/Sao_Paulo';

alter table public.auto_reply_settings
  add constraint auto_reply_settings_recess_dates_check
  check (
    "recessStart" is null
    or "recessEnd" is null
    or "recessEnd" >= "recessStart"
  );
