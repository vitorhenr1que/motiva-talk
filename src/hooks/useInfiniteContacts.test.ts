import assert from 'node:assert/strict';
import test from 'node:test';
import { InfiniteQueryObserver, QueryClient } from '@tanstack/react-query';
import { contactsQueryOptions } from './useInfiniteContacts';

test('cache deduplica consultas simultâneas e reutiliza páginas ao limpar a busca', async () => {
  const client = new QueryClient();
  let requests = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    requests++;
    return Response.json({ success: true, data: [{ id: '1', name: 'Ana', phone: '' }], nextCursor: null });
  };
  try {
    const options = contactsQueryOptions('');
    await Promise.all([client.fetchInfiniteQuery(options), client.fetchInfiniteQuery(options)]);
    assert.equal(requests, 1);
    await client.fetchInfiniteQuery(contactsQueryOptions('An'));
    await client.fetchInfiniteQuery(options);
    assert.equal(requests, 2);
    assert.equal(client.getQueryData(options.queryKey)?.pages[0].data[0].id, '1');
  } finally {
    globalThis.fetch = originalFetch;
    client.clear();
  }
});

test('continua pelo cursor, bloqueia carregamentos duplicados e encerra a lista', async () => {
  const client = new QueryClient();
  const urls: string[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async input => {
    urls.push(String(input));
    return Response.json({ success: true, data: [], nextCursor: urls.length === 1 ? 'cursor-30' : null });
  };
  const observer = new InfiniteQueryObserver(client, contactsQueryOptions('An'));
  const unsubscribe = observer.subscribe(() => {});
  try {
    await observer.refetch();
    await Promise.all([observer.fetchNextPage({ cancelRefetch: false }), observer.fetchNextPage({ cancelRefetch: false })]);
    assert.equal(urls.length, 2);
    assert.equal(new URL(urls[1], 'http://localhost').searchParams.get('cursor'), 'cursor-30');
    assert.equal(observer.getCurrentResult().hasNextPage, false);
  } finally {
    unsubscribe();
    client.clear();
    globalThis.fetch = originalFetch;
  }
});

test('trocar a chave cancela a busca antiga sem substituir os resultados novos', async () => {
  const client = new QueryClient();
  const originalFetch = globalThis.fetch;
  let oldSignal: AbortSignal | undefined;
  globalThis.fetch = async (input, init) => {
    if (String(input).includes('search=An')) {
      oldSignal = init?.signal as AbortSignal;
      return new Promise<Response>((_resolve, reject) => {
        oldSignal!.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
      });
    }
    return Response.json({ success: true, data: [{ id: '2', name: 'João', phone: '' }], nextCursor: null });
  };
  const observer = new InfiniteQueryObserver(client, contactsQueryOptions('An'));
  const unsubscribe = observer.subscribe(() => {});
  try {
    observer.setOptions(contactsQueryOptions('Jo'));
    await observer.refetch();
    assert.equal(oldSignal?.aborted, true);
    assert.equal(observer.getCurrentResult().data?.pages[0].data[0].name, 'João');
  } finally {
    unsubscribe();
    client.clear();
    globalThis.fetch = originalFetch;
  }
});
