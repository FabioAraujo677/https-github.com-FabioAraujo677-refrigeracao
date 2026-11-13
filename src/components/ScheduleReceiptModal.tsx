import React, { useRef, useState, useEffect } from 'react';
import {
  X,
  Calendar,
  Clock,
  MapPin,
  Phone,
  User,
  Wrench,
  Share2,
  Printer,
  Download,
  CheckCircle2,
  Copy,
  Shield,
  Loader2,
  FileCheck,
  Send,
  Smartphone,
  Sparkles,
  PlusCircle,
} from 'lucide-react';
import { CompanySettings, WarrantyOrder } from '../types';
import { formatCurrency, formatDate, formatDateTime, cleanNumeric, formatPhone } from '../utils/formatters';
import { downloadSchedulePdf } from '../utils/pdfGenerator';
import { sbGetStaff, sbSaveStaff } from '../utils/supabaseService';
import { StaffMember } from '../types';
import confetti from 'canvas-confetti';

interface ScheduleReceiptModalProps {
  order: WarrantyOrder;
  company: CompanySettings;
  isOpen: boolean;
  onClose: () => void;
  onConvertToWarranty?: (order: WarrantyOrder) => void;
  onOpenNewSchedule?: () => void;
}

export const ScheduleReceiptModal: React.FC<ScheduleReceiptModalProps> = ({
  order,
  company,
  isOpen,
  onClose,
  onOpenNewSchedule,
}) => {
  const receiptRef = useRef<HTMLDivElement | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [copiedSuccess, setCopiedSuccess] = useState(false);
  const [dispatchSuccess, setDispatchSuccess] = useState<string | null>(null);
  const [showNewScheduleConfirm, setShowNewScheduleConfirm] = useState(false);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);

  useEffect(() => {
    if (isOpen) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#a855f7', '#6366f1', '#22d3ee']
      });
      loadStaff();
    }
  }, [isOpen]);

  const loadStaff = async () => {
    const data = await sbGetStaff();
    setStaffList(data || []);
  };

  const handleCopyText = () => {
    const text = `📋 *AGENDAMENTO - ${company.name}*\n\n` +
      `📅 *Data:* ${formatDate(order.scheduledDate!)}\n` +
      `⏰ *Horário:* ${order.scheduledTime}\n\n` +
      `👤 *Cliente:* ${order.customerName}\n` +
      `📍 *Endereço:* ${order.street}, ${order.number} - ${order.neighborhood}, ${order.city}\n\n` +
      `🔧 *Aparelho:* ${order.applianceType} ${order.applianceBrand}\n` +
      `❓ *Defeito:* ${order.defectDescription}\n\n` +
      `💰 *Taxa:* ${formatCurrency(order.visitFee || 0)}`;

    try {
      navigator.clipboard.writeText(text).catch(() => {});
    } catch {}
    setCopiedSuccess(true);
    onClose();
  };

  const handleDownloadPdf = async () => {
    setIsGeneratingPdf(true);
    try {
      await downloadSchedulePdf(order, company);
    } finally {
      setIsGeneratingPdf(false);
    }
    onClose();
  };

  const handleSendClientWhatsApp = () => {
    const text = encodeURIComponent(
      `Olá *${order.customerName}*! Tudo bem?\n\n` +
      `Confirmamos seu agendamento na *${company.name}*:\n\n` +
      `📅 *Data:* ${formatDate(order.scheduledDate!)}\n` +
      `⏰ *Período:* ${order.scheduledTime}\n\n` +
      `O técnico *${order.technicianName}* irá até você.\n\n` +
      `Até lá!`
    );
    window.open(`https://wa.me/55${cleanNumeric(order.customerPhone)}?text=${text}`, '_blank');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/90 backdrop-blur-xl animate-fadeIn overflow-y-auto">
      <div className="relative w-full max-w-lg bg-[#0f1115] border border-purple-500/30 rounded-[2.5rem] shadow-[0_0_80px_rgba(168,85,247,0.3)] overflow-hidden my-auto flex flex-col max-h-[96vh]">
        {/* Glow corner decorations */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between px-8 py-6 bg-slate-900/50 border-b border-white/5 relative z-10">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-lg">
              <FileCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white uppercase tracking-tight leading-none">Agendamento Salvo</h2>
              <p className="text-[10px] text-purple-400 font-black uppercase mt-1 tracking-widest flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Sincronizado com Sucesso
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2.5 rounded-2xl text-slate-500 hover:text-white hover:bg-white/5 transition-all">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-8 space-y-8 overflow-y-auto relative z-10 flex-1">
          {/* Main Info Card */}
          <div className="bg-slate-900/50 border border-white/5 rounded-[2rem] p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <div className="flex items-center gap-2 text-purple-400">
                <Calendar className="w-5 h-5" />
                <span className="text-lg font-black">{formatDate(order.scheduledDate!)}</span>
              </div>
              <div className="flex items-center gap-2 text-indigo-300">
                <Clock className="w-5 h-5" />
                <span className="text-lg font-bold">{order.scheduledTime}</span>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <span className="text-[10px] font-black uppercase text-slate-500 block mb-1">Cliente</span>
                <p className="text-xl font-black text-white">{order.customerName}</p>
                <div className="flex items-center gap-2 text-slate-400 text-sm mt-1">
                  <Phone className="w-3.5 h-3.5 text-emerald-400" />
                  {order.customerPhone}
                </div>
              </div>

              <div>
                <span className="text-[10px] font-black uppercase text-slate-500 block mb-1">Endereço</span>
                <p className="text-sm text-slate-200 leading-relaxed font-medium">
                  {order.street}, {order.number}<br />
                  {order.neighborhood} - {order.city}
                </p>
              </div>

              <div>
                <span className="text-[10px] font-black uppercase text-slate-500 block mb-1">Técnico Responsável</span>
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-purple-500/20 flex items-center justify-center text-purple-400">
                    <User className="w-4 h-4" />
                  </div>
                  <p className="text-sm font-bold text-white uppercase">{order.technicianName}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              onClick={handleSendClientWhatsApp}
              className="flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider transition-all shadow-lg active:scale-95"
            >
              <Smartphone className="w-5 h-5" />
              Enviar p/ Cliente
            </button>
            <button
              onClick={handleCopyText}
              className={`flex items-center justify-center gap-3 px-6 py-4 rounded-2xl border font-black text-xs uppercase tracking-wider transition-all shadow-lg active:scale-95 ${
                copiedSuccess ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-900 border-white/10 text-slate-200 hover:bg-slate-800'
              }`}
            >
              {copiedSuccess ? <CheckCircle2 className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
              {copiedSuccess ? 'Copiado!' : 'Copiar Texto'}
            </button>
            <button
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              className="flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-slate-900 border border-white/10 hover:bg-slate-800 text-slate-200 font-black text-xs uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50"
            >
              {isGeneratingPdf ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
              Baixar PDF
            </button>
            <button
              onClick={onClose}
              className="flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-white text-black font-black text-xs uppercase tracking-wider hover:bg-slate-200 transition-all active:scale-95"
            >
              <X className="w-5 h-5" />
              Fechar Tudo
            </button>
          </div>
        </div>

        {/* Footer Info */}
        <div className="px-8 py-4 bg-black/40 text-center shrink-0 border-t border-white/5">
          <p className="text-[9px] text-slate-600 font-black uppercase tracking-[0.3em]">
            {company.name} • Gestão Inteligente
          </p>
        </div>
      </div>
    </div>
  );
};
