'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useChatStore } from '@/store/useChatStore';
import { Send, Smile, Paperclip, Zap, Loader2 } from 'lucide-react';
import { QuickReplyMenu } from '@/components/quick-replies/Menu';
import { QuickReplyManagerModal } from '@/components/quick-replies/ManagerModal';
import { uploadFile } from '@/lib/supabase-utils';

export const MessageInput = () => {
  const [content, setContent] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [repliesOpen, setRepliesOpen] = useState(false);
  const [repliesSearch, setRepliesSearch] = useState('');
  const [managerOpen, setManagerOpen] = useState(false);
  const { activeConversation, addMessage, messages } = useChatStore();

  const handleSend = async () => {
    if (!content.trim() || !activeConversation) return;

    const newMsg = {
      id: Math.random().toString(),
      content,
      senderType: 'AGENT',
      type: 'TEXT',
      createdAt: new Date().toISOString()
    } as any;
    
    addMessage(newMsg);
    setContent('');
    setSuggestions([]);
    setRepliesOpen(false);

    try {
      const resp = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: activeConversation.id,
          channelId: activeConversation.channel.id,
          senderType: 'AGENT',
          content
        })
      });

      if (resp.ok) {
        const realMsg = await resp.json();
        // O Realtime também vai receber essa mensagem, mas a store vai dedup pelo ID se usarmos o ID real retornado.
        // Se a store for atualizada antes do Realtime, ótimo.
        addMessage(realMsg);
      }
    } catch (error) {
      console.error('API integration error:', error);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeConversation) return;

    setUploading(true);
    try {
      const publicUrl = await uploadFile(file);
      
      // Determinar o tipo de mensagem pelo tipo de arquivo
      let messageType: 'IMAGE' | 'AUDIO' | 'DOCUMENT' = 'DOCUMENT';
      if (file.type.startsWith('image/')) messageType = 'IMAGE';
      if (file.type.startsWith('audio/')) messageType = 'AUDIO';

      // Criar a mensagem via API
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
        addMessage(realMsg);
      }
    } catch (error: any) {
      console.error('File upload failed:', error);
      alert(`Erro ao enviar arquivo: ${error?.message || 'Erro desconhecido'}`);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleContentChange = (val: string) => {
    setContent(val);
    if (val.startsWith('/')) {
      setRepliesOpen(true);
      setRepliesSearch(val.slice(1));
    } else {
      setRepliesOpen(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (repliesOpen && (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Enter')) {
      e.preventDefault();
      return;
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (!activeConversation || messages.length === 0) {
        setSuggestions([]);
        return;
      }

      // Encontrar a última mensagem enviada pelo contato (USER)
      const lastUserMessage = [...messages]
        .reverse()
        .find(m => m.senderType === 'USER');

      if (lastUserMessage && lastUserMessage.content) {
        try {
          const response = await fetch('/api/suggestions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              content: lastUserMessage.content,
              channelId: activeConversation.channel.id
            })
          });
          
          if (response.ok) {
            const data = await response.json();
            setSuggestions(data);
          }
        } catch (error) {
          console.error('Failed to fetch suggestions:', error);
        }
      } else {
        setSuggestions([]);
      }
    };

    fetchSuggestions();
  }, [activeConversation, messages]);

  if (!activeConversation) return null;

  return (
    <div className="border-t bg-white p-3 relative shadow-inner">
      {/* Quick Reply Context Menu */}
      {repliesOpen && (
        <QuickReplyMenu
          search={repliesSearch}
          onSelect={(val) => { setContent(val); setRepliesOpen(false); }}
          onClose={() => setRepliesOpen(false)}
        />
      )}

      {/* Suggestion Bar */}
      {suggestions.length > 0 && (
        <div className="mb-3 flex items-center gap-3 overflow-x-auto pb-1 scrollbar-none animate-in slide-in-from-bottom-2 fade-in duration-300">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
             <Smile size={14} className="animate-pulse" />
          </div>
          <div className="flex gap-2 shrink-0">
            {suggestions.map((sug) => (
              <button
                key={sug.id}
                onClick={() => setContent(sug.response)}
                className="group flex flex-col items-start rounded-xl border border-blue-100 bg-blue-50/50 px-3 py-1.5 transition-all hover:bg-blue-600 hover:border-blue-600 shadow-sm"
              >
                <span className="text-[9px] font-bold uppercase tracking-wider text-blue-400 group-hover:text-blue-200">{sug.category || 'Sugestão'}</span>
                <span className="text-xs font-bold text-blue-700 group-hover:text-white">{sug.keyword}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <div className="flex gap-1">
          <input 
            type="file" 
            className="hidden" 
            ref={fileInputRef} 
            onChange={handleFileUpload}
            accept="image/*,audio/*,application/pdf"
          />
          <button className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 transition-colors">
            <Smile size={24} />
          </button>
          <button 
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 transition-colors disabled:opacity-30"
          >
            {uploading ? <Loader2 size={24} className="animate-spin text-blue-500" /> : <Paperclip size={24} />}
          </button>
          <button 
            onClick={() => setManagerOpen(true)}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 transition-colors"
          >
            <Zap size={22} className="fill-current opacity-40 hover:opacity-100 transition-opacity" />
          </button>
        </div>

        <div className="flex-1">
          <textarea
            value={content}
            onChange={(e) => handleContentChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite uma mensagem... (use '/' para atalhos)"
            className="w-full resize-none rounded-lg border-none bg-slate-100 px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-slate-300 max-h-32"
            rows={1}
          />
        </div>

        <button
          onClick={handleSend}
          disabled={!content.trim()}
          className="rounded-lg bg-blue-600 p-2.5 text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 transition-all hover:scale-105 active:scale-95"
        >
          <Send size={20} />
        </button>

        {managerOpen && <QuickReplyManagerModal onClose={() => setManagerOpen(false)} />}
      </div>
    </div>
  );
};
