'use client';

import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Users, 
  UserPlus, 
  Mail, 
  Shield, 
  Clock, 
  CheckCircle2, 
  X, 
  Loader2, 
  MoreVertical,
  Trash2,
  Copy,
  Link as LinkIcon
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function OrganizationSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [org, setOrg] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [invites, setInvites] = useState<any[]>([]);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [role, setRole] = useState<string>('AGENT');
  const [usage, setUsage] = useState<any>(null);

  const fetchData = async () => {
    try {
      // 1. Get current user & role
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      
      const [profileRes, membersRes, invitesRes, usageRes] = await Promise.all([
        fetch('/api/users/me'),
        fetch('/api/users'),
        fetch('/api/organizations/invite'),
        fetch('/api/organizations/usage')
      ]);

      const profileData = await profileRes.json();
      if (profileData.success) {
        setRole(profileData.data.role);
        setOrg(profileData.data.organization);
      }

      const membersData = await membersRes.json();
      if (membersData.success) {
        setMembers(membersData.data);
      }

      const invitesData = await invitesRes.json();
      if (invitesRes.ok) {
        setInvites(invitesData.data || []);
      }

      const usageData = await usageRes.json();
      if (usageRes.ok) {
        setUsage(usageData.data || null);
      }
    } catch (error) {
      console.error('Error fetching org data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCopyLink = (token: string) => {
    const url = `${window.location.origin}/invite/${token}`;
    navigator.clipboard.writeText(url);
    alert('Link de convite copiado!');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full gap-3 text-slate-400">
        <Loader2 className="animate-spin" />
        <span className="text-sm font-medium">Carregando dados da organização...</span>
      </div>
    );
  }

  const isAdmin = role === 'ADMIN' || role === 'OWNER';
  const isUserLimitReached = usage?.maxUsers !== null && (usage?.userCount + usage?.pendingInvitesCount) >= usage?.maxUsers;

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-10 animate-in fade-in slide-in-from-top-4 duration-500 pb-20">
      <div className="border-b border-slate-200 dark:border-slate-800 pb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Organização</h1>
          <p className="mt-2 text-slate-500 dark:text-slate-400 font-medium">Gerencie os dados da sua empresa e sua equipe.</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {isAdmin && (
            <button 
              onClick={() => !isUserLimitReached && setIsInviteModalOpen(true)}
              disabled={isUserLimitReached}
              className={`flex items-center gap-2 rounded-2xl px-6 py-3 text-sm font-bold text-white shadow-lg transition-all active:scale-95 ${
                isUserLimitReached 
                ? 'bg-slate-400 cursor-not-allowed shadow-none' 
                : 'bg-blue-600 shadow-blue-200 hover:shadow-2xl hover:scale-105'
              }`}
            >
              <UserPlus size={18} />
              Convidar Membro
            </button>
          )}
          {isUserLimitReached && (
            <span className="text-[10px] font-bold text-rose-500 bg-rose-50 px-2 py-1 rounded-md border border-rose-100 animate-pulse">
              Limite de membros atingido ({usage.maxUsers})
            </span>
          )}
        </div>
      </div>


      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Org Info Card */}
        <div className="lg:col-span-1 space-y-6">
          <section className="bg-white rounded-3xl border border-slate-200 p-8 shadow-xl ring-1 ring-slate-900/5">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl">
                <Building2 size={24} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-800">Dados Gerais</h2>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">SaaS ID: {org?.id?.substring(0, 8)}...</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome da Empresa</label>
                <div className="p-3 bg-slate-50 rounded-xl font-bold text-slate-700 border border-slate-100">{org?.name}</div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Slug da Organização</label>
                <div className="p-3 bg-slate-50 rounded-xl font-bold text-blue-600 border border-slate-100 italic">/{org?.slug}</div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Plano Atual</label>
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-xl font-bold text-green-700 border border-green-100">
                  <span>{org?.plan || 'FREE'}</span>
                  <span className="text-[10px] bg-green-600 text-white px-2 py-0.5 rounded-full">ATIVO</span>
                </div>
              </div>
            </div>
          </section>

          {/* Stats Card */}
          <section className="bg-slate-900 rounded-3xl p-8 text-white shadow-2xl">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Resumo da Equipe</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-2xl font-black">{members.length}{usage?.maxUsers && <span className="text-sm text-slate-500 font-normal"> / {usage.maxUsers}</span>}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Membros Ativos</p>
              </div>
              <div className="space-y-1">
                <p className="text-2xl font-black text-blue-400">{invites.length}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pendentes</p>
              </div>
            </div>
          </section>
        </div>

        {/* Members & Invites */}
        <div className="lg:col-span-2 space-y-8">
          {/* Members List */}
          <section className="bg-white rounded-3xl border border-slate-200 shadow-xl ring-1 ring-slate-900/5 overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Users size={20} className="text-slate-400" />
                <h2 className="font-bold text-slate-800">Membros da Organização</h2>
              </div>
            </div>
            
            <div className="divide-y divide-slate-50">
              {members.map((member) => (
                <div key={member.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors group">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center font-bold text-slate-500 border border-slate-200 uppercase">
                      {member.name[0]}
                    </div>
                    <div>
                      <p className="font-bold text-slate-800 text-sm">{member.name}</p>
                      <p className="text-xs text-slate-400">{member.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg ${
                      member.role === 'ADMIN' ? 'bg-indigo-50 text-indigo-600' : 
                      member.role === 'SUPERVISOR' ? 'bg-blue-50 text-blue-600' : 
                      'bg-slate-100 text-slate-500'
                    }`}>
                      {member.role}
                    </span>
                    {isAdmin && member.id !== org?.ownerId && (
                      <button className="p-2 text-slate-300 hover:text-rose-500 transition-colors">
                        <MoreVertical size={18} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Pending Invites */}
          {invites.length > 0 && (
            <section className="bg-white rounded-3xl border border-slate-200 shadow-xl ring-1 ring-slate-900/5 overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-blue-50/30">
                <div className="flex items-center gap-3">
                  <Mail size={20} className="text-blue-500" />
                  <h2 className="font-bold text-slate-800">Convites Pendentes</h2>
                </div>
              </div>
              
              <div className="divide-y divide-slate-50">
                {invites.map((invite) => (
                  <div key={invite.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                        <Mail size={18} />
                      </div>
                      <div>
                        <p className="font-bold text-slate-800 text-sm">{invite.email}</p>
                        <p className="text-[10px] text-slate-400 flex items-center gap-1 uppercase tracking-widest font-black">
                          <Clock size={10} />
                          Expira em {new Date(invite.expiresAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black bg-slate-100 text-slate-500 px-2.5 py-1 rounded-lg uppercase tracking-widest">
                        {invite.role}
                      </span>
                      <button 
                        onClick={() => handleCopyLink(invite.token)}
                        className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                        title="Copiar Link"
                      >
                        <Copy size={16} />
                      </button>
                      {isAdmin && (
                        <button className="p-2 text-slate-300 hover:text-rose-500 transition-colors">
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>

      <InviteModal 
        isOpen={isInviteModalOpen} 
        onClose={() => setIsInviteModalOpen(false)} 
        onSuccess={fetchData} 
      />
    </div>
  );
}

function InviteModal({ isOpen, onClose, onSuccess }: { isOpen: boolean; onClose: () => void; onSuccess: () => void }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('AGENT');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [inviteUrl, setInviteUrl] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/organizations/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao convidar');

      setInviteUrl(data.inviteUrl);
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white rounded-[32px] w-full max-w-md p-8 shadow-2xl ring-1 ring-slate-900/10 scale-in-center">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-50 rounded-2xl text-blue-600">
              <UserPlus size={24} />
            </div>
            <h2 className="text-xl font-bold">Convidar Membro</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400">
            <X size={20} />
          </button>
        </div>

        {inviteUrl ? (
          <div className="space-y-6 animate-in zoom-in duration-300">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="h-20 w-20 bg-green-50 text-green-500 rounded-full flex items-center justify-center shadow-inner">
                <CheckCircle2 size={40} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Convite Criado!</h3>
                <p className="text-sm text-slate-500">Envie o link abaixo para o novo membro da equipe.</p>
              </div>
            </div>
            
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 break-all text-xs font-mono text-slate-600 flex items-center gap-3">
              <LinkIcon size={16} className="shrink-0 text-blue-500" />
              <span className="flex-1 select-all">{inviteUrl}</span>
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(inviteUrl);
                  alert('Copiado!');
                }}
                className="p-2 bg-white rounded-lg shadow-sm hover:bg-slate-100 transition-colors"
              >
                <Copy size={14} />
              </button>
            </div>

            <button 
              onClick={() => {
                setInviteUrl('');
                setEmail('');
                onClose();
              }}
              className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold transition-all hover:bg-black"
            >
              Fechar
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">E-mail do Convidado</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  required
                  type="email"
                  className="w-full bg-slate-50 border-none rounded-2xl pl-12 pr-5 py-4 font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
                  placeholder="exemplo@empresa.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Cargo / Role</label>
              <div className="grid grid-cols-2 gap-3">
                {['AGENT', 'SUPERVISOR', 'ADMIN'].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={`py-3 px-4 rounded-xl text-xs font-black uppercase tracking-widest border transition-all ${
                      role === r 
                        ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-200' 
                        : 'bg-white border-slate-200 text-slate-500 hover:border-blue-400'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {error && <p className="text-xs font-bold text-rose-500 text-center">{error}</p>}

            <button
              disabled={loading}
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl shadow-xl shadow-blue-200 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : <><UserPlus size={18} /> Gerar Link de Convite</>}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
