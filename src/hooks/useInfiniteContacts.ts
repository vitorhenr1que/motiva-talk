'use client';

import { useEffect, useState } from 'react';
import { infiniteQueryOptions, useInfiniteQuery } from '@tanstack/react-query';
import { normalizeContactSearch, type ContactPage } from '@/lib/contact-pagination';

export function contactsQueryOptions(search: string) {
  return infiniteQueryOptions({
    queryKey: ['contacts', search],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }): Promise<ContactPage> => {
      const params = new URLSearchParams({ paginate: 'true', search });
      if (pageParam) params.set('cursor', pageParam);
      const response = await fetch(`/api/contacts?${params}`, { signal, cache: 'no-store' });
      const body = await response.json();
      if (!response.ok || !body.success) {
        throw new Error(body.message || 'Não foi possível carregar os contatos.');
      }
      return { data: body.data, nextCursor: body.nextCursor };
    },
    getNextPageParam: page => page.nextCursor,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}

export function useInfiniteContacts(input: string) {
  const search = normalizeContactSearch(input);
  const [debouncedSearch, setDebouncedSearch] = useState(search);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Change the key immediately to unsubscribe/cancel the previous request.
  // Enable the new search after debounce; clearing restores the normal cache.
  const ready = search === '' || search === debouncedSearch;
  const query = useInfiniteQuery({ ...contactsQueryOptions(search), enabled: ready });

  return { ...query, search, ready };
}
