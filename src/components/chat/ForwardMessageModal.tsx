import React, { useState, useEffect } from 'react';
import { X, Search, Loader2, Send, Check } from 'lucide-react';
import { Conversation } from '@/types/chat';
import { formatPhone } from '@/lib/utils';
import { useChatStore } from '@/store/useChatStore';

interface ForwardMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedMessageIds: string[];
}

export const ForwardMessageModal: React.FC<ForwardMessageModalProps> = ({ isOpen, onClose, selectedMessageIds }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedConversations, setSelectedConversations] = useState<string[]>([]);
  const [forwarding, setForwarding] = useState(false);

  // Fetch recent conversations for quick selection
  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      fetch('/api/conversations?limit=20')
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setConversations(data.data);
          }
        })
        .finally(() => setLoading(false));
    } else {
      setSearchQuery('');
      setSelectedConversations([]);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredConversations = conversations.filter(c => 
    c.contact.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (c.contact.phone && c.contact.phone.includes(searchQuery))
  );

  const toggleSelection = (convId: string) => {
    if (selectedConversations.includes(convId)) {
      setSelectedConversations(selectedConversations.filter(id => id !== convId));
    } else {
      setSelectedConversations([...selectedConversations, convId]);
    }
  };

  const handleForward = async () => {
    if (selectedConversations.length === 0 || selectedMessageIds.length === 0) return;
    
    setForwarding(true);
    try {
      // Chamada para a API que cuidará do encaminhamento
      const res = await fetch('/api/messages/forward', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageIds: selectedMessageIds,
          targetConversationIds: selectedConversations
        })
      });

      if (res.ok) {
        useChatStore.getState().clearSelection();
        onClose();
      } else {
        console.error("Falha ao encaminhar mensagens");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setForwarding(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col h-[80vh] max-h-[600px] animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between bg-slate-50">
          <div>
            <h2 className="text-lg font-black text-slate-800">Encaminhar para...</h2>
            <p className="text-xs font-bold text-slate-400 mt-0.5">{selectedMessageIds.length} {selectedMessageIds.length === 1 ? 'mensagem' : 'mensagens'} selecionadas</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Search */}
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

        {/* List */}
        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="animate-spin text-blue-500" size={24} />
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="text-center p-8 text-slate-400 font-bold text-sm">
              Nenhum contato encontrado.
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {filteredConversations.map(conv => {
                const isSelected = selectedConversations.includes(conv.id);
                return (
                  <div
                    key={conv.id}
                    onClick={() => toggleSelection(conv.id)}
                    className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border ${isSelected ? 'bg-blue-50 border-blue-200' : 'hover:bg-slate-50 border-transparent'}`}
                  >
                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-colors ${isSelected ? 'bg-blue-500 border-blue-500 text-white' : 'border-slate-300 bg-white'}`}>
                      {isSelected && <Check size={12} strokeWidth={3} />}
                    </div>
                    
                    <div className="h-10 w-10 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                      {conv.contact.profilePictureUrl ? (
                        <img src={conv.contact.profilePictureUrl} alt={conv.contact.name} className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-slate-500 font-bold uppercase">{conv.contact.name[0]}</span>
                      )}
                    </div>
                    
                    <div className="flex flex-col overflow-hidden">
                      <span className="text-sm font-bold text-slate-800 truncate">{conv.contact.name}</span>
                      <span className="text-xs font-medium text-slate-400">{formatPhone(conv.contact.phone)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-slate-50 flex justify-between items-center">
          <span className="text-xs font-bold text-slate-500">
            {selectedConversations.length} {selectedConversations.length === 1 ? 'conversa' : 'conversas'}
          </span>
          <button
            disabled={selectedConversations.length === 0 || forwarding}
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
