import React, { useState } from 'react';
import {
  X,
  PlusCircle,
  Receipt,
  TrendingDown,
  TrendingUp,
  DollarSign,
  Trash2,
  CheckCircle,
  PieChart,
  Pencil,
  Search,
  AlertCircle,
  Calendar,
  Sparkles,
  BarChart3,
} from 'lucide-react';
import { Expense, ExpenseCategory, PaymentMethod, User, WarrantyOrder } from '../types';
import { sbSaveExpense, sbDeleteExpense } from '../utils/supabaseService';
import { formatCurrency, getLocalDateString, formatDate } from '../utils/formatters';

interface ExpensesModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'cadastrar' | 'lista' | 'lucro';
  orders: WarrantyOrder[];
  expenses: Expense[];
  onExpensesChanged: () => void;
  currentUser: User | null;
  todayRevenue: number;
  totalRevenue: number;
  onOpenReport?: () => void;
}

const CATEGORIES: { label: ExpenseCategory; icon: string; color: string }[] = [
  { label: 'Peças e Insumos', icon: '🔧', color: 'border-cyan-500/40 text-cyan-400 bg-cyan-950/40' },
  { label: 'Combustível / Deslocamento', icon: '⛽', color: 'border-amber-500/40 text-amber-400 bg-amber-950/40' },
  { label: 'Alimentação', icon: '🍔', color: 'border-orange-500/40 text-orange-400 bg-orange-950/40' },
  { label: 'Ferramentas e Equipamentos', icon: '🧰', color: 'border-indigo-500/40 text-indigo-400 bg-indigo-950/40' },
  { label: 'Impostos e Taxas', icon: '🏛️', color: 'border-red-500/40 text-red-500 bg-red-950/40' },
  { label: 'Outros Custos', icon: '📦', color: 'border-slate-500/40 text-slate-300 bg-slate-900' },
];

