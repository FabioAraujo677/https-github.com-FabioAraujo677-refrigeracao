import React, { useState } from 'react';
import {
  X,
  Shield,
  KeyRound,
  Mail,
  User as UserIcon,
  Crown,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Phone,
  Eye,
  EyeOff,
} from 'lucide-react';
import { User, UserRole, CompanySettings } from '../types';
import { formatPhone } from '../utils/formatters';
import { supabase } from '../lib/supabaseClient';
import { isMasterAdmin } from '../utils/authUtils';
import { loginUser, registerUser, getStaff, setCurrentUser, syncAllStaffToUsers } from '../utils/storage';
import { fetchServerState } from '../utils/cloudSync';

interface AuthModalProps {
  isOpen: boolean;
  company?: CompanySettings;
  onClose: () => void;
  onSuccess: (user: User) => void;
  initialMode?: 'login' | 'register';
  isPage?: boolean;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  company,
  onClose,
  onSuccess,
  initialMode = 'login',
  isPage = false,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [rolePreference, setRolePreference] = useState<UserRole>('tecnico');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  if (!isOpen) return null;

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    if (!name.trim()) {
      setError('Por favor digite seu nome completo.');
      setIsLoading(false);
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setError('Por favor digite um e-mail válido.');
      setIsLoading(false);
      return;
    }
    if (!password || password.length < 3) {
      setError('A senha deve ter no mínimo 3 caracteres.');
      setIsLoading(false);
      return;
    }

