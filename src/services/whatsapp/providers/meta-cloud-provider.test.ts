import assert from 'node:assert/strict';
import test from 'node:test';
import { AppError } from '@/lib/api-errors';
import { MAX_PROFILE_PHOTO_BYTES } from '@/lib/whatsapp-profile-photo';
import type { Channel } from '@/types/chat';
import { MetaCloudProvider } from './meta-cloud-provider';

const channel: Channel = {
  id: 'channel-1', name: 'Atendimento', phoneNumber: '5511999999999',
  isActive: true, createdAt: '2026-10-01', whatsappProvider: 'META_CLOUD',
  metaPhoneNumberId: 'phone-123', metaAccessToken: 'channel-token',
};
const png = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], 'photo.png', { type: 'image/png' });

test('uploads binary through the signed session and updates the business profile with its handle', async (t) => {
  const previousAppId = process.env.META_APP_ID;
  process.env.META_APP_ID = 'app-123';
  t.after(() => { if (previousAppId === undefined) delete process.env.META_APP_ID; else process.env.META_APP_ID = previousAppId; });
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const responses = [{ id: 'upload:session?sig=signature' }, { h: 'photo-handle' }, { success: true }];
  t.mock.method(globalThis, 'fetch', async (url: string, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return Response.json(responses[calls.length - 1]);
  });
  await new MetaCloudProvider().updateProfilePhoto(channel, png);
  assert.equal(calls.length, 3);
  const sessionUrl = new URL(calls[0].url);
  assert.ok(sessionUrl.pathname.endsWith('/app-123/uploads'));
  assert.equal(sessionUrl.searchParams.get('file_type'), 'image/png');
  assert.equal(sessionUrl.searchParams.get('file_length'), '8');
  assert.equal(sessionUrl.searchParams.has('access_token'), false);
  assert.equal(new Headers(calls[0].init?.headers).get('Authorization'), 'Bearer channel-token');
  assert.ok(calls[1].url.endsWith('/upload:session?sig=signature'));
  assert.equal(new Headers(calls[1].init?.headers).get('file_offset'), '0');
  assert.equal(new Headers(calls[1].init?.headers).get('Authorization'), 'OAuth channel-token');
  assert.deepEqual(new Uint8Array(calls[1].init?.body as ArrayBuffer), new Uint8Array(await png.arrayBuffer()));
  assert.ok(calls[2].url.endsWith('/phone-123/whatsapp_business_profile'));
  assert.deepEqual(JSON.parse(calls[2].init?.body as string), { messaging_product: 'whatsapp', profile_picture_handle: 'photo-handle' });
});

test('rejects invalid, empty, oversized or disguised files before calling Meta', async (t) => {
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => Response.json({}));
  const provider = new MetaCloudProvider();
  for (const file of [
    new File(['text'], 'image.svg', { type: 'image/svg+xml' }),
    new File([], 'image.jpg', { type: 'image/jpeg' }),
    new File([new Uint8Array(MAX_PROFILE_PHOTO_BYTES + 1)], 'image.jpg', { type: 'image/jpeg' }),
    new File(['not an image'], 'image.png', { type: 'image/png' }),
  ]) {
    await assert.rejects(provider.updateProfilePhoto(channel, file), (error: unknown) => error instanceof AppError && error.statusCode === 400);
  }
  assert.equal(fetchMock.mock.callCount(), 0);
});

test('does not change the profile when Meta rejects the upload or omits its handle', async (t) => {
  const previousAppId = process.env.META_APP_ID;
  process.env.META_APP_ID = 'app-123';
  t.after(() => { if (previousAppId === undefined) delete process.env.META_APP_ID; else process.env.META_APP_ID = previousAppId; });
  for (const uploadResponse of [Response.json({}), Response.json({ error: { message: 'Permission denied' } }, { status: 403 })]) {
    let count = 0;
    const fetchMock = t.mock.method(globalThis, 'fetch', async () => {
      count++;
      return count === 1 ? Response.json({ id: 'upload:session' }) : uploadResponse;
    });
    await assert.rejects(new MetaCloudProvider().updateProfilePhoto(channel, png), (error: unknown) => error instanceof AppError && error.statusCode === 502);
    assert.equal(fetchMock.mock.callCount(), 2);
    fetchMock.mock.restore();
  }
});

test('reads profile photo from both supported response envelopes without caching', async (t) => {
  const responses = [
    { data: [{ profile_picture_url: 'https://example.com/photo.jpg' }] },
    { data: [{ business_profile: { profile_picture_url: 'https://example.com/photo.jpg' } }] },
    { data: [{}] },
  ];
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => Response.json(responses.shift()));
  const provider = new MetaCloudProvider();
  assert.equal(await provider.getProfilePhoto(channel), 'https://example.com/photo.jpg');
  assert.equal(await provider.getProfilePhoto(channel), 'https://example.com/photo.jpg');
  assert.equal(await provider.getProfilePhoto(channel), null);
  const init = fetchMock.mock.calls[0].arguments[1] as RequestInit;
  assert.equal(init.cache, 'no-store');
});
