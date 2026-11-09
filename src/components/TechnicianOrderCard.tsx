import React from 'react';
import { 
  MapPin, 
  Phone, 
  Calendar, 
  Clock, 
  ArrowRight, 
  CheckCircle2, 
  Navigation, 
  FileText, 
  CreditCard, 
  PenTool, 
  Volume2, 
  Lock, 
  AlertCircle,
  Bell
} from 'lucide-react';
import { WarrantyOrder } from '../types';
import { formatDate, formatDateWithWeekday } from '../utils/formatters';

interface TechnicianOrderCardProps {
  order: WarrantyOrder;
  onAccept: (id: string) => void;
  onComplete: (order: WarrantyOrder) => void;
  onViewReceipt?: (order: WarrantyOrder) => void;
  onMoveToToday?: (id: string) => void;
  isLocked?: boolean;
  lockedReason?: string;
  isAlarming?: boolean;
}

export function TechnicianOrderCard({ 
  order, 
  onAccept, 
  onComplete, 
  onViewReceipt, 
  onMoveToToday,
  isLocked,
  lockedReason,
  isAlarming
}: TechnicianOrderCardProps) {
  const handleOpenMaps = (e: React.MouseEvent) => {
    e.stopPropagation();
    const address = `${order.street}, ${order.number}, ${order.neighborhood}, ${order.city}, ${order.state}`;
    const encoded = encodeURIComponent(address);
    window.open(`https://www.google.com/maps/search/?api=1&query=${encoded}`, '_blank');
  };

  const handlePhoneClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(`tel:${order.customerPhone.replace(/\D/g, '')}`, '_self');
  };

  const isAwaiting = order.attendanceStatus === 'Na fila / Aguardando';
  const isInField = order.attendanceStatus === 'Em campo';
  const isPendingConfirmation = order.attendanceStatus === 'Pendente Confirmação';
  const isCompleted = order.attendanceStatus === 'Concluído';

  return (
    <div className={`p-4 sm:p-5 rounded-3xl bg-slate-900 border shadow-xl overflow-hidden relative group transition-all ${
      isAlarming ? 'border-rose-500 ring-2 ring-rose-500 shadow-[0_0_40px_rgba(244,63,94,0.35)]' :
      isCompleted ? 'border-emerald-500/30 hover:border-emerald-500/60' :
      isPendingConfirmation ? 'border-amber-500/30 hover:border-amber-500/60' :
      isInField ? 'border-purple-500/40 hover:border-purple-500/70 shadow-[0_0_25px_rgba(168,85,247,0.15)]' :
      'border-slate-800 hover:border-cyan-500/40'
    }`}>
      {/* Status Overlay for visual context */}
      <div className={`absolute top-0 right-0 px-4 py-1.5 rounded-bl-2xl text-[10px] font-black uppercase tracking-widest border-l border-b flex items-center gap-1.5 ${
        isAlarming ? 'bg-rose-500 text-white border-rose-400 animate-pulse font-mono' :
        isAwaiting ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : 
        isInField ? 'bg-purple-500/20 text-purple-300 border-purple-500/30' : 
        isPendingConfirmation ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' :
        'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
      }`}>
        {isAlarming && <Volume2 className="w-3.5 h-3.5 animate-bounce" />}
        {isAlarming ? 'Alarme Ativo - Aceite' : isPendingConfirmation ? 'Aguardando Atendente' : order.attendanceStatus}
      </div>

      <div className="flex flex-col gap-4">
        {/* Header: Customer & Service Type */}
        <div className="flex items-start justify-between gap-2 pr-28">
          <div>
            <h3 className="text-lg font-black text-white tracking-tight leading-tight">
              {order.customerName}
            </h3>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span className="text-[11px] font-mono font-black text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/30">
                {order.id}
              </span>
              <div className="flex items-center gap-1 text-[11px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
                <Calendar className="w-3 h-3" />
                {order.scheduledDate ? formatDateWithWeekday(order.scheduledDate) : 'Sem Data'}
              </div>
              {order.applianceType && (
                <span className="text-[10px] font-bold text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700">
                  {order.applianceType}
                </span>
              )}
              {order.technicianLeadTimeAlert && order.technicianLeadTimeAlert !== 'sem_aviso' && (
                <div className="flex items-center gap-1 text-[10px] font-bold text-purple-300 bg-purple-500/15 px-2 py-0.5 rounded border border-purple-500/30">
                  <Volume2 className="w-3 h-3 text-purple-400" />
                  <span>
                    Aviso:{' '}
                    {order.technicianLeadTimeAlert === 'imediato'
                      ? 'Imediato'
                      : order.technicianLeadTimeAlert === '15m'
                      ? '15 min antes'
                      : order.technicianLeadTimeAlert === '30m'
                      ? '30 min antes'
                      : order.technicianLeadTimeAlert === '1h'
                      ? '1h antes'
                      : order.technicianLeadTimeAlert === '2h'
                      ? '2h antes'
                      : '1 dia antes'}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-1 gap-3">
          {/* Address Card */}
          <button 
            onClick={handleOpenMaps}
            className="flex items-start gap-3 p-3 rounded-2xl bg-slate-950/50 border border-slate-800 hover:border-cyan-500/50 transition-colors text-left group/addr"
          >
            <div className="mt-1 h-8 w-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shrink-0 group-hover/addr:bg-cyan-500/20">
              <MapPin className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-200 font-semibold truncate">
                {order.street}, {order.number}
              </p>
              <p className="text-[10px] text-slate-500 truncate">
                {order.neighborhood}, {order.city} - {order.complement || ''}
              </p>
              <div className="flex items-center gap-1 mt-1 text-[10px] text-cyan-400 font-bold uppercase tracking-wider">
                <Navigation className="w-3 h-3" />
                Abrir no Google Maps
              </div>
            </div>
          </button>

          <div className="flex gap-2">
            {/* Phone Button */}
            <button 
              onClick={handlePhoneClick}
              className="flex-1 flex items-center gap-2.5 p-3 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 hover:bg-emerald-500/10 transition-colors text-emerald-300"
            >
              <Phone className="w-4 h-4" />
              <div className="text-left">
                <p className="text-[9px] uppercase font-bold text-emerald-500/60 leading-none mb-0.5">WhatsApp / Celular</p>
                <p className="text-xs font-mono font-bold tracking-wider">{order.customerPhone}</p>
              </div>
            </button>

            {/* Visit Time */}
            <div className="flex-1 flex items-center gap-2.5 p-3 rounded-2xl bg-purple-500/5 border border-purple-500/20 text-purple-300">
              <Clock className="w-4 h-4" />
              <div className="text-left">
                <p className="text-[9px] uppercase font-bold text-purple-500/60 leading-none mb-0.5">Horário Agendado</p>
                <p className="text-xs font-bold">{order.scheduledTime || 'Comercial'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Problem Description */}
        <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
          <p className="text-[10px] uppercase font-black text-slate-500 tracking-widest mb-1.5 flex items-center gap-1.5">
            <span className="w-1 h-3 bg-cyan-500 rounded-full" />
            Relato do Problema
          </p>
          <p className="text-xs text-slate-300 leading-relaxed italic">
            "{order.defectDescription || 'Não informado'}"
          </p>
        </div>

        {/* If Completed / Returned: Display Resolution & Payment info */}
        {(isPendingConfirmation || isCompleted) && (
          <div className="space-y-2 pt-1">
            {order.serviceDescription && (
              <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800 text-xs text-slate-300">
                <p className="text-[10px] uppercase font-black text-cyan-400 tracking-wider mb-1 flex items-center gap-1.5">
                  <PenTool className="w-3 h-3" />
                  Serviço Realizado / O que foi trocado
                </p>
                <p className="text-slate-200">{order.serviceDescription}</p>
              </div>
            )}

            {order.totalValue !== undefined && order.totalValue > 0 && (
              <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs text-slate-300">
                    Forma: <strong className="text-emerald-300">{order.paymentMethod || 'Pix'}</strong>
                    {order.installments && order.installments > 1 ? ` (${order.installments}x)` : ''}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Valor Final:</span>
                  <span className="text-sm font-mono font-black text-emerald-300 bg-slate-950 px-2.5 py-0.5 rounded-lg border border-emerald-500/30">
                    R$ {Number(order.totalValue).toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            {isPendingConfirmation && (
              <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center gap-2.5 text-amber-300 text-xs font-semibold">
                <Clock className="w-4 h-4 shrink-0 animate-pulse text-amber-400" />
                <span>Devolvido ao atendente principal para confirmação e emissão de notinha/garantia.</span>
              </div>
            )}

            {isCompleted && (
              <div className="flex items-center justify-between gap-2 p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                <div className="flex items-center gap-2 text-emerald-300 text-xs font-bold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Atendimento Concluído & Garantia Emitida</span>
                </div>
                {onViewReceipt && (
                  <button
                    onClick={() => onViewReceipt(order)}
                    className="px-3 py-1.5 rounded-xl bg-slate-900 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/20 text-xs font-bold flex items-center gap-1.5 transition-all"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Ver Notinha
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="pt-2 flex flex-col sm:flex-row gap-2">
          {onMoveToToday && (isAwaiting || isInField) && (
            <button
              type="button"
              onClick={() => onMoveToToday(order.id)}
              className="px-4 py-3 rounded-2xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-bold text-xs flex items-center justify-center gap-1.5 transition-all shrink-0"
            >
              <Calendar className="w-3.5 h-3.5" />
              Mudar para Hoje
            </button>
          )}

          {isAwaiting && (
            isLocked ? (
              <div className="flex-1 space-y-2">
                <div className="p-3 rounded-2xl bg-slate-950/80 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2.5">
                  <Lock className="w-4 h-4 shrink-0 text-amber-400" />
                  <span className="font-semibold text-[11px] leading-tight">
                    {lockedReason || 'Você já possui uma visita em andamento. Conclua-a para liberar este agendamento.'}
                  </span>
                </div>
                <button
                  type="button"
                  disabled
                  className="w-full py-3.5 rounded-2xl bg-slate-800/80 border border-slate-700/60 text-slate-500 font-bold text-xs cursor-not-allowed flex items-center justify-center gap-2"
                  title="Finalize a visita atual para poder iniciar esta"
                >
                  <Lock className="w-4 h-4 text-slate-500" />
                  <span>Aceitar Bloqueado (Visita em Andamento)</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => onAccept(order.id)}
                className={`flex-1 py-3.5 rounded-2xl text-white font-black text-sm active:scale-95 transition-all flex items-center justify-center gap-2 ${
                  isAlarming
                    ? 'bg-gradient-to-r from-rose-600 via-amber-600 to-orange-500 hover:from-rose-500 hover:to-orange-400 shadow-[0_0_35px_rgba(244,63,94,0.45)] animate-pulse'
                    : 'bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 shadow-[0_0_20px_rgba(217,119,6,0.2)]'
                }`}
              >
                {isAlarming ? (
                  <>
                    <Volume2 className="w-4 h-4 text-white animate-bounce" />
                    <span>Aceitar Visita & Silenciar Alarme</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                ) : (
                  <>
                    <span>Aceitar Visita & Iniciar Rota</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            )
          )}

          {isInField && (
            <button
              type="button"
              onClick={() => onComplete(order)}
              className="flex-1 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-black text-sm shadow-[0_0_20px_rgba(16,185,129,0.2)] active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              Finalizar Atendimento
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
