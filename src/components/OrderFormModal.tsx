import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Search,
  CheckCircle2,
  AlertCircle,
  Plus,
  Wrench,
  User,
  MapPin,
  Calendar,
  CreditCard,
  FileText,
  Sparkles,
  ShieldAlert,
  Loader2,
  Truck,
  Users,
} from 'lucide-react';
import { ApplianceType, AttendanceStatus, PaymentMethod, StaffMember, StaffRole, WarrantyOrder } from '../types';
import { fetchAddressByCep } from '../utils/viacep';
import { cleanNumeric, formatCep, formatCurrency, formatPhone, formatCpf, formatDate, calculateWarrantyEndDate } from '../utils/formatters';
import { SignaturePad } from './SignaturePad';
import { sbSaveStaff } from '../utils/supabaseService';
import { addStaffMember } from '../utils/storage';
import { supabase } from '../lib/supabaseClient';

interface OrderFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (orderData: any, editId?: string) => void;
  staffList: StaffMember[];
  onStaffAdded: (newMember: StaffMember) => void;
  orderToEdit?: WarrantyOrder | null;
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

const PAYMENT_OPTIONS: PaymentMethod[] = [
  'Pix',
  'Cartão de Crédito',
  'Cartão de Débito',
  'Dinheiro',
  'Boleto Bancário',
  'Transferência / TED',
];

const POPULAR_BRANDS = ['Brastemp', 'Electrolux', 'Samsung', 'LG', 'Consul', 'Panasonic', 'Midea', 'Outra'];

