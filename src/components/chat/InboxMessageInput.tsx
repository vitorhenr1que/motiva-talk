'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useChatStore } from '@/store/useChatStore';
import { Send, Smile, Paperclip, Zap, Loader2, X, Edit2, Check } from 'lucide-react';
import { formatWhatsappText } from '@/lib/formatWhatsappText';
import { QuickReplyMenu } from '@/components/quick-replies/Menu';
import { QuickReplyManagerModal } from '@/components/quick-replies/ManagerModal';
import { uploadFile } from '@/lib/supabase-utils';
import { supabase } from '@/lib/supabase';

/**
 * Função utilitária para garantir primeira letra maiúscula
 */
const capitalize = (str: string) => {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
};

/**
 * InboxMessageInput Component
 * Gerencia o campo de composição de mensagens, incluindo identificação do atendente,
 * respostas rápidas (quick replies) e anexos de mídia.
 */
export const MessageInput = () => {
  const [content, setContent] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [repliesOpen, setRepliesOpen] = useState(false);
  const [managerOpen, setManagerOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  
  // Customização do nome do atendente
  const [customName, setCustomName] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);

  // Configurações globais
  const [chatSettings, setChatSettings] = useState({
    autoIdentifyAgent: true,
    allowAgentNameEdit: false
  });

  const { activeConversation, addMessage, upsertMessage, messages, replyToMessage, setReplyToMessage } = useChatStore();

  // --- Lógica de Presence (Indicador de Digitando) ---
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isTyping, setIsTyping] = useState(false);

  // Efeito para enviar status 'digitando' (composing)
  useEffect(() => {
    if (!activeConversation) return;

    // Se começou a digitar e ainda não enviou 'composing'
    if (content.length > 0 && !isTyping) {
      setIsTyping(true);
      sendPresence('composing');
    }

    // Se apagou tudo
    if (content.length === 0 && isTyping) {
      setIsTyping(false);
      sendPresence('paused');
    }

    // Debounce para parar o indicador após 3 segundos de inatividade
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    typingTimeoutRef.current = setTimeout(() => {
      if (isTyping) {
        setIsTyping(false);
        sendPresence('paused');
      }
    }, 3000);

    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [content, activeConversation?.id]);

  const sendPresence = async (presence: 'composing' | 'paused') => {
    if (!activeConversation) return;
    try {
      fetch('/api/messages/presence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: activeConversation.id, presence })
      }).catch(() => {}); // Falha silenciosa para presença
    } catch (e) {}
  };

  // Resetar estados locais ao trocar de conversa ativa
  useEffect(() => {
    setRepliesOpen(false);
    setContent('');
    setSuggestions([]);
    setIsTyping(false);
  }, [activeConversation?.id]);

  // Carregar dados de sessão e configurações globais
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
    if (!content.trim() || !activeConversation) return;

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
    sendPresence('paused'); // Para o digitando ao enviar

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
    } catch (error) {
      console.error('[AGENT_ID] Erro:', error);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeConversation) return;

    setUploading(true);
    try {
      const publicUrl = await uploadFile(file);
      let messageType: 'IMAGE' | 'AUDIO' | 'DOCUMENT' = 'DOCUMENT';
      if (file.type.startsWith('image/')) messageType = 'IMAGE';
      if (file.type.startsWith('audio/')) messageType = 'AUDIO';

      const resp = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: activeConversation.id,
          channelId: activeConversation.channel.id,
          senderType: 'AGENT',
          content: publicUrl,
          type: messageType
        })
      });

      if (resp.ok) {
        const realMsg = await resp.json();
        addMessage(realMsg.data);
      }
    } catch (error) {
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !isEditingName) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === '/' && content === '' && !isEditingName) setRepliesOpen(true);
  };

  useEffect(() => {
    if (!activeConversation || !messages) return;
    const lastMsg = messages.filter(m => m.senderType === 'USER').pop();
    if (!lastMsg) { setSuggestions([]); return; }

    const fetchSug = async () => {
      try {
        const res = await fetch(`/api/suggestions?messageContent=${encodeURIComponent(lastMsg.content)}&channelId=${activeConversation.channel.id}`);
        const data = await res.json();
        setSuggestions(data.data || []);
      } catch (e) {}
    };
    fetchSug();
  }, [activeConversation, messages]);

  if (!activeConversation) return null;

  return (
    <div className="relative border-t bg-white p-4">
       {/* Preview e Sugestões */}
       <div className="absolute bottom-full left-0 right-0 p-4 pointer-events-none flex flex-col gap-2">
          {content.match(/[*_~`]|https?:\/\//) && (
            <div className="bg-white/90 backdrop-blur-md rounded-2xl p-4 shadow-2xl border border-blue-100 self-start max-w-[80%] animate-in slide-in-from-bottom-2 duration-300">
              <div className="flex items-center gap-2 mb-2 font-black uppercase tracking-widest text-blue-600/60 text-[10px]">
                <div className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
                Sintaxe WhatsApp Ativa
              </div>
              <div className="text-sm text-slate-700 whitespace-pre-wrap break-words leading-relaxed pointer-events-auto">
                {formatWhatsappText(content)}
              </div>
            </div>
          )}

          {suggestions.length > 0 && !repliesOpen && (
            <div className="flex flex-wrap gap-2 animate-in fade-in slide-in-from-left-4 duration-500 pointer-events-auto">
              {suggestions.map((sug, i) => (
                <button
                  key={i}
                  onClick={() => setContent(sug.response)}
                  className="rounded-full bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-blue-200 ring-2 ring-white hover:bg-blue-700 hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
                >
                  <Zap size={14} fill="currentColor" />
                  {sug.keyword}
                </button>
              ))}
            </div>
          )}
       </div>

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
        {!isEditingName && <span className="text-[10px] font-medium text-slate-400 italic">Incluído no cabeçalho</span>}
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
        <div className="flex items-center gap-1 pb-1">
          <button type="button" onClick={() => fileInputRef.current?.click()} className="rounded-xl p-2.5 text-slate-400 hover:bg-slate-50 hover:text-blue-600 transition-all active:scale-90"><Paperclip size={22} /></button>
          <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
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

      {repliesOpen && <QuickReplyMenu search={content.startsWith('/') ? content.slice(1) : content} onSelect={(replyContent) => { setContent(replyContent); setRepliesOpen(false); }} onClose={() => setRepliesOpen(false)} />}
      {managerOpen && <QuickReplyManagerModal onClose={() => setManagerOpen(false)} />}
    </div>
  );
};
