# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Motiva Talk — multichannel CRM/support inbox for educational institutions. UI language is Portuguese (pt-BR); most code comments and log prefixes are also in Portuguese.

Stack: Next.js 16 (App Router) + React 19 + TypeScript, Supabase (Postgres + Auth + Realtime), Zustand, Tailwind CSS v4. WhatsApp integration via Evolution API.

## Commands

```bash
npm run dev      # next dev
npm run build    # next build
npm run start    # next start
npm run lint     # eslint (flat config in eslint.config.mjs)
```

No test runner is configured. `package.json` declares a `prisma.seed` script (`tsx prisma/seed.ts`) but there is no `prisma/` directory — schema lives in Supabase and is accessed directly via `supabase-js`.

Path alias: `@/*` → `./src/*`.

## Environment variables

Required at runtime (read directly in `src/lib/*` — no central config module):

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — client + middleware + server token verification
- `SUPABASE_SERVICE_ROLE_KEY` — server-only, used by `supabase-admin.ts` for every repository call
- `EVOLUTION_API_URL`, `EVOLUTION_API_KEY` — WhatsApp provider
- `NEXT_PUBLIC_APP_URL` — public base URL used to build feedback links sent on conversation close

## Architecture

### Layering (strict, do not skip layers)

`src/app/api/*/route.ts` → `src/services/*` → `src/repositories/*` → Supabase

- **Repositories** are the *only* place that calls `supabaseAdmin`. They return plain rows with joined relations (e.g. `contact:Contact(...)`, `channel:Channel(...)`, `tags:ConversationTag(tag:Tag(...))`).
- **Services** hold business logic and cross-entity orchestration (e.g. `ConversationService.updateStatus` closes the conversation *and* triggers feedback link generation + auto-send via `MessageService`).
- **API routes** handle auth/RBAC, validation, and error shaping. Every route uses `handleApiError(error, req, { route })` from `src/lib/api-errors.ts` and throws `AppError(message, statusCode, type)` for known failures. Use `validateBody(body, [...requiredFields])` for required-field checks. Routes set `export const dynamic = 'force-dynamic'`.

### Two Supabase clients — pick the right one

- `src/lib/supabase.ts` — anon client for the browser and realtime subscriptions.
- `src/lib/supabase-admin.ts` — service-role client; **server-only**. All repositories use this; importing it into a client component leaks the service key.
- `src/lib/auth-server.ts` — `getServerSession()` reads the `sb-access-token` cookie and verifies via the anon client; `getUserRole(email)` loads the `User.role` via the admin client.

### Auth & RBAC

- Middleware (`src/middleware.ts`) gates everything except `/login`, `/api/auth/session`, `/api/webhooks/*`, `/api/public/*`, `/feedback/*`, and static assets. Missing `sb-access-token` → 401 for `/api/*`, redirect to `/login?redirect=<path>` for pages.
- Session cookie is set/cleared via `POST /api/auth/session` and `DELETE /api/auth/session` — the client calls these after `supabase.auth.signIn` completes so the server has an httpOnly copy.
- Roles: `ADMIN | SUPERVISOR | AGENT`. AGENT filtering in `ConversationRepository.findMany` limits to conversations in channels from the `UserChannel` junction AND (`assignedTo = me` OR `assignedTo IS NULL`). `GET /api/conversations` builds this filter; replicate the same shape (`allowedChannelIds` + `currentUserId`) if you add new list endpoints.

### Inbox state (Zustand — `src/store/useChatStore.ts`)

Conversations are **not** stored in a single flat list. The store maintains three tabs (`unread` / `in_progress` / `closed`), each with its own `list`, `hasMore`, `loading`, `initialized` flags, plus a `tabCounts` map. Several invariants are enforced inside the store — respect them instead of duplicating logic in components:

