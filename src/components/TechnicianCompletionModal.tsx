import React, { useState } from 'react';
import {
  X,
  CheckCircle2,
  DollarSign,
  PenTool,
  Layers,
  CreditCard,
  QrCode,
  Copy,
  ShieldCheck,
  Banknote,
  AlertTriangle,
} from 'lucide-react';
import { WarrantyOrder, PaymentMethod, CompanySettings } from '../types';
import { calculateWarrantyEndDate, formatCurrency } from '../utils/formatters';
import { buildPixQrSvgData, generatePixPayload } from '../utils/pixGenerator';

interface TechnicianCompletionModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: WarrantyOrder;
  company: CompanySettings;
  onSave: (id: string, updates: Partial<WarrantyOrder>) => void;
}

type CompletionPayChoice = 'Pix' | 'Dinheiro' | 'Cartão' | 'Garantia';

export function TechnicianCompletionModal({
  isOpen,
  onClose,
  order,
  company,
  onSave,
}: TechnicianCompletionModalProps) {
  const initialChoice: CompletionPayChoice =
    order.paymentMethod === 'Dinheiro'
      ? 'Dinheiro'
      : order.paymentMethod === 'Cartão de Crédito' || order.paymentMethod === 'Cartão de Débito'
      ? 'Cartão'
      : 'Pix';

  const [payChoice, setPayChoice] = useState<CompletionPayChoice>(initialChoice);
  const [cardType, setCardType] = useState<'Cartão de Crédito' | 'Cartão de Débito'>(
    order.paymentMethod === 'Cartão de Débito' ? 'Cartão de Débito' : 'Cartão de Crédito'
  );
  const [totalValueInput, setTotalValueInput] = useState<string>(
    order.totalValue && order.totalValue > 0 ? String(order.totalValue) : ''
  );
  const [formData, setFormData] = useState({
    serviceDescription: order.serviceDescription || '',
    partsReplaced: order.partsReplaced || '',
    technicianNotes: order.notes || '',
    warrantyMonths: order.warrantyMonths || 3,
    warrantyStartDate: new Date().toISOString().split('T')[0],
    installments: order.installments || 1,
  });
  const [copiedPix, setCopiedPix] = useState(false);

  if (!isOpen) return null;

  const numericTotal =
    payChoice === 'Garantia' ? 0 : Math.max(0, parseFloat(totalValueInput.replace(',', '.')) || 0);

  const trimmedPixKey = (company.pixKey || '').trim();
  const pixPayload =
    payChoice === 'Pix' && numericTotal > 0 && trimmedPixKey
      ? generatePixPayload({
          pixKey: trimmedPixKey,
          merchantName: company.name || 'NEO FIX',
          merchantCity: company.pixCity || company.city || 'Brasil',
          amount: numericTotal,
          txId: order.id,
        })
      : '';
  const pixQrSvg = pixPayload ? buildPixQrSvgData(pixPayload) : null;

  const handleCopyPix = async () => {
    if (!pixPayload) return;
    try {
      await navigator.clipboard.writeText(pixPayload);
      setCopiedPix(true);
      setTimeout(() => setCopiedPix(false), 2500);
    } catch {}
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const finalMethod: PaymentMethod =
      payChoice === 'Pix'
        ? 'Pix'
        : payChoice === 'Dinheiro'
        ? 'Dinheiro'
        : payChoice === 'Cartão'
        ? cardType
        : 'Dinheiro';

    const startIso = new Date(formData.warrantyStartDate).toISOString();
    const warrantyEndDate = calculateWarrantyEndDate(startIso, formData.warrantyMonths || 3);
    const returnedIso = new Date().toISOString();

    const baseNotes = formData.technicianNotes.trim();
    const updatedNotes =
      payChoice === 'Garantia'
        ? [baseNotes, '[Garantia / Sem Custo]'].filter(Boolean).join(' • ')
        : baseNotes;

    onSave(order.id, {
      serviceDescription:
        payChoice === 'Garantia' && !formData.serviceDescription.toLowerCase().includes('garantia')
          ? `${formData.serviceDescription.trim()} (Garantia / Sem Custo)`
          : formData.serviceDescription.trim(),
      partsReplaced: formData.partsReplaced.trim() || 'Nenhuma peça substituída',
      totalValue: numericTotal,
      paymentMethod: finalMethod,
      paymentStatus: 'Pago',
      warrantyMonths: formData.warrantyMonths || 3,
      warrantyStartDate: startIso,
      warrantyEndDate,
      installments: payChoice === 'Cartão' && cardType === 'Cartão de Crédito' ? formData.installments : 1,
      attendanceStatus: 'retorno',
      completedAt: returnedIso,
      status: order.status || 'Ativa',
      notes: updatedNotes,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-lg bg-slate-900 border border-emerald-500/30 rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(16,185,129,0.2)] animate-scaleIn">
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-emerald-500/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white uppercase tracking-tight">
                DEVOLVER PARA O ATENDENTE
              </h2>
              <p className="text-xs text-emerald-400 font-mono font-semibold">
                {order.id} • {order.customerName} {(order as any).createdBy || (order as any).attendantName ? `• Criado por: ${(order as any).createdBy || (order as any).attendantName}` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 max-h-[80vh] overflow-y-auto custom-scrollbar">
          {/* Descrição do Serviço */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <PenTool className="w-3.5 h-3.5 text-emerald-400" />
              O que foi feito / Serviço realizado *
            </label>
            <textarea
              required
              value={formData.serviceDescription}
              onChange={(e) => setFormData({ ...formData, serviceDescription: e.target.value })}
              placeholder="Descreva o conserto, peças trocadas e testes realizados..."
              className="w-full px-4 py-2.5 rounded-2xl bg-slate-950 border border-slate-800 text-slate-200 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/30 transition-all min-h-[76px]"
            />
          </div>

          {/* Peças Utilizadas */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              Peças Trocadas / Utilizadas
            </label>
            <input
              type="text"
              value={formData.partsReplaced}
              onChange={(e) => setFormData({ ...formData, partsReplaced: e.target.value })}
              placeholder="Ex: Termostato, Compressor, Placa eletrônica..."
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:border-emerald-500 focus:outline-none transition-all"
            />
          </div>

          {/* Observação Técnica */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <PenTool className="w-3.5 h-3.5 text-amber-400" />
              Observação Técnica (para o Atendente)
            </label>
            <textarea
              value={formData.technicianNotes}
              onChange={(e) => setFormData({ ...formData, technicianNotes: e.target.value })}
              placeholder="Ex: Cliente solicitou nota, observações sobre peças, pagamento ou detalhes da visita..."
              className="w-full px-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:border-emerald-500 focus:outline-none transition-all min-h-[58px]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Valor Total */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                Valor Cobrado (R$) {payChoice === 'Garantia' ? '' : '*'}
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                required={payChoice !== 'Garantia'}
                disabled={payChoice === 'Garantia'}
                placeholder="0,00"
                value={payChoice === 'Garantia' ? '0.00' : totalValueInput}
                onChange={(e) => setTotalValueInput(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl bg-slate-950 border border-slate-800 text-emerald-400 text-base font-black font-mono focus:border-emerald-500 focus:outline-none transition-all disabled:opacity-50"
              />
            </div>

            {/* Garantia (Meses) */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                Garantia (Meses) *
              </label>
              <input
                type="number"
                min={0}
                required
                value={formData.warrantyMonths}
                onChange={(e) => setFormData({ ...formData, warrantyMonths: parseInt(e.target.value, 10) || 0 })}
                className="w-full px-4 py-3 rounded-2xl bg-slate-950 border border-slate-800 text-white text-base font-black font-mono focus:border-emerald-500 focus:outline-none transition-all"
              />
            </div>
          </div>

          {/* Forma de Pagamento */}
          <div className="space-y-3 p-4 rounded-2xl bg-slate-950/60 border border-slate-800">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
              Forma de Pagamento *
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPayChoice('Pix')}
                className={`py-2.5 px-3 rounded-xl border text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  payChoice === 'Pix'
                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.25)]'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <QrCode className="w-4 h-4" />
                <span>Pix</span>
              </button>

              <button
                type="button"
                onClick={() => setPayChoice('Dinheiro')}
                className={`py-2.5 px-3 rounded-xl border text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  payChoice === 'Dinheiro'
                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.25)]'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <Banknote className="w-4 h-4" />
                <span>Dinheiro</span>
              </button>

              <button
                type="button"
                onClick={() => setPayChoice('Cartão')}
                className={`py-2.5 px-3 rounded-xl border text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  payChoice === 'Cartão'
                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.25)]'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <CreditCard className="w-4 h-4" />
                <span>Cartão</span>
              </button>

              <button
                type="button"
                onClick={() => setPayChoice('Garantia')}
                className={`py-2.5 px-3 rounded-xl border text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  payChoice === 'Garantia'
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.25)]'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Garantia / Sem Custo</span>
              </button>
            </div>

            {payChoice === 'Cartão' && (
              <div className="pt-2 space-y-3 animate-fadeIn">
                <div className="grid grid-cols-2 gap-2">
                  {(['Cartão de Crédito', 'Cartão de Débito'] as const).map((ct) => (
                    <button
                      key={ct}
                      type="button"
                      onClick={() => setCardType(ct)}
                      className={`py-2 rounded-xl border text-[11px] font-bold transition-all cursor-pointer ${
                        cardType === ct
                          ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                          : 'bg-slate-900 border-slate-800 text-slate-400'
                      }`}
                    >
                      {ct}
                    </button>
                  ))}
                </div>

                {cardType === 'Cartão de Crédito' && (
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">
                      Número de Parcelas
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min="1"
                        max="12"
                        step="1"
                        value={formData.installments}
                        onChange={(e) => setFormData({ ...formData, installments: parseInt(e.target.value, 10) })}
                        className="flex-1 accent-emerald-500"
                      />
                      <span className="w-12 text-center py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold">
                        {formData.installments}x
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* QR Code Pix Gigante em Tempo Real */}
            {payChoice === 'Pix' && (
              <div className="pt-2 animate-fadeIn">
                {!trimmedPixKey ? (
                  <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/40 text-amber-300 text-xs flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>
                      Nenhuma Chave Pix cadastrada nos Dados da Empresa. Peça ao administrador para configurar a Chave Pix.
                    </span>
                  </div>
                ) : numericTotal <= 0 ? (
                  <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 text-slate-400 text-xs text-center">
                    Digite o <strong className="text-emerald-400">Valor Cobrado</strong> acima para gerar automaticamente o QR Code Pix.
                  </div>
                ) : (
                  pixQrSvg && (
                    <div className="p-4 rounded-2xl bg-white text-slate-900 border-2 border-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.25)] flex flex-col items-center text-center space-y-3">
                      <div className="flex items-center gap-1.5 text-emerald-800 font-black text-xs uppercase tracking-wider">
                        <QrCode className="w-4 h-4 text-emerald-600" />
                        <span>QR Code Pix para Pagamento</span>
                      </div>

                      <div className="text-2xl font-black text-emerald-700 font-mono">
                        {formatCurrency(numericTotal)}
                      </div>

                      <div className="p-2.5 bg-white rounded-2xl border-2 border-slate-200 shadow-inner">
                        <svg
                          viewBox={`-1 -1 ${pixQrSvg.size + 2} ${pixQrSvg.size + 2}`}
                          className="w-52 h-52 sm:w-56 sm:h-56"
                          shapeRendering="crispEdges"
                        >
                          <path d={pixQrSvg.pathD} fill="#0f172a" />
                        </svg>
                      </div>

                      <div className="w-full space-y-1.5">
                        <p className="text-xs text-slate-700">
                          Chave Pix: <strong className="font-mono text-slate-950 break-all">{trimmedPixKey}</strong>
                        </p>
                        <div className="p-2 rounded-xl bg-slate-100 border border-slate-200 text-[10px] font-mono text-slate-700 break-all text-left max-h-20 overflow-y-auto">
                          {pixPayload}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleCopyPix}
                        className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all cursor-pointer"
                      >
                        {copiedPix ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        <span>{copiedPix ? 'Código Pix Copiado!' : 'Copiar Código Pix (Copia e Cola)'}</span>
                      </button>
                    </div>
                  )
                )}
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-slate-800">
            <div className="flex flex-col gap-1.5 mb-4">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Data de Início da Garantia</label>
              <input
                type="date"
                required
                value={formData.warrantyStartDate}
                onChange={(e) => setFormData({ ...formData, warrantyStartDate: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 text-xs focus:border-emerald-500 focus:outline-none transition-all"
              />
            </div>

            <button
              type="submit"
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-black uppercase tracking-widest text-sm shadow-[0_0_30px_rgba(16,185,129,0.3)] active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <CheckCircle2 className="w-5 h-5" />
              <span>ENVIAR PARA O ATENDENTE RESPONSÁVEL</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

