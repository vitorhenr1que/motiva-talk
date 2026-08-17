'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  CheckCircle2, 
  MessageSquarePlus, 
  Cloud,
  Loader2, 
  ArrowRight, 
  Sparkles,
  ShieldCheck,
  Smartphone,
  Check
} from 'lucide-react';
import { AddChannelModal } from '@/components/channels/AddChannelModal';
import { ConnectChannelModal } from '@/components/channels/ConnectChannelModal';

export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [orgName, setOrgName] = useState('');
  const [createdChannelId, setCreatedChannelId] = useState<string | null>(null);
  const [createdChannelName, setCreatedChannelName] = useState('');
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  
  const router = useRouter();

  useEffect(() => {
    const fetchOrg = async () => {
      try {
        const res = await fetch('/api/users/me');
        const data = await res.json();
        if (data.success) {
          setOrgName(data.data.organization?.name || 'sua empresa');
        }
      } catch (error) {
        console.error('Error fetching org:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchOrg();
  }, []);

  const handleChannelCreated = async () => {
    // We need to find the newly created channel
    try {
      const res = await fetch('/api/channels');
      const data = await res.json();
      if (data.data && data.data.length > 0) {
        const latest = data.data[0];
        setCreatedChannelId(latest.id);
        setCreatedChannelName(latest.name);
        setStep(3);
      }
    } catch (error) {
      console.error('Error fetching new channel:', error);
    }
  };

  const handleFinish = () => {
    router.push('/inbox');
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-blue-600" size={48} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        {/* Progress bar */}
        <div className="mb-12 flex items-center justify-between px-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center flex-1 last:flex-none">
              <div className={`h-10 w-10 rounded-2xl flex items-center justify-center font-bold text-sm transition-all duration-500 ${
                step >= i ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-white text-slate-400 border border-slate-200'
              }`}>
                {step > i ? <Check size={20} strokeWidth={3} /> : i}
              </div>
              {i < 4 && (
                <div className={`h-1 flex-1 mx-4 rounded-full transition-all duration-700 ${
                  step > i ? 'bg-blue-600' : 'bg-slate-200'
                }`} />
              )}
            </div>
          ))}
        </div>

        <div className="bg-white rounded-[40px] p-10 shadow-xl shadow-slate-200/50 border border-slate-100 transition-all duration-500">
          {step === 1 && (
            <div className="text-center space-y-8 animate-in fade-in zoom-in duration-500">
              <div className="mx-auto w-24 h-24 bg-blue-50 rounded-[32px] flex items-center justify-center text-blue-600">
                <Sparkles size={48} />
              </div>
              <div className="space-y-3">
                <h1 className="text-4xl font-black text-slate-900 tracking-tight">Bem-vindo ao Motiva Talk!</h1>
                <p className="text-lg text-slate-500 font-medium">Parabéns por dar o primeiro passo para um atendimento extraordinário.</p>
              </div>
              <div className="bg-slate-50 rounded-3xl p-6 text-left border border-slate-100">
                <div className="flex items-start gap-4">
                  <div className="mt-1 p-2 bg-white rounded-xl shadow-sm text-blue-600">
                    <ShieldCheck size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800">Sua organização está pronta</h3>
                    <p className="text-sm text-slate-500">Criamos o ambiente seguro para a <strong>{orgName}</strong> gerenciar todas as conversas em um só lugar.</p>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setStep(2)}
                className="group w-full py-5 bg-slate-900 hover:bg-black text-white rounded-3xl font-bold text-lg shadow-xl transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-3"
              >
                Vamos começar
                <ArrowRight className="group-hover:translate-x-2 transition-transform" />
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="text-center space-y-8 animate-in fade-in slide-in-from-right duration-500">
              <div className="mx-auto w-24 h-24 bg-indigo-50 rounded-[32px] flex items-center justify-center text-indigo-600">
                <MessageSquarePlus size={48} />
              </div>
              <div className="space-y-3">
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">Crie seu primeiro canal</h1>
                <p className="text-slate-500 font-medium">O Motiva Talk usa exclusivamente a API oficial do WhatsApp Business da Meta.</p>
              </div>
              
              <div className="grid grid-cols-1 gap-4 text-left">
                <div className="p-5 border border-slate-100 rounded-3xl bg-slate-50 flex items-center gap-4">
                  <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm">
                    <Smartphone size={24} />
                  </div>
                  <div>
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Passo 1</p>
                    <p className="font-bold text-slate-800">Informe o nome e o número</p>
                  </div>
                </div>
              </div>

              <button 
                onClick={() => setIsAddModalOpen(true)}
                className="group w-full py-5 bg-blue-600 hover:bg-blue-700 text-white rounded-3xl font-bold text-lg shadow-xl shadow-blue-200 transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-3"
              >
                Cadastrar Canal
                <ArrowRight className="group-hover:translate-x-2 transition-transform" />
              </button>
              
              <p className="text-xs text-slate-400 font-medium italic">* O número precisa estar cadastrado e verificado no WhatsApp Manager da Meta.</p>
            </div>
          )}

          {step === 3 && (
            <div className="text-center space-y-8 animate-in fade-in slide-in-from-right duration-500">
              <div className="mx-auto w-24 h-24 bg-amber-50 rounded-[32px] flex items-center justify-center text-amber-600">
                <Cloud size={48} />
              </div>
              <div className="space-y-3">
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">Conecte a Meta Cloud API</h1>
                <p className="text-slate-500 font-medium">Canal <strong>{createdChannelName}</strong> registrado. Agora informe os identificadores oficiais da Meta.</p>
              </div>
              
              <div className="bg-amber-50 border border-amber-100 rounded-3xl p-6 text-left">
                <p className="text-sm text-amber-800 font-medium leading-relaxed">
                  Você precisará do ID do número de telefone e do ID da conta do WhatsApp Business. O token permanente fica protegido somente no servidor.
                </p>
              </div>

              <button 
                onClick={() => setIsConnectModalOpen(true)}
                className="group w-full py-5 bg-slate-900 hover:bg-black text-white rounded-3xl font-bold text-lg shadow-xl transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-3"
              >
                Conectar Agora
                <Cloud size={20} />
              </button>

              <button 
                onClick={() => setStep(4)}
                className="text-slate-400 font-bold text-sm hover:text-slate-600 transition-colors"
              >
                Pular esta etapa por enquanto
              </button>
            </div>
          )}

          {step === 4 && (
            <div className="text-center space-y-10 animate-in fade-in zoom-in duration-700">
              <div className="relative mx-auto w-32 h-32">
                <div className="absolute inset-0 bg-green-500/20 rounded-[40px] animate-ping" />
                <div className="relative w-full h-full bg-green-500 rounded-[40px] flex items-center justify-center text-white shadow-2xl shadow-green-200">
                  <CheckCircle2 size={64} strokeWidth={2.5} />
                </div>
              </div>
              
              <div className="space-y-4">
                <h1 className="text-4xl font-black text-slate-900 tracking-tight">Tudo pronto!</h1>
                <p className="text-xl text-slate-500 font-medium px-10">Você já pode convidar sua equipe e começar a atender seus clientes.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-6 bg-slate-50 rounded-[32px] border border-slate-100 text-left">
                  <h4 className="font-bold text-slate-800 mb-1">Membros</h4>
                  <p className="text-xs text-slate-500 font-medium">{'Adicione atendentes em Configurações > Usuários.'}</p>
                </div>
                <div className="p-6 bg-slate-50 rounded-[32px] border border-slate-100 text-left">
                  <h4 className="font-bold text-slate-800 mb-1">Setores</h4>
                  <p className="text-xs text-slate-500 font-medium">Organize seu fluxo criando setores de atendimento.</p>
                </div>
              </div>

              <button 
                onClick={handleFinish}
                className="group w-full py-6 bg-blue-600 hover:bg-blue-700 text-white rounded-[32px] font-black text-xl shadow-2xl shadow-blue-200 transition-all hover:scale-[1.05] active:scale-95 flex items-center justify-center gap-4"
              >
                Ir para o Dashboard
                <ArrowRight size={24} />
              </button>
            </div>
          )}
        </div>

        {/* Footer info */}
        <p className="mt-8 text-center text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">
          Motiva Talk &bull; Atendimento Inteligente
        </p>
      </div>

      <AddChannelModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
        onSuccess={handleChannelCreated} 
      />

      <ConnectChannelModal 
        isOpen={isConnectModalOpen} 
        onClose={() => {
          setIsConnectModalOpen(false);
          setStep(4);
        }} 
        channelId={createdChannelId}
        channelName={createdChannelName}
      />
    </div>
  );
}
