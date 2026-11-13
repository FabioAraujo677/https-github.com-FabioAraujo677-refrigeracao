import React, { useState, useEffect } from 'react';
import {
  X,
  Calendar,
  Clock,
  User,
  MapPin,
  Wrench,
  Cpu,
  Plus,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Share2,
  FileText,
  DollarSign,
  Shield,
  Sparkles,
  Truck,
  Users,
  Bell,
  Volume2,
} from 'lucide-react';
import { ApplianceType, StaffMember, StaffRole, WarrantyOrder, PaymentMethod, TechLeadTimeAlert } from '../types';
import { supabase } from '../lib/supabaseClient';
import { fetchAddressByCep } from '../utils/viacep';
import { formatCep, formatPhone, formatCpf, cleanNumeric, formatCurrency, formatDate, formatDateWithWeekday } from '../utils/formatters';
import { SignaturePad } from './SignaturePad';
import { sbSaveStaff } from '../utils/supabaseService';
import { addStaffMember } from '../utils/storage';
import { playScheduleConfirmedSound } from '../utils/audio';

interface ScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (scheduleData: any) => void;
  staffList: StaffMember[];
  onStaffAdded: (newMember: StaffMember) => void;
  onOpenStaffManagement?: () => void;
}

const APPLIANCE_OPTIONS: ApplianceType[] = [
  'Geladeira / Refrigerador',
  'Lava e Seca',
  'Máquina de Lavar',
  'Freezer / Frigobar',
  'Fogão / Cooktop',
  'Micro-ondas',
  'Lava-Louças',
  'Secadora de Roupas',
  'Ar Condicionado',
  'Outro Eletrodoméstico',
];

const POPULAR_BRANDS = ['Brastemp', 'Electrolux', 'Samsung', 'LG', 'Consul', 'Panasonic', 'Midea', 'Outra'];

