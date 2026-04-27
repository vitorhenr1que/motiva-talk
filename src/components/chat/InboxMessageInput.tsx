'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useChatStore } from '@/store/useChatStore';
import {
  Send, Smile, Paperclip, Zap, MessageSquareText, Loader2, X, Edit2, Check, Lock,
  Image as ImageIcon, Video, FileText, UserPlus as ContactIcon, Mic, ArrowLeftCircle
} from 'lucide-react';
import { formatWhatsappText } from '@/lib/formatWhatsappText';
import { QuickReplyMenu } from '@/components/quick-replies/Menu';
import { QuickReplyManagerModal } from '@/components/quick-replies/ManagerModal';
import { ContactSelectorModal } from './ContactSelectorModal';
import { uploadFile } from '@/lib/supabase-utils';
import { supabase } from '@/lib/supabase';
import { getFileTypeInfo, mapKindToMessageType } from '@/lib/file-type';
import { FileKind, PendingFile } from '@/types/chat';
import { useChatFileDrop } from '@/hooks/useChatFileDrop';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const capitalize = (str: string) => {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
};

/**
 * Banner exibido quando o usuário está visualizando uma conversa que pertence ao tenure
 * passado do setor atualmente filtrado (modo somente leitura). Permite "retomar" a conversa,
 * o que dispara um transfer-sector de volta para o selectedSectorId — abrindo um novo tenure
 * e devolvendo a conversa à fila ativa do setor.
 */
const HistoricalSectorBanner: React.FC<{ conversationId: string; targetSectorId: string }> = ({ conversationId, targetSectorId }) => {
  const [resuming, setResuming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleResume = async () => {
    if (resuming) return;
    setResuming(true);
    setError(null);
    try {
      const res = await fetch('/api/conversations/transfer-sector', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          targetSectorId,
          note: 'Atendimento retomado'
        })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Falha ao retomar');
      // O update da conversa chega via realtime e atualiza activeConversation +
      // dispara o refetch das mensagens (via dep currentSectorId no InboxChatArea).
    } catch (e: any) {
      setError(e.message || 'Erro ao retomar conversa');
    } finally {
      setResuming(false);
    }
  };

  return (
    <div className="bg-slate-900 text-white px-8 py-5 flex items-center justify-between gap-6 animate-in slide-in-from-bottom duration-300">
      <div className="flex items-center gap-4">
        <div className="h-10 w-10 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500 border border-amber-500/20">
          <Lock size={20} />
        </div>
        <div>
          <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-white">Histórico do Setor — Somente Leitura</h4>
          <p className="text-[11px] text-slate-400 font-medium mt-1">Esta conversa foi transferida e está em modo de visualização.</p>
        </div>
      </div>
      <button
        onClick={handleResume}
        disabled={resuming}
        className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2 shadow-2xl shadow-blue-900/50 shrink-0"
      >
        {resuming ? <Loader2 size={14} className="animate-spin" /> : <ArrowLeftCircle size={14} />}
        {resuming ? 'Retomando...' : 'Retomar Atendimento'}
      </button>
      {error && (
        <p className="absolute bottom-1 left-8 text-[9px] font-bold text-rose-400">{error}</p>
      )}
    </div>
  );
};

