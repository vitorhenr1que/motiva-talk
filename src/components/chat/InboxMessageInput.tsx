'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useChatStore } from '@/store/useChatStore';
import { 
  Send, Smile, Paperclip, Zap, Loader2, X, Edit2, Check, Lock, 
  Image as ImageIcon, Video, FileText, UserPlus as ContactIcon 
} from 'lucide-react';
import { formatWhatsappText } from '@/lib/formatWhatsappText';
import { QuickReplyMenu } from '@/components/quick-replies/Menu';
import { QuickReplyManagerModal } from '@/components/quick-replies/ManagerModal';
import { uploadFile } from '@/lib/supabase-utils';
import { supabase } from '@/lib/supabase';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const capitalize = (str: string) => {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
};

export const MessageInput = () => {
  const [content, setContent] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachmentMenuOpen, setAttachmentMenuOpen] = useState(false);
  const [fileType, setFileType] = useState<'IMAGE' | 'VIDEO' | 'DOCUMENT' | null>(null);

  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [repliesOpen, setRepliesOpen] = useState(false);
  const [managerOpen, setManagerOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  
  const [customName, setCustomName] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);

  const [chatSettings, setChatSettings] = useState({
    autoIdentifyAgent: true,
    allowAgentNameEdit: false
  });

  const { activeConversation, addMessage, upsertMessage, messages, replyToMessage, setReplyToMessage } = useChatStore();

  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    if (!activeConversation || activeConversation.status === 'CLOSED') return;
    if (content.length > 0 && !isTyping) {
      setIsTyping(true);
      sendPresence('composing');
    }
    if (content.length === 0 && isTyping) {
      setIsTyping(false);
      sendPresence('paused');
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      if (isTyping) {
        setIsTyping(false);
        sendPresence('paused');
      }
    }, 3000);
    return () => { if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current); };
  }, [content, activeConversation?.id, activeConversation?.status]);

  const sendPresence = async (presence: 'composing' | 'paused') => {
    if (!activeConversation || activeConversation.status === 'CLOSED') return;
    try {
      fetch('/api/messages/presence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: activeConversation.id, presence })
      }).catch(() => {});
    } catch (e) {}
  };

  useEffect(() => {
    setRepliesOpen(false);
    setContent('');
    setSuggestions([]);
    setIsTyping(false);
    setAttachmentMenuOpen(false);
  }, [activeConversation?.id]);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
        const fullName = session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Atendente';
        const firstName = fullName.trim().split(' ')[0];
        setCustomName(capitalize(firstName));
      }
      try {
        const res = await fetch('/api/settings/chat');
        const data = await res.json();
        if (data.success) setChatSettings(data.data);
      } catch (e) {}
    };
    init();
  }, []);

  const handleSend = async () => {
    if (!content.trim() || !activeConversation || activeConversation.status === 'CLOSED') return;

    const rawName = customName || user?.user_metadata?.full_name?.split(' ')[0] || 'Atendente';
    const nameToUse = capitalize(rawName);
    const finalContent = `*${nameToUse}:*\n\n${content.trim()}`;

    const replyToId = replyToMessage?.id;
    const tempId = `temp-${Date.now()}`;

    const newMsg = {
      id: tempId,
      content: finalContent,
      senderType: 'AGENT',
      type: 'TEXT',
      status: 'sending',
      createdAt: new Date().toISOString(),
      replyToMessage: replyToMessage 
    } as any;
    
    upsertMessage(newMsg);
    setContent('');
    setSuggestions([]);
    setRepliesOpen(false);
    setReplyToMessage(null);
    setIsTyping(false);
    sendPresence('paused');

    try {
      const resp = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: activeConversation.id,
          channelId: activeConversation.channel.id,
          senderType: 'AGENT',
          content: finalContent,
          replyToMessageId: replyToId
        })
      });
      if (resp.ok) {
        const realMsg = await resp.json();
        upsertMessage(realMsg.data, tempId);
      }
    } catch (error) {}
  };

  const openFileSearch = (type: 'IMAGE' | 'VIDEO' | 'DOCUMENT') => {
    setFileType(type);
    setAttachmentMenuOpen(false);
    if (fileInputRef.current) {
      if (type === 'IMAGE') fileInputRef.current.accept = 'image/*';
      else if (type === 'VIDEO') fileInputRef.current.accept = 'video/*';
      else fileInputRef.current.accept = '.pdf,.doc,.docx,.xls,.xlsx,.txt';
      fileInputRef.current.click();
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeConversation || activeConversation.status === 'CLOSED') return;
    setUploading(true);
    try {
      const publicUrl = await uploadFile(file);
      const messageType = fileType || 'DOCUMENT';

      const resp = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: activeConversation.id,
          channelId: activeConversation.channel.id,
          senderType: 'AGENT',
          content: publicUrl,
          type: messageType,
          metadata: { fileName: file.name }
        })
      });
      if (resp.ok) {
        const realMsg = await resp.json();
        addMessage(realMsg.data);
      }
    } catch (error) {
    } finally {
      setUploading(false);
      setFileType(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSendContact = async () => {
    if (!activeConversation || activeConversation.status === 'CLOSED') return;
    setAttachmentMenuOpen(false);
    
    const name = prompt('Nome do contato:');
    if (!name) return;
    const phone = prompt('Número do WhatsApp (com DDD):');
    if (!phone) return;

    try {
      const resp = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: activeConversation.id,
          channelId: activeConversation.channel.id,
          senderType: 'AGENT',
          content: `Contato: ${name}`,
          type: 'CONTACT',
          metadata: { 
            contact: { fullName: name, wuid: phone.replace(/\D/g, '') } 
          }
        })
      });
      if (resp.ok) {
        const realMsg = await resp.json();
        addMessage(realMsg.data);
      }
    } catch (e) {}
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (activeConversation?.status === 'CLOSED') return;
    if (e.key === 'Enter' && !e.shiftKey && !isEditingName) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === '/' && content === '' && !isEditingName) setRepliesOpen(true);
  };

  useEffect(() => {
    if (!activeConversation || !messages) return;
    const lastMsg = messages.filter(m => m.senderType === 'USER').pop();
    if (!lastMsg) { 
      setSuggestions([]); 
      return; 
    }

    const fetchSug = async () => {
      try {
        const res = await fetch('/api/suggestions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            content: lastMsg.content,
            channelId: activeConversation.channel?.id 
          }),
        });
        if (res.ok) {
          const data = await res.json();
          // console.log('[AI_DEBUG] Sugestoes recebidas:', data.data);
          setSuggestions(data.data || []);
        }
      } catch (e) {
        console.error('[AI_DEBUG] Falha ao buscar sugestoes:', e);
      }
    };
    fetchSug();
  }, [activeConversation?.id, messages.length]); // Depende do ID da conv e do número de mensagens

  if (!activeConversation) return null;

  const isClosed = activeConversation.status === 'CLOSED';

  if (isClosed) {
    return (
      <div className="border-t bg-slate-50/50 p-6 flex flex-col items-center justify-center gap-2">
         <div className="flex items-center gap-2 text-slate-400">
           <Lock size={16} />
           <p className="text-xs font-black uppercase tracking-widest">Chat Bloqueado</p>
         </div>
         <p className="text-[11px] text-slate-400 font-medium">Este atendimento foi finalizado. Reabra-o no menu superior para enviar novas mensagens.</p>
      </div>
    );
  }

  return (
    <div className="border-t bg-white">
       {(suggestions.length > 0 && !repliesOpen || content.match(/[*_~`]|https?:\/\//)) && (
         <div className="px-4 py-3 bg-slate-50/50 border-b border-slate-100 flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Sintaxe WhatsApp Preview */}
            {content.match(/[*_~`]|https?:\/\//) && (
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-blue-100 self-start max-w-[80%]">
                <div className="flex items-center gap-2 mb-2 font-black uppercase tracking-widest text-blue-600/60 text-[10px]">
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
                  Sintaxe WhatsApp Ativa
                </div>
                <div className="text-sm text-slate-700 whitespace-pre-wrap break-words leading-relaxed">
                  {formatWhatsappText(content)}
                </div>
              </div>
            )}

            {/* AI Suggestions Cards */}
            {suggestions.length > 0 && !repliesOpen && (
              <div className="flex flex-col gap-2 group/suggestions">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <div className="h-5 w-5 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 shadow-sm">
                      <Zap size={10} fill="currentColor" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600/70">Sugestões de IA</span>
                  </div>
                  <button 
                    onClick={() => setSuggestions([])}
                    className="p-1 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all"
                    title="Ocultar sugestões"
                  >
                    <X size={14} />
                  </button>
                </div>

                <div className="flex gap-4 py-1 overflow-x-auto no-scrollbar snap-x snap-mandatory scroll-smooth pr-6">
                  {suggestions.map((sug, i) => (
                    <button 
                      key={i} 
                      onClick={() => setContent(sug.response)} 
                      className="group/card flex items-start gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:bg-blue-600 hover:border-blue-600 transition-all w-[320px] min-w-[320px] text-left animate-in zoom-in-95 duration-200 shrink-0 snap-start"
                    >
                      <div className="mt-0.5 h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 group-hover/card:bg-white/20 group-hover:text-white shrink-0 transition-colors">
                        <Zap size={15} fill="currentColor" />
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-600 group-hover/card:text-white/80 transition-colors mb-1.5">
                          {sug.keyword}
                        </h4>
                        <p className="text-[12px] font-medium text-slate-600 group-hover/card:text-white transition-colors line-clamp-3 leading-relaxed">
                          {sug.response}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
         </div>
       )}

      <div className="p-4">
        <div className="mb-3 flex items-center gap-2 group">
        <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-100/80 rounded-full border border-slate-200/60 shadow-sm transition-all hover:bg-slate-200/80">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">ID:</span>
          {isEditingName ? (
            <div className="flex items-center gap-1 animate-in fade-in duration-200">
              <input autoFocus type="text" value={customName} onChange={(e) => setCustomName(e.target.value)} onBlur={() => setIsEditingName(false)} onKeyDown={(e) => e.key === 'Enter' && setIsEditingName(false)} className="bg-white border-b border-blue-400 px-1 py-0 text-[11px] font-bold text-slate-800 focus:outline-none w-24" />
              <button onClick={() => setIsEditingName(false)} className="text-blue-600 hover:text-blue-700"><Check size={12} /></button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-extrabold text-slate-800 leading-none">*{customName}:*</span>
              {chatSettings.allowAgentNameEdit && (
                <button onClick={() => setIsEditingName(true)} className="text-slate-400 hover:text-blue-600 transition-colors opacity-0 group-hover:opacity-100 ml-0.5"><Edit2 size={11} /></button>
              )}
            </div>
          )}
        </div>
      </div>

      {replyToMessage && (
        <div className="mb-4 flex items-start gap-3 rounded-2xl bg-slate-50 p-4 border border-slate-200 animate-in slide-in-from-bottom-2 duration-300 relative group overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-blue-600" />
          <div className="flex-1 overflow-hidden">
            <p className="text-[10px] font-black uppercase tracking-widest text-blue-600 mb-1">Respondendo para</p>
            <p className="truncate text-sm font-bold text-slate-700">{replyToMessage.senderType === 'USER' ? activeConversation?.contact?.name : 'Você'}</p>
            <p className="truncate text-xs text-slate-500 italic mt-0.5">{formatWhatsappText(replyToMessage.content)}</p>
          </div>
          <button onClick={() => setReplyToMessage(null)} className="rounded-xl p-1.5 text-slate-400 hover:bg-white hover:text-red-500 hover:shadow-sm transition-all"><X size={18} /></button>
        </div>
      )}

      <div className="flex items-end gap-3 max-w-[1200px] mx-auto">
        <div className="flex items-center gap-1 pb-1 relative">
          <button 
            type="button" 
            onClick={() => setAttachmentMenuOpen(!attachmentMenuOpen)} 
            className={cn(
               "rounded-xl p-2.5 transition-all active:scale-90",
               attachmentMenuOpen ? "bg-blue-600 text-white shadow-lg" : "text-slate-400 hover:bg-slate-50 hover:text-blue-600"
            )}
          >
            <Paperclip size={22} className={cn(attachmentMenuOpen && "rotate-45 transition-transform")} />
          </button>
          
          <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />

          {attachmentMenuOpen && (
            <div className="absolute bottom-full left-0 mb-4 w-48 bg-white rounded-2xl shadow-2xl border border-slate-100 p-2 z-[60] animate-in fade-in slide-in-from-bottom-2 duration-200">
               <button onClick={() => openFileSearch('IMAGE')} className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 rounded-xl flex items-center gap-3 transition-colors">
                 <ImageIcon size={16} className="text-purple-500" />
                 Foto
               </button>
               <button onClick={() => openFileSearch('VIDEO')} className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 rounded-xl flex items-center gap-3 transition-colors">
                 <Video size={16} className="text-blue-500" />
                 Vídeo
               </button>
               <button onClick={() => openFileSearch('DOCUMENT')} className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 rounded-xl flex items-center gap-3 transition-colors">
                 <FileText size={16} className="text-orange-500" />
                 Documento
               </button>
               <div className="h-px bg-slate-100 my-1 mx-2" />
               <button onClick={handleSendContact} className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 rounded-xl flex items-center gap-3 transition-colors">
                 <ContactIcon size={16} className="text-green-500" />
                 Contato
               </button>
            </div>
          )}

          <button type="button" onClick={() => setRepliesOpen(true)} className="rounded-xl p-2.5 text-slate-400 hover:bg-slate-50 hover:text-blue-600 transition-all active:scale-90"><Zap size={22} /></button>
        </div>

        <div className="relative flex-1 group">
          <textarea
            value={content}
            onFocus={() => { if (content.length > 0) sendPresence('composing'); }}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite sua mensagem profissional..."
            className="block w-full resize-none rounded-2xl border-slate-200 bg-slate-50 py-3.5 pl-5 pr-12 text-sm font-medium text-slate-800 shadow-inner focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 outline-none transition-all placeholder:text-slate-400 min-h-[52px] max-h-40"
            rows={1}
          />
          <button className="absolute right-4 bottom-3 text-slate-300 hover:text-blue-500 transition-colors"><Smile size={20} /></button>
        </div>

        <button
          onClick={handleSend}
          disabled={!content.trim() || uploading || isEditingName}
          className="flex h-[52px] w-[52px] items-center justify-center rounded-2xl bg-slate-900 text-white shadow-xl shadow-slate-200 transition-all hover:bg-black hover:scale-105 active:scale-95 disabled:opacity-30 disabled:hover:scale-100"
        >
          {uploading ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} className="ml-0.5" />}
        </button>
      </div>

      </div>

      {repliesOpen && <QuickReplyMenu search={content.startsWith('/') ? content.slice(1) : content} onSelect={(replyContent) => { setContent(replyContent); setRepliesOpen(false); }} onClose={() => setRepliesOpen(false)} />}
      {managerOpen && <QuickReplyManagerModal onClose={() => setManagerOpen(false)} />}
    </div>
  );
};
