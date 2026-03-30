'use client';

import React, { useState, useRef } from 'react';
import { CheckCircle2, AlertCircle, MessageSquare, Send, Check } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface FeedbackFormProps {
  token: string;
  contactName: string;
  agentName: string;
}

type RatingRange = 'detractor' | 'neutral' | 'promoter' | null;

const REASONS = {
  detractor: [
    'O Atendimento foi demorado',
    'O consultor não fez bom atendimento',
    'O problema não foi resolvido',
    'As informações não foram completas e de fácil compreensão',
    'Navegação no app/site',
  ],
  neutral: [
    'Resolução mais rápida',
    'Atendimento melhor',
    'Informações completas e de fácil compreensão',
    'Navegação mais rápida no app/site',
  ],
  promoter: [
    'O consultor fez um ótimo atendimento',
    'O atendimento foi rápido',
    'O atendimento foi completo e de fácil compreensão',
    'Problema resolvido',
    'Navegação no site',
  ],
};

const cn = (...inputs: any[]) => twMerge(clsx(inputs));

export function FeedbackForm({ token, contactName, agentName }: FeedbackFormProps) {
  const [score, setScore] = useState<number | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const optionsRef = useRef<HTMLDivElement>(null);
  const commentRef = useRef<HTMLDivElement>(null);

  const getRatingRange = (val: number | null): RatingRange => {
    if (val === null) return null;
    if (val <= 6) return 'detractor';
    if (val <= 8) return 'neutral';
    return 'promoter';
  };

  const range = getRatingRange(score);

  const toggleOption = (option: string) => {
    setSelectedOptions([option]);
    // Scroll to comment input after a small delay
    setTimeout(() => {
      commentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  };

  const handleScoreSelect = (val: number) => {
    setScore(val);
    setSelectedOptions([]); // Reset options when score changes
    // Scroll to options section after a small delay to allow rendering
    setTimeout(() => {
      optionsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (score === null) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/public/feedback/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          score,
          comment,
          categoryOptions: selectedOptions,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao enviar feedback');
      }

      setIsSubmitted(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center animate-in fade-in zoom-in duration-500">
        <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mb-6 text-green-500 border border-green-100 shadow-xl shadow-green-50">
          <CheckCircle2 size={48} />
        </div>
        <h2 className="text-3xl font-black text-slate-800 mb-4 tracking-tight">Obrigado pelo seu feedback!</h2>
        <p className="text-slate-500 max-w-sm mx-auto text-lg leading-relaxed">
          Sua opinião é fundamental para continuarmos aprimorando nosso atendimento e oferecendo a melhor experiência para você.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 animate-in slide-in-from-bottom-4 duration-700">
      {/* Institution Logo */}
      <div className="flex justify-center mb-16">
        <div className="flex items-center gap-3 group cursor-default">
          <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-2xl shadow-indigo-200 group-hover:rotate-6 transition-transform duration-300">
            <MessageSquare size={24} />
          </div>
          <span className="text-3xl font-black tracking-tighter text-slate-800">
            MOTIVA<span className="text-indigo-600">TALK</span>
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-12">
        {/* NPS Question */}
        <div className="space-y-8 text-center bg-white p-6 sm:p-10 rounded-3xl border border-slate-100 shadow-sm">
          <p className="text-xl font-semibold text-slate-700 leading-relaxed max-w-xl mx-auto">
            "Em uma escala de 0 a 10, pensando no atendimento que acabou de receber, quanto você recomendaria o nosso atendimento para um familiar ou amigo? Sua opinião é essencial para melhorar o nosso trabalho"
          </p>

          <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
            {[...Array(11)].map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleScoreSelect(i)}
                className={cn(
                  "w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center text-lg font-black transition-all duration-300 border-2 active:scale-90",
                  score === i 
                    ? range === 'detractor' ? "bg-red-500 text-white border-red-500 shadow-xl shadow-red-200 scale-110" 
                      : range === 'neutral' ? "bg-amber-500 text-white border-amber-500 shadow-xl shadow-amber-200 scale-110"
                      : "bg-emerald-500 text-white border-emerald-500 shadow-xl shadow-emerald-200 scale-110"
                    : "bg-white text-slate-400 border-slate-100 hover:border-slate-300 hover:text-slate-600"
                )}
              >
                {i}
              </button>
            ))}
          </div>
          <div className="flex justify-between max-w-[480px] mx-auto text-[10px] font-black text-slate-400 px-1 uppercase tracking-widest bg-slate-50/50 py-2 rounded-full border border-slate-100">
            <span className="pl-4">Nada Provável</span>
            <span className="pr-4">Muito Provável</span>
          </div>
        </div>

        {/* Conditional Question & Options */}
        {score !== null && range && (
          <div 
            ref={optionsRef}
            className={cn(
              "p-8 sm:p-10 rounded-[2.5rem] border-2 transition-all duration-500 animate-in fade-in slide-in-from-top-6 flex flex-col items-center",
              range === 'detractor' ? "bg-red-50/70 border-red-200/50 shadow-inner" 
                : range === 'neutral' ? "bg-amber-50/70 border-amber-200/50 shadow-inner" 
                : "bg-emerald-50/70 border-emerald-200/50 shadow-inner"
            )}
          >
            <h3 className={cn(
              "text-2xl font-black mb-10 text-center tracking-tight",
              range === 'detractor' ? "text-red-700" 
                : range === 'neutral' ? "text-amber-700" 
                : "text-emerald-700"
            )}>
              {range === 'detractor' ? "O que você não gostou?" : 
               range === 'neutral' ? "O que você esperava que fosse melhor?" : 
               "O que mais lhe agradou?"}
            </h3>

            <div className="flex flex-wrap justify-center gap-3">
              {REASONS[range].map((option) => {
                const isSelected = selectedOptions.includes(option);
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => toggleOption(option)}
                    className={cn(
                      "px-6 py-4 rounded-2xl text-sm font-bold transition-all duration-300 border-2 flex items-center gap-3 hover:scale-105 active:scale-95",
                      isSelected
                        ? range === 'detractor' ? "bg-red-500 text-white border-red-500 shadow-lg shadow-red-200"
                          : range === 'neutral' ? "bg-amber-500 text-white border-amber-500 shadow-lg shadow-amber-200"
                          : "bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-200"
                        : "bg-white text-slate-500 border-white shadow-sm hover:shadow-md hover:border-slate-100"
                    )}
                  >
                    <div className={cn(
                        "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors shadow-inner",
                        isSelected ? "bg-white/20 border-white" : "bg-slate-50 border-slate-100"
                    )}>
                        {isSelected && <Check size={12} strokeWidth={4} />}
                    </div>
                    {option}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Final Comment */}
        <div 
          ref={commentRef}
          className="space-y-8 animate-in fade-in duration-700 delay-300 fill-mode-both"
        >
          <div className="text-center space-y-3">
            <h4 className="text-2xl font-black text-slate-800 tracking-tight">
              Ficamos felizes em conseguir te ajudar!
            </h4>
            <p className="text-slate-500 font-medium max-w-lg mx-auto">
              Para continuar melhorando o nosso atendimento, me conta em poucas palavras o motivo da sua avaliação.
            </p>
          </div>

          <div className="space-y-3">
            <label htmlFor="comment" className="text-xs font-black text-indigo-400 uppercase tracking-widest pl-2">
              Insira um comentário:
            </label>
            <div className="relative group">
                <textarea
                  id="comment"
                  rows={4}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Escreva sua percepção sobre o atendimento aqui..."
                  className="w-full p-6 pb-2 rounded-[2rem] border-2 border-slate-100 bg-slate-50 focus:bg-white focus:border-indigo-400 focus:ring-0 transition-all outline-none resize-none text-lg text-slate-700 placeholder:text-slate-300 shadow-xl shadow-transparent focus:shadow-indigo-50/50"
                />
                <div className="absolute top-6 right-6 text-slate-200 group-focus-within:text-indigo-200 transition-colors">
                    <MessageSquare size={24} />
                </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-3 p-5 bg-red-50 text-red-600 rounded-[1.5rem] border-2 border-red-100 animate-in slide-in-from-top-2">
            <AlertCircle size={22} />
            <span className="font-bold text-sm tracking-tight">{error}</span>
          </div>
        )}

        <div className="flex justify-center pt-6">
          <button
            type="submit"
            disabled={score === null || isSubmitting}
            className={cn(
              "group relative px-12 py-6 rounded-full text-white font-black text-xl shadow-[0_20px_50px_rgba(79,70,229,0.3)] transition-all duration-300 transform active:scale-95 disabled:scale-100 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none hover:-translate-y-1",
              "bg-indigo-600 hover:bg-indigo-700"
            )}
          >
            <span className="relative z-10 flex items-center gap-4">
              {isSubmitting ? (
                <div className="flex items-center gap-3">
                   <div className="w-5 h-5 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                   Enviando...
                </div>
              ) : (
                <>
                  Enviar
                  <Send size={24} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform duration-300" />
                </>
              )}
            </span>
          </button>
        </div>
      </form>

      <div className="mt-24 pt-10 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4 opacity-40 grayscale transition-all hover:opacity-100 hover:grayscale-0">
         <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-slate-400 rounded-lg flex items-center justify-center text-white">
               <MessageSquare size={12} />
            </div>
            <span className="text-xs font-black tracking-widest text-slate-800 uppercase">Motiva Talk</span>
         </div>
         <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
           © {new Date().getFullYear()} Feedback System
         </span>
      </div>
    </div>
  );
}
