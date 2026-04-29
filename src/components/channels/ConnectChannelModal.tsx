import React, { useState, useEffect, useCallback } from 'react';
import { X, QrCode, Loader2, CheckCircle2, AlertCircle, RefreshCw, Zap, Server, Globe, Key, Phone as PhoneIcon } from 'lucide-react';

interface ConnectChannelModalProps {
  isOpen: boolean;
  onClose: () => void;
  channelId: string | null;
  channelName: string;
}

type ProviderSelection = 'EVOLUTION' | 'META_CLOUD';

export const ConnectChannelModal: React.FC<ConnectChannelModalProps> = ({ 
  isOpen, 
  onClose, 
  channelId, 
  channelName 
}) => {
  const [provider, setProvider] = useState<ProviderSelection | null>(null);
  const [qrCodeData, setQrCodeData] = useState<{ base64: string; code: string } | null>(null);
  const [status, setStatus] = useState<'IDLE' | 'LOADING' | 'PENDING' | 'CONNECTED' | 'ERROR' | 'META_FORM'>('IDLE');
  const [error, setError] = useState<string | null>(null);
  const [metaVerifyToken, setMetaVerifyToken] = useState<string | null>(null);
  
  // Meta Cloud form state
  const [metaData, setMetaData] = useState({
    phoneNumberId: '',
    wabaId: '',
    accessToken: ''
  });

  const fetchStatus = useCallback(async () => {
    if (!channelId || status === 'CONNECTED') return;

    try {
      const res = await fetch(`/api/channels/${channelId}/status`);
      const data = await res.json();
      
      if (data.success && data.data?.status === 'CONNECTED') {
        setStatus('CONNECTED');
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

  const handleConnectMeta = async () => {
    if (!channelId) return;
    setStatus('LOADING');
    setError(null);

    try {
      const res = await fetch(`/api/channels/${channelId}/connect-meta`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metaData)
      });

      const data = await res.json();
      if (data.success) {
        setMetaVerifyToken(data.data?.metaWebhookVerifyToken || null);
        setStatus('CONNECTED');
      } else {
        throw new Error(data.error || 'Falha ao conectar com Meta Cloud API');
      }
    } catch (err: any) {
      setError(err.message);
      setStatus('ERROR');
    }
  };

  useEffect(() => {
    return () => {
      setQrCodeData(null);
      setStatus('IDLE');
      setProvider(null);
      setMetaVerifyToken(null);
    };
  }, [isOpen, channelId]);

  const metaWebhookUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/webhooks/meta`
    : '/api/webhooks/meta';

  // Polling for connection (only for Evolution/QR)
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

  // Auto-close on success (only for Evolution)
  useEffect(() => {
    if (status === 'CONNECTED' && provider !== 'META_CLOUD') {
      const timer = setTimeout(() => {
        onClose();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [status, provider, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white dark:bg-slate-900 rounded-[32px] w-full max-w-lg p-8 shadow-2xl ring-1 ring-slate-900/10 scale-in-center overflow-hidden">
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
          {status === 'IDLE' && !provider && (
            <div className="w-full space-y-6 py-6">
              <div className="text-center space-y-1">
                <p className="font-bold text-slate-800 dark:text-white text-base">Escolha o Provedor</p>
                <p className="text-xs text-slate-400">Selecione como deseja conectar seu número</p>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <button 
                  onClick={() => { setProvider('EVOLUTION'); setStatus('IDLE'); }}
                  className="flex items-center gap-4 p-5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-blue-500 transition-all text-left group"
                >
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-xl text-blue-600 group-hover:scale-110 transition-transform">
                    <Zap size={20} />
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 dark:text-white text-sm">Conectar com Evolution API</p>
                    <p className="text-[10px] text-slate-400">Conexão via QR Code (Multi-device)</p>
                  </div>
                </button>

                <button 
                  onClick={() => { setProvider('META_CLOUD'); setStatus('META_FORM'); }}
                  className="flex items-center gap-4 p-5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-blue-500 transition-all text-left group"
                >
                  <div className="p-3 bg-green-50 dark:bg-green-900/30 rounded-xl text-green-600 group-hover:scale-110 transition-transform">
                    <Globe size={20} />
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 dark:text-white text-sm">Conectar com Meta Cloud API</p>
                    <p className="text-[10px] text-slate-400">Conexão via Business Manager</p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {status === 'IDLE' && provider === 'EVOLUTION' && (
            <div className="flex flex-col items-center gap-6 text-center py-10">
              <div className="p-5 bg-blue-600/10 rounded-full text-blue-600 animate-pulse">
                <Zap size={48} strokeWidth={1.5} />
              </div>
              <div className="space-y-2">
                <p className="font-bold text-slate-800 dark:text-white text-base">Evolution API</p>
                <p className="text-xs font-medium text-slate-400 max-w-[240px] leading-relaxed">
                  Clique abaixo para gerar o QR Code. Você precisará escanear com seu celular.
                </p>
              </div>
              <div className="flex flex-col gap-3 w-full">
                <button 
                  onClick={fetchQrCode}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 px-8 rounded-2xl shadow-xl shadow-blue-200 dark:shadow-none transition-all active:scale-95 group"
                >
                  <div className="flex items-center justify-center gap-2">
                    <span>Gerar QR Code Agora</span>
                    <RefreshCw size={16} className="group-hover:rotate-180 transition-transform duration-500" />
                  </div>
                </button>
                <button onClick={() => setProvider(null)} className="text-[10px] font-bold text-slate-400 hover:text-slate-600 uppercase tracking-widest">Voltar</button>
              </div>
            </div>
          )}

          {status === 'META_FORM' && (
            <div className="w-full space-y-5 py-4">
              <div className="text-center space-y-1">
                <p className="font-bold text-slate-800 dark:text-white text-base">Configurar Meta Cloud</p>
                <p className="text-xs text-slate-400">Insira as credenciais do seu aplicativo Meta</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Phone Number ID</label>
                  <div className="relative">
                    <PhoneIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input 
                      type="text" 
                      value={metaData.phoneNumberId}
                      onChange={e => setMetaData({...metaData, phoneNumberId: e.target.value})}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-3 pl-12 pr-4 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                      placeholder="Ex: 1234567890"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">WABA ID</label>
                  <div className="relative">
                    <Server className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input 
                      type="text" 
                      value={metaData.wabaId}
                      onChange={e => setMetaData({...metaData, wabaId: e.target.value})}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-3 pl-12 pr-4 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                      placeholder="Ex: 0987654321"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Access Token</label>
                  <div className="relative">
                    <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input 
                      type="password" 
                      value={metaData.accessToken}
                      onChange={e => setMetaData({...metaData, accessToken: e.target.value})}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-3 pl-12 pr-4 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                      placeholder="EAAB..."
                    />
                  </div>
                </div>
              </div>

              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/30 p-4 rounded-2xl">
                 <p className="text-[10px] text-amber-700 dark:text-amber-400 font-medium leading-relaxed">
                   <strong>Webhook Meta:</strong> use a URL abaixo no app da Meta. O token de verificação será mostrado após salvar. <br/>
                    <code className="bg-white/50 dark:bg-black/20 px-1 rounded break-all">{metaWebhookUrl}</code>
                 </p>
              </div>

              <div className="flex flex-col gap-3">
                <button 
                  onClick={handleConnectMeta}
                  disabled={!metaData.phoneNumberId || !metaData.wabaId || !metaData.accessToken}
                  className="w-full bg-green-600 hover:bg-green-700 disabled:bg-slate-300 text-white font-bold py-3.5 rounded-2xl shadow-xl transition-all active:scale-95"
                >
                  Salvar e Conectar
                </button>
                <button onClick={() => { setProvider(null); setStatus('IDLE'); }} className="text-[10px] font-bold text-slate-400 hover:text-slate-600 uppercase tracking-widest text-center">Voltar</button>
              </div>
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
                onClick={() => setStatus('IDLE')}
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
              {provider === 'META_CLOUD' && metaVerifyToken && (
                <div className="w-full max-w-sm rounded-2xl border border-green-100 bg-green-50 p-4 text-left dark:border-green-900/30 dark:bg-green-900/20">
                  <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-green-700 dark:text-green-400">Token de verificação Meta</p>
                  <code className="block break-all rounded-lg bg-white/70 px-3 py-2 text-xs font-bold text-slate-700 dark:bg-black/20 dark:text-slate-200">{metaVerifyToken}</code>
                </div>
              )}
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