export const OrderFormModal: React.FC<OrderFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  staffList,
  onStaffAdded,
  orderToEdit,
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

  // Staff (Dropdown selection only - no manual mode)
  const [profilesList, setProfilesList] = useState<StaffMember[]>([]);
  const [technicianName, setTechnicianName] = useState('');
  const [technicianId, setTechnicianId] = useState('');
  const [attendantName, setAttendantName] = useState('');
  const [driverName, setDriverName] = useState('');

  // Modals for adding new staff inline
  const [showAddStaffModal, setShowAddStaffModal] = useState<StaffRole | null>(null);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffPhone, setNewStaffPhone] = useState('');

  // Repair details
  const [defectDescription, setDefectDescription] = useState('');
  const [serviceDescription, setServiceDescription] = useState('');
  const [partsReplaced, setPartsReplaced] = useState('');

  // Financials & Warranty
  const [totalValue, setTotalValue] = useState<string>('350.00');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Pix');
  const [paymentStatus, setPaymentStatus] = useState<'Pago' | 'Pendente' | 'Parcial'>('Pago');
  const [warrantyMonths, setWarrantyMonths] = useState<number>(3);
  const [warrantyStartDate, setWarrantyStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [installments, setInstallments] = useState<number>(1);
  const [attendanceStatus, setAttendanceStatus] = useState<AttendanceStatus>('Concluído');

  // Signature
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
        console.warn('Error fetching profiles in OrderFormModal:', err);
      }
    }

    fetchProfiles();
  }, [isOpen]);

  // Combine staff from props and Supabase profiles
  const allStaff = useMemo(() => {
    const map = new Map<string, StaffMember>();
    staffList.forEach((s) => { if (s && s.id) map.set(s.id, s); });
    profilesList.forEach((s) => { if (s && s.id && !map.has(s.id)) map.set(s.id, s); });
    return Array.from(map.values());
  }, [staffList, profilesList]);

  // Filter technicians by role ('tecnico' or 'funcionario de campo') or name/email matching 'wilian'
  const techOptions = useMemo(() => {
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

  const attOptions = useMemo(() => {
    return allStaff.filter(
      (s) => s.active && (s.role === 'atendente' || (s.role as any) === 'gerente' || s.role === 'admin')
    );
  }, [allStaff]);

  const driverOptions = useMemo(() => {
    return allStaff.filter(
      (s) => s.active && (s.role === 'motorista' || (s.role as any) === 'ormamentistas')
    );
  }, [allStaff]);

  // Prepopulate form when editing or set defaults when creating
  useEffect(() => {
    if (orderToEdit) {
      setCustomerName(orderToEdit.customerName || '');
      setCustomerPhone(orderToEdit.customerPhone || '');
      setCustomerCpf(orderToEdit.customerCpf || '');
      setCep(orderToEdit.cep || '');
      setStreet(orderToEdit.street || '');
      setNumber(orderToEdit.number || '');
      setComplement(orderToEdit.complement || '');
      setNeighborhood(orderToEdit.neighborhood || '');
      setCity(orderToEdit.city || '');
      setState(orderToEdit.state || '');
      setApplianceType(orderToEdit.applianceType || 'Geladeira / Refrigerador');
      setApplianceBrand(orderToEdit.applianceBrand || 'Brastemp');
      setApplianceModel(orderToEdit.applianceModel || '');
      
      setAttendantName(orderToEdit.attendantName || '');
      setTechnicianName(orderToEdit.technicianName || (orderToEdit as any).technician_name || (orderToEdit as any).technician || '');
      setTechnicianId(orderToEdit.technicianId || orderToEdit.technician_id || '');
      setDriverName(orderToEdit.driverName || '');

      setDefectDescription(orderToEdit.defectDescription || '');
      setServiceDescription(orderToEdit.serviceDescription || '');
      setPartsReplaced(orderToEdit.partsReplaced || '');
      setTotalValue(orderToEdit.totalValue !== undefined ? orderToEdit.totalValue.toString() : '350.00');
      setPaymentMethod(orderToEdit.paymentMethod || 'Pix');
      setPaymentStatus(orderToEdit.paymentStatus || 'Pago');
      setWarrantyMonths(orderToEdit.warrantyMonths || 3);
      setWarrantyStartDate(orderToEdit.warrantyStartDate ? orderToEdit.warrantyStartDate.split('T')[0] : (orderToEdit.createdAt ? orderToEdit.createdAt.split('T')[0] : new Date().toISOString().split('T')[0]));
      setInstallments(orderToEdit.installments || 1);
      setAttendanceStatus(orderToEdit.attendanceStatus || 'Concluído');
      setClientSignature(orderToEdit.clientSignature || '');
      setNotes(orderToEdit.notes || '');
      setCepSuccess(Boolean(orderToEdit.street));
      setCepError(null);
    } else {
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
      setApplianceType('Geladeira / Refrigerador');
      setApplianceBrand('Brastemp');
      setApplianceModel('');
      setDefectDescription('');
      setServiceDescription('');
      setPartsReplaced('');
      setTotalValue('350.00');
      setPaymentMethod('Pix');
      setPaymentStatus('Pago');
      setWarrantyMonths(3);
      setWarrantyStartDate(new Date().toISOString().split('T')[0]);
      setInstallments(1);
      setAttendanceStatus('Concluído');
      setClientSignature('');
      setNotes('');
      setCepSuccess(false);
      setCepError(null);

      // Set default staff selections if available
      const defaultAtt = attOptions[0];
      setAttendantName(defaultAtt ? defaultAtt.name : '');

      const defaultTech = techOptions[0];
      if (defaultTech) {
        setTechnicianName(defaultTech.name);
        setTechnicianId(defaultTech.id);
      } else {
        setTechnicianName('');
        setTechnicianId('');
      }

      setDriverName('');
    }
  }, [orderToEdit, isOpen, allStaff, techOptions, attOptions]);

  if (!isOpen) return null;

  // Handle Automatic CEP Lookup
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
          // auto focus to number field
          setTimeout(() => {
            const numInput = document.getElementById('input-numero');
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
      setFormError('Por favor informe o telefone do cliente.');
      return;
    }
    if (!street.trim()) {
      setFormError('Por favor informe o endereço (digite o CEP para busca automática).');
      return;
    }
    if (!serviceDescription.trim()) {
      setFormError('Descreva o conserto ou serviço executado.');
      return;
    }

    const numericValue = parseFloat(totalValue.replace(',', '.')) || 0;

    const selectedTechName = technicianName || 'Técnico Especialista';

    const newOrderData = {
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
      attendantName: attendantName || 'Atendente da Loja',
      technicianName: selectedTechName,
      technician_name: selectedTechName,
      technician: selectedTechName,
      technicianId: technicianId || undefined,
      technician_id: technicianId || undefined,
      driverName: driverName.trim() || undefined,
      defectDescription: defectDescription.trim() || 'Aparelho não funcionava corretamente',
      serviceDescription: serviceDescription.trim(),
      partsReplaced: partsReplaced.trim() || 'Nenhuma (Apenas regulagem)',
      totalValue: numericValue,
      paymentMethod,
      paymentStatus,
      warrantyMonths,
      warrantyStartDate: new Date(warrantyStartDate).toISOString(),
      installments: paymentMethod === 'Cartão de Crédito' ? installments : undefined,
      attendanceStatus,
      clientSignature: clientSignature || undefined,
      notes: notes.trim() || undefined,
    };

    onSave(newOrderData, orderToEdit?.id);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-cyan-500/30 rounded-3xl shadow-[0_0_50px_rgba(6,182,212,0.15)] overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-slate-950/90 border-b border-cyan-500/20 shrink-0">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.3)]">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-wide flex items-center gap-2">
                {orderToEdit ? 'Editar Ordem & Garantia' : 'Nova Ordem & Garantia'}
                <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                  {orderToEdit ? orderToEdit.id : 'Eletrodomésticos'}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                {orderToEdit ? 'Atualize as informações e condições desta garantia' : 'Cadastro rápido focado em agilidade no celular'}
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

          {/* SECTION 1: DADOS DO CLIENTE & CEP AUTOMÁTICO */}
          <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cyan-400">
              <User className="w-4 h-4" />
              <span>1. Cliente & Localização (Endereço Automático)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Nome do Cliente *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Maria Aparecida da Silva"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 text-sm focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400/50 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Telefone / WhatsApp *
                </label>
                <input
                  type="text"
                  required
                  placeholder="(11) 99999-9999"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(formatPhone(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 text-sm focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400/50 transition-all font-mono"
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
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 text-sm focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400/50 transition-all font-mono"
                />
              </div>
            </div>

            {/* CEP Box - Automatic street completion */}
            <div className="pt-2 border-t border-slate-800/80">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-cyan-300 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>CEP (Digite para preencher a rua automaticamente) *</span>
                </label>
                {isLoadingCep && (
                  <span className="text-[10px] text-cyan-400 flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> Buscando no ViaCEP...
                  </span>
                )}
                {cepSuccess && (
                  <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-semibold">
                    <CheckCircle2 className="w-3 h-3" /> Endereço preenchido!
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
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-cyan-500/40 text-cyan-200 placeholder-slate-500 text-sm font-mono focus:border-cyan-300 focus:outline-none shadow-[0_0_10px_rgba(6,182,212,0.1)] font-bold text-center"
                  />
                </div>
                <div className="col-span-2">
                  <input
                    type="text"
                    placeholder="Rua / Avenida (Automático)"
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
                    id="input-numero"
                    type="text"
                    placeholder="Ex: 450"
                    value={number}
                    onChange={(e) => setNumber(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:border-cyan-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-0.5">Complemento</label>
                  <input
                    type="text"
                    placeholder="Apto / Bloco"
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

          {/* SECTION 2: ELETRODOMÉSTICO & ATENDIMENTO */}
          <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cyan-400">
              <Wrench className="w-4 h-4" />
              <span>2. Equipamento & Equipe Técnica</span>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Aparelho Consertado *
              </label>
              <select
                value={applianceType}
                onChange={(e) => setApplianceType(e.target.value as ApplianceType)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm focus:border-cyan-400 focus:outline-none cursor-pointer"
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
                <div className="flex gap-2">
                  <select
                    value={applianceBrand}
                    onChange={(e) => setApplianceBrand(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm focus:border-cyan-400 focus:outline-none"
                  >
                    {POPULAR_BRANDS.map((brand) => (
                      <option key={brand} value={brand}>
                        {brand}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Modelo / Capacidade (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ex: Frost Free 420L ou 11kg"
                  value={applianceModel}
                  onChange={(e) => setApplianceModel(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 text-sm focus:border-cyan-400 focus:outline-none"
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
                    className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-semibold hover:underline"
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
                    <span>Funcionário de Campo *</span>
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
                    <span>Atendente / Gerente *</span>
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

            {/* Status do Atendimento / Fluxo */}
            <div className="pt-2 border-t border-slate-800/80">
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Status do Atendimento / Ordem
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'Na fila / Aguardando', label: 'Na fila / Aguardando', activeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-md ring-1 ring-amber-400/40' },
                  { id: 'Em campo', label: 'Em campo', activeClass: 'bg-purple-500/20 text-purple-300 border-purple-500/50 shadow-md ring-1 ring-purple-400/40' },
                  { id: 'Concluído', label: 'Concluído', activeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-md ring-1 ring-emerald-400/40' },
                ].map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setAttendanceStatus(st.id as AttendanceStatus)}
                    className={`py-2 px-1 rounded-xl text-xs font-bold border transition-all text-center ${
                      attendanceStatus === st.id
                        ? st.activeClass
                        : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* SECTION 3: DESCRIÇÃO DO SERVIÇO & PEÇA TROCADA */}
          <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cyan-400">
              <FileText className="w-4 h-4" />
              <span>3. Descrição do Defeito & Peça Trocada</span>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Defeito Reclamado pelo Cliente
              </label>
              <input
                type="text"
                placeholder="Ex: Geladeira não gela parte de baixo / Máquina vazando água"
                value={defectDescription}
                onChange={(e) => setDefectDescription(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 text-sm focus:border-cyan-400 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Descrição do Conserto Realizado *
              </label>
              <textarea
                required
                rows={2}
                placeholder="Ex: Desobstrução do duto de ar, substituição do kit sensor degelo e carga de gás R600a com troca de filtro."
                value={serviceDescription}
                onChange={(e) => setServiceDescription(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 text-sm focus:border-cyan-400 focus:outline-none resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Peça(s) Trocada(s) ou Componente Reposto *
              </label>
              <input
                type="text"
                placeholder="Ex: Sensor de Degelo 10k + Termofusível + Eletrobomba Original"
                value={partsReplaced}
                onChange={(e) => setPartsReplaced(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 text-sm focus:border-cyan-400 focus:outline-none"
              />
            </div>
          </div>

          {/* SECTION 4: VALOR, PAGAMENTO & MESES DE GARANTIA */}
          <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cyan-400">
              <CreditCard className="w-4 h-4" />
              <span>4. Valor, Forma de Pagamento & Prazo de Garantia</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Valor Total (R$) *
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-xs font-bold text-slate-400">
                    R$
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={totalValue}
                    onChange={(e) => setTotalValue(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-900 border border-cyan-500/40 text-cyan-200 text-sm font-bold font-mono focus:border-cyan-300 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Forma de Pagamento *
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm focus:border-cyan-400 focus:outline-none"
                >
                  {PAYMENT_OPTIONS.map((pm) => (
                    <option key={pm} value={pm}>
                      {pm}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Status do Pagamento
                </label>
                <select
                  value={paymentStatus}
                  onChange={(e) => setPaymentStatus(e.target.value as any)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm focus:border-cyan-400 focus:outline-none"
                >
                  <option value="Pago">Pago</option>
                  <option value="Pendente">Pendente</option>
                  <option value="Parcial">Parcial (Entrada)</option>
                </select>
              </div>
            </div>

            {paymentMethod === 'Cartão de Crédito' && (
              <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 animate-fadeIn">
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Parcelamento</label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="1"
                    max="12"
                    step="1"
                    value={installments}
                    onChange={(e) => setInstallments(parseInt(e.target.value))}
                    className="flex-1 accent-cyan-500"
                  />
                  <span className="w-12 text-center py-1 rounded-lg bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 text-xs font-bold">
                    {installments}x
                  </span>
                </div>
              </div>
            )}

            {/* Início e Tempo de Garantia */}
            <div className="p-4 bg-slate-900/90 rounded-2xl border border-cyan-500/30 space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cyan-300">
                <ShieldAlert className="w-4 h-4 text-cyan-400" />
                <span>Prazo de Garantia Personalizado</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Data de Início da Garantia *
                  </label>
                  <input
                    type="date"
                    required
                    value={warrantyStartDate}
                    onChange={(e) => setWarrantyStartDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:border-cyan-400 focus:outline-none font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Quantidade de Meses *
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min={1}
                      max={60}
                      required
                      value={warrantyMonths}
                      onChange={(e) => setWarrantyMonths(parseInt(e.target.value) || 0)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:border-cyan-400 focus:outline-none font-bold pr-16"
                    />
                    <span className="absolute right-3.5 top-2.5 text-xs font-bold text-slate-500">
                      Meses
                    </span>
                  </div>
                </div>
              </div>

              {/* Resultado do Cálculo */}
              <div className="mt-2 p-3 rounded-xl bg-cyan-500/5 border border-cyan-500/20 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-cyan-400" />
                  <span className="text-[11px] text-slate-400 font-medium">Cobertura válida de:</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-bold text-white">{formatDate(warrantyStartDate)}</span>
                  <span className="text-cyan-500 font-black">→</span>
                  <span className="font-bold text-cyan-400">
                    {formatDate(calculateWarrantyEndDate(warrantyStartDate, warrantyMonths))}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 5: ASSINATURA DIGITAL NO CELULAR */}
          <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4 space-y-3">
            <SignaturePad
              initialSignature={clientSignature}
              onSave={(dataUrl) => setClientSignature(dataUrl)}
              onClear={() => setClientSignature('')}
              title="Assinatura Digital do Cliente no Celular"
            />
          </div>

          {/* Submit Action */}
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
              className="flex-1 sm:flex-none px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold text-sm shadow-[0_0_25px_rgba(6,182,212,0.4)] active:scale-98 transition-all flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-5 h-5" />
              {orderToEdit ? 'Salvar Alterações' : 'Salvar & Gerar Recibo / Garantia'}
            </button>
          </div>
        </form>

        {/* Modal: Inline Register Staff */}
        {showAddStaffModal && (
          <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-sm bg-slate-900 border border-cyan-500/40 rounded-2xl p-5 shadow-2xl">
              <h4 className="font-bold text-white text-sm mb-3 flex items-center gap-2">
                <Plus className="w-4 h-4 text-cyan-400" />
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
                    placeholder="Ex: Gilberto Refrigeração"
                    value={newStaffName}
                    onChange={(e) => setNewStaffName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:border-cyan-400 focus:outline-none"
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
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:border-cyan-400 focus:outline-none font-mono"
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
                  className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold"
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
