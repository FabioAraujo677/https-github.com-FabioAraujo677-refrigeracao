import React, { useState } from 'react';
import {
  X,
  Building2,
  Image as ImageIcon,
  Clock,
  Phone,
  MapPin,
  Save,
  CheckCircle2,
  FileText,
  Upload,
  ShieldCheck,
  Download,
  UploadCloud,
} from 'lucide-react';
import { CompanySettings } from '../types';
import { fetchAddressByCep } from '../utils/viacep';
import { formatCep, cleanNumeric } from '../utils/formatters';
import {
  getOrders,
  getStaff,
  getUsers,
  getExpenses,
  getDeliveries,
  getCustomers,
  getCompanySettings,
  saveOrders,
  saveStaff,
  saveUsers,
  saveExpenses,
  saveDeliveries,
  saveCustomers,
  saveCompanySettings,
  syncAllStaffToUsers,
} from '../utils/storage';

interface CompanySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: CompanySettings;
  onSave: (newSettings: CompanySettings) => void;
}

export const CompanySettingsModal: React.FC<CompanySettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSave,
}) => {
  const [formData, setFormData] = useState<CompanySettings>(settings);
  const [isSaved, setIsSaved] = useState(false);
  const [isLoadingCep, setIsLoadingCep] = useState(false);

  if (!isOpen) return null;

  const handleCepChange = async (val: string) => {
    const formatted = formatCep(val);
    setFormData((prev) => ({ ...prev, cep: formatted }));
    const digits = cleanNumeric(formatted);
    if (digits.length === 8) {
      setIsLoadingCep(true);
      const res = await fetchAddressByCep(digits);
      if (res) {
        setFormData((prev) => ({
          ...prev,
          street: res.logradouro || prev.street,
          neighborhood: res.bairro || prev.neighborhood,
          city: res.localidade || prev.city,
          state: res.uf || prev.state,
        }));
      }
      setIsLoadingCep(false);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData((prev) => ({ ...prev, logoUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleExportData = () => {
    const backup = {
      orders: getOrders(),
      staff: getStaff(),
      users: getUsers(),
      expenses: getExpenses(),
      deliveries: getDeliveries(),
      customers: getCustomers(),
      company: getCompanySettings(),
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `garantiapro_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target?.result as string);
          if (data && typeof data === 'object') {
            if (Array.isArray(data.orders)) saveOrders(data.orders);
            if (Array.isArray(data.staff)) saveStaff(data.staff);
            if (Array.isArray(data.users)) saveUsers(data.users);
            if (Array.isArray(data.expenses)) saveExpenses(data.expenses);
            if (Array.isArray(data.deliveries)) saveDeliveries(data.deliveries);
            if (Array.isArray(data.customers)) saveCustomers(data.customers);
            if (data.company) saveCompanySettings(data.company);
            syncAllStaffToUsers();
            alert('Dados importados com sucesso! O sistema será atualizado.');
            window.location.reload();
          }
        } catch (err) {
          alert('Erro ao ler arquivo de backup JSON.');
        }
      };
      reader.readAsText(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    setIsSaved(true);
    setTimeout(() => {
      setIsSaved(false);
      onClose();
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-xl bg-slate-900 border border-cyan-500/30 rounded-3xl shadow-[0_0_50px_rgba(6,182,212,0.2)] overflow-hidden my-auto max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-950/80 border-b border-cyan-500/20 shrink-0">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">Dados da Empresa & Cabeçalho</h3>
              <p className="text-[11px] text-cyan-400">Personalize o logotipo, endereço e horários do recibo</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-5 space-y-4 flex-1">
          {/* Logo Upload Section */}
          <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-center gap-4">
            <div className="h-16 w-16 rounded-2xl bg-slate-900 border border-cyan-500/30 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
              {formData.logoUrl ? (
                <img src={formData.logoUrl} alt="Logo" className="h-full w-full object-contain p-1" />
              ) : (
                <ImageIcon className="w-8 h-8 text-cyan-400/50" />
              )}
            </div>
            <div className="flex-1">
              <span className="block text-xs font-bold text-slate-200 mb-1">
                Logo da Empresa (Aparece no topo do Recibo e PDF)
              </span>
              <div className="flex items-center gap-2">
                <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-600/20 border border-cyan-500/40 text-cyan-300 text-xs font-semibold hover:bg-cyan-600/30 transition-colors">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Escolher Imagem</span>
                  <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                </label>
                {formData.logoUrl && (
                  <button
                    type="button"
                    onClick={() => setFormData((p) => ({ ...p, logoUrl: '' }))}
                    className="text-xs text-rose-400 hover:underline"
                  >
                    Remover
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Nome & Slogan */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Nome Fantasia / Razão Social *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:border-cyan-400 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">CNPJ *</label>
              <input
                type="text"
                required
                value={formData.cnpj}
                onChange={(e) => setFormData((p) => ({ ...p, cnpj: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:border-cyan-400 focus:outline-none font-mono"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Slogan / Especialidade
              </label>
              <input
                type="text"
                value={formData.slogan}
                onChange={(e) => setFormData((p) => ({ ...p, slogan: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:border-cyan-400 focus:outline-none"
              />
            </div>
          </div>

          {/* Endereço & Horário de Funcionamento */}
          <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-3">
            <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" />
              Localização & Horários de Atendimento
            </span>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[11px] text-slate-400 mb-0.5">
                  CEP {isLoadingCep && '(Buscando...)'}
                </label>
                <input
                  type="text"
                  value={formData.cep}
                  onChange={(e) => handleCepChange(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-cyan-300 font-mono text-xs focus:border-cyan-400 focus:outline-none font-bold"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-[11px] text-slate-400 mb-0.5">Rua / Logradouro</label>
                <input
                  type="text"
                  value={formData.street}
                  onChange={(e) => setFormData((p) => ({ ...p, street: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:border-cyan-400 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[11px] text-slate-400 mb-0.5">Número</label>
                <input
                  type="text"
                  value={formData.number}
                  onChange={(e) => setFormData((p) => ({ ...p, number: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:border-cyan-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-0.5">Bairro</label>
                <input
                  type="text"
                  value={formData.neighborhood}
                  onChange={(e) => setFormData((p) => ({ ...p, neighborhood: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:border-cyan-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-0.5">Cidade / UF</label>
                <input
                  type="text"
                  value={`${formData.city}/${formData.state}`}
                  onChange={(e) => {
                    const [c, u] = e.target.value.split('/');
                    setFormData((p) => ({ ...p, city: c || '', state: u || '' }));
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:border-cyan-400 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-[11px] text-slate-400 mb-0.5">Telefone Principal</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:border-cyan-400 focus:outline-none font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-0.5">
                  Horário de Funcionamento *
                </label>
                <input
                  type="text"
                  value={formData.businessHours}
                  onChange={(e) => setFormData((p) => ({ ...p, businessHours: e.target.value }))}
                  placeholder="Seg a Sex: 08:00 às 18:00"
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:border-cyan-400 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Termos de Garantia Padrão */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-cyan-400" />
              Termos Legais de Garantia (Impressos no Recibo)
            </label>
            <textarea
              rows={3}
              value={formData.warrantyTerms}
              onChange={(e) => setFormData((p) => ({ ...p, warrantyTerms: e.target.value }))}
              className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:border-cyan-400 focus:outline-none leading-relaxed"
            />
          </div>

          {/* Sincronização / Backup entre Computadores */}
          <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-purple-500/30 space-y-2.5">
            <span className="text-xs font-bold text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
              <UploadCloud className="w-4 h-4 text-purple-400" />
              Sincronização entre Computadores (Vercel / Outros Dispositivos)
            </span>
            <p className="text-[11px] text-slate-400 leading-tight">
              Para abrir seu sistema com todos os cadastros e ordens em outro computador, exporte o arquivo de backup e importe-o no outro dispositivo.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleExportData}
                className="flex-1 px-3 py-2 rounded-xl bg-purple-600/20 border border-purple-500/40 text-purple-300 text-xs font-bold hover:bg-purple-600/30 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Exportar Dados (JSON)</span>
              </button>
              <label className="flex-1 px-3 py-2 rounded-xl bg-cyan-600/20 border border-cyan-500/40 text-cyan-300 text-xs font-bold hover:bg-cyan-600/30 transition-all flex items-center justify-center gap-1.5 cursor-pointer">
                <Upload className="w-4 h-4" />
                <span>Importar Dados (JSON)</span>
                <input type="file" accept=".json" onChange={handleImportData} className="hidden" />
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-lg shadow-cyan-900/40 flex items-center gap-2"
            >
              {isSaved ? <CheckCircle2 className="w-4 h-4 text-emerald-300" /> : <Save className="w-4 h-4" />}
              {isSaved ? 'Configurações Salvas!' : 'Salvar Alterações'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
