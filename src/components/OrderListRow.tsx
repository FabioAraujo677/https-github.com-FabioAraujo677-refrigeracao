import React from 'react';
import {
  Calendar,
  Clock,
  Cpu,
  MapPin,
  Phone,
  User as UserIcon,
  Wrench,
  Share2,
  Printer,
  Pencil,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Send,
} from 'lucide-react';
import { WarrantyOrder } from '../types';
import { formatCurrency, formatDateWithWeekday, extractDateOnly, getLocalDateString } from '../utils/formatters';

interface OrderListRowProps {
  order: WarrantyOrder;
  onClick: () => void;
  onEdit: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
  onWhatsApp: (e: React.MouseEvent) => void;
  onReceipt: (e: React.MouseEvent) => void;
  onFinalize?: (e: React.MouseEvent) => void;
}

export const OrderListRow: React.FC<OrderListRowProps> = ({
  order,
  onClick,
  onEdit,
  onDelete,
  onWhatsApp,
  onReceipt,
  onFinalize,
}) => {
  const todayStr = getLocalDateString();
  const orderDate = extractDateOnly(order.scheduledDate || order.createdAt);
  const isToday = orderDate === todayStr;

  const isReturnedByTech = order.attendanceStatus === 'Pendente Confirmação';
  const isDone = order.attendanceStatus === 'Concluído';
  const isInField = order.attendanceStatus === 'Em campo';

  return (
    <div
      onClick={onClick}
      className={`group relative flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 sm:px-4 sm:py-2.5 rounded-xl transition-all duration-150 cursor-pointer select-none border ${
        isReturnedByTech
          ? 'bg-amber-950/20 border-amber-500/40 hover:border-amber-400 hover:bg-amber-950/30 shadow-[0_0_15px_rgba(245,158,11,0.15)]'
          : isDone
          ? 'bg-slate-900/60 border-slate-800/80 hover:border-emerald-500/40 hover:bg-slate-850/80 opacity-90 hover:opacity-100'
          : 'bg-slate-900/90 border-slate-800 hover:border-cyan-500/50 hover:bg-slate-850 shadow-sm'
      }`}
    >
      {/* LEFT: Horário, Data, OS, Aparelho & Defeito */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {/* Horário & Data */}
        <div className="shrink-0 w-20 sm:w-24 text-left">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span className="font-num font-black text-base text-white tracking-wide">
              {order.scheduledTime || '12:00'}
            </span>
          </div>
          <div className="text-xs font-medium text-slate-500 truncate">
            {formatDateWithWeekday(order.scheduledDate || order.createdAt)}
          </div>
        </div>

        {/* Separator */}
        <div className="h-7 w-px bg-slate-800 shrink-0 hidden sm:block" />

        {/* OS & Aparelho & Cliente */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`font-mono text-xs font-black px-2 py-0.5 rounded border shrink-0 ${
                order.orderType === 'agendamento'
                  ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                  : 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
              }`}
            >
              {order.id}
            </span>
            <span className="text-sm font-bold text-white truncate max-w-[180px] sm:max-w-none">
              {order.customerName}
            </span>
            <span className="text-xs font-mono text-slate-500 hidden sm:inline">
              ({order.customerPhone})
            </span>
            <span className="text-xs font-semibold text-cyan-400 bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-500/30 truncate max-w-[160px] sm:max-w-none">
              {order.applianceType}
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400 truncate mt-1">
            <span className="text-slate-300 truncate">
              {order.neighborhood ? `${order.neighborhood}${order.city ? ' - ' + order.city : ''}` : order.applianceBrand}
            </span>
            {order.defectDescription && (
              <>
                <span className="text-slate-600">•</span>
                <span className="text-slate-400 italic truncate max-w-xs">
                  "{order.defectDescription}"
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* CENTER-RIGHT: Técnico, Status & Valor */}
      <div className="flex items-center justify-between md:justify-end gap-3 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-800/60">
        {/* Técnico */}
        <div className="hidden lg:flex items-center gap-1.5 text-xs text-slate-300 w-28 shrink-0">
          <Wrench className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="truncate font-semibold text-slate-200">
            {order.technicianName || 'Não escalado'}
          </span>
        </div>

        {/* Status Pill */}
        <div className="shrink-0">
          {order.attendanceStatus === 'Pendente Confirmação' ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/50 animate-pulse">
              <AlertTriangle className="w-3 h-3 text-amber-400" />
              Devolvido p/ Atendente
            </span>
          ) : order.attendanceStatus === 'Em campo' ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/40">
              <span className="h-1.5 w-1.5 rounded-full bg-purple-400 animate-ping" />
              Em campo
            </span>
          ) : order.attendanceStatus === 'Concluído' ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/40">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              Concluído
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/40">
              <Clock className="w-3 h-3 text-amber-400" />
              Na fila
            </span>
          )}
        </div>

        {/* Valor */}
        <div className="text-right w-24 shrink-0">
          <div className="font-num font-black text-sm sm:text-base text-emerald-400 leading-tight">
            {formatCurrency(order.totalValue)}
          </div>
          <div className="text-xs text-slate-500 font-mono">
            {order.paymentMethod || 'Pix'}
          </div>
        </div>

        {/* Action Buttons (Stop Propagation to prevent opening modal) */}
        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          {/* Botão Finalizar se devolvido pelo técnico */}
          {isReturnedByTech && onFinalize && (
            <button
              onClick={onFinalize}
              className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-[11px] font-black uppercase tracking-wider shadow-[0_0_12px_rgba(168,85,247,0.35)] flex items-center gap-1 transition-all active:scale-95"
              title="Finalizar atendimento e gerar garantia"
            >
              <CheckCircle2 className="w-3 h-3" />
              <span className="hidden sm:inline">Finalizar</span>
            </button>
          )}

          {/* Botão Enviar p/ Técnico se for agendamento não concluído */}
          {order.orderType === 'agendamento' && !isDone && !isReturnedByTech && (
            <button
              onClick={onReceipt}
              className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-cyan-600/30 to-indigo-600/30 hover:from-cyan-600/50 hover:to-indigo-600/50 text-cyan-300 border border-cyan-500/40 text-[11px] font-bold flex items-center gap-1 transition-all active:scale-95"
              title={`Enviar chamado e rota para o técnico responsável (${order.technicianName})`}
            >
              <Send className="w-3 h-3 text-cyan-400" />
              <span className="hidden sm:inline">Enviar Técnico</span>
            </button>
          )}

          {/* WhatsApp */}
          <button
            onClick={onWhatsApp}
            className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-500/40 transition-all"
            title="Enviar WhatsApp"
          >
            <Share2 className="w-3.5 h-3.5" />
          </button>

          {/* Comprovante */}
          <button
            onClick={onReceipt}
            className="p-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/20 hover:border-cyan-500/40 transition-all"
            title="Ver Comprovante / PDF"
          >
            <Printer className="w-3.5 h-3.5" />
          </button>

          {/* Editar */}
          <button
            onClick={onEdit}
            className="p-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60 text-slate-300 hover:text-white hover:bg-slate-700 transition-all"
            title="Editar agendamento"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>

          {/* Excluir */}
          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg bg-slate-800/50 border border-slate-800 text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 hover:border-rose-500/30 transition-all"
            title="Excluir agendamento"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