export const ScheduleModal: React.FC<ScheduleModalProps> = ({
  isOpen,
  onClose,
  onSave,
  staffList,
  onStaffAdded,
  onOpenStaffManagement,
}) => {
  // Customer Info
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerCpf, setCustomerCpf] = useState('');

  // Address (ViaCEP)
  const [cep, setCep] = useState('');
  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [complement, setComplement] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [isLoadingCep, setIsLoadingCep] = useState(false);
  const [cepSuccess, setCepSuccess] = useState(false);
  const [cepError, setCepError] = useState<string | null>(null);

  // Appliance
  const [applianceType, setApplianceType] = useState<ApplianceType>('Geladeira / Refrigerador');
  const [applianceBrand, setApplianceBrand] = useState('Brastemp');
  const [applianceModel, setApplianceModel] = useState('');

  // Scheduling Details
  const getTodayString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getTomorrowString = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [scheduledDate, setScheduledDate] = useState<string>(getTodayString());
  const [scheduledTime, setScheduledTime] = useState<string>('08:00');
  const [technicianLeadTimeAlert, setTechnicianLeadTimeAlert] = useState<TechLeadTimeAlert>('30m');
  const [visitFee, setVisitFee] = useState<string>('0.00'); // 0 = Isento / Em garantia
  const [isFeeWaived, setIsFeeWaived] = useState<boolean>(true);

  // Staff (Dropdown selection only - no manual mode)
  const [profilesList, setProfilesList] = useState<StaffMember[]>([]);
  const [technicianName, setTechnicianName] = useState('');
  const [technicianId, setTechnicianId] = useState('');
  const [attendantName, setAttendantName] = useState('');
  const [driverName, setDriverName] = useState('');

  const [showAddStaffModal, setShowAddStaffModal] = useState<StaffRole | null>(null);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffPhone, setNewStaffPhone] = useState('');

  // Problem & Warranty
  const [defectDescription, setDefectDescription] = useState('');
  const [serviceDescription, setServiceDescription] = useState('Visita técnica para diagnóstico e reparo');
  const [warrantyMonths, setWarrantyMonths] = useState<number>(3);
  const [clientSignature, setClientSignature] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Load profiles directly from Supabase table 'profiles' on modal open
  useEffect(() => {
    if (!isOpen) return;

    async function fetchProfiles() {
      try {
        const { data, error } = await supabase.from('profiles').select('*');
        if (!error && data && data.length > 0) {
          const mapped: StaffMember[] = data.map((row: any) => {
            const displayName = row.name || row.full_name || (row.email ? row.email.split('@')[0] : 'Colaborador');
            return {
              id: row.id,
              companyId: row.company_id || row.companyId || 'icerefrigeracaopreventiva@gmail.com',
              name: displayName,
              role: row.role || 'tecnico',
              phone: row.phone || '',
              email: row.email || '',
              password: row.password || '123',
              notes: row.notes || '',
              active: row.active !== false,
            };
          });
          setProfilesList(mapped);
        }
      } catch (err) {
        console.warn('Error fetching profiles in ScheduleModal:', err);
      }
    }

    fetchProfiles();
  }, [isOpen]);

  // Combine staff from props and Supabase profiles
  const allStaff = React.useMemo(() => {
    const map = new Map<string, StaffMember>();
    staffList.forEach((s) => { if (s && s.id) map.set(s.id, s); });
    profilesList.forEach((s) => { if (s && s.id && !map.has(s.id)) map.set(s.id, s); });
    return Array.from(map.values());
  }, [staffList, profilesList]);

  // Filter technicians by role ('tecnico' or 'funcionario de campo') or name/email matching 'wilian'
  const techOptions = React.useMemo(() => {
    return allStaff.filter((s) => {
      if (!s.active) return false;
      const r = (s.role || '').toLowerCase().trim();
      const n = (s.name || '').toLowerCase().trim();
      const e = (s.email || '').toLowerCase().trim();
      return (
        r === 'tecnico' ||
        r === 'técnico' ||
        r === 'funcionario de campo' ||
        r === 'funcionário de campo' ||
        r === 'tech' ||
        n.includes('wilian') ||
        e.includes('wilian')
      );
    });
  }, [allStaff]);

  const attOptions = React.useMemo(() => {
    return allStaff.filter(
      (s) => s.active && (s.role === 'atendente' || (s.role as any) === 'gerente' || s.role === 'admin')
    );
  }, [allStaff]);

  const driverOptions = React.useMemo(() => {
    return allStaff.filter(
      (s) => s.active && (s.role === 'motorista' || (s.role as any) === 'ormamentistas')
    );
  }, [allStaff]);

  const resetScheduleForm = () => {
    setCustomerName('');
    setCustomerPhone('');
    setCustomerCpf('');
    setCep('');
    setStreet('');
    setNumber('');
    setComplement('');
    setNeighborhood('');
    setCity('');
    setState('');
    setIsLoadingCep(false);
    setCepSuccess(false);
    setCepError(null);
    setApplianceType('Geladeira / Refrigerador');
    setApplianceBrand('Brastemp');
    setApplianceModel('');
    setScheduledDate(getTodayString());
    setScheduledTime('08:00');
    setTechnicianLeadTimeAlert('30m');
    setVisitFee('0.00');
    setIsFeeWaived(true);
    setDriverName('');
    setDefectDescription('');
    setServiceDescription('Visita técnica para diagnóstico e reparo');
    setWarrantyMonths(3);
    setClientSignature('');
    setNotes('');
    setFormError(null);
  };

  useEffect(() => {
    if (!isOpen) {
      resetScheduleForm();
      return;
    }

    if (!attendantName && attOptions.length > 0) {
      setAttendantName(attOptions[0].name);
    }
    if (!technicianName && techOptions.length > 0) {
      setTechnicianName(techOptions[0].name);
      setTechnicianId(techOptions[0].id);
    }
  }, [isOpen, techOptions, attOptions]);

  if (!isOpen) return null;

  const handleCepChange = async (value: string) => {
    const formatted = formatCep(value);
    setCep(formatted);
    setCepError(null);

    const numeric = cleanNumeric(formatted);
    if (numeric.length === 8) {
      setIsLoadingCep(true);
      setCepSuccess(false);
      try {
        const result = await fetchAddressByCep(numeric);
        if (result) {
          setStreet(result.logradouro || '');
          setNeighborhood(result.bairro || '');
          setCity(result.localidade || '');
          setState(result.uf || '');
          setCepSuccess(true);
          setTimeout(() => {
            const numInput = document.getElementById('input-schedule-numero');
            if (numInput) (numInput as HTMLInputElement).focus();
          }, 100);
        } else {
          setCepError('CEP não localizado. Preencha manualmente.');
        }
      } catch {
        setCepError('Erro ao consultar CEP. Preencha o endereço.');
      } finally {
        setIsLoadingCep(false);
      }
    } else {
      setCepSuccess(false);
    }
  };

  const handleCreateStaff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffName.trim() || !showAddStaffModal) return;

    const newMember = addStaffMember(
      newStaffName.trim(),
      showAddStaffModal,
      newStaffPhone.trim() || undefined,
      undefined,
      undefined,
      '123'
    );

    onStaffAdded(newMember);
    if (showAddStaffModal === 'atendente' || (showAddStaffModal as any) === 'gerente') {
      setAttendantName(newMember.name);
    } else if (showAddStaffModal === 'motorista' || (showAddStaffModal as any) === 'ormamentistas') {
      setDriverName(newMember.name);
    } else {
      setTechnicianName(newMember.name);
      setTechnicianId(newMember.id);
    }
    setNewStaffName('');
    setNewStaffPhone('');
    setShowAddStaffModal(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!customerName.trim()) {
      setFormError('Por favor informe o nome do cliente.');
      return;
    }
    if (!customerPhone.trim()) {
      setFormError('Por favor informe o WhatsApp do cliente.');
      return;
    }
    if (!street.trim()) {
      setFormError('Por favor informe o endereço (digite o CEP para busca automática).');
      return;
    }
    if (!scheduledDate) {
      setFormError('Selecione a data da visita técnica.');
      return;
    }
    if (!defectDescription.trim()) {
      setFormError('Informe o defeito ou motivo do agendamento.');
      return;
    }

    const feeValue = isFeeWaived ? 0 : parseFloat(visitFee.replace(',', '.')) || 0;

    const scheduleData = {
      company_id: 'icerefrigeracaopreventiva@gmail.com',
      companyId: 'icerefrigeracaopreventiva@gmail.com',
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      customerCpf: customerCpf.trim() || undefined,
      cep: cep.trim(),
      street: street.trim(),
      number: number.trim() || 'S/N',
      complement: complement.trim() || undefined,
      neighborhood: neighborhood.trim(),
      city: city.trim(),
      state: state.trim() || 'SP',
      applianceType,
      applianceBrand,
      applianceModel: applianceModel.trim() || undefined,
      attendantName: attendantName || 'Atendimento Central',
      technicianName: technicianName || 'wilian',
      technician_name: technicianName || 'wilian',
      technicianId: technicianId || undefined,
      technician_id: technicianId || undefined,
      driverName: driverName.trim() || undefined,
      defectDescription: defectDescription.trim(),
      serviceDescription: serviceDescription.trim() || 'Diagnóstico e reparo no local agendado',
      partsReplaced: 'A definir na visita técnica',
      totalValue: feeValue,
      visitFee: feeValue,
      paymentMethod: 'Pix' as PaymentMethod,
      paymentStatus: (feeValue > 0 ? 'Pendente' : 'Pago') as 'Pago' | 'Pendente',
      warrantyMonths,
      orderType: 'agendamento' as const,
      attendanceStatus: 'Na fila / Aguardando' as const,
      scheduledDate,
      scheduledTime,
      technicianLeadTimeAlert,
      clientSignature: clientSignature || undefined,
      notes: notes.trim() || undefined,
    };

    playScheduleConfirmedSound(0.38);
    onSave(scheduleData);
    resetScheduleForm();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-purple-500/30 rounded-3xl shadow-[0_0_50px_rgba(168,85,247,0.2)] overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-slate-950/90 border-b border-purple-500/20 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-[0_0_20px_rgba(168,85,247,0.4)]">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-wide flex items-center gap-2">
                Agendamento de Visita Técnica
                <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-purple-500/20 text-purple-300 border border-purple-500/40 font-bold">
                  Com Dados da Garantia
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Agende a visita no endereço do cliente com cálculo automático de CEP
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-4 sm:p-6 space-y-5 flex-1">
          {formError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* SECTION 1: DATA E HORÁRIO DA VISITA */}
          <div className="rounded-2xl border border-purple-500/30 bg-purple-950/15 p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-purple-300">
              <Clock className="w-4 h-4 text-purple-400" />
              <span>1. Data, Horário & Taxa da Visita Técnica</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-slate-300">
                    Data da Visita Técnica *
                  </label>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setScheduledDate(getTodayString())}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-all ${
                        scheduledDate === getTodayString()
                          ? 'bg-purple-500/30 text-purple-200 border-purple-400'
                          : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-white'
                      }`}
                    >
                      Hoje
                    </button>
                    <button
                      type="button"
                      onClick={() => setScheduledDate(getTomorrowString())}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-all ${
                        scheduledDate === getTomorrowString()
                          ? 'bg-purple-500/30 text-purple-200 border-purple-400'
                          : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-white'
                      }`}
                    >
                      Amanhã
                    </button>
                  </div>
                </div>
                <input
                  type="date"
                  required
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-purple-500/40 text-white text-sm focus:border-purple-400 focus:outline-none font-bold"
                />
                {scheduledDate && (
                  <p className="text-[11px] font-bold text-purple-300 mt-1 flex items-center gap-1">
                    <span>📅</span>
                    <span>{formatDateWithWeekday(scheduledDate, false)}</span>
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Período / Horário Preferencial *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    list="time-suggestions"
                    placeholder="Ex: Manhã (08:00 às 12:00)"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-purple-500/40 text-white text-sm focus:border-purple-400 focus:outline-none font-bold"
                  />
                  <datalist id="time-suggestions">
                    <option value="Manhã (08:00 às 12:00)" />
                    <option value="Tarde (13:00 às 18:00)" />
                    <option value="Noite (18:00 às 20:00)" />
                    <option value="Horário Comercial" />
                    <option value="08:00" />
                    <option value="10:00" />
                    <option value="13:00" />
                    <option value="15:00" />
                  </datalist>
                </div>
              </div>
            </div>

            {/* Taxa de Visita */}
            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-slate-200 block">
                  Taxa de Visita / Diagnóstico
                </span>
                <span className="text-[11px] text-slate-400">
                  {isFeeWaived ? 'Isento / Visita em Garantia' : 'Cobrança no local caso não aprove conserto'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsFeeWaived(true);
                    setVisitFee('0.00');
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                    isFeeWaived
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-md'
                      : 'bg-slate-900 text-slate-400 border-slate-700'
                  }`}
                >
                  ✓ Isento / Garantia
                </button>
                <button
                  type="button"
                  onClick={() => setIsFeeWaived(false)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                    !isFeeWaived
                      ? 'bg-purple-500/20 text-purple-300 border-purple-500/50 shadow-md'
                      : 'bg-slate-900 text-slate-400 border-slate-700'
                  }`}
                >
                  Cobrar Taxa (R$)
                </button>
                {!isFeeWaived && (
                  <input
                    type="number"
                    step="0.01"
                    placeholder="50.00"
                    value={visitFee}
                    onChange={(e) => setVisitFee(e.target.value)}
                    className="w-24 px-2 py-1 rounded-xl bg-slate-900 border border-purple-500/40 text-purple-300 text-xs font-bold font-mono"
                  />
                )}
              </div>
            </div>

            {/* Aviso Antecipado & Alarme Sonoro do Técnico */}
            <div className="p-3.5 bg-slate-950/70 rounded-xl border border-purple-500/30 space-y-2.5">
              <div className="flex items-center justify-between flex-wrap gap-1">
                <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Volume2 className="w-4 h-4 text-purple-400 animate-pulse" />
                  <span>Avisar Técnico com Notificação Sonora Contínua</span>
                </span>
                <span className="text-[10px] text-purple-300 font-mono font-bold bg-purple-500/20 border border-purple-500/40 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-purple-400 animate-ping" />
                  Alarme só para ao aceitar
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-tight">
                Escolha a antecedência para disparar o alarme no celular/painel do técnico. O som tocará repetidamente até o técnico clicar em <strong className="text-purple-300">"Aceitar Visita"</strong>:
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-0.5">
                {[
                  { value: 'imediato', label: 'Imediato (Ao Agendar)' },
                  { value: '15m', label: '15 min antes' },
                  { value: '30m', label: '30 min antes (Meia hora)' },
                  { value: '1h', label: '1 hora antes' },
                  { value: '2h', label: '2 horas antes' },
                  { value: '1d', label: '1 dia antes (24h)' },
                  { value: 'sem_aviso', label: 'Sem aviso sonoro' },
                ].map((option) => {
                  const isSelected = technicianLeadTimeAlert === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setTechnicianLeadTimeAlert(option.value as TechLeadTimeAlert)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all text-center ${
                        isSelected
                          ? 'bg-purple-600/30 text-purple-200 border-purple-400 shadow-md ring-1 ring-purple-400/40'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white hover:border-slate-700'
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* SECTION 2: DADOS DO CLIENTE & CEP AUTOMÁTICO */}
          <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cyan-400">
              <User className="w-4 h-4" />
              <span>2. Cliente & Endereço da Visita (ViaCEP Automático)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Nome do Cliente *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Carlos Eduardo de Oliveira"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 text-sm focus:border-cyan-400 focus:outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Telefone / WhatsApp do Cliente *
                </label>
                <input
                  type="text"
                  required
                  placeholder="(11) 99999-9999"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(formatPhone(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 text-sm focus:border-cyan-400 focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  CPF do Cliente (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="000.000.000-00"
                  value={customerCpf}
                  onChange={(e) => setCustomerCpf(formatCpf(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 text-sm focus:border-cyan-400 focus:outline-none font-mono"
                />
              </div>
            </div>

            {/* CEP Box */}
            <div className="pt-2 border-t border-slate-800/80">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-cyan-300 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>CEP da Residência (Preenchimento Automático) *</span>
                </label>
                {isLoadingCep && (
                  <span className="text-[10px] text-cyan-400 flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> Buscando no satélite...
                  </span>
                )}
                {cepSuccess && (
                  <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-semibold">
                    <CheckCircle2 className="w-3 h-3" /> Endereço localizado!
                  </span>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-1">
                  <input
                    type="text"
                    maxLength={9}
                    placeholder="00000-000"
                    value={cep}
                    onChange={(e) => handleCepChange(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-cyan-500/40 text-cyan-200 placeholder-slate-500 text-sm font-mono focus:border-cyan-300 focus:outline-none font-bold text-center"
                  />
                </div>
                <div className="col-span-2">
                  <input
                    type="text"
                    placeholder="Rua / Avenida (Preenchida pelo CEP)"
                    value={street}
                    onChange={(e) => setStreet(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 text-sm focus:border-cyan-400 focus:outline-none"
                  />
                </div>
              </div>

              {cepError && (
                <p className="text-[11px] text-amber-400 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {cepError}
                </p>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-0.5">Número *</label>
                  <input
                    id="input-schedule-numero"
                    type="text"
                    placeholder="Ex: 102"
                    value={number}
                    onChange={(e) => setNumber(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:border-cyan-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-0.5">Complemento</label>
                  <input
                    type="text"
                    placeholder="Apto / Casa"
                    value={complement}
                    onChange={(e) => setComplement(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:border-cyan-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-0.5">Bairro</label>
                  <input
                    type="text"
                    placeholder="Bairro"
                    value={neighborhood}
                    onChange={(e) => setNeighborhood(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:border-cyan-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-0.5">Cidade / UF</label>
                  <input
                    type="text"
                    placeholder="Cidade - UF"
                    value={city ? `${city} / ${state}` : ''}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:border-cyan-400 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 3: APARELHO & TÉCNICO ESCALADO */}
          <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cyan-400">
              <Cpu className="w-4 h-4" />
              <span>3. Aparelho & Técnico Responsável</span>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Aparelho a ser Consertado / Avaliado *
              </label>
              <select
                value={applianceType}
                onChange={(e) => setApplianceType(e.target.value as ApplianceType)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm focus:border-cyan-400 focus:outline-none"
              >
                {APPLIANCE_OPTIONS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Marca do Aparelho
                </label>
                <select
                  value={applianceBrand}
                  onChange={(e) => setApplianceBrand(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm focus:border-cyan-400 focus:outline-none"
                >
                  {POPULAR_BRANDS.map((brand) => (
                    <option key={brand} value={brand}>
                      {brand}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Modelo ou Capacidade
                </label>
                <input
                  type="text"
                  placeholder="Ex: Frost Free 420L / Lava e Seca 11kg"
                  value={applianceModel}
                  onChange={(e) => setApplianceModel(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 text-sm focus:border-cyan-400 focus:outline-none"
                />
              </div>
            </div>

            {/* Escalação de Profissionais - Exclusivamente via seleção de Cadastrados */}
            <div className="pt-2 border-t border-slate-800/80 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Escalação de Profissionais
                </span>
                {onOpenStaffManagement && (
                  <button
                    type="button"
                    onClick={onOpenStaffManagement}
                    className="text-[11px] text-purple-400 hover:text-purple-300 flex items-center gap-1 font-semibold hover:underline"
                  >
                    <Users className="w-3.5 h-3.5" /> Gerenciar Equipe / Usuários
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Técnico Responsável */}
                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                  <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                    <Wrench className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Técnico Escalado *</span>
                  </label>

                  <div className="space-y-1.5">
                    <select
                      value={technicianName}
                      onChange={(e) => {
                        const selectedName = e.target.value;
                        setTechnicianName(selectedName);
                        const matched = techOptions.find((t) => t.name === selectedName);
                        if (matched) {
                          setTechnicianId(matched.id);
                        } else {
                          setTechnicianId('');
                        }
                      }}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:border-cyan-400 focus:outline-none"
                    >
                      <option value="">Selecione um funcionário de campo / técnico...</option>
                      {techOptions.map((tech) => (
                        <option key={tech.id} value={tech.name}>
                          {tech.name} ({tech.role})
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setShowAddStaffModal('tecnico')}
                      className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-semibold"
                    >
                      <Plus className="w-3 h-3" /> + Cadastrar novo funcionário de campo
                    </button>
                  </div>
                </div>

                {/* Atendente Responsável */}
                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                  <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Atendente que Agendou *</span>
                  </label>

                  <div className="space-y-1.5">
                    <select
                      value={attendantName}
                      onChange={(e) => setAttendantName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:border-emerald-400 focus:outline-none"
                    >
                      <option value="">Selecione um gerente / atendente...</option>
                      {attOptions.map((att) => (
                        <option key={att.id} value={att.name}>
                          {att.name} ({att.role})
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setShowAddStaffModal('atendente')}
                      className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-semibold"
                    >
                      <Plus className="w-3 h-3" /> + Cadastrar novo gerente / atendente
                    </button>
                  </div>
                </div>

                {/* Motorista / Deslocamento (Opcional) */}
                <div className="sm:col-span-2 p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                  <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-amber-400" />
                    <span>Motorista / Deslocamento (Opcional)</span>
                  </label>

                  <div className="flex items-center gap-2">
                    <select
                      value={driverName}
                      onChange={(e) => setDriverName(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:border-amber-400 focus:outline-none"
                    >
                      <option value="">Nenhum motorista selecionado (opcional)</option>
                      {driverOptions.map((drv) => (
                        <option key={drv.id} value={drv.name}>
                          {drv.name} ({drv.role})
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setShowAddStaffModal('motorista')}
                      className="px-2.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-[11px] text-amber-300 flex items-center gap-1 font-semibold whitespace-nowrap"
                    >
                      <Plus className="w-3 h-3" /> Cadastrar motorista
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 4: MOTIVO DO AGENDAMENTO */}
          <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cyan-400">
              <FileText className="w-4 h-4" />
              <span>4. Defeito Reclamado & Motivo do Agendamento</span>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Defeito / Sintoma Informado pelo Cliente *
              </label>
              <textarea
                required
                rows={2}
                placeholder="Ex: Geladeira parou de gelar a parte de baixo, faz barulho no motor. Cliente solicita visita urgente no período da manhã."
                value={defectDescription}
                onChange={(e) => setDefectDescription(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 text-sm focus:border-cyan-400 focus:outline-none resize-none"
              />
            </div>
          </div>

          {/* Submit Actions */}
          <div className="pt-2 flex items-center justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 sm:flex-none px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white font-bold text-sm shadow-[0_0_25px_rgba(168,85,247,0.4)] active:scale-98 transition-all flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-5 h-5 text-purple-200" />
              <span>Confirmar Agendamento</span>
            </button>
          </div>
        </form>

        {/* Modal: Inline Register Staff */}
        {showAddStaffModal && (
          <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-sm bg-slate-900 border border-purple-500/40 rounded-2xl p-5 shadow-2xl">
              <h4 className="font-bold text-white text-sm mb-3 flex items-center gap-2">
                <Plus className="w-4 h-4 text-purple-400" />
                Cadastrar Novo{' '}
                {showAddStaffModal === 'gerente'
                  ? 'Gerente'
                  : showAddStaffModal === 'ormamentistas'
                  ? 'Ormamentista'
                  : 'Funcionário de Campo'}
              </h4>

              <div className="space-y-3">
                <div>
                  <label className="text-xs text-slate-300 block mb-1">Nome Completo</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Roberto Silva"
                    value={newStaffName}
                    onChange={(e) => setNewStaffName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:border-purple-400 focus:outline-none"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-300 block mb-1">Telefone (Opcional)</label>
                  <input
                    type="text"
                    placeholder="(11) 98888-7777"
                    value={newStaffPhone}
                    onChange={(e) => setNewStaffPhone(formatPhone(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:border-purple-400 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddStaffModal(null)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-400 text-xs hover:text-white"
                >
                  Voltar
                </button>
                <button
                  type="button"
                  onClick={handleCreateStaff}
                  className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold"
                >
                  Adicionar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
