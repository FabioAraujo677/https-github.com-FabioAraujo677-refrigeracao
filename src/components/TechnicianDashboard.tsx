import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Wrench, 
  Search, 
  LogOut, 
  Map as MapIcon, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  LayoutDashboard,
  Calendar,
  CalendarDays,
  CalendarClock,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Filter,
  Check,
  CalendarRange,
  Volume2,
  VolumeX,
  Bell,
  Lock,
  AlertTriangle
} from 'lucide-react';
import { User, WarrantyOrder, CompanySettings } from '../types';
import { TechnicianOrderCard } from './TechnicianOrderCard';
import { TechnicianCompletionModal } from './TechnicianCompletionModal';
import { ReceiptModal } from './ReceiptModal';
import { sbGetOrders, sbSaveOrder } from '../utils/supabaseService';
import { getOrders, updateOrder, saveOrders, mergeOrders } from '../utils/storage';
import { initRealtimeSync, addSyncListener, fetchServerState } from '../utils/cloudSync';
import { formatDate, formatDateWithWeekday, extractDateOnly, getLocalDateString } from '../utils/formatters';
import { PWAInstallButton } from './PWAInstallButton';
import { sendBrowserNotification } from '../utils/notifications';

interface TechnicianDashboardProps {
  user: User;
  company: CompanySettings;
  onLogout: () => void;
}

export type TechFilterType = 'hoje' | 'futuros' | 'concluidos' | 'aguardando' | 'campo' | 'data' | 'todos';

export function isOrderForTechnician(order: WarrantyOrder, techUser: User): boolean {
  if (!techUser) return true;
  if (techUser.role === 'admin' || techUser.role === 'gerente' || techUser.role === 'atendente') {
    return true; // Admins and attendants can see all orders in technician view
  }

  // Check all possible technician fields regardless of column name in database
  const possibleTechValues = [
    order.technicianName,
    (order as any).technician,
    (order as any).technician_name,
    (order as any).technician_id,
    (order as any).tech_name,
    (order as any).tecnico,
    (order as any).tech,
    (order as any).assigned_to,
  ].filter(Boolean);

  const rawUserName = (techUser.name || '').trim().toLowerCase();
  const rawUserEmail = (techUser.email || '').trim().toLowerCase();
  const rawUserId = (techUser.id || '').trim().toLowerCase();

  // If order has no technician assigned yet in ANY field, show it so tech can see unassigned visits
  if (possibleTechValues.length === 0) {
    return true;
  }

  for (const val of possibleTechValues) {
    const rawOrderTech = String(val).trim().toLowerCase();

    if (
      !rawOrderTech ||
      rawOrderTech === 'não atribuído' ||
      rawOrderTech.includes('selecione') ||
      rawOrderTech === 'técnico especialista'
    ) {
      return true;
    }

    // Direct ID match (e.g. technician_id matches techUser.id)
    if (rawUserId && (rawOrderTech === rawUserId || rawOrderTech.includes(rawUserId))) {
      return true;
    }

    // Clean strings by removing "(tecnico)", "(atendente)", "(motorista)", etc.
    const orderTech = rawOrderTech.replace(/\([^)]*\)/g, '').trim();
    const userName = rawUserName.replace(/\([^)]*\)/g, '').trim();

    // Direct or substring match
    if (rawOrderTech.includes(rawUserName) || rawUserName.includes(rawOrderTech)) return true;
    if (orderTech && userName && (orderTech.includes(userName) || userName.includes(orderTech))) return true;

    // Token match (e.g. "wilian" in "wilian pereira")
    const userTokens = userName.split(/\s+/).filter(t => t.length >= 2);
    const orderTechTokens = orderTech.split(/\s+/).filter(t => t.length >= 2);

    for (const uToken of userTokens) {
      if (orderTechTokens.some(oToken => oToken.includes(uToken) || uToken.includes(oToken))) {
        return true;
      }
    }

    // Email username match (e.g. "wilian@tecnico.com" -> "wilian")
    if (rawUserEmail && rawUserEmail.includes('@')) {
      const emailPrefix = rawUserEmail.split('@')[0].trim();
      if (emailPrefix.length >= 2 && (rawOrderTech.includes(emailPrefix) || emailPrefix.includes(rawOrderTech))) {
        return true;
      }
    }
  }

  return false;
}

