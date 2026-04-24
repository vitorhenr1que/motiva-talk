import React, { useState, useEffect, useMemo } from 'react';
import { X, Search, Loader2, Send, Check } from 'lucide-react';
import { formatPhone } from '@/lib/utils';
import { useChatStore } from '@/store/useChatStore';

interface Contact {
  id: string;
  name: string;
  phone: string;
  profilePictureUrl?: string;
}

interface ForwardMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedMessageIds: string[];
}

export const ForwardMessageModal: React.FC<ForwardMessageModalProps> = ({ isOpen, onClose, selectedMessageIds }) => {
  const activeChannelId = useChatStore((s) => s.activeConversation?.channelId || s.selectedChannelId);

  const [searchQuery, setSearchQuery] = useState('');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [forwarding, setForwarding] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setSelectedContactIds([]);
      setErrorMsg(null);
      return;
    }

    loadRecentContacts();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    
    if (!searchQuery.trim()) {
      loadRecentContacts();
      return;
    }

    const timer = setTimeout(() => {
      searchContacts(searchQuery);
    }, 400);

    return () => clearTimeout(timer);
  }, [searchQuery, isOpen]);

  const loadRecentContacts = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/conversations?limit=20');
      const json = await res.json();
      if (json.success) {
        // Extrai contatos únicos das conversas para evitar erro de chaves duplicadas
        const seenIds = new Set();
        const recentContacts = json.data
          .map((c: any) => c.contact)
          .filter((contact: any) => {
            if (!contact || seenIds.has(contact.id)) return false;
            seenIds.add(contact.id);
            return true;
          });
        setContacts(recentContacts);
      }
    } catch (e) {
      setErrorMsg('Erro ao carregar contatos recentes.');
    } finally {
      setLoading(false);
    }
  };

  const searchContacts = async (query: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/contacts?search=${encodeURIComponent(query)}`);
      const json = await res.json();
      if (json.success) {
        setContacts(json.data || []);
      }
    } catch (e) {
      setErrorMsg('Erro na busca de contatos.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  // Usa os contatos retornados pela API (já filtrados ou os recentes)
  const filteredContacts = contacts;

  if (!isOpen) return null;

  const toggleSelection = (contactId: string) => {
    setSelectedContactIds((prev) =>
      prev.includes(contactId) ? prev.filter((id) => id !== contactId) : [...prev, contactId]
    );
  };

  const handleForward = async () => {
    if (selectedContactIds.length === 0 || selectedMessageIds.length === 0) return;
    if (!activeChannelId) {
      setErrorMsg('Nenhum canal ativo selecionado.');
      return;
    }

    setForwarding(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/messages/forward-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageIds: selectedMessageIds,
          targetContactIds: selectedContactIds,
          channelId: activeChannelId,
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.success) {
        throw new Error(json?.message || 'Falha ao encaminhar mensagens.');
      }

      useChatStore.getState().clearSelection();
      onClose();
    } catch (e: any) {
      setErrorMsg(e?.message || 'Erro ao encaminhar.');
    } finally {
      setForwarding(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col h-[80vh] max-h-[600px] animate-in zoom-in-95 duration-200">

        <div className="px-6 py-4 border-b flex items-center justify-between bg-slate-50">
          <div>
            <h2 className="text-lg font-black text-slate-800">Encaminhar para...</h2>
            <p className="text-xs font-bold text-slate-400 mt-0.5">
              {selectedMessageIds.length} {selectedMessageIds.length === 1 ? 'mensagem' : 'mensagens'} selecionadas
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 border-b">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar contatos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-9 pr-4 bg-slate-100 border-transparent rounded-xl text-sm font-bold focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all outline-none"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="animate-spin text-blue-500" size={24} />
            </div>
          ) : filteredContacts.length === 0 ? (
            <div className="text-center p-8 text-slate-400 font-bold text-sm">Nenhum contato encontrado.</div>
          ) : (
            <div className="flex flex-col gap-1">
              {filteredContacts.map((contact) => {
                const isSelected = selectedContactIds.includes(contact.id);
                return (
                  <div
                    key={contact.id}
                    onClick={() => toggleSelection(contact.id)}
                    className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border ${
                      isSelected ? 'bg-blue-50 border-blue-200' : 'hover:bg-slate-50 border-transparent'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                        isSelected ? 'bg-blue-500 border-blue-500 text-white' : 'border-slate-300 bg-white'
                      }`}
                    >
                      {isSelected && <Check size={12} strokeWidth={3} />}
                    </div>

                    <div className="h-10 w-10 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                      {contact.profilePictureUrl ? (
                        <img src={contact.profilePictureUrl} alt={contact.name} className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-slate-500 font-bold uppercase">{contact.name?.[0] || '?'}</span>
                      )}
                    </div>

                    <div className="flex flex-col overflow-hidden">
                      <span className="text-sm font-bold text-slate-800 truncate">{contact.name}</span>
                      <span className="text-xs font-medium text-slate-400">{formatPhone(contact.phone)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {errorMsg && (
          <div className="px-4 py-2 bg-red-50 text-red-600 text-xs font-bold border-t border-red-100">{errorMsg}</div>
        )}

        <div className="p-4 border-t bg-slate-50 flex justify-between items-center">
          <span className="text-xs font-bold text-slate-500">
            {selectedContactIds.length} {selectedContactIds.length === 1 ? 'contato' : 'contatos'}
          </span>
          <button
            disabled={selectedContactIds.length === 0 || forwarding || !activeChannelId}
            onClick={handleForward}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md shadow-blue-200"
          >
            {forwarding ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            Enviar
          </button>
        </div>
      </div>
    </div>
  );
};
