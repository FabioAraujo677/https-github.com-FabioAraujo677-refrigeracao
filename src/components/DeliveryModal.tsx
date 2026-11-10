import React, { useState, useEffect } from 'react';
import {
  X,
  Calendar,
  Clock,
  User,
  MapPin,
  Truck,
  Plus,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FileText,
  Smartphone,
} from 'lucide-react';
import { StaffMember, DeliveryType, StaffRole } from '../types';
import { fetchAddressByCep } from '../utils/viacep';
import { formatCep, formatPhone, cleanNumeric, formatDateWithWeekday } from '../utils/formatters';
import { sbSaveStaff } from '../utils/supabaseService';

interface DeliveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (deliveryData: any) => void;
  staffList: StaffMember[];
  onStaffAdded: (newMember: StaffMember) => void;
  deliveryToEdit?: any;
}

export const DeliveryModal: React.FC<DeliveryModalProps> = ({
  isOpen,
  onClose,
  onSave,
  staffList,
  onStaffAdded,
  deliveryToEdit,
}) => {
  // Form State
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [cep, setCep] = useState('');
  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [complement, setComplement] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [description, setDescription] = useState('');
  const [deliveryType, setDeliveryType] = useState<DeliveryType>('Entrega');
  const [driverName, setDriverName] = useState('');
  const [attendantName, setAttendantName] = useState('');
  
  const getTodayString = () => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  };

  const [scheduledDate, setScheduledDate] = useState<string>(getTodayString());
  const [scheduledTime, setScheduledTime] = useState<string>('08:00');
  
  const [isLoadingCep, setIsLoadingCep] = useState(false);
  const [cepSuccess, setCepSuccess] = useState(false);
  const [cepError, setCepError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Staff registration states
  const [showAddStaffModal, setShowAddStaffModal] = useState<StaffRole | null>(null);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffPhone, setNewStaffPhone] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    
    if (deliveryToEdit) {
      setCustomerName(deliveryToEdit.customerName || '');
      setCustomerPhone(deliveryToEdit.customerPhone || '');
      setCep(deliveryToEdit.cep || '');
      setStreet(deliveryToEdit.street || '');
      setNumber(deliveryToEdit.number || '');
      setComplement(deliveryToEdit.complement || '');
      setNeighborhood(deliveryToEdit.neighborhood || '');
      setCity(deliveryToEdit.city || '');
      setState(deliveryToEdit.state || '');
      setDescription(deliveryToEdit.description || '');
      setDeliveryType(deliveryToEdit.type || 'Entrega');
      setDriverName(deliveryToEdit.driverName || '');
      setAttendantName(deliveryToEdit.attendantName || '');
      setScheduledDate(deliveryToEdit.scheduledDate || getTodayString());
      setScheduledTime(deliveryToEdit.scheduledTime || '08:00');
    } else {
      // Reset form
      setCustomerName('');
      setCustomerPhone('');
      setCep('');
      setStreet('');
      setNumber('');
      setComplement('');
      setNeighborhood('');
      setCity('');
      setState('');
      setDescription('');
      setDeliveryType('Entrega');
      setScheduledDate(getTodayString());
      setScheduledTime('08:00');

      // Set defaults if available
      const defaultAtt = staffList.find(s => s.role === 'gerente' && s.active);
      if (defaultAtt) setAttendantName(defaultAtt.name);
      
      const defaultDrv = staffList.find(s => s.role === 'ormamentistas' && s.active);
      if (defaultDrv) setDriverName(defaultDrv.name);
    }
  }, [isOpen, staffList, deliveryToEdit]);

  if (!isOpen) return null;

  const handleCepChange = async (value: string) => {
    const formatted = formatCep(value);
    setCep(formatted);
    setCepError(null);

    const numeric = cleanNumeric(formatted);
    if (numeric.length === 8) {
      setIsLoadingCep(true);
      try {
        const result = await fetchAddressByCep(numeric);
        if (result) {
          setStreet(result.logradouro || '');
          setNeighborhood(result.bairro || '');
          setCity(result.localidade || '');
          setState(result.uf || '');
          setCepSuccess(true);
        } else {
          setCepError('CEP não localizado.');
        }
      } catch {
        setCepError('Erro ao consultar CEP.');
      } finally {
        setIsLoadingCep(false);
      }
    } else {
      setCepSuccess(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!customerName.trim() || !customerPhone.trim() || !street.trim() || !scheduledDate || !scheduledTime) {
      setFormError('Por favor, preencha todos os campos obrigatórios (*).');
      return;
    }

    const deliveryData = {
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      cep: cep.trim(),
      street: street.trim(),
      number: number.trim() || 'S/N',
      complement: complement.trim(),
      neighborhood: neighborhood.trim(),
      city: city.trim(),
      state: state.trim() || 'SP',
      description: description.trim(),
      type: deliveryType,
      driverName: driverName || 'Motorista não definido',
      attendantName: attendantName || 'Atendimento Central',
      scheduledDate,
      scheduledTime,
    };

    onSave(deliveryData);
  };

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffName.trim() || !showAddStaffModal) return;

    const newMember: StaffMember = {
      id: `stf_${Date.now()}`,
      name: newStaffName,
      role: showAddStaffModal as StaffRole,
      phone: newStaffPhone,
      active: true,
      companyId: ''
    };

    const success = await sbSaveStaff(newMember);
    if (success) {
      onStaffAdded(newMember);
      if (showAddStaffModal === 'gerente') {
        setAttendantName(newMember.name);
      } else {
        setDriverName(newMember.name);
      }
      setNewStaffName('');
      setNewStaffPhone('');
      setShowAddStaffModal(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-amber-500/30 rounded-3xl shadow-[0_0_50px_rgba(245,158,11,0.2)] overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-slate-950/90 border-b border-amber-500/20 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center text-white shadow-[0_0_20px_rgba(245,158,11,0.4)]">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-wide">
                {deliveryToEdit ? 'Editar Entrega / Retirada' : 'Agendamento de Entrega / Retirada'}
              </h2>
              <p className="text-xs text-slate-400">
                Cadastre uma nova tarefa logística para o motorista
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto p-4 sm:p-6 space-y-5 flex-1">
          {formError && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* SECTION: TIPO E HORÁRIO */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-slate-950/50 border border-slate-800 space-y-3">
              <label className="block text-xs font-bold uppercase tracking-wider text-amber-400">Tipo de Tarefa *</label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDeliveryType('Entrega')}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${
                    deliveryType === 'Entrega'
                      ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-md'
                      : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-white'
                  }`}
                >
                  🚚 Entrega
                </button>
                <button
                  type="button"
                  onClick={() => setDeliveryType('Retirada')}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${
                    deliveryType === 'Retirada'
                      ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-md'
                      : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-white'
                  }`}
                >
                  📦 Retirada
                </button>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/50 border border-slate-800 space-y-3">
              <label className="block text-xs font-bold uppercase tracking-wider text-amber-400">Data e Hora *</label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  required
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  className="w-full px-2 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:border-amber-400 outline-none"
                />
                <input
                  type="time"
                  required
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  className="w-full px-2 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:border-amber-400 outline-none"
                />
              </div>
            </div>
          </div>

          {/* SECTION: CLIENTE E ENDEREÇO */}
          <div className="p-4 rounded-2xl bg-slate-950/50 border border-slate-800 space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cyan-400">
              <User className="w-4 h-4" />
              <span>Dados do Cliente & Endereço</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Nome do Cliente *</label>
                <input
                  type="text"
                  required
                  placeholder="Nome completo"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm focus:border-cyan-400 outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">WhatsApp / Telefone *</label>
                <input
                  type="text"
                  required
                  placeholder="(11) 99999-9999"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(formatPhone(e.target.value))}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm font-mono focus:border-cyan-400 outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">CEP *</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="00000-000"
                    value={cep}
                    onChange={(e) => handleCepChange(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm font-mono focus:border-cyan-400 outline-none"
                  />
                  {isLoadingCep && <Loader2 className="w-4 h-4 absolute right-3 top-3 animate-spin text-cyan-400" />}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Rua / Logradouro *</label>
                <input
                  type="text"
                  required
                  placeholder="Preenchido pelo CEP"
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm focus:border-cyan-400 outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Número *</label>
                <input
                  type="text"
                  required
                  placeholder="Nº"
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm focus:border-cyan-400 outline-none"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Bairro</label>
                <input
                  type="text"
                  value={neighborhood}
                  onChange={(e) => setNeighborhood(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:border-cyan-400 outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Cidade / UF</label>
                <input
                  type="text"
                  value={city ? `${city} - ${state}` : ''}
                  readOnly
                  className="w-full px-3 py-2 rounded-xl bg-slate-900/50 border border-slate-800 text-slate-400 text-xs outline-none"
                />
              </div>
            </div>
          </div>

          {/* SECTION: RESPONSÁVEIS */}
          <div className="p-4 rounded-2xl bg-slate-950/50 border border-slate-800 space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400">
              <Truck className="w-4 h-4" />
              <span>Equipe Responsável</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Motorista / Condutor *</label>
                <select
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm focus:border-amber-400 outline-none"
                >
                  <option value="">Selecione o motorista</option>
                  {(staffList.filter(s => s.active && (s.role === 'motorista' || (s.role as any) === 'ormamentistas')).length > 0
                    ? staffList.filter(s => s.active && (s.role === 'motorista' || (s.role as any) === 'ormamentistas'))
                    : staffList.filter(s => s.active)
                  ).map(s => (
                    <option key={s.id} value={s.name}>{s.name} ({s.role})</option>
                  ))}
                </select>
                <button type="button" onClick={() => setShowAddStaffModal('motorista')} className="text-[10px] text-amber-400 mt-1 font-bold">+ Cadastrar novo motorista</button>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Atendente / Gerente *</label>
                <select
                  value={attendantName}
                  onChange={(e) => setAttendantName(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm focus:border-emerald-400 outline-none"
                >
                  <option value="">Selecione o atendente</option>
                  {(staffList.filter(s => s.active && (s.role === 'atendente' || (s.role as any) === 'gerente' || s.role === 'admin')).length > 0
                    ? staffList.filter(s => s.active && (s.role === 'atendente' || (s.role as any) === 'gerente' || s.role === 'admin'))
                    : staffList.filter(s => s.active)
                  ).map(s => (
                    <option key={s.id} value={s.name}>{s.name} ({s.role})</option>
                  ))}
                </select>
                <button type="button" onClick={() => setShowAddStaffModal('atendente')} className="text-[10px] text-emerald-400 mt-1 font-bold">+ Cadastrar novo atendente</button>
              </div>
            </div>
          </div>

          {/* SECTION: DESCRIÇÃO */}
          <div className="p-4 rounded-2xl bg-slate-950/50 border border-slate-800 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-purple-400">
              <FileText className="w-4 h-4" />
              <span>Descrição da Tarefa</span>
            </div>
            <textarea
              rows={3}
              placeholder="Ex: Entregar geladeira Brastemp reparada. Cobrar saldo de R$ 300,00 no Pix."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 text-sm focus:border-purple-400 outline-none resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-bold transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 sm:flex-none px-10 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-black text-sm uppercase tracking-wider shadow-lg shadow-amber-900/40 active:scale-95 transition-all"
            >
              {deliveryToEdit ? 'Salvar Alterações' : 'Confirmar Agendamento'}
            </button>
          </div>
        </form>

        {/* Modal: Inline Register Staff */}
        {showAddStaffModal && (
          <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-sm bg-slate-900 border border-amber-500/40 rounded-3xl p-6 shadow-2xl space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-400">
                  <User className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-white text-sm uppercase">Cadastrar {showAddStaffModal === 'gerente' ? 'Gerente' : 'Ormamentistas'}</h3>
              </div>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Nome Completo</label>
                  <input
                    type="text"
                    autoFocus
                    value={newStaffName}
                    onChange={(e) => setNewStaffName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:border-amber-400 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Telefone (Opcional)</label>
                  <input
                    type="text"
                    value={newStaffPhone}
                    onChange={(e) => setNewStaffPhone(formatPhone(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-mono focus:border-amber-400 outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddStaffModal(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-white transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleCreateStaff}
                  disabled={!newStaffName.trim()}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs shadow-md transition-all"
                >
                  Salvar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