- `markAsRead` auto-promotes `OPEN → IN_PROGRESS`, moves the conversation between tabs, decrements/increments counts, PATCHes the server, and auto-switches `activeTab` to `in_progress`.
- `addMessage` does optimistic sidebar updates: finds the conversation across all three tabs, rewrites the preview (emoji per `MessageType`), bumps `unreadCount` only when the message is from `USER` and the conversation isn't active, and when an AGENT replies to an `OPEN` conversation it promotes to `IN_PROGRESS` and fires a PATCH.
- `addMessage` also replaces optimistic `temp-*` messages by matching `senderType === 'AGENT'` + trimmed content + `conversationId`.
- Sort order (used by `sortConversations`): `pinnedAt DESC NULLS LAST`, then `lastMessageAt DESC`, then `id DESC`. The cursor pagination in `ConversationRepository.findMany` mirrors this exactly — changing one without the other will break pagination.

### Realtime

`useRealtimeInbox` (in `src/hooks/`) owns two Supabase realtime channels:

1. `sidebar:<channelId>` — `postgres_changes` on `Conversation` filtered by `channelId`. Dispatches to `upsertConversationLocally` / `removeConversationLocally`.
2. `active_chat:<conversationId>` — `postgres_changes` INSERT on `Message` for the active conversation, plus a `broadcast` `message:new` channel for lower-latency UX.

This hook is the single subscription source — do not add ad-hoc `supabase.channel(...)` calls in components.

### WhatsApp provider abstraction

`src/services/whatsapp/provider.ts` defines `WhatsAppProvider` (createSession / getQrCode / sendMessage / parseIncomingWebhook / ...) and the normalized `WebhookEvent` shape. `evolution-provider.ts` is the only implementation today; if you add another provider, implement the same interface and keep status mapping in `mapStatus` (maps Evolution's `open|qrcode|close|...` to internal `CONNECTED|QR_CODE|DISCONNECTED|ERROR|PENDING`).

Webhook pipeline: `POST /api/webhooks/evolution` → `evolutionProvider.parseIncomingWebhook(body)` (normalizes to `WebhookEvent`) → `WebhookService.processEvent` → dispatches on `event.type` (`CONNECTION` updates `Channel.connectionStatus`; `MESSAGE` resolves quoted-reply external IDs to internal message IDs, then delegates to `WebhookIngestionService.ingestMessage`).

### Conversation lifecycle side effects

`ConversationService.updateStatus(id, 'CLOSED')` is *not* a plain status update — it also:
1. calls `FeedbackService.requestFeedback` to mint a public token,
2. reads `ChatSetting.finishMessage` via `SettingRepository`,
3. builds `${NEXT_PUBLIC_APP_URL}/feedback/<token>` and sends it as a `SYSTEM` message via `MessageService.createMessage` (which delivers through Evolution API).

If you add new close paths, either reuse this service method or replicate the side effects — the front end does not do this.

### Dashboard layout data

`src/app/(dashboard)/layout.tsx` is a server component that hydrates the client shell (`DashboardClientLayout`) with `user`, `role`, and `agentMenuVisibility` from `ChatSetting`. The visibility map (`conversations/funnel/reports/channels/contacts/suggestions/settings`) controls what AGENT role sees in the sidebar — gate new AGENT-facing menu items here.

### Error / response shape

Success: `{ success: true, data?, message? }`. Error: `ApiErrorResponse` from `handleApiError` — `success: false`, `message` (user-safe), plus `error`/`details`/`stack` only in development. Prisma/Postgres unique-violation codes (`P2002`, `23505`) are auto-mapped to 409; `42P01` → "Tabela não encontrada".

## Conventions

- IDs are generated by `generateId()` from `src/lib/utils.ts` — pass it explicitly on `insert` (see `ConversationRepository.create`); do not rely on Postgres defaults.
- When updating a conversation, re-select with the full relation tree (`contact:Contact(*), channel:Channel(*), agent:User(*), tags:ConversationTag(*, tag:Tag(*))`) so the store receives the denormalized shape it expects.
- Console logs use bracketed prefixes (`[API]`, `[WEBHOOK_TRACE]`, `[EVO_PROVIDER]`, `[CONVERSA]`, `[FEEDBACK]`) — follow the same scheme so log grepping stays consistent.
