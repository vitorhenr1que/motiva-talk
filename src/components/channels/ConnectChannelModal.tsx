import React, { useState, useEffect, useCallback } from 'react';
import { X, QrCode, Loader2, CheckCircle2, AlertCircle, RefreshCw, Zap } from 'lucide-react';
import Image from 'next/image';

interface ConnectChannelModalProps {
  isOpen: boolean;
  onClose: () => void;
  channelId: string | null;
  channelName: string;
}

export const ConnectChannelModal: React.FC<ConnectChannelModalProps> = ({ 
  isOpen, 
  onClose, 
  channelId, 
  channelName 
}) => {
  const [qrCodeData, setQrCodeData] = useState<{ base64: string; code: string } | null>(null);
  const [status, setStatus] = useState<'IDLE' | 'LOADING' | 'PENDING' | 'CONNECTED' | 'ERROR'>('IDLE');
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    if (!channelId || status === 'CONNECTED') return;

    try {
      const res = await fetch(`/api/channels/${channelId}/status`);
      const data = await res.json();
      
      if (data.success && data.data?.status === 'CONNECTED') {
        setStatus('CONNECTED');
        // Stop polling
        return true;
      }
      return false;
    } catch (err) {
      console.error('Error polling status:', err);
      return false;
    }
  }, [channelId, status]);

  const fetchQrCode = useCallback(async () => {
    if (!channelId) return;
    
    setStatus('LOADING');
    setError(null);
    
    try {
      // 1. Initial connection command
      const connectRes = await fetch(`/api/channels/${channelId}/connect`, { method: 'POST' });
      if (!connectRes.ok) throw new Error('Falha ao conectar canal no servidor');
      
      // 2. Fetch QR Code
      const qrRes = await fetch(`/api/channels/${channelId}/qrcode`);
      const data = await qrRes.json();
      
      if (data.success && data.data) {
        setQrCodeData({ base64: data.data.qrcode, code: data.data.code });
        setStatus('PENDING');
      } else {
        throw new Error(data.message || 'QR Code ainda não gerado. Aguarde...');
      }
    } catch (err: any) {
      setError(err.message);
      setStatus('ERROR');
    }
  }, [channelId]);

  useEffect(() => {
    // We no longer auto-fetch on mount to satisfy the "explicit" requirement
    return () => {
      setQrCodeData(null);
      setStatus('IDLE');
    };
  }, [isOpen, channelId]);

  // Polling for connection
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (status === 'PENDING') {
      interval = setInterval(async () => {
        const isConnected = await fetchStatus();
        if (isConnected) clearInterval(interval);
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [status, fetchStatus]);

  // Auto-close on success
  useEffect(() => {
    if (status === 'CONNECTED') {
      const timer = setTimeout(() => {
        onClose();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [status, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white dark:bg-slate-900 rounded-[32px] w-full max-w-lg p-8 shadow-2xl ring-1 ring-slate-900/10 scale-in-center">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-2xl text-blue-600">
              <QrCode size={24} />
            </div>
            <div className="text-left">
              <h2 className="text-xl font-bold dark:text-white">Conectar WhatsApp</h2>
              <p className="text-xs font-semibold text-slate-400">{channelName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400">
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-slate-800/50 rounded-[32px] min-h-[300px]">
          {status === 'IDLE' && (
            <div className="flex flex-col items-center gap-6 text-center py-10">
              <div className="p-5 bg-blue-600/10 rounded-full text-blue-600 animate-pulse">
                <Zap size={48} strokeWidth={1.5} />
              </div>
              <div className="space-y-2">
                <p className="font-bold text-slate-800 dark:text-white text-base">Pronto para Conectar?</p>
                <p className="text-xs font-medium text-slate-400 max-w-[240px] leading-relaxed">
                  Clique no botão abaixo para gerar um novo QR Code e iniciar a vinculação do seu WhatsApp.
                </p>
              </div>
              <button 
                onClick={fetchQrCode}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 px-8 rounded-2xl shadow-xl shadow-blue-200 dark:shadow-none transition-all active:scale-95 group"
              >
                <div className="flex items-center gap-2">
                  <span>Gerar QR Code Agora</span>
                  <RefreshCw size={16} className="group-hover:rotate-180 transition-transform duration-500" />
                </div>
              </button>
            </div>
          )}

          {status === 'LOADING' && (
            <div className="flex flex-col items-center gap-4 text-center py-10">
              <Loader2 className="animate-spin text-blue-600" size={36} strokeWidth={2.5} />
              <p className="font-bold text-slate-600 dark:text-slate-300 animate-pulse text-sm">Iniciando motor de conexão...</p>
            </div>
          )}

          {status === 'ERROR' && (
            <div className="flex flex-col items-center gap-4 text-center max-w-xs transition-all animate-bounce-subtle py-10">
              <AlertCircle className="text-rose-500" size={48} strokeWidth={2} />
              <div className="space-y-1">
                <p className="font-bold text-slate-900 dark:text-white text-base">Ops! Ocorreu um erro</p>
                <p className="text-xs font-semibold text-slate-400">{error}</p>
              </div>
              <button 
                onClick={fetchQrCode}
                className="flex items-center gap-2 bg-blue-600/10 text-blue-600 hover:bg-blue-600 hover:text-white px-5 py-1.5 rounded-full font-bold text-xs transition-all"
              >
                <RefreshCw size={14} />
                Tentar novamente
              </button>
            </div>
          )}

          {status === 'PENDING' && qrCodeData && (
            <div className="flex flex-col items-center gap-6 animate-in zoom-in-75 duration-500 text-center w-full">
              <div className="bg-white p-4 rounded-[28px] shadow-xl ring-1 ring-slate-900/5 relative group">
                <div className="absolute inset-0 border-4 border-blue-500/20 rounded-[28px] animate-ping-slow pointer-events-none" />
                <img 
                  src={qrCodeData.base64} 
                  alt="WhatsApp QR Code" 
                  className="w-48 h-48 select-none pointer-events-none"
                />
              </div>
              <div className="space-y-3 max-w-sm">
                 <p className="font-bold text-slate-800 dark:text-white text-base leading-tight">Escaneie o código no seu celular</p>
                 <ol className="text-[10px] text-slate-500 dark:text-slate-400 text-left space-y-1.5 font-medium px-4">
                   <li>1. Abra o **WhatsApp** no seu aparelho celular.</li>
                   <li>2. Toque em **Mais opções** (⋮) ou **Configurações** (⚙️).</li>
                   <li>3. Toque em **Dispositivos conectados** e em **Conectar um dispositivo**.</li>
                   <li>4. Aponte a câmera para esta tela para capturar o código.</li>
                 </ol>
              </div>
              <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 px-4 py-2 rounded-full text-[9px] font-black uppercase tracking-[0.15em] animate-pulse">
                <RefreshCw size={10} className="animate-spin" />
                Aguardando Leitura...
              </div>
            </div>
          )}

          {status === 'CONNECTED' && (
            <div className="flex flex-col items-center gap-6 animate-in zoom-in duration-500 text-center">
              <div className="rounded-full bg-green-500 p-6 shadow-2xl shadow-green-200 dark:shadow-none animate-bounce-subtle">
                <CheckCircle2 color="white" size={64} strokeWidth={2.5} />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Conectado com Sucesso!</h3>
                <p className="text-sm font-semibold text-slate-400">Sua integração com o WhatsApp está ativa e pronta.</p>
              </div>
              <p className="text-xs font-bold text-green-600 animate-pulse">Fechando automaticamente em instantes...</p>
              <button 
                onClick={onClose}
                className="mt-2 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-12 rounded-2xl shadow-lg transition-transform hover:scale-105 active:scale-95"
              >
                Concluir agora
              </button>
            </div>
          )}
        </div>
        
        <p className="mt-6 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
          {status === 'CONNECTED' ? 'Segurança Verificada' : 'Protocolo de criptografia de ponta a ponta'}
        </p>
      </div>
    </div>
  );
};
