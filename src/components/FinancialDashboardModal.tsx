import React, { useMemo } from 'react';
import { 
  X, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  PieChart as PieChartIcon, 
  ArrowUpRight, 
  ArrowDownRight,
  Target
} from 'lucide-react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip, 
  Legend 
} from 'recharts';
import { formatCurrency } from '../utils/formatters';

interface FinancialDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  revenue: number;
  expenses: number;
  orderCount: number;
  expenseCount: number;
}

export const FinancialDashboardModal: React.FC<FinancialDashboardModalProps> = ({
  isOpen,
  onClose,
  revenue,
  expenses,
  orderCount,
  expenseCount
}) => {
  if (!isOpen) return null;

  const profit = revenue - expenses;
  const profitMargin = revenue > 0 ? (profit / revenue) * 100 : 0;

  const chartData = [
    { name: 'Lucro Líquido', value: Math.max(0, profit), color: '#10b981' },
    { name: 'Despesas', value: expenses, color: '#ff0000' }, // More vivid red
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-4xl bg-[#121418] border border-white/10 rounded-3xl shadow-[0_0_80px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col max-h-[94vh]">
        {/* Glow corner decorations */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

        {/* Header (Compact) */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-black/20">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <PieChartIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white tracking-tight">Finanças de Hoje</h2>
              <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Resumo Operacional</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-500 hover:text-white hover:bg-white/5 transition-all active:scale-90"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content (Compact) */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
            {/* Round Chart (Compact) */}
            <div className="relative h-[280px] w-full bg-black/20 rounded-2xl border border-white/5 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', fontSize: '11px' }}
                    itemStyle={{ color: '#fff', fontWeight: 'bold' }}
                    formatter={(value: any) => formatCurrency(Number(value))}
                  />
                </PieChart>
              </ResponsiveContainer>
              
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[9px] font-black uppercase text-slate-500 tracking-widest">Margem</span>
                <span className={`text-2xl font-black ${profit >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>
                  {profitMargin.toFixed(0)}%
                </span>
              </div>
            </div>

            {/* Metrics (Compact) */}
            <div className="space-y-3">
              <div className="p-4 rounded-2xl bg-black/20 border border-white/5 flex items-center justify-between group">
                <div className="space-y-0.5">
                  <span className="text-[9px] font-black uppercase text-slate-500 flex items-center gap-1">
                    <DollarSign className="w-2.5 h-2.5 text-cyan-400" />
                    Faturamento
                  </span>
                  <div className="text-2xl font-black text-cyan-400 font-num">
                    {formatCurrency(revenue)}
                  </div>
                  <p className="text-[9px] text-slate-600 font-bold uppercase">{orderCount} Serviços</p>
                </div>
                <div className="h-10 w-10 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-400">
                  <TrendingUp className="w-5 h-5" />
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-black/20 border border-white/5 flex items-center justify-between group">
                <div className="space-y-0.5">
                  <span className="text-[9px] font-black uppercase text-slate-500 flex items-center gap-1">
                    <ArrowDownRight className="w-2.5 h-2.5 text-red-500" />
                    Gastos
                  </span>
                  <div className="text-2xl font-black text-[#ff0000] font-num">
                    -{formatCurrency(expenses)}
                  </div>
                  <p className="text-[9px] text-slate-600 font-bold uppercase">{expenseCount} Registros</p>
                </div>
                <div className="h-10 w-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-500">
                  <TrendingDown className="w-5 h-5" />
                </div>
              </div>

              <div className={`p-4 rounded-2xl border-2 flex items-center justify-between group ${
                profit >= 0 ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-red-500/5 border-red-500/20'
              }`}>
                <div className="space-y-0.5">
                  <span className="text-[9px] font-black uppercase text-slate-500 flex items-center gap-1">
                    <Target className={`w-2.5 h-2.5 ${profit >= 0 ? 'text-emerald-400' : 'text-red-500'}`} />
                    Lucro Real
                  </span>
                  <div className={`text-3xl font-black font-num ${profit >= 0 ? 'text-emerald-400' : 'text-red-500'}`}>
                    {formatCurrency(profit)}
                  </div>
                  <p className="text-[10px] text-slate-400 font-bold italic leading-none">Saldo Final</p>
                </div>
                <div className={`h-12 w-12 rounded-xl flex items-center justify-center shadow-lg ${
                  profit >= 0 ? 'bg-emerald-500 text-slate-950' : 'bg-red-600 text-white'
                }`}>
                  <PieChartIcon className="w-6 h-6" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer (Compact) */}
        <div className="p-4 border-t border-white/5 bg-black/20 flex justify-center">
          <button
            onClick={onClose}
            className="px-8 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white font-black text-xs uppercase tracking-widest transition-all active:scale-95 border border-white/5"
          >
            Fechar Análise
          </button>
        </div>
      </div>
    </div>

  );
};
