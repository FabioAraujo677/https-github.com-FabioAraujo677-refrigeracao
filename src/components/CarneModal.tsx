import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  BookOpenCheck,
  Calendar,
  Check,
  CheckCircle2,
  Copy,
  CreditCard,
  Download,
  FileText,
  ImagePlus,
  MessageSquare,
  Pencil,
  Plus,
  Printer,
  Settings,
  Sparkles,
  Trash2,
  Upload,
  User,
  Phone,
  X,
} from 'lucide-react';
import { CarneInstallment, CarneSale, CarneSettings, CompanySettings } from '../types';
import { formatCurrency, formatDate, getLocalDateString } from '../utils/formatters';
import {
  addMonthlyOffset,
  buildInstallmentsList,
  buildWhatsAppUrl,
  compressCoverImageFile,
  createCarneSale,
  DEFAULT_CARNE_MESSAGE_TEMPLATE,
  deleteCarneSale,
  formatCarneWhatsAppMessage,
  getCarneDueAlerts,
  toggleCarneInstallmentPaid,
} from '../utils/carneStorage';
import { downloadCarnePdf } from '../utils/carnePdfGenerator';

interface CarneModalProps {
  isOpen: boolean;
  initialTab?: 'novo' | 'lista' | 'config';
  onClose: () => void;
  company: CompanySettings;
  carnes: CarneSale[];
  carneSettings: CarneSettings;
  onCarnesUpdated: (carnes: CarneSale[]) => void;
  onSettingsUpdated: (settings: CarneSettings) => void;
}

