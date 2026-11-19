import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  CalendarDays,
  FileSpreadsheet,
  Printer,
  Search,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  PieChart as PieChartIcon,
  BarChart3,
  CheckCircle2,
  AlertCircle,
  Download,
  Building2,
  ChevronRight,
  ChevronDown,
  Loader2,
  ShieldCheck,
  CreditCard,
  Layers,
  Sparkles,
  RefreshCw,
  Wallet,
  Percent,
  Wrench,
  UserCheck,
  Truck,
  PackageCheck,
  MapPin,
  Share2,
  Pencil,
  Trash2,
  Plus,
} from 'lucide-react';
import jsPDF from 'jspdf';
import { superdb } from '../lib/superdbClient';
import { packOrderDescription, unpackOrderDescription } from '../utils/supabaseService';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  Line,
  CartesianGrid,
  ComposedChart,
} from 'recharts';
import {
  CarneInstallment,
  CarneSale,
  CompanySettings,
  DeliveryTask,
  Expense,
  ExpenseCategory,
  PaymentMethod,
  WarrantyOrder,
} from '../types';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatDateWithWeekday,
  extractDateOnly,
  getLocalDateString,
  getWeekdayName,
  cleanNumeric,
} from '../utils/formatters';
import { getPaidVisitOnlyValue, isPaidVisitOnlyOrder } from './AttendanceDashboard';
import { getCarnes } from '../utils/carneStorage';
import { getDeliveries } from '../utils/storage';
import { downloadCarnePdf } from '../utils/carnePdfGenerator';

export type ReportPeriodMode = 'dia' | 'semana' | 'mes' | 'personalizado';
export type ReportSection = 'agendamentos' | 'garantia' | 'carnes' | 'entregas' | 'retiradas' | 'financeiro';

interface FinancialReportScreenProps {
  isOpen: boolean;
  onClose: () => void;
  orders: WarrantyOrder[];
  expenses: Expense[];
  company: CompanySettings;
  carnes?: CarneSale[];
  deliveries?: DeliveryTask[];
  onOpenReceipt?: (order: WarrantyOrder) => void;
  onEditOrder?: (order: WarrantyOrder) => void;
  onOrderUpdated?: (order: WarrantyOrder) => void;
  onDeleteOrder?: (orderId: string) => void;
  onEditCarne?: (carne: CarneSale) => void;
  onDeleteCarne?: (carneId: string) => void;
  onEditDelivery?: (delivery: DeliveryTask) => void;
  onDeleteDelivery?: (deliveryId: string) => void;
  onOpenExpenses?: () => void;
}

interface DailyConsolidated {
  date: string;
  formattedDate: string;
  dayOfWeek: string;
  revenue: number;
  expenses: number;
  profit: number;
  revenueCount: number;
  expenseCount: number;
  profitMargin: number;
}

