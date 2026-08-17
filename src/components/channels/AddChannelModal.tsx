import React, { useState } from 'react';
import { X, Phone, MessageSquarePlus, Cloud } from 'lucide-react';

interface AddChannelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AddChannelModal: React.FC<AddChannelModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          phoneNumber: phoneNumber.replace(/\D/g, ''),
          whatsappProvider: 'META_CLOUD',
          provider: 'META_CLOUD',
          connectionStatus: 'DISCONNECTED',
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || data.message || 'Erro ao criar canal');

      setName('');
      setPhoneNumber('');
      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao criar canal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[32px] bg-white p-8 shadow-2xl ring-1 ring-slate-900/10 dark:bg-slate-900">
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-blue-50 p-3 text-blue-600 dark:bg-blue-900/30">
              <MessageSquarePlus size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold dark:text-white">Novo canal WhatsApp</h2>
              <p className="text-xs font-semibold text-slate-400">Integração oficial Meta Cloud API</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Fechar">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-emerald-800 dark:border-emerald-900/30 dark:bg-emerald-900/20 dark:text-emerald-300">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest">
              <Cloud size={16} /> Meta Cloud API
            </div>
            <p className="mt-1 text-xs font-medium">Todos os canais deste projeto usam exclusivamente a API oficial da Meta.</p>
          </div>

          <div className="space-y-2">
            <label className="ml-1 text-xs font-bold uppercase tracking-widest text-slate-400">Nome do canal</label>
            <input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex: Matrículas" className="w-full rounded-2xl border-none bg-slate-50 px-5 py-4 font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-blue-500/20 dark:bg-slate-800 dark:text-white" />
          </div>

          <div className="space-y-2">
            <label className="ml-1 text-xs font-bold uppercase tracking-widest text-slate-400">Número com DDI</label>
            <div className="relative">
              <Phone size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input required value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} placeholder="5575981048077" className="w-full rounded-2xl border-none bg-slate-50 py-4 pl-12 pr-5 font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-blue-500/20 dark:bg-slate-800 dark:text-white" />
            </div>
          </div>

          {error && <p className="text-center text-sm font-bold text-rose-500">{error}</p>}

          <button disabled={loading} type="submit" className="w-full rounded-2xl bg-blue-600 py-4 font-bold text-white shadow-lg shadow-blue-200 transition-all hover:bg-blue-700 disabled:opacity-50 dark:shadow-none">
            {loading ? 'Cadastrando...' : 'Criar canal Meta'}
          </button>
        </form>
      </div>
    </div>
  );
};
