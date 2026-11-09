import React, { useState, useMemo } from 'react';
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
  ShieldCheck,
  CreditCard,
  Layers,
  Sparkles,
  RefreshCw,
  Wallet,
  Percent,
} from 'lucide-react';
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
import { CompanySettings, Expense, ExpenseCategory, PaymentMethod, WarrantyOrder } from '../types';
import {
  formatCurrency,
  formatDate,
  formatDateWithWeekday,
  extractDateOnly,
  getLocalDateString,
  getWeekdayName,
} from '../utils/formatters';

export type ReportPeriodMode = 'dia' | 'semana' | 'mes' | 'personalizado';

interface FinancialReportScreenProps {
  isOpen: boolean;
  onClose: () => void;
  orders: WarrantyOrder[];
  expenses: Expense[];
  company: CompanySettings;
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
}) => {
  // Period Mode: 'dia' | 'semana' | 'mes' | 'personalizado'
  const [periodMode, setPeriodMode] = useState<ReportPeriodMode>('dia');

  // Today helper
  const todayStr = getLocalDateString();

  // Mode: DIA
  const [selectedDay, setSelectedDay] = useState<string>(todayStr);

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

  // Detailed Tab inside Report
  const [reportTab, setReportTab] = useState<'resumo' | 'movimentacoes' | 'diario' | 'categorias'>('resumo');
  const [movementTypeFilter, setMovementTypeFilter] = useState<'todas' | 'entradas' | 'saidas'>('todas');
  const [movementSearch, setMovementSearch] = useState<string>('');

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

  // Filter Orders within [startDate, endDate]
  const periodOrders = useMemo(() => {
    return orders.filter((o) => {
      const orderDate = extractDateOnly(o.scheduledDate || o.createdAt);
      if (!orderDate) return false;
      return orderDate >= startDate && orderDate <= endDate;
    });
  }, [orders, startDate, endDate]);

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
      const d = extractDateOnly(ord.scheduledDate || ord.createdAt);
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
    type: 'entrada' | 'saida';
    date: string;
    description: string;
    categoryOrAppliance: string;
    responsibleOrClient: string;
    paymentMethod: string;
    amount: number;
    rawItem: WarrantyOrder | Expense;
  }

  const combinedMovements = useMemo(() => {
    const list: MovementItem[] = [];

    // Orders as Entradas
    for (const ord of periodOrders) {
      list.push({
        id: ord.id,
        type: 'entrada',
        date: extractDateOnly(ord.scheduledDate || ord.createdAt),
        description: `OS ${ord.id} - ${ord.serviceDescription || ord.defectDescription || 'Serviço Concluído'}`,
        categoryOrAppliance: ord.applianceType || 'Aparelho',
        responsibleOrClient: ord.customerName,
        paymentMethod: ord.paymentMethod || 'Pix',
        amount: ord.totalValue || 0,
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

  // Filtered movements for the table
  const filteredMovements = useMemo(() => {
    return combinedMovements.filter((m) => {
      if (movementTypeFilter === 'entradas' && m.type !== 'entrada') return false;
      if (movementTypeFilter === 'saidas' && m.type !== 'saida') return false;

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
  }, [combinedMovements, movementTypeFilter, movementSearch]);

  // Export to CSV Function
  const handleExportCSV = () => {
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

    const rows = combinedMovements.map((m) => [
      formatDate(m.date),
      m.type === 'entrada' ? 'ENTRADA' : 'SAÍDA',
      m.id,
      `"${m.description.replace(/"/g, '""')}"`,
      `"${m.categoryOrAppliance}"`,
      `"${m.responsibleOrClient.replace(/"/g, '""')}"`,
      `"${m.paymentMethod}"`,
      m.type === 'entrada' ? m.amount.toFixed(2) : (-m.amount).toFixed(2),
    ]);

    // Summary Rows at the bottom
    rows.push([]);
    rows.push(['--- RESUMO DO PERÍODO ---']);
    rows.push(['Período:', `"${periodLabel}"`]);
    rows.push(['Total de Entradas (Receitas):', totalRevenue.toFixed(2)]);
    rows.push(['Total de Saídas (Despesas):', totalExpenses.toFixed(2)]);
    rows.push(['Lucro Líquido Real:', netProfit.toFixed(2)]);
    rows.push(['Margem de Lucro (%):', `${profitMargin.toFixed(1)}%`]);

    const csvContent =
      '\uFEFF' + // UTF-8 BOM for Brazilian Excel
      headers.join(';') +
      '\n' +
      rows.map((r) => r.join(';')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `relatorio-financeiro-${startDate}-a-${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
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

        {/* PERIOD SELECTOR BAR (Dia, Semana, Mês, Data de Tal a Tal) */}
        <div className="bg-[#0b0e14] px-6 py-3.5 border-b border-white/5 flex flex-col lg:flex-row lg:items-center justify-between gap-3 shrink-0 z-10">
          {/* Main 4 Mode Buttons */}
          <div className="flex items-center p-1 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-inner overflow-x-auto scrollbar-hide">
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
              <span>Por Dia</span>
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
              <span>Por Semana</span>
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
              <span>Por Mês</span>
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
              <span>Data de Tal a Tal</span>
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

        {/* SCROLLABLE MAIN CONTENT */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* 1. EXECUTIVE KPI SUMMARY CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* CARD 1: ENTRADAS (FATURAMENTO) */}
            <div className="relative p-5 rounded-2xl bg-gradient-to-br from-cyan-950/30 to-slate-900/90 border border-cyan-500/30 shadow-[0_0_30px_rgba(6,182,212,0.1)] group">
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
                {totalDaysInPeriod > 1 && (
                  <span className="text-[10px] text-cyan-400/80">
                    Média/dia: {formatCurrency(avgDailyRevenue)}
                  </span>
                )}
              </div>
            </div>

            {/* CARD 2: SAÍDAS (DESPESAS) */}
            <div className="relative p-5 rounded-2xl bg-gradient-to-br from-red-950/30 to-slate-900/90 border border-red-500/30 shadow-[0_0_30px_rgba(239,68,68,0.1)] group">
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
                {totalDaysInPeriod > 1 && (
                  <span className="text-[10px] text-red-400/80">
                    Média/dia: {formatCurrency(avgDailyExpenses)}
                  </span>
                )}
              </div>
            </div>

            {/* CARD 3: LUCRO LÍQUIDO REAL */}
            <div
              className={`relative p-5 rounded-2xl border-2 transition-all shadow-xl group ${
                netProfit >= 0
                  ? 'bg-gradient-to-br from-emerald-950/40 to-slate-900/90 border-emerald-500/40 shadow-[0_0_35px_rgba(16,185,129,0.15)]'
                  : 'bg-gradient-to-br from-red-950/40 to-slate-900/90 border-red-600/50 shadow-[0_0_35px_rgba(220,38,38,0.2)]'
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
                {totalDaysInPeriod > 1 && (
                  <span className={`text-[10px] font-bold ${netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {formatCurrency(avgDailyProfit)}/dia
                  </span>
                )}
              </div>
            </div>

            {/* CARD 4: RETENÇÃO & OPERAÇÃO */}
            <div className="relative p-5 rounded-2xl bg-gradient-to-br from-indigo-950/30 to-slate-900/90 border border-indigo-500/30 shadow-[0_0_30px_rgba(99,102,241,0.1)] group">
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
                <strong className="text-amber-400 font-num">{formatCurrency(pendingOrdersRevenue)}</strong>
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

          {/* TAB 2: EXTRATO COMPLETO DE MOVIMENTAÇÕES (ENTRADAS & SAÍDAS) */}
          {reportTab === 'movimentacoes' && (
            <div className="space-y-4 animate-fadeIn">
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

                {/* Filter Type: Todas | Entradas | Saídas */}
                <div className="flex items-center p-1 rounded-xl bg-slate-950 border border-slate-800 shrink-0">
                  <button
                    type="button"
                    onClick={() => setMovementTypeFilter('todas')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      movementTypeFilter === 'todas'
                        ? 'bg-slate-700 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Todas ({combinedMovements.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setMovementTypeFilter('entradas')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      movementTypeFilter === 'entradas'
                        ? 'bg-cyan-500 text-slate-950'
                        : 'text-slate-400 hover:text-cyan-400'
                    }`}
                  >
                    Entradas ({periodOrders.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setMovementTypeFilter('saidas')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      movementTypeFilter === 'saidas'
                        ? 'bg-red-500 text-white'
                        : 'text-slate-400 hover:text-red-400'
                    }`}
                  >
                    Saídas ({periodExpenses.length})
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
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {filteredMovements.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="text-center py-12 text-slate-500 text-xs">
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
                                item.type === 'entrada' ? 'text-cyan-400' : 'text-red-400'
                              }`}
                            >
                              {item.type === 'entrada' ? '+' : '-'}
                              {formatCurrency(item.amount)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    <tfoot className="bg-[#121622] border-t-2 border-slate-700 font-bold text-white text-xs">
                      <tr>
                        <td colSpan={6} className="py-3.5 px-4 text-right uppercase tracking-wider text-slate-400">
                          Saldo Líquido das Movimentações Exibidas:
                        </td>
                        <td
                          className={`py-3.5 px-4 text-right font-mono text-base font-black ${
                            netProfit >= 0 ? 'text-emerald-400' : 'text-red-500'
                          }`}
                        >
                          {formatCurrency(
                            filteredMovements.reduce(
                              (acc, curr) =>
                                acc + (curr.type === 'entrada' ? curr.amount : -curr.amount),
                              0
                            )
                          )}
                        </td>
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
