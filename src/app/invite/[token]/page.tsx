'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { User, Lock, Loader2, CheckCircle2, ShieldCheck, ArrowRight, Mail } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function AcceptInvitePage() {
  const params = useParams();
  const token = params.token as string;
  
  const [invite, setInvite] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  
  const router = useRouter();

  useEffect(() => {
    const fetchInvite = async () => {
      try {
        const res = await fetch(`/api/invite/${token}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Convite inválido');
        setInvite(data.data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchInvite();
  }, [token]);

  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const res = await fetch(`/api/invite/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, password }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao aceitar convite');

      // Login automático
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: invite.email,
        password,
      });

      if (signInError) throw signInError;

      // Sincronizar sessão
      const sessionRes = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session: signInData.session }),
      });

      if (sessionRes.ok) {
        router.push('/inbox');
        router.refresh();
      } else {
        throw new Error('Falha ao sincronizar sessão');
      }
    } catch (err: any) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-blue-600" size={48} />
      </div>
    );
  }

  if (error && !invite) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md w-full bg-white rounded-3xl p-10 shadow-xl text-center space-y-6">
          <div className="mx-auto w-16 h-16 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center">
            <Lock size={32} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Ops! Convite Inválido</h1>
          <p className="text-slate-500">{error}</p>
          <button 
            onClick={() => router.push('/login')}
            className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold transition-all hover:bg-black"
          >
            Ir para o Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-lg space-y-8 rounded-3xl bg-white p-10 shadow-xl shadow-slate-200/50 border border-slate-100 transition-all">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-200">
            <ShieldCheck size={32} />
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-slate-900 tracking-tight">Você foi convidado!</h2>
          <p className="mt-2 text-sm text-slate-500">
            Junte-se à <strong>{invite.organization?.name}</strong> no Motiva Talk.
          </p>
        </div>

        <div className="bg-slate-50 rounded-2xl p-4 flex items-center gap-3 border border-slate-100">
          <div className="p-2 bg-white rounded-xl shadow-sm text-blue-600">
            <Mail size={20} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Seu e-mail</p>
            <p className="text-sm font-bold text-slate-700">{invite.email}</p>
          </div>
        </div>

        <form className="space-y-5" onSubmit={handleAccept}>
          {error && (
            <div className="rounded-xl bg-red-50 p-4 text-xs font-bold text-red-600 border border-red-100">
              {error}
            </div>
          )}
          
          <div className="space-y-4">
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-2xl border-slate-200 bg-slate-50 py-4 pl-12 pr-4 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                placeholder="Seu nome completo"
              />
            </div>
            
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-2xl border-slate-200 bg-slate-50 py-4 pl-12 pr-4 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                placeholder="Crie sua senha"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="group relative flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 py-4 text-sm font-bold text-white transition-all hover:bg-black active:scale-[0.98] disabled:opacity-70"
          >
            {submitting ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <>
                Aceitar Convite e Entrar
                <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