export function CarneModal({
  isOpen,
  initialTab = 'novo',
  onClose,
  company,
  carnes,
  carneSettings,
  onCarnesUpdated,
  onSettingsUpdated,
}: CarneModalProps) {
  const [activeTab, setActiveTab] = useState<'novo' | 'lista' | 'config'>(initialTab);

  // Novo Carnê Form State
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [description, setDescription] = useState('');
  const [valueMode, setValueMode] = useState<'total' | 'parcela'>('total');
  const [rawAmount, setRawAmount] = useState('');
  const [installmentsCount, setInstallmentsCount] = useState<number>(6);
  const [firstDueDate, setFirstDueDate] = useState<string>(() => addMonthlyOffset(getLocalDateString(), 1));
  const [coverImage, setCoverImage] = useState<string | undefined>(carneSettings.defaultCoverImage);
  const [saveAsDefaultCover, setSaveAsDefaultCover] = useState<boolean>(false);

  // UI feedback states
  const [formError, setFormError] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [lastCreatedCarne, setLastCreatedCarne] = useState<CarneSale | null>(null);
  const [expandedCarneId, setExpandedCarneId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Editable WhatsApp billing composer state
  const [activeChargeTarget, setActiveChargeTarget] = useState<{
    carne: CarneSale;
    installment: CarneInstallment;
  } | null>(null);
  const [editableChargeMessage, setEditableChargeMessage] = useState<string>('');
  const [copiedNotice, setCopiedNotice] = useState(false);

  // Config Tab state
  const [templateDraft, setTemplateDraft] = useState<string>(carneSettings.billingMessageTemplate);
  const [defaultCoverDraft, setDefaultCoverDraft] = useState<string | undefined>(carneSettings.defaultCoverImage);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setCoverImage((prev) => prev ?? carneSettings.defaultCoverImage);
      setTemplateDraft(carneSettings.billingMessageTemplate || DEFAULT_CARNE_MESSAGE_TEMPLATE);
      setDefaultCoverDraft(carneSettings.defaultCoverImage);
      setFormError(null);
      setStatusNotice(null);
    }
  }, [isOpen, initialTab]);

  const numericAmount = useMemo(() => {
    const normalized = rawAmount.replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, '');
    const parsed = parseFloat(normalized);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }, [rawAmount]);

  const computedTotalValue = useMemo(() => {
    if (valueMode === 'total') return numericAmount;
    return Number((numericAmount * installmentsCount).toFixed(2));
  }, [valueMode, numericAmount, installmentsCount]);

  const computedInstallmentValue = useMemo(() => {
    if (valueMode === 'parcela') return numericAmount;
    return installmentsCount > 0 ? Number((numericAmount / installmentsCount).toFixed(2)) : 0;
  }, [valueMode, numericAmount, installmentsCount]);

  const previewInstallments = useMemo(() => {
    if (computedTotalValue <= 0 || !firstDueDate) return [];
    return buildInstallmentsList(computedTotalValue, installmentsCount, firstDueDate);
  }, [computedTotalValue, installmentsCount, firstDueDate]);

  const dueAlerts = useMemo(() => getCarneDueAlerts(carnes), [carnes]);
  const overdueOrTodayCount = useMemo(
    () => dueAlerts.filter((a) => a.status === 'vencida' || a.status === 'hoje').length,
    [dueAlerts]
  );

  if (!isOpen) return null;

  const showToast = (msg: string) => {
    setStatusNotice(msg);
    setTimeout(() => setStatusNotice(null), 4500);
  };

  const handleCoverUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    target: 'form' | 'config'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressCoverImageFile(file);
      if (target === 'form') {
        setCoverImage(compressed);
        if (saveAsDefaultCover) {
          const nextSettings: CarneSettings = {
            ...carneSettings,
            defaultCoverImage: compressed,
          };
          onSettingsUpdated(nextSettings);
          setDefaultCoverDraft(compressed);
        }
        showToast('Imagem da capa carregada com sucesso!');
      } else {
        setDefaultCoverDraft(compressed);
        const nextSettings: CarneSettings = {
          ...carneSettings,
          billingMessageTemplate: templateDraft,
          defaultCoverImage: compressed,
        };
        onSettingsUpdated(nextSettings);
        setCoverImage(compressed);
        showToast('Capa padrão atualizada com sucesso!');
      }
    } catch (err) {
      setFormError('Erro ao processar a imagem. Tente enviar um arquivo PNG ou JPG válido.');
    }
    e.target.value = '';
  };

  const validateAndCreateCarne = (): CarneSale | null => {
    setFormError(null);
    if (!customerName.trim()) {
      setFormError('Informe o nome do cliente.');
      return null;
    }
    if (!customerPhone.trim()) {
      setFormError('Informe o WhatsApp ou telefone do cliente.');
      return null;
    }
    if (!description.trim()) {
      setFormError('Informe a descrição do produto ou serviço.');
      return null;
    }
    if (computedTotalValue <= 0) {
      setFormError('Informe um valor válido maior que zero.');
      return null;
    }
    if (!firstDueDate) {
      setFormError('Selecione a data do primeiro vencimento.');
      return null;
    }

    if (saveAsDefaultCover && coverImage) {
      const nextSettings: CarneSettings = {
        ...carneSettings,
        defaultCoverImage: coverImage,
      };
      onSettingsUpdated(nextSettings);
      setDefaultCoverDraft(coverImage);
    }

    const { carne, allCarnes, savedOk } = createCarneSale({
      customerName,
      customerPhone,
      description,
      totalValue: computedTotalValue,
      installmentsCount,
      firstDueDate,
      coverImage,
    });

    onCarnesUpdated(allCarnes);
    setLastCreatedCarne(carne);
    setExpandedCarneId(carne.id);

    if (!savedOk) {
      showToast('Carnê gerado em memória (a imagem da capa pode exceder o limite de armazenamento local).');
    } else {
      showToast(`Carnê ${carne.id} criado com ${installmentsCount}x de ${formatCurrency(carne.installmentValue)}!`);
    }

    return carne;
  };

  const handleSaveOnly = (e: React.FormEvent) => {
    e.preventDefault();
    const created = validateAndCreateCarne();
    if (created) {
      setCustomerName('');
      setCustomerPhone('');
      setDescription('');
      setRawAmount('');
      setActiveTab('lista');
    }
  };

  const handleSaveAndGeneratePdf = async () => {
    const target = lastCreatedCarne &&
      lastCreatedCarne.customerName === customerName.trim() &&
      lastCreatedCarne.description === description.trim() &&
      Math.abs(lastCreatedCarne.totalValue - computedTotalValue) < 0.01
      ? lastCreatedCarne
      : validateAndCreateCarne();

    if (!target) return;
    setIsGeneratingPdf(true);
    try {
      const ok = await downloadCarnePdf(target, company);
      if (ok) {
        showToast(`PDF do carnê ${target.id} gerado e baixado com sucesso!`);
      } else {
        setFormError('Não foi possível gerar o PDF do carnê. Verifique os dados e tente novamente.');
      }
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleDownloadExistingPdf = async (carne: CarneSale) => {
    setIsGeneratingPdf(true);
    try {
      const ok = await downloadCarnePdf(carne, company);
      if (ok) {
        showToast(`PDF do carnê ${carne.id} gerado com sucesso!`);
      }
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleTogglePaid = (carneId: string, installmentNumber: number) => {
    const updated = toggleCarneInstallmentPaid(carneId, installmentNumber);
    onCarnesUpdated(updated);
    showToast(`Parcela ${String(installmentNumber).padStart(2, '0')} atualizada!`);
  };

  const handleDeleteCarne = (carneId: string) => {
    const updated = deleteCarneSale(carneId);
    onCarnesUpdated(updated);
    setConfirmDeleteId(null);
    if (activeChargeTarget?.carne.id === carneId) {
      setActiveChargeTarget(null);
    }
    showToast('Carnê removido com sucesso.');
  };

  const openChargeEditor = (carne: CarneSale, installment: CarneInstallment) => {
    const formatted = formatCarneWhatsAppMessage(
      carneSettings.billingMessageTemplate,
      carne,
      installment,
      company.name
    );
    setActiveChargeTarget({ carne, installment });
    setEditableChargeMessage(formatted);
    setCopiedNotice(false);
  };

  const handleSaveSettingsConfig = () => {
    const nextSettings: CarneSettings = {
      defaultCoverImage: defaultCoverDraft,
      billingMessageTemplate: templateDraft.trim() || DEFAULT_CARNE_MESSAGE_TEMPLATE,
    };
    const ok = onSettingsUpdated(nextSettings) as unknown;
    setTemplateDraft(nextSettings.billingMessageTemplate);
    if (ok === false) {
      setFormError('Imagem muito grande para salvar como padrão. Tente outra imagem JPG/PNG.');
    } else {
      showToast('Configurações do carnê salvas com sucesso!');
    }
  };

  const insertPlaceholder = (token: string) => {
    setTemplateDraft((prev) => (prev ? `${prev} ${token}` : token));
  };

  const handleCopyChargeMessage = async () => {
    try {
      await navigator.clipboard.writeText(editableChargeMessage);
      setCopiedNotice(true);
      setTimeout(() => setCopiedNotice(false), 2500);
    } catch {
      // Clipboard fallback handled silently
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-4xl max-h-[94vh] flex flex-col rounded-3xl bg-[#0d111a] border border-emerald-500/30 shadow-[0_0_60px_rgba(16,185,129,0.2)] overflow-hidden text-slate-100">
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-[#0f172a] via-[#101c2e] to-[#0f172a] border-b border-white/10 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-400/40 flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.25)]">
              <BookOpenCheck className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-white uppercase tracking-wide">
                  Venda Carnê & Parcelamentos
                </h2>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  Crediário Próprio
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Emissão de carnês com capa personalizada, lâminas A4 em PDF e alertas editáveis no WhatsApp
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 border border-white/5 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="px-5 pt-3 pb-2 bg-[#0b0f17] border-b border-white/5 flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('novo')}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer border ${
              activeTab === 'novo'
                ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.35)]'
                : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:text-white'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Novo Carnê</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('lista')}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer border ${
              activeTab === 'lista'
                ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.35)]'
                : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:text-white'
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            <span>Carnês & Vencimentos ({carnes.length})</span>
            {overdueOrTodayCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-black animate-pulse">
                {overdueOrTodayCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('config')}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer border ${
              activeTab === 'config'
                ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.35)]'
                : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:text-white'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Capa Padrão & Mensagem</span>
          </button>
        </div>

        {/* Notices */}
        {(formError || statusNotice) && (
          <div className="px-5 pt-3 shrink-0">
            {formError && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-200 text-xs font-semibold flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  {formError}
                </span>
                <button type="button" onClick={() => setFormError(null)} className="text-rose-300 hover:text-white">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            {statusNotice && (
              <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-200 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{statusNotice}</span>
              </div>
            )}
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* ==================== TAB 1: NOVO CARNÊ ==================== */}
          {activeTab === 'novo' && (
            <form onSubmit={handleSaveOnly} className="space-y-5">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* Coluna Esquerda: Dados do Carnê */}
                <div className="lg:col-span-7 space-y-4">
                  <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-4">
                    <h3 className="text-xs font-black uppercase tracking-widest text-cyan-400 flex items-center gap-2">
                      <User className="w-4 h-4" />
                      1. Dados do Cliente & Compra
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-300 mb-1">
                          Nome do Cliente *
                        </label>
                        <input
                          type="text"
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          placeholder="Ex: Maria Aparecida Silva"
                          className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs sm:text-sm focus:border-emerald-400 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-300 mb-1">
                          WhatsApp / Telefone *
                        </label>
                        <div className="relative">
                          <Phone className="w-3.5 h-3.5 text-emerald-400 absolute left-3 top-3" />
                          <input
                            type="text"
                            value={customerPhone}
                            onChange={(e) => setCustomerPhone(e.target.value)}
                            placeholder="(11) 99999-9999"
                            className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs sm:text-sm focus:border-emerald-400 focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">
                        Descrição do Produto ou Serviço *
                      </label>
                      <textarea
                        rows={2}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Ex: Geladeira Frost Free Brastemp 400L + Garantia Estendida"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs sm:text-sm focus:border-emerald-400 focus:outline-none resize-none"
                      />
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-xs font-black uppercase tracking-widest text-emerald-400 flex items-center gap-2">
                        <CreditCard className="w-4 h-4" />
                        2. Valores & Parcelamento
                      </h3>

                      <div className="flex items-center p-0.5 rounded-lg bg-slate-950 border border-slate-800 text-[10px] font-bold">
                        <button
                          type="button"
                          onClick={() => setValueMode('total')}
                          className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                            valueMode === 'total'
                              ? 'bg-emerald-500 text-slate-950 font-black'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          Informar Valor Total
                        </button>
                        <button
                          type="button"
                          onClick={() => setValueMode('parcela')}
                          className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                            valueMode === 'parcela'
                              ? 'bg-emerald-500 text-slate-950 font-black'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          Informar Valor da Parcela
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-300 mb-1">
                          {valueMode === 'total' ? 'Valor Total (R$) *' : 'Valor da Parcela (R$) *'}
                        </label>
                        <input
                          type="text"
                          value={rawAmount}
                          onChange={(e) => setRawAmount(e.target.value)}
                          placeholder="0,00"
                          className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-emerald-300 font-mono font-bold text-sm focus:border-emerald-400 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-300 mb-1">
                          Quantidade de Parcelas
                        </label>
                        <select
                          value={installmentsCount}
                          onChange={(e) => setInstallmentsCount(Number(e.target.value))}
                          className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm font-bold focus:border-emerald-400 focus:outline-none"
                        >
                          {Array.from({ length: 12 }, (_, idx) => idx + 1).map((n) => (
                            <option key={n} value={n}>
                              {n}x {n === 1 ? '(À vista / 1 parcela)' : 'parcelas mensais'}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-300 mb-1">
                          1º Vencimento *
                        </label>
                        <div className="relative">
                          <Calendar className="w-3.5 h-3.5 text-cyan-400 absolute left-3 top-3 pointer-events-none" />
                          <input
                            type="date"
                            value={firstDueDate}
                            onChange={(e) => setFirstDueDate(e.target.value)}
                            className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs sm:text-sm focus:border-emerald-400 focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Resumo Calculado */}
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">
                          Valor Total do Carnê
                        </span>
                        <span className="text-lg font-mono font-black text-emerald-400">
                          {formatCurrency(computedTotalValue)}
                        </span>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">
                          {installmentsCount}x Parcelas de
                        </span>
                        <span className="text-lg font-mono font-black text-cyan-400">
                          {formatCurrency(computedInstallmentValue)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Coluna Direita: Capa Personalizada + Prévia das Lâminas */}
                <div className="lg:col-span-5 space-y-4">
                  <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-black uppercase tracking-widest text-purple-300 flex items-center gap-2">
                        <ImagePlus className="w-4 h-4 text-purple-400" />
                        3. Capa do Carnê (PNG / JPG)
                      </h3>
                      {coverImage && (
                        <button
                          type="button"
                          onClick={() => setCoverImage(undefined)}
                          className="text-[10px] font-bold text-rose-400 hover:text-rose-300 cursor-pointer"
                        >
                          Remover imagem
                        </button>
                      )}
                    </div>

                    {/* Preview da Capa */}
                    <div className="relative rounded-2xl overflow-hidden border border-slate-700/80 bg-slate-950 h-40 flex items-center justify-center">
                      {coverImage ? (
                        <img
                          src={coverImage}
                          alt="Prévia da Capa do Carnê"
                          className="w-full h-full object-contain p-1.5"
                        />
                      ) : (
                        <div className="text-center px-4 space-y-1.5">
                          <div className="inline-flex h-10 w-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 items-center justify-center text-cyan-400">
                            <Sparkles className="w-5 h-5" />
                          </div>
                          <p className="text-xs font-black text-white uppercase">
                            {company.name}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            Capa padrão elegante (ou envie uma arte personalizada abaixo)
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <label className="flex-1 px-3.5 py-2.5 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/40 text-purple-200 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all">
                        <Upload className="w-3.5 h-3.5" />
                        <span>{coverImage ? 'Trocar Imagem da Capa' : 'Carregar Imagem (PNG/JPG)'}</span>
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/jpg"
                          onChange={(e) => handleCoverUpload(e, 'form')}
                          className="hidden"
                        />
                      </label>

                      {carneSettings.defaultCoverImage && coverImage !== carneSettings.defaultCoverImage && (
                        <button
                          type="button"
                          onClick={() => setCoverImage(carneSettings.defaultCoverImage)}
                          className="px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-cyan-300 cursor-pointer"
                        >
                          Usar Padrão
                        </button>
                      )}
                    </div>

                    <label className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer select-none pt-1">
                      <input
                        type="checkbox"
                        checked={saveAsDefaultCover}
                        onChange={(e) => setSaveAsDefaultCover(e.target.checked)}
                        className="rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-emerald-500"
                      />
                      <span>Manter esta imagem salva como capa padrão para os próximos carnês</span>
                    </label>
                  </div>

                  {/* Prévia das Parcelas */}
                  <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-2.5">
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-300 flex items-center justify-between">
                      <span>Prévia das Lâminas ({installmentsCount}x)</span>
                      <span className="text-[10px] font-mono text-cyan-400">A4 Impressão</span>
                    </h3>

                    {previewInstallments.length === 0 ? (
                      <p className="text-[11px] text-slate-500 py-4 text-center">
                        Preencha o valor e a data para visualizar as parcelas.
                      </p>
                    ) : (
                      <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                        {previewInstallments.map((inst) => (
                          <div
                            key={inst.number}
                            className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800/80 text-[11px]"
                          >
                            <span className="font-mono font-bold text-cyan-400">
                              {String(inst.number).padStart(2, '0')}/{String(inst.total).padStart(2, '0')}
                            </span>
                            <span className="text-slate-300">{formatDate(inst.dueDate)}</span>
                            <span className="font-mono font-bold text-emerald-400">
                              {formatCurrency(inst.amount)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Footer */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 hover:text-white text-xs font-bold cursor-pointer"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-emerald-500/40 text-emerald-300 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-all"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Salvar Carnê</span>
                </button>

                <button
                  type="button"
                  disabled={isGeneratingPdf}
                  onClick={handleSaveAndGeneratePdf}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 text-xs font-black uppercase tracking-wider shadow-[0_0_25px_rgba(16,185,129,0.4)] flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-60"
                >
                  <Printer className="w-4 h-4" />
                  <span>{isGeneratingPdf ? 'Gerando PDF...' : 'Gerar Carnê PDF'}</span>
                </button>
              </div>
            </form>
          )}

          {/* ==================== TAB 2: CARNÊS & VENCIMENTOS ==================== */}
          {activeTab === 'lista' && (
            <div className="space-y-5">
              {/* Alerta de Vencimento Automático */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-rose-500/10 to-slate-900 border border-amber-500/30 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-amber-400 animate-pulse" />
                    <h3 className="text-xs font-black uppercase tracking-wider text-amber-300">
                      Alertas de Vencimento Automáticos ({dueAlerts.length})
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('config')}
                    className="px-3 py-1 rounded-lg bg-slate-900/90 border border-amber-500/30 text-[11px] font-bold text-amber-200 hover:text-white flex items-center gap-1.5 cursor-pointer"
                  >
                    <Pencil className="w-3 h-3" />
                    <span>Editar Mensagem Padrão</span>
                  </button>
                </div>

                {dueAlerts.length === 0 ? (
                  <p className="text-xs text-slate-400">
                    Nenhuma parcela vencida, vencendo hoje ou nos próximos 3 dias.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-52 overflow-y-auto pr-1">
                    {dueAlerts.map((item) => {
                      const pLabel = `${String(item.installment.number).padStart(2, '0')}/${String(
                        item.installment.total
                      ).padStart(2, '0')}`;
                      return (
                        <div
                          key={`${item.carne.id}-${item.installment.number}`}
                          className={`p-3 rounded-xl border flex items-center justify-between gap-2 ${
                            item.status === 'vencida'
                              ? 'bg-rose-950/40 border-rose-500/40'
                              : item.status === 'hoje'
                              ? 'bg-amber-950/40 border-amber-500/40'
                              : 'bg-slate-950/70 border-cyan-500/30'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                                  item.status === 'vencida'
                                    ? 'bg-rose-500 text-white'
                                    : item.status === 'hoje'
                                    ? 'bg-amber-500 text-slate-950'
                                    : 'bg-cyan-500/20 text-cyan-300'
                                }`}
                              >
                                {item.status === 'vencida'
                                  ? `Vencida há ${Math.abs(item.daysDiff)}d`
                                  : item.status === 'hoje'
                                  ? 'Vence Hoje'
                                  : `Vence em ${item.daysDiff}d`}
                              </span>
                              <span className="text-xs font-bold text-white truncate">
                                {item.carne.customerName}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-300 mt-1">
                              Parcela <strong className="text-cyan-300">{pLabel}</strong> •{' '}
                              <strong className="text-emerald-300">
                                {formatCurrency(item.installment.amount)}
                              </strong>{' '}
                              • Venc. {formatDate(item.installment.dueDate)}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => openChargeEditor(item.carne, item.installment)}
                            className="px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-[10px] font-black uppercase flex items-center gap-1.5 shrink-0 cursor-pointer shadow-lg"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>Cobrar</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Editor de Mensagem de Cobrança Antes de Enviar no WhatsApp */}
              {activeChargeTarget && (
                <div className="p-4 rounded-2xl bg-slate-900 border-2 border-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.18)] space-y-3 animate-fadeIn">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-emerald-400" />
                      <h4 className="text-xs font-black uppercase text-white">
                        Editar Mensagem para {activeChargeTarget.carne.customerName} (Parcela{' '}
                        {String(activeChargeTarget.installment.number).padStart(2, '0')}/
                        {String(activeChargeTarget.installment.total).padStart(2, '0')})
                      </h4>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveChargeTarget(null)}
                      className="text-slate-400 hover:text-white cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <textarea
                    rows={3}
                    value={editableChargeMessage}
                    onChange={(e) => setEditableChargeMessage(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs sm:text-sm focus:border-emerald-400 focus:outline-none"
                  />

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[10px] text-slate-400">
                      WhatsApp destino: <strong className="text-slate-200">{activeChargeTarget.carne.customerPhone}</strong>
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleCopyChargeMessage}
                        className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 flex items-center gap-1.5 cursor-pointer"
                      >
                        {copiedNotice ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedNotice ? 'Copiado!' : 'Copiar Texto'}</span>
                      </button>

                      <a
                        href={buildWhatsAppUrl(activeChargeTarget.carne.customerPhone, editableChargeMessage)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 text-xs font-black uppercase flex items-center gap-1.5 shadow-lg"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Enviar no WhatsApp</span>
                      </a>
                    </div>
                  </div>
                </div>
              )}

              {/* Lista de Carnês */}
              {carnes.length === 0 ? (
                <div className="p-8 rounded-2xl bg-slate-900/50 border border-dashed border-slate-800 text-center space-y-3">
                  <FileText className="w-10 h-10 text-slate-600 mx-auto" />
                  <div>
                    <p className="text-sm font-bold text-slate-300">Nenhum carnê emitido ainda</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Clique em "Novo Carnê" para emitir o primeiro parcelamento com PDF.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('novo')}
                    className="px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 text-xs font-black uppercase cursor-pointer"
                  >
                    + Criar Primeiro Carnê
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {carnes.map((carne) => {
                    const paidCount = carne.installments.filter((i) => i.paid).length;
                    const isExpanded = expandedCarneId === carne.id;
                    return (
                      <div
                        key={carne.id}
                        className="rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden"
                      >
                        <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[10px] font-mono font-black px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                                {carne.id}
                              </span>
                              <h4 className="text-sm font-black text-white truncate">
                                {carne.customerName}
                              </h4>
                              <span className="text-[11px] text-slate-400">{carne.customerPhone}</span>
                            </div>
                            <p className="text-xs text-slate-300 truncate">{carne.description}</p>
                            <div className="flex items-center gap-3 text-[11px] text-slate-400 flex-wrap">
                              <span>
                                Total:{' '}
                                <strong className="text-emerald-400">
                                  {formatCurrency(carne.totalValue)}
                                </strong>
                              </span>
                              <span>
                                Parcelas:{' '}
                                <strong className="text-cyan-300">
                                  {paidCount}/{carne.installmentsCount} pagas
                                </strong>
                              </span>
                              <span>1º Venc: {formatDate(carne.firstDueDate)}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 flex-wrap shrink-0">
                            <button
                              type="button"
                              onClick={() => handleDownloadExistingPdf(carne)}
                              className="px-3 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 text-[11px] font-black uppercase flex items-center gap-1.5 cursor-pointer"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>Gerar Carnê PDF</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setExpandedCarneId(isExpanded ? null : carne.id)}
                              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold cursor-pointer"
                            >
                              {isExpanded ? 'Ocultar Parcelas' : 'Ver Parcelas'}
                            </button>

                            {confirmDeleteId === carne.id ? (
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteCarne(carne.id)}
                                  className="px-2.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-black uppercase cursor-pointer"
                                >
                                  Confirmar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="px-2 py-2 rounded-xl bg-slate-800 text-slate-300 text-[10px] font-bold cursor-pointer"
                                >
                                  Não
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(carne.id)}
                                className="p-2 rounded-xl bg-slate-800/80 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 cursor-pointer"
                                title="Excluir Carnê"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="px-4 pb-4 pt-2 border-t border-slate-800/80 bg-slate-950/60 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                            {carne.installments.map((inst) => (
                              <div
                                key={inst.number}
                                className={`p-3 rounded-xl border flex flex-col justify-between gap-2 ${
                                  inst.paid
                                    ? 'bg-emerald-950/25 border-emerald-500/30'
                                    : 'bg-slate-900 border-slate-800'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-mono font-black text-cyan-400">
                                    Parcela {String(inst.number).padStart(2, '0')}/
                                    {String(inst.total).padStart(2, '0')}
                                  </span>
                                  <span
                                    className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                                      inst.paid
                                        ? 'bg-emerald-500/20 text-emerald-300'
                                        : 'bg-amber-500/15 text-amber-300'
                                    }`}
                                  >
                                    {inst.paid ? 'PAGA' : 'ABERTA'}
                                  </span>
                                </div>

                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-slate-400">Venc: {formatDate(inst.dueDate)}</span>
                                  <span className="font-mono font-black text-white">
                                    {formatCurrency(inst.amount)}
                                  </span>
                                </div>

                                <div className="flex items-center gap-1.5 pt-1">
                                  <button
                                    type="button"
                                    onClick={() => handleTogglePaid(carne.id, inst.number)}
                                    className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase cursor-pointer transition-all ${
                                      inst.paid
                                        ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                                        : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                                    }`}
                                  >
                                    {inst.paid ? 'Desmarcar Pago' : 'Dar Baixa (Pago)'}
                                  </button>

                                  {!inst.paid && (
                                    <button
                                      type="button"
                                      onClick={() => openChargeEditor(carne, inst)}
                                      className="px-2.5 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                                      title="Editar & Enviar Cobrança WhatsApp"
                                    >
                                      <MessageSquare className="w-3 h-3" />
                                      <span>WhatsApp</span>
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ==================== TAB 3: CONFIGURAÇÕES DO CARNÊ ==================== */}
          {activeTab === 'config' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Upload Capa Padrão */}
              <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-4">
                <h3 className="text-xs font-black uppercase tracking-widest text-purple-300 flex items-center gap-2">
                  <ImagePlus className="w-4 h-4 text-purple-400" />
                  Capa Padrão dos Carnês (PNG / JPG)
                </h3>

                <div className="relative rounded-2xl overflow-hidden border border-slate-700 bg-slate-950 h-48 flex items-center justify-center">
                  {defaultCoverDraft ? (
                    <img
                      src={defaultCoverDraft}
                      alt="Capa Padrão do Carnê"
                      className="w-full h-full object-contain p-2"
                    />
                  ) : (
                    <div className="text-center px-4 space-y-1.5">
                      <Sparkles className="w-7 h-7 text-cyan-400 mx-auto" />
                      <p className="text-xs font-bold text-white">Nenhuma imagem padrão definida</p>
                      <p className="text-[11px] text-slate-400">
                        Sem imagem, o PDF usa automaticamente o layout oficial NEO FIX.
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex-1 px-4 py-2.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/40 text-purple-200 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer">
                    <Upload className="w-4 h-4" />
                    <span>Carregar Capa Padrão (PNG/JPG)</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/jpg"
                      onChange={(e) => handleCoverUpload(e, 'config')}
                      className="hidden"
                    />
                  </label>

                  {defaultCoverDraft && (
                    <button
                      type="button"
                      onClick={() => {
                        setDefaultCoverDraft(undefined);
                        setCoverImage(undefined);
                        onSettingsUpdated({
                          ...carneSettings,
                          defaultCoverImage: undefined,
                          billingMessageTemplate: templateDraft,
                        });
                        showToast('Capa padrão removida.');
                      }}
                      className="px-3.5 py-2.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-xs font-bold cursor-pointer"
                    >
                      Remover
                    </button>
                  )}
                </div>
              </div>

              {/* Editor de Mensagem de Cobrança */}
              <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-4">
                <h3 className="text-xs font-black uppercase tracking-widest text-emerald-400 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  Mensagem Editável de Cobrança (WhatsApp)
                </h3>

                <div className="space-y-2">
                  <p className="text-[11px] text-slate-400">
                    Clique nas variáveis abaixo para inserir automaticamente na mensagem:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {['[Cliente]', '[X/Y]', '[Valor]', '[Vencimento]', '[Produto]', '[Empresa]'].map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => insertPlaceholder(tag)}
                        className="px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-cyan-500/20 border border-slate-700 text-[10px] font-mono font-bold text-cyan-300 cursor-pointer"
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>

                <textarea
                  rows={4}
                  value={templateDraft}
                  onChange={(e) => setTemplateDraft(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs sm:text-sm focus:border-emerald-400 focus:outline-none"
                />

                <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800 space-y-1">
                  <span className="text-[10px] font-bold uppercase text-slate-500">
                    Pré-visualização do envio:
                  </span>
                  <p className="text-xs text-emerald-300 italic">
                    {formatCarneWhatsAppMessage(
                      templateDraft,
                      {
                        id: 'CARNE-DEMO',
                        createdAt: new Date().toISOString(),
                        customerName: 'João da Silva',
                        customerPhone: '(11) 99999-9999',
                        description: 'Geladeira Frost Free',
                        totalValue: 1200,
                        installmentValue: 200,
                        installmentsCount: 6,
                        firstDueDate: getLocalDateString(),
                        installments: [],
                      },
                      {
                        number: 2,
                        total: 6,
                        dueDate: getLocalDateString(),
                        amount: 200,
                        paid: false,
                      },
                      company.name
                    )}
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setTemplateDraft(DEFAULT_CARNE_MESSAGE_TEMPLATE)}
                    className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 cursor-pointer"
                  >
                    Restaurar Padrão
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveSettingsConfig}
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 text-xs font-black uppercase cursor-pointer"
                  >
                    Salvar Configurações
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
