import React, { useState } from 'react';
import { X, CheckCircle2, DollarSign, PenTool, Layers, CreditCard } from 'lucide-react';
import { WarrantyOrder, PaymentMethod } from '../types';
import { calculateWarrantyEndDate, formatDate } from '../utils/formatters';

interface TechnicianCompletionModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: WarrantyOrder;
  onSave: (id: string, updates: Partial<WarrantyOrder>) => void;
}

export function TechnicianCompletionModal({ isOpen, onClose, order, onSave }: TechnicianCompletionModalProps) {
  const [formData, setFormData] = useState({
    serviceDescription: order.serviceDescription || '',
    partsReplaced: order.partsReplaced || '',
    totalValue: order.totalValue || 0,
    paymentMethod: order.paymentMethod || 'Pix',
    paymentStatus: order.paymentStatus || 'Pago' as const,
    warrantyMonths: order.warrantyMonths || 3,
    warrantyStartDate: new Date().toISOString().split('T')[0],
    installments: order.installments || 1,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(order.id, {
      ...formData,
      warrantyStartDate: new Date(formData.warrantyStartDate).toISOString(),
      attendanceStatus: 'Pendente Confirmação',
      status: 'Ativa',
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-lg bg-slate-900 border border-emerald-500/30 rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(16,185,129,0.15)] animate-scaleIn">
        <div className="p-5 border-b border-slate-800 bg-emerald-500/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Finalizar Serviço</h2>
              <p className="text-xs text-emerald-400 font-mono font-semibold">{order.id} • {order.customerName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[75vh] overflow-y-auto custom-scrollbar">
          {/* Descrição do Serviço */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <PenTool className="w-3.5 h-3.5 text-emerald-400" />
              O que foi feito / Trocar *
            </label>
            <textarea
              required
              value={formData.serviceDescription}
              onChange={(e) => setFormData({ ...formData, serviceDescription: e.target.value })}
              placeholder="Descreva o serviço realizado e o que foi trocado..."
              className="w-full px-4 py-3 rounded-2xl bg-slate-950 border border-slate-800 text-slate-200 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/30 transition-all min-h-[80px]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Valor Total */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                Valor Final (R$) *
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={formData.totalValue}
                onChange={(e) => setFormData({ ...formData, totalValue: parseFloat(e.target.value) || 0 })}
                className="w-full px-4 py-3 rounded-2xl bg-slate-950 border border-slate-800 text-emerald-400 text-base font-black font-mono focus:border-emerald-500 focus:outline-none transition-all"
              />
            </div>

            {/* Garantia (Meses) */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                Garantia (Meses) *
              </label>
              <input
                type="number"
                min={1}
                required
                value={formData.warrantyMonths}
                onChange={(e) => setFormData({ ...formData, warrantyMonths: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-3 rounded-2xl bg-slate-950 border border-slate-800 text-white text-base font-black font-mono focus:border-emerald-500 focus:outline-none transition-all"
              />
            </div>
          </div>

          {/* Forma de Pagamento */}
          <div className="space-y-3 p-4 rounded-2xl bg-slate-950/50 border border-slate-800">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
              Forma de Pagamento *
            </label>
            <div className="grid grid-cols-2 gap-2">
              {['Pix', 'Cartão de Crédito', 'Cartão de Débito', 'Dinheiro'].map((method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => setFormData({ ...formData, paymentMethod: method as any })}
                  className={`py-2.5 rounded-xl border text-[10px] font-bold transition-all ${
                    formData.paymentMethod === method
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                      : 'bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-700'
                  }`}
                >
                  {method}
                </button>
              ))}
            </div>

            {formData.paymentMethod === 'Cartão de Crédito' && (
              <div className="pt-2 animate-fadeIn">
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Número de Parcelas</label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="1"
                    max="12"
                    step="1"
                    value={formData.installments}
                    onChange={(e) => setFormData({ ...formData, installments: parseInt(e.target.value) })}
                    className="flex-1 accent-emerald-500"
                  />
                  <span className="w-12 text-center py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold">
                    {formData.installments}x
                  </span>
                </div>
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
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-black uppercase tracking-widest text-sm shadow-[0_0_30px_rgba(16,185,129,0.3)] active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-5 h-5" />
              Devolver para Atendente
            </button>
            <p className="text-[10px] text-center text-slate-500 mt-3 italic">
              O atendente será notificado para finalizar e gerar o PDF.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
