import React, { useState } from 'react';
import { X, Phone, MessageSquarePlus } from 'lucide-react';

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const resp = await fetch('/api/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phoneNumber }),
      });

      if (!resp.ok) {
        const data = await resp.json();
        throw new Error(data.error || 'Erro ao criar canal');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white dark:bg-slate-900 rounded-[32px] w-full max-w-md p-8 shadow-2xl ring-1 ring-slate-900/10 transition-all scale-in-center">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-2xl text-blue-600">
              <MessageSquarePlus size={24} />
            </div>
            <h2 className="text-xl font-bold dark:text-white">Novo Canal WhatsApp</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Nome do Canal</label>
            <input
              required
              type="text"
              placeholder="Ex: WhatsApp Comercial"
              className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-5 py-4 font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Número do Telefone</label>
            <div className="relative">
              <Phone size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                required
                type="text"
                placeholder="5511999999999"
                className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl pl-12 pr-5 py-4 font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
              />
            </div>
            <p className="text-[10px] text-slate-400 ml-1">Apenas números, com DDI (Ex: 55 para Brasil)</p>
          </div>

          {error && <p className="text-sm font-bold text-rose-500 text-center animate-pulse">{error}</p>}

          <button
            disabled={loading}
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl shadow-lg shadow-blue-200 dark:shadow-none transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
          >
            {loading ? 'Cadastrando...' : 'Criar Canal'}
          </button>
        </form>
      </div>
    </div>
  );
};