export const FinancialReportScreen: React.FC<FinancialReportScreenProps> = ({
  isOpen,
  onClose,
  orders,
  expenses,
  company,
  carnes = [],
  deliveries = [],
  onOpenReceipt,
  onEditOrder,
  onOrderUpdated,
  onDeleteOrder,
  onEditCarne,
  onDeleteCarne,
  onEditDelivery,
  onDeleteDelivery,
  onOpenExpenses,
}) => {
  // Period Mode: 'dia' | 'semana' | 'mes' | 'personalizado'
  const [periodMode, setPeriodMode] = useState<ReportPeriodMode>('dia');

  // Status inline editing state
  const [statusOverrides, setStatusOverrides] = useState<Record<string, Partial<WarrantyOrder>>>({});
  const [updatingOrderIds, setUpdatingOrderIds] = useState<Record<string, boolean>>({});
  const [statusUpdateMessage, setStatusUpdateMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Today helper
  const todayStr = getLocalDateString();

  // Mode: DIA
  const [selectedDay, setSelectedDay] = useState<string>(todayStr);

  // Sempre que o modal Relatórios for aberto, garante início em Diário (Hoje) atualizado
  useEffect(() => {
    if (isOpen) {
      setPeriodMode('dia');
      setSelectedDay(getLocalDateString());
      setFinanceFilter('todos');
      setMovementTypeFilter('todas');
      setStatusOverrides({});
      setStatusUpdateMessage(null);
    }
  }, [isOpen]);

  // Mode: SEMANA
  const [selectedWeekType, setSelectedWeekType] = useState<'atual' | 'passada' | 'ultimos7'>('atual');

  // Mode: MES
  const currentYearMonth = todayStr.substring(0, 7); // "YYYY-MM"
  const [selectedMonth, setSelectedMonth] = useState<string>(currentYearMonth);

  // Mode: PERSONALIZADO (de tal a tal)
  const defaultStartDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return getLocalDateString(d);
  })();
  const [customStartDate, setCustomStartDate] = useState<string>(defaultStartDate);
  const [customEndDate, setCustomEndDate] = useState<string>(todayStr);

  // Top Section Switcher: 5 abas operacionais + Financeiro
  const [activeReportSection, setActiveReportSection] = useState<ReportSection>('financeiro');

  // Detailed Tab inside Financial Report
  const [reportTab, setReportTab] = useState<'resumo' | 'movimentacoes' | 'diario' | 'categorias'>('resumo');
  const [financeFilter, setFinanceFilter] = useState<'todos' | 'entradas' | 'saidas' | 'lucro' | 'pendentes'>('todos');
  const [movementTypeFilter, setMovementTypeFilter] = useState<'todas' | 'entradas' | 'saidas' | 'pendentes'>('todas');
  const [movementSearch, setMovementSearch] = useState<string>('');
  const [scheduleSearch, setScheduleSearch] = useState<string>('');
  const [scheduleStatusFilter, setScheduleStatusFilter] = useState<'todos' | 'concluidos' | 'pendentes' | 'so_visita'>('todos');

  const handleSelectFinanceCard = (card: 'entradas' | 'saidas' | 'lucro' | 'pendentes') => {
    const next = financeFilter === card ? 'todos' : card;
    setFinanceFilter(next);
    if (next === 'entradas') {
      setMovementTypeFilter('entradas');
      setReportTab('movimentacoes');
    } else if (next === 'saidas') {
      setMovementTypeFilter('saidas');
      setReportTab('movimentacoes');
    } else if (next === 'lucro') {
      setMovementTypeFilter('todas');
      setReportTab('movimentacoes');
    } else if (next === 'pendentes') {
      setMovementTypeFilter('pendentes');
      setReportTab('movimentacoes');
    } else {
      setMovementTypeFilter('todas');
    }
  };

  const handleSelectSection = (section: ReportSection) => {
    setActiveReportSection(section);
    setScheduleStatusFilter('todos');
    setScheduleSearch('');
  };

  // Calculate Start and End Date range based on selected period
  const { startDate, endDate, periodLabel } = useMemo(() => {
    if (periodMode === 'dia') {
      const isHoje = selectedDay === todayStr;
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const isOntem = selectedDay === getLocalDateString(yesterday);

      let label = formatDateWithWeekday(selectedDay, false);
      if (isHoje) label = `Hoje (${label})`;
      else if (isOntem) label = `Ontem (${label})`;

      return {
        startDate: selectedDay,
        endDate: selectedDay,
        periodLabel: label,
      };
    }

    if (periodMode === 'semana') {
      if (selectedWeekType === 'ultimos7') {
        const d = new Date();
        d.setDate(d.getDate() - 6);
        const start = getLocalDateString(d);
        return {
          startDate: start,
          endDate: todayStr,
          periodLabel: `Últimos 7 Dias (${formatDate(start)} até ${formatDate(todayStr)})`,
        };
      }

      if (selectedWeekType === 'atual') {
        // Current week Monday to Sunday
        const now = new Date();
        const day = now.getDay(); // 0 is Sun, 1 is Mon...
        const diffToMon = day === 0 ? -6 : 1 - day;
        const mon = new Date(now);
        mon.setDate(now.getDate() + diffToMon);
        const sun = new Date(mon);
        sun.setDate(mon.getDate() + 6);

        const start = getLocalDateString(mon);
        const end = getLocalDateString(sun);
        return {
          startDate: start,
          endDate: end,
          periodLabel: `Esta Semana (${formatDate(start)} até ${formatDate(end)})`,
        };
      }

      // Semana Passada
      const now = new Date();
      const day = now.getDay();
      const diffToMon = (day === 0 ? -6 : 1 - day) - 7;
      const mon = new Date(now);
      mon.setDate(now.getDate() + diffToMon);
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);

      const start = getLocalDateString(mon);
      const end = getLocalDateString(sun);
      return {
        startDate: start,
        endDate: end,
        periodLabel: `Semana Passada (${formatDate(start)} até ${formatDate(end)})`,
      };
    }

    if (periodMode === 'mes') {
      const [yearStr, monthStr] = selectedMonth.split('-');
      const y = parseInt(yearStr, 10);
      const m = parseInt(monthStr, 10);
      const start = `${selectedMonth}-01`;
      const lastDay = new Date(y, m, 0).getDate();
      const end = `${selectedMonth}-${String(lastDay).padStart(2, '0')}`;

      const monthNames = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
      ];
      const monthName = monthNames[m - 1] || selectedMonth;

      return {
        startDate: start,
        endDate: end,
        periodLabel: `Mês de ${monthName} de ${y} (${formatDate(start)} até ${formatDate(end)})`,
      };
    }

    // Personalizado: De tal a tal
    const sDate = customStartDate || todayStr;
    const eDate = customEndDate || todayStr;
    const finalStart = sDate <= eDate ? sDate : eDate;
    const finalEnd = sDate <= eDate ? eDate : sDate;

    return {
      startDate: finalStart,
      endDate: finalEnd,
      periodLabel: `De ${formatDate(finalStart)} até ${formatDate(finalEnd)}`,
    };
  }, [periodMode, selectedDay, selectedWeekType, selectedMonth, customStartDate, customEndDate, todayStr]);

  const getTimestampLocalDate = (val?: string): string => {
    if (!val) return '';
    const trimmed = val.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) return getLocalDateString(parsed);
    return extractDateOnly(trimmed);
  };

  const getOrderLocalDate = (o: WarrantyOrder): string => {
    if (o.orderType !== 'agendamento') {
      if (o.createdAt) return getTimestampLocalDate(o.createdAt);
      if (o.completedAt) return getTimestampLocalDate(o.completedAt);
      if (o.warrantyStartDate) {
        const raw = o.warrantyStartDate.trim();
        if (/^\d{4}-\d{2}-\d{2}T00:00:00/.test(raw)) return raw.slice(0, 10);
        return getTimestampLocalDate(raw);
      }
      if (o.scheduledDate) return extractDateOnly(o.scheduledDate);
      return '';
    }
    if (o.scheduledDate) return extractDateOnly(o.scheduledDate);
    if (o.createdAt) return getTimestampLocalDate(o.createdAt);
    if (o.warrantyStartDate) return extractDateOnly(o.warrantyStartDate);
    return '';
  };

  const isCarneLinkedOrder = (o: WarrantyOrder): boolean => {
    const brand = (o.applianceBrand || '').toLowerCase().trim();
    const defect = (o.defectDescription || '').toLowerCase().trim();
    const parts = (o.partsReplaced || '').toLowerCase().trim();
    return brand === 'venda carnê' || defect.startsWith('venda carnê') || parts.includes('instalação carnê');
  };

  const allCarnes = useMemo<CarneSale[]>(() => {
    if (!isOpen) return [];
    return carnes.length > 0 ? carnes : getCarnes();
  }, [isOpen, orders, carnes]);

  const allDeliveries = useMemo<DeliveryTask[]>(() => {
    if (!isOpen) return [];
    return deliveries.length > 0 ? deliveries : getDeliveries();
  }, [isOpen, orders, deliveries]);

  const getDeliveryLocalDate = (d: DeliveryTask): string => {
    if (d.scheduledDate) return extractDateOnly(d.scheduledDate);
    return getTimestampLocalDate(d.createdAt);
  };

  const getDeliveryValue = (d: DeliveryTask): number => {
    const rawAny = d as unknown as Record<string, unknown>;
    const directVal = Number(rawAny.totalValue ?? rawAny.value ?? rawAny.price ?? 0);
    if (!isNaN(directVal) && directVal > 0) return directVal;

    const desc = d.description || '';
    const osMatch = desc.match(/\[OS\s+([^\]]+)\]/i);
    if (osMatch?.[1]) {
      const linked = orders.find((o) => o.id === osMatch[1].trim());
      if (linked && Number(linked.totalValue || 0) > 0) return Number(linked.totalValue || 0);
    }

    const carneMatch = desc.match(/\[Carn[eê]\s+([^\]]+)\]/i);
    if (carneMatch?.[1]) {
      const linkedCarne = allCarnes.find((c) => c.id === carneMatch[1].trim());
      if (linkedCarne && Number(linkedCarne.totalValue || 0) > 0) return Number(linkedCarne.totalValue || 0);
    }

    const currencyMatch = desc.match(/R\$\s*([\d.]+(?:,\d{1,2})?|\d+(?:\.\d{1,2})?)/i);
    if (currencyMatch?.[1]) {
      const normalized = currencyMatch[1].includes(',')
        ? currencyMatch[1].replace(/\./g, '').replace(',', '.')
        : currencyMatch[1];
      const parsed = Number(normalized);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }

    return 0;
  };

  const effectiveOrders = useMemo(() => {
    if (Object.keys(statusOverrides).length === 0) return orders;
    return orders.map((o) => (statusOverrides[o.id] ? { ...o, ...statusOverrides[o.id] } : o));
  }, [orders, statusOverrides]);

  const isConcludedStatus = (status?: string): boolean => {
    const norm = (status || '').toLowerCase().trim();
    return norm === 'concluído' || norm === 'concluido' || norm === 'finalizado';
  };

  type ScheduleDropdownStatus = 'CONCLUÍDO' | 'SÓ VISITA' | 'DEVOLVIDO AO ATENDENTE';

  const getScheduleDropdownValue = (ord: WarrantyOrder): string => {
    const st = (ord.attendanceStatus || '').toLowerCase().trim();
    if (st === 'devolvido ao atendente') return 'DEVOLVIDO AO ATENDENTE';
    if (isPaidVisitOnlyOrder(ord)) return 'SÓ VISITA';
    if (isConcludedStatus(ord.attendanceStatus)) return 'CONCLUÍDO';
    if (st === 'retorno' || st === 'pendente confirmação' || st === 'pendente confirmacao') {
      return 'DEVOLVIDO AO ATENDENTE';
    }
    return ord.attendanceStatus || 'Na fila / Aguardando';
  };

  const getStatusSelectStyle = (selectedValue: string): string => {
    if (selectedValue === 'CONCLUÍDO') {
      return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30 focus:ring-emerald-500/40';
    }
    if (selectedValue === 'SÓ VISITA') {
      return 'bg-purple-500/20 text-purple-300 border-purple-500/40 hover:bg-purple-500/30 focus:ring-purple-500/40';
    }
    if (selectedValue === 'DEVOLVIDO AO ATENDENTE') {
      return 'bg-blue-500/20 text-blue-300 border-blue-500/40 hover:bg-blue-500/30 focus:ring-blue-500/40';
    }
    return 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30 focus:ring-amber-500/40';
  };

  const handleScheduleStatusChange = async (
    ord: WarrantyOrder,
    newStatus: ScheduleDropdownStatus
  ) => {
    const nextAttendanceStatus: WarrantyOrder['attendanceStatus'] =
      newStatus === 'CONCLUÍDO'
        ? 'Concluído'
        : newStatus === 'SÓ VISITA'
          ? 'SÓ VISITA'
          : 'DEVOLVIDO AO ATENDENTE';

    const nextPaidVisitOnly = newStatus === 'SÓ VISITA';
    const nextCompletedAt =
      newStatus === 'CONCLUÍDO'
        ? ord.completedAt || new Date().toISOString()
        : ord.completedAt;

    const previousSnapshot: Partial<WarrantyOrder> = {
      attendanceStatus: ord.attendanceStatus,
      completedAt: ord.completedAt,
      paidVisitOnly: ord.paidVisitOnly,
    };

    const optimisticPatch: Partial<WarrantyOrder> = {
      attendanceStatus: nextAttendanceStatus,
      completedAt: nextCompletedAt,
      paidVisitOnly: nextPaidVisitOnly,
    };

    setUpdatingOrderIds((prev) => ({ ...prev, [ord.id]: true }));
    setStatusOverrides((prev) => ({ ...prev, [ord.id]: optimisticPatch }));

    try {
      const targetId = ord.dbId || ord.id;
      const { cleanDescription, meta } = unpackOrderDescription(ord.serviceDescription || '');
      const updatedDescription = packOrderDescription(cleanDescription, {
        ...meta,
        displayId: meta.displayId || ord.id,
        attendanceStatus: nextAttendanceStatus,
        paidVisitOnly: nextPaidVisitOnly,
        ...(nextCompletedAt ? { completedAt: nextCompletedAt } : {}),
      });

      let { data: updatedRows, error } = await superdb
        .from('service_orders')
        .update({
          status: newStatus,
          description: updatedDescription,
        })
        .eq('id', targetId)
        .select('id');

      if (!error && (!updatedRows || updatedRows.length === 0)) {
        const { data: matchedRows } = await superdb
          .from('service_orders')
          .select('id, description')
          .ilike('description', `%"displayId":"${ord.id}"%`)
          .limit(1);

        if (Array.isArray(matchedRows) && matchedRows.length > 0 && matchedRows[0]?.id) {
          const resolvedRow = matchedRows[0];
          const { cleanDescription: dbClean, meta: dbMeta } = unpackOrderDescription(
            resolvedRow.description || ord.serviceDescription || ''
          );
          const resolvedPackedDesc = packOrderDescription(dbClean, {
            ...dbMeta,
            displayId: dbMeta.displayId || ord.id,
            attendanceStatus: nextAttendanceStatus,
            paidVisitOnly: nextPaidVisitOnly,
            ...(nextCompletedAt ? { completedAt: nextCompletedAt } : {}),
          });

          const retryRes = await superdb
            .from('service_orders')
            .update({
              status: newStatus,
              description: resolvedPackedDesc,
            })
            .eq('id', resolvedRow.id)
            .select('id');

          updatedRows = retryRes.data;
          error = retryRes.error;
        }
      }

      if (error) {
        throw error;
      }

      const updatedOrder: WarrantyOrder = {
        ...ord,
        ...optimisticPatch,
      };
      onOrderUpdated?.(updatedOrder);

      setStatusUpdateMessage({
        type: 'success',
        text: `Status da OS ${ord.id} atualizado para "${newStatus}".`,
      });
      setTimeout(() => setStatusUpdateMessage(null), 3500);
    } catch (err: any) {
      console.error('Erro ao atualizar status no Supabase:', err);
      setStatusOverrides((prev) => ({ ...prev, [ord.id]: previousSnapshot }));
      setStatusUpdateMessage({
        type: 'error',
        text: `Erro ao atualizar status da OS ${ord.id}: ${err?.message || 'Verifique as permissões RLS no Supabase.'}`,
      });
      setTimeout(() => setStatusUpdateMessage(null), 5000);
    } finally {
      setUpdatingOrderIds((prev) => ({ ...prev, [ord.id]: false }));
    }
  };

  // Filter Orders within [startDate, endDate] (used for Financeiro totals)
  const periodOrders = useMemo(() => {
    return effectiveOrders.filter((o) => {
      const orderDate = getOrderLocalDate(o);
      if (!orderDate) return false;
      return orderDate >= startDate && orderDate <= endDate;
    });
  }, [effectiveOrders, startDate, endDate]);

  // 1) AGENDAMENTOS (somente orderType === 'agendamento')
  const periodAgendamentos = useMemo(() => {
    return periodOrders.filter((o) => o.orderType === 'agendamento');
  }, [periodOrders]);

  const scheduleSummary = useMemo(() => {
    const total = periodAgendamentos.length;
    const completed = periodAgendamentos.filter((o) => isConcludedStatus(o.attendanceStatus)).length;
    const pending = periodAgendamentos.filter((o) => !isConcludedStatus(o.attendanceStatus)).length;
    const visitOnlyOrders = periodAgendamentos.filter(isPaidVisitOnlyOrder);
    const visitOnlyCount = visitOnlyOrders.length;
    const visitOnlyTotal = visitOnlyOrders.reduce((sum, o) => sum + getPaidVisitOnlyValue(o), 0);
    const totalBilling = periodAgendamentos.reduce((sum, o) => {
      const val = Number(o.totalValue || 0);
      if (val > 0) return sum + val;
      if (isPaidVisitOnlyOrder(o)) return sum + getPaidVisitOnlyValue(o);
      return sum;
    }, 0);

    return {
      total,
      completed,
      pending,
      visitOnlyCount,
      visitOnlyTotal,
      totalBilling,
    };
  }, [periodAgendamentos]);

  const filteredScheduleOrders = useMemo(() => {
    const q = scheduleSearch.toLowerCase().trim();
    return [...periodAgendamentos]
      .filter((o) => {
        if (scheduleStatusFilter === 'concluidos' && !isConcludedStatus(o.attendanceStatus)) return false;
        if (scheduleStatusFilter === 'pendentes' && isConcludedStatus(o.attendanceStatus)) return false;
        if (scheduleStatusFilter === 'so_visita' && !isPaidVisitOnlyOrder(o)) return false;

        if (!q) return true;
        return (
          (o.customerName || '').toLowerCase().includes(q) ||
          (o.customerPhone || '').toLowerCase().includes(q) ||
          (o.applianceType || '').toLowerCase().includes(q) ||
          (o.applianceBrand || '').toLowerCase().includes(q) ||
          (o.technicianName || '').toLowerCase().includes(q) ||
          (o.id || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const dA = getOrderLocalDate(a);
        const dB = getOrderLocalDate(b);
        if (dA !== dB) return dA.localeCompare(dB);
        return String(a.scheduledTime || '').localeCompare(String(b.scheduledTime || ''));
      });
  }, [periodAgendamentos, scheduleSearch, scheduleStatusFilter]);

  // 2) GARANTIA DIRETA (lançamentos diretos via + Nova Garantia / OS)
  const periodGarantias = useMemo(() => {
    return periodOrders.filter((o) => o.orderType !== 'agendamento' && !isCarneLinkedOrder(o));
  }, [periodOrders]);

  const garantiaSummary = useMemo(() => {
    const total = periodGarantias.length;
    const completed = periodGarantias.filter((o) => !o.attendanceStatus || o.attendanceStatus === 'Concluído').length;
    const pending = total - completed;
    const totalBilling = periodGarantias.reduce((sum, o) => sum + Number(o.totalValue || 0), 0);
    return { total, completed, pending, totalBilling };
  }, [periodGarantias]);

  const filteredGarantias = useMemo(() => {
    const q = scheduleSearch.toLowerCase().trim();
    return [...periodGarantias]
      .filter((o) => {
        const isDone = !o.attendanceStatus || o.attendanceStatus === 'Concluído';
        if (scheduleStatusFilter === 'concluidos' && !isDone) return false;
        if (scheduleStatusFilter === 'pendentes' && isDone) return false;

        if (!q) return true;
        return (
          (o.customerName || '').toLowerCase().includes(q) ||
          (o.customerPhone || '').toLowerCase().includes(q) ||
          (o.applianceType || '').toLowerCase().includes(q) ||
          (o.applianceBrand || '').toLowerCase().includes(q) ||
          (o.technicianName || '').toLowerCase().includes(q) ||
          (o.attendantName || '').toLowerCase().includes(q) ||
          (o.id || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => getOrderLocalDate(b).localeCompare(getOrderLocalDate(a)));
  }, [periodGarantias, scheduleSearch, scheduleStatusFilter]);

  // 3) CARNÊS (vendas e parcelas criadas em Venda Carnê)
  const periodCarnes = useMemo(() => {
    return allCarnes.filter((c) => {
      const cDate = getTimestampLocalDate(c.createdAt);
      if (!cDate) return false;
      return cDate >= startDate && cDate <= endDate;
    });
  }, [allCarnes, startDate, endDate]);

  const carneSummary = useMemo(() => {
    const total = periodCarnes.length;
    let paidOffCount = 0;
    let openCount = 0;
    let paidInstallmentsTotal = 0;
    let pendingInstallmentsTotal = 0;
    let paidValue = 0;
    let pendingValue = 0;
    let totalBilling = 0;

    for (const c of periodCarnes) {
      const insts = Array.isArray(c.installments) ? c.installments : [];
      const paidInsts = insts.filter((i) => i.paid);
      const pendInsts = insts.filter((i) => !i.paid);
      paidInstallmentsTotal += paidInsts.length;
      pendingInstallmentsTotal += pendInsts.length;
      paidValue += paidInsts.reduce((s, i) => s + Number(i.amount || 0), 0);
      pendingValue += pendInsts.reduce((s, i) => s + Number(i.amount || 0), 0);
      totalBilling += Number(c.totalValue || 0);
      if (insts.length > 0 && pendInsts.length === 0) paidOffCount += 1;
      else openCount += 1;
    }

    return {
      total,
      paidOffCount,
      openCount,
      paidInstallmentsTotal,
      pendingInstallmentsTotal,
      paidValue,
      pendingValue,
      totalBilling,
    };
  }, [periodCarnes]);

  const filteredCarnes = useMemo(() => {
    const q = scheduleSearch.toLowerCase().trim();
    return [...periodCarnes]
      .filter((c) => {
        const insts = Array.isArray(c.installments) ? c.installments : [];
        const isPaidOff = insts.length > 0 && insts.every((i) => i.paid);
        if (scheduleStatusFilter === 'concluidos' && !isPaidOff) return false;
        if (scheduleStatusFilter === 'pendentes' && isPaidOff) return false;

        if (!q) return true;
        return (
          (c.customerName || '').toLowerCase().includes(q) ||
          (c.customerPhone || '').toLowerCase().includes(q) ||
          (c.description || '').toLowerCase().includes(q) ||
          (c.driverName || '').toLowerCase().includes(q) ||
          (c.technicianName || '').toLowerCase().includes(q) ||
          (c.id || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => getTimestampLocalDate(b.createdAt).localeCompare(getTimestampLocalDate(a.createdAt)));
  }, [periodCarnes, scheduleSearch, scheduleStatusFilter]);

  // 4) ENTREGAS (VENDAS)
  const periodEntregas = useMemo(() => {
    return allDeliveries.filter((d) => {
      if (d.type !== 'Entrega') return false;
      const dDate = getDeliveryLocalDate(d);
      if (!dDate) return false;
      return dDate >= startDate && dDate <= endDate;
    });
  }, [allDeliveries, startDate, endDate]);

  const entregaSummary = useMemo(() => {
    const total = periodEntregas.length;
    const completed = periodEntregas.filter((d) => d.status === 'Concluído').length;
    const pending = periodEntregas.filter((d) => d.status !== 'Concluído' && d.status !== 'Cancelado').length;
    const totalBilling = periodEntregas.reduce((sum, d) => sum + getDeliveryValue(d), 0);
    return { total, completed, pending, totalBilling };
  }, [periodEntregas, orders, allCarnes]);

  const filteredEntregas = useMemo(() => {
    const q = scheduleSearch.toLowerCase().trim();
    return [...periodEntregas]
      .filter((d) => {
        if (scheduleStatusFilter === 'concluidos' && d.status !== 'Concluído') return false;
        if (scheduleStatusFilter === 'pendentes' && d.status === 'Concluído') return false;

        if (!q) return true;
        return (
          (d.customerName || '').toLowerCase().includes(q) ||
          (d.customerPhone || '').toLowerCase().includes(q) ||
          (d.description || '').toLowerCase().includes(q) ||
          (d.driverName || '').toLowerCase().includes(q) ||
          (d.street || '').toLowerCase().includes(q) ||
          (d.neighborhood || '').toLowerCase().includes(q) ||
          (d.id || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const dA = getDeliveryLocalDate(a);
        const dB = getDeliveryLocalDate(b);
        if (dA !== dB) return dA.localeCompare(dB);
        return String(a.scheduledTime || '').localeCompare(String(b.scheduledTime || ''));
      });
  }, [periodEntregas, scheduleSearch, scheduleStatusFilter]);

  // 5) RETIRADAS (COMPRAS)
  const periodRetiradas = useMemo(() => {
    return allDeliveries.filter((d) => {
      if (d.type !== 'Retirada') return false;
      const dDate = getDeliveryLocalDate(d);
      if (!dDate) return false;
      return dDate >= startDate && dDate <= endDate;
    });
  }, [allDeliveries, startDate, endDate]);

  const retiradaSummary = useMemo(() => {
    const total = periodRetiradas.length;
    const completed = periodRetiradas.filter((d) => d.status === 'Concluído').length;
    const pending = periodRetiradas.filter((d) => d.status !== 'Concluído' && d.status !== 'Cancelado').length;
    const totalBilling = periodRetiradas.reduce((sum, d) => sum + getDeliveryValue(d), 0);
    return { total, completed, pending, totalBilling };
  }, [periodRetiradas, orders, allCarnes]);

  const filteredRetiradas = useMemo(() => {
    const q = scheduleSearch.toLowerCase().trim();
    return [...periodRetiradas]
      .filter((d) => {
        if (scheduleStatusFilter === 'concluidos' && d.status !== 'Concluído') return false;
        if (scheduleStatusFilter === 'pendentes' && d.status === 'Concluído') return false;

        if (!q) return true;
        return (
          (d.customerName || '').toLowerCase().includes(q) ||
          (d.customerPhone || '').toLowerCase().includes(q) ||
          (d.description || '').toLowerCase().includes(q) ||
          (d.driverName || '').toLowerCase().includes(q) ||
          (d.street || '').toLowerCase().includes(q) ||
          (d.neighborhood || '').toLowerCase().includes(q) ||
          (d.id || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const dA = getDeliveryLocalDate(a);
        const dB = getDeliveryLocalDate(b);
        if (dA !== dB) return dA.localeCompare(dB);
        return String(a.scheduledTime || '').localeCompare(String(b.scheduledTime || ''));
      });
  }, [periodRetiradas, scheduleSearch, scheduleStatusFilter]);

  const totalFeitosCardInfo = useMemo(() => {
    if (activeReportSection === 'garantia') {
      return {
        count: garantiaSummary.completed,
        subtitle: scheduleStatusFilter === 'concluidos' ? 'Mostrando concluídas' : 'Garantias/OS no período',
        isActiveFilter: scheduleStatusFilter === 'concluidos',
        onClick: () =>
          setScheduleStatusFilter((prev) => (prev === 'concluidos' ? 'todos' : 'concluidos')),
      };
    }
    if (activeReportSection === 'carnes') {
      return {
        count: carneSummary.total,
        subtitle: scheduleStatusFilter === 'concluidos' ? 'Mostrando quitados' : 'Carnês no período',
        isActiveFilter: scheduleStatusFilter === 'concluidos',
        onClick: () =>
          setScheduleStatusFilter((prev) => (prev === 'concluidos' ? 'todos' : 'concluidos')),
      };
    }
    if (activeReportSection === 'entregas') {
      return {
        count: entregaSummary.completed,
        subtitle: scheduleStatusFilter === 'concluidos' ? 'Mostrando concluídas' : 'Entregas concluídas',
        isActiveFilter: scheduleStatusFilter === 'concluidos',
        onClick: () =>
          setScheduleStatusFilter((prev) => (prev === 'concluidos' ? 'todos' : 'concluidos')),
      };
    }
    if (activeReportSection === 'retiradas') {
      return {
        count: retiradaSummary.completed,
        subtitle: scheduleStatusFilter === 'concluidos' ? 'Mostrando concluídas' : 'Retiradas concluídas',
        isActiveFilter: scheduleStatusFilter === 'concluidos',
        onClick: () =>
          setScheduleStatusFilter((prev) => (prev === 'concluidos' ? 'todos' : 'concluidos')),
      };
    }
    if (activeReportSection === 'agendamentos') {
      return {
        count: scheduleSummary.completed,
        subtitle: scheduleStatusFilter === 'concluidos' ? 'Mostrando concluídos' : 'Concluídos no período',
        isActiveFilter: scheduleStatusFilter === 'concluidos',
        onClick: () =>
          setScheduleStatusFilter((prev) => (prev === 'concluidos' ? 'todos' : 'concluidos')),
      };
    }
    // Financeiro fallback: total concluídos gerais no período
    const allCompleted = periodOrders.filter((o) => o.attendanceStatus === 'Concluído').length;
    return {
      count: allCompleted,
      subtitle: 'Concluídos no período',
      isActiveFilter: false,
      onClick: () => {
        setActiveReportSection('agendamentos');
        setScheduleStatusFilter('concluidos');
      },
    };
  }, [
    activeReportSection,
    scheduleStatusFilter,
    scheduleSummary.completed,
    garantiaSummary.completed,
    carneSummary.total,
    entregaSummary.completed,
    retiradaSummary.completed,
    periodOrders,
  ]);

  // Filter Expenses within [startDate, endDate]
  const periodExpenses = useMemo(() => {
    return expenses.filter((e) => {
      const expenseDate = extractDateOnly(e.date || e.createdAt);
      if (!expenseDate) return false;
      return expenseDate >= startDate && expenseDate <= endDate;
    });
  }, [expenses, startDate, endDate]);

  // High-level Financial Metrics
  const totalRevenue = useMemo(() => {
    return periodOrders.reduce((acc, curr) => acc + (curr.totalValue || 0), 0);
  }, [periodOrders]);

  const totalExpenses = useMemo(() => {
    return periodExpenses.reduce((acc, curr) => acc + (curr.amount || 0), 0);
  }, [periodExpenses]);

  const netProfit = totalRevenue - totalExpenses;
  const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
  const ticketMedio = periodOrders.length > 0 ? totalRevenue / periodOrders.length : 0;

  // Number of days in the period
  const totalDaysInPeriod = useMemo(() => {
    try {
      const s = new Date(startDate);
      const e = new Date(endDate);
      const diff = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      return Math.max(1, diff);
    } catch {
      return 1;
    }
  }, [startDate, endDate]);

  const avgDailyRevenue = totalRevenue / totalDaysInPeriod;
  const avgDailyExpenses = totalExpenses / totalDaysInPeriod;
  const avgDailyProfit = netProfit / totalDaysInPeriod;

  // Pending vs Paid Orders
  const pendingOrdersRevenue = useMemo(() => {
    return periodOrders
      .filter((o) => o.paymentStatus === 'Pendente' || o.paymentStatus === 'Parcial')
      .reduce((acc, curr) => acc + (curr.totalValue || 0), 0);
  }, [periodOrders]);

  // Consolidated Daily Breakdown (Day by Day)
  const dailyConsolidated = useMemo(() => {
    const map = new Map<string, { revenue: number; expenses: number; revCount: number; expCount: number }>();

    // Seed all dates in the range if within 62 days to avoid huge empty arrays
    if (totalDaysInPeriod <= 62) {
      const [sy, sm, sd] = startDate.split('-').map(Number);
      const curr = new Date(sy, sm - 1, sd, 12, 0, 0);
      for (let i = 0; i < totalDaysInPeriod; i++) {
        const dStr = getLocalDateString(curr);
        map.set(dStr, { revenue: 0, expenses: 0, revCount: 0, expCount: 0 });
        curr.setDate(curr.getDate() + 1);
      }
    }

    // Accumulate orders
    for (const ord of periodOrders) {
      const d = getOrderLocalDate(ord);
      if (d) {
        const existing = map.get(d) || { revenue: 0, expenses: 0, revCount: 0, expCount: 0 };
        existing.revenue += ord.totalValue || 0;
        existing.revCount += 1;
        map.set(d, existing);
      }
    }

    // Accumulate expenses
    for (const exp of periodExpenses) {
      const d = extractDateOnly(exp.date || exp.createdAt);
      if (d) {
        const existing = map.get(d) || { revenue: 0, expenses: 0, revCount: 0, expCount: 0 };
        existing.expenses += exp.amount || 0;
        existing.expCount += 1;
        map.set(d, existing);
      }
    }

    const sortedDates = Array.from(map.keys()).sort();
    const result: DailyConsolidated[] = sortedDates.map((dateStr) => {
      const item = map.get(dateStr)!;
      const profit = item.revenue - item.expenses;
      const margin = item.revenue > 0 ? (profit / item.revenue) * 100 : 0;
      return {
        date: dateStr,
        formattedDate: formatDate(dateStr),
        dayOfWeek: getWeekdayName(dateStr, true),
        revenue: item.revenue,
        expenses: item.expenses,
        profit,
        revenueCount: item.revCount,
        expenseCount: item.expCount,
        profitMargin: margin,
      };
    });

    return result;
  }, [periodOrders, periodExpenses, startDate, totalDaysInPeriod]);

  // Expenses grouped by Category
  const expensesByCategory = useMemo(() => {
    const map = new Map<ExpenseCategory, number>();
    for (const exp of periodExpenses) {
      const cat = exp.category || 'Outros Custos';
      map.set(cat, (map.get(cat) || 0) + (exp.amount || 0));
    }

    const colors: Record<string, string> = {
      'Peças e Insumos': '#06b6d4', // cyan-500
      'Combustível / Deslocamento': '#f59e0b', // amber-500
      'Alimentação': '#fb923c', // orange-400
      'Ferramentas e Equipamentos': '#6366f1', // indigo-500
      'Impostos e Taxas': '#ef4444', // red-500
      'Outros Custos': '#94a3b8', // slate-400
    };

    return Array.from(map.entries())
      .map(([name, value]) => ({
        name,
        value,
        color: colors[name] || '#38bdf8',
        percentage: totalExpenses > 0 ? (value / totalExpenses) * 100 : 0,
      }))
      .sort((a, b) => b.value - a.value);
  }, [periodExpenses, totalExpenses]);

  // Revenue grouped by Payment Method
  const revenueByPaymentMethod = useMemo(() => {
    const map = new Map<PaymentMethod, number>();
    for (const ord of periodOrders) {
      const method = ord.paymentMethod || 'Pix';
      map.set(method, (map.get(method) || 0) + (ord.totalValue || 0));
    }

    const colors: Record<string, string> = {
      Pix: '#10b981', // emerald-500
      'Cartão de Crédito': '#06b6d4', // cyan-500
      'Cartão de Débito': '#3b82f6', // blue-500
      Dinheiro: '#84cc16', // lime-500
      'Boleto Bancário': '#a855f7', // purple-500
      'Transferência / TED': '#f59e0b', // amber-500
    };

    return Array.from(map.entries())
      .map(([name, value]) => ({
        name,
        value,
        color: colors[name] || '#10b981',
        percentage: totalRevenue > 0 ? (value / totalRevenue) * 100 : 0,
      }))
      .sort((a, b) => b.value - a.value);
  }, [periodOrders, totalRevenue]);

  // Combined Movements List (Entradas e Saídas cronológicas)
  interface MovementItem {
    id: string;
    type: 'entrada' | 'saida' | 'pendente';
    date: string;
    description: string;
    categoryOrAppliance: string;
    responsibleOrClient: string;
    paymentMethod: string;
    amount: number;
    statusLabel?: string;
    rawKind?: 'order' | 'expense' | 'carne_installment';
    rawItem: WarrantyOrder | Expense | { carne: CarneSale; installment: CarneInstallment };
  }

  const combinedMovements = useMemo(() => {
    const list: MovementItem[] = [];

    // Orders as Entradas
    for (const ord of periodOrders) {
      const isPaidVisit = isPaidVisitOnlyOrder(ord);
      const val =
        isPaidVisit && !(Number(ord.totalValue || 0) > 0)
          ? getPaidVisitOnlyValue(ord)
          : ord.totalValue || 0;
      list.push({
        id: ord.id,
        type: 'entrada',
        date: getOrderLocalDate(ord),
        description: `OS ${ord.id} - ${ord.serviceDescription || ord.defectDescription || 'Serviço Concluído'}`,
        categoryOrAppliance: ord.applianceType || 'Aparelho',
        responsibleOrClient: ord.customerName,
        paymentMethod: ord.paymentMethod || 'Pix',
        amount: val,
        statusLabel: ord.paymentStatus || 'Pago',
        rawKind: 'order',
        rawItem: ord,
      });
    }

    // Expenses as Saídas
    for (const exp of periodExpenses) {
      list.push({
        id: exp.id,
        type: 'saida',
        date: extractDateOnly(exp.date || exp.createdAt),
        description: exp.description,
        categoryOrAppliance: exp.category,
        responsibleOrClient: exp.createdBy || 'Empresa',
        paymentMethod: exp.paymentMethod || 'Dinheiro/Pix',
        amount: exp.amount || 0,
        rawKind: 'expense',
        rawItem: exp,
      });
    }

    // Sort descending by date, then entradas first
    list.sort((a, b) => {
      if (b.date !== a.date) return b.date.localeCompare(a.date);
      if (a.type !== b.type) return a.type === 'entrada' ? -1 : 1;
      return b.amount - a.amount;
    });

    return list;
  }, [periodOrders, periodExpenses]);

  // Entradas efetivamente recebidas no período (ordens pagas, garantias pagas, visitas pagas e parcelas de carnê quitadas)
  const receivedEntryMovements = useMemo(() => {
    const list: MovementItem[] = [];

    for (const ord of periodOrders) {
      const isPendingOrder = ord.paymentStatus === 'Pendente' || ord.paymentStatus === 'Parcial';
      if (isPendingOrder) continue;
      const isPaidVisit = isPaidVisitOnlyOrder(ord);
      const isConcluded = ord.attendanceStatus === 'Concluído';
      const isDirectWarranty = ord.orderType !== 'agendamento';
      if (!isConcluded && !isDirectWarranty && !isPaidVisit && ord.paymentStatus !== 'Pago') continue;

      const val =
        isPaidVisit && !(Number(ord.totalValue || 0) > 0)
          ? getPaidVisitOnlyValue(ord)
          : ord.totalValue || 0;

      list.push({
        id: ord.id,
        type: 'entrada',
        date: getOrderLocalDate(ord),
        description: `${isPaidVisit ? 'Visita Paga' : isDirectWarranty ? 'Garantia Direta' : 'Atendimento'} - ${ord.serviceDescription || ord.defectDescription || 'Serviço Concluído'}`,
        categoryOrAppliance: ord.applianceType || 'Aparelho',
        responsibleOrClient: ord.customerName,
        paymentMethod: ord.paymentMethod || 'Pix',
        amount: val,
        statusLabel: 'Pago',
        rawKind: 'order',
        rawItem: ord,
      });
    }

    for (const carne of allCarnes) {
      const insts = Array.isArray(carne.installments) ? carne.installments : [];
      for (const inst of insts) {
        if (!inst.paid) continue;
        const paidDate = inst.paidAt
          ? getTimestampLocalDate(inst.paidAt)
          : extractDateOnly(inst.dueDate);
        if (!paidDate || paidDate < startDate || paidDate > endDate) continue;

        list.push({
          id: `${carne.id}-P${inst.number}`,
          type: 'entrada',
          date: paidDate,
          description: `Carnê ${carne.id} - Parcela ${inst.number}/${inst.total} quitada (${carne.description || 'Venda Carnê'})`,
          categoryOrAppliance: 'Parcela Carnê',
          responsibleOrClient: carne.customerName,
          paymentMethod: 'Carnê / Parcelado',
          amount: Number(inst.amount || 0),
          statusLabel: 'Quitada',
          rawKind: 'carne_installment',
          rawItem: { carne, installment: inst },
        });
      }
    }

    list.sort((a, b) => {
      if (b.date !== a.date) return b.date.localeCompare(a.date);
      return b.amount - a.amount;
    });

    return list;
  }, [periodOrders, allCarnes, startDate, endDate]);

  // Valores a receber pendentes no período (ordens Pendente/Parcial e parcelas de carnê em aberto no período)
  const pendingReceivableMovements = useMemo(() => {
    const list: MovementItem[] = [];

    for (const ord of periodOrders) {
      if (ord.paymentStatus !== 'Pendente' && ord.paymentStatus !== 'Parcial') continue;
      list.push({
        id: ord.id,
        type: 'pendente',
        date: getOrderLocalDate(ord),
        description: `OS ${ord.id} - ${ord.serviceDescription || ord.defectDescription || 'Aguardando pagamento'}`,
        categoryOrAppliance: ord.applianceType || 'Aparelho',
        responsibleOrClient: ord.customerName,
        paymentMethod: ord.paymentMethod || 'A definir',
        amount: ord.totalValue || 0,
        statusLabel: ord.paymentStatus,
        rawKind: 'order',
        rawItem: ord,
      });
    }

    for (const carne of allCarnes) {
      const insts = Array.isArray(carne.installments) ? carne.installments : [];
      for (const inst of insts) {
        if (inst.paid) continue;
        const due = extractDateOnly(inst.dueDate);
        if (!due || due < startDate || due > endDate) continue;
        list.push({
          id: `${carne.id}-P${inst.number}`,
          type: 'pendente',
          date: due,
          description: `Carnê ${carne.id} - Parcela ${inst.number}/${inst.total} em aberto`,
          categoryOrAppliance: 'Parcela Carnê',
          responsibleOrClient: carne.customerName,
          paymentMethod: 'Carnê / Parcelado',
          amount: Number(inst.amount || 0),
          statusLabel: 'Em aberto',
          rawKind: 'carne_installment',
          rawItem: { carne, installment: inst },
        });
      }
    }

    list.sort((a, b) => {
      if (b.date !== a.date) return b.date.localeCompare(a.date);
      return b.amount - a.amount;
    });

    return list;
  }, [periodOrders, allCarnes, startDate, endDate]);

  // Filtered movements for the table
  const filteredMovements = useMemo(() => {
    const baseList =
      financeFilter === 'entradas' || movementTypeFilter === 'entradas'
        ? receivedEntryMovements
        : financeFilter === 'pendentes' || movementTypeFilter === 'pendentes'
          ? pendingReceivableMovements
          : financeFilter === 'saidas' || movementTypeFilter === 'saidas'
            ? combinedMovements.filter((m) => m.type === 'saida')
            : combinedMovements;

    return baseList.filter((m) => {
      if (movementSearch) {
        const q = movementSearch.toLowerCase().trim();
        const matches =
          m.description.toLowerCase().includes(q) ||
          m.responsibleOrClient.toLowerCase().includes(q) ||
          m.categoryOrAppliance.toLowerCase().includes(q) ||
          m.id.toLowerCase().includes(q) ||
          m.paymentMethod.toLowerCase().includes(q);
        if (!matches) return false;
      }

      return true;
    });
  }, [
    financeFilter,
    movementTypeFilter,
    receivedEntryMovements,
    pendingReceivableMovements,
    combinedMovements,
    movementSearch,
  ]);

  // Export to CSV Function (Dinâmico conforme a aba selecionada)
  const handleExportCSV = () => {
    const downloadCsv = (headers: string[], rows: (string | number)[][], filename: string) => {
      const csvContent =
        '\uFEFF' +
        headers.join(';') +
        '\n' +
        rows.map((r) => r.join(';')).join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    };

    const esc = (v?: string) => `"${String(v || '').replace(/"/g, '""')}"`;

    if (activeReportSection === 'agendamentos') {
      const headers = ['Data', 'Hora', 'OS / ID', 'Cliente', 'Telefone', 'Aparelho', 'Técnico', 'Status', 'Valor (R$)'];
      const rows: (string | number)[][] = filteredScheduleOrders.map((ord) => {
        const isVisitOnly = isPaidVisitOnlyOrder(ord);
        const val = isVisitOnly ? getPaidVisitOnlyValue(ord) : Number(ord.totalValue || 0);
        const statusStr = isVisitOnly ? 'Só Visita' : ord.attendanceStatus || 'Na fila';
        return [
          formatDate(getOrderLocalDate(ord)),
          ord.scheduledTime || '-',
          ord.id,
          esc(ord.customerName),
          esc(ord.customerPhone),
          esc([ord.applianceType, ord.applianceBrand].filter(Boolean).join(' ')),
          esc(ord.technicianName || 'Não atribuído'),
          esc(statusStr),
          val.toFixed(2),
        ];
      });
      const sumVal = filteredScheduleOrders.reduce((s, o) => s + (isPaidVisitOnlyOrder(o) ? getPaidVisitOnlyValue(o) : Number(o.totalValue || 0)), 0);
      rows.push([], ['--- RESUMO AGENDAMENTOS ---'], ['Período:', esc(periodLabel)], ['Total Exibido:', filteredScheduleOrders.length], ['Concluídos:', scheduleSummary.completed], ['Valor Total (R$):', sumVal.toFixed(2)]);
      downloadCsv(headers, rows, `relatorio-agendamentos-${startDate}-a-${endDate}.csv`);
      return;
    }

    if (activeReportSection === 'garantia') {
      const headers = ['Data', 'OS / ID', 'Cliente', 'Telefone', 'Aparelho', 'Serviço', 'Atendente / Técnico', 'Garantia (Meses)', 'Status', 'Valor (R$)'];
      const rows: (string | number)[][] = filteredGarantias.map((ord) => [
        formatDate(getOrderLocalDate(ord)),
        ord.id,
        esc(ord.customerName),
        esc(ord.customerPhone),
        esc([ord.applianceType, ord.applianceBrand].filter(Boolean).join(' ')),
        esc(ord.serviceDescription || ord.defectDescription || '-'),
        esc(ord.technicianName || ord.attendantName || '-'),
        ord.warrantyMonths || 0,
        esc(ord.attendanceStatus || 'Concluído'),
        Number(ord.totalValue || 0).toFixed(2),
      ]);
      const sumVal = filteredGarantias.reduce((s, o) => s + Number(o.totalValue || 0), 0);
      rows.push([], ['--- RESUMO GARANTIA DIRETA ---'], ['Período:', esc(periodLabel)], ['Total Exibido:', filteredGarantias.length], ['Concluídas:', garantiaSummary.completed], ['Valor Total (R$):', sumVal.toFixed(2)]);
      downloadCsv(headers, rows, `relatorio-garantia-direta-${startDate}-a-${endDate}.csv`);
      return;
    }

    if (activeReportSection === 'carnes') {
      const headers = ['Data', 'ID Carnê', 'Cliente', 'Telefone', 'Aparelho / Descrição', 'Parcelas Pagas', 'Parcelas Pendentes', 'Total Parcelas', 'Valor Pago (R$)', 'Valor Pendente (R$)', 'Valor Total (R$)', 'Status'];
      const rows: (string | number)[][] = filteredCarnes.map((c) => {
        const insts = Array.isArray(c.installments) ? c.installments : [];
        const paidInsts = insts.filter((i) => i.paid);
        const pendInsts = insts.filter((i) => !i.paid);
        const paidVal = paidInsts.reduce((s, i) => s + Number(i.amount || 0), 0);
        const pendVal = pendInsts.reduce((s, i) => s + Number(i.amount || 0), 0);
        const isPaidOff = insts.length > 0 && pendInsts.length === 0;
        return [
          formatDate(getTimestampLocalDate(c.createdAt)),
          c.id,
          esc(c.customerName),
          esc(c.customerPhone),
          esc(c.description),
          paidInsts.length,
          pendInsts.length,
          insts.length || c.installmentsCount || 0,
          paidVal.toFixed(2),
          pendVal.toFixed(2),
          Number(c.totalValue || 0).toFixed(2),
          isPaidOff ? 'Quitado' : 'Em Aberto',
        ];
      });
      const sumVal = filteredCarnes.reduce((s, c) => s + Number(c.totalValue || 0), 0);
      rows.push([], ['--- RESUMO CARNÊS ---'], ['Período:', esc(periodLabel)], ['Total Exibido:', filteredCarnes.length], ['Valor Total Vendido (R$):', sumVal.toFixed(2)]);
      downloadCsv(headers, rows, `relatorio-carnes-${startDate}-a-${endDate}.csv`);
      return;
    }

    if (activeReportSection === 'entregas' || activeReportSection === 'retiradas') {
      const isEntrega = activeReportSection === 'entregas';
      const list = isEntrega ? filteredEntregas : filteredRetiradas;
      const summary = isEntrega ? entregaSummary : retiradaSummary;
      const headers = ['Data', 'Hora', 'ID', isEntrega ? 'Cliente' : 'Fornecedor / Cliente', 'Telefone', 'Descrição / Aparelho', 'Endereço', 'Motorista', 'Status', 'Valor (R$)'];
      const rows: (string | number)[][] = list.map((d) => {
        const addr = [d.street, d.number, d.neighborhood, d.city].filter(Boolean).join(', ');
        return [
          formatDate(getDeliveryLocalDate(d)),
          d.scheduledTime || '-',
          d.id,
          esc(d.customerName),
          esc(d.customerPhone),
          esc(d.description),
          esc(addr),
          esc(d.driverName),
          esc(d.status),
          getDeliveryValue(d).toFixed(2),
        ];
      });
      const sumVal = list.reduce((s, d) => s + getDeliveryValue(d), 0);
      rows.push(
        [],
        [isEntrega ? '--- RESUMO ENTREGAS (VENDAS) ---' : '--- RESUMO RETIRADAS (COMPRAS) ---'],
        ['Período:', esc(periodLabel)],
        ['Total Exibido:', list.length],
        ['Concluídas:', summary.completed],
        ['Valor Total (R$):', sumVal.toFixed(2)]
      );
      downloadCsv(headers, rows, `relatorio-${activeReportSection}-${startDate}-a-${endDate}.csv`);
      return;
    }

    // Aba Financeiro (Movimentações)
    const headers = [
      'Data',
      'Tipo (Entrada/Saída)',
      'Identificador',
      'Descrição',
      'Categoria / Equipamento',
      'Cliente / Responsável',
      'Forma de Pagamento',
      'Valor (R$)',
    ];

    const rows: (string | number)[][] = combinedMovements.map((m) => [
      formatDate(m.date),
      m.type === 'entrada' ? 'ENTRADA' : 'SAÍDA',
      m.id,
      esc(m.description),
      esc(m.categoryOrAppliance),
      esc(m.responsibleOrClient),
      esc(m.paymentMethod),
      m.type === 'entrada' ? m.amount.toFixed(2) : (-m.amount).toFixed(2),
    ]);

    rows.push([]);
    rows.push(['--- RESUMO DO PERÍODO ---']);
    rows.push(['Período:', esc(periodLabel)]);
    rows.push(['Total de Entradas (Receitas):', totalRevenue.toFixed(2)]);
    rows.push(['Total de Saídas (Despesas):', totalExpenses.toFixed(2)]);
    rows.push(['Lucro Líquido Real:', netProfit.toFixed(2)]);
    rows.push(['Margem de Lucro (%):', `${profitMargin.toFixed(1)}%`]);

    downloadCsv(headers, rows, `relatorio-financeiro-${startDate}-a-${endDate}.csv`);
  };

  const handleDownloadActiveTabPdf = () => {
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 12;
      const contentWidth = pageWidth - margin * 2;
      let y = margin;

      const tabTitleMap: Record<ReportSection, string> = {
        agendamentos: 'RELATÓRIO DE AGENDAMENTOS',
        garantia: 'RELATÓRIO DE GARANTIA DIRETA',
        carnes: 'RELATÓRIO DE CARNÊS',
        entregas: 'RELATÓRIO DE ENTREGAS (VENDAS)',
        retiradas: 'RELATÓRIO DE RETIRADAS (COMPRAS)',
        financeiro: 'RELATÓRIO FINANCEIRO',
      };

      const drawHeader = () => {
        doc.setFillColor(15, 23, 42);
        doc.roundedRect(margin, y, contentWidth, 24, 2.5, 2.5, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.text((company.name || 'NEO FIX').toUpperCase(), margin + 4, y + 7.5);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(
          `CNPJ: ${company.cnpj || '-'}  |  Tel: ${company.phone || '-'}  |  Emitido em: ${formatDateTime(new Date().toISOString())}`,
          margin + 4,
          y + 13
        );

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(56, 189, 248);
        doc.text(`${tabTitleMap[activeReportSection]}  •  ${periodLabel}`, margin + 4, y + 19.5);
        y += 28;
      };

      drawHeader();

      let summaryBoxes: { label: string; value: string; color: [number, number, number] }[] = [];
      let colLabels: string[] = [];
      let colWidths: number[] = [];
      let rowsData: string[][] = [];

      if (activeReportSection === 'agendamentos') {
        const sumVal = filteredScheduleOrders.reduce((s, o) => s + (isPaidVisitOnlyOrder(o) ? getPaidVisitOnlyValue(o) : Number(o.totalValue || 0)), 0);
        summaryBoxes = [
          { label: 'TOTAL AGENDADOS', value: String(scheduleSummary.total), color: [15, 23, 42] },
          { label: 'CONCLUÍDOS', value: String(scheduleSummary.completed), color: [6, 95, 70] },
          { label: 'PENDENTES', value: String(scheduleSummary.pending), color: [180, 83, 9] },
          { label: `SÓ VISITA (${scheduleSummary.visitOnlyCount}) / TOTAL`, value: formatCurrency(sumVal), color: [107, 33, 168] },
        ];
        colLabels = ['DATA', 'HORA', 'CLIENTE', 'APARELHO', 'TÉCNICO', 'STATUS', 'VALOR'];
        colWidths = [20, 14, 46, 36, 28, 24, 18];
        rowsData = filteredScheduleOrders.map((ord) => {
          const isVisitOnly = isPaidVisitOnlyOrder(ord);
          const amountVal = isVisitOnly ? getPaidVisitOnlyValue(ord) : Number(ord.totalValue || 0);
          return [
            formatDate(getOrderLocalDate(ord)),
            (ord.scheduledTime || '-').slice(0, 8),
            (ord.customerName || 'Cliente').slice(0, 24),
            [ord.applianceType, ord.applianceBrand].filter(Boolean).join(' ').slice(0, 20) || '-',
            (ord.technicianName || '-').slice(0, 15),
            isVisitOnly ? 'Só Visita' : (ord.attendanceStatus || 'Na fila').slice(0, 14),
            formatCurrency(amountVal),
          ];
        });
      } else if (activeReportSection === 'garantia') {
        const sumVal = filteredGarantias.reduce((s, o) => s + Number(o.totalValue || 0), 0);
        summaryBoxes = [
          { label: 'TOTAL GARANTIAS', value: String(garantiaSummary.total), color: [15, 23, 42] },
          { label: 'CONCLUÍDAS', value: String(garantiaSummary.completed), color: [6, 95, 70] },
          { label: 'PENDENTES', value: String(garantiaSummary.pending), color: [180, 83, 9] },
          { label: 'FATURAMENTO TOTAL', value: formatCurrency(sumVal), color: [8, 145, 178] },
        ];
        colLabels = ['DATA', 'OS', 'CLIENTE', 'APARELHO', 'ATEND./TÉC.', 'STATUS', 'VALOR'];
        colWidths = [20, 22, 42, 36, 28, 20, 18];
        rowsData = filteredGarantias.map((ord) => [
          formatDate(getOrderLocalDate(ord)),
          (ord.id || '-').slice(0, 14),
          (ord.customerName || 'Cliente').slice(0, 22),
          [ord.applianceType, ord.applianceBrand].filter(Boolean).join(' ').slice(0, 20) || '-',
          (ord.technicianName || ord.attendantName || '-').slice(0, 15),
          (ord.attendanceStatus || 'Concluído').slice(0, 12),
          formatCurrency(Number(ord.totalValue || 0)),
        ]);
      } else if (activeReportSection === 'carnes') {
        const sumVal = filteredCarnes.reduce((s, c) => s + Number(c.totalValue || 0), 0);
        summaryBoxes = [
          { label: 'TOTAL CARNÊS', value: String(carneSummary.total), color: [15, 23, 42] },
          { label: 'PARCELAS PAGAS', value: `${carneSummary.paidInstallmentsTotal} (${formatCurrency(carneSummary.paidValue)})`, color: [6, 95, 70] },
          { label: 'PARC. PENDENTES', value: `${carneSummary.pendingInstallmentsTotal} (${formatCurrency(carneSummary.pendingValue)})`, color: [180, 83, 9] },
          { label: 'TOTAL VENDIDO', value: formatCurrency(sumVal), color: [107, 33, 168] },
        ];
        colLabels = ['DATA', 'CLIENTE', 'APARELHO / DESC.', 'PAGAS', 'PEND.', 'STATUS', 'VALOR'];
        colWidths = [20, 44, 52, 16, 16, 20, 18];
        rowsData = filteredCarnes.map((c) => {
          const insts = Array.isArray(c.installments) ? c.installments : [];
          const paidC = insts.filter((i) => i.paid).length;
          const pendC = insts.filter((i) => !i.paid).length;
          const isPaidOff = insts.length > 0 && pendC === 0;
          return [
            formatDate(getTimestampLocalDate(c.createdAt)),
            (c.customerName || 'Cliente').slice(0, 23),
            (c.description || '-').slice(0, 28),
            String(paidC),
            String(pendC),
            isPaidOff ? 'Quitado' : 'Em Aberto',
            formatCurrency(Number(c.totalValue || 0)),
          ];
        });
      } else {
        const isEntrega = activeReportSection === 'entregas';
        const list = isEntrega ? filteredEntregas : filteredRetiradas;
        const summary = isEntrega ? entregaSummary : retiradaSummary;
        const sumVal = list.reduce((s, d) => s + getDeliveryValue(d), 0);
        summaryBoxes = [
          { label: isEntrega ? 'TOTAL ENTREGAS' : 'TOTAL RETIRADAS', value: String(summary.total), color: [15, 23, 42] },
          { label: 'CONCLUÍDAS', value: String(summary.completed), color: [6, 95, 70] },
          { label: 'PENDENTES / ROTA', value: String(summary.pending), color: [180, 83, 9] },
          { label: 'VALOR TOTAL', value: formatCurrency(sumVal), color: [8, 145, 178] },
        ];
        colLabels = ['DATA', isEntrega ? 'CLIENTE' : 'FORNECEDOR', 'DESCRIÇÃO', 'ENDEREÇO', 'MOTORISTA', 'STATUS', 'VALOR'];
        colWidths = [18, 34, 40, 38, 22, 16, 18];
        rowsData = list.map((d) => [
          formatDate(getDeliveryLocalDate(d)),
          (d.customerName || '-').slice(0, 18),
          (d.description || '-').slice(0, 22),
          [d.street, d.number, d.neighborhood].filter(Boolean).join(', ').slice(0, 22) || '-',
          (d.driverName || '-').slice(0, 12),
          (d.status || '-').slice(0, 10),
          formatCurrency(getDeliveryValue(d)),
        ]);
      }

      const boxW = (contentWidth - 6) / 4;
      summaryBoxes.forEach((box, idx) => {
        const bx = margin + idx * (boxW + 2);
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(203, 213, 225);
        doc.roundedRect(bx, y, boxW, 14, 1.5, 1.5, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6);
        doc.setTextColor(100, 116, 139);
        doc.text(box.label, bx + 2.5, y + 4.8);

        doc.setFontSize(9);
        doc.setTextColor(box.color[0], box.color[1], box.color[2]);
        doc.text(box.value, bx + 2.5, y + 11);
      });

      y += 18;

      const drawTableHeader = () => {
        doc.setFillColor(226, 232, 240);
        doc.rect(margin, y, contentWidth, 7, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.8);
        doc.setTextColor(15, 23, 42);
        let xCursor = margin + 2;
        colLabels.forEach((lbl, idx) => {
          if (idx === colLabels.length - 1) {
            doc.text(lbl, margin + contentWidth - 2, y + 4.8, { align: 'right' });
          } else {
            doc.text(lbl, xCursor, y + 4.8);
          }
          xCursor += colWidths[idx];
        });
        y += 8.5;
      };

      drawTableHeader();

      if (rowsData.length === 0) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);
        doc.text('Nenhum registro encontrado no período selecionado.', margin + 4, y + 6);
      } else {
        rowsData.forEach((row, idx) => {
          if (y > pageHeight - 18) {
            doc.addPage();
            y = margin;
            drawTableHeader();
          }

          if (idx % 2 === 0) {
            doc.setFillColor(248, 250, 252);
            doc.rect(margin, y - 3.5, contentWidth, 6.5, 'F');
          }

          doc.setFontSize(6.6);
          doc.setTextColor(15, 23, 42);
          let xCursor = margin + 2;
          row.forEach((cell, cIdx) => {
            doc.setFont('helvetica', cIdx === 1 || cIdx === row.length - 1 ? 'bold' : 'normal');
            if (cIdx === row.length - 1) {
              doc.text(cell, margin + contentWidth - 2, y + 1, { align: 'right' });
            } else {
              doc.text(cell, xCursor, y + 1);
            }
            xCursor += colWidths[cIdx];
          });

          y += 6.5;
        });
      }

      const filename = `relatorio-${activeReportSection}-${startDate}-a-${endDate}.pdf`;
      try {
        doc.save(filename);
      } catch {
        const blob = doc.output('blob');
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 1500);
      }
    } catch (err) {
      console.error('Erro ao gerar PDF do relatório:', err);
      window.print();
    }
  };

  const handlePrint = () => {
    if (activeReportSection !== 'financeiro') {
      handleDownloadActiveTabPdf();
      return;
    }
    window.print();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn overflow-y-auto">
      <div className="relative w-full max-w-7xl bg-[#0d1017] border border-cyan-500/25 rounded-3xl shadow-[0_0_80px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col my-auto max-h-[96vh]">
        {/* Glow corner decorations */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

        {/* TOP BAR: Header & Quick Actions */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-6 py-4 bg-[#111622] border-b border-white/5 shrink-0 z-10">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-gradient-to-tr from-cyan-500 to-emerald-500 flex items-center justify-center text-slate-950 font-black shadow-[0_0_20px_rgba(6,182,212,0.4)] shrink-0">
              <BarChart3 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black text-white tracking-tight font-tech">
                  Relatório Financeiro: Entrada, Saída & Lucro
                </h2>
                <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-black uppercase tracking-wider">
                  Fluxo Real
                </span>
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                <span>{company.name}</span>
                <span>•</span>
                <span className="text-cyan-400 font-medium">{periodLabel}</span>
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button
              onClick={handleExportCSV}
              className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700/80 hover:border-emerald-500/50 hover:bg-emerald-500/10 text-slate-200 hover:text-emerald-300 text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 shadow-sm"
              title="Baixar planilha compatível com Excel"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              <span>Exportar Excel (CSV)</span>
            </button>

            <button
              onClick={handlePrint}
              className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700/80 hover:border-cyan-500/50 hover:bg-cyan-500/10 text-slate-200 hover:text-cyan-300 text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 shadow-sm"
              title="Imprimir relatório completo"
            >
              <Printer className="w-4 h-4 text-cyan-400" />
              <span>Imprimir</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-all active:scale-90"
              title="Fechar tela de relatório"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* TOP SECTION SWITCHER: 5 Sub-abas Operacionais + Financeiro */}
        <div className="bg-[#0e131d] px-6 py-2.5 border-b border-white/5 flex items-center gap-1.5 flex-wrap shrink-0 z-10">
          <button
            type="button"
            onClick={() => handleSelectSection('agendamentos')}
            className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer border ${
              activeReportSection === 'agendamentos'
                ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white border-cyan-400 shadow-[0_0_16px_rgba(6,182,212,0.3)]'
                : 'bg-slate-900/90 text-slate-300 border-slate-800 hover:border-cyan-500/40 hover:text-white'
            }`}
          >
            <CalendarDays className="w-3.5 h-3.5" />
            <span>Agendamentos ({periodAgendamentos.length})</span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectSection('garantia')}
            className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer border ${
              activeReportSection === 'garantia'
                ? 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white border-teal-400 shadow-[0_0_16px_rgba(20,184,166,0.3)]'
                : 'bg-slate-900/90 text-slate-300 border-slate-800 hover:border-teal-500/40 hover:text-white'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Garantia Direta ({periodGarantias.length})</span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectSection('carnes')}
            className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer border ${
              activeReportSection === 'carnes'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white border-purple-400 shadow-[0_0_16px_rgba(168,85,247,0.3)]'
                : 'bg-slate-900/90 text-slate-300 border-slate-800 hover:border-purple-500/40 hover:text-white'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>Carnês ({periodCarnes.length})</span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectSection('entregas')}
            className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer border ${
              activeReportSection === 'entregas'
                ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white border-amber-400 shadow-[0_0_16px_rgba(245,158,11,0.3)]'
                : 'bg-slate-900/90 text-slate-300 border-slate-800 hover:border-amber-500/40 hover:text-white'
            }`}
          >
            <Truck className="w-3.5 h-3.5" />
            <span>Entregas (Vendas) ({periodEntregas.length})</span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectSection('retiradas')}
            className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer border ${
              activeReportSection === 'retiradas'
                ? 'bg-gradient-to-r from-rose-600 to-pink-600 text-white border-rose-400 shadow-[0_0_16px_rgba(244,63,94,0.3)]'
                : 'bg-slate-900/90 text-slate-300 border-slate-800 hover:border-rose-500/40 hover:text-white'
            }`}
          >
            <PackageCheck className="w-3.5 h-3.5" />
            <span>Retiradas (Compras) ({periodRetiradas.length})</span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectSection('financeiro')}
            className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer border ${
              activeReportSection === 'financeiro'
                ? 'bg-gradient-to-r from-emerald-600 to-cyan-600 text-white border-emerald-400 shadow-[0_0_16px_rgba(16,185,129,0.3)]'
                : 'bg-slate-900/90 text-slate-300 border-slate-800 hover:border-emerald-500/40 hover:text-white'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Financeiro (Entrada, Saída & Lucro)</span>
          </button>
        </div>

        {/* PERIOD SELECTOR BAR (Diário, Semanal, Mensal, De Tanto a Tanto) + CARD TOTAL FEITOS */}
        <div className="bg-[#0b0e14] px-6 py-3.5 border-b border-white/5 flex flex-col xl:flex-row xl:items-center justify-between gap-3 shrink-0 z-10">
          <div className="flex flex-col lg:flex-row lg:items-center gap-3 flex-1 min-w-0">
            {/* Main 4 Mode Buttons */}
            <div className="flex items-center p-1 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-inner overflow-x-auto scrollbar-hide shrink-0">
              <button
                type="button"
                onClick={() => setPeriodMode('dia')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  periodMode === 'dia'
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-black shadow-[0_0_15px_rgba(6,182,212,0.4)]'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Diário</span>
              </button>

              <button
                type="button"
                onClick={() => setPeriodMode('semana')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  periodMode === 'semana'
                    ? 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-black shadow-[0_0_15px_rgba(168,85,247,0.4)]'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Semanal</span>
              </button>

              <button
                type="button"
                onClick={() => setPeriodMode('mes')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  periodMode === 'mes'
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-slate-950 font-black shadow-[0_0_15px_rgba(16,185,129,0.4)]'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <CalendarDays className="w-3.5 h-3.5" />
                <span>Mensal</span>
              </button>

              <button
                type="button"
                onClick={() => setPeriodMode('personalizado')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  periodMode === 'personalizado'
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black shadow-[0_0_15px_rgba(245,158,11,0.4)]'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>De Tanto a Tanto</span>
              </button>
            </div>

            {/* Sub-controls based on periodMode */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* 1. SE POR DIA */}
              {periodMode === 'dia' && (
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setSelectedDay(todayStr)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                      selectedDay === todayStr
                        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    Hoje
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const yest = new Date();
                      yest.setDate(yest.getDate() - 1);
                      setSelectedDay(getLocalDateString(yest));
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                      (() => {
                        const yest = new Date();
                        yest.setDate(yest.getDate() - 1);
                        return selectedDay === getLocalDateString(yest);
                      })()
                        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    Ontem
                  </button>

                  <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1">
                    <span className="text-[11px] text-slate-400 font-bold">Data:</span>
                    <input
                      type="date"
                      value={selectedDay}
                      onChange={(e) => setSelectedDay(e.target.value)}
                      className="bg-transparent text-white text-xs font-semibold focus:outline-none cursor-pointer"
                    />
                  </div>
                </div>
              )}

              {/* 2. SE POR SEMANA */}
              {periodMode === 'semana' && (
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setSelectedWeekType('atual')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                      selectedWeekType === 'atual'
                        ? 'bg-purple-500/20 text-purple-300 border-purple-500/50'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    Esta Semana
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedWeekType('ultimos7')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                      selectedWeekType === 'ultimos7'
                        ? 'bg-purple-500/20 text-purple-300 border-purple-500/50'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    Últimos 7 Dias
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedWeekType('passada')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                      selectedWeekType === 'passada'
                        ? 'bg-purple-500/20 text-purple-300 border-purple-500/50'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    Semana Passada
                  </button>
                </div>
              )}

              {/* 3. SE POR MÊS */}
              {periodMode === 'mes' && (
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setSelectedMonth(currentYearMonth)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                      selectedMonth === currentYearMonth
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    Este Mês
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const now = new Date();
                      now.setMonth(now.getMonth() - 1);
                      setSelectedMonth(getLocalDateString(now).substring(0, 7));
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                      (() => {
                        const now = new Date();
                        now.setMonth(now.getMonth() - 1);
                        return selectedMonth === getLocalDateString(now).substring(0, 7);
                      })()
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    Mês Anterior
                  </button>

                  <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1">
                    <span className="text-[11px] text-slate-400 font-bold">Mês:</span>
                    <input
                      type="month"
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                      className="bg-transparent text-white text-xs font-semibold focus:outline-none cursor-pointer"
                    />
                  </div>
                </div>
              )}

              {/* 4. SE PERSONALIZADO: DE TAL A TAL */}
              {periodMode === 'personalizado' && (
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 bg-slate-900 border border-amber-500/30 rounded-xl px-3 py-1">
                    <span className="text-[11px] text-amber-400 font-black uppercase">De:</span>
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="bg-transparent text-white text-xs font-semibold focus:outline-none cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center gap-1.5 bg-slate-900 border border-amber-500/30 rounded-xl px-3 py-1">
                    <span className="text-[11px] text-amber-400 font-black uppercase">Até:</span>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="bg-transparent text-white text-xs font-semibold focus:outline-none cursor-pointer"
                    />
                  </div>

                  {/* Quick Presets */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        const d = new Date();
                        d.setDate(d.getDate() - 14);
                        setCustomStartDate(getLocalDateString(d));
                        setCustomEndDate(todayStr);
                      }}
                      className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-[10px] text-slate-300 font-bold border border-slate-800"
                    >
                      15 dias
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const d = new Date();
                        d.setDate(d.getDate() - 29);
                        setCustomStartDate(getLocalDateString(d));
                        setCustomEndDate(todayStr);
                      }}
                      className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-[10px] text-slate-300 font-bold border border-slate-800"
                    >
                      30 dias
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const d = new Date();
                        d.setDate(d.getDate() - 89);
                        setCustomStartDate(getLocalDateString(d));
                        setCustomEndDate(todayStr);
                      }}
                      className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-[10px] text-slate-300 font-bold border border-slate-800"
                    >
                      90 dias
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* CARD AZUL EM DESTAQUE: TOTAL FEITOS NO PERÍODO (DINÂMICO POR ABA) */}
          <button
            type="button"
            onClick={totalFeitosCardInfo.onClick}
            title="Clique para filtrar os registros concluídos da aba selecionada no período"
            className={`cursor-pointer group flex items-center justify-between gap-3 px-4 py-2 rounded-2xl border transition-all shrink-0 text-left ${
              totalFeitosCardInfo.isActiveFilter
                ? 'bg-gradient-to-r from-cyan-600/30 to-blue-600/30 border-cyan-400 shadow-[0_0_24px_rgba(6,182,212,0.35)] scale-[1.01]'
                : 'bg-gradient-to-r from-cyan-950/60 to-blue-950/60 border-cyan-500/40 hover:border-cyan-400 shadow-[0_0_16px_rgba(6,182,212,0.15)]'
            }`}
          >
            <div>
              <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-cyan-300">
                <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                <span>Total Feitos</span>
              </div>
              <p className="text-[10px] font-semibold text-slate-400 mt-0.5">
                {totalFeitosCardInfo.subtitle}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-2xl font-black text-white font-num leading-none">
                {totalFeitosCardInfo.count}
              </span>
              <ChevronRight className="w-4 h-4 text-cyan-400 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </button>
        </div>

        {/* SCROLLABLE MAIN CONTENT */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {activeReportSection === 'agendamentos' ? (
            <div className="space-y-5 animate-fadeIn">
              {/* 4 MINI-CARDS DO PERÍODO ESCOLHIDO */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="p-4 rounded-2xl bg-gradient-to-br from-cyan-950/30 to-slate-900/90 border border-cyan-500/30 shadow-lg">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-cyan-400">
                      Total de Agendamentos
                    </span>
                    <CalendarDays className="w-4 h-4 text-cyan-400" />
                  </div>
                  <div className="text-3xl font-black text-white font-num">
                    {scheduleSummary.total}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1 truncate">
                    {periodLabel}
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-950/30 to-slate-900/90 border border-emerald-500/30 shadow-lg">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">
                      Concluídos (Total Feitos)
                    </span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="text-3xl font-black text-emerald-400 font-num">
                    {scheduleSummary.completed}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {scheduleSummary.total > 0
                      ? `${((scheduleSummary.completed / scheduleSummary.total) * 100).toFixed(0)}% finalizados`
                      : 'Nenhum finalizado'}
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-950/30 to-slate-900/90 border border-amber-500/30 shadow-lg">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-400">
                      Pendentes / Faltam
                    </span>
                    <Clock className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="text-3xl font-black text-amber-400 font-num">
                    {scheduleSummary.pending}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Aguardando ou em atendimento
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-950/30 to-slate-900/90 border border-purple-500/30 shadow-lg">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-purple-300">
                      Só Visita / Faturamento
                    </span>
                    <DollarSign className="w-4 h-4 text-purple-400" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-black text-purple-300 font-num">
                    {formatCurrency(scheduleSummary.totalBilling)}
                  </div>
                  <p className="text-[10px] text-emerald-300 font-bold mt-1">
                    Só Visita: {scheduleSummary.visitOnlyCount} ({formatCurrency(scheduleSummary.visitOnlyTotal)})
                  </p>
                </div>
              </div>

              {/* BARRA DE CONTROLE DA LISTA + BOTÃO IMPRIMIR / SALVAR PDF */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-900/90 p-3.5 rounded-2xl border border-slate-800">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {(
                    [
                      { id: 'todos', label: `Todos (${scheduleSummary.total})` },
                      { id: 'concluidos', label: `Concluídos (${scheduleSummary.completed})` },
                      { id: 'pendentes', label: `Pendentes (${scheduleSummary.pending})` },
                      { id: 'so_visita', label: `Só Visita (${scheduleSummary.visitOnlyCount})` },
                    ] as const
                  ).map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setScheduleStatusFilter(st.id)}
                      className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all cursor-pointer border ${
                        scheduleStatusFilter === st.id
                          ? 'bg-cyan-500 text-slate-950 border-cyan-400 font-black'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2 flex-1 md:max-w-md justify-end">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={scheduleSearch}
                      onChange={(e) => setScheduleSearch(e.target.value)}
                      placeholder="Buscar cliente, aparelho, técnico..."
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleDownloadActiveTabPdf}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-black uppercase tracking-wide flex items-center gap-1.5 shadow-lg active:scale-95 transition-all shrink-0 cursor-pointer"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Imprimir / Salvar PDF</span>
                  </button>
                </div>
              </div>

              {statusUpdateMessage && (
                <div
                  className={`px-4 py-2.5 rounded-2xl border text-xs font-bold flex items-center justify-between gap-2 ${
                    statusUpdateMessage.type === 'success'
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                      : 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                  }`}
                >
                  <span>{statusUpdateMessage.text}</span>
                  <button
                    type="button"
                    onClick={() => setStatusUpdateMessage(null)}
                    className="text-slate-400 hover:text-white cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* TABELA DETALHADA DOS AGENDAMENTOS DO PERÍODO */}
              <div className="rounded-2xl bg-slate-900/90 border border-slate-800 overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-950/90 border-b border-slate-800 text-[10px] font-black uppercase tracking-wider text-slate-400">
                        <th className="py-3 px-3.5">Data</th>
                        <th className="py-3 px-3">Hora</th>
                        <th className="py-3 px-3.5">Cliente</th>
                        <th className="py-3 px-3.5">Aparelho</th>
                        <th className="py-3 px-3.5">Técnico</th>
                        <th className="py-3 px-3.5">Status</th>
                        <th className="py-3 px-3.5 text-right">Valor</th>
                        <th className="py-3 px-3.5 text-center">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80">
                      {filteredScheduleOrders.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-10 text-center text-slate-500 text-xs">
                            Nenhum agendamento encontrado para o período selecionado.
                          </td>
                        </tr>
                      ) : (
                        filteredScheduleOrders.map((ord) => {
                          const isVisitOnly = isPaidVisitOnlyOrder(ord);
                          const rowValue = isVisitOnly
                            ? getPaidVisitOnlyValue(ord)
                            : Number(ord.totalValue || 0);
                          const currentSelectValue = getScheduleDropdownValue(ord);
                          const isKnownOption =
                            currentSelectValue === 'CONCLUÍDO' ||
                            currentSelectValue === 'SÓ VISITA' ||
                            currentSelectValue === 'DEVOLVIDO AO ATENDENTE';
                          const isUpdating = Boolean(updatingOrderIds[ord.id]);

                          return (
                            <tr key={ord.id} className="hover:bg-white/[0.03] transition-colors">
                              <td className="py-3 px-3.5 font-mono text-slate-300 whitespace-nowrap">
                                {formatDate(getOrderLocalDate(ord))}
                              </td>
                              <td className="py-3 px-3 font-mono text-cyan-300 whitespace-nowrap">
                                {ord.scheduledTime || '-'}
                              </td>
                              <td className="py-3 px-3.5">
                                <div className="font-bold text-white">{ord.customerName || 'Sem nome'}</div>
                                <div className="text-[10px] text-slate-500 font-mono">{ord.id}</div>
                              </td>
                              <td className="py-3 px-3.5 text-slate-300">
                                <span className="font-medium">{ord.applianceType || '-'}</span>
                                {ord.applianceBrand ? (
                                  <span className="text-slate-500"> • {ord.applianceBrand}</span>
                                ) : null}
                              </td>
                              <td className="py-3 px-3.5 text-slate-300">
                                <span className="inline-flex items-center gap-1">
                                  <Wrench className="w-3 h-3 text-cyan-400 shrink-0" />
                                  {ord.technicianName || 'Não atribuído'}
                                </span>
                              </td>
                              <td className="py-3 px-3.5 whitespace-nowrap">
                                <div className="relative inline-flex items-center">
                                  <select
                                    value={currentSelectValue}
                                    disabled={isUpdating}
                                    aria-label={`Alterar status da OS ${ord.id}`}
                                    onChange={(e) =>
                                      handleScheduleStatusChange(
                                        ord,
                                        e.target.value as ScheduleDropdownStatus
                                      )
                                    }
                                    className={`appearance-none pl-2.5 pr-6 py-1 rounded-full border text-[10px] font-black uppercase tracking-wide cursor-pointer focus:outline-none focus:ring-2 transition-all disabled:opacity-60 disabled:cursor-wait ${getStatusSelectStyle(
                                      currentSelectValue
                                    )}`}
                                  >
                                    {!isKnownOption && (
                                      <option
                                        value={currentSelectValue}
                                        disabled
                                        hidden
                                        className="bg-slate-900 text-amber-300 font-bold"
                                      >
                                        {currentSelectValue}
                                      </option>
                                    )}
                                    <option value="CONCLUÍDO" className="bg-slate-900 text-emerald-300 font-bold">
                                      CONCLUÍDO
                                    </option>
                                    <option value="SÓ VISITA" className="bg-slate-900 text-purple-300 font-bold">
                                      SÓ VISITA
                                    </option>
                                    <option value="DEVOLVIDO AO ATENDENTE" className="bg-slate-900 text-blue-300 font-bold">
                                      DEVOLVIDO AO ATENDENTE
                                    </option>
                                  </select>
                                  {isUpdating ? (
                                    <Loader2 className="w-3 h-3 animate-spin pointer-events-none absolute right-2 text-current opacity-80" />
                                  ) : (
                                    <ChevronDown className="w-3 h-3 pointer-events-none absolute right-2 text-current opacity-80" />
                                  )}
                                </div>
                              </td>
                              <td className="py-3 px-3.5 text-right font-mono font-black text-emerald-400 whitespace-nowrap">
                                {formatCurrency(rowValue)}
                              </td>
                              <td className="py-3 px-3.5 text-center whitespace-nowrap">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => onOpenReceipt?.(ord)}
                                    className="p-1.5 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30 transition-all"
                                    title="Baixar Garantia / Comprovante (PDF / Impressão)"
                                  >
                                    <Printer className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const phone = cleanNumeric(ord.customerPhone);
                                      const msg = encodeURIComponent(
                                        `Olá *${ord.customerName}*! Segue o resumo do seu atendimento na *${company.name}*:\n\n` +
                                        `• *OS:* ${ord.id}\n` +
                                        `• *Aparelho:* ${ord.applianceType} ${ord.applianceBrand || ''}\n` +
                                        `• *Valor:* ${formatCurrency(rowValue)}\n` +
                                        `• *Garantia:* ${ord.warrantyMonths || 3} meses\n` +
                                        `• *Status:* ${currentSelectValue}\n\n` +
                                        `Agradecemos a preferência!`
                                      );
                                      window.open(`https://wa.me/55${phone}?text=${msg}`, '_blank');
                                    }}
                                    className="p-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 transition-all"
                                    title="Compartilhar pelo WhatsApp"
                                  >
                                    <Share2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onEditOrder?.(ord)}
                                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all"
                                    title="Editar registro"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (window.confirm(`Deseja realmente excluir o registro ${ord.id} (${ord.customerName})?`)) {
                                        onDeleteOrder?.(ord.id);
                                      }
                                    }}
                                    className="p-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 transition-all"
                                    title="Excluir registro"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : activeReportSection === 'garantia' ? (
            <div className="space-y-5 animate-fadeIn">
              {/* 4 MINI-CARDS: GARANTIA DIRETA */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="p-4 rounded-2xl bg-gradient-to-br from-teal-950/30 to-slate-900/90 border border-teal-500/30 shadow-lg">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-teal-400">
                      Garantias / OS Diretas
                    </span>
                    <ShieldCheck className="w-4 h-4 text-teal-400" />
                  </div>
                  <div className="text-3xl font-black text-white font-num">{garantiaSummary.total}</div>
                  <p className="text-[10px] text-slate-400 mt-1 truncate">{periodLabel}</p>
                </div>

                <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-950/30 to-slate-900/90 border border-emerald-500/30 shadow-lg">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">
                      Concluídas (Total Feitos)
                    </span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="text-3xl font-black text-emerald-400 font-num">{garantiaSummary.completed}</div>
                  <p className="text-[10px] text-slate-400 mt-1">Vendas / serviços finalizados</p>
                </div>

                <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-950/30 to-slate-900/90 border border-amber-500/30 shadow-lg">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-400">
                      Pendentes
                    </span>
                    <Clock className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="text-3xl font-black text-amber-400 font-num">{garantiaSummary.pending}</div>
                  <p className="text-[10px] text-slate-400 mt-1">Em andamento ou aguardando</p>
                </div>

                <div className="p-4 rounded-2xl bg-gradient-to-br from-cyan-950/30 to-slate-900/90 border border-cyan-500/30 shadow-lg">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-cyan-300">
                      Faturamento Direto
                    </span>
                    <DollarSign className="w-4 h-4 text-cyan-400" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-black text-cyan-300 font-num">
                    {formatCurrency(garantiaSummary.totalBilling)}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">Sem agendamentos ou carnês</p>
                </div>
              </div>

              {/* BARRA DE CONTROLE GARANTIA DIRETA */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-900/90 p-3.5 rounded-2xl border border-slate-800">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {(
                    [
                      { id: 'todos', label: `Todos (${garantiaSummary.total})` },
                      { id: 'concluidos', label: `Concluídas (${garantiaSummary.completed})` },
                      { id: 'pendentes', label: `Pendentes (${garantiaSummary.pending})` },
                    ] as const
                  ).map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setScheduleStatusFilter(st.id)}
                      className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all cursor-pointer border ${
                        scheduleStatusFilter === st.id
                          ? 'bg-teal-500 text-slate-950 border-teal-400 font-black'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2 flex-1 md:max-w-md justify-end">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={scheduleSearch}
                      onChange={(e) => setScheduleSearch(e.target.value)}
                      placeholder="Buscar cliente, aparelho, OS..."
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-teal-500"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleDownloadActiveTabPdf}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white text-xs font-black uppercase tracking-wide flex items-center gap-1.5 shadow-lg active:scale-95 transition-all shrink-0 cursor-pointer"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Imprimir / Salvar PDF</span>
                  </button>
                </div>
              </div>

              {/* TABELA GARANTIA DIRETA */}
              <div className="rounded-2xl bg-slate-900/90 border border-slate-800 overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-950/90 border-b border-slate-800 text-[10px] font-black uppercase tracking-wider text-slate-400">
                        <th className="py-3 px-3.5">Data</th>
                        <th className="py-3 px-3.5">Cliente / OS</th>
                        <th className="py-3 px-3.5">Aparelho</th>
                        <th className="py-3 px-3.5">Serviço / Garantia</th>
                        <th className="py-3 px-3.5">Atendente / Técnico</th>
                        <th className="py-3 px-3.5">Status</th>
                        <th className="py-3 px-3.5 text-right">Valor</th>
                        <th className="py-3 px-3.5 text-center">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80">
                      {filteredGarantias.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-10 text-center text-slate-500 text-xs">
                            Nenhum lançamento de Garantia Direta / OS encontrado no período selecionado.
                          </td>
                        </tr>
                      ) : (
                        filteredGarantias.map((ord) => {
                          const isDone = !ord.attendanceStatus || ord.attendanceStatus === 'Concluído';
                          const rowValue = Number(ord.totalValue || 0);
                          return (
                            <tr key={ord.id} className="hover:bg-white/[0.03] transition-colors">
                              <td className="py-3 px-3.5 font-mono text-slate-300 whitespace-nowrap">
                                {formatDate(getOrderLocalDate(ord))}
                              </td>
                              <td className="py-3 px-3.5">
                                <div className="font-bold text-white">{ord.customerName || 'Sem nome'}</div>
                                <div className="text-[10px] text-slate-500 font-mono">{ord.id}</div>
                              </td>
                              <td className="py-3 px-3.5 text-slate-300">
                                <span className="font-medium">{ord.applianceType || '-'}</span>
                                {ord.applianceBrand ? (
                                  <span className="text-slate-500"> • {ord.applianceBrand}</span>
                                ) : null}
                              </td>
                              <td className="py-3 px-3.5 text-slate-300 max-w-xs truncate">
                                <span>{ord.serviceDescription || ord.defectDescription || '-'}</span>
                                <div className="text-[10px] text-teal-400">
                                  Garantia: {ord.warrantyMonths || 0} {ord.warrantyMonths === 1 ? 'mês' : 'meses'}
                                </div>
                              </td>
                              <td className="py-3 px-3.5 text-slate-300">
                                {ord.technicianName || ord.attendantName || 'Atendente'}
                              </td>
                              <td className="py-3 px-3.5 whitespace-nowrap">
                                {isDone ? (
                                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-black uppercase">
                                    Concluído
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-black uppercase">
                                    {ord.attendanceStatus}
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-3.5 text-right font-mono font-black text-emerald-400 whitespace-nowrap">
                                {formatCurrency(rowValue)}
                              </td>
                              <td className="py-3 px-3.5 text-center whitespace-nowrap">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => onOpenReceipt?.(ord)}
                                    className="p-1.5 rounded-lg bg-teal-500/15 hover:bg-teal-500/30 text-teal-300 border border-teal-500/30 transition-all"
                                    title="Baixar Garantia / Comprovante (PDF / Impressão)"
                                  >
                                    <Printer className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const phone = cleanNumeric(ord.customerPhone);
                                      const msg = encodeURIComponent(
                                        `Olá *${ord.customerName}*! Segue o resumo do seu atendimento na *${company.name}*:\n\n` +
                                        `• *OS:* ${ord.id}\n` +
                                        `• *Aparelho:* ${ord.applianceType} ${ord.applianceBrand || ''}\n` +
                                        `• *Serviço:* ${ord.serviceDescription || ord.defectDescription || '-'}\n` +
                                        `• *Valor:* ${formatCurrency(rowValue)}\n` +
                                        `• *Garantia:* ${ord.warrantyMonths || 3} meses\n\n` +
                                        `Agradecemos a preferência!`
                                      );
                                      window.open(`https://wa.me/55${phone}?text=${msg}`, '_blank');
                                    }}
                                    className="p-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 transition-all"
                                    title="Compartilhar pelo WhatsApp"
                                  >
                                    <Share2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onEditOrder?.(ord)}
                                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all"
                                    title="Editar registro"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (window.confirm(`Deseja realmente excluir a OS ${ord.id} (${ord.customerName})?`)) {
                                        onDeleteOrder?.(ord.id);
                                      }
                                    }}
                                    className="p-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 transition-all"
                                    title="Excluir registro"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : activeReportSection === 'carnes' ? (
            <div className="space-y-5 animate-fadeIn">
              {/* 4 MINI-CARDS: CARNÊS */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-950/30 to-slate-900/90 border border-purple-500/30 shadow-lg">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-purple-400">
                      Carnês Emitidos
                    </span>
                    <CreditCard className="w-4 h-4 text-purple-400" />
                  </div>
                  <div className="text-3xl font-black text-white font-num">{carneSummary.total}</div>
                  <p className="text-[10px] text-slate-400 mt-1 truncate">{periodLabel}</p>
                </div>

                <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-950/30 to-slate-900/90 border border-emerald-500/30 shadow-lg">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">
                      Parcelas Pagas
                    </span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-black text-emerald-400 font-num">
                    {carneSummary.paidInstallmentsTotal}
                  </div>
                  <p className="text-[10px] text-emerald-300 font-bold mt-1">
                    Recebido: {formatCurrency(carneSummary.paidValue)}
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-950/30 to-slate-900/90 border border-amber-500/30 shadow-lg">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-400">
                      Parcelas Pendentes
                    </span>
                    <Clock className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-black text-amber-400 font-num">
                    {carneSummary.pendingInstallmentsTotal}
                  </div>
                  <p className="text-[10px] text-amber-300 font-bold mt-1">
                    A receber: {formatCurrency(carneSummary.pendingValue)}
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-gradient-to-br from-cyan-950/30 to-slate-900/90 border border-cyan-500/30 shadow-lg">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-cyan-300">
                      Valor Total Vendido
                    </span>
                    <DollarSign className="w-4 h-4 text-cyan-400" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-black text-cyan-300 font-num">
                    {formatCurrency(carneSummary.totalBilling)}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Quitados: {carneSummary.paidOffCount} | Em aberto: {carneSummary.openCount}
                  </p>
                </div>
              </div>

              {/* BARRA DE CONTROLE CARNÊS */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-900/90 p-3.5 rounded-2xl border border-slate-800">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {(
                    [
                      { id: 'todos', label: `Todos (${carneSummary.total})` },
                      { id: 'concluidos', label: `Quitados (${carneSummary.paidOffCount})` },
                      { id: 'pendentes', label: `Em Aberto (${carneSummary.openCount})` },
                    ] as const
                  ).map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setScheduleStatusFilter(st.id)}
                      className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all cursor-pointer border ${
                        scheduleStatusFilter === st.id
                          ? 'bg-purple-500 text-white border-purple-400 font-black'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2 flex-1 md:max-w-md justify-end">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={scheduleSearch}
                      onChange={(e) => setScheduleSearch(e.target.value)}
                      placeholder="Buscar cliente, aparelho, carnê..."
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleDownloadActiveTabPdf}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-black uppercase tracking-wide flex items-center gap-1.5 shadow-lg active:scale-95 transition-all shrink-0 cursor-pointer"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Imprimir / Salvar PDF</span>
                  </button>
                </div>
              </div>

              {/* TABELA CARNÊS */}
              <div className="rounded-2xl bg-slate-900/90 border border-slate-800 overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-950/90 border-b border-slate-800 text-[10px] font-black uppercase tracking-wider text-slate-400">
                        <th className="py-3 px-3.5">Data</th>
                        <th className="py-3 px-3.5">Cliente</th>
                        <th className="py-3 px-3.5">Aparelho / Descrição</th>
                        <th className="py-3 px-3.5">Parcelas Pagas / Pendentes</th>
                        <th className="py-3 px-3.5">Status</th>
                        <th className="py-3 px-3.5 text-right">Valor Total</th>
                        <th className="py-3 px-3.5 text-center">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80">
                      {filteredCarnes.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-10 text-center text-slate-500 text-xs">
                            Nenhuma venda em Carnê encontrada no período selecionado.
                          </td>
                        </tr>
                      ) : (
                        filteredCarnes.map((c) => {
                          const insts = Array.isArray(c.installments) ? c.installments : [];
                          const paidInsts = insts.filter((i) => i.paid);
                          const pendInsts = insts.filter((i) => !i.paid);
                          const paidVal = paidInsts.reduce((s, i) => s + Number(i.amount || 0), 0);
                          const pendVal = pendInsts.reduce((s, i) => s + Number(i.amount || 0), 0);
                          const isPaidOff = insts.length > 0 && pendInsts.length === 0;
                          const rowValue = Number(c.totalValue || 0);

                          return (
                            <tr key={c.id} className="hover:bg-white/[0.03] transition-colors">
                              <td className="py-3 px-3.5 font-mono text-slate-300 whitespace-nowrap">
                                {formatDate(getTimestampLocalDate(c.createdAt))}
                              </td>
                              <td className="py-3 px-3.5">
                                <div className="font-bold text-white">{c.customerName || 'Sem nome'}</div>
                                <div className="text-[10px] text-slate-500 font-mono">
                                  {c.id} {c.customerPhone ? `• ${c.customerPhone}` : ''}
                                </div>
                              </td>
                              <td className="py-3 px-3.5 text-slate-300 max-w-xs truncate">
                                <div className="font-medium text-white truncate">{c.description || '-'}</div>
                                <div className="text-[10px] text-slate-400">
                                  {insts.length || c.installmentsCount}x de {formatCurrency(Number(c.installmentValue || 0))}
                                </div>
                              </td>
                              <td className="py-3 px-3.5 whitespace-nowrap">
                                <div className="flex items-center gap-2 text-[11px]">
                                  <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold">
                                    {paidInsts.length} pagas ({formatCurrency(paidVal)})
                                  </span>
                                  <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-bold">
                                    {pendInsts.length} pend. ({formatCurrency(pendVal)})
                                  </span>
                                </div>
                              </td>
                              <td className="py-3 px-3.5 whitespace-nowrap">
                                {isPaidOff ? (
                                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-black uppercase">
                                    Quitado
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 text-[10px] font-black uppercase">
                                    Em Aberto
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-3.5 text-right font-mono font-black text-emerald-400 whitespace-nowrap">
                                {formatCurrency(rowValue)}
                              </td>
                              <td className="py-3 px-3.5 text-center whitespace-nowrap">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => downloadCarnePdf(c, company)}
                                    className="p-1.5 rounded-lg bg-purple-500/15 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 transition-all"
                                    title="Baixar Carnê / Impressão (PDF)"
                                  >
                                    <Printer className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const phone = cleanNumeric(c.customerPhone);
                                      const msg = encodeURIComponent(
                                        `Olá *${c.customerName}*! Segue o resumo do seu Carnê na *${company.name}*:\n\n` +
                                        `• *Carnê:* ${c.id}\n` +
                                        `• *Descrição:* ${c.description}\n` +
                                        `• *Valor Total:* ${formatCurrency(rowValue)}\n` +
                                        `• *Parcelas:* ${insts.length}x de ${formatCurrency(c.installmentValue)} (${paidInsts.length} pagas)\n\n` +
                                        `Agradecemos a preferência!`
                                      );
                                      window.open(`https://wa.me/55${phone}?text=${msg}`, '_blank');
                                    }}
                                    className="p-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 transition-all"
                                    title="Compartilhar pelo WhatsApp"
                                  >
                                    <Share2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onEditCarne?.(c)}
                                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all"
                                    title="Editar carnê"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (window.confirm(`Deseja realmente excluir o carnê ${c.id} (${c.customerName})?`)) {
                                        onDeleteCarne?.(c.id);
                                      }
                                    }}
                                    className="p-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 transition-all"
                                    title="Excluir carnê"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : activeReportSection === 'entregas' || activeReportSection === 'retiradas' ? (
            (() => {
              const isEntrega = activeReportSection === 'entregas';
              const summary = isEntrega ? entregaSummary : retiradaSummary;
              const rows = isEntrega ? filteredEntregas : filteredRetiradas;
              const accentColor = isEntrega ? 'amber' : 'rose';

              return (
                <div className="space-y-5 animate-fadeIn">
                  {/* 4 MINI-CARDS: ENTREGAS / RETIRADAS */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <div
                      className={`p-4 rounded-2xl bg-gradient-to-br ${
                        isEntrega ? 'from-amber-950/30 border-amber-500/30' : 'from-rose-950/30 border-rose-500/30'
                      } to-slate-900/90 border shadow-lg`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className={`text-[10px] font-black uppercase tracking-wider ${
                            isEntrega ? 'text-amber-400' : 'text-rose-400'
                          }`}
                        >
                          {isEntrega ? 'Total de Entregas (Vendas)' : 'Total de Retiradas (Compras)'}
                        </span>
                        {isEntrega ? (
                          <Truck className="w-4 h-4 text-amber-400" />
                        ) : (
                          <PackageCheck className="w-4 h-4 text-rose-400" />
                        )}
                      </div>
                      <div className="text-3xl font-black text-white font-num">{summary.total}</div>
                      <p className="text-[10px] text-slate-400 mt-1 truncate">{periodLabel}</p>
                    </div>

                    <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-950/30 to-slate-900/90 border border-emerald-500/30 shadow-lg">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">
                          Concluídas (Total Feitos)
                        </span>
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      </div>
                      <div className="text-3xl font-black text-emerald-400 font-num">{summary.completed}</div>
                      <p className="text-[10px] text-slate-400 mt-1">
                        {isEntrega ? 'Entregues ao cliente' : 'Retiradas finalizadas'}
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-gradient-to-br from-orange-950/30 to-slate-900/90 border border-orange-500/30 shadow-lg">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-black uppercase tracking-wider text-orange-400">
                          Pendentes / Em Rota
                        </span>
                        <Clock className="w-4 h-4 text-orange-400" />
                      </div>
                      <div className="text-3xl font-black text-orange-400 font-num">{summary.pending}</div>
                      <p className="text-[10px] text-slate-400 mt-1">Aguardando motorista</p>
                    </div>

                    <div className="p-4 rounded-2xl bg-gradient-to-br from-cyan-950/30 to-slate-900/90 border border-cyan-500/30 shadow-lg">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-black uppercase tracking-wider text-cyan-300">
                          {isEntrega ? 'Valor das Entregas' : 'Valor das Retiradas'}
                        </span>
                        <DollarSign className="w-4 h-4 text-cyan-400" />
                      </div>
                      <div className="text-2xl sm:text-3xl font-black text-cyan-300 font-num">
                        {formatCurrency(summary.totalBilling)}
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1">
                        {isEntrega ? 'Somente vendas com entrega' : 'Somente compras/retiradas'}
                      </p>
                    </div>
                  </div>

                  {/* BARRA DE CONTROLE ENTREGAS / RETIRADAS */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-900/90 p-3.5 rounded-2xl border border-slate-800">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {(
                        [
                          { id: 'todos', label: `Todos (${summary.total})` },
                          { id: 'concluidos', label: `Concluídas (${summary.completed})` },
                          { id: 'pendentes', label: `Pendentes / Rota (${summary.pending})` },
                        ] as const
                      ).map((st) => (
                        <button
                          key={st.id}
                          type="button"
                          onClick={() => setScheduleStatusFilter(st.id)}
                          className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all cursor-pointer border ${
                            scheduleStatusFilter === st.id
                              ? accentColor === 'amber'
                                ? 'bg-amber-500 text-slate-950 border-amber-400 font-black'
                                : 'bg-rose-500 text-white border-rose-400 font-black'
                              : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                          }`}
                        >
                          {st.label}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-2 flex-1 md:max-w-md justify-end">
                      <div className="relative flex-1">
                        <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          value={scheduleSearch}
                          onChange={(e) => setScheduleSearch(e.target.value)}
                          placeholder={
                            isEntrega
                              ? 'Buscar cliente, endereço, motorista...'
                              : 'Buscar fornecedor/cliente, item, motorista...'
                          }
                          className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={handleDownloadActiveTabPdf}
                        className={`px-4 py-2 rounded-xl bg-gradient-to-r ${
                          isEntrega
                            ? 'from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500'
                            : 'from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500'
                        } text-white text-xs font-black uppercase tracking-wide flex items-center gap-1.5 shadow-lg active:scale-95 transition-all shrink-0 cursor-pointer`}
                      >
                        <Printer className="w-4 h-4" />
                        <span>Imprimir / Salvar PDF</span>
                      </button>
                    </div>
                  </div>

                  {/* TABELA ENTREGAS / RETIRADAS */}
                  <div className="rounded-2xl bg-slate-900/90 border border-slate-800 overflow-hidden shadow-xl">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-950/90 border-b border-slate-800 text-[10px] font-black uppercase tracking-wider text-slate-400">
                            <th className="py-3 px-3.5">Data / Hora</th>
                            <th className="py-3 px-3.5">{isEntrega ? 'Cliente' : 'Fornecedor / Cliente'}</th>
                            <th className="py-3 px-3.5">Aparelho / Descrição</th>
                            <th className="py-3 px-3.5">Endereço</th>
                            <th className="py-3 px-3.5">Motorista</th>
                            <th className="py-3 px-3.5">Status</th>
                            <th className="py-3 px-3.5 text-right">Valor</th>
                            <th className="py-3 px-3.5 text-center">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/80">
                          {rows.length === 0 ? (
                            <tr>
                              <td colSpan={8} className="py-10 text-center text-slate-500 text-xs">
                                {isEntrega
                                  ? 'Nenhuma entrega encontrada para o período selecionado.'
                                  : 'Nenhuma retirada encontrada para o período selecionado.'}
                              </td>
                            </tr>
                          ) : (
                            rows.map((d) => {
                              const addr = [d.street, d.number, d.neighborhood, d.city].filter(Boolean).join(', ');
                              const val = getDeliveryValue(d);
                              const isDone = d.status === 'Concluído';

                              return (
                                <tr key={d.id} className="hover:bg-white/[0.03] transition-colors">
                                  <td className="py-3 px-3.5 font-mono text-slate-300 whitespace-nowrap">
                                    <div>{formatDate(getDeliveryLocalDate(d))}</div>
                                    <div className="text-[10px] text-cyan-400">{d.scheduledTime || '-'}</div>
                                  </td>
                                  <td className="py-3 px-3.5">
                                    <div className="font-bold text-white">{d.customerName || 'Sem nome'}</div>
                                    <div className="text-[10px] text-slate-500 font-mono">
                                      {d.id} {d.customerPhone ? `• ${d.customerPhone}` : ''}
                                    </div>
                                  </td>
                                  <td className="py-3 px-3.5 text-slate-300 max-w-xs truncate">
                                    {d.description || '-'}
                                  </td>
                                  <td className="py-3 px-3.5 text-slate-400 max-w-xs truncate">
                                    <span className="inline-flex items-center gap-1">
                                      <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                                      <span className="truncate">{addr || '-'}</span>
                                    </span>
                                  </td>
                                  <td className="py-3 px-3.5 text-slate-300 whitespace-nowrap">
                                    {d.driverName || 'Não definido'}
                                  </td>
                                  <td className="py-3 px-3.5 whitespace-nowrap">
                                    {isDone ? (
                                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-black uppercase">
                                        Concluído
                                      </span>
                                    ) : d.status === 'Em Rota' ? (
                                      <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-[10px] font-black uppercase">
                                        Em Rota
                                      </span>
                                    ) : d.status === 'Cancelado' ? (
                                      <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/40 text-[10px] font-black uppercase">
                                        Cancelado
                                      </span>
                                    ) : (
                                      <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-black uppercase">
                                        {d.status || 'Pendente'}
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-3 px-3.5 text-right font-mono font-black text-emerald-400 whitespace-nowrap">
                                    {val > 0 ? formatCurrency(val) : '-'}
                                  </td>
                                  <td className="py-3 px-3.5 text-center whitespace-nowrap">
                                    <div className="flex items-center justify-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const phone = cleanNumeric(d.customerPhone);
                                          const msg = encodeURIComponent(
                                            `Olá *${d.customerName}*! Segue o resumo da sua ${isEntrega ? 'Entrega' : 'Retirada'} na *${company.name}*:\n\n` +
                                            `• *ID:* ${d.id}\n` +
                                            `• *Descrição:* ${d.description}\n` +
                                            `• *Endereço:* ${addr}\n` +
                                            `• *Motorista:* ${d.driverName}\n` +
                                            `• *Status:* ${d.status}\n\n` +
                                            `Agradecemos a preferência!`
                                          );
                                          window.open(`https://wa.me/55${phone}?text=${msg}`, '_blank');
                                        }}
                                        className="p-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 transition-all"
                                        title="Compartilhar pelo WhatsApp"
                                      >
                                        <Share2 className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => onEditDelivery?.(d)}
                                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all"
                                        title="Editar entrega"
                                      >
                                        <Pencil className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (window.confirm(`Deseja realmente excluir a tarefa ${d.id} (${d.customerName})?`)) {
                                            onDeleteDelivery?.(d.id);
                                          }
                                        }}
                                        className="p-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 transition-all"
                                        title="Excluir tarefa"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              );
            })()
          ) : (
            <>
              {/* 1. EXECUTIVE KPI SUMMARY CARDS (Clicáveis para filtrar o extrato abaixo) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* CARD 1: ENTRADAS (FATURAMENTO) */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => handleSelectFinanceCard('entradas')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleSelectFinanceCard('entradas');
                }
              }}
              className={`relative p-5 rounded-2xl bg-gradient-to-br from-cyan-950/30 to-slate-900/90 border cursor-pointer transition-all hover:scale-[1.01] select-none group ${
                financeFilter === 'entradas'
                  ? 'border-cyan-400 ring-2 ring-cyan-400/80 shadow-[0_0_32px_rgba(6,182,212,0.3)]'
                  : 'border-cyan-500/30 shadow-[0_0_30px_rgba(6,182,212,0.1)] hover:border-cyan-400/60'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-cyan-400 tracking-wider flex items-center gap-1.5">
                  <ArrowUpRight className="w-3.5 h-3.5 text-cyan-400" />
                  Total de Entradas
                </span>
                <span className="px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 text-[10px] font-mono font-bold">
                  {periodOrders.length} {periodOrders.length === 1 ? 'ordem' : 'ordens'}
                </span>
              </div>
              <div className="text-3xl font-black text-cyan-400 font-num mt-2">
                {formatCurrency(totalRevenue)}
              </div>
              <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                <span>Ticket Médio: <strong className="text-slate-200">{formatCurrency(ticketMedio)}</strong></span>
                {totalDaysInPeriod > 1 ? (
                  <span className="text-[10px] text-cyan-400/80">
                    Média/dia: {formatCurrency(avgDailyRevenue)}
                  </span>
                ) : (
                  <span className="text-[10px] text-cyan-400/80 font-bold flex items-center gap-0.5">
                    {financeFilter === 'entradas' ? 'Filtrando' : 'Ver entradas'}
                    <ChevronRight className="w-3 h-3" />
                  </span>
                )}
              </div>
            </div>

            {/* CARD 2: SAÍDAS (DESPESAS) */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => handleSelectFinanceCard('saidas')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleSelectFinanceCard('saidas');
                }
              }}
              className={`relative p-5 rounded-2xl bg-gradient-to-br from-red-950/30 to-slate-900/90 border cursor-pointer transition-all hover:scale-[1.01] select-none group ${
                financeFilter === 'saidas'
                  ? 'border-red-400 ring-2 ring-red-400/80 shadow-[0_0_32px_rgba(239,68,68,0.3)]'
                  : 'border-red-500/30 shadow-[0_0_30px_rgba(239,68,68,0.1)] hover:border-red-400/60'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-red-400 tracking-wider flex items-center gap-1.5">
                  <ArrowDownRight className="w-3.5 h-3.5 text-red-400" />
                  Total de Saídas
                </span>
                <span className="px-2 py-0.5 rounded-full bg-red-500/10 text-red-300 border border-red-500/20 text-[10px] font-mono font-bold">
                  {periodExpenses.length} {periodExpenses.length === 1 ? 'despesa' : 'despesas'}
                </span>
              </div>
              <div className="text-3xl font-black text-[#ff3333] font-num mt-2">
                -{formatCurrency(totalExpenses)}
              </div>
              <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                <span>
                  Maior Custo:{' '}
                  <strong className="text-slate-200 truncate max-w-[100px] inline-block align-bottom">
                    {expensesByCategory[0]?.name ? expensesByCategory[0].name.split('/')[0] : 'Nenhum'}
                  </strong>
                </span>
                {totalDaysInPeriod > 1 ? (
                  <span className="text-[10px] text-red-400/80">
                    Média/dia: {formatCurrency(avgDailyExpenses)}
                  </span>
                ) : (
                  <span className="text-[10px] text-red-400/80 font-bold flex items-center gap-0.5">
                    {financeFilter === 'saidas' ? 'Filtrando' : 'Ver saídas'}
                    <ChevronRight className="w-3 h-3" />
                  </span>
                )}
              </div>
            </div>

            {/* CARD 3: LUCRO LÍQUIDO REAL */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => handleSelectFinanceCard('lucro')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleSelectFinanceCard('lucro');
                }
              }}
              className={`relative p-5 rounded-2xl border-2 cursor-pointer transition-all hover:scale-[1.01] select-none shadow-xl group ${
                netProfit >= 0
                  ? financeFilter === 'lucro'
                    ? 'bg-gradient-to-br from-emerald-950/40 to-slate-900/90 border-emerald-400 ring-2 ring-emerald-400/80 shadow-[0_0_35px_rgba(16,185,129,0.3)]'
                    : 'bg-gradient-to-br from-emerald-950/40 to-slate-900/90 border-emerald-500/40 shadow-[0_0_35px_rgba(16,185,129,0.15)] hover:border-emerald-400/70'
                  : financeFilter === 'lucro'
                    ? 'bg-gradient-to-br from-red-950/40 to-slate-900/90 border-red-400 ring-2 ring-red-400/80 shadow-[0_0_35px_rgba(220,38,38,0.3)]'
                    : 'bg-gradient-to-br from-red-950/40 to-slate-900/90 border-red-600/50 shadow-[0_0_35px_rgba(220,38,38,0.2)] hover:border-red-400/70'
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 ${
                    netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  <DollarSign className="w-3.5 h-3.5" />
                  Lucro Líquido Real
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                    netProfit >= 0
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-red-500/20 text-red-300 border border-red-500/30'
                  }`}
                >
                  {profitMargin.toFixed(1)}% Margem
                </span>
              </div>
              <div
                className={`text-3xl font-black font-num mt-2 ${
                  netProfit >= 0 ? 'text-emerald-400' : 'text-red-500'
                }`}
              >
                {formatCurrency(netProfit)}
              </div>
              <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                <span className="text-slate-400">
                  Resultado:{' '}
                  <strong className={netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                    {netProfit >= 0 ? 'Superávit Líquido' : 'Déficit no Período'}
                  </strong>
                </span>
                {totalDaysInPeriod > 1 ? (
                  <span className={`text-[10px] font-bold ${netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {formatCurrency(avgDailyProfit)}/dia
                  </span>
                ) : (
                  <span className="text-[10px] text-emerald-400/80 font-bold flex items-center gap-0.5">
                    {financeFilter === 'lucro' ? 'Fechamento' : 'Extrato completo'}
                    <ChevronRight className="w-3 h-3" />
                  </span>
                )}
              </div>
            </div>

            {/* CARD 4: RETENÇÃO & OPERAÇÃO */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => handleSelectFinanceCard('pendentes')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleSelectFinanceCard('pendentes');
                }
              }}
              className={`relative p-5 rounded-2xl bg-gradient-to-br from-indigo-950/30 to-slate-900/90 border cursor-pointer transition-all hover:scale-[1.01] select-none group ${
                financeFilter === 'pendentes'
                  ? 'border-indigo-400 ring-2 ring-indigo-400/80 shadow-[0_0_32px_rgba(99,102,241,0.3)]'
                  : 'border-indigo-500/30 shadow-[0_0_30px_rgba(99,102,241,0.1)] hover:border-indigo-400/60'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-indigo-400 tracking-wider flex items-center gap-1.5">
                  <Wallet className="w-3.5 h-3.5 text-indigo-400" />
                  Saldo Operacional
                </span>
                <span className="px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 text-[10px] font-mono font-bold">
                  {combinedMovements.length} Movimentos
                </span>
              </div>
              <div className="text-3xl font-black text-indigo-300 font-num mt-2">
                {totalRevenue > 0
                  ? `${((netProfit / totalRevenue) * 100).toFixed(0)}%`
                  : '0%'}
                <span className="text-xs font-normal text-slate-400 ml-2">eficiência</span>
              </div>
              <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                <span>A receber pendente:</span>
                <strong className="text-amber-400 font-num flex items-center gap-1">
                  {formatCurrency(pendingOrdersRevenue)}
                  <ChevronRight className="w-3 h-3 text-indigo-400" />
                </strong>
              </div>
            </div>
          </div>

          {/* 2. REPORT VIEW TABS */}
          <div className="flex items-center justify-between gap-3 border-b border-white/5 pb-2 flex-wrap">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
              <button
                type="button"
                onClick={() => setReportTab('resumo')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                  reportTab === 'resumo'
                    ? 'bg-cyan-500 text-slate-950 font-black shadow-md'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                <span>Gráficos & Visão Comparativa</span>
              </button>

              <button
                type="button"
                onClick={() => setReportTab('movimentacoes')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                  reportTab === 'movimentacoes'
                    ? 'bg-cyan-500 text-slate-950 font-black shadow-md'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                <Layers className="w-4 h-4" />
                <span>Extrato de Movimentações ({combinedMovements.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setReportTab('diario')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                  reportTab === 'diario'
                    ? 'bg-cyan-500 text-slate-950 font-black shadow-md'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                <CalendarDays className="w-4 h-4" />
                <span>Resumo Dia a Dia ({dailyConsolidated.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setReportTab('categorias')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                  reportTab === 'categorias'
                    ? 'bg-cyan-500 text-slate-950 font-black shadow-md'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                <PieChartIcon className="w-4 h-4" />
                <span>Categorias & Formas de Pagamento</span>
              </button>
            </div>

            <div className="text-[11px] text-slate-400">
              Período: <strong className="text-white">{periodLabel}</strong> ({totalDaysInPeriod}{' '}
              {totalDaysInPeriod === 1 ? 'dia' : 'dias'})
            </div>
          </div>

          {/* TAB 1: GRÁFICOS & VISÃO COMPARATIVA */}
          {reportTab === 'resumo' && (
            <div className="space-y-6 animate-fadeIn">
              {/* Daily Evolution Chart (if more than 1 day) or Distribution */}
              {totalDaysInPeriod > 1 ? (
                <div className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-cyan-400" />
                        Evolução Diária de Entradas vs Saídas & Lucro
                      </h3>
                      <p className="text-xs text-slate-400">
                        Comparativo dia a dia no período selecionado ({startDate} até {endDate})
                      </p>
                    </div>

                    <div className="flex items-center gap-3 text-xs">
                      <span className="flex items-center gap-1.5 text-cyan-400 font-bold">
                        <span className="w-3 h-3 rounded bg-cyan-400 inline-block" /> Entradas
                      </span>
                      <span className="flex items-center gap-1.5 text-red-500 font-bold">
                        <span className="w-3 h-3 rounded bg-red-500 inline-block" /> Saídas
                      </span>
                      <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
                        <span className="w-3 h-1 rounded bg-emerald-400 inline-block" /> Lucro
                      </span>
                    </div>
                  </div>

                  <div className="h-[320px] w-full pt-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={dailyConsolidated} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis
                          dataKey="formattedDate"
                          stroke="#64748b"
                          tick={{ fill: '#94a3b8', fontSize: 11 }}
                          interval={totalDaysInPeriod > 15 ? Math.floor(totalDaysInPeriod / 10) : 0}
                        />
                        <YAxis
                          stroke="#64748b"
                          tick={{ fill: '#94a3b8', fontSize: 11 }}
                          tickFormatter={(val) => `R$${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#0f172a',
                            border: '1px solid #334155',
                            borderRadius: '12px',
                            fontSize: '12px',
                            color: '#fff',
                          }}
                          formatter={(value: any, name: any) => [
                            formatCurrency(Number(value)),
                            name === 'revenue'
                              ? 'Entradas'
                              : name === 'expenses'
                              ? 'Saídas'
                              : 'Lucro Líquido',
                          ]}
                          labelFormatter={(label, payload) => {
                            const item = payload?.[0]?.payload as DailyConsolidated;
                            return item ? `${item.dayOfWeek}, ${item.formattedDate}` : label;
                          }}
                        />
                        <Bar dataKey="revenue" fill="#06b6d4" radius={[6, 6, 0, 0]} maxBarSize={30} />
                        <Bar dataKey="expenses" fill="#ef4444" radius={[6, 6, 0, 0]} maxBarSize={30} />
                        <Line
                          type="monotone"
                          dataKey="profit"
                          stroke="#10b981"
                          strokeWidth={3}
                          dot={{ r: 4, fill: '#10b981' }}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ) : (
                /* SINGLE DAY DETAILED COMPARISON */
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Single Day Visual Comparison */}
                  <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
                    <div>
                      <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                        <PieChartIcon className="w-4 h-4 text-cyan-400" />
                        Composição do Dia ({formatDateWithWeekday(selectedDay)})
                      </h3>
                      <p className="text-xs text-slate-400 mt-1">
                        Balanço proporcional entre Entradas e Saídas deste dia
                      </p>
                    </div>

                    <div className="h-[220px] relative my-4 flex items-center justify-center">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={[
                              { name: 'Lucro Líquido', value: Math.max(0, netProfit), color: '#10b981' },
                              { name: 'Despesas', value: totalExpenses, color: '#ef4444' },
                            ]}
                            cx="50%"
                            cy="50%"
                            innerRadius={55}
                            outerRadius={85}
                            paddingAngle={4}
                            dataKey="value"
                            stroke="none"
                          >
                            <Cell fill="#10b981" />
                            <Cell fill="#ef4444" />
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              backgroundColor: '#0f172a',
                              border: '1px solid #334155',
                              borderRadius: '8px',
                              fontSize: '11px',
                            }}
                            formatter={(val: any) => formatCurrency(Number(val))}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-[10px] uppercase font-black text-slate-500">Margem</span>
                        <span className={`text-xl font-black ${netProfit >= 0 ? 'text-emerald-400' : 'text-red-500'}`}>
                          {profitMargin.toFixed(0)}%
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-center text-xs">
                      <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
                        <span className="text-[10px] text-cyan-400 uppercase font-black">Entradas</span>
                        <p className="font-bold text-white font-num">{formatCurrency(totalRevenue)}</p>
                      </div>
                      <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20">
                        <span className="text-[10px] text-red-400 uppercase font-black">Saídas</span>
                        <p className="font-bold text-white font-num">{formatCurrency(totalExpenses)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Single Day Summary Checklist */}
                  <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4">
                    <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      Diagnóstico do Fechamento do Dia
                    </h3>

                    <div className="space-y-3">
                      <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                        <span className="text-xs text-slate-300">Total de Ordens Realizadas:</span>
                        <strong className="text-white font-num">{periodOrders.length} atendimentos</strong>
                      </div>

                      <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                        <span className="text-xs text-slate-300">Total de Despesas Lançadas:</span>
                        <strong className="text-white font-num">{periodExpenses.length} registros</strong>
                      </div>

                      <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                        <span className="text-xs text-slate-300">Ticket Médio por Cliente:</span>
                        <strong className="text-cyan-400 font-num">{formatCurrency(ticketMedio)}</strong>
                      </div>

                      <div
                        className={`p-3.5 rounded-2xl border flex items-center justify-between ${
                          netProfit >= 0
                            ? 'bg-emerald-500/10 border-emerald-500/30'
                            : 'bg-red-500/10 border-red-500/30'
                        }`}
                      >
                        <span className="text-xs font-bold text-slate-200">Saldo Líquido em Caixa:</span>
                        <strong
                          className={`text-lg font-black font-num ${
                            netProfit >= 0 ? 'text-emerald-400' : 'text-red-500'
                          }`}
                        >
                          {formatCurrency(netProfit)}
                        </strong>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Two Secondary Charts: Categories of Expenses and Payment Methods */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 1. Categorias de Despesas */}
                <div className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                      <ArrowDownRight className="w-3.5 h-3.5 text-red-400" />
                      Para onde foram as Saídas?
                    </h4>
                    <span className="text-xs font-mono font-bold text-red-400">
                      -{formatCurrency(totalExpenses)}
                    </span>
                  </div>

                  {expensesByCategory.length === 0 ? (
                    <div className="text-center py-8 text-xs text-slate-500">
                      Nenhuma saída cadastrada neste período.
                    </div>
                  ) : (
                    <div className="space-y-2 pt-2">
                      {expensesByCategory.map((cat) => (
                        <div key={cat.name} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-300 truncate max-w-[200px]">{cat.name}</span>
                            <span className="font-mono font-bold text-slate-200">
                              {formatCurrency(cat.value)} ({cat.percentage.toFixed(0)}%)
                            </span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${cat.percentage}%`, backgroundColor: cat.color }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 2. Formas de Pagamento das Entradas */}
                <div className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
                      Como os clientes pagaram?
                    </h4>
                    <span className="text-xs font-mono font-bold text-emerald-400">
                      +{formatCurrency(totalRevenue)}
                    </span>
                  </div>

                  {revenueByPaymentMethod.length === 0 ? (
                    <div className="text-center py-8 text-xs text-slate-500">
                      Nenhuma entrada registrada neste período.
                    </div>
                  ) : (
                    <div className="space-y-2 pt-2">
                      {revenueByPaymentMethod.map((method) => (
                        <div key={method.name} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-300">{method.name}</span>
                            <span className="font-mono font-bold text-slate-200">
                              {formatCurrency(method.value)} ({method.percentage.toFixed(0)}%)
                            </span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${method.percentage}%`, backgroundColor: method.color }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: EXTRATO COMPLETO DE MOVIMENTAÇÕES (ENTRADAS, SAÍDAS & A RECEBER) */}
          {reportTab === 'movimentacoes' && (
            <div className="space-y-4 animate-fadeIn">
              {/* Banner do filtro ativo pelo card + ação rápida */}
              {(financeFilter !== 'todos' || movementTypeFilter !== 'todas') && (
                <div
                  className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-4 py-2.5 rounded-2xl border text-xs ${
                    financeFilter === 'entradas' || movementTypeFilter === 'entradas'
                      ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-200'
                      : financeFilter === 'saidas' || movementTypeFilter === 'saidas'
                        ? 'bg-red-500/10 border-red-500/30 text-red-200'
                        : financeFilter === 'pendentes' || movementTypeFilter === 'pendentes'
                          ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-200'
                          : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold">
                    <Filter className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      {financeFilter === 'entradas' || movementTypeFilter === 'entradas'
                        ? 'Exibindo somente Entradas Recebidas no período (ordens pagas, garantias pagas, visitas e parcelas quitadas)'
                        : financeFilter === 'saidas' || movementTypeFilter === 'saidas'
                          ? 'Exibindo somente Saídas e Despesas registradas no período'
                          : financeFilter === 'pendentes' || movementTypeFilter === 'pendentes'
                            ? 'Exibindo somente valores "A receber pendente" para conferência e baixa'
                            : 'Exibindo Extrato Completo Combinado (Entradas + Saídas) para conferência do Lucro Líquido'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {(financeFilter === 'saidas' || movementTypeFilter === 'saidas') && onOpenExpenses && (
                      <button
                        type="button"
                        onClick={onOpenExpenses}
                        className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-[11px] font-black flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>+ Nova Despesa / Saída</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setFinanceFilter('todos');
                        setMovementTypeFilter('todas');
                      }}
                      className="px-2.5 py-1 rounded-lg bg-slate-900/90 hover:bg-slate-800 text-slate-300 text-[11px] font-bold border border-white/10 cursor-pointer"
                    >
                      Limpar filtro
                    </button>
                  </div>
                </div>
              )}

              {/* Search & Filter Bar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/80 p-3 rounded-2xl border border-slate-800">
                {/* Search Input */}
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar por cliente, OS, despesa, categoria ou pagamento..."
                    value={movementSearch}
                    onChange={(e) => setMovementSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-xs focus:border-cyan-400 focus:outline-none"
                  />
                  {movementSearch && (
                    <button
                      onClick={() => setMovementSearch('')}
                      className="absolute right-2.5 top-2 text-[11px] text-slate-400 hover:text-white"
                    >
                      Limpar
                    </button>
                  )}
                </div>

                {/* Filter Type: Todas | Entradas | Saídas | A Receber */}
                <div className="flex items-center p-1 rounded-xl bg-slate-950 border border-slate-800 shrink-0 overflow-x-auto scrollbar-hide">
                  <button
                    type="button"
                    onClick={() => {
                      setFinanceFilter('lucro');
                      setMovementTypeFilter('todas');
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                      movementTypeFilter === 'todas'
                        ? 'bg-slate-700 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Todas ({combinedMovements.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFinanceFilter('entradas');
                      setMovementTypeFilter('entradas');
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                      movementTypeFilter === 'entradas'
                        ? 'bg-cyan-500 text-slate-950'
                        : 'text-slate-400 hover:text-cyan-400'
                    }`}
                  >
                    Entradas ({receivedEntryMovements.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFinanceFilter('saidas');
                      setMovementTypeFilter('saidas');
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                      movementTypeFilter === 'saidas'
                        ? 'bg-red-500 text-white'
                        : 'text-slate-400 hover:text-red-400'
                    }`}
                  >
                    Saídas ({periodExpenses.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFinanceFilter('pendentes');
                      setMovementTypeFilter('pendentes');
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                      movementTypeFilter === 'pendentes'
                        ? 'bg-indigo-500 text-white'
                        : 'text-slate-400 hover:text-indigo-300'
                    }`}
                  >
                    A Receber ({pendingReceivableMovements.length})
                  </button>
                </div>
              </div>

              {/* Movements Table */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-[#121622] text-slate-400 uppercase text-[10px] font-black tracking-wider border-b border-slate-800">
                      <tr>
                        <th className="py-3 px-4">Data</th>
                        <th className="py-3 px-3">Tipo</th>
                        <th className="py-3 px-4">Descrição / ID</th>
                        <th className="py-3 px-4">Categoria / Equipamento</th>
                        <th className="py-3 px-4">Cliente / Responsável</th>
                        <th className="py-3 px-3">Pagamento</th>
                        <th className="py-3 px-4 text-right">Valor</th>
                        <th className="py-3 px-3 text-center">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {filteredMovements.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="text-center py-12 text-slate-500 text-xs">
                            Nenhuma movimentação encontrada para os filtros selecionados.
                          </td>
                        </tr>
                      ) : (
                        filteredMovements.map((item) => (
                          <tr
                            key={`${item.type}-${item.id}`}
                            className="hover:bg-slate-800/40 transition-colors"
                          >
                            {/* Data */}
                            <td className="py-3 px-4 font-mono whitespace-nowrap text-slate-300">
                              {formatDate(item.date)}
                            </td>

                            {/* Tipo Badge */}
                            <td className="py-3 px-3 whitespace-nowrap">
                              {item.type === 'entrada' ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
                                  <ArrowUpRight className="w-3 h-3" /> Entrada
                                </span>
                              ) : item.type === 'pendente' ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                  <Clock className="w-3 h-3" /> {item.statusLabel || 'Pendente'}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-red-500/15 text-red-400 border border-red-500/30">
                                  <ArrowDownRight className="w-3 h-3" /> Saída
                                </span>
                              )}
                            </td>

                            {/* Descrição */}
                            <td className="py-3 px-4 font-semibold text-white max-w-xs truncate">
                              <span className="font-mono text-cyan-400/80 mr-1.5">{item.id}</span>
                              {item.description}
                            </td>

                            {/* Categoria / Aparelho */}
                            <td className="py-3 px-4 text-slate-300 whitespace-nowrap">
                              <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px]">
                                {item.categoryOrAppliance}
                              </span>
                            </td>

                            {/* Cliente / Criado Por */}
                            <td className="py-3 px-4 text-slate-300 whitespace-nowrap font-medium">
                              {item.responsibleOrClient}
                            </td>

                            {/* Forma de Pagamento */}
                            <td className="py-3 px-3 text-slate-400 whitespace-nowrap">
                              {item.paymentMethod}
                            </td>

                            {/* Valor */}
                            <td
                              className={`py-3 px-4 text-right font-mono font-bold whitespace-nowrap text-sm ${
                                item.type === 'entrada'
                                  ? 'text-cyan-400'
                                  : item.type === 'pendente'
                                    ? 'text-amber-400'
                                    : 'text-red-400'
                              }`}
                            >
                              {item.type === 'entrada' ? '+' : item.type === 'saida' ? '-' : ''}
                              {formatCurrency(item.amount)}
                            </td>

                            {/* Ação (Dar Baixa / Abrir) */}
                            <td className="py-3 px-3 text-center whitespace-nowrap">
                              {item.rawKind === 'order' && onEditOrder ? (
                                <button
                                  type="button"
                                  onClick={() => onEditOrder(item.rawItem as WarrantyOrder)}
                                  className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-all cursor-pointer ${
                                    item.type === 'pendente'
                                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm'
                                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                                  }`}
                                >
                                  {item.type === 'pendente' ? 'Dar Baixa' : 'Abrir OS'}
                                </button>
                              ) : item.rawKind === 'carne_installment' && onEditCarne ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    onEditCarne((item.rawItem as { carne: CarneSale; installment: CarneInstallment }).carne)
                                  }
                                  className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-all cursor-pointer ${
                                    item.type === 'pendente'
                                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm'
                                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                                  }`}
                                >
                                  {item.type === 'pendente' ? 'Dar Baixa' : 'Ver Carnê'}
                                </button>
                              ) : item.rawKind === 'expense' && onOpenExpenses ? (
                                <button
                                  type="button"
                                  onClick={onOpenExpenses}
                                  className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer"
                                >
                                  Despesas
                                </button>
                              ) : (
                                <span className="text-slate-600">-</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    <tfoot className="bg-[#121622] border-t-2 border-slate-700 font-bold text-white text-xs">
                      <tr>
                        <td colSpan={6} className="py-3.5 px-4 text-right uppercase tracking-wider text-slate-400">
                          {financeFilter === 'pendentes' || movementTypeFilter === 'pendentes'
                            ? 'Total A Receber Pendente Exibido:'
                            : financeFilter === 'entradas' || movementTypeFilter === 'entradas'
                              ? 'Total de Entradas Recebidas Exibidas:'
                              : financeFilter === 'saidas' || movementTypeFilter === 'saidas'
                                ? 'Total de Saídas Exibidas:'
                                : 'Saldo Líquido das Movimentações Exibidas:'}
                        </td>
                        <td
                          className={`py-3.5 px-4 text-right font-mono text-base font-black ${
                            financeFilter === 'pendentes' || movementTypeFilter === 'pendentes'
                              ? 'text-amber-400'
                              : financeFilter === 'saidas' || movementTypeFilter === 'saidas'
                                ? 'text-red-400'
                                : financeFilter === 'entradas' || movementTypeFilter === 'entradas'
                                  ? 'text-cyan-400'
                                  : netProfit >= 0
                                    ? 'text-emerald-400'
                                    : 'text-red-500'
                          }`}
                        >
                          {formatCurrency(
                            filteredMovements.reduce((acc, curr) => {
                              if (financeFilter === 'pendentes' || movementTypeFilter === 'pendentes') {
                                return acc + curr.amount;
                              }
                              if (financeFilter === 'saidas' || movementTypeFilter === 'saidas') {
                                return acc + curr.amount;
                              }
                              return acc + (curr.type === 'entrada' ? curr.amount : curr.type === 'saida' ? -curr.amount : 0);
                            }, 0)
                          )}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: RESUMO DIA A DIA (TABELA CONSOLIDADA) */}
          {reportTab === 'diario' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 text-xs text-slate-400 flex items-center justify-between">
                <span>
                  Consolidado diário de faturamento, despesas e margem para o período de{' '}
                  <strong className="text-white">{periodLabel}</strong>.
                </span>
                <span className="text-[11px] font-mono text-cyan-400 font-bold">
                  {dailyConsolidated.length} dias listados
                </span>
              </div>

              <div className="bg-slate-900/90 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-[#121622] text-slate-400 uppercase text-[10px] font-black tracking-wider border-b border-slate-800">
                      <tr>
                        <th className="py-3 px-4">Data & Dia da Semana</th>
                        <th className="py-3 px-4 text-center">Qtd Entradas</th>
                        <th className="py-3 px-4 text-right">Total Entrada</th>
                        <th className="py-3 px-4 text-center">Qtd Saídas</th>
                        <th className="py-3 px-4 text-right">Total Saída</th>
                        <th className="py-3 px-4 text-right">Lucro do Dia</th>
                        <th className="py-3 px-4 text-right">Margem %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {dailyConsolidated.map((day) => (
                        <tr
                          key={day.date}
                          className={`hover:bg-slate-800/40 transition-colors ${
                            day.date === todayStr ? 'bg-cyan-950/20' : ''
                          }`}
                        >
                          <td className="py-3 px-4 font-medium text-white whitespace-nowrap">
                            <span className="font-mono">{day.formattedDate}</span>
                            <span className="text-slate-400 text-[11px] ml-2">({day.dayOfWeek})</span>
                            {day.date === todayStr && (
                              <span className="ml-2 px-1.5 py-0.2 rounded text-[9px] font-black bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                                HOJE
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center font-mono text-slate-400">
                            {day.revenueCount}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-cyan-400">
                            {formatCurrency(day.revenue)}
                          </td>
                          <td className="py-3 px-4 text-center font-mono text-slate-400">
                            {day.expenseCount}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-red-400">
                            {day.expenses > 0 ? `-${formatCurrency(day.expenses)}` : 'R$ 0,00'}
                          </td>
                          <td
                            className={`py-3 px-4 text-right font-mono font-black ${
                              day.profit >= 0 ? 'text-emerald-400' : 'text-red-500'
                            }`}
                          >
                            {formatCurrency(day.profit)}
                          </td>
                          <td
                            className={`py-3 px-4 text-right font-mono font-bold ${
                              day.profitMargin >= 0 ? 'text-emerald-300' : 'text-red-400'
                            }`}
                          >
                            {day.revenue > 0 ? `${day.profitMargin.toFixed(0)}%` : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-[#121622] border-t-2 border-slate-700 font-black text-white text-xs">
                      <tr>
                        <td className="py-4 px-4 uppercase tracking-wider text-slate-300">TOTAIS DO PERÍODO:</td>
                        <td className="py-4 px-4 text-center font-mono text-cyan-300">
                          {periodOrders.length}
                        </td>
                        <td className="py-4 px-4 text-right font-mono text-cyan-400 text-sm">
                          {formatCurrency(totalRevenue)}
                        </td>
                        <td className="py-4 px-4 text-center font-mono text-red-300">
                          {periodExpenses.length}
                        </td>
                        <td className="py-4 px-4 text-right font-mono text-red-400 text-sm">
                          -{formatCurrency(totalExpenses)}
                        </td>
                        <td
                          className={`py-4 px-4 text-right font-mono text-base ${
                            netProfit >= 0 ? 'text-emerald-400' : 'text-red-500'
                          }`}
                        >
                          {formatCurrency(netProfit)}
                        </td>
                        <td
                          className={`py-4 px-4 text-right font-mono text-sm ${
                            profitMargin >= 0 ? 'text-emerald-400' : 'text-red-400'
                          }`}
                        >
                          {profitMargin.toFixed(1)}%
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: CATEGORIAS & FORMAS DE PAGAMENTO */}
          {reportTab === 'categorias' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fadeIn">
              {/* Box 1: Categorias de Saídas */}
              <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                    <ArrowDownRight className="w-4 h-4 text-red-400" />
                    Detalhamento de Saídas por Categoria
                  </h3>
                  <span className="text-xs font-mono font-bold text-red-400">
                    -{formatCurrency(totalExpenses)}
                  </span>
                </div>

                <div className="divide-y divide-slate-800">
                  {expensesByCategory.map((cat) => (
                    <div key={cat.name} className="py-3 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2.5">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                        <span className="font-semibold text-slate-200">{cat.name}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-mono font-bold text-white block">
                          {formatCurrency(cat.value)}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {cat.percentage.toFixed(1)}% do total de gastos
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Box 2: Formas de Pagamento de Entradas */}
              <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-emerald-400" />
                    Detalhamento de Entradas por Meio de Pagamento
                  </h3>
                  <span className="text-xs font-mono font-bold text-emerald-400">
                    +{formatCurrency(totalRevenue)}
                  </span>
                </div>

                <div className="divide-y divide-slate-800">
                  {revenueByPaymentMethod.map((method) => (
                    <div key={method.name} className="py-3 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2.5">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: method.color }} />
                        <span className="font-semibold text-slate-200">{method.name}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-mono font-bold text-white block">
                          {formatCurrency(method.value)}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {method.percentage.toFixed(1)}% do faturamento
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
            </>
          )}
        </div>

        {/* BOTTOM FOOTER */}
        <div className="px-6 py-4 bg-[#111622] border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span>
              Período Selecionado: <strong className="text-white">{periodLabel}</strong>
            </span>
            <span>•</span>
            <span>
              Lucro Líquido:{' '}
              <strong className={netProfit >= 0 ? 'text-emerald-400 font-num' : 'text-red-500 font-num'}>
                {formatCurrency(netProfit)}
              </strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>Exportar Dados</span>
            </button>
            <button
              onClick={onClose}
              className="px-6 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs uppercase tracking-wider transition-all active:scale-95 shadow-md shadow-cyan-900/30"
            >
              Fechar Relatório
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