export function TechnicianDashboard({ user, company, onLogout }: TechnicianDashboardProps) {
  const [orders, setOrders] = useState<WarrantyOrder[]>(getOrders());
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const [filter, setFilterState] = useState<TechFilterType>(() => {
    try {
      const saved = sessionStorage.getItem('neo_tech_filter');
      if (saved) return saved as TechFilterType;
    } catch (e) {}
    return 'hoje';
  });
  const setFilter = (f: TechFilterType) => {
    setFilterState(f);
    try {
      sessionStorage.setItem('neo_tech_filter', f);
    } catch (e) {}
  };
  const [selectedCustomDate, setSelectedCustomDate] = useState<string>('');
  const [selectedOrderForCompletion, setSelectedOrderForCompletion] = useState<WarrantyOrder | null>(null);
  const [selectedOrderForReceipt, setSelectedOrderForReceipt] = useState<WarrantyOrder | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [warningToast, setWarningToast] = useState<string | null>(null);
  const [audioEnabled, setAudioEnabled] = useState<boolean>(true);
  const audioContextRef = useRef<AudioContext | null>(null);

  const todayStr = getLocalDateString();

  const loadData = async () => {
    try {
      // 1. Carrega imediatamente dados locais
      const localOrders = getOrders();
      if (localOrders && localOrders.length > 0) {
        setOrders([...localOrders]);
      }

      // 2. Sincroniza com servidor centralizado
      await fetchServerState();
      setOrders([...getOrders()]);

      // 3. Fallback Supabase (Merge em vez de sobrescrever dados novos)
      const data = await sbGetOrders(user.companyId);
      if (data && data.length > 0) {
        mergeOrders(data);
        setOrders([...getOrders()]);
      }
    } catch (err) {
      console.error('Error loading technician orders:', err);
      setOrders([...getOrders()]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    initRealtimeSync();
    loadData();

    const unsub = addSyncListener((payload) => {
      console.log('[TechnicianDashboard] Sync event received:', payload);
      setOrders([...getOrders()]);

      if (payload.table === 'orders' && (payload.action === 'INSERT' || payload.action === 'UPDATE')) {
        const orderData = payload.data as WarrantyOrder;
        if (orderData && isOrderForTechnician(orderData, user)) {
          const title = payload.action === 'INSERT' ? '🚀 NOVO AGENDAMENTO RECEBIDO!' : '🔔 AGENDAMENTO ATUALIZADO!';
          const body = `${orderData.id} - ${orderData.customerName || 'Cliente'}\nData: ${orderData.scheduledDate || 'Hoje'} às ${orderData.scheduledTime || 'Sem horário'}`;
          sendBrowserNotification(title, body, orderData.id);
          setSuccessToast(`🚀 NOVO AGENDAMENTO RECEBIDO: ${orderData.id} (${orderData.customerName || 'Cliente'}) - Visita Agendada!`);
          playAlarmTones();
          setTimeout(() => setSuccessToast(null), 10000);
        }
      }
    });

    const interval = setInterval(loadData, 15000);
    return () => {
      unsub();
      clearInterval(interval);
    };
  }, [user.companyId]);

  // DERIVED STATE: Filter orders assigned to this technician (or unassigned)
  const techOrders = useMemo(() => {
    return orders.filter(o => isOrderForTechnician(o, user));
  }, [orders, user]);

  const activeInFieldOrder = useMemo(() => 
    techOrders.find(o => o.attendanceStatus === 'Em campo'),
  [techOrders]);

  const hasActiveVisit = !!activeInFieldOrder;

  const isOrderAlarming = (order: WarrantyOrder) => {
    if (order.attendanceStatus !== 'Na fila / Aguardando') return false;
    return true; // Se está na fila aguardando atendimento, deve tocar alarme para o técnico
  };

  const alarmingOrders = useMemo(() => 
    techOrders.filter(o => isOrderAlarming(o)),
  [techOrders]);

  const filteredOrders = useMemo(() => {
    return techOrders.filter(order => {
      // Search
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesSearch = 
          (order.customerName && order.customerName.toLowerCase().includes(q)) ||
          (order.id && order.id.toLowerCase().includes(q)) ||
          (order.applianceType && order.applianceType.toLowerCase().includes(q)) ||
          (order.technicianName && order.technicianName.toLowerCase().includes(q));
        if (!matchesSearch) return false;
      }

      const orderDate = extractDateOnly(order.scheduledDate || order.createdAt);

      if (filter === 'hoje') {
        // Exibe ordens de hoje, anteriores ou que estejam pendentes em fila/campo
        return (
          (orderDate <= todayStr || !orderDate || order.attendanceStatus === 'Na fila / Aguardando' || order.attendanceStatus === 'Em campo') &&
          order.attendanceStatus !== 'Concluído' &&
          order.attendanceStatus !== 'Pendente Confirmação'
        );
      }
      if (filter === 'futuros') {
        return (
          orderDate > todayStr &&
          order.attendanceStatus !== 'Concluído' &&
          order.attendanceStatus !== 'Na fila / Aguardando' &&
          order.attendanceStatus !== 'Em campo'
        );
      }
      if (filter === 'concluidos') return order.attendanceStatus === 'Concluído' || order.attendanceStatus === 'Pendente Confirmação';
      if (filter === 'aguardando') return order.attendanceStatus === 'Na fila / Aguardando';
      if (filter === 'campo') return order.attendanceStatus === 'Em campo';
      if (filter === 'data') return orderDate === selectedCustomDate;
      
      return true; // 'todos'
    });
  }, [techOrders, filter, searchQuery, todayStr, selectedCustomDate]);

  const countStats = useMemo(() => {
    const hoje = techOrders.filter(o => (extractDateOnly(o.scheduledDate || o.createdAt) <= todayStr || !o.scheduledDate || o.attendanceStatus === 'Na fila / Aguardando' || o.attendanceStatus === 'Em campo') && o.attendanceStatus !== 'Concluído' && o.attendanceStatus !== 'Pendente Confirmação').length;
    const futuros = techOrders.filter(o => extractDateOnly(o.scheduledDate || o.createdAt) > todayStr && o.attendanceStatus !== 'Concluído' && o.attendanceStatus !== 'Na fila / Aguardando' && o.attendanceStatus !== 'Em campo').length;
    const concluidos = techOrders.filter(o => o.attendanceStatus === 'Concluído' || o.attendanceStatus === 'Pendente Confirmação').length;
    const aguardando = techOrders.filter(o => o.attendanceStatus === 'Na fila / Aguardando').length;
    const campo = techOrders.filter(o => o.attendanceStatus === 'Em campo').length;
    const todos = techOrders.length;

    return { hoje, futuros, concluidos, aguardando, campo, todos };
  }, [techOrders, todayStr]);

  const playAlarmTones = () => {
    if (!audioEnabled) return;
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } catch (e) {}
  };

  useEffect(() => {
    if (alarmingOrders.length > 0 && audioEnabled) {
      const timer = setInterval(playAlarmTones, 3000);
      return () => clearInterval(timer);
    }
  }, [alarmingOrders.length, audioEnabled]);

  const handleAcceptVisit = async (id: string) => {
    if (hasActiveVisit && activeInFieldOrder?.id !== id) {
      setWarningToast(
        `Ação Bloqueada: Você já está em atendimento na OS ${activeInFieldOrder?.id} (${activeInFieldOrder?.customerName}). Finalize-a antes de iniciar outro atendimento.`
      );
      setTimeout(() => setWarningToast(null), 5000);
      return;
    }

    const order = orders.find(o => o.id === id);
    if (!order) return;

    const updated = updateOrder(id, {
      attendanceStatus: 'Em campo',
      technicianAcceptedAt: new Date().toISOString()
    });

    if (updated) {
      setOrders(getOrders());
      sbSaveOrder(updated, user.companyId).catch(() => {});
      setSuccessToast(`Visita #${id} iniciada com sucesso! Alarme sonoro silenciado.`);
      setTimeout(() => setSuccessToast(null), 4000);
    }
  };

  const handleCompleteService = async (id: string, updates: Partial<WarrantyOrder>) => {
    const order = orders.find(o => o.id === id);
    if (!order) return;

    const updated = updateOrder(id, {
      ...updates,
      attendanceStatus: 'Pendente Confirmação',
    });

    if (updated) {
      setOrders(getOrders());
      sbSaveOrder(updated, user.companyId).catch(() => {});
      setFilter('concluidos');
      setSuccessToast(`Serviço ${id} finalizado e devolvido ao gerente com sucesso!`);
      setTimeout(() => setSuccessToast(null), 5000);
    }
  };

  const handleMoveToToday = async (id: string) => {
    const order = orders.find(o => o.id === id);
    if (!order) return;

    const updated = updateOrder(id, {
      scheduledDate: todayStr,
    });

    if (updated) {
      setOrders(getOrders());
      sbSaveOrder(updated, user.companyId).catch(() => {});
      setFilter('hoje');
      setSuccessToast(`Agendamento #${id} transferido para a lista de Hoje!`);
      setTimeout(() => setSuccessToast(null), 4000);
    }
  };

  const tabs = [
    { id: 'hoje', label: 'Hoje', count: countStats.hoje, icon: Calendar, color: 'text-cyan-400' },
    { id: 'futuros', label: 'Futuros', count: countStats.futuros, icon: CalendarClock, color: 'text-indigo-400' },
    { id: 'concluidos', label: 'Concluídos', count: countStats.concluidos, icon: CheckCircle2, color: 'text-emerald-400' },
    { id: 'aguardando', label: 'Na Fila', count: countStats.aguardando, icon: Clock, color: 'text-amber-400' },
    { id: 'campo', label: 'Em Rota', count: countStats.campo, icon: MapIcon, color: 'text-purple-400' },
    { id: 'todos', label: 'Todos', count: countStats.todos, icon: LayoutDashboard, color: 'text-slate-400' },
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0f1115] flex items-center justify-center">
        <div className="h-12 w-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f1115] text-slate-100 pb-12 font-sans">
      {/* Background blurs */}
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-0 right-1/4 w-96 h-96 bg-indigo-600/5 rounded-full blur-3xl pointer-events-none" />

      {/* Floating Success Toast */}
      {successToast && (
        <div className="fixed top-4 right-4 z-50 max-w-md p-3 rounded-xl bg-slate-900 border border-emerald-500/50 shadow-2xl flex items-center gap-3 animate-fadeIn">
          <div className="h-8 w-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div className="text-[11px]">
            <p className="font-bold text-white uppercase tracking-tight">Sucesso</p>
            <p className="text-slate-400">{successToast}</p>
          </div>
        </div>
      )}

      {/* Floating Warning Toast */}
      {warningToast && (
        <div className="fixed top-4 right-4 z-50 max-w-md p-3 rounded-xl bg-slate-900 border border-amber-500/60 shadow-2xl flex items-center gap-3 animate-fadeIn">
          <div className="h-8 w-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
            <Lock className="w-4 h-4" />
          </div>
          <div className="text-[11px]">
            <p className="font-bold text-amber-300 uppercase tracking-tight">Bloqueado</p>
            <p className="text-slate-400">{warningToast}</p>
          </div>
        </div>
      )}

      {/* Technician Header (Compact) */}
      <header className="sticky top-0 z-40 bg-[#121418]/90 backdrop-blur-xl border-b border-white/5 px-4 py-2">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-slate-900 border border-cyan-500/30 flex items-center justify-center">
              <Wrench className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xs font-black text-white uppercase tracking-wider">Painel do Func. Campo</h1>
                <span className="text-[9px] font-mono font-black bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-2 py-0.5 rounded-full hidden sm:inline">
                  V2.0
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-cyan-500/70 font-bold">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>{user.name}</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <PWAInstallButton variant="header" />

            <button
              type="button"
              onClick={() => setAudioEnabled(!audioEnabled)}
              className={`p-2 rounded-lg border text-[10px] font-black uppercase transition-all flex items-center gap-1.5 ${
                audioEnabled
                  ? 'bg-purple-500/10 border-purple-500/40 text-purple-300 hover:bg-purple-500/20'
                  : 'bg-white/5 border-white/5 text-slate-500'
              }`}
            >
              {audioEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{audioEnabled ? 'Alarme On' : 'Mudo'}</span>
            </button>

            <button 
              onClick={onLogout}
              className="p-2 rounded-lg bg-white/5 border border-white/5 text-slate-400 hover:text-rose-400 transition-all flex items-center gap-1.5 text-[10px] font-bold uppercase"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-4 space-y-4">
        {/* Continuous Alarm Banner (Compact) */}
        {alarmingOrders.length > 0 && (
          <div className="p-3 sm:p-4 rounded-2xl bg-gradient-to-r from-rose-950/80 to-slate-900 border border-rose-500/50 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3 animate-fadeIn">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-xl bg-rose-500/20 flex items-center justify-center text-rose-400 shrink-0">
                <Volume2 className="w-5 h-5 animate-bounce" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[8px] font-black uppercase tracking-widest bg-rose-600 text-white px-1.5 py-0.5 rounded flex items-center gap-1">
                    Alarme Ativo
                  </span>
                  <span className="text-[10px] text-rose-300 font-bold uppercase">
                    Nova OS Pendente
                  </span>
                </div>
                <h3 className="text-sm font-black text-white mt-0.5">
                  {alarmingOrders[0].customerName} • {alarmingOrders[0].id}
                </h3>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
              <button
                type="button"
                onClick={() => handleAcceptVisit(alarmingOrders[0].id)}
                className="flex-1 md:flex-none px-4 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-orange-600 hover:from-rose-500 hover:to-orange-500 text-white font-black text-[10px] uppercase tracking-wider shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Aceitar Agora</span>
              </button>
            </div>
          </div>
        )}

        {/* Active In-Field Visit Card (Compact) */}
        {hasActiveVisit && (
          <div className="p-3 sm:p-4 rounded-2xl bg-[#121418] border border-purple-500/40 shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400">
                <MapIcon className="w-4 h-4 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[8px] font-black uppercase tracking-widest bg-purple-600 text-white px-1.5 py-0.5 rounded">Em Campo</span>
                  <span className="text-[10px] font-mono font-bold text-slate-400">{activeInFieldOrder?.id}</span>
                </div>
                <h4 className="text-sm font-black text-white">{activeInFieldOrder?.customerName}</h4>
              </div>
            </div>

            <button
              type="button"
              onClick={() => activeInFieldOrder && setSelectedOrderForCompletion(activeInFieldOrder)}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10px] uppercase tracking-wider active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Finalizar</span>
            </button>
          </div>
        )}

        {/* Main Stats (Compact) */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {tabs.slice(0, 4).map((tab) => (
            <div 
              key={tab.id}
              onClick={() => { setFilter(tab.id as TechFilterType); setSelectedCustomDate(''); }}
              className={`p-3 rounded-xl border cursor-pointer transition-all ${
                filter === tab.id ? 'bg-cyan-950/20 border-cyan-500/50' : 'bg-[#121418] border-white/5 hover:bg-white/5'
              }`}
            >
              <div className="flex items-center justify-between mb-0.5">
                <p className={`text-[9px] uppercase font-black ${filter === tab.id ? 'text-cyan-400' : 'text-slate-500'}`}>{tab.label}</p>
                <tab.icon className={`w-3 h-3 ${filter === tab.id ? 'text-cyan-400' : 'text-slate-600'}`} />
              </div>
              <p className="text-2xl font-black text-white font-num">{tab.count}</p>
            </div>
          ))}
        </section>

        {/* Filter Navigation (Compact) */}
        <section className="space-y-3">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
            {tabs.map((tab) => {
              const isActive = filter === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setFilter(tab.id as TechFilterType);
                    setSelectedCustomDate('');
                  }}
                  className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider whitespace-nowrap flex items-center gap-1.5 transition-all border ${
                    isActive 
                      ? 'bg-cyan-600 text-white border-cyan-500 shadow-lg' 
                      : 'bg-[#121418] border-white/5 text-slate-500 hover:text-slate-300'
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Search (Compact) */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-600" />
            <input 
              type="text"
              placeholder="Buscar..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#121418] border border-white/5 text-white text-xs focus:border-cyan-500/40 focus:outline-none transition-all placeholder:text-slate-700"
            />
          </div>
        </section>

        {/* Orders List */}
        <section className="space-y-3">
          {filteredOrders.length === 0 ? (
            <div className="text-center py-12 bg-white/[0.02] rounded-2xl border border-dashed border-white/5">
              <AlertCircle className="w-8 h-8 text-slate-700 mx-auto mb-2" />
              <p className="text-slate-500 font-bold text-xs uppercase tracking-widest">Vazio</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {filteredOrders.map(order => (
                <TechnicianOrderCard 
                  key={order.id} 
                  order={order} 
                  onAccept={handleAcceptVisit}
                  onComplete={setSelectedOrderForCompletion}
                  onViewReceipt={setSelectedOrderForReceipt}
                  onMoveToToday={filter === 'futuros' || filter === 'data' ? handleMoveToToday : undefined}
                  isLocked={hasActiveVisit && order.id !== activeInFieldOrder?.id}
                  lockedReason={
                    hasActiveVisit 
                      ? `Atendimento #${activeInFieldOrder?.id} em andamento.` 
                      : undefined
                  }
                  isAlarming={isOrderAlarming(order)}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Modals */}
      {selectedOrderForCompletion && (
        <TechnicianCompletionModal
          isOpen={Boolean(selectedOrderForCompletion)}
          onClose={() => setSelectedOrderForCompletion(null)}
          order={selectedOrderForCompletion}
          onSave={handleCompleteService}
        />
      )}

      {selectedOrderForReceipt && (
        <ReceiptModal
          order={selectedOrderForReceipt}
          company={company}
          isOpen={Boolean(selectedOrderForReceipt)}
          onClose={() => setSelectedOrderForReceipt(null)}
        />
      )}
    </div>
  );
}