    try {
      const isMaster = isMasterAdmin(email);
      const finalRole: UserRole = isMaster ? 'admin' : rolePreference;

      // 1. Cadastra localmente (garante que nunca falha por conexão ou configuração)
      const { user: newUser } = registerUser({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password: password.trim(),
        phone: phone.trim() || undefined,
        rolePreference: finalRole,
      });

      // 2. Salva em segundo plano no Supabase Auth se disponível
      supabase.auth.signUp({
        email: email.trim(),
        password: password.trim(),
        options: {
          data: {
            full_name: name.trim(),
            role: finalRole,
            company_id: newUser.companyId,
          }
        }
      }).catch((err) => console.warn('Supabase auth signup notice:', err));

      setSuccessMsg(
        isMaster
          ? '👑 Bem-vindo, Administrador Master! Acesso total liberado.'
          : 'Cadastro realizado com sucesso! Acesso liberado.'
      );

      setTimeout(() => {
        onSuccess(newUser);
        if (!isPage) onClose();
      }, 800);
    } catch (err: any) {
      setError(err.message || 'Erro ao realizar cadastro.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanEmail || !cleanPassword) {
      setError('Preencha o e-mail e a senha.');
      setIsLoading(false);
      return;
    }

    // 0. Sincroniza estado centralizado do servidor para garantir sub-usuários criados em qualquer aparelho
    try {
      await fetchServerState();
      syncAllStaffToUsers();
    } catch {
      // Ignora falhas pontuais de rede
    }

    // 1. Prioridade 1: Autenticação via sistema integrado (Master Admin + Equipe cadastrada + Sublogins)
    const localUser = loginUser(cleanEmail, cleanPassword);
    if (localUser) {
      setIsLoading(false);
      setSuccessMsg(`Bem-vindo(a), ${localUser.name}!`);
      setTimeout(() => {
        onSuccess(localUser);
        if (!isPage) onClose();
      }, 400);
      return;
    }

    // 2. Se não bateu a senha, verifica se o colaborador existe na equipe para orientar sobre a senha
    const staffList = getStaff();
    const matched = staffList.find(s => 
      s.email?.trim().toLowerCase() === cleanEmail ||
      s.name.trim().toLowerCase() === cleanEmail
    );

    if (matched) {
      if (!matched.active) {
        setError('Este colaborador está desativado pelo administrador.');
        setIsLoading(false);
        return;
      }
      setError(`Senha incorreta para ${matched.name}. (Dica: A senha cadastrada é "${matched.password || '123'}")`);
      setIsLoading(false);
      return;
    }

    // 3. Fallback: Supabase Auth
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: cleanPassword,
      });

      if (!signInError && data?.user) {
        const { data: profile } = await supabase
          .from('users')
          .select('*')
          .eq('id', data.user.id)
          .single();

        const user: User = profile ? {
          ...profile,
          companyId: profile.company_id || 'comp_admin_ice',
        } : {
          id: data.user.id,
          name: data.user.user_metadata?.full_name || cleanEmail.split('@')[0],
          email: data.user.email!,
          role: data.user.user_metadata?.role || (isMasterAdmin(data.user.email) ? 'admin' : 'tecnico'),
          companyId: data.user.user_metadata?.company_id || 'comp_admin_ice',
          createdAt: data.user.created_at,
        };

        setCurrentUser(user);
        onSuccess(user);
        if (!isPage) onClose();
        return;
      }
    } catch (err: any) {
      console.warn('Supabase auth fallback:', err);
    }

    setError('E-mail ou senha incorretos.');
    setIsLoading(false);
  };

  const containerClasses = isPage 
    ? "relative w-full max-w-sm sm:max-w-md bg-[#121418] border border-white/5 rounded-3xl shadow-[0_0_80px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col animate-scaleIn"
    : "relative w-full max-w-sm sm:max-w-md bg-[#121418] border border-white/10 rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.3)] overflow-hidden my-auto max-h-[94vh] flex flex-col animate-scaleIn";

  return (
    <div className={isPage ? "flex items-center justify-center w-full min-h-[90vh] py-10" : "fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/90 backdrop-blur-xl overflow-y-auto"}>
      <div className={containerClasses}>
        {/* Glow corner decorations */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

        {/* Central Logo for Page Mode */}
        {isPage && (
          <div className="flex flex-col items-center justify-center pt-12 pb-4 px-6 relative z-10">
            <div className="h-32 w-32 rounded-3xl bg-[#0f1115] border border-white/10 flex items-center justify-center overflow-hidden mb-6 shadow-[0_0_40px_rgba(0,0,0,0.4)] transition-transform hover:scale-105 duration-500">
              {company?.logoUrl ? (
                <img src={company.logoUrl} alt="Logo" className="h-full w-full object-contain p-4" />
              ) : (
                <Shield className="w-16 h-14 text-cyan-400/80" />
              )}
            </div>
            <h1 className="text-2xl font-black text-white text-center leading-tight tracking-tight uppercase font-tech">
              {company?.name || 'GarantiaPro Neo'}
            </h1>
            <div className="h-0.5 w-12 bg-cyan-500/40 rounded-full mt-3 mb-2" />
            <p className="text-[10px] text-cyan-400 font-bold font-mono text-center opacity-60 uppercase tracking-[0.2em]">
              Sistema de Gestão Integrada
            </p>
          </div>
        )}

        {/* Modal Header with Company Logo (Only if NOT page mode) */}
        {!isPage && (
          <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-white/5 bg-black/20 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-9 w-9 rounded-xl bg-[#0f1115] border border-white/10 flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
                {company?.logoUrl ? (
                  <img src={company.logoUrl} alt="Logo" className="h-full w-full object-contain p-1" />
                ) : (
                  <Shield className="w-4 h-4 text-cyan-400/70" />
                )}
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-white text-xs sm:text-sm leading-tight truncate">
                  {company?.name || 'GarantiaPro Neo'}
                </h3>
                <p className="text-[9px] text-cyan-400/60 font-mono truncate uppercase tracking-wider">
                  Acesso Restrito
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition-colors shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Tabs: Entrar / Cadastrar (Compact) */}
        <div className="grid grid-cols-2 p-1 mx-4 sm:mx-6 my-4 bg-black/20 rounded-xl border border-white/5 shrink-0">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError(null);
              setSuccessMsg(null);
            }}
            className={`py-1.5 text-[11px] font-black uppercase tracking-wider rounded-lg transition-all ${
              mode === 'login'
                ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            Entrar
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setError(null);
              setSuccessMsg(null);
            }}
            className={`py-1.5 text-[11px] font-black uppercase tracking-wider rounded-lg transition-all relative ${
              mode === 'register'
                ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            Cadastrar
          </button>
        </div>

        {/* Form Body (Compact) */}
        <div className="px-4 sm:px-6 pb-6 overflow-y-auto flex-1">
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-rose-500/5 border border-rose-500/20 text-rose-400 text-[10px] font-bold uppercase flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {mode === 'register' ? (
            <form onSubmit={handleRegister} className="space-y-3">
              <div>
                <label className="block text-[9px] font-black uppercase text-slate-500 mb-1 ml-1">Nome Completo</label>
                <div className="relative">
                  <UserIcon className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-600" />
                  <input
                    type="text"
                    required
                    placeholder="Seu nome"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-black/20 border border-white/5 text-white placeholder-slate-600 text-xs focus:border-cyan-500/50 focus:outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[9px] font-black uppercase text-slate-500 mb-1 ml-1">E-mail</label>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-600" />
                  <input
                    type="email"
                    required
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck="false"
                    placeholder="email@empresa.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-black/20 border border-white/5 text-white placeholder-slate-600 text-xs focus:border-cyan-500/50 focus:outline-none transition-all font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[9px] font-black uppercase text-slate-500 mb-1 ml-1">WhatsApp</label>
                <div className="relative">
                  <Phone className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-600" />
                  <input
                    type="text"
                    placeholder="(11) 99999-9999"
                    value={phone}
                    onChange={(e) => setPhone(formatPhone(e.target.value))}
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-black/20 border border-white/5 text-white placeholder-slate-600 text-xs focus:border-cyan-500/50 focus:outline-none transition-all font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[9px] font-black uppercase text-slate-500 mb-1 ml-1">Senha (Mín. 6 caracteres)</label>
                <div className="relative">
                  <KeyRound className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-600" />
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-black/20 border border-white/5 text-white placeholder-slate-600 text-xs focus:border-cyan-500/50 focus:outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[9px] font-black uppercase text-slate-500 mb-1 ml-1">Função</label>
                <select
                  value={rolePreference}
                  onChange={(e) => setRolePreference(e.target.value as UserRole)}
                  className="w-full px-3 py-2 rounded-xl bg-black/20 border border-white/5 text-white text-xs focus:border-cyan-500/50 focus:outline-none cursor-pointer"
                >
                  <option value="tecnico">Técnico</option>
                  <option value="atendente">Atendente</option>
                  <option value="motorista">Motorista</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-700 hover:from-cyan-500 hover:to-blue-600 text-white font-black text-xs uppercase tracking-[0.15em] shadow-lg shadow-cyan-950/20 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isLoading ? 'Criando...' : 'Criar Conta'}
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setError(null);
                    setSuccessMsg(null);
                  }}
                  className="text-xs text-cyan-400 hover:text-cyan-300 font-bold underline transition-colors cursor-pointer"
                >
                  Já tem cadastro? Entrar na Conta
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-[9px] font-black uppercase text-slate-500 mb-1 ml-1">E-mail de Acesso</label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3.5 top-3 text-slate-600" />
                  <input
                    type="email"
                    required
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck="false"
                    placeholder="email@exemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 rounded-xl bg-black/20 border border-white/5 text-white placeholder-slate-700 text-sm focus:border-cyan-500/50 focus:outline-none transition-all font-mono shadow-inner"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[9px] font-black uppercase text-slate-500 mb-1 ml-1">Senha Privada</label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 absolute left-3.5 top-3 text-slate-600" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Sua senha"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-11 pr-11 py-3 rounded-xl bg-black/20 border border-white/5 text-white placeholder-slate-700 text-sm focus:border-cyan-500/50 focus:outline-none transition-all shadow-inner font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-3 text-slate-500 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 px-4 py-4 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-700 hover:from-cyan-500 hover:to-blue-600 text-white font-black text-sm uppercase tracking-[0.2em] shadow-xl shadow-cyan-950/30 active:scale-95 transition-all flex items-center justify-center gap-3 cursor-pointer disabled:opacity-50"
              >
                <span>{isLoading ? 'Entrando...' : 'Entrar na Conta'}</span>
                <ArrowRight className="w-5 h-5" />
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setError(null);
                    setSuccessMsg(null);
                  }}
                  className="text-xs text-cyan-400 hover:text-cyan-300 font-bold underline transition-colors cursor-pointer"
                >
                  Não tem cadastro? Cadastre-se
                </button>
              </div>
            </form>
          )}
        </div>
        
        {/* Compact Footer */}
        <div className="px-6 py-3 border-t border-white/5 bg-black/20 text-center shrink-0">
          <p className="text-[8px] text-slate-600 font-black uppercase tracking-widest">
            GarantiaPro Neo • Sistema de Gestão
          </p>
        </div>
      </div>
    </div>
  );
};

