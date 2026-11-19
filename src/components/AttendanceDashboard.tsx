import React from 'react';
import {
  Calendar,
  Clock,
  CheckCircle2,
  ChevronRight,
  Filter,
  X,
  AlertTriangle,
  CalendarDays,
  Layers,
  TrendingDown,
  TrendingUp,
  DollarSign,
  PlusCircle,
  Sparkles,
  Receipt,
  Truck,
  PieChart,
  BarChart3,
} from 'lucide-react';
import { DeliveryTask, Expense, WarrantyOrder } from '../types';
import { extractDateOnly, getLocalDateString, formatCurrency } from '../utils/formatters';

export type DashboardFilter =
  | 'faltam_hoje'
  | 'concluidos_hoje'
  | 'todos_hoje'
  | 'futuros'
  | 'pendente_confirmacao'
  | 'pagou_so_visita'
  | 'pagou_so_visita_hoje'
  | 'pago_visita'
  | 'entregas'
  | 'todos'
  | null;

export function isPaidVisitOnlyOrder(order: WarrantyOrder): boolean {
  if ((order as any).paidVisitOnly === false) {
    return false;
  }
  if ((order as any).paidVisitOnly === true || (order as any).pagouSoVisita === true) {
    return true;
  }

  const stNorm = (order.attendanceStatus || '')
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (stNorm === 'so visita' || stNorm === 'pagou so a visita') {
    return true;
  }

  const combinedText = [
    order.notes,
    order.serviceDescription,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  return (
    combinedText.includes('pagou so a visita') ||
    combinedText.includes('so a visita') ||
    combinedText.includes('apenas a visita') ||
    combinedText.includes('apenas visita') ||
    combinedText.includes('somente a visita') ||
    combinedText.includes('somente visita')
  );
}

export function getPaidVisitOnlyValue(order: WarrantyOrder): number {
  const totalValue = Number(order.totalValue || 0);
  const visitFee = Number(order.visitFee || 0);
  return totalValue > 0 ? totalValue : visitFee;
}

export function getPaidVisitOnlyDate(order: WarrantyOrder): string {
  const rawCompleted = order.completedAt || (order as any).completed_at;
  if (rawCompleted) {
    const parsed = new Date(rawCompleted);
    if (!isNaN(parsed.getTime())) {
      return getLocalDateString(parsed);
    }
    return extractDateOnly(String(rawCompleted));
  }
  const scheduledDay = order.scheduledDate ? extractDateOnly(order.scheduledDate) : '';
  if (scheduledDay) return scheduledDay;
  if (order.createdAt) {
    const parsedCreated = new Date(order.createdAt);
    if (!isNaN(parsedCreated.getTime())) {
      return getLocalDateString(parsedCreated);
    }
    return extractDateOnly(order.createdAt);
  }
  return '';
}

export function isPaidVisitOnlyToday(
  order: WarrantyOrder,
  todayStr: string = getLocalDateString()
): boolean {
  if (!isPaidVisitOnlyOrder(order)) return false;
  return getPaidVisitOnlyDate(order) === todayStr;
}

export function isPagoVisitaOrder(order: WarrantyOrder): boolean {
  const combinedText = [order.notes, order.serviceDescription]
    .filter(Boolean)
    .join(' ')
    .toUpperCase();

  if (combinedText.includes('[PAGO VISITA]')) {
    return true;
  }

  const hasVisitPayment =
    isPaidVisitOnlyOrder(order) || Number(order.visitFee || 0) > 0;

  return hasVisitPayment && order.paymentStatus === 'Pago';
}

interface AttendanceDashboardProps {
  orders: WarrantyOrder[];
  activeFilter: DashboardFilter;
  onSelectFilter: (filter: DashboardFilter) => void;
  expenses?: Expense[];
  onOpenExpenses?: (tab?: 'cadastrar' | 'lista' | 'lucro') => void;
  deliveries?: DeliveryTask[];
  onOpenDeliveries?: () => void;
  onOpenFinancialAnalysis?: () => void;
  isAdmin?: boolean;
  techReturnNotice?: {
    id: string;
    technicianName: string;
    customerName: string;
  } | null;
  onDismissReturnNotice?: () => void;
}

export const AttendanceDashboard: React.FC<AttendanceDashboardProps> = ({
  orders,
  activeFilter,
  onSelectFilter,
  expenses = [],
  onOpenExpenses,
  deliveries = [],
  onOpenDeliveries,
  onOpenFinancialAnalysis,
  isAdmin = false,
  techReturnNotice,
  onDismissReturnNotice,
}) => {
  const todayStr = getLocalDateString();

  const isToday = (dateStr?: string) => {
    if (!dateStr) return false;
    return extractDateOnly(dateStr) === todayStr;
  };

  const isFuture = (dateStr?: string) => {
    if (!dateStr) return false;
    const dateOnly = extractDateOnly(dateStr);
    return dateOnly > todayStr;
  };

  const isCompletedOrder = (o: WarrantyOrder) => {
    const st = (o.attendanceStatus || '').toLowerCase().trim();
    return st === 'concluído' || st === 'concluido' || st === 'finalizado';
  };

  // Orders matching today (either by scheduledDate or by createdAt if no scheduledDate)
  const hojeOrders = orders.filter((o) => isToday(o.scheduledDate) || (!o.scheduledDate && isToday(o.createdAt)));
  
  // 1. Quantos agendamentos falta atender hoje
  const faltamHojeOrders = hojeOrders.filter((o) => !isCompletedOrder(o));
  const faltamHojeCount = faltamHojeOrders.length;

  // 2. Quantos agendamentos foram concluídos hoje (somente vindos de Agendamento; exclui Garantias Diretas e Carnês)
  const concluidosHojeOrders = hojeOrders.filter(
    (o) =>
      o.orderType === 'agendamento' &&
      (o.applianceBrand || '').toLowerCase().trim() !== 'venda carnê' &&
      isCompletedOrder(o)
  );
  const concluidosHojeCount = concluidosHojeOrders.length;

  // 3. Total de serviços do dia (para a aba "Hoje") e Total Feitos (exclusivamente serviços concluídos/finalizados)
  const totalHojeCount = hojeOrders.length;
  const totalFeitosCount = orders.filter(isCompletedOrder).length;

  // 4. Agendamentos futuros (próximos dias)
  const futurosOrders = orders.filter((o) => isFuture(o.scheduledDate) && !isCompletedOrder(o));
  const futurosCount = futurosOrders.length;

  // 5. Devolvidos pelo técnico aguardando finalização do atendente
  const pendentesConfirmacaoCount = orders.filter((o) => {
    const st = (o.attendanceStatus || '').toLowerCase().trim();
    return (
      st === 'pendente confirmação' ||
      st === 'pendente confirmacao' ||
      st === 'retorno' ||
      st === 'devolvido ao atendente'
    );
  }).length;
  
  // 6. Entregas e Retiradas de hoje
  const hojeDeliveries = deliveries.filter(d => isToday(d.scheduledDate));
  const pendentesDeliveriesCount = hojeDeliveries.filter(d => d.status !== 'Concluído').length;

  // 7. Pagou só a visita (apenas taxa de visita)
  const pagouSoVisitaCount = orders.filter(isPaidVisitOnlyOrder).length;
  const pagouSoVisitaHojeOrders = orders.filter((o) => isPaidVisitOnlyToday(o, todayStr));
  const pagouSoVisitaHojeCount = pagouSoVisitaHojeOrders.length;
  const pagouSoVisitaHojeTotal = pagouSoVisitaHojeOrders.reduce(
    (sum, o) => sum + getPaidVisitOnlyValue(o),
    0
  );
  const pagoVisitaCount = orders.filter(isPagoVisitaOrder).length;

  const cardPad = isAdmin ? 'p-3' : 'p-4';
  const numSize = isAdmin ? 'text-2xl' : 'text-4xl';

  const handleCardClick = (filterKey: DashboardFilter) => {
    if (activeFilter === filterKey) {
      onSelectFilter('todos');
    } else {
      onSelectFilter(filterKey);
    }
  };

  const getFilterLabel = () => {
    switch (activeFilter) {
      case 'faltam_hoje':
        return 'Faltam Atender Hoje (Pendentes no Dia)';
      case 'concluidos_hoje':
        return 'Concluídos Hoje (Finalizados no Dia)';
      case 'todos_hoje':
        return 'Todos de Hoje (Total do Dia)';
      case 'futuros':
        return 'Próximos Dias (Agendamentos Futuros)';
      case 'pendente_confirmacao':
        return 'Devolvidos p/ Atendente (Aguardando Finalização)';
      case 'pagou_so_visita':
        return 'PAGOU SÓ A VISITA';
      case 'pagou_so_visita_hoje':
        return 'PAGOU SÓ A VISITA (HOJE)';
      case 'pago_visita':
        return '[PAGO VISITA]';
      case 'todos':
        return 'Histórico Geral (Todos os Registros)';
      default:
        return 'Faltam Atender Hoje';
    }
  };

  return (
    <div className="space-y-4 animate-fadeIn">
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <h2 className="text-xs font-black uppercase tracking-[0.2em] text-cyan-500 flex items-center gap-2 bg-cyan-500/5 px-4 py-2 rounded-full border border-cyan-500/10 w-fit shrink-0">
          <span className="flex h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_10px_#22d3ee] animate-pulse" />
          Operações Hoje
        </h2>

        {techReturnNotice && (
          <div className="flex flex-wrap items-center gap-2 py-1 px-2.5 text-xs rounded-lg bg-red-950/40 border border-red-500/40 text-slate-100 max-w-full">
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-600 text-white text-[10px] font-black uppercase tracking-wider shrink-0">
              <AlertTriangle className="w-3 h-3 shrink-0" />
              RETORNO P/ FINALIZAR
            </span>
            <span className="text-xs font-medium text-slate-200 truncate max-w-[260px] sm:max-w-none">
              Técnico <strong className="text-cyan-300">{techReturnNotice.technicianName}</strong> devolveu <strong className="text-emerald-300">{techReturnNotice.customerName}</strong>
            </span>
            <div className="flex items-center gap-1.5 ml-auto sm:ml-0 shrink-0">
              <button
                type="button"
                onClick={() => {
                  onSelectFilter('pendente_confirmacao');
                  onDismissReturnNotice?.();
                }}
                className="px-2 py-0.5 rounded bg-red-600 hover:bg-red-500 text-white text-[10px] font-bold transition-colors cursor-pointer"
              >
                Ver Retornos
              </button>
              <button
                type="button"
                onClick={() => onDismissReturnNotice?.()}
                className="text-slate-400 hover:text-white p-0.5 rounded hover:bg-white/10 transition-colors cursor-pointer"
                title="Dispensar aviso"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* CARDS OBJETIVOS (Compact - 5 cards lado a lado no Admin, 4 nos demais) */}
      <div
        className={
          isAdmin
            ? 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2'
            : 'grid grid-cols-2 lg:grid-cols-4 gap-3'
        }
      >
        {/* Card 1: FALTAM ATENDER HOJE */}
        <div
          onClick={() => handleCardClick('faltam_hoje')}
          className={`cursor-pointer group relative ${cardPad} rounded-2xl transition-all duration-200 select-none overflow-hidden border ${
            activeFilter === 'faltam_hoje' || activeFilter === null
              ? 'border-amber-500 bg-amber-500/5 shadow-[0_0_20px_rgba(245,158,11,0.15)] scale-[1.01]'
              : 'border-white/5 bg-white/5 hover:border-amber-500/30 hover:bg-white/[0.08]'
          }`}
        >
          <div className="flex items-center justify-between mb-1 relative z-10">
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Clock className="w-3 h-3 text-amber-500" />
              Faltam
            </span>
            <span className="flex h-1.5 w-1.5 rounded-full bg-amber-400 shadow-[0_0_5px_#f59e0b] animate-pulse" />
          </div>
          <div className={`${numSize} font-black text-amber-500 font-num leading-tight relative z-10`}>
            {faltamHojeCount}
          </div>
          <p className="text-[9px] font-bold text-slate-500 mt-1 flex items-center justify-between relative z-10">
            <span>Visitas</span>
            <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
          </p>
        </div>

        {/* Card 2: CONCLUÍDOS HOJE */}
        <div
          onClick={() => handleCardClick('concluidos_hoje')}
          className={`cursor-pointer group relative ${cardPad} rounded-2xl transition-all duration-200 select-none overflow-hidden border ${
            activeFilter === 'concluidos_hoje'
              ? 'border-emerald-500 bg-emerald-500/5 shadow-[0_0_20px_rgba(16,185,129,0.15)] scale-[1.01]'
              : 'border-white/5 bg-white/5 hover:border-emerald-500/30 hover:bg-white/[0.08]'
          }`}
        >
          <div className="flex items-center justify-between mb-1 relative z-10">
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
              Concluídos
            </span>
          </div>
          <div className={`${numSize} font-black text-emerald-500 font-num leading-tight relative z-10`}>
            {concluidosHojeCount}
          </div>
          <p className="text-[9px] font-bold text-slate-500 mt-1 flex items-center justify-between relative z-10">
            <span>Finalizados</span>
            <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
          </p>
        </div>

        {/* Card 4: AGENDAMENTOS FUTUROS */}
        <div
          onClick={() => handleCardClick('futuros')}
          className={`cursor-pointer group relative ${cardPad} rounded-2xl transition-all duration-200 select-none overflow-hidden border ${
            activeFilter === 'futuros'
              ? 'border-indigo-500 bg-indigo-500/5 shadow-[0_0_20px_rgba(99,102,241,0.15)] scale-[1.01]'
              : 'border-white/5 bg-white/5 hover:border-indigo-500/30 hover:bg-white/[0.08]'
          }`}
        >
          <div className="flex items-center justify-between mb-1 relative z-10">
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <CalendarDays className="w-3 h-3 text-indigo-400" />
              Futuros
            </span>
          </div>
          <div className={`${numSize} font-black text-indigo-400 font-num leading-tight relative z-10`}>
            {futurosCount}
          </div>
          <p className="text-[9px] font-bold text-slate-500 mt-1 flex items-center justify-between relative z-10">
            <span>Próximos</span>
            <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
          </p>
        </div>

        {/* Card 5: RETORNOS DO TÉCNICO */}
        <div
          onClick={() => handleCardClick('pendente_confirmacao')}
          className={`cursor-pointer group relative ${cardPad} rounded-2xl transition-all duration-200 select-none overflow-hidden border ${
            activeFilter === 'pendente_confirmacao'
              ? 'border-red-600 bg-red-600/5 shadow-[0_0_20px_rgba(220,38,38,0.15)] scale-[1.01]'
              : pendentesConfirmacaoCount > 0
                ? 'border-amber-500 bg-amber-500/5 animate-pulse'
                : 'border-white/5 bg-white/5 hover:border-red-600/30 hover:bg-white/[0.08]'
          }`}
        >
          <div className="flex items-center justify-between mb-1 relative z-10">
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <AlertTriangle className={`w-3 h-3 ${pendentesConfirmacaoCount > 0 ? 'text-red-500' : 'text-slate-600'}`} />
              Retornos
            </span>
            {pendentesConfirmacaoCount > 0 && (
              <span className="flex h-1.5 w-1.5 rounded-full bg-red-500 animate-ping" />
            )}
          </div>
          <div className={`${numSize} font-black font-num leading-tight relative z-10 ${pendentesConfirmacaoCount > 0 ? 'text-red-500' : 'text-slate-700'}`}>
            {pendentesConfirmacaoCount}
          </div>
          <p className="text-[9px] font-bold text-slate-500 mt-1 flex items-center justify-between relative z-10">
            <span>Confirmar</span>
            <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
          </p>
        </div>

        {/* Card 6 (SOMENTE ADMIN): SÓ VISITA (HOJE) */}
        {isAdmin && (
          <div
            onClick={() => onSelectFilter('pagou_so_visita_hoje')}
            className={`cursor-pointer group relative ${cardPad} rounded-2xl transition-all duration-200 select-none overflow-hidden border ${
              activeFilter === 'pagou_so_visita_hoje'
                ? 'border-purple-500 bg-purple-500/10 shadow-[0_0_20px_rgba(168,85,247,0.2)] scale-[1.01]'
                : 'border-white/5 bg-white/5 hover:border-purple-500/30 hover:bg-white/[0.08]'
            }`}
          >
            <div className="flex items-center justify-between mb-1 relative z-10">
              <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1 truncate">
                <DollarSign className="w-3 h-3 text-purple-400 shrink-0" />
                <span className="truncate">Só Visita (Hoje)</span>
              </span>
            </div>
            <div className={`${numSize} font-black text-purple-400 font-num leading-tight relative z-10 flex items-baseline gap-1`}>
              <span>{pagouSoVisitaHojeCount}</span>
              <span className="text-[10px] font-bold text-slate-400">
                {pagouSoVisitaHojeCount === 1 ? 'cliente' : 'clientes'}
              </span>
            </div>
            <p className="text-[10px] font-black text-emerald-400 font-num mt-1 flex items-center justify-between relative z-10">
              <span>{formatCurrency(pagouSoVisitaHojeTotal)}</span>
              <ChevronRight className="w-3 h-3 text-slate-500 group-hover:translate-x-0.5 transition-transform" />
            </p>
          </div>
        )}
      </div>

      {/* TABS DE VISUALIZAÇÃO (Compact) */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-hide flex-1">
          <button
            onClick={() => onSelectFilter('faltam_hoje')}
            className={`px-3 py-1.5 rounded-xl text-[10px] font-bold flex items-center gap-1.5 whitespace-nowrap transition-all border ${
              activeFilter === 'faltam_hoje' || activeFilter === null
                ? 'bg-amber-500 text-slate-950 border-amber-600 shadow-md'
                : 'bg-white/5 text-slate-400 hover:text-amber-300 border-white/5 hover:border-amber-500/30'
            }`}
          >
            <Clock className="w-3 h-3" />
            <span>Faltam Hoje</span>
            <span className="text-[9px] font-mono font-black opacity-60">
              {faltamHojeCount}
            </span>
          </button>

          <button
            onClick={() => onSelectFilter('concluidos_hoje')}
            className={`px-3 py-1.5 rounded-xl text-[10px] font-bold flex items-center gap-1.5 whitespace-nowrap transition-all border ${
              activeFilter === 'concluidos_hoje'
                ? 'bg-emerald-500 text-slate-950 border-emerald-600 shadow-md'
                : 'bg-white/5 text-slate-400 hover:text-emerald-300 border-white/5 hover:border-emerald-500/30'
            }`}
          >
            <CheckCircle2 className="w-3 h-3" />
            <span>Concluídos</span>
            <span className="text-[9px] font-mono font-black opacity-60">
              {concluidosHojeCount}
            </span>
          </button>

          <button
            onClick={() => onSelectFilter('todos_hoje')}
            className={`px-3 py-1.5 rounded-xl text-[10px] font-bold flex items-center gap-1.5 whitespace-nowrap transition-all border ${
              activeFilter === 'todos_hoje'
                ? 'bg-cyan-500 text-slate-950 border-cyan-600 shadow-md'
                : 'bg-white/5 text-slate-400 hover:text-cyan-300 border-white/5 hover:border-cyan-500/30'
            }`}
          >
            <Calendar className="w-3 h-3" />
            <span>Hoje</span>
            <span className="text-[9px] font-mono font-black opacity-60">
              {totalHojeCount}
            </span>
          </button>

          <button
            onClick={() => onSelectFilter('futuros')}
            className={`px-3 py-1.5 rounded-xl text-[10px] font-bold flex items-center gap-1.5 whitespace-nowrap transition-all border ${
              activeFilter === 'futuros'
                ? 'bg-indigo-500 text-white border-indigo-600 shadow-md'
                : 'bg-white/5 text-slate-400 hover:text-indigo-300 border-white/5 hover:border-indigo-500/30'
            }`}
          >
            <CalendarDays className="w-3 h-3" />
            <span>Próximos</span>
            <span className="text-[9px] font-mono font-black opacity-60">
              {futurosCount}
            </span>
          </button>

          <button
            onClick={() => onSelectFilter('todos')}
            className={`px-3 py-1.5 rounded-xl text-[10px] font-bold flex items-center gap-1.5 whitespace-nowrap transition-all border ${
              activeFilter === 'todos'
                ? 'bg-slate-700 text-white border-slate-600'
                : 'bg-white/5 text-slate-400 hover:text-slate-200 border-white/5 hover:border-white/10'
            }`}
          >
            <Layers className="w-3 h-3" />
            <span>Histórico</span>
          </button>

          <button
            onClick={() => onSelectFilter('pagou_so_visita')}
            className={`px-3 py-1.5 rounded-xl text-[10px] font-bold flex items-center gap-1.5 whitespace-nowrap transition-all border ${
              activeFilter === 'pagou_so_visita'
                ? 'bg-purple-500 text-white border-purple-600 shadow-md'
                : 'bg-white/5 text-slate-400 hover:text-purple-300 border-white/5 hover:border-purple-500/30'
            }`}
          >
            <DollarSign className="w-3 h-3" />
            <span>Pagou Só a Visita ({pagouSoVisitaCount})</span>
          </button>

          <button
            onClick={() => handleCardClick('pago_visita')}
            className={`px-3 py-1.5 rounded-full text-[10px] font-bold flex items-center gap-1.5 whitespace-nowrap transition-all border cursor-pointer ${
              activeFilter === 'pago_visita'
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.25)]'
                : 'bg-white/5 text-slate-400 hover:text-emerald-300 border-white/10 hover:border-emerald-500/30'
            }`}
          >
            <CheckCircle2
              className={`w-3 h-3 ${
                activeFilter === 'pago_visita' ? 'text-emerald-400' : 'text-slate-500'
              }`}
            />
            <span>[PAGO VISITA]</span>
            <span className="text-[9px] font-mono font-black opacity-70">
              {pagoVisitaCount}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          {onOpenDeliveries && (
            <button
              onClick={onOpenDeliveries}
              className="px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 hover:bg-amber-500/20 transition-all text-[10px] font-black uppercase flex items-center gap-1.5 active:scale-95"
            >
              <Truck className="w-3 h-3" />
              <span>Logística</span>
              {pendentesDeliveriesCount > 0 && (
                <span className="bg-amber-500 text-slate-950 px-1 rounded text-[8px]">{pendentesDeliveriesCount}</span>
              )}
            </button>
          )}

          {onOpenFinancialAnalysis && (
            <button
              onClick={onOpenFinancialAnalysis}
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white text-[10px] font-black uppercase shadow-md flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
              title="Abrir tela de relatório de entrada, saída e lucro por dia, semana, mês ou período"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Relatório & Lucro</span>
            </button>
          )}
        </div>
      </div>

      {/* Indicador de Filtro Ativo (Compact) - oculto no modo padrão Todos */}
      {activeFilter && activeFilter !== 'todos' && (
        <div className="flex items-center justify-between p-2 px-3 rounded-xl bg-cyan-950/20 border border-cyan-500/20 text-[10px] text-cyan-200 animate-fadeIn">
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
            <span>
              Filtrando por: <strong className="text-white uppercase">{getFilterLabel()}</strong>
            </span>
          </div>
          <button
            onClick={() => onSelectFilter('todos')}
            className="flex items-center gap-1 text-[9px] font-black uppercase text-cyan-400 hover:text-white px-2 py-0.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 cursor-pointer"
          >
            <X className="w-2.5 h-2.5" />
            Ver Todos
          </button>
        </div>
      )}
    </div>
  );
};
