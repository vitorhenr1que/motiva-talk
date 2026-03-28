'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useChatStore } from '@/store/useChatStore';
import { MoreVertical, Search, MessageCircle, FileText, Reply, Trash2, Loader2, Info, Check, CornerUpRight } from 'lucide-react';
import { TagSelector } from './TagSelector';
import { formatWhatsappText } from '@/lib/formatWhatsappText';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

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
    deleteMessageLocally
  } = useChatStore();
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const [deleteMenuId, setDeleteMenuId] = useState<string | null>(null);

  /**
   * Executa a exclusão da mensagem
   */
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
      } else {
        const err = await resp.json();
        alert(err.error || 'Erro ao apagar mensagem.');
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
  }, [activeConversation, setMessages, setLoadingMessages]);

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

  return (
    <div className="flex flex-1 flex-col bg-[#efeae2] relative overflow-hidden">
      {/* Dynamic Header */}
      <div className="flex h-16 items-center justify-between border-b bg-white px-6 shadow-sm z-10">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200">
             <span className="font-bold text-slate-500 uppercase">{activeConversation.contact.name[0]}</span>
          </div>
          <div className="leading-tight">
            <div className="flex items-center gap-2">
               <h3 className="text-sm font-bold text-slate-800 tracking-tight">{activeConversation.contact.name}</h3>
               {activeConversation.contact.phone && (
                 <span className="text-[10px] text-slate-400 font-mono">{activeConversation.contact.phone}</span>
               )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
               <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
               <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{activeConversation.channel.name}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <TagSelector 
            conversationId={activeConversation.id} 
            currentTags={activeConversation.tags || []} 
            onUpdate={refetchConversations} 
          />
          <button className="rounded-xl p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-all"><Search size={20} /></button>
          <button className="rounded-xl p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-all"><MoreVertical size={20} /></button>
        </div>
      </div>

      {/* Messages Feed */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 scroll-smooth">
        {loadingMessages ? (
          <div className="flex flex-col gap-6">
            <div className="flex justify-start"><div className="h-12 w-48 bg-white/50 rounded-lg animate-pulse" /></div>
            <div className="flex justify-end"><div className="h-12 w-64 bg-blue-100/50 rounded-lg animate-pulse" /></div>
            <div className="flex justify-start"><div className="h-20 w-56 bg-white/50 rounded-lg animate-pulse" /></div>
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
                      {/* Reply Preview inside Bubble */}
                      {msg.replyToMessage && !isEveryoneDeleted && (
                        <div className="mb-2 border-l-4 border-blue-400 bg-black/10 p-2 rounded-r-lg text-[11px] opacity-90 cursor-pointer hover:bg-black/20 transition-colors">
                          <span className="block font-bold text-blue-600 mb-0.5">
                            {msg.replyToMessage.senderType === 'USER' ? activeConversation.contact.name : 'Você'}
                          </span>
                          <span className="block truncate max-w-xs italic text-slate-500">
                             {msg.replyToMessage.type === 'TEXT' ? formatWhatsappText(msg.replyToMessage.content) : 
                              msg.replyToMessage.type === 'IMAGE' ? '📷 Foto' :
                              msg.replyToMessage.type === 'AUDIO' ? '🎵 Áudio' :
                              msg.replyToMessage.type === 'DOCUMENT' ? '📄 Documento' : 'Mensagem'}
                          </span>
                        </div>
                      )}

                      {/* Content Rendering */}
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
                          
                          {msg.type === 'IMAGE' && msg.content.startsWith('http') && (
                            <div className="overflow-hidden rounded-xl bg-slate-100 mb-1">
                              <img 
                                src={msg.content} 
                                alt="Anexo" 
                                className="max-h-80 w-auto object-contain cursor-pointer transition-transform hover:scale-[1.02]" 
                                onClick={() => window.open(msg.content, '_blank')}
                              />
                            </div>
                          )}

                          {msg.type === 'AUDIO' && (
                            <div className="py-2 min-w-[200px]">
                              <audio src={msg.content} controls className="h-8 w-full" />
                            </div>
                          )}

                          {msg.type === 'DOCUMENT' && (
                            <a 
                              href={msg.content} 
                              target="_blank" 
                              rel="noreferrer"
                              className="flex items-center gap-3 rounded-lg bg-black/5 p-3 hover:bg-black/10 transition-all text-blue-600 font-bold decoration-none"
                            >
                              <div className="flex h-10 w-10 items-center justify-center rounded bg-white text-slate-500 shadow-sm">
                                <FileText size={20} />
                              </div>
                              <div className="flex flex-col">
                                <span className="text-xs truncate max-w-[150px]">Documento</span>
                                <span className="text-[9px] uppercase opacity-50">Abrir Arquivo</span>
                              </div>
                            </a>
                          )}
                        </>
                      )}

                      <div className="mt-1 flex items-center justify-end gap-1.5 min-w-[60px]">
                        <span className="text-[9px] text-slate-400 font-bold opacity-60">
                          {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {isSentByUs && !isEveryoneDeleted && (
                           <Check size={10} className={cn("opacity-60", msg.status === 'sending' ? "animate-pulse" : "text-blue-500")} />
                        )}
                        {msg.status === 'sending' && (
                          <Loader2 size={10} className="animate-spin text-blue-400" />
                        )}
                      </div>
                    </div>

                    {/* Action Controls (Hover) */}
                    {!isEveryoneDeleted && (
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
                                "absolute bottom-full mb-2 w-48 bg-white rounded-2xl shadow-2xl border border-slate-100 p-2 z-[100] animate-in fade-in zoom-in-95 duration-200",
                                isSentByUs ? "right-0" : "left-0"
                              )}>
                                <button 
                                  onClick={() => handleDeleteMessage(msg.id, 'me')}
                                  className="w-full text-left px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 rounded-xl flex items-center gap-2"
                                >
                                  <UserIcon size={14} className="opacity-40" />
                                  Apagar para mim
                                </button>
                                <button 
                                  onClick={() => handleDeleteMessage(msg.id, 'everyone')}
                                  className="w-full text-left px-4 py-2 text-xs font-bold text-red-600 hover:bg-red-50 rounded-xl flex items-center gap-2"
                                >
                                  <Globe size={14} className="opacity-40" />
                                  Apagar para todos
                                </button>
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
    </div>
  );
};

// Componente de ícone auxiliar para o menu
const UserIcon = ({ size, className }: { size: number, className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
);

const Globe = ({ size, className }: { size: number, className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
  </svg>
);
