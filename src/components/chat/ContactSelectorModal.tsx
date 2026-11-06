'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, Search, User, Loader2, Phone, ArrowRight } from 'lucide-react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useInfiniteContacts } from '@/hooks/useInfiniteContacts';

interface Contact {
  id: string;
  name: string;
  phone: string;
  avatarUrl?: string;
}

interface ContactSelectorModalProps {
  onClose: () => void;
  onSelect: (contact: Contact) => void;
}

export const ContactSelectorModal = ({ onClose, onSelect }: ContactSelectorModalProps) => {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <ContactSelectorContent onClose={onClose} onSelect={onSelect} />
    </QueryClientProvider>
  );
};

function ContactSelectorContent({ onClose, onSelect }: ContactSelectorModalProps) {
  const [search, setSearch] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const {
    data, search: activeSearch, ready, isPending, isFetching, isFetchingNextPage,
    hasNextPage, isError, error, fetchNextPage, refetch,
  } = useInfiniteContacts(search);
  const loading = isPending || !ready;
  const contacts = useMemo(() => {
    const seen = new Set<string>();
    return (data?.pages.flatMap(page => page.data) || []).filter(contact => {
      if (seen.has(contact.id)) return false;
      seen.add(contact.id);
      return true;
    });
  }, [data]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: 0 });
  }, [activeSearch]);

  useEffect(() => {
    const target = sentinelRef.current;
    const root = listRef.current;
    if (!target || !root || !ready || !hasNextPage || isFetching || isError) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        void fetchNextPage({ cancelRefetch: false });
      }
    }, { root, rootMargin: '0px 0px 200px 0px' });
    observer.observe(target);
    return () => observer.disconnect();
  }, [ready, hasNextPage, isFetching, isError, fetchNextPage]);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div role="dialog" aria-modal="true" aria-labelledby="contact-selector-title" className="relative w-full max-w-lg max-h-[80vh] overflow-hidden rounded-[2.5rem] bg-white shadow-2xl flex flex-col animate-in zoom-in-95 duration-200 border border-white/20">
        
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b p-6 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-200">
              <User size={24} />
            </div>
            <div>
              <h2 id="contact-selector-title" className="text-xl font-black text-slate-800 tracking-tight">Selecionar Contato</h2>
              <p className="text-[11px] text-slate-500 font-bold uppercase tracking-widest">Escolha um contato para enviar na conversa</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Fechar seleção de contato" className="rounded-2xl p-2.5 hover:bg-slate-200 text-slate-400 transition-all hover:rotate-90 active:scale-90">
            <X size={24} />
          </button>
        </div>

        {/* Search */}
        <div className="shrink-0 p-6 border-b bg-white">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={20} />
            <input
              autoFocus
              type="text"
              placeholder="Buscar contato por nome..."
              aria-label="Buscar contato por nome"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-2xl border-2 border-slate-100 bg-slate-50 py-3.5 pl-12 pr-4 text-sm font-bold text-slate-800 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 transition-all outline-none placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* List */}
        <div ref={listRef} aria-busy={loading || isFetchingNextPage} className="min-h-0 flex-1 overflow-y-auto p-4 space-y-2 scrollbar-thin bg-slate-50/30">
          {loading ? (
            Array.from({ length: 5 }, (_, index) => (
              <div key={index} aria-hidden="true" className="flex items-center gap-4 rounded-3xl bg-white p-4 animate-pulse">
                <div className="h-12 w-12 shrink-0 rounded-2xl bg-slate-100" />
                <div className="flex-1 space-y-2"><div className="h-4 w-2/3 rounded bg-slate-100" /><div className="h-3 w-1/2 rounded bg-slate-100" /></div>
              </div>
            ))
          ) : (
            <>
              {contacts.map((contact: Contact) => (
                <button 
                  key={contact.id}
                  onClick={() => onSelect(contact)}
                  className="w-full group flex items-center gap-4 rounded-3xl border border-transparent bg-white p-4 transition-all hover:border-blue-100 hover:shadow-xl hover:shadow-blue-500/5 hover:-translate-y-0.5 active:scale-[0.98] active:translate-y-0"
                >
                  <div className="h-12 w-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-blue-100 group-hover:text-blue-600 transition-all shrink-0">
                    {contact.avatarUrl ? (
                      <img src={contact.avatarUrl} alt="" className="h-full w-full object-cover rounded-2xl" />
                    ) : (
                      <User size={24} />
                    )}
                  </div>
                  <div className="flex-1 text-left overflow-hidden">
                    <p className="font-black text-slate-800 truncate leading-tight group-hover:text-blue-600 transition-colors">{contact.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                       <Phone size={10} className="text-slate-400" />
                       <p className="text-[11px] font-bold text-slate-500 tracking-wider">+{contact.phone}</p>
                    </div>
                  </div>
                  <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-300 opacity-0 group-hover:opacity-100 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm">
                    <ArrowRight size={18} />
                  </div>
                </button>
              ))}
              {contacts.length === 0 && !isError && (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400 opacity-50 text-center px-10">
                  <div className="h-16 w-16 bg-slate-100 rounded-3xl flex items-center justify-center mb-4">
                    <Search size={32} />
                  </div>
                  <p className="text-sm font-black uppercase tracking-widest mb-1">{activeSearch ? 'Nenhum resultado para esta busca' : 'Nenhum contato cadastrado'}</p>
                  {activeSearch && <p className="text-xs font-medium">Tente buscar por outro nome.</p>}
                </div>
              )}
            </>
          )}
          <div ref={sentinelRef} role="status" aria-live="polite" className="min-h-12 py-4 text-center text-xs font-bold text-slate-400">
            {isError ? (
              <div>
                <p>{error?.message}</p>
                <button className="mt-2 text-blue-600 hover:underline" onClick={() => {
                  if (contacts.length && hasNextPage) void fetchNextPage({ cancelRefetch: false });
                  else void refetch();
                }}>Tentar novamente</button>
              </div>
            ) : loading || isFetchingNextPage ? (
              <span className="inline-flex items-center gap-2"><Loader2 size={16} className="animate-spin" />Carregando contatos...</span>
            ) : contacts.length > 0 && !hasNextPage ? 'Fim da listagem' : hasNextPage ? (
              <button className="text-blue-600 hover:underline" onClick={() => void fetchNextPage({ cancelRefetch: false })}>Carregar mais contatos</button>
            ) : null}
          </div>
        </div>

        <div className="shrink-0 p-4 bg-slate-50 border-t flex justify-center">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">{contacts.length} contatos carregados</p>
        </div>
      </div>
    </div>
  );
}
