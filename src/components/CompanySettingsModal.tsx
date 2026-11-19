import React, { useState, useEffect } from 'react';
import {
  X,
  Building2,
  Image as ImageIcon,
  MapPin,
  Save,
  CheckCircle2,
  FileText,
  Upload,
  Download,
  UploadCloud,
  AlertTriangle,
  Loader2,
  QrCode,
} from 'lucide-react';
import { CompanySettings } from '../types';
import { superdb } from '../lib/superdbClient';
import { resolveCompanyId, sbSelectByCompany } from '../utils/supabaseService';
import { fetchAddressByCep } from '../utils/viacep';
import { formatCep, cleanNumeric } from '../utils/formatters';
import {
  getOrders,
  getCurrentUser,
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

function formatSupabaseError(err: any): string {
  if (!err) return 'Erro desconhecido ao comunicar com o Supabase.';
  if (typeof err === 'string') return err;
  const parts: string[] = [];
  if (err.message) parts.push(err.message);
  if (err.details) parts.push(`Detalhes: ${err.details}`);
  if (err.hint) parts.push(`Dica: ${err.hint}`);
  if (err.code) parts.push(`Código: ${err.code}`);
  if (err.statusCode) parts.push(`HTTP: ${err.statusCode}`);
  return parts.length > 0 ? parts.join(' | ') : JSON.stringify(err);
}

function mapPerfilRowToSettings(rawRow: any, fallback: CompanySettings): CompanySettings {
  const row =
    rawRow?.dados && typeof rawRow.dados === 'object'
      ? { ...rawRow.dados, ...rawRow }
      : rawRow || {};

  const cidadeUfRaw = typeof row.cidade_uf === 'string' ? row.cidade_uf : '';
  const hasSlash = cidadeUfRaw.includes('/');
  const parsedCity = hasSlash
    ? cidadeUfRaw.split('/')[0]?.trim() ?? ''
    : row.cidade ?? row.city ?? (cidadeUfRaw || fallback.city);
  const parsedState = hasSlash
    ? cidadeUfRaw.split('/').slice(1).join('/').trim() ?? ''
    : row.uf ?? row.estado ?? row.state ?? fallback.state;

  return {
    ...fallback,
    name: row.nome_fantasia ?? row.nome ?? row.name ?? fallback.name,
    cnpj: row.cnpj ?? fallback.cnpj,
    slogan: row.slogan ?? fallback.slogan,
    cep: row.cep ?? fallback.cep,
    street: row.rua ?? row.logradouro ?? row.street ?? fallback.street,
    number: row.numero ?? row.number ?? fallback.number,
    neighborhood: row.bairro ?? row.neighborhood ?? fallback.neighborhood,
    city: parsedCity,
    state: parsedState,
    phone: row.telefone ?? row.telefone_principal ?? row.phone ?? fallback.phone,
    whatsapp: row.whatsapp ?? fallback.whatsapp,
    email: row.email ?? fallback.email,
    businessHours:
      row.horario_funcionamento ??
      row.horario ??
      row.business_hours ??
      row.businessHours ??
      fallback.businessHours,
    warrantyTerms:
      row.termos_garantia ??
      row.termos ??
      row.warranty_terms ??
      row.warrantyTerms ??
      fallback.warrantyTerms,
    logoUrl: row.logo_url || row.logoUrl || row.logo || rawRow?.dados?.logoUrl || fallback.logoUrl,
    pixKey: row.chave_pix ?? row.pix_key ?? row.pixKey ?? rawRow?.dados?.pixKey ?? fallback.pixKey ?? '',
    pixCity: row.cidade_pix ?? row.pix_city ?? row.pixCity ?? rawRow?.dados?.pixCity ?? fallback.pixCity ?? parsedCity,
  };
}

export const CompanySettingsModal: React.FC<CompanySettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSave,
}) => {
  const [formData, setFormData] = useState<CompanySettings>(settings);
  const [selectedLogoFile, setSelectedLogoFile] = useState<File | null>(null);
  const [existingRecordId, setExistingRecordId] = useState<string | number | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isLoadingCep, setIsLoadingCep] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Carrega os dados persistidos na tabela 'perfil_empresa' sempre que o modal abre
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setFormData(settings);
    setSelectedLogoFile(null);
    setErrorMsg(null);
    setIsSaved(false);

    async function loadCompanyProfile() {
      setIsLoadingProfile(true);
      try {
        const targetCompanyId = resolveCompanyId(getCurrentUser()?.companyId);
        const { data, error } = await sbSelectByCompany('perfil_empresa', targetCompanyId, { limit: 1 });

        if (error) {
          console.error('[SuperDB SELECT perfil_empresa Error]:', error);
          if (isMounted) {
            setErrorMsg(`Aviso ao carregar dados do Supabase (perfil_empresa): ${formatSupabaseError(error)}`);
          }
          return;
        }

        const row = Array.isArray(data) && data.length > 0 ? data[0] : null;
        if (isMounted && row) {
          setExistingRecordId(row.id ?? null);
          const mapped = mapPerfilRowToSettings(row, settings);
          setFormData(mapped);
        }
      } catch (err) {
        console.error('[Supabase SELECT perfil_empresa Exception]:', err);
        if (isMounted) {
          setErrorMsg(`Falha ao consultar tabela 'perfil_empresa': ${formatSupabaseError(err)}`);
        }
      } finally {
        if (isMounted) {
          setIsLoadingProfile(false);
        }
      }
    }

    loadCompanyProfile();

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

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
      setSelectedLogoFile(file);
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
            window.location.reload();
          }
        } catch (err) {
          console.error('[Backup JSON Import Error]:', err);
          setErrorMsg('Erro ao ler arquivo de backup JSON. Verifique se o arquivo é válido.');
        }
      };
      reader.readAsText(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSaving(true);

    try {
      let finalLogoUrl = formData.logoUrl || '';

      // 1. Tentativa opcional de upload da Logo para o bucket 'logos' no Supabase Storage;
      // se o bucket falhar ou não existir, mantém o base64 DataURL em finalLogoUrl.
      if (selectedLogoFile) {
        try {
          const rawExt = selectedLogoFile.name.split('.').pop() || 'png';
          const safeExt = rawExt.replace(/[^a-zA-Z0-9]/g, '') || 'png';
          const uniqueFileName = `logo_${Date.now()}.${safeExt}`;

          const { error: uploadError } = await superdb.storage
            .from('logos')
            .upload(uniqueFileName, selectedLogoFile, {
              cacheControl: '3600',
              upsert: true,
            });

          if (!uploadError) {
            const { data: publicUrlData } = superdb.storage
              .from('logos')
              .getPublicUrl(uniqueFileName);

            if (publicUrlData?.publicUrl) {
              finalLogoUrl = publicUrlData.publicUrl;
            }
          } else {
            console.warn('[Storage logos fallback to base64]:', uploadError.message);
          }
        } catch (storageErr) {
          console.warn('[Storage logos exception, keeping base64]:', storageErr);
        }
      }

      const updatedSettings: CompanySettings = {
        ...formData,
        logoUrl: finalLogoUrl,
      };

      const cidadeUfFormatted = [formData.city?.trim(), formData.state?.trim()]
        .filter(Boolean)
        .join('/');

      const targetCompanyId = resolveCompanyId(getCurrentUser()?.companyId);
      let targetId: string | number = existingRecordId ?? 1;
      try {
        const { data: existingRows } = await sbSelectByCompany('perfil_empresa', targetCompanyId, { limit: 1 });
        if (Array.isArray(existingRows) && existingRows.length > 0 && existingRows[0]?.id !== undefined) {
          targetId = existingRows[0].id;
        }
      } catch {}

      let upsertPayload: Record<string, any> = {
        id: targetId,
        company_id: targetCompanyId,
        nome_fantasia: formData.name.trim(),
        cnpj: formData.cnpj.trim(),
        slogan: formData.slogan.trim(),
        cep: formData.cep.trim(),
        rua: formData.street.trim(),
        numero: formData.number.trim(),
        bairro: formData.neighborhood.trim(),
        cidade_uf: cidadeUfFormatted,
        telefone: formData.phone.trim(),
        whatsapp: formData.whatsapp.trim(),
        email: formData.email.trim(),
        horario_funcionamento: formData.businessHours.trim(),
        termos_garantia: formData.warrantyTerms.trim(),
        logo_url: finalLogoUrl,
        chave_pix: (formData.pixKey || '').trim(),
        cidade_pix: (formData.pixCity || '').trim(),
        dados: updatedSettings,
      };

      let savedRow: any = null;
      let lastError: any = null;

      for (let attempt = 0; attempt < 8; attempt++) {
        const { data: upsertedData, error: upsertError } = await superdb
          .from('perfil_empresa')
          .upsert([upsertPayload], { onConflict: 'id' })
          .select()
          .limit(1);

        if (!upsertError) {
          savedRow = Array.isArray(upsertedData) ? upsertedData[0] : upsertedData;
          lastError = null;
          break;
        }

        lastError = upsertError;
        const msg = upsertError.message || '';
        const pgrstMatch = msg.match(/Could not find the '([^']+)' column/i);
        const pgMatch = msg.match(/column "([^"]+)" (?:of relation|does not exist)/i);
        const missingCol = pgrstMatch?.[1] || pgMatch?.[1] || null;

        if (missingCol && Object.prototype.hasOwnProperty.call(upsertPayload, missingCol)) {
          const { [missingCol]: _removed, ...nextPayload } = upsertPayload;
          upsertPayload = nextPayload;
          continue;
        }

        if (msg.includes('invalid input syntax for type uuid') && Object.prototype.hasOwnProperty.call(upsertPayload, 'id')) {
          const { id: _removedId, ...nextPayload } = upsertPayload;
          upsertPayload = nextPayload;
          continue;
        }
        break;
      }

      if (lastError) {
        throw new Error(`Erro ao gravar 'perfil_empresa': ${formatSupabaseError(lastError)}`);
      }

      if (savedRow?.id !== undefined) {
        setExistingRecordId(savedRow.id);
      }

      setFormData(updatedSettings);
      setSelectedLogoFile(null);
      onSave(updatedSettings);
      setIsSaved(true);

      setTimeout(() => {
        setIsSaved(false);
        onClose();
      }, 900);
    } catch (err: any) {
      console.error('[Supabase SAVE perfil_empresa Error]:', err);
      setErrorMsg(
        `Não foi possível salvar no Supabase: ${formatSupabaseError(err)}`
      );
    } finally {
      setIsSaving(false);
    }
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
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <span>Dados da Empresa & Cabeçalho</span>
                {isLoadingProfile && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-normal text-cyan-300">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Carregando...
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-cyan-400">Personalize o logotipo, endereço e horários do recibo</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-5 space-y-4 flex-1">
          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-rose-950/80 border border-rose-500/50 text-rose-200 text-xs flex items-start gap-2.5 shadow-lg">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1 break-words">
                <p className="font-bold text-rose-300 mb-0.5">Erro ao salvar / sincronizar com o Supabase</p>
                <p className="leading-relaxed">{errorMsg}</p>
              </div>
              <button
                type="button"
                onClick={() => setErrorMsg(null)}
                className="text-rose-400 hover:text-white p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

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
              <div className="flex items-center gap-2 flex-wrap">
                <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-600/20 border border-cyan-500/40 text-cyan-300 text-xs font-semibold hover:bg-cyan-600/30 transition-colors">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Escolher Imagem</span>
                  <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                </label>
                {selectedLogoFile && (
                  <span className="text-[11px] text-emerald-400 font-medium truncate max-w-[160px]">
                    {selectedLogoFile.name}
                  </span>
                )}
                {formData.logoUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedLogoFile(null);
                      setFormData((p) => ({ ...p, logoUrl: '' }));
                    }}
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

          {/* Recebimento via Pix (QR Code Automático) */}
          <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-emerald-500/30 space-y-3">
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <QrCode className="w-3.5 h-3.5" />
              Recebimento via Pix (QR Code no Carnê & Garantia)
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-slate-400 mb-0.5">
                  Chave Pix (CPF, CNPJ, E-mail, Telefone ou Aleatória)
                </label>
                <input
                  type="text"
                  value={formData.pixKey || ''}
                  onChange={(e) => setFormData((p) => ({ ...p, pixKey: e.target.value }))}
                  placeholder="Ex: 38.921.455/0001-90 ou pix@empresa.com"
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-emerald-300 font-mono text-xs focus:border-emerald-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-0.5">
                  Cidade do Recebedor (sem acentos)
                </label>
                <input
                  type="text"
                  value={formData.pixCity || ''}
                  onChange={(e) => setFormData((p) => ({ ...p, pixCity: e.target.value }))}
                  placeholder={formData.city || 'Ex: Sao Paulo'}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:border-emerald-400 focus:outline-none"
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
              disabled={isSaving}
              className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving || isLoadingProfile}
              className="px-6 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-lg shadow-cyan-900/40 flex items-center gap-2 disabled:opacity-60 cursor-pointer"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-300" />
                  <span>Salvando no Supabase...</span>
                </>
              ) : isSaved ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                  <span>Configurações Salvas!</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Salvar Alterações</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
