import React, { useRef, useState } from 'react';
import {
  X,
  Printer,
  Share2,
  Download,
  ShieldCheck,
  Calendar,
  User,
  Wrench,
  Clock,
  MapPin,
  Phone,
  FileCheck,
  CheckCircle2,
  Copy,
  ExternalLink,
  Loader2,
  Cpu,
} from 'lucide-react';
import { CompanySettings, WarrantyOrder } from '../types';
import { formatCurrency, formatDate, formatDateTime, cleanNumeric } from '../utils/formatters';
import { downloadWarrantyPdf } from '../utils/pdfGenerator';
import confetti from 'canvas-confetti';

interface ReceiptModalProps {
  order: WarrantyOrder;
  company: CompanySettings;
  isOpen: boolean;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ order, company, isOpen, onClose }) => {
  const receiptRef = useRef<HTMLDivElement | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [copiedSuccess, setCopiedSuccess] = useState(false);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const generateWhatsAppMessage = () => {
    const text =
      `🛡️ *CERTIFICADO DE GARANTIA & RECIBO*\n` +
      `🏢 *${company.name.toUpperCase()}*\n` +
      `_${company.slogan}_\n\n` +
      `📋 *ORDEM DE SERVIÇO:* ${order.id}\n` +
      `📅 *Data de Emissão:* ${formatDate(order.createdAt)}\n` +
      `─────────────────────────\n` +
      `👤 *CLIENTE:* ${order.customerName}\n` +
      `📞 *Contato:* ${order.customerPhone}\n` +
      `📍 *Endereço:* ${order.street}, ${order.number}${order.complement ? ' - ' + order.complement : ''}\n` +
      `🏙️ *Bairro/Cidade:* ${order.neighborhood}, ${order.city}/${order.state} - CEP: ${order.cep}\n\n` +
      `⚡ *EQUIPAMENTO CONSERTADO:*\n` +
      `🔹 *Aparelho:* ${order.applianceType}\n` +
      `🔹 *Marca/Modelo:* ${order.applianceBrand} ${order.applianceModel || ''}\n\n` +
      `🔧 *DETALHES DO REPARO:*\n` +
      `▪️ *Problema Informado:* ${order.defectDescription}\n` +
      `▪️ *Serviço Realizado:* ${order.serviceDescription}\n` +
      `▪️ *Peça Trocada:* ${order.partsReplaced || 'Nenhuma (Ajuste/Reparo elétrico)'}\n\n` +
      `👨‍🔧 *Técnico Responsável:* ${order.technicianName}\n` +
      `📋 *Atendente:* ${order.attendantName}\n` +
      `─────────────────────────\n` +
      `💰 *VALOR TOTAL:* ${formatCurrency(order.totalValue)}\n` +
      `💳 *Forma de Pagamento:* ${order.paymentMethod} (${order.paymentStatus})\n\n` +
      `🛡️ *GARANTIA CONCEDIDA:* ${order.warrantyMonths} MESES\n` +
      `⏳ *Válida até:* ${formatDate(order.warrantyEndDate)}\n` +
      `─────────────────────────\n` +
      `✍️ *Assinatura:* Registrada eletronicamente via aplicativo.\n\n` +
      `📞 *Dúvidas ou Suporte:* ${company.phone}\n` +
      `🕒 *Horário de Atendimento:* ${company.businessHours}\n` +
      `📍 *Nossa Loja:* ${company.street}, ${company.number} - ${company.city}/${company.state}\n\n` +
      `_Guarde esta mensagem como comprovante oficial de garantia._`;

    return text;
  };

  const handleSendWhatsApp = () => {
    const rawPhone = cleanNumeric(order.customerPhone);
    const text = encodeURIComponent(generateWhatsAppMessage());
    // If phone has DDD, prepend 55 for Brazil
    const destination = rawPhone.length >= 10 ? `55${rawPhone}` : '';
    const url = destination ? `https://wa.me/${destination}?text=${text}` : `https://wa.me/?text=${text}`;
    window.open(url, '_blank');
  };

  const handleCopyText = async () => {
    const text = generateWhatsAppMessage();
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSuccess(true);
      setTimeout(() => setCopiedSuccess(false), 2500);
    } catch {
      // fallback
    }
  };

  const handleDownloadPdf = () => {
    setIsGeneratingPdf(true);

    try {
      const success = downloadWarrantyPdf(order, company);
      if (success) {
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.7 },
        });
      } else {
        window.print();
      }
    } catch (err) {
      console.error('Erro ao gerar PDF:', err);
      window.print();
    } finally {
      setTimeout(() => setIsGeneratingPdf(false), 500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto print:p-0 print:bg-white print:static">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-cyan-500/30 rounded-3xl shadow-[0_0_50px_rgba(6,182,212,0.2)] overflow-hidden my-auto print:border-none print:shadow-none print:bg-white print:rounded-none">
        {/* Top App Control Bar (Hidden on print) */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-950/80 border-b border-cyan-500/20 print:hidden">
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 rounded-full bg-cyan-400 animate-ping" />
            <h3 className="font-semibold text-slate-100 text-sm tracking-wide">
              Certificado & Recibo Digital
            </h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold">
              {order.id}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Buttons Row (WhatsApp, Download PDF, Print, Copy) - Mobile friendly */}
        <div className="p-4 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center gap-2 print:hidden">
          <button
            onClick={handleSendWhatsApp}
            className="flex-1 min-w-[140px] flex items-center justify-center gap-2 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-emerald-900/30 active:scale-95 transition-all"
          >
            <Share2 className="w-4 h-4" />
            Enviar WhatsApp
          </button>

          <button
            onClick={handleDownloadPdf}
            disabled={isGeneratingPdf}
            className="flex-1 min-w-[130px] flex items-center justify-center gap-2 py-2.5 px-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-cyan-900/30 active:scale-95 transition-all disabled:opacity-50"
          >
            {isGeneratingPdf ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            Baixar PDF
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-medium active:scale-95 transition-all"
          >
            <Printer className="w-4 h-4 text-cyan-400" />
            Imprimir
          </button>

          <button
            onClick={handleCopyText}
            className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-medium active:scale-95 transition-all"
            title="Copiar texto formatado"
          >
            {copiedSuccess ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <Copy className="w-4 h-4 text-slate-400" />
            )}
            {copiedSuccess ? 'Copiado!' : 'Copiar'}
          </button>
        </div>

        {/* Printable/Exportable Document Area */}
        <div className="max-h-[75vh] overflow-y-auto p-4 sm:p-6 print:max-h-none print:overflow-visible print:p-2 bg-slate-950">
          <div
            ref={receiptRef}
            className="bg-white text-slate-900 p-6 sm:p-8 rounded-2xl shadow-xl font-sans max-w-full mx-auto print:shadow-none print:rounded-none print:p-4 text-xs sm:text-sm"
          >
            {/* Header: Company Logo, Name, Address, CNPJ, Business Hours */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b-2 border-slate-900 gap-4">
              <div className="flex items-center gap-3">
                {company.logoUrl ? (
                  <img
                    src={company.logoUrl}
                    alt={company.name}
                    className="h-14 w-14 object-contain rounded-lg border border-slate-200"
                  />
                ) : (
                  <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-cyan-600 to-indigo-700 flex items-center justify-center text-white shadow-md">
                    <Wrench className="w-6 h-6" />
                  </div>
                )}
                <div>
                  <h1 className="text-base sm:text-lg font-black tracking-tight text-slate-950 uppercase">
                    {company.name}
                  </h1>
                  <p className="text-[11px] font-medium text-slate-600">{company.slogan}</p>
                  <p className="text-[10px] text-slate-500 font-mono mt-0.5">CNPJ: {company.cnpj}</p>
                </div>
              </div>

              {/* Company contact & address badge */}
              <div className="text-left sm:text-right text-[11px] text-slate-600 sm:max-w-[240px]">
                <div className="flex items-center sm:justify-end gap-1 font-medium text-slate-800">
                  <MapPin className="w-3 h-3 text-cyan-600 shrink-0" />
                  <span>
                    {company.street}, {company.number} - {company.neighborhood}
                  </span>
                </div>
                <div className="text-[10px] text-slate-500">
                  {company.city}/{company.state} - CEP {company.cep}
                </div>
                <div className="flex items-center sm:justify-end gap-1 mt-1 text-slate-800 font-semibold">
                  <Phone className="w-3 h-3 text-emerald-600 shrink-0" />
                  <span>{company.phone}</span>
                </div>
                <div className="flex items-center sm:justify-end gap-1 text-[9px] text-slate-500 mt-0.5">
                  <Clock className="w-2.5 h-2.5 shrink-0" />
                  <span>{company.businessHours}</span>
                </div>
              </div>
            </div>

            {/* Document Title & Order Bar */}
            <div className="my-4 p-3 bg-slate-100 rounded-xl flex items-center justify-between border border-slate-300">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Certificado de Garantia & Comprovante de Serviço
                </span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-base sm:text-lg font-black font-mono text-cyan-700">
                    {order.id}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 border border-emerald-300">
                    Garantia {order.warrantyMonths} Meses
                  </span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-500 block">Emissão</span>
                <span className="font-semibold text-slate-800 text-xs">
                  {formatDateTime(order.createdAt)}
                </span>
              </div>
            </div>

            {/* Customer & Appliance Information Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
              {/* Cliente */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 mb-2 border-b border-slate-200 pb-1">
                  <User className="w-3.5 h-3.5 text-cyan-700" />
                  <span>Dados do Cliente</span>
                </div>
                <div className="space-y-1 text-xs">
                  <div>
                    <span className="text-slate-500">Nome: </span>
                    <strong className="text-slate-900">{order.customerName}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Telefone / WhatsApp: </span>
                    <strong className="text-slate-800">{order.customerPhone}</strong>
                  </div>
                  {order.customerCpf && (
                    <div>
                      <span className="text-slate-500">CPF: </span>
                      <span className="font-mono text-slate-700">{order.customerCpf}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-slate-500">Endereço: </span>
                    <span className="text-slate-800">
                      {order.street}, {order.number}
                      {order.complement ? ` (${order.complement})` : ''} - {order.neighborhood},{' '}
                      {order.city}/{order.state} - CEP: {order.cep}
                    </span>
                  </div>
                </div>
              </div>

              {/* Aparelho */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 mb-2 border-b border-slate-200 pb-1">
                  <Cpu className="w-3.5 h-3.5 text-indigo-700" />
                  <span>Equipamento & Atendimento</span>
                </div>
                <div className="space-y-1 text-xs">
                  <div>
                    <span className="text-slate-500">Eletrodoméstico: </span>
                    <strong className="text-indigo-900">{order.applianceType}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Marca / Modelo: </span>
                    <span className="font-semibold text-slate-800">
                      {order.applianceBrand} {order.applianceModel || ''}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Técnico Responsável: </span>
                    <strong className="text-slate-900">{order.technicianName}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Atendente / Recepção: </span>
                    <span className="text-slate-800">{order.attendantName}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Repair / Service / Parts Replaced */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 mb-4">
              <div className="text-xs font-bold text-slate-800 mb-2 border-b border-slate-200 pb-1">
                Discriminação dos Serviços e Peças Trocadas
              </div>
              <div className="space-y-2 text-xs">
                <div>
                  <span className="font-semibold text-slate-700">Defeito Reclamado:</span>
                  <p className="text-slate-800 bg-white p-2 rounded border border-slate-200 mt-0.5">
                    {order.defectDescription}
                  </p>
                </div>
                <div>
                  <span className="font-semibold text-slate-700">Serviço Realizado:</span>
                  <p className="text-slate-800 bg-white p-2 rounded border border-slate-200 mt-0.5">
                    {order.serviceDescription}
                  </p>
                </div>
                <div>
                  <span className="font-semibold text-slate-700">Peça(s) Trocada(s):</span>
                  <p className="text-slate-900 bg-white p-2 rounded border border-slate-200 mt-0.5 font-medium">
                    {order.partsReplaced || 'Nenhuma peça trocada - Apenas manutenção corretiva'}
                  </p>
                </div>
              </div>
            </div>

            {/* Financial Summary & Warranty Highlight Box */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-gradient-to-r from-cyan-50 to-blue-50 border-2 border-cyan-400 rounded-xl mb-4">
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-600 block">
                  Condições Financeiras
                </span>
                <div className="text-lg font-black text-slate-950 mt-0.5">
                  {formatCurrency(order.totalValue)}
                </div>
                <div className="text-xs text-slate-700 mt-1">
                  <span>Forma: </span>
                  <strong>{order.paymentMethod}</strong>
                  {order.paymentMethod === 'Cartão de Crédito' && order.installments && (
                    <span> ({order.installments}x)</span>
                  )} •{' '}
                  <span className="text-emerald-700 font-semibold">{order.paymentStatus}</span>
                </div>
              </div>

              <div className="sm:text-right border-t sm:border-t-0 sm:border-l sm:pl-4 border-cyan-200 pt-2 sm:pt-0">
                <div className="flex items-center sm:justify-end gap-1 text-cyan-900 font-bold text-xs uppercase">
                  <ShieldCheck className="w-4 h-4 text-cyan-700" />
                  <span>Cobertura de Garantia</span>
                </div>
                <div className="text-xl font-black text-cyan-800 mt-0.5">
                  {order.warrantyMonths} MESES
                </div>
                <div className="text-xs font-semibold text-slate-700 mt-1">
                  Válida até: <span className="text-cyan-900 underline">{formatDate(order.warrantyEndDate)}</span>
                </div>
              </div>
            </div>

            {/* Terms of Warranty */}
            <div className="text-[10px] text-slate-600 mb-6 bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
              <span className="font-bold text-slate-800 uppercase block mb-1">
                Termo de Garantia e Responsabilidade:
              </span>
              <p className="whitespace-pre-line leading-relaxed">{company.warrantyTerms}</p>
            </div>

            {/* Signatures Area */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2 border-t border-slate-300">
              {/* Cliente */}
              <div className="flex flex-col items-center text-center">
                <div className="h-20 w-full flex items-center justify-center bg-slate-50 border border-slate-200 rounded-lg p-1 mb-1">
                  {order.clientSignature ? (
                    <img
                      src={order.clientSignature}
                      alt="Assinatura do Cliente"
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <span className="text-[10px] text-slate-400 italic">
                      [Assinatura eletrônica na entrega]
                    </span>
                  )}
                </div>
                <div className="border-t border-slate-400 w-4/5 pt-1">
                  <p className="font-bold text-xs text-slate-900">{order.customerName}</p>
                  <p className="text-[10px] text-slate-500">Assinatura do Cliente</p>
                </div>
              </div>

              {/* Técnico */}
              <div className="flex flex-col items-center text-center">
                <div className="h-20 w-full flex items-center justify-center bg-slate-50 border border-slate-200 rounded-lg p-1 mb-1">
                  <div className="flex flex-col items-center justify-center text-slate-600">
                    <FileCheck className="w-6 h-6 text-emerald-600 mb-0.5" />
                    <span className="text-[9px] font-mono text-slate-500">
                      Autenticado Digitalmente
                    </span>
                  </div>
                </div>
                <div className="border-t border-slate-400 w-4/5 pt-1">
                  <p className="font-bold text-xs text-slate-900">{order.technicianName}</p>
                  <p className="text-[10px] text-slate-500">Técnico Autorizado</p>
                </div>
              </div>
            </div>

            {/* Footer stamp */}
            <div className="mt-6 pt-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-[9px] text-slate-400">
              <span>{company.name} • Sistema GarantiaPro Neo</span>
              <span>Documento ID: {order.id} • Autenticação SHA-256</span>
            </div>
          </div>
        </div>

        {/* Bottom bar with quick close */}
        <div className="p-3 bg-slate-950 text-center border-t border-slate-800 print:hidden">
          <button
            onClick={onClose}
            className="text-xs text-slate-400 hover:text-white px-4 py-1.5 rounded-lg transition-colors"
          >
            Fechar Janela
          </button>
        </div>
      </div>
    </div>
  );
};