export const MessageInput = () => {
  const [content, setContent] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachmentMenuOpen, setAttachmentMenuOpen] = useState(false);
  
  const [localPendingFile, setLocalPendingFile] = useState<PendingFile | null>(null);
  const [localMediaCaption, setLocalMediaCaption] = useState('');
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  const {
    activeConversation, addMessage, upsertMessage, messages,
    replyToMessage, setReplyToMessage,
    editingMessage, setEditingMessage,
    selectedSectorId
  } = useChatStore();

  const { isDragging, onDragOver, onDragLeave, onDrop, processFile } = useChatFileDrop((fileData) => {
    setLocalPendingFile(fileData);
    setLocalMediaCaption('');
  });

  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [repliesOpen, setRepliesOpen] = useState(false);
  const [managerOpen, setManagerOpen] = useState(false);
  const [contactSelectorOpen, setContactSelectorOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  
  useEffect(() => {
    const handleGlobalDrop = (e: any) => {
      setLocalPendingFile(e.detail);
      setLocalMediaCaption('');
      setAttachmentMenuOpen(false);
    };
    window.addEventListener('motiva_chat_file_drop', handleGlobalDrop);
    return () => window.removeEventListener('motiva_chat_file_drop', handleGlobalDrop);
  }, []);

  const [customName, setCustomName] = useState('');
  const [defaultName, setDefaultName] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);

  const [chatSettings, setChatSettings] = useState({
    autoIdentifyAgent: true,
    allowAgentNameEdit: false
  });

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
    setEditingMessage(null);
  }, [activeConversation?.id]);

  useEffect(() => {
    if (editingMessage) {
      // Strip prefix: *Name:*\n\n
      const stripped = editingMessage.content.replace(/^\*.*:\*\n\n/, '');
      setContent(stripped);
      setReplyToMessage(null); // Clear reply if editing
      
      // Auto focus and scroll to input
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    }
  }, [editingMessage]);

  const attachmentMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (attachmentMenuRef.current && !attachmentMenuRef.current.contains(e.target as Node)) {
        setAttachmentMenuOpen(false);
      }
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
        setEmojiPickerOpen(false);
      }
    };
    if (attachmentMenuOpen || emojiPickerOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [attachmentMenuOpen, emojiPickerOpen]);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
        const fullName = session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Atendente';
        const firstName = fullName.trim().split(' ')[0];
        const formattedDefault = capitalize(firstName);
        setDefaultName(formattedDefault);
        setCustomName(formattedDefault);
      }
      try {
        const res = await fetch('/api/settings/chat');
        const data = await res.json();
        if (data.success) setChatSettings(data.data);
      } catch (e) {}
    };
    init();
  }, []);

  const openFileSearch = (accept?: string) => {
    setAttachmentMenuOpen(false);
    if (fileInputRef.current) {
      fileInputRef.current.accept = accept || '*/*';
      fileInputRef.current.click();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
      e.target.value = ''; // Reset input
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (activeConversation?.status === 'CLOSED') return;
    if (e.key === 'Enter' && !e.shiftKey && !isEditingName) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === '/' && content === '' && !isEditingName) setRepliesOpen(true);
    if (e.key === 'Escape') {
      setAttachmentMenuOpen(false);
      setEmojiPickerOpen(false);
    }
  };

  const addEmoji = (emoji: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setContent(prev => prev + emoji);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = content;
    const before = text.substring(0, start);
    const after = text.substring(end);
    
    setContent(before + emoji + after);
    
    // Devolve o foco e posiciona o cursor após o emoji
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + emoji.length, start + emoji.length);
    }, 0);
  };

  const handleSend = async () => {
    if (editingMessage) {
       handleUpdateMessage();
       return;
    }

    if (!content.trim() || !activeConversation || activeConversation.status === 'CLOSED') return;

    const canEditName = activeConversation.channel?.allowAgentNameEdit ?? chatSettings.allowAgentNameEdit;
    const rawName = canEditName ? (customName || defaultName) : defaultName;
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

  const handleUpdateMessage = async () => {
    if (!editingMessage || !content.trim() || !activeConversation) return;

    const canEditName = activeConversation.channel?.allowAgentNameEdit ?? chatSettings.allowAgentNameEdit;
    const rawName = canEditName ? (customName || defaultName) : defaultName;
    const nameToUse = capitalize(rawName);
    const finalContent = `*${nameToUse}:*\n\n${content.trim()}`;

    const messageId = editingMessage.id;
    
    // Optimistic update
    upsertMessage({ ...editingMessage, content: finalContent });
    setEditingMessage(null);
    setContent('');

    try {
      const resp = await fetch(`/api/messages/${messageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: finalContent })
      });
      if (resp.ok) {
        const data = await resp.json();
        upsertMessage(data.data);
      }
    } catch (error: any) {
      console.error('Erro ao editar mensagem:', error);
    }
  };




  const handleSendMedia = async () => {
    if (!localPendingFile || !activeConversation || activeConversation.status === 'CLOSED') return;
    
    setUploading(true);
    const { file, kind, previewUrl, duration } = localPendingFile;
    const msgType = mapKindToMessageType(kind);
    
    try {
      // 1. Upload to Storage
      const publicUrl = await uploadFile(file);

      // 2. Prepare metadata
      const metadata = {
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        fileSize: file.size,
        duration: duration,
        caption: localMediaCaption
      };

      // 3. Send to API
      const resp = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: activeConversation.id,
          channelId: activeConversation.channel.id,
          senderType: 'AGENT',
          content: localMediaCaption || file.name, // Use caption as main content
          type: msgType,
          mediaUrl: publicUrl,
          fileName: file.name,
          mimeType: metadata.mimeType,
          fileSize: file.size,
          duration: duration,
          metadata: { ...metadata, caption: localMediaCaption }
        })
      });

      if (resp.ok) {
        const realMsg = await resp.json();
        addMessage(realMsg.data);
        setLocalPendingFile(null);
        URL.revokeObjectURL(previewUrl);
      } else {
        const err = await resp.json();
        alert('Falha ao enviar arquivo: ' + (err.message || 'Erro desconhecido'));
      }
    } catch (error: any) {
      console.error('Erro no fluxo de envio de mídia:', error);
      alert('Erro ao processar o arquivo.');
    } finally {
      setUploading(false);
    }
  };

  const handleSendContact = async (name: string, phone: string) => {
    if (!activeConversation || activeConversation.status === 'CLOSED') return;
    setAttachmentMenuOpen(false);
    setContactSelectorOpen(false);

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
            contact: { 
              fullName: name, 
              wuid: phone.replace(/\D/g, ''),
              phoneNumber: phone.replace(/\D/g, '')
            } 
          }
        })
      });
      if (resp.ok) {
        const realMsg = await resp.json();
        addMessage(realMsg.data);
      }
    } catch (e) {}
  };


  const textareaRef = useRef<HTMLTextAreaElement>(null);


  const EMOJI_CATEGORIES = [
    { name: 'Populares', emojis: ['😀', '😂', '😍', '👍', '🙏', '🔥', '🚀', '✅', '❤️', '🤔', '🎉', '🙌'] },
    { name: 'Caras', emojis: ['😊', '😇', '😎', '😜', '🤩', '🥳', '🥺', '😢', '😤', '😡', '😱', '🥱', '😴', '😷', '💩'] },
    { name: 'Mãos', emojis: ['👋', '👌', '✌️', '🤞', '👊', '🤛', '🤜', '👏', '🤝', '💪', '🙏', '✍️', '🤳', '💅'] },
    { name: 'Negócios', emojis: ['💼', '📈', '📊', '📅', '📝', '✉️', '📞', '💻', '💡', '🏆', '💎', '💰', '🤝'] }
  ];

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

  // Setor selecionado é diferente do setor atual da conversa → visualização histórica somente leitura
  const isHistoricalSector = !!(
    selectedSectorId &&
    activeConversation.currentSectorId &&
    selectedSectorId !== activeConversation.currentSectorId
  );

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

  if (isHistoricalSector) {
    return <HistoricalSectorBanner conversationId={activeConversation.id} targetSectorId={selectedSectorId!} />;
  }

  return (
    <div 
      className={cn(
        "border-t bg-white relative transition-all",
        isDragging && "ring-8 ring-blue-500/20 bg-blue-50/50"
      )}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {isDragging && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-blue-600/10 backdrop-blur-[2px] pointer-events-none">
           <div className="bg-white px-8 py-4 rounded-3xl shadow-2xl border-2 border-dashed border-blue-400 animate-in zoom-in-95 duration-300">
             <p className="text-blue-600 font-black uppercase tracking-[0.2em] text-sm pointer-events-none">Solte para enviar arquivo</p>
           </div>
        </div>
      )}
       {/* Media Preview Overlay */}
       {localPendingFile && (
         <div className="absolute bottom-0 left-0 right-0 z-[100] bg-slate-900 flex flex-col items-center justify-center p-6 animate-in slide-in-from-bottom duration-300 min-h-[400px]">
            <button 
              onClick={() => { setLocalPendingFile(null); URL.revokeObjectURL(localPendingFile.previewUrl); }}
              className="absolute top-6 right-6 p-2 rounded-full bg-slate-800 text-white hover:bg-slate-700 transition-colors"
            >
              <X size={24} />
            </button>

            <div className="flex-1 w-full max-w-2xl flex flex-col items-center justify-center gap-6">
              {localPendingFile.kind === 'IMAGE' && (
                <img src={localPendingFile.previewUrl} className="max-h-[300px] rounded-2xl shadow-2xl object-contain border-4 border-white/10" alt="Preview" />
              )}
              {localPendingFile.kind === 'VIDEO' && (
                <video src={localPendingFile.previewUrl} controls className="max-h-[300px] rounded-2xl shadow-2xl bg-black border-4 border-white/10" />
              )}
              {(localPendingFile.kind === 'DOCUMENT' || localPendingFile.kind === 'PDF') && (
                <div className="flex flex-col items-center gap-4 p-12 bg-slate-800 rounded-[32px] border border-white/5 shadow-2xl w-full text-center">
                   {localPendingFile.kind === 'PDF' && (
                     <div className="w-full h-[400px] rounded-2xl overflow-hidden bg-white mb-4">
                       <iframe src={localPendingFile.previewUrl} className="w-full h-full border-none" title="PDF Preview" />
                     </div>
                   )}
                   {(localPendingFile.kind === 'DOCUMENT') && (
                      <div className="p-6 bg-orange-500/10 rounded-3xl text-orange-500 mb-2">
                        <FileText size={64} />
                      </div>
                   )}
                   <div className="text-center">
                     <p className="text-white font-black text-lg truncate max-w-[400px] inline-block">{localPendingFile.file.name}</p>
                     <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">{(localPendingFile.file.size / 1024 / 1024).toFixed(2)} MB • {localPendingFile.file.name.split('.').pop()?.toUpperCase()}</p>
                   </div>
                </div>
              )}
              {localPendingFile.kind === 'AUDIO' && (
                 <div className="flex flex-col items-center gap-4 p-12 bg-slate-800 rounded-[32px] border border-white/5 shadow-2xl w-full">
                   <div className="p-6 bg-red-500/10 rounded-3xl text-red-500">
                     <Mic size={64} />
                   </div>
                   <audio src={localPendingFile.previewUrl} controls className="w-full max-w-md" />
                   <div className="text-center">
                     <p className="text-white font-black text-lg truncate max-w-[400px] inline-block">{localPendingFile.file.name}</p>
                     <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Áudio detectado</p>
                   </div>
                 </div>
              )}

              <div className="w-full relative group">
                <input 
                  type="text" 
                  autoFocus
                  placeholder="Adicionar legenda..."
                  value={localMediaCaption}
                  onChange={(e) => setLocalMediaCaption(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMedia()}
                  className="w-full bg-slate-800 border-2 border-slate-700 rounded-2xl py-4 px-6 text-white placeholder:text-slate-500 outline-none focus:border-blue-500 transition-all shadow-xl"
                />
                <button 
                  onClick={handleSendMedia}
                  disabled={uploading}
                  className="absolute right-3 top-1/2 -translate-y-1/2 bg-blue-600 text-white p-3 rounded-xl hover:bg-blue-500 disabled:opacity-50 transition-all active:scale-95 shadow-lg"
                >
                  {uploading ? <Loader2 size={24} className="animate-spin" /> : <Send size={24} />}
                </button>
              </div>
            </div>
         </div>
       )}

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
                      <MessageSquareText size={10} fill="currentColor" />
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
              <span className="text-[11px] font-extrabold text-slate-800 leading-none">
                *{(activeConversation.channel?.allowAgentNameEdit ?? chatSettings.allowAgentNameEdit) ? customName : defaultName}:*
              </span>
              {(activeConversation.channel?.allowAgentNameEdit ?? chatSettings.allowAgentNameEdit) && (
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

      {editingMessage && (
        <div className="mb-4 flex items-start gap-3 rounded-2xl bg-emerald-50 p-4 border border-emerald-200 animate-in slide-in-from-bottom-2 duration-300 relative group overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-emerald-600" />
          <div className="flex-1 overflow-hidden">
            <div className="flex items-center gap-2 mb-1">
              <Edit2 size={10} className="text-emerald-600" />
              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Editando Mensagem</p>
            </div>
            <p className="truncate text-xs text-slate-500 italic">{formatWhatsappText(editingMessage.content)}</p>
          </div>
          <button 
            onClick={() => {
              setEditingMessage(null);
              setContent('');
            }} 
            className="rounded-xl p-1.5 text-slate-400 hover:bg-white hover:text-red-500 hover:shadow-sm transition-all"
          >
            <X size={18} />
          </button>
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
          
          <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileSelect} />

          {attachmentMenuOpen && (
            <div ref={attachmentMenuRef} className="absolute bottom-full left-0 mb-4 w-48 bg-white rounded-2xl shadow-2xl border border-slate-100 p-2 z-[60] animate-in fade-in slide-in-from-bottom-2 duration-200">
               <button onClick={() => openFileSearch('image/*')} className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 rounded-xl flex items-center gap-3 transition-colors">
                 <ImageIcon size={16} className="text-purple-500" />
                 Foto
               </button>
               <button onClick={() => openFileSearch('video/*')} className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 rounded-xl flex items-center gap-3 transition-colors">
                 <Video size={16} className="text-blue-500" />
                 Vídeo
               </button>
               <button onClick={() => openFileSearch('.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip,.rar')} className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 rounded-xl flex items-center gap-3 transition-colors">
                 <FileText size={16} className="text-orange-500" />
                 Documento
               </button>
               <button onClick={() => openFileSearch('audio/*')} className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 rounded-xl flex items-center gap-3 transition-colors">
                 <Mic size={16} className="text-red-500" />
                 Áudio
               </button>
               <div className="h-px bg-slate-100 my-1 mx-2" />
               <button onClick={() => { setAttachmentMenuOpen(false); setContactSelectorOpen(true); }} className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 rounded-xl flex items-center gap-3 transition-colors">
                 <ContactIcon size={16} className="text-green-500" />
                 Contato
               </button>
            </div>
          )}

          <button type="button" onClick={() => setRepliesOpen(true)} className="rounded-xl p-2.5 text-slate-400 hover:bg-slate-50 hover:text-blue-600 transition-all active:scale-90"><MessageSquareText size={22} /></button>
        </div>

        <div className="relative flex-1 group">
          <textarea
            ref={textareaRef}
            value={content}
            onFocus={() => { if (content.length > 0) sendPresence('composing'); }}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite sua mensagem profissional..."
            className="block w-full resize-none rounded-2xl border-slate-200 bg-slate-50 py-3.5 pl-5 pr-12 text-sm font-medium text-slate-800 shadow-inner focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 outline-none transition-all placeholder:text-slate-400 min-h-[52px] max-h-40"
            rows={1}
          />
          <div className="absolute right-4 bottom-3 flex items-center gap-2">
            <button 
              type="button"
              onClick={() => setEmojiPickerOpen(!emojiPickerOpen)}
              className={cn(
                "text-slate-300 hover:text-blue-500 transition-colors active:scale-90",
                emojiPickerOpen && "text-blue-500"
              )}
            >
              <Smile size={20} />
            </button>
            
            {emojiPickerOpen && (
              <div 
                ref={emojiPickerRef}
                className="absolute bottom-full right-0 mb-4 w-72 bg-white rounded-[24px] shadow-[0_20px_50px_rgba(0,0,0,0.2)] border border-slate-100 overflow-hidden z-[70] animate-in fade-in slide-in-from-bottom-4 duration-300"
              >
                <div className="p-4 bg-slate-50/50 border-b border-slate-100">
                   <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Selecione um Emoji</h3>
                </div>
                <div className="max-h-60 overflow-y-auto p-4 custom-scrollbar">
                  {EMOJI_CATEGORIES.map((cat) => (
                    <div key={cat.name} className="mb-4 last:mb-0">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">{cat.name}</p>
                      <div className="grid grid-cols-6 gap-1">
                        {cat.emojis.map((emoji) => (
                          <button 
                            key={emoji}
                            onClick={() => addEmoji(emoji)}
                            className="text-xl p-2 hover:bg-slate-50 rounded-xl transition-all hover:scale-120 active:scale-90 flex items-center justify-center"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="p-2 bg-slate-50/50 border-t border-slate-100 flex justify-end">
                   <button 
                    onClick={() => setEmojiPickerOpen(false)}
                    className="text-[9px] font-black text-blue-600 uppercase tracking-widest px-3 py-1.5 hover:bg-white rounded-lg transition-all"
                   >
                     Fechar
                   </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <button
          onClick={handleSend}
          disabled={!content.trim() || uploading || isEditingName}
          className={cn(
            "flex h-[52px] w-[52px] items-center justify-center rounded-2xl transition-all shadow-xl active:scale-95 disabled:opacity-30 disabled:hover:scale-100",
            editingMessage 
              ? "bg-emerald-600 text-white shadow-emerald-200 hover:bg-emerald-700 hover:scale-105" 
              : "bg-slate-900 text-white shadow-slate-200 hover:bg-black hover:scale-105"
          )}
        >
          {uploading ? (
            <Loader2 className="animate-spin" size={20} />
          ) : editingMessage ? (
            <Check size={20} />
          ) : (
            <Send size={20} className="ml-0.5" />
          )}
        </button>
      </div>
    </div>

    {repliesOpen && (
        <QuickReplyMenu 
          search={content.startsWith('/') ? content.slice(1) : content} 
          onSelect={(replyContent) => { setContent(replyContent); setRepliesOpen(false); }} 
          onClose={() => setRepliesOpen(false)}
          onOpenManager={() => { setRepliesOpen(false); setManagerOpen(true); }}
        />
      )}
      {managerOpen && (
        <QuickReplyManagerModal 
          onClose={() => setManagerOpen(false)} 
          onSelect={(replyContent) => { 
            setContent(replyContent); 
            setManagerOpen(false); 
          }} 
        />
      )}
      {contactSelectorOpen && (
        <ContactSelectorModal 
          onClose={() => setContactSelectorOpen(false)} 
          onSelect={(contact) => handleSendContact(contact.name, contact.phone)} 
        />
      )}
    </div>
  );
};
