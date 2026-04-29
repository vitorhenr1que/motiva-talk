# Testes manuais — webhook Evolution multi-tenant

Roteiros para validar o isolamento de tenants no pipeline
`POST /api/webhooks/evolution → WebhookService → WebhookIngestionService`.

## Pré-requisitos

- Duas organizações no banco (`Org A` e `Org B`) com `Channel` ativo cada uma.
- Cada Channel tem `providerSessionId` único (ex.: `instance-org-a`, `instance-org-b`)
  registrado na Evolution API com webhook apontando para
  `${EVOLUTION_WEBHOOK_URL}` (ou `${NEXT_PUBLIC_APP_URL}/api/webhooks/evolution`).
- Tabelas envolvidas têm `organizationId` populado:
  `Channel`, `Contact`, `Conversation`, `Message`, `auto_reply_settings`,
  `contact_auto_replies`.
- Bucket `chat-media` no Supabase Storage existente.

Variáveis úteis para inspeção rápida:

```sql
-- IDs do canal de cada org
SELECT id, "organizationId", "providerSessionId", name
FROM "Channel"
WHERE "providerSessionId" IN ('instance-org-a', 'instance-org-b');
```

## 1. Mensagem da instância A cai apenas na Org A

1. Pelo WhatsApp, envie uma mensagem de texto para o número do `Channel A`.
2. Confirme no log do servidor:
   ```
   [WEBHOOK_TRACE] Tenant resolvido: org=<orgA> channel=<chanA> provider=evolution
   [INGEST] 1. Canal validado: <name> (<chanA>) org=<orgA>
   [INGEST] Mensagem persistida id=<msgId> hasMedia=false
   ```
3. Verifique no banco:
   ```sql
   SELECT "organizationId", "channelId", content, "createdAt"
   FROM "Message"
   ORDER BY "createdAt" DESC LIMIT 1;
   ```
   - `organizationId` = Org A
   - `channelId` = Channel A
4. Confirme que **nada** foi inserido em Org B:
   ```sql
   SELECT COUNT(*) FROM "Message"
   WHERE "organizationId" = '<orgB>' AND "createdAt" > now() - interval '5 min';
   ```
   Deve retornar 0.

## 2. Mensagem da instância B cai apenas na Org B

Repetir o passo 1 usando o número do `Channel B` e confirmar que `organizationId`
da nova `Message` é `orgB` e `channelId` é `chanB`. Inverso ao teste 1.

## 3. Reply / quoted message não vaza entre tenants

1. Envie uma mensagem na Org A e anote o `externalMessageId` retornado.
2. Crie manualmente uma mensagem com o **mesmo externalMessageId** na Org B:
   ```sql
   INSERT INTO "Message" (id, "organizationId", "conversationId", "channelId",
     "senderType", content, type, "externalMessageId", "createdAt")
   VALUES (gen_random_uuid()::text, '<orgB>', '<convB>', '<chanB>',
     'USER', 'isca', 'TEXT', '<externalIdReplicado>', now());
   ```
3. Pelo WhatsApp da Org A, responda (reply) à mensagem original.
4. Esperado nos logs:
   ```
   [WEBHOOK_DEBUG] Mensagem original encontrada! Original DB ID: <idDaMsgA>
   ```
   `replyToMessageId` da nova mensagem deve apontar para a mensagem **da Org A**,
   nunca da Org B.

## 4. Mídia vai para o caminho correto no Storage

1. Envie uma imagem/áudio pelo WhatsApp para o Channel A.
2. Verifique no log:
   ```
   [INGEST] Upload Storage path=<orgA>/<chanA>/<msgId>/<random>.<ext>
   ```
3. No painel do Supabase, confirme que o arquivo está em
   `chat-media/<orgA>/<chanA>/<msgId>/...`.
4. Repita para Channel B e confirme prefixo `<orgB>/<chanB>/...`.

## 5. Auto-reply respeita organização

1. Configure `auto_reply_settings.enabled=true` apenas para o Channel A:
   ```sql
   INSERT INTO auto_reply_settings ("organizationId", "channelId", enabled, message, "cooldownHours")
   VALUES ('<orgA>', '<chanA>', true, 'Olá da Org A', 24);
   ```
2. Envie mensagem de cliente novo para o Channel A → deve receber auto-reply.
3. Envie para o Channel B → **não** deve receber auto-reply (config não existe na Org B).
4. Inspecione `contact_auto_replies`:
   ```sql
   SELECT "organizationId", "contactId", "channelId", "lastAutoReplyAt"
   FROM contact_auto_replies ORDER BY "lastAutoReplyAt" DESC LIMIT 5;
   ```
   Apenas registros de Org A.

## 6. Instância desconhecida → 404 controlado

```bash
curl -i -X POST http://localhost:3000/api/webhooks/evolution \
  -H 'Content-Type: application/json' \
  -d '{"event":"messages.upsert","instance":"instancia-inexistente","data":{}}'
```

Esperado:

- HTTP **404**
- Body: `{ "success": false, "message": "Canal não encontrado para a instância informada" }`
- Log:
  ```
  [WEBHOOK_TRACE] Canal não encontrado para instance="instancia-inexistente". Evento descartado.
  ```
- Nenhum `Message`/`Conversation` criado em qualquer organização.

## 7. organizationId no payload é ignorado

Mesmo se o emissor injetar `organizationId` no body, ele **não** deve ser usado.

```bash
curl -X POST http://localhost:3000/api/webhooks/evolution \
  -H 'Content-Type: application/json' \
  -d '{
    "event":"messages.upsert",
    "instance":"instance-org-a",
    "organizationId":"<orgB>",
    "data":{ "key":{"id":"abc","fromMe":false,"remoteJid":"5511999999999@s.whatsapp.net"},
             "message":{"conversation":"hi"},
             "messageTimestamp": '"$(date +%s)"',
             "pushName":"Teste" }
  }'
```

A mensagem precisa cair em **Org A** (do Channel resolvido), nunca em Org B.

## 8. Logs não vazam segredos

Procure no console por:

```
EVOLUTION_API_KEY
SUPABASE_SERVICE_ROLE_KEY
sb-access-token
Bearer
apikey:
```

Nenhuma dessas chaves deve aparecer nos logs do webhook. `org=` e `channel=`
são esperados.

## Limpeza

```sql
DELETE FROM "Message" WHERE "createdAt" > now() - interval '1 hour';
DELETE FROM "Conversation" WHERE "createdAt" > now() - interval '1 hour';
DELETE FROM contact_auto_replies WHERE "lastAutoReplyAt" > now() - interval '1 hour';
DELETE FROM auto_reply_settings WHERE message = 'Olá da Org A';
```

E remova arquivos de teste do bucket `chat-media`.
