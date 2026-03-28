'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useChatStore } from '@/store/useChatStore';
import { 
  MoreVertical, Search, MessageCircle, FileText, Reply, Trash2, 
  Loader2, Info, Check, CornerUpRight, Pin, UserPlus, 
  CheckCircle2, XCircle, Edit3, X, UserPlus as ContactIcon, Plus
} from 'lucide-react';
import { TagSelector } from './TagSelector';
import { formatWhatsappText } from '@/lib/formatWhatsappText';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatPhone } from '@/lib/utils';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const ChatWindow = () => {
  const { 
    activeConversation, 
    messages, 
    setMessages, 
    loadingMessages, 
    setLoadingMessages,
    deleteMessageLocally,
    updateConversationLocally,
    isProfileOpen,
    setIsProfileOpen
  } = useChatStore();
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const [deleteMenuId, setDeleteMenuId] = useState<string | null>(null);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);

  /**
   * Finaliza o atendimento mudando status para CLOSED
   */
  const handleFinishConversation = async () => {
    if (!activeConversation) return;
    setHeaderMenuOpen(false);
    
    if (!confirm('Deseja finalizar este atendimento?')) return;

    try {
      const resp = await fetch(`/api/conversations/${activeConversation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CLOSED' })
      });

      if (resp.ok) {
        updateConversationLocally(activeConversation.id, { status: 'CLOSED' });
      }
    } catch (e) {
      console.error('Falha ao finalizar conversa:', e);
    }
  };

  /**
   * Adiciona ou edita o nome do contato
   */
  const handleUpdateContactName = async () => {
    if (!activeConversation || !activeConversation.contact) return;
    setHeaderMenuOpen(false);

    const newName = prompt('Novo nome para o contato:', activeConversation.contact.name);
    if (!newName || newName === activeConversation.contact.name) return;

    try {
      const resp = await fetch(`/api/contacts/${activeConversation.contact.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName })
      });

      if (resp.ok) {
        updateConversationLocally(activeConversation.id, { 
          contact: { ...activeConversation.contact, name: newName } 
        });
      }
    } catch (e) {
      console.error('Falha ao atualizar contato:', e);
    }
  };

  /**
   * Adiciona ou atualiza a observação fixada
   */
  const handleUpdatePinnedNote = async () => {
    if (!activeConversation) return;
    setHeaderMenuOpen(false);

    const newNote = prompt('Observação (será fixada no topo):', activeConversation.pinnedNote || '');
    if (newNote === null) return; // Cancelou

    try {
      const resp = await fetch(`/api/conversations/${activeConversation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pinnedNote: newNote || null })
      });

      if (resp.ok) {
        updateConversationLocally(activeConversation.id, { pinnedNote: newNote || undefined });
      }
    } catch (e) {
      console.error('Falha ao atualizar observação:', e);
    }
  };

  /**
   * Remove a observação fixada
   */
  const handleDeletePinnedNote = async () => {
    if (!activeConversation) return;
    if (!confirm('Deseja remover esta observação fixa?')) return;

    try {
      const resp = await fetch(`/api/conversations/${activeConversation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pinnedNote: null })
      });

      if (resp.ok) {
        updateConversationLocally(activeConversation.id, { pinnedNote: undefined });
      }
    } catch (e) {
      console.error('Falha ao excluir observação:', e);
    }
  };

  const handleDeleteMessage = async (id: string, mode: 'me' | 'everyone') => {
    setDeleteMenuId(null);
    const confirmText = mode === 'everyone' ? 
      'Deseja apagar esta mensagem para TODOS?' : 
      'Deseja remover esta mensagem apenas para você?';
    
    if (!confirm(confirmText)) return;
    
    try {
      const resp = await fetch(`/api/messages/${id}/delete`, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }) 
      });
      
      if (resp.ok) {
        deleteMessageLocally(id, mode);
      }
    } catch (e) {
      console.error('Erro ao deletar msg:', e);
    }
  };

  useEffect(() => {
    if (!activeConversation) return;

    const fetchMessages = async () => {
      setLoadingMessages(true);
      try {
        const resp = await fetch(`/api/messages?conversationId=${activeConversation.id}`);
        if (resp.ok) {
          const data = await resp.json();
          setMessages(data.data || []);
        }
      } catch (e) {
        console.error('[CHAT_DEBUG] Erro ao buscar mensagens:', e);
      } finally {
        setLoadingMessages(false);
      }
    };

    fetchMessages();
  }, [activeConversation?.id, setMessages, setLoadingMessages]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loadingMessages]);

  const refetchConversations = async () => {
    if (!activeConversation) return;
    try {
      const res = await fetch(`/api/conversations?channelId=${activeConversation.channelId}`);
      const data = await res.json();
      const conversations = data.data || [];
      useChatStore.getState().setConversations(conversations);
      const updated = conversations.find((c: any) => c.id === activeConversation.id);
      if (updated) useChatStore.getState().setActiveConversation(updated);
    } catch (e) {}
  };

  /**
   * Remove uma etiqueta específica da conversa
   */
  const handleRemoveTag = async (tagName: string) => {
    if (!activeConversation) return;
    const currentTags = activeConversation.tags || [];
    const nextTags = currentTags
      .map(ct => ct.tag.name)
      .filter(n => n !== tagName);

    try {
      const res = await fetch(`/api/conversations/${activeConversation.id}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: nextTags })
      });
      if (res.ok) {
        refetchConversations();
      }
    } catch (e) {
      console.error('Falha ao remover etiqueta:', e);
    }
  };

  if (!activeConversation) {
    return (
      <div className="flex h-full flex-1 flex-col items-center justify-center bg-slate-50 text-slate-400 p-10 text-center">
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-white shadow-xl ring-1 ring-slate-100 mb-6 animate-bounce duration-[2000ms]">
          <MessageCircle size={40} className="text-blue-100" />
        </div>
        <h2 className="text-xl font-bold text-slate-700">Bem-vindo ao Motiva Talk</h2>
        <p className="mt-2 text-sm max-w-xs text-slate-400 font-medium">Selecione uma conversa na lateral para começar a atender seus alunos e candidatos.</p>
      </div>
    );
  }

  const isClosed = activeConversation.status === 'CLOSED';

  return (
    <div className="flex flex-1 flex-col bg-[#efeae2] relative overflow-hidden">
      {/* Dynamic Header */}
      <div className="flex h-16 items-center justify-between border-b bg-white px-6 shadow-sm z-30 shrink-0">
        <div className="flex items-center gap-4 overflow-hidden">
          {/* Informações do Contato (Clicável para abrir perfil) */}
          <div 
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className={cn(
              "flex items-center gap-4 cursor-pointer px-2 py-1 rounded-xl transition-all hover:bg-slate-50 group/header-profile shrink-0",
              isProfileOpen && "bg-slate-50 shadow-inner"
            )}
            title="Clique para ver detalhes do contato"
          >
            <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200 shadow-sm group-hover/header-profile:scale-105 transition-transform overflow-hidden">
               <span className="font-bold text-slate-500 uppercase text-lg">{activeConversation.contact?.name?.[0] || '?'}</span>
            </div>
            <div className="leading-tight">
              <div className="flex items-center gap-2">
                 <h3 className="text-sm font-bold text-slate-800 tracking-tight group-hover/header-profile:text-blue-600 transition-colors truncate max-w-[150px]">
                    {activeConversation.contact?.name}
                 </h3>
                 {activeConversation.contact?.phone && (
                   <span className="text-[10px] text-slate-400 font-mono tracking-tighter opacity-0 group-hover/header-profile:opacity-100 transition-opacity">
                      {formatPhone(activeConversation.contact.phone)}
                   </span>
                 )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={cn(
                  "h-2 w-2 rounded-full",
                  isClosed ? "bg-red-500" : "bg-green-500 animate-pulse"
                )} />
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none">
                  {isClosed ? 'Atendimento Finalizado' : (activeConversation.channel?.name || 'Inbox')}
                </span>
              </div>
            </div>
          </div>

          <div className="h-4 w-px bg-slate-100 mx-1 shrink-0" />

          {/* Tags do Contato */}
          <div className="flex gap-1 items-center overflow-x-auto no-scrollbar max-w-[300px]">
             {activeConversation.tags?.map((ct) => (
                <div key={ct.tagId} className="relative group/tag-badge flex items-center">
                  <span
                    style={{ 
                      color: ct.tag.color, 
                      backgroundColor: `${ct.tag.color}10`,
                      borderColor: `${ct.tag.color}30`
                    }}
                    className="px-1.5 py-0.5 rounded-lg text-[8px] font-black uppercase border whitespace-nowrap animate-in fade-in"
                  >
                     {ct.tag.emoji && <span className="mr-0.5">{ct.tag.emoji}</span>}
                     {ct.tag.name}
                  </span>
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleRemoveTag(ct.tag.name); }}
                    className="absolute -top-1 -right-1 h-3.5 w-3.5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover/tag-badge:opacity-100 scale-0 group-hover/tag-badge:scale-100 transition-all shadow-sm z-10 hover:bg-red-600"
                  >
                    <X size={8} />
                  </button>
                </div>
             ))}
          </div>
        </div>

        {/* Lado Direito: Ações */}
        <div className="flex items-center gap-1">
          <TagSelector 
            conversationId={activeConversation.id} 
            currentTags={activeConversation.tags || []} 
            onUpdate={refetchConversations} 
          />
          <button className="rounded-xl p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-all">
            <Search size={20} />
          </button>
          
          <div className="relative">
            <button 
              onClick={() => setHeaderMenuOpen(!headerMenuOpen)}
              className={cn(
                "rounded-xl p-2 transition-all",
                headerMenuOpen ? "bg-slate-100 text-slate-900" : "text-slate-400 hover:bg-slate-50 hover:text-slate-600"
              )}
            >
              <MoreVertical size={20} />
            </button>

            {headerMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-2xl border border-slate-100 p-2 z-50 animate-in fade-in zoom-in-95 duration-200">
                <button 
                  onClick={handleUpdateContactName}
                  className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 rounded-xl flex items-center gap-3 transition-colors"
                >
                  <UserPlus size={16} className="text-blue-500" />
                  Identificar Contato
                </button>
                <button 
                  onClick={handleUpdatePinnedNote}
                  className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 rounded-xl flex items-center gap-3 transition-colors"
                >
                  <Pin size={16} className="text-orange-500" />
                  Adicionar Observação
                </button>
                <div className="h-px bg-slate-100 my-1 mx-2" />
                <button 
                  disabled={isClosed}
                  onClick={handleFinishConversation}
                  className={cn(
                    "w-full text-left px-4 py-2.5 text-xs font-bold rounded-xl flex items-center gap-3 transition-colors",
                    isClosed ? "text-slate-300 cursor-not-allowed" : "text-red-600 hover:bg-red-50"
                  )}
                >
                  <CheckCircle2 size={16} className={isClosed ? "text-slate-300" : "text-red-500"} />
                  Finalizar Conversa
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Pinned Note Bar */}
      {activeConversation.pinnedNote && (
        <div className="bg-orange-50/90 backdrop-blur-sm border-b border-orange-100 px-6 py-2 flex items-center justify-between z-20 shadow-sm animate-in slide-in-from-top duration-300">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="h-6 w-6 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
              <Pin size={12} className="text-orange-600 fill-orange-600" />
            </div>
            <p className="text-[11px] font-bold text-orange-800 truncate italic">
              "{activeConversation.pinnedNote}"
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => handleUpdatePinnedNote()}
              className="text-[10px] font-black uppercase tracking-tighter text-orange-600/40 hover:text-orange-600 transition-colors"
            >
              Editar
            </button>
            <button 
              onClick={handleDeletePinnedNote}
              className="p-1.5 rounded-full hover:bg-orange-100 text-orange-400 hover:text-red-500 transition-all"
              title="Excluir observação"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Messages Feed */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 scroll-smooth">
        {loadingMessages ? (
          <div className="flex flex-col gap-6">
            <div className="flex justify-start"><div className="h-12 w-48 bg-white/50 rounded-lg animate-pulse" /></div>
            <div className="flex justify-end"><div className="h-12 w-64 bg-blue-100/50 rounded-lg animate-pulse" /></div>
          </div>
        ) : (
          <>
            {messages.map((msg: any) => {
              const isSentByUs = msg.senderType === 'AGENT' || msg.senderType === 'SYSTEM';
              const isEveryoneDeleted = msg.deletedForEveryone;
              
              return (
                <div
                  key={msg.id}
                  className={cn(
                    "flex w-full group anim-fade-in",
                    isSentByUs ? "justify-end" : "justify-start"
                  )}
                >
                  <div
                    className={cn(
                      "relative max-w-[80%] md:max-w-[70%] rounded-2xl p-1.5 shadow-sm transition-all hover:shadow-md",
                      isSentByUs 
                        ? "bg-[#d9fdd3] text-slate-800 rounded-tr-none" 
                        : "bg-white text-slate-800 rounded-tl-none border border-slate-100",
                      msg.status === 'sending' && "opacity-60 grayscale-[0.2]"
                    )}
                  >
                    <div className="px-2.5 py-1">
                      {msg.replyToMessage && !isEveryoneDeleted && (
                        <div className="mb-2 border-l-4 border-blue-400 bg-black/10 p-2 rounded-r-lg text-[11px] opacity-90 cursor-pointer hover:bg-black/20 transition-colors">
                          <span className="block font-bold text-blue-600 mb-0.5">
                            {msg.replyToMessage.senderType === 'USER' ? activeConversation.contact?.name : 'Você'}
                          </span>
                          <span className="block truncate max-w-xs italic text-slate-500">
                             {msg.replyToMessage.content}
                          </span>
                        </div>
                      )}

                      {isEveryoneDeleted ? (
                        <div className="flex items-center gap-2 py-0.5 italic text-slate-400 text-[12px] opacity-70">
                           <Trash2 size={12} className="opacity-40" />
                           <span>Esta mensagem foi apagada</span>
                        </div>
                      ) : (
                        <>
                          {msg.type === 'TEXT' && (
                            <p className="whitespace-pre-wrap leading-relaxed text-[13px]">
                              {formatWhatsappText(msg.content)}
                            </p>
                          )}
                          
                          {msg.type === 'IMAGE' && (
                            <img src={msg.content} alt="Anexo" className="max-h-80 w-auto rounded-xl cursor-pointer" onClick={() => window.open(msg.content, '_blank')} />
                          )}

                          {msg.type === 'AUDIO' && (
                            <audio src={msg.content} controls className="h-8 w-full py-2 min-w-[200px]" />
                          )}

                          {msg.type === 'VIDEO' && (
                            <div className="max-w-[300px] overflow-hidden rounded-xl border border-black/5">
                              <video src={msg.content} controls className="w-full h-auto max-h-[400px]" />
                            </div>
                          )}

                          {msg.type === 'CONTACT' && (
                             <div className="flex flex-col gap-3 rounded-xl bg-white border border-slate-100 p-4 min-w-[240px] shadow-sm">
                                <div className="flex items-center gap-4">
                                   <div className="h-12 w-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                                      <ContactIcon size={24} />
                                   </div>
                                   <div className="flex-1 overflow-hidden">
                                      <p className="text-sm font-black text-slate-800 truncate">{msg.metadata?.contact?.fullName || 'Sem Nome'}</p>
                                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">{msg.metadata?.contact?.wuid ? formatPhone(msg.metadata.contact.wuid) : 'Sem Número'}</p>
                                   </div>
                                </div>
                                <div className="h-px bg-slate-50" />
                                <a 
                                  href={`https://wa.me/${msg.metadata?.contact?.wuid}`} 
                                  target="_blank" 
                                  className="w-full py-1.5 text-center text-[10px] font-black uppercase text-blue-600 hover:text-blue-700 transition-colors"
                                >
                                  Conversar via WhatsApp
                                </a>
                             </div>
                          )}

                          {msg.type === 'DOCUMENT' && (
                            <a href={msg.content} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-lg bg-black/5 p-3 text-blue-600 font-bold decoration-none">
                              <FileText size={20} />
                              <span className="text-xs truncate max-w-[150px]">{msg.metadata?.fileName || 'Documento'}</span>
                            </a>
                          )}
                        </>
                      )}

                      <div className="mt-1 flex items-center justify-end gap-1.5">
                        <span className="text-[9px] text-slate-400 font-bold opacity-60">
                          {(() => {
                             try {
                                let raw = msg.createdAt;
                                // Detecta se a string já tem informação de timezone (Z, +03:00, -0300, etc)
                                const hasTZ = /Z$|[+-]\d{2}:?\d{2}$/.test(raw);
                                if (raw && !hasTZ) {
                                   raw += 'Z';
                                }
                                
                                const date = new Date(raw);
                                const timeStr = date.toLocaleTimeString('pt-BR', { 
                                   hour: '2-digit', 
                                   minute: '2-digit',
                                   timeZone: 'America/Bahia' 
                                });

                                return timeStr;
                             } catch (e) {
                                return '00:00';
                             }
                          })()}
                        </span>
                        {isSentByUs && !isEveryoneDeleted && (
                           <Check size={10} className={cn("opacity-60", msg.status === 'sending' ? "animate-pulse" : "text-blue-500")} />
                        )}
                      </div>
                    </div>

                    {!isEveryoneDeleted && !isClosed && (
                      <div className={cn(
                        "absolute top-0 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-all z-20",
                        isSentByUs ? "-left-12 pr-2" : "-right-12 pl-2"
                      )}>
                         <button 
                           onClick={() => useChatStore.getState().setReplyToMessage(msg)}
                           className="p-2 rounded-xl bg-white shadow-sm hover:bg-blue-600 hover:text-white transition-all transform hover:scale-110"
                           title="Responder"
                         >
                           <Reply size={16} />
                         </button>
                         
                         <div className="relative">
                            <button 
                              onClick={() => setDeleteMenuId(deleteMenuId === msg.id ? null : msg.id)}
                              className="p-2 rounded-xl bg-white shadow-sm hover:text-red-600 hover:bg-red-50 transition-colors"
                              title="Opções de exclusão"
                            >
                              <Trash2 size={16} />
                            </button>

                            {deleteMenuId === msg.id && (
                              <div className={cn(
                                "absolute bottom-full mb-2 w-48 bg-white rounded-2xl shadow-2xl border border-slate-100 p-2 z-[100]",
                                isSentByUs ? "right-0" : "left-0"
                              )}>
                                <button onClick={() => handleDeleteMessage(msg.id, 'me')} className="w-full text-left px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 rounded-xl flex items-center gap-2">Apagar para mim</button>
                                <button onClick={() => handleDeleteMessage(msg.id, 'everyone')} className="w-full text-left px-4 py-2 text-xs font-bold text-red-600 hover:bg-red-50 rounded-xl flex items-center gap-2">Apagar para todos</button>
                              </div>
                            )}
                         </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* Closed Status Overlay / Warning */}
      {isClosed && (
        <div className="bg-slate-800 text-white px-6 py-3 flex items-center justify-between z-40 shadow-2xl animate-in slide-in-from-bottom duration-300">
           <div className="flex items-center gap-3">
             <XCircle size={18} className="text-red-400" />
             <p className="text-xs font-bold uppercase tracking-widest">Atendimento Finalizado</p>
           </div>
           <button 
             onClick={async () => {
               try {
                 await fetch(`/api/conversations/${activeConversation.id}`, {
                   method: 'PATCH',
                   headers: { 'Content-Type': 'application/json' },
                   body: JSON.stringify({ status: 'OPEN' })
                 });
                 updateConversationLocally(activeConversation.id, { status: 'OPEN' });
               } catch (e) {}
             }}
             className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-[10px] font-black uppercase transition-all"
           >
             Reabrir Atendimento
           </button>
        </div>
      )}
    </div>
  );
};
