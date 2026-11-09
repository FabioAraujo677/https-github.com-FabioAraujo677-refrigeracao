import React, { useState, useEffect } from 'react';
import {
  X,
  UserPlus,
  Users,
  Wrench,
  Headphones,
  Truck,
  Phone,
  Mail,
  Trash2,
  CheckCircle2,
  Search,
  Check,
  Edit2,
  Shield,
  Smartphone,
  Eye,
  EyeOff,
  KeyRound,
} from 'lucide-react';
import { StaffMember, StaffRole } from '../types';
import { sbGetStaff, sbSaveStaff, sbDeleteStaff } from '../utils/supabaseService';
import { getStaff, saveStaff, addStaffMember, updateStaffMember, deleteStaffMember } from '../utils/storage';
import { formatPhone } from '../utils/formatters';

interface StaffManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStaffChange: () => void;
  initialRoleFilter?: StaffRole | 'all';
}

export const StaffManagementModal: React.FC<StaffManagementModalProps> = ({
  isOpen,
  onClose,
  onStaffChange,
  initialRoleFilter = 'all',
}) => {
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>(initialRoleFilter);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [memberToDelete, setMemberToDelete] = useState<StaffMember | null>(null);
  const [formName, setFormName] = useState('');
  const [formRole, setFormRole] = useState<StaffRole>('tecnico');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('123');
  const [formNotes, setFormNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const loadData = async () => {
    try {
      // 1. Sempre carrega imediatamente os colaboradores locais (garantia que nunca fica vazio)
      const localStaff = getStaff();
      setStaffList(localStaff);

      // 2. Busca na nuvem se disponível
      const cloudStaff = await sbGetStaff();
      if (cloudStaff && cloudStaff.length > 0) {
        setStaffList(cloudStaff);
        saveStaff(cloudStaff);
      }
    } catch (err) {
      console.error('Error loading staff:', err);
      setStaffList(getStaff());
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const reloadStaff = () => {
    loadData();
    onStaffChange();
  };

  const handleStartEdit = (member: StaffMember) => {
    setEditingId(member.id);
    setFormName(member.name);
    let mappedRole = member.role;
    if ((member.role as any) === 'funcionario de campo') mappedRole = 'tecnico';
    if ((member.role as any) === 'gerente') mappedRole = 'atendente';
    if ((member.role as any) === 'ormamentistas') mappedRole = 'motorista';
    setFormRole(mappedRole);
    setFormPhone(member.phone || '');
    setFormEmail(member.email || '');
    setFormPassword(member.password || '123');
    setFormNotes(member.notes || '');
    setShowAddForm(true);
    setFormError(null);
  };

  const handleCancelForm = () => {
    setShowAddForm(false);
    setEditingId(null);
    setFormName('');
    setFormRole('tecnico');
    setFormPhone('');
    setFormEmail('');
    setFormPassword('123');
    setFormNotes('');
    setFormError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setFormError('Por favor, informe o nome completo.');
      return;
    }

    const cleanEmail = formEmail.trim().toLowerCase() || undefined;
    const finalPassword = formPassword.trim() || '123';

    try {
      let savedMember: StaffMember;

      if (editingId) {
        const updated = updateStaffMember(editingId, {
          name: formName.trim(),
          role: formRole,
          phone: formPhone.trim() || undefined,
          email: cleanEmail,
          password: finalPassword,
          notes: formNotes.trim() || undefined,
          active: true,
        });
        savedMember = updated || {
          id: editingId,
          companyId: 'comp_admin_ice',
          name: formName.trim(),
          role: formRole,
          phone: formPhone.trim(),
          email: cleanEmail,
          password: finalPassword,
          notes: formNotes.trim(),
          active: true,
        };
      } else {
        savedMember = addStaffMember(
          formName.trim(),
          formRole,
          formPhone.trim() || undefined,
          cleanEmail,
          formNotes.trim() || undefined,
          finalPassword
        );
      }

      // Sincroniza em segundo plano com o Supabase
      sbSaveStaff(savedMember).catch((err) => console.warn('Supabase staff save queue:', err));

      setSuccessMsg(
        editingId
          ? `Colaborador atualizado! Login: ${cleanEmail || 'Sem e-mail'} | Senha: ${finalPassword}`
          : `Colaborador cadastrado! Login: ${cleanEmail || 'Sem e-mail'} | Senha: ${finalPassword}`
      );
      reloadStaff();
      handleCancelForm();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setFormError(err.message || 'Erro ao salvar colaborador.');
    }
  };

  const confirmDelete = async () => {
    if (!memberToDelete) return;
    deleteStaffMember(memberToDelete.id);
    sbDeleteStaff(memberToDelete.id).catch((err) => console.warn('Supabase staff delete:', err));
    reloadStaff();
    setSuccessMsg(`${memberToDelete.name} removido da equipe.`);
    setMemberToDelete(null);
    setTimeout(() => setSuccessMsg(null), 2500);
  };

  const handleToggleActive = async (member: StaffMember) => {
    const updated = updateStaffMember(member.id, { active: !member.active });
    if (updated) {
      sbSaveStaff(updated).catch((err) => console.warn('Supabase staff update:', err));
      reloadStaff();
    }
  };

  const isTechRole = (role: string) => role === 'tecnico' || role === 'funcionario de campo';
  const isAttRole = (role: string) => role === 'atendente' || role === 'gerente';
  const isDriverRole = (role: string) => role === 'motorista' || role === 'ormamentistas';

  const countTechnicians = staffList.filter((s) => isTechRole(s.role)).length;
  const countAttendants = staffList.filter((s) => isAttRole(s.role)).length;
  const countDrivers = staffList.filter((s) => isDriverRole(s.role)).length;

  const filteredStaff = staffList.filter((s) => {
    let matchesTab = true;
    if (activeTab === 'tecnico') matchesTab = isTechRole(s.role);
    else if (activeTab === 'atendente') matchesTab = isAttRole(s.role);
    else if (activeTab === 'motorista') matchesTab = isDriverRole(s.role);

    const matchesQuery =
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.phone && s.phone.includes(searchQuery)) ||
      (s.email && s.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (s.notes && s.notes.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesTab && matchesQuery;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-slate-900 border border-cyan-500/30 rounded-3xl shadow-[0_0_60px_rgba(6,182,212,0.25)] overflow-hidden my-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-950/80 border-b border-cyan-500/20">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                Cadastro e Gestão de Usuários / Equipe
              </h2>
              <p className="text-xs text-slate-400">
                Atendentes, Técnicos e Motoristas cadastrados no sistema
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success Alert */}
        {successMsg && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-5 max-h-[78vh] overflow-y-auto">
          {/* Quick Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800 text-center">
              <span className="text-[11px] text-slate-400 uppercase font-semibold">Total Equipe</span>
              <p className="text-xl font-black text-white mt-0.5">{staffList.length}</p>
            </div>
            <div className="p-3 rounded-2xl bg-cyan-950/30 border border-cyan-500/30 text-center">
              <div className="flex items-center justify-center gap-1 text-[11px] text-cyan-400 uppercase font-semibold">
                <Wrench className="w-3.5 h-3.5" /> Técnicos
              </div>
              <p className="text-xl font-black text-cyan-300 mt-0.5">{countTechnicians}</p>
            </div>
            <div className="p-3 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 text-center">
              <div className="flex items-center justify-center gap-1 text-[11px] text-emerald-400 uppercase font-semibold">
                <Headphones className="w-3.5 h-3.5" /> Atendentes
              </div>
              <p className="text-xl font-black text-emerald-300 mt-0.5">{countAttendants}</p>
            </div>
            <div className="p-3 rounded-2xl bg-amber-950/30 border border-amber-500/30 text-center">
              <div className="flex items-center justify-center gap-1 text-[11px] text-amber-400 uppercase font-semibold">
                <Truck className="w-3.5 h-3.5" /> Motoristas
              </div>
              <p className="text-xl font-black text-amber-300 mt-0.5">{countDrivers}</p>
            </div>
          </div>

          {/* Controls: Add Button & Search */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <button
              onClick={() => {
                setShowAddForm(!showAddForm);
                if (showAddForm) handleCancelForm();
              }}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold text-xs shadow-lg shadow-cyan-500/20 active:scale-95 transition-all"
            >
              <UserPlus className="w-4 h-4" />
              {showAddForm ? 'Cancelar Cadastro' : '+ Cadastrar Novo Colaborador'}
            </button>

            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por nome, telefone ou especialidade..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
              />
            </div>
          </div>

          {/* Add / Edit Form Panel */}
          {showAddForm && (
            <form
              onSubmit={handleSubmit}
              className="p-4 sm:p-5 rounded-2xl bg-slate-950 border border-cyan-500/40 space-y-4 animate-fadeIn"
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <h3 className="text-xs font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-2">
                  <UserPlus className="w-4 h-4" />
                  {editingId ? 'Editar Dados do Colaborador' : 'Novo Cadastro de Colaborador'}
                </h3>
                <span className="text-[10px] text-slate-500">Campos com * são obrigatórios</span>
              </div>

              {formError && (
                <p className="text-xs text-red-400 bg-red-950/40 border border-red-500/30 p-2.5 rounded-xl">
                  {formError}
                </p>
              )}

              {/* Role Selection Badges */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Função / Cargo no Sistema *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormRole('tecnico')}
                    className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-semibold transition-all ${
                      formRole === 'tecnico' || formRole === 'funcionario de campo'
                        ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-md shadow-cyan-900/30'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <Wrench className="w-4 h-4" />
                    <span>Técnico</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormRole('atendente')}
                    className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-semibold transition-all ${
                      formRole === 'atendente' || formRole === 'gerente'
                        ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 shadow-md shadow-emerald-900/30'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <Headphones className="w-4 h-4" />
                    <span>Atendente</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormRole('motorista')}
                    className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-semibold transition-all ${
                      formRole === 'motorista' || formRole === 'ormamentistas'
                        ? 'bg-amber-500/20 border-amber-400 text-amber-300 shadow-md shadow-amber-900/30'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <Truck className="w-4 h-4" />
                    <span>Motorista</span>
                  </button>
                </div>
              </div>

              {/* Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Nome Completo *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Wilian Pereira"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 text-sm focus:border-cyan-400 focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Telefone / WhatsApp (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="(11) 96157-0131"
                    value={formPhone}
                    onChange={(e) => setFormPhone(formatPhone(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 text-sm focus:border-cyan-400 focus:outline-none font-mono"
                  />
                </div>

                {/* Login Credentials Section */}
                <div className="sm:col-span-2 p-3.5 rounded-xl bg-slate-900/60 border border-cyan-500/30 space-y-3">
                  <h4 className="text-[11px] font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5" /> Credenciais de Acesso (Login e Senha do Colaborador)
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-300 mb-1">
                        E-mail de Login *
                      </label>
                      <input
                        type="email"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck="false"
                        placeholder="wilian@tecnico.com"
                        value={formEmail}
                        onChange={(e) => setFormEmail(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-600 text-xs focus:border-cyan-400 focus:outline-none font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-300 mb-1">
                        Senha de Acesso (Padrão: 123)
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          placeholder="123"
                          value={formPassword}
                          onChange={(e) => setFormPassword(e.target.value)}
                          className="w-full pl-3 pr-9 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-600 text-xs focus:border-cyan-400 focus:outline-none font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                        >
                          {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>
                  <p className="text-[10px] text-cyan-400/80">
                    💡 O colaborador usará este e-mail e a senha definida acima para entrar na conta dele em qualquer aparelho.
                  </p>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Especialidade ou Observação (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: geral, Geladeiras, Máquinas de Lavar"
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 text-sm focus:border-cyan-400 focus:outline-none"
                  />
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleCancelForm}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold shadow-lg shadow-cyan-500/25 active:scale-95 transition-all"
                >
                  {editingId ? 'Salvar Alterações' : 'Concluir Cadastro'}
                </button>
              </div>
            </form>
          )}

          {/* Filter Tabs */}
          <div className="flex items-center gap-1.5 border-b border-slate-800 pb-2 overflow-x-auto">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                activeTab === 'all'
                  ? 'bg-slate-800 text-white border border-slate-700'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Todos ({staffList.length})
            </button>
            <button
              onClick={() => setActiveTab('tecnico')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                activeTab === 'tecnico'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Wrench className="w-3.5 h-3.5" /> Técnicos ({countTechnicians})
            </button>
            <button
              onClick={() => setActiveTab('atendente')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                activeTab === 'atendente'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Headphones className="w-3.5 h-3.5" /> Atendentes ({countAttendants})
            </button>
            <button
              onClick={() => setActiveTab('motorista')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                activeTab === 'motorista'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Truck className="w-3.5 h-3.5" /> Motoristas ({countDrivers})
            </button>
          </div>

          {/* Collaborators List */}
          <div className="space-y-2.5">
            {filteredStaff.length === 0 ? (
              <div className="text-center py-10 text-slate-500 text-xs">
                Nenhum colaborador encontrado com os filtros selecionados.
              </div>
            ) : (
              filteredStaff.map((member) => {
                const isTech = isTechRole(member.role);
                const isAtt = isAttRole(member.role);
                const isDriver = isDriverRole(member.role);

                return (
                  <div
                    key={member.id}
                    className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all ${
                      member.active
                        ? 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                        : 'bg-slate-950/30 border-slate-900 opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {/* Avatar Badge */}
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                          isTech
                            ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                            : isAtt
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                        }`}
                      >
                        {isTech && <Wrench className="w-5 h-5" />}
                        {isAtt && <Headphones className="w-5 h-5" />}
                        {isDriver && <Truck className="w-5 h-5" />}
                      </div>

                      {/* Info */}
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-bold text-white">{member.name}</h4>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              isTech
                                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                                : isAtt
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            }`}
                          >
                            {isTech ? 'TÉCNICO' : isAtt ? 'ATENDENTE' : 'MOTORISTA'}
                          </span>
                          {!member.active && (
                            <span className="px-2 py-0.5 rounded-full text-[9px] bg-red-500/20 text-red-400 border border-red-500/30">
                              Inativo
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-xs text-slate-400 mt-1 flex-wrap">
                          {member.phone && (
                            <span className="flex items-center gap-1 font-mono text-[11px] text-slate-300">
                              <Phone className="w-3 h-3 text-cyan-400" />
                              {member.phone}
                            </span>
                          )}
                          {member.email && (
                            <span className="flex items-center gap-1 text-[11px] text-slate-300 font-mono">
                              <Mail className="w-3 h-3 text-slate-500" />
                              {member.email}
                            </span>
                          )}
                          {member.notes && (
                            <span className="text-[11px] text-slate-400 italic">
                              • {member.notes}
                            </span>
                          )}
                          <span className="flex items-center gap-1 font-mono text-[11px] text-cyan-300/90 bg-cyan-950/50 border border-cyan-800/40 px-2 py-0.5 rounded-md">
                            <KeyRound className="w-3 h-3 text-cyan-400" />
                            Senha: <strong className="text-white">{member.password || '123'}</strong>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 sm:gap-2">
                      {member.phone && (
                        <a
                          href={`https://wa.me/55${member.phone.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 rounded-xl text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                          title="Conversar no WhatsApp"
                        >
                          <Smartphone className="w-4 h-4" />
                        </a>
                      )}

                      <button
                        onClick={() => handleToggleActive(member)}
                        className={`p-2 rounded-xl transition-colors ${
                          member.active
                            ? 'text-emerald-400 hover:bg-emerald-500/10'
                            : 'text-slate-500 hover:bg-slate-800'
                        }`}
                        title={member.active ? 'Desativar' : 'Ativar'}
                      >
                        <Check className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => handleStartEdit(member)}
                        className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                        title="Editar Colaborador"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => setMemberToDelete(member)}
                        className="p-2 rounded-xl text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Excluir Colaborador"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 bg-slate-950/80 border-t border-slate-800">
          <div className="text-[11px] text-slate-500">
            Colaboradores cadastrados ficam disponíveis para seleção instantânea em Ordens de Serviço e Agendamentos.
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition-all"
          >
            Fechar
          </button>
        </div>

        {/* Deletion Confirmation Overlay */}
        {memberToDelete && (
          <div className="absolute inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
            <div className="w-full max-w-sm bg-slate-900 border border-red-500/40 rounded-3xl p-6 shadow-[0_0_50px_rgba(239,68,68,0.2)]">
              <div className="flex items-center gap-3 text-red-400 mb-4">
                <div className="h-12 w-12 rounded-2xl bg-red-500/20 border border-red-500/40 flex items-center justify-center">
                  <Trash2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Remover da Equipe?</h3>
                  <p className="text-xs text-red-300 font-medium">Ação irreversível</p>
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed mb-6">
                Você está prestes a excluir <strong className="text-white">{memberToDelete.name}</strong> ({memberToDelete.role}) do sistema. Esta ação não pode ser desfeita.
              </p>

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setMemberToDelete(null)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirmDelete}
                  className="px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-lg shadow-red-900/40 active:scale-95 transition-all"
                >
                  Sim, Excluir
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
