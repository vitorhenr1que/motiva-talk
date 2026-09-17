-- Evaluate immutable request claims once per statement instead of once per row.
alter policy "WhatsAppTemplate tenant select"
on public."WhatsAppTemplate"
using (
  exists (
    select 1
    from public."User" u
    where u.email = ((select auth.jwt()) ->> 'email')
      and u."organizationId" = "WhatsAppTemplate"."organizationId"
  )
);

alter policy "WhatsAppTemplate tenant insert"
on public."WhatsAppTemplate"
with check (
  exists (
    select 1
    from public."User" u
    where u.email = ((select auth.jwt()) ->> 'email')
      and u."organizationId" = "WhatsAppTemplate"."organizationId"
  )
  and exists (
    select 1
    from public."Channel" c
    where c.id = "WhatsAppTemplate"."channelId"
      and c."organizationId" = "WhatsAppTemplate"."organizationId"
      and c."whatsappProvider" = 'META_CLOUD'
  )
);

alter policy "WhatsAppTemplate tenant update"
on public."WhatsAppTemplate"
using (
  exists (
    select 1
    from public."User" u
    where u.email = ((select auth.jwt()) ->> 'email')
      and u."organizationId" = "WhatsAppTemplate"."organizationId"
  )
)
with check (
  exists (
    select 1
    from public."User" u
    where u.email = ((select auth.jwt()) ->> 'email')
      and u."organizationId" = "WhatsAppTemplate"."organizationId"
  )
  and exists (
    select 1
    from public."Channel" c
    where c.id = "WhatsAppTemplate"."channelId"
      and c."organizationId" = "WhatsAppTemplate"."organizationId"
      and c."whatsappProvider" = 'META_CLOUD'
  )
);

alter policy "WhatsAppTemplate tenant delete"
on public."WhatsAppTemplate"
using (
  exists (
    select 1
    from public."User" u
    where u.email = ((select auth.jwt()) ->> 'email')
      and u."organizationId" = "WhatsAppTemplate"."organizationId"
  )
);
