import { Metadata } from 'next';
import { FeedbackService } from '@/services/feedback.service';
import { FeedbackForm } from '@/components/feedback/FeedbackForm';
import { AlertCircle, Clock, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Avaliação de Atendimento - Motiva Talk',
  description: 'Sua opinião é fundamental para melhorarmos nosso serviço.',
};

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function PublicFeedbackPage({ params }: PageProps) {
  const { token } = await params;

  try {
    const feedback = await FeedbackService.getByToken(token);

    if (!feedback) {
      return (
        <FeedbackError 
          title="Link Não Encontrado" 
          message="O link de avaliação que você está tentando acessar não existe ou foi removido."
          icon={<AlertCircle className="w-16 h-16 text-red-500" />}
        />
      );
    }

    if (feedback.status === 'SUBMITTED') {
      return (
        <FeedbackError 
          title="Avaliação Já Realizada" 
          message="Agradecemos seu interesse, mas esta avaliação já foi enviada anteriormente. Sua opinião já foi registrada com sucesso!"
          icon={<CheckCircle2 className="w-16 h-16 text-emerald-500" />}
        />
      );
    }

    if (feedback.status === 'EXPIRED') {
       return (
        <FeedbackError 
          title="Link Expirado" 
          message="Para garantir a precisão dos dados, os links de avaliação expiram após 24 horas do atendimento. Por favor, solicite um novo link se necessário."
          icon={<Clock className="w-16 h-16 text-amber-500" />}
        />
      );
    }

    if (feedback.status === 'RECENT_SUBMISSION') {
      return (
        <FeedbackError 
          title="Frequência de Avaliação" 
          message="Você já enviou uma avaliação nas últimas 24 horas. Para mantermos a qualidade do nosso serviço, permitimos apenas uma avaliação por dia. Agradecemos sua compreensão!"
          icon={<AlertCircle className="w-16 h-16 text-indigo-500" />}
        />
      );
    }

    return (
      <main className="min-h-screen bg-slate-50 selection:bg-indigo-100 selection:text-indigo-900">
        <div className="container mx-auto max-w-4xl py-12">
          <FeedbackForm 
            token={token} 
            contactName={feedback.contact?.name || 'Cliente'} 
            agentName={feedback.conversation?.agent?.name || 'Atendente'} 
          />
        </div>
      </main>
    );
  } catch (error) {
    console.error('Error loading feedback page:', error);
    return (
      <FeedbackError 
        title="Ocorreu um Erro" 
        message="Não foi possível carregar a página de avaliação no momento. Por favor, tente novamente mais tarde."
        icon={<AlertCircle className="w-16 h-16 text-red-500" />}
      />
    );
  }
}

function FeedbackError({ title, message, icon }: { title: string; message: string; icon: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white p-12 rounded-[2.5rem] shadow-2xl shadow-slate-200/60 max-w-lg w-full text-center space-y-8 animate-in zoom-in-95 duration-500">
        <div className="flex justify-center flex-col items-center gap-4">
          <div className="p-4 bg-slate-50 rounded-full border border-slate-100 shadow-inner">
            {icon}
          </div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">{title}</h1>
        </div>
        
        <p className="text-slate-500 text-lg font-medium leading-relaxed">
          {message}
        </p>

        <div className="pt-4">
          <Link 
            href="/" 
            className="inline-flex items-center gap-2 text-indigo-600 font-black uppercase tracking-widest text-xs hover:text-indigo-700 transition-colors"
          >
            Voltar para o Início
          </Link>
        </div>
      </div>
    </main>
  );
}