export const ExpensesModal: React.FC<ExpensesModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'cadastrar',
  orders,
  expenses,
  onExpensesChanged,
  currentUser,
  todayRevenue,
  totalRevenue,
  onOpenReport,
}) => {
  const [activeTab, setActiveTab] = useState<'cadastrar' | 'lista' | 'lucro'>(initialTab);
  const [periodFilter, setPeriodFilter] = useState<'hoje' | 'todos' | 'mes'>('hoje');
  const [searchTerm, setSearchTerm] = useState('');

  // Form State
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState<string>('');
  const [category, setCategory] = useState<ExpenseCategory>('Peças e Insumos');
  const [expenseDate, setExpenseDate] = useState<string>(getLocalDateString());
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Pix');
  const [relatedOrderId, setRelatedOrderId] = useState<string>('');
  const [responsibleName, setResponsibleName] = useState<string>(currentUser?.name || 'Administrador');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  
  // Custom Delete Confirmation
  const [deleteConfirmationId, setDeleteConfirmationId] = useState<string | null>(null);

  // Sync initial tab when opening
  React.useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setExpenseDate(getLocalDateString());
      if (currentUser?.name && !editingExpense) {
        setResponsibleName(currentUser.name);
      }
    } else {
      setEditingExpense(null);
      resetForm();
    }
  }, [isOpen, initialTab, currentUser]);

  const resetForm = () => {
    setDescription('');
    setAmount('');
    setCategory('Peças e Insumos');
    setExpenseDate(getLocalDateString());
    setPaymentMethod('Pix');
    setRelatedOrderId('');
    setNotes('');
    setResponsibleName(currentUser?.name || 'Administrador');
    setEditingExpense(null);
  };

  if (!isOpen) return null;

  const todayStr = getLocalDateString();
  const currentMonth = todayStr.substring(0, 7); // YYYY-MM

  // Financial Calculations
  const todayExpensesList = expenses.filter((e) => e.date === todayStr);
  const todayExpensesTotal = todayExpensesList.reduce((acc, curr) => acc + (curr.amount || 0), 0);
  const todayNetProfit = todayRevenue - todayExpensesTotal;
  const todayProfitMargin = todayRevenue > 0 ? (todayNetProfit / todayRevenue) * 100 : 0;

  const totalExpensesSum = expenses.reduce((acc, curr) => acc + (curr.amount || 0), 0);

  // Filtered expenses for the list
  const filteredExpenses = expenses.filter((e) => {
    if (periodFilter === 'hoje' && e.date !== todayStr) return false;
    if (periodFilter === 'mes' && !e.date.startsWith(currentMonth)) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return (
        e.description.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q) ||
        (e.createdBy || '').toLowerCase().includes(q) ||
        (e.relatedOrderId || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const filteredExpensesTotal = filteredExpenses.reduce((acc, curr) => acc + curr.amount, 0);

  const handleRegisterExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount.replace(',', '.'));
    if (!description.trim() || isNaN(parsedAmount) || parsedAmount <= 0) {
      alert("Informe uma descrição e valor válidos.");
      return;
    }

    setIsSubmitting(true);
    const expenseData: Expense = {
      id: editingExpense?.id || `EXP-${Date.now()}`,
      description: description.trim(),
      amount: parsedAmount,
      category,
      date: expenseDate,
      paymentMethod,
      relatedOrderId: relatedOrderId || undefined,
      createdBy: responsibleName,
      notes: notes.trim() || undefined,
      createdAt: editingExpense?.createdAt || new Date().toISOString(),
    };

    const success = await sbSaveExpense(expenseData);
    if (success) {
      setSuccessToast(editingExpense ? `Gasto atualizado!` : `Gasto registrado!`);
      onExpensesChanged();
      setTimeout(() => setSuccessToast(null), 3000);
      resetForm();
      setActiveTab('lista');
    }
    setIsSubmitting(false);
  };

  const handleEditClick = (exp: Expense) => {
    setEditingExpense(exp);
    setDescription(exp.description);
    setAmount(exp.amount.toString());
    setCategory(exp.category);
    setExpenseDate(exp.date);
    setPaymentMethod(exp.paymentMethod || 'Pix');
    setRelatedOrderId(exp.relatedOrderId || '');
    setResponsibleName(exp.createdBy || '');
    setNotes(exp.notes || '');
    setActiveTab('cadastrar');
  };

  const handleDeleteExpense = async (id: string) => {
    const success = await sbDeleteExpense(id);
    if (success) {
      setDeleteConfirmationId(null);
      onExpensesChanged();
      setSuccessToast('Gasto excluído com sucesso.');
      setTimeout(() => setSuccessToast(null), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      {deleteConfirmationId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-slate-900 border border-red-500/40 rounded-3xl p-6 shadow-2xl animate-scaleIn">
            <div className="flex items-center gap-3 text-red-500 mb-4">
              <div className="h-12 w-12 rounded-2xl bg-red-500/20 border border-red-500/40 flex items-center justify-center">
                <Trash2 className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-white text-lg">Excluir Gasto?</h4>
            </div>
            <p className="text-sm text-slate-300 mb-6">Tem certeza que deseja remover este lançamento financeiro permanentemente?</p>
            <div className="flex items-center gap-3">
              <button onClick={() => setDeleteConfirmationId(null)} className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold transition-all">Cancelar</button>
              <button onClick={() => handleDeleteExpense(deleteConfirmationId)} className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-bold shadow-lg shadow-red-900/40 transition-all active:scale-95">Sim, Excluir</button>
            </div>
          </div>
        </div>
      )}

      <div className="relative w-full max-w-3xl bg-slate-900 border border-cyan-500/30 rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-red-500/20 border border-[#ff3b3b]/40 flex items-center justify-center text-[#ff3b3b]"><Receipt className="w-6 h-6" /></div>
            <div>
              <h3 className="text-lg sm:text-xl font-black text-white">Controle de Gastos & Lucro Real</h3>
              <p className="text-sm text-slate-400">Gestão financeira sincronizada</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"><X className="w-6 h-6" /></button>
        </div>

        <div className="p-4 bg-slate-950/60 border-b border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col">
            <div className="text-xs font-bold uppercase text-slate-500 flex justify-between">Faturamento <DollarSign className="w-3.5 h-3.5" /></div>
            <div className="text-xl font-mono font-black text-cyan-400 mt-1.5">{formatCurrency(todayRevenue)}</div>
          </div>
          <div onClick={() => setActiveTab('lista')} className="p-4 rounded-2xl bg-red-950/20 border border-red-500/30 cursor-pointer hover:border-red-500/60 transition-colors flex flex-col shadow-lg shadow-red-900/5">
            <div className="text-xs font-bold uppercase text-[#ff3b3b] flex justify-between">Gastos Hoje <TrendingDown className="w-3.5 h-3.5" /></div>
            <div className="text-xl font-mono font-black text-[#ff3b3b] mt-1.5">-{formatCurrency(todayExpensesTotal)}</div>
          </div>
          <div onClick={() => setActiveTab('lucro')} className={`p-4 rounded-2xl border cursor-pointer transition-colors flex flex-col ${todayNetProfit >= 0 ? 'bg-emerald-950/20 border-emerald-500/40 hover:border-emerald-500/70' : 'bg-red-950/30 border-red-500/50 hover:border-red-500/80'}`}>
            <div className="text-xs font-bold uppercase flex justify-between"><span className={todayNetProfit >= 0 ? 'text-emerald-300' : 'text-[#ff3b3b]'}>Lucro Hoje</span> <TrendingUp className="w-3.5 h-3.5" /></div>
            <div className={`text-xl font-mono font-black mt-1.5 ${todayNetProfit >= 0 ? 'text-emerald-400' : 'text-[#ff3b3b]'}`}>{formatCurrency(todayNetProfit)}</div>
          </div>
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col">
            <div className="text-xs font-bold uppercase text-slate-500">Lucro Geral</div>
            <div className="text-xl font-mono font-black text-white mt-1.5">{formatCurrency(totalRevenue - totalExpensesSum)}</div>
          </div>
        </div>

        <div className="px-4 pt-3 flex items-center gap-2 border-b border-slate-800 bg-slate-900/60 overflow-x-auto">
          <button onClick={() => { setActiveTab('cadastrar'); setEditingExpense(null); resetForm(); }} className={`px-5 py-3 rounded-t-xl text-sm font-bold border-b-2 transition-all whitespace-nowrap ${activeTab === 'cadastrar' && !editingExpense ? 'border-red-500 text-red-500 bg-red-500/10' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>+ Novo Gasto</button>
          {editingExpense && <button className="px-5 py-3 rounded-t-xl text-sm font-bold border-b-2 border-amber-400 text-amber-300 bg-amber-500/10 flex items-center gap-2 whitespace-nowrap"><Pencil className="w-3.5 h-3.5" /> Editando</button>}
          <button onClick={() => setActiveTab('lista')} className={`px-5 py-3 rounded-t-xl text-sm font-bold border-b-2 transition-all whitespace-nowrap ${activeTab === 'lista' ? 'border-cyan-400 text-cyan-300 bg-cyan-500/10' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>Extrato ({expenses.length})</button>
          <button onClick={() => setActiveTab('lucro')} className={`px-5 py-3 rounded-t-xl text-sm font-bold border-b-2 transition-all whitespace-nowrap ${activeTab === 'lucro' ? 'border-emerald-400 text-emerald-300 bg-emerald-500/10' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>Demonstrativo</button>
        </div>

        {successToast && <div className="mx-4 mt-3 p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 text-xs font-bold flex items-center gap-2 animate-fadeIn"><CheckCircle className="w-4 h-4 text-emerald-400" /> {successToast}</div>}

        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {activeTab === 'cadastrar' && (
            <form onSubmit={handleRegisterExpense} className="space-y-4">
              <div className={`p-4 rounded-2xl border text-sm flex items-center gap-3 ${editingExpense ? 'bg-amber-500/10 border-amber-500/30 text-amber-300' : 'bg-red-500/10 border-red-500/30 text-red-500'}`}>
                <AlertCircle className={`w-5 h-5 ${editingExpense ? 'text-amber-400' : 'text-red-500'}`} />
                <span>{editingExpense ? `Editando lançamento #${editingExpense.id}.` : 'Cadastre gastos para abater do lucro real.'}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">Descrição do Gasto *</label>
                  <input type="text" required value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex: Gás Refrigerante R134a" className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm outline-none focus:border-red-400 focus:ring-1 focus:ring-red-400" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-300">Valor (R$) *</label>
                  <input type="number" step="0.01" min="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-700 text-red-500 font-mono font-bold text-lg outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">Data *</label>
                  <input type="date" required value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm outline-none focus:border-cyan-400" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">Categoria *</label>
                  <select value={category} onChange={(e) => setCategory(e.target.value as ExpenseCategory)} className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm outline-none focus:border-cyan-400">
                    {CATEGORIES.map(c => <option key={c.label} value={c.label}>{c.icon} {c.label}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">Forma de Pagamento</label>
                  <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)} className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm outline-none focus:border-cyan-400">
                    {["Pix", "Dinheiro", "Cartão de Débito", "Cartão de Crédito", "Boleto Bancário", "Transferência / TED"].map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">Técnico / Responsável</label>
                  <input type="text" value={responsibleName} onChange={(e) => setResponsibleName(e.target.value)} placeholder="Nome do técnico" className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm outline-none focus:border-cyan-400" />
                </div>
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">Vincular OS (Opcional)</label>
                  <select value={relatedOrderId} onChange={(e) => setRelatedOrderId(e.target.value)} className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm outline-none focus:border-cyan-400 font-mono">
                    <option value="">Sem vínculo / Gasto Geral</option>
                    {orders.slice(0, 50).map(o => <option key={o.id} value={o.id}>{o.id} - {o.customerName}</option>)}
                  </select>
                </div>
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">Observações</label>
                  <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Detalhes adicionais..." className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs outline-none focus:border-cyan-400 resize-none" />
                </div>
              </div>
              <div className="pt-4 flex justify-end gap-3 border-t border-slate-800">
                <button type="button" onClick={() => { if(editingExpense) { setEditingExpense(null); resetForm(); setActiveTab('lista'); } else { onClose(); } }} className="px-5 py-3 text-sm font-bold text-slate-400 hover:text-white transition-colors">{editingExpense ? 'Cancelar' : 'Fechar'}</button>
                <button type="submit" disabled={isSubmitting} className={`px-8 py-3 rounded-xl font-black text-sm shadow-lg active:scale-95 transition-all ${editingExpense ? 'bg-amber-500 hover:bg-amber-400 text-slate-950' : 'bg-[#ff3b3b] hover:bg-red-500 text-white'}`}>{editingExpense ? 'Salvar Alterações' : 'Salvar Gasto'}</button>
              </div>
            </form>
          )}

          {activeTab === 'lista' && (
            <div className="space-y-3.5">
              <div className="flex flex-col sm:flex-row gap-2.5 justify-between">
                <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                  {['hoje', 'mes', 'todos'].map(p => (
                    <button key={p} onClick={() => setPeriodFilter(p as any)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${periodFilter === p ? 'bg-red-500 text-slate-950 shadow-md' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>{p === 'hoje' ? 'Hoje' : p === 'mes' ? 'Mês' : `Todos (${expenses.length})`}</button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Filtrar..." className="pl-9 pr-4 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-white outline-none focus:border-red-500 w-full sm:w-52" />
                  </div>
                  <button onClick={() => { setEditingExpense(null); resetForm(); setActiveTab('cadastrar'); }} className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-black shrink-0 active:scale-95 transition-all shadow-lg shadow-red-900/20">+ Novo</button>
                </div>
              </div>
              <div className="space-y-2">
                {filteredExpenses.length === 0 ? (
                  <div className="p-10 rounded-3xl bg-slate-950/60 border border-slate-800 text-center space-y-2">
                    <Receipt className="w-10 h-10 text-slate-700 mx-auto" />
                    <p className="text-sm font-bold text-slate-400">Nenhum gasto encontrado.</p>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between text-[10px] text-slate-500 font-mono px-1"><span>{filteredExpenses.length} itens</span> <span>Total: <strong className="text-red-400">-{formatCurrency(filteredExpensesTotal)}</strong></span></div>
                    {filteredExpenses.map(exp => {
                      const catInfo = CATEGORIES.find(c => c.label === exp.category) || CATEGORIES[5];
                      return (
                        <div key={exp.id} className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex justify-between items-center group animate-fadeIn hover:border-slate-700 transition-all">
                          <div className="space-y-1 min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${catInfo.color}`}>{catInfo.icon} {exp.category}</span>
                              <span className="text-[9px] font-mono text-slate-500 flex items-center gap-1"><Calendar className="w-2.5 h-2.5" /> {formatDate(exp.date)}</span>
                              {exp.relatedOrderId && <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-900 text-amber-400 border border-amber-500/20">OS: {exp.relatedOrderId}</span>}
                            </div>
                            <h4 className="text-sm font-bold text-white truncate group-hover:text-red-300 transition-colors">{exp.description}</h4>
                            <p className="text-[10px] text-slate-500">Por: <strong className="text-slate-400">{exp.createdBy}</strong> • {exp.paymentMethod}</p>
                          </div>
                          <div className="flex items-center gap-4 ml-3">
                            <div className="text-right">
                              <div className="text-base font-mono font-black text-red-500">-{formatCurrency(exp.amount)}</div>
                              <div className="text-[10px] text-slate-600 font-mono">{exp.id}</div>
                            </div>
                            <div className="flex gap-1.5">
                              <button onClick={() => handleEditClick(exp)} className="p-2.5 rounded-lg text-slate-500 hover:text-amber-400 hover:bg-amber-500/10 transition-colors" title="Editar"><Pencil className="w-5 h-5" /></button>
                              <button onClick={() => setDeleteConfirmationId(exp.id)} className="p-2.5 rounded-lg text-slate-500 hover:text-red-500 hover:bg-red-500/10 transition-colors" title="Excluir"><Trash2 className="w-5 h-5" /></button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            </div>
          )}

          {activeTab === 'lucro' && (
            <div className="space-y-4">
              <div className="p-5 rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 border border-slate-800 space-y-4">
                <h4 className="text-xs font-bold uppercase text-cyan-400 tracking-widest flex items-center gap-2"><PieChart className="w-4 h-4" /> Demonstrativo de Lucro Real de Hoje</h4>
                <div className="space-y-2.5 text-sm font-mono">
                  <div className="flex justify-between p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-slate-400 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-cyan-400" /> (+) Faturamento Bruto Hoje</span>
                    <strong className="text-cyan-400 text-xl">{formatCurrency(todayRevenue)}</strong>
                  </div>
                  <div className="flex justify-between p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-slate-400 flex items-center gap-2"><TrendingDown className="w-4 h-4 text-red-500" /> (-) Total de Gastos Hoje</span>
                    <strong className="text-red-500 text-xl">-{formatCurrency(todayExpensesTotal)}</strong>
                  </div>
                  <div className="h-px bg-slate-800 my-1" />
                  <div className={`flex justify-between p-5 rounded-2xl border-2 ${todayNetProfit >= 0 ? 'bg-emerald-500/5 border-emerald-500/30 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.1)]' : 'bg-red-500/5 border-red-500/30 text-red-500'}`}>
                    <span className="font-black text-lg flex items-center gap-2"><Sparkles className="w-6 h-6" /> (=) LUCRO LÍQUIDO</span>
                    <div className="text-right">
                      <div className="text-3xl font-black">{formatCurrency(todayNetProfit)}</div>
                      <div className="text-xs opacity-80">{todayProfitMargin.toFixed(1)}% de margem</div>
                    </div>
                  </div>

                  {onOpenReport && (
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenReport();
                        }}
                        className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all cursor-pointer"
                      >
                        <BarChart3 className="w-4 h-4" />
                        <span>Abrir Tela Completa de Relatório (Dia, Semana, Mês, Período)</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex justify-between items-center">
          <div className="flex flex-col"><span className="text-[10px] text-slate-500 uppercase font-bold tracking-tighter">Acumulado Geral</span><span className="text-xs font-mono font-black text-red-500">-{formatCurrency(totalExpensesSum)}</span></div>
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-black text-xs transition-all active:scale-95 shadow-lg">FECHAR</button>
        </div>
      </div>
    </div>
  );
};
