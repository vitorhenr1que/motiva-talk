'use client';

import React, { useEffect, useState } from 'react';
import {
  Users, Search, Download, UserPlus, MoreHorizontal,
  MessageSquare, Phone, Trash2, Loader2, X, Check,
  ExternalLink, Filter, Edit2, ChevronRight, Globe, Layers
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useChatStore } from '@/store/useChatStore';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function ContactsPage() {
  const router = useRouter();
  const [contacts, setContacts] = useState<any[]>([]);
  const [channels, setChannels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isChannelModalOpen, setIsChannelModalOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<any>(null);
  const [isInitiatingChat, setIsInitiatingChat] = useState(false);

  // Form para novo contato
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const fetchContacts = async (query = '') => {
    setLoading(true);
    try {
      const res = await fetch(`/api/contacts?search=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (data.success) {
        setContacts(data.data || []);
      }
    } catch (e) {
      console.error('Falha ao carregar contatos:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchChannels = async () => {
    try {
      const res = await fetch('/api/channels');
      const data = await res.json();
      if (data.success) {
        setChannels(data.data?.filter((c: any) => c.isActive) || []);
      }
    } catch (e) { }
  };

  useEffect(() => {
    fetchContacts();
    fetchChannels();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchContacts(search);
  };

  const handleCreateContact = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError('');

    try {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, phone: newPhone })
      });

      const data = await res.json();
      if (res.ok) {
        setContacts([data.data, ...contacts]);
        setNewName('');
        setNewPhone('');
        setIsModalOpen(false);
      } else {
        setError(data.message || 'Erro ao criar contato');
      }
    } catch (e) {
      setError('Erro de conexão com o servidor');
    } finally {
      setCreating(false);
    }
  };

  /**
   * Passo 1: Selecionar o contato e abrir modal de canal
   */
  const handleOpenChannelSelector = (contact: any) => {
    setSelectedContact(contact);
    setIsChannelModalOpen(true);
  };

  /**
   * Passo 2: Confirmar canal e iniciar conversa
   */
  const handleConfirmChannel = async (channelId: string) => {
    if (!selectedContact || isInitiatingChat) return;
    setIsInitiatingChat(true);

    try {
      const convRes = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactId: selectedContact.id,
          channelId: channelId
        })
      });

      const convData = await convRes.json();
      if (convData.success) {
        const { setSelectedChannelId, setActiveConversation } = useChatStore.getState();
        setSelectedChannelId(channelId);
        setActiveConversation(convData.data);
        router.push('/inbox');
      }
    } catch (e) {
      console.error('Erro ao iniciar chat:', e);
      setIsInitiatingChat(false);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-top-4 duration-500">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
            Meus Alunos
            <span className="bg-slate-100 text-slate-400 px-3 py-1 rounded-full text-xs align-middle">
              {contacts.length}
            </span>
          </h1>
          <p className="mt-2 text-slate-500 font-medium italic max-w-lg">
            Selecione um aluno para iniciar um atendimento personalizado via WhatsApp.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 shadow-sm hover:shadow-md hover:bg-slate-50 transition-all">
            <Download size={18} />
            Exportar CSV
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 rounded-2xl bg-[#00A884] px-6 py-3 font-bold text-white shadow-lg shadow-emerald-100 hover:bg-[#008f72] transition-all hover:scale-105 active:scale-95"
          >
            <UserPlus size={20} />
            Novo Aluno
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <form onSubmit={handleSearch} className="lg:col-span-8 relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#00A884] transition-colors" size={20} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar por nome ou número..."
            className="w-full rounded-2xl border-slate-200 bg-white py-4 pl-12 pr-4 text-sm font-medium shadow-sm ring-1 ring-slate-900/5 focus:ring-4 focus:ring-emerald-500/10 focus:border-[#008f72] outline-none transition-all placeholder:text-slate-400"
          />
        </form>
        <div className="lg:col-span-4 flex gap-2">
          <div className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 flex items-center gap-3 text-sm font-bold text-slate-400 select-none shadow-sm opacity-50 cursor-not-allowed">
            <Filter size={18} />
            Filtrar por Tags
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="overflow-hidden rounded-[2rem] border border-slate-100 bg-white shadow-2xl shadow-slate-200/50">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-100">
                <th className="px-8 py-5">Perfil do Aluno</th>
                <th className="px-8 py-5">WhatsApp</th>
                <th className="px-8 py-5">Etiquetas</th>
                <th className="px-8 py-5 text-right w-40">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading && contacts.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-8 py-20 text-center">
                    <Loader2 className="mx-auto animate-spin text-emerald-500 mb-4" size={32} />
                    <p className="text-sm font-bold text-slate-400">Carregando base de alunos...</p>
                  </td>
                </tr>
              ) : contacts.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-8 py-20 text-center">
                    <div className="h-16 w-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Users size={32} className="text-slate-200" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-700">Nenhum contato encontrado</h3>
                  </td>
                </tr>
              ) : (
                contacts.map((contact) => (
                  <tr key={contact.id} className="group hover:bg-slate-50/80 transition-all cursor-default">
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center font-black text-indigo-400 uppercase text-lg group-hover:bg-indigo-600 group-hover:text-white group-hover:border-indigo-600 transition-all duration-300">
                          {contact.name[0]}
                        </div>
                        <div className="leading-tight">
                          <span className="block text-sm font-black text-slate-800 tracking-tight group-hover:text-indigo-600 transition-colors uppercase">{contact.name}</span>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 block">Candidato</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <span className="font-mono text-xs font-bold text-slate-600 group-hover:text-slate-900">{contact.phone}</span>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex gap-1.5 flex-wrap">
                        {contact.tags?.length > 0 ? contact.tags.map((t: any) => (
                          <span key={t.id} className="inline-flex items-center rounded-lg bg-white border border-slate-200 px-2.5 py-1 text-[9px] font-black text-slate-500 uppercase shadow-sm">
                            {t.name}
                          </span>
                        )) : (
                          <span className="text-[10px] font-bold text-slate-300 italic">Sem etiquetas</span>
                        )}
                      </div>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          disabled={isInitiatingChat}
                          onClick={() => handleOpenChannelSelector(contact)}
                          className="p-3 rounded-xl bg-[#00A884] text-white shadow-lg shadow-emerald-100 hover:scale-110 active:scale-95 transition-all disabled:opacity-50"
                          title="Conversar Agora"
                        >
                          <MessageSquare size={18} fill="currentColor" />
                        </button>
                        <button className="p-3 rounded-xl bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-all">
                          <Edit2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Contact Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] w-full max-w-md shadow-2xl p-8 border border-slate-100 relative overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-8">
              <div className="h-12 w-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600"><UserPlus size={24} /></div>
              <button onClick={() => setIsModalOpen(false)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-all"><X size={24} /></button>
            </div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Novo Aluno</h2>
            <form onSubmit={handleCreateContact} className="mt-8 space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-600 ml-1">Nome</label>
                <input required value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ex: João Silva" className="w-full rounded-2xl border-slate-200 bg-slate-50 py-4 px-5 text-sm font-bold text-slate-800 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 focus:bg-white outline-none transition-all" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-600 ml-1">Telefone (55...)</label>
                <input required value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="Ex: 5511999998888" className="w-full rounded-2xl border-slate-200 bg-slate-50 py-4 px-5 text-sm font-bold text-slate-800 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 focus:bg-white outline-none transition-all" />
              </div>
              {error && <div className="p-4 bg-red-50 rounded-2xl text-red-600 text-xs font-bold">{error}</div>}
              <button disabled={creating} type="submit" className="w-full py-4 bg-[#00A884] rounded-2xl text-white font-black uppercase tracking-widest text-xs hover:bg-[#008f72] transition-all flex items-center justify-center gap-2">
                {creating ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                Salvar Cadastro
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Channel Selection Modal */}
      {isChannelModalOpen && selectedContact && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[110] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[3rem] w-full max-w-lg shadow-2xl overflow-hidden border border-slate-100 relative animate-in zoom-in-95 duration-300 flex flex-col max-h-[85vh]">
            {/* Scrollable Container */}
            <div className="p-10 overflow-y-auto flex-1 custom-scrollbar">
              <div className="flex items-center justify-between mb-10">
                <div className="h-14 w-14 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                  <Globe size={28} />
                </div>
                <button
                  disabled={isInitiatingChat}
                  onClick={() => setIsChannelModalOpen(false)}
                  className="rounded-2xl p-2.5 text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-all disabled:opacity-30"
                >
                  <X size={28} />
                </button>
              </div>

              <h2 className="text-3xl font-black text-slate-900 tracking-tight leading-none">Iniciar Atendimento</h2>
              <p className="mt-3 text-slate-500 font-medium italic">
                Escolha o canal de saída para <span className="text-indigo-600 font-black uppercase">"{selectedContact.name}"</span>
              </p>

              <div className="mt-10 space-y-3">
                {channels.length === 0 ? (
                  <div className="p-10 text-center bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                    <p className="text-sm font-bold text-slate-400">Nenhum canal ativo disponível.</p>
                  </div>
                ) : (
                  channels.map((channel) => (
                    <button
                      key={channel.id}
                      disabled={isInitiatingChat}
                      onClick={() => handleConfirmChannel(channel.id)}
                      className={cn(
                        "w-full flex items-center justify-between p-6 rounded-3xl border-2 transition-all group relative overflow-hidden",
                        isInitiatingChat ? "opacity-50 grayscale cursor-not-allowed border-slate-100 bg-slate-50" : "border-slate-100 bg-white hover:border-indigo-500 hover:bg-indigo-50/30 hover:shadow-xl hover:shadow-indigo-500/10 active:scale-95"
                      )}
                    >
                      <div className="flex items-center gap-5">
                        <div className={cn(
                          "h-12 w-12 rounded-2xl flex items-center justify-center transition-colors shadow-sm",
                          isInitiatingChat ? "bg-slate-200 text-slate-400" : "bg-emerald-50 text-emerald-600 group-hover:bg-indigo-600 group-hover:text-white"
                        )}>
                          <Layers size={22} />
                        </div>
                        <div className="text-left">
                          <p className={cn(
                            "text-base font-black tracking-tight transition-colors",
                            isInitiatingChat ? "text-slate-400" : "text-slate-800 group-hover:text-indigo-600"
                          )}>{channel.name}</p>
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.05em]">{channel.phoneNumber}</p>
                        </div>
                      </div>

                      {isInitiatingChat ? (
                        <Loader2 size={24} className="animate-spin text-indigo-600" />
                      ) : (
                        <ChevronRight size={24} className="text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all" />
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-8 border-t border-slate-50 flex justify-center bg-slate-50/50">
              <button
                disabled={isInitiatingChat}
                onClick={() => setIsChannelModalOpen(false)}
                className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-slate-600 transition-all disabled:opacity-0"
              >
                Cancelar e Voltar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
