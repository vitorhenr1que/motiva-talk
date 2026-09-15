alter table public."ChatSetting"
  add column if not exists "allowAgentCreateTemplate" boolean not null default false;
