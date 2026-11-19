/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Wrench,
  Plus,
  X,
  Search,
  Filter,
  Share2,
  Printer,
  Download,
  Calendar,
  Clock,
  MapPin,
  Phone,
  User as UserIcon,
  Crown,
  Settings,
  LogOut,
  LogIn,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Trash2,
  Pencil,
  Sparkles,
  ChevronRight,
  ExternalLink,
  Cpu,
  Layers,
  ArrowUpRight,
  Users,
  Truck,
  List,
  LayoutGrid,
  Send,
  TrendingDown,
  TrendingUp,
  DollarSign,
  PlusCircle,
  Receipt,
  BarChart3,
  Bell,
  Volume2,
  BookOpenCheck,
  MessageSquare,
  CalendarDays,
  UserCheck,
  ReceiptText,
  QrCode,
  Copy,
} from 'lucide-react';
import { CarneSale, CarneSettings, CompanySettings, Expense, StaffMember, User, WarrantyOrder } from './types';
import confetti from 'canvas-confetti';
import { requestNotificationPermission, sendBrowserNotification } from './utils/notifications';
import { playScheduleConfirmedSound, playTechAlertMelody } from './utils/audio';
import { superdb, superdbSchema } from './lib/superdbClient';
import {
  getCarnes,
  getCarneSettings,
  saveCarneSettings,
  saveCarnes,
  mergeCarnes,
  getCarneDueAlerts,
  deleteCarneSale,
} from './utils/carneStorage';
import {
  getCompanySettings,
  getCurrentUser,
  getOrders,
  fetchOrdersFromSupabase,
  getStaff,
  getExpenses,
  getDeliveries,
  saveCompanySettings,
  logoutUser,
  addOrder,
  updateOrder,
  deleteOrder,
  getUsers,
  addDelivery,
  updateDelivery,
  deleteDelivery,
  upsertCustomerFromOrder,
  saveOrders,
  saveStaff,
  saveExpenses,
  saveDeliveries,
  saveCustomers,
  syncAllStaffToUsers,
  mergeOrders,
} from './utils/storage';
import {
  sbGetOrders,
  sbSaveOrder,
  sbGetStaff,
  sbGetExpenses,
  sbGetCompany,
  sbGetDeliveries,
  sbGetCustomers,
  sbSelectByCompany,
  resolveCompanyId,
  setActiveCompanyId,
  setSupabaseSyncAuthorized,
  sbDeleteOrder,
  normalizeOrder,
  normalizeCompanyProfile,
  isCarneOrderRow,
  isCarneConfigRow,
  extractCarneFromOrderRow,
  extractCarneSettingsFromOrderRow,
  syncGiLojaDeBoloOrderTypeIfNeeded,
} from './utils/supabaseService';
import { formatCurrency, formatDate, formatDateTime, formatDateWithWeekday, getDaysRemaining, cleanNumeric, extractDateOnly, getLocalDateString } from './utils/formatters';
import { downloadOrderServicePdf } from './utils/pdfGenerator';
import { buildPixQrSvgData, generatePixPayload } from './utils/pixGenerator';
import { OrderFormModal } from './components/OrderFormModal';
import { OrderListRow } from './components/OrderListRow';
import { ReceiptModal } from './components/ReceiptModal';
import { ScheduleModal } from './components/ScheduleModal';
import { ScheduleReceiptModal } from './components/ScheduleReceiptModal';
import { AuthModal } from './components/AuthModal';
import { CompanySettingsModal } from './components/CompanySettingsModal';
import { AttendanceDashboard, DashboardFilter, getPaidVisitOnlyValue, isPaidVisitOnlyOrder, isPaidVisitOnlyToday, isPagoVisitaOrder } from './components/AttendanceDashboard';
import { StaffManagementModal } from './components/StaffManagementModal';
import { ExpensesModal } from './components/ExpensesModal';
import { DeliveryModal } from './components/DeliveryModal';
import { CustomerManagementModal } from './components/CustomerManagementModal';
import { FinancialReportScreen } from './components/FinancialReportScreen';
import { TechnicianDashboard } from './components/TechnicianDashboard';
import { DriverDashboard } from './components/DriverDashboard';
import { PWAInstallButton } from './components/PWAInstallButton';
import { CarneModal } from './components/CarneModal';
import { ReturnScheduleModal } from './components/ReturnScheduleModal';
import { isWarrantyReturnOrder } from './utils/returnHelpers';

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: any }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0f1115] text-white flex flex-col items-center justify-center p-6 text-center">
          <div className="max-w-md bg-slate-900 border border-cyan-500/30 rounded-3xl p-8 shadow-2xl">
            <h2 className="text-xl font-bold text-cyan-400 mb-2">Sistema Operando com Modo de Recuperação</h2>
            <p className="text-xs text-slate-300 mb-6">Ocorreu um pequeno erro de renderização, mas seus dados locais estão seguros.</p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs rounded-xl shadow-lg"
            >
              Recarregar Sistema
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppInner />
    </ErrorBoundary>
  );
}

function AppInner() {
  const [currentUser, setCurrentUser] = useState<User | null>(() => getCurrentUser());
  const [company, setCompany] = useState<CompanySettings>(getCompanySettings());
  const [orders, setOrders] = useState<WarrantyOrder[]>(getOrders());
  const [staffList, setStaffList] = useState<StaffMember[]>(getStaff());
  const [expenses, setExpenses] = useState<Expense[]>(getExpenses());
  const [deliveries, setDeliveries] = useState(getDeliveries());

  // UI Modals & Session State Recovery
  const getSavedAppSession = () => {
    try {
      const raw = sessionStorage.getItem('neo_app_session_state');
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return {};
  };
  const savedSession = getSavedAppSession();

  const [isOrderModalOpen, setIsOrderModalOpen] = useState<boolean>(() => Boolean(savedSession.isOrderModalOpen));
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState<boolean>(() => Boolean(savedSession.isScheduleModalOpen));
  const [isStaffModalOpen, setIsStaffModalOpen] = useState<boolean>(() => Boolean(savedSession.isStaffModalOpen));
  const [orderToEdit, setOrderToEdit] = useState<WarrantyOrder | null>(null);
  const [orderToDelete, setOrderToDelete] = useState<WarrantyOrder | null>(null);
  const [orderForReturn, setOrderForReturn] = useState<WarrantyOrder | null>(null);
  const [selectedReceiptOrder, setSelectedReceiptOrder] = useState<WarrantyOrder | null>(null);
  const [selectedScheduleOrder, setSelectedScheduleOrder] = useState<WarrantyOrder | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authInitialMode] = useState<'login' | 'register'>('login');
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(() => Boolean(savedSession.isSettingsModalOpen));
  const [isExpensesModalOpen, setIsExpensesModalOpen] = useState<boolean>(() => Boolean(savedSession.isExpensesModalOpen));
  const [isDeliveryModalOpen, setIsDeliveryModalOpen] = useState<boolean>(() => Boolean(savedSession.isDeliveryModalOpen));
  const [isFinancialModalOpen, setIsFinancialModalOpen] = useState<boolean>(() => Boolean(savedSession.isFinancialModalOpen));
  const [isFinancialReportOpen, setIsFinancialReportOpen] = useState<boolean>(() => Boolean(savedSession.isFinancialReportOpen));
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState<boolean>(() => Boolean(savedSession.isCustomerModalOpen));
  const [deliveryToEdit, setDeliveryToEdit] = useState<any>(null);
  const [expensesModalTab, setExpensesModalTab] = useState<'cadastrar' | 'lista' | 'lucro'>(() => savedSession.expensesModalTab || 'cadastrar');
  const [successNotification, setSuccessNotification] = useState<string | null>(null);
  const [completedScheduleNotice, setCompletedScheduleNotice] = useState<{
    id: string;
    technicianName: string;
    customerName: string;
    count: number;
  } | null>(null);
  const [completedScheduleCount, setCompletedScheduleCount] = useState<number>(0);
  const notifiedReturnsRef = useRef<Set<string>>(new Set());
  const [techReturnNotice, setTechReturnNotice] = useState<{
    id: string;
    technicianName: string;
    customerName: string;
  } | null>(null);

  useEffect(() => {
    const returnOrders = orders.filter((o) => {
      const st = (o.attendanceStatus || '').toLowerCase().trim();
      return (
        st === 'pendente confirmação' ||
        st === 'pendente confirmacao' ||
        st === 'retorno' ||
        st === 'devolvido ao atendente'
      );
    });

    for (const ro of returnOrders) {
      if (!notifiedReturnsRef.current.has(ro.id)) {
        notifiedReturnsRef.current.add(ro.id);
        setTechReturnNotice({
          id: ro.id,
          technicianName: ro.technicianName || 'Técnico',
          customerName: ro.customerName,
        });
        try {
          playTechAlertMelody(0);
        } catch (e) {}
        break;
      }
    }
  }, [orders]);
  const [isCarneModalOpen, setIsCarneModalOpen] = useState<boolean>(() => Boolean(savedSession.isCarneModalOpen));
  const [carneInitialTab, setCarneInitialTab] = useState<'novo' | 'lista' | 'config'>(() => savedSession.carneInitialTab || 'novo');
  const [carnes, setCarnes] = useState<CarneSale[]>(() => getCarnes());
  const [carneSettings, setCarneSettingsState] = useState<CarneSettings>(() => getCarneSettings());
  const [printOrder, setPrintOrder] = useState<WarrantyOrder | null>(null);
  const [copiedPrintPix, setCopiedPrintPix] = useState(false);

  const carneDueAlerts = useMemo(() => getCarneDueAlerts(carnes), [carnes]);
  const carneUrgentAlertsCount = useMemo(
    () => carneDueAlerts.filter((a) => a.status === 'vencida' || a.status === 'hoje').length,
    [carneDueAlerts]
  );

  const handleUpdateCarneSettings = (nextSettings: CarneSettings): boolean => {
    setCarneSettingsState(nextSettings);
    return saveCarneSettings(nextSettings);
  };

  const handleExpensesChanged = () => {
    setExpenses(getExpenses());
  };

  const handleOpenExpenses = (tab: 'cadastrar' | 'lista' | 'lucro' = 'cadastrar') => {
    setExpensesModalTab(tab);
    setIsExpensesModalOpen(true);
  };

  // Search, Filter & View Mode
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');

  useEffect(() => {
    if (!searchQuery.trim()) {
      setDebouncedSearchQuery('');
      return;
    }
    const timer = window.setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  const [visitOnlyFilterDate, setVisitOnlyFilterDate] = useState<string>(() => {
    return savedSession.visitOnlyFilterDate || getLocalDateString();
  });

  const [dashboardFilter, setDashboardFilterState] = useState<DashboardFilter>(() => {
    return savedSession.dashboardFilter || 'faltam_hoje';
  });

  const setDashboardFilter = (f: DashboardFilter) => {
    if (f === 'pagou_so_visita_hoje') {
      setVisitOnlyFilterDate(getLocalDateString());
    }
    setDashboardFilterState(f || 'todos');
  };

  // Auto-save active screen/tab/filter/modals to sessionStorage on change
  useEffect(() => {
    try {
      const stateToSave = {
        dashboardFilter,
        visitOnlyFilterDate,
        isOrderModalOpen,
        isScheduleModalOpen,
        isStaffModalOpen,
        isSettingsModalOpen,
        isExpensesModalOpen,
        isDeliveryModalOpen,
        isFinancialModalOpen,
        isFinancialReportOpen,
        isCustomerModalOpen,
        isCarneModalOpen,
        carneInitialTab,
        expensesModalTab,
      };
      sessionStorage.setItem('neo_app_session_state', JSON.stringify(stateToSave));
    } catch (e) {}
  }, [
    dashboardFilter,
    visitOnlyFilterDate,
    isOrderModalOpen,
    isScheduleModalOpen,
    isStaffModalOpen,
    isSettingsModalOpen,
    isExpensesModalOpen,
    isDeliveryModalOpen,
    isFinancialModalOpen,
    isFinancialReportOpen,
    isCustomerModalOpen,
    isCarneModalOpen,
    carneInitialTab,
    expensesModalTab,
  ]);

  const [viewMode] = useState<'lista' | 'cards'>(() => {
    try {
      const saved = sessionStorage.getItem('neo_view_mode');
      if (saved) return saved as 'lista' | 'cards';
    } catch (e) {}
    return 'lista';
  });

  const [lastPendingCount, setLastPendingCount] = useState(0);
  const [notifGranted, setNotifGranted] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotifGranted(Notification.permission === 'granted');
    }
  }, []);

  const handleEnableNotifications = async () => {
    const granted = await requestNotificationPermission();
    setNotifGranted(granted);
    if (granted) {
      sendBrowserNotification('Notificações Ativadas!', 'Você receberá alertas em tempo real quando técnicos atualizarem ordens de serviço.');
    } else {
      alert('Permissão de notificação negada ou não suportada pelo navegador.');
    }
  };

  const isFetchingRef = useRef(false);

  const loadAllData = async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      const targetCompanyId = resolveCompanyId(currentUser?.companyId);
      setActiveCompanyId(targetCompanyId);

      // 1. Consulta service_orders filtrada por company_id
      const { data: rawOrders, error: ordersErr } = await sbSelectByCompany(
        'service_orders',
        targetCompanyId,
        { orderBy: 'scheduled_date', ascending: false, nullsFirst: false }
      );

      if (!ordersErr && Array.isArray(rawOrders)) {
        const regularRaw = rawOrders.filter((row: any) => !isCarneOrderRow(row) && !isCarneConfigRow(row));
        const normalized = regularRaw.map(normalizeOrder);
        syncGiLojaDeBoloOrderTypeIfNeeded(regularRaw, normalized);
        setOrders(normalized);
        saveOrders(normalized);

        const cloudCarnes = rawOrders
          .filter((row: any) => isCarneOrderRow(row))
          .map(extractCarneFromOrderRow)
          .filter((c): c is CarneSale => Boolean(c));
        const mergedCarnes = mergeCarnes(cloudCarnes, getCarnes());
        setCarnes(mergedCarnes);
        saveCarnes(mergedCarnes);

        const configRow = rawOrders.find((row: any) => isCarneConfigRow(row));
        if (configRow) {
          const cloudCarneSettings = extractCarneSettingsFromOrderRow(configRow);
          if (cloudCarneSettings) {
            setCarneSettingsState(cloudCarneSettings);
            saveCarneSettings(cloudCarneSettings, false);
          }
        }
      }

      // 2. Consulta perfil_empresa / company_settings filtrada por company_id
      const { data: perfilData, error: perfilErr } = await sbSelectByCompany(
        'perfil_empresa',
        targetCompanyId,
        { limit: 1 }
      );

      if (!perfilErr && Array.isArray(perfilData) && perfilData.length > 0) {
        const loadedComp = normalizeCompanyProfile(perfilData[0]);
        setCompany(loadedComp);
        saveCompanySettings(loadedComp, false);
      } else {
        const fallbackComp = await sbGetCompany(targetCompanyId);
        if (fallbackComp) {
          setCompany(fallbackComp);
          saveCompanySettings(fallbackComp, false);
        }
      }

      // 3. Demais tabelas filtradas por company_id - mantém dados existentes se houver erro
      const [staffRes, expensesRes, deliveriesRes, customersRes] = await Promise.allSettled([
        sbGetStaff(targetCompanyId),
        sbGetExpenses(targetCompanyId),
        sbGetDeliveries(targetCompanyId),
        sbGetCustomers(targetCompanyId),
      ]);

      if (staffRes.status === 'fulfilled' && Array.isArray(staffRes.value) && staffRes.value.length > 0) {
        const nextStaff = staffRes.value;
        setStaffList(nextStaff);
        saveStaff(nextStaff);
        syncAllStaffToUsers();
      }

      if (expensesRes.status === 'fulfilled' && Array.isArray(expensesRes.value) && expensesRes.value.length > 0) {
        const nextExpenses = expensesRes.value;
        setExpenses(nextExpenses);
        saveExpenses(nextExpenses);
      }

      if (deliveriesRes.status === 'fulfilled' && Array.isArray(deliveriesRes.value) && deliveriesRes.value.length > 0) {
        const nextDeliveries = deliveriesRes.value;
        setDeliveries(nextDeliveries);
        saveDeliveries(nextDeliveries);
      }

      if (customersRes.status === 'fulfilled' && Array.isArray(customersRes.value) && customersRes.value.length > 0) {
        saveCustomers(customersRes.value);
      }
    } catch (err) {
      console.warn('SuperDB loadData notice (mantendo dados salvos):', err);
    } finally {
      setTimeout(() => {
        isFetchingRef.current = false;
      }, 3000);
    }
  };

  // Safe SuperDB Initial Fetch with primitive dependencies and clean realtime cleanup
  useEffect(() => {
    const hasValidUser = Boolean(currentUser?.id || currentUser?.email);
    setSupabaseSyncAuthorized(hasValidUser);
    if (hasValidUser) {
      setActiveCompanyId(resolveCompanyId(currentUser?.companyId));
      setOrders([...getOrders()]);
      loadAllData();
    }
    if (!hasValidUser) return;

    let isCancelled = false;
    let realtimeChannel: any = null;

    try {
      realtimeChannel = superdb
        .channel('realtime:app_service_orders')
        .on('postgres_changes', { event: '*', schema: superdbSchema, table: 'service_orders' }, async () => {
          if (isCancelled || isFetchingRef.current) return;
          loadAllData();
        })
        .subscribe();
    } catch (e) {}

    return () => {
      isCancelled = true;
      if (realtimeChannel) {
        try {
          realtimeChannel.unsubscribe?.();
        } catch (e) {}
        superdb.removeChannel(realtimeChannel);
      }
    };
  }, [currentUser?.id, currentUser?.email]);

  // Reconnect / reload on mobile when visibility changes or window regains focus
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        loadAllData();
      }
    };
    const handleFocus = () => {
      loadAllData();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleFocus);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const filteredOrders = useMemo(() => {
    const todayStr = getLocalDateString();
    const query = debouncedSearchQuery.toLowerCase().trim();

    return orders.filter((order) => {
      const orderDate = extractDateOnly(order.scheduledDate || order.createdAt);
      const isOrderToday = orderDate === todayStr;
      const isOrderFuture = orderDate > todayStr;

      if (dashboardFilter === 'todos' || !dashboardFilter) {
        // Histórico geral - exibe TODOS os agendamentos por padrão
      } else if (dashboardFilter === 'faltam_hoje') {
        if (!isOrderToday || order.attendanceStatus === 'Concluído') return false;
      } else if (dashboardFilter === 'concluidos_hoje') {
        const st = (order.attendanceStatus || '').toLowerCase().trim();
        const isDone = st === 'concluído' || st === 'concluido' || st === 'finalizado';
        const isCarne = (order.applianceBrand || '').toLowerCase().trim() === 'venda carnê';
        if (!isOrderToday || order.orderType !== 'agendamento' || isCarne || !isDone) return false;
      } else if (dashboardFilter === 'todos_hoje') {
        if (!isOrderToday) return false;
      } else if (dashboardFilter === 'futuros') {
        if (!isOrderFuture || order.attendanceStatus === 'Concluído') return false;
      } else if (dashboardFilter === 'pendente_confirmacao') {
        const st = (order.attendanceStatus || '').toLowerCase().trim();
        if (
          st !== 'pendente confirmação' &&
          st !== 'pendente confirmacao' &&
          st !== 'retorno' &&
          st !== 'devolvido ao atendente'
        ) return false;
      } else if (dashboardFilter === 'pagou_so_visita') {
        if (!isPaidVisitOnlyOrder(order)) return false;
      } else if (dashboardFilter === 'pagou_so_visita_hoje') {
        if (!isPaidVisitOnlyToday(order, visitOnlyFilterDate || todayStr)) return false;
      } else if (dashboardFilter === 'pago_visita') {
        if (!isPagoVisitaOrder(order)) return false;
      }

      if (!query) return true;
      return (
        (order.customerName || '').toLowerCase().includes(query) ||
        (order.customerPhone || '').includes(query) ||
        (order.id || '').toLowerCase().includes(query) ||
        (order.applianceType || '').toLowerCase().includes(query) ||
        (order.applianceBrand || '').toLowerCase().includes(query) ||
        (order.technicianName || '').toLowerCase().includes(query) ||
        (order.city || '').toLowerCase().includes(query)
      );
    });
  }, [orders, debouncedSearchQuery, dashboardFilter, visitOnlyFilterDate]);

  const visitOnlySelectedTotal = useMemo(() => {
    if (dashboardFilter !== 'pagou_so_visita_hoje') return 0;
    return filteredOrders.reduce((sum, order) => sum + getPaidVisitOnlyValue(order), 0);
  }, [dashboardFilter, filteredOrders]);

  const todayStr = getLocalDateString();
  const hojeOrders = useMemo(() => {
    const isToday = (dateStr?: string) => {
      if (!dateStr) return false;
      return extractDateOnly(dateStr) === todayStr;
    };
    return orders.filter((o) => isToday(o.scheduledDate) || (!o.scheduledDate && isToday(o.createdAt)));
  }, [orders, todayStr]);

  const todayExpenses = useMemo(() => expenses.filter((e) => e.date === todayStr), [expenses, todayStr]);
  const todayExpensesTotal = useMemo(() => todayExpenses.reduce((acc, curr) => acc + (curr.amount || 0), 0), [todayExpenses]);
  const todayDeliveriesCount = useMemo(() => deliveries.filter((d) => extractDateOnly(d.scheduledDate) === todayStr).length, [deliveries, todayStr]);

  const todayRevenue = useMemo(() => {
    return orders
      .filter((o) => !isWarrantyReturnOrder(o) && extractDateOnly(o.createdAt) === todayStr && o.paymentStatus === 'Pago')
      .reduce((acc, curr) => acc + (curr.totalValue || 0), 0);
  }, [orders, todayStr]);

  const totalRevenue = useMemo(() => {
    return orders
      .filter((o) => !isWarrantyReturnOrder(o) && o.paymentStatus === 'Pago')
      .reduce((acc, curr) => acc + (curr.totalValue || 0), 0);
  }, [orders]);

  const handleSaveDelivery = async (deliveryData: any) => {
    if (deliveryToEdit) {
      updateDelivery(deliveryToEdit.id, deliveryData);
    } else {
      addDelivery(deliveryData);
    }
    setDeliveries([...getDeliveries()]);
    setIsDeliveryModalOpen(false);
    setDeliveryToEdit(null);
    await loadAllData();
  };

  const pendingApprovals = useMemo(
    () =>
      orders.filter((o) => {
        const st = (o.attendanceStatus || '').toLowerCase().trim();
        return (
          st === 'pendente confirmação' ||
          st === 'pendente confirmacao' ||
          st === 'retorno' ||
          st === 'devolvido ao atendente'
        );
      }),
    [orders]
  );

  const handleFinalizeService = async (order: WarrantyOrder, e: React.MouseEvent) => {
    e.stopPropagation();
    const nowIso = new Date().toISOString();
    const updated = updateOrder(order.id, {
      attendanceStatus: 'Concluído',
      status: 'Ativa',
      completedAt: nowIso,
    });
    if (updated) {
      await sbSaveOrder(updated);
      setOrders([...getOrders()]);
      setSelectedReceiptOrder(updated);
      setSuccessNotification(`Atendimento ${order.id} confirmado e finalizado! Garantia liberada para impressão.`);
      setTimeout(() => setSuccessNotification(null), 5000);
      await loadAllData();
    } else {
      setOrderToEdit({ ...order, attendanceStatus: 'Concluído' });
      setIsOrderModalOpen(true);
    }
  };

  const handleScheduleReturn = async (payload: {
    orderId: string;
    scheduledDate: string;
    scheduledTime: string;
    technicianName: string;
    technicianId?: string;
    priority: 'Urgente' | 'Alta' | 'Normal';
    returnReason: string;
  }) => {
    const target = orders.find((o) => o.id === payload.orderId);
    if (!target) return;

    const previousVal = Number(target.totalValue || 0);
    const existingNotes = (target.notes || '')
      .replace(/\[RETORNO DE GARANTIA\]/gi, '')
      .trim();
    const prevValueNote =
      previousVal > 0 ? `(Valor OS anterior: ${formatCurrency(previousVal)} • Retorno zerado: R$ 0,00)` : '';
    const reasonNote = payload.returnReason ? `Motivo Retorno: ${payload.returnReason}` : '';
    const combinedNotes = ['[RETORNO DE GARANTIA]', reasonNote, prevValueNote, existingNotes]
      .filter(Boolean)
      .join(' | ');

    const nowIso = new Date().toISOString();
    const updated = updateOrder(target.id, {
      isReturn: true,
      is_return: true,
      returnReason: payload.returnReason || target.returnReason || 'Retorno em garantia',
      returnScheduledAt: nowIso,
      scheduledDate: payload.scheduledDate,
      scheduledTime: payload.scheduledTime,
      technicianName: payload.technicianName,
      technicianId: payload.technicianId,
      priority: payload.priority,
      orderType: 'agendamento',
      dispatchMode: 'com_tecnico',
      attendanceStatus: 'Na fila / Aguardando',
      status: 'Ativa',
      technicianAlertAcknowledgedAt: undefined,
      totalValue: 0,
      paymentStatus: 'Pago',
      notes: combinedNotes,
    });

    if (updated) {
      await sbSaveOrder(updated);
      setOrders([...getOrders()]);
      setOrderForReturn(null);
      setSuccessNotification(
        `RETORNO DE GARANTIA agendado para ${updated.customerName} (${formatDate(payload.scheduledDate)} às ${payload.scheduledTime}) • Valor R$ 0,00.`
      );
      setTimeout(() => setSuccessNotification(null), 5500);
      await loadAllData();
    }
  };

  const handleSaveOrder = async (orderData: any, editId?: string) => {
    let savedOrder: WarrantyOrder | null = null;
    if (editId) {
      const updated = updateOrder(editId, orderData);
      if (updated) {
        savedOrder = updated;
        await sbSaveOrder(updated);
        if (updated.attendanceStatus === 'Concluído') setSelectedReceiptOrder(updated);
      }
    } else {
      const created = addOrder(orderData);
      savedOrder = created;
      await sbSaveOrder(created);
      if (created.orderType !== 'agendamento') {
        setSelectedReceiptOrder(created);
      } else {
        playScheduleConfirmedSound(0.38);
        const nextCount = completedScheduleCount + 1;
        setCompletedScheduleCount(nextCount);
        setCompletedScheduleNotice({
          id: created.id,
          technicianName: created.technicianName || 'Técnico',
          customerName: created.customerName,
          count: nextCount,
        });
      }
    }

    if (
      savedOrder &&
      orderData?.dispatchMode === 'com_motorista' &&
      orderData?.driverName &&
      (!editId || orderToEdit?.dispatchMode !== 'com_motorista')
    ) {
      addDelivery({
        customerName: savedOrder.customerName,
        customerPhone: savedOrder.customerPhone,
        cep: savedOrder.cep || '',
        street: savedOrder.street || '',
        number: savedOrder.number || 'S/N',
        complement: savedOrder.complement,
        neighborhood: savedOrder.neighborhood || '',
        city: savedOrder.city || '',
        state: savedOrder.state || 'SP',
        description: `[OS ${savedOrder.id}] ${savedOrder.applianceType} ${savedOrder.applianceBrand || ''} - ${savedOrder.serviceDescription}`.trim(),
        type: 'Entrega',
        driverName: orderData.driverName,
        attendantName: savedOrder.attendantName || 'Atendente da Loja',
        scheduledDate: getLocalDateString(),
        scheduledTime: '09:00',
      });
      setDeliveries([...getDeliveries()]);
    }

    setOrders([...getOrders()]);
    setIsOrderModalOpen(false);
    setOrderToEdit(null);
    await loadAllData();
  };

  const handleSaveSchedule = async (scheduleData: Omit<WarrantyOrder, 'id' | 'createdAt' | 'status'>) => {
    const created = addOrder({
      ...scheduleData,
      orderType: 'agendamento',
      attendanceStatus: scheduleData.attendanceStatus || 'Na fila / Aguardando',
    });
    await sbSaveOrder(created);
    setOrders([...getOrders()]);
    setIsOrderModalOpen(false);
    setIsScheduleModalOpen(false);
    setSelectedScheduleOrder(created);
    setDashboardFilter('todos_hoje');
    playScheduleConfirmedSound(0.38);
    const nextCount = completedScheduleCount + 1;
    setCompletedScheduleCount(nextCount);
    setCompletedScheduleNotice({
      id: created.id,
      technicianName: scheduleData.technicianName || 'Técnico',
      customerName: scheduleData.customerName,
      count: nextCount,
    });
    confetti({ particleCount: 120, spread: 90, origin: { y: 0.6 } });
    setSuccessNotification(`+1 CONCLUÍDO ✨ Agendamento para ${scheduleData.customerName} registrado com sucesso!`);
    setTimeout(() => setSuccessNotification(null), 6500);
    await loadAllData();
  };

  const handleLogout = () => {
    try {
      sessionStorage.removeItem('neo_app_session_state');
    } catch (e) {}
    logoutUser();
    setCurrentUser(null);
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#0f1115] text-slate-100 flex flex-col font-sans overflow-hidden relative">
        <div className="fixed top-0 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="fixed bottom-0 right-1/4 w-96 h-96 bg-indigo-600/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex-1 flex items-center justify-center p-4 relative z-10">
          <AuthModal 
            isOpen={true}
            company={company}
            onClose={() => {}} 
            onSuccess={(u) => setCurrentUser(u)}
            initialMode={getUsers().length === 0 && getStaff().length === 0 ? 'register' : 'login'}
            isPage={true}
          />
        </div>
      </div>
    );
  }

  if (currentUser.role === 'tecnico' || (currentUser.role as any) === 'funcionario de campo') {
    return (
      <TechnicianDashboard 
        user={currentUser} 
        company={company} 
        onLogout={handleLogout}
      />
    );
  }

  if (currentUser.role === 'motorista' || (currentUser.role as any) === 'ormamentistas') {
    return (
      <DriverDashboard 
        user={currentUser} 
        company={company} 
        onLogout={handleLogout}
      />
    );
  }

  const handleStaffAdded = (_newStaff: StaffMember) => {
    setStaffList([...getStaff()]);
  };

  const handleSaveCompany = (newSettings: CompanySettings) => {
    saveCompanySettings(newSettings, false);
    setCompany(newSettings);
  };

  return (
    <>
      <div className="min-h-screen bg-[#0f1115] text-slate-100 flex flex-col font-sans pb-16 md:pb-8 overflow-x-hidden relative selection:bg-cyan-500/30 selection:text-cyan-300">
      {successNotification && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white shadow-[0_10px_40px_rgba(16,185,129,0.5)] border border-emerald-400/50 animate-bounce">
          <Sparkles className="w-5 h-5 text-emerald-200 shrink-0" />
          <span className="text-xs sm:text-sm font-extrabold tracking-wide">{successNotification}</span>
        </div>
      )}

      {/* Background charcoal glow blurs */}
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-0 right-1/4 w-96 h-96 bg-indigo-600/5 rounded-full blur-3xl pointer-events-none" />

      {/* TOP HEADER */}
      <header className="sticky top-0 z-40 bg-[#121418]/95 backdrop-blur-xl border-b border-white/5 shadow-2xl">
        <div className="w-full px-3 sm:px-6 py-2.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 shrink-0 min-w-0">
            <div
              className="relative group cursor-pointer shrink-0"
              onClick={() => setIsSettingsModalOpen(true)}
              title="Configurações da Empresa"
            >
              <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500/30 to-blue-600/30 rounded-2xl blur opacity-30 group-hover:opacity-75 transition duration-500" />
              <div className="relative h-11 w-11 sm:h-12 sm:w-12 rounded-2xl bg-[#0f1115] border border-cyan-500/30 group-hover:border-cyan-400 flex items-center justify-center overflow-hidden shadow-2xl transition-all">
                {company.logoUrl ? (
                  <img src={company.logoUrl} alt="Logo" className="h-full w-full object-contain p-1.5" />
                ) : (
                  <ShieldCheck className="w-6 h-6 sm:w-7 sm:h-7 text-cyan-400" />
                )}
              </div>
            </div>

            <div className="flex flex-col text-left min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-sm sm:text-base lg:text-lg font-black tracking-tight text-white font-tech leading-tight truncate">
                  {company.name}
                </h1>
                <div
                  className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-[10px] text-emerald-400 font-semibold shrink-0"
                  title="Sincronização em tempo real ativa"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  <span className="hidden sm:inline">Sincronizado</span>
                </div>
              </div>
              <p className="text-[10px] sm:text-[11px] text-cyan-400/70 font-semibold truncate max-w-[200px] sm:max-w-md mt-0.5 italic">
                {company.slogan}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0 ml-auto">
            <PWAInstallButton />
            {currentUser && (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 bg-slate-900/80 border border-white/10 rounded-2xl p-1 sm:pr-3 shadow-inner">
                  <div className="h-8 w-8 rounded-xl bg-amber-500/25 text-amber-300 border border-amber-500/30 flex items-center justify-center text-xs font-bold shrink-0">
                    <Crown className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                  <div className="hidden sm:block text-left">
                    <div className="font-bold text-slate-200 text-xs sm:text-sm truncate max-w-[120px] leading-tight">
                      {currentUser.name}
                    </div>
                    <div className="text-[9px] text-cyan-400 font-black uppercase tracking-wider">
                      {currentUser.role === 'admin' ? 'Administrador' : currentUser.role}
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleLogout}
                  className="px-3 sm:px-3.5 py-2 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 transition-all text-xs font-bold flex items-center gap-1.5 cursor-pointer shrink-0"
                  title="Sair da Conta"
                >
                  <LogOut className="w-3.5 h-3.5 text-rose-400" />
                  <span className="font-semibold hidden xs:inline">Sair</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* LINHA 2: Barra de Navegação e Ações Rápidas */}
        <div className="w-full px-3 sm:px-6 py-2 bg-[#0b0e13]/90 border-t border-white/5">
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 w-full">
            <button
              onClick={() => setIsStaffModalOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-slate-900/60 border border-white/5 hover:border-cyan-500/30 text-slate-300 hover:text-cyan-300 transition-all text-xs font-bold flex items-center justify-center sm:justify-start gap-1.5 cursor-pointer"
            >
              <Users className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span>Equipe</span>
            </button>

            <button
              onClick={() => setIsCustomerModalOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-slate-900/60 border border-white/5 hover:border-cyan-500/30 text-slate-300 hover:text-cyan-300 transition-all text-xs font-bold flex items-center justify-center sm:justify-start gap-1.5 cursor-pointer"
            >
              <Users className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Clientes</span>
            </button>

            <button
              onClick={() => setIsFinancialReportOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-slate-900/60 border border-emerald-500/30 hover:border-emerald-400/60 text-emerald-300 transition-all text-xs font-bold flex items-center justify-center sm:justify-start gap-1.5 cursor-pointer"
            >
              <BarChart3 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Relatórios</span>
            </button>

            <button
              onClick={() => setIsSettingsModalOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-slate-900/60 border border-white/5 hover:border-cyan-500/30 text-slate-300 hover:text-cyan-300 transition-all text-xs font-bold flex items-center justify-center sm:justify-start gap-1.5 cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span>Empresa</span>
            </button>

            <button
              onClick={() => setIsScheduleModalOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 text-xs font-bold transition-all flex items-center justify-center sm:justify-start gap-1.5 cursor-pointer"
            >
              <CalendarDays className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span>Agendamento</span>
            </button>

            <button
              onClick={() => setIsDeliveryModalOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-300 text-xs font-bold transition-all flex items-center justify-center sm:justify-start gap-1.5 cursor-pointer"
            >
              <Truck className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span>Entregas / Retirada</span>
            </button>

            <button
              onClick={() => {
                setCarneInitialTab('novo');
                setIsCarneModalOpen(true);
              }}
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-600/25 to-cyan-600/25 border border-purple-500/40 text-purple-300 text-xs font-bold transition-all flex items-center justify-center sm:justify-start gap-1.5 cursor-pointer relative"
            >
              <ReceiptText className="w-3.5 h-3.5 text-purple-400 shrink-0" />
              <span>Venda Carnê</span>
              {carneUrgentAlertsCount > 0 && (
                <span className="absolute -top-1 -right-1 px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[9px] font-black animate-pulse">
                  {carneUrgentAlertsCount}
                </span>
              )}
            </button>

            <button
              onClick={() => {
                setOrderToEdit(null);
                setIsOrderModalOpen(true);
              }}
              className="col-span-2 sm:col-span-1 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-extrabold transition-all shadow-lg flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span>+ Nova Garantia / OS</span>
            </button>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT AREA: Attendance Dashboard */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-3 sm:px-6 py-4 flex flex-col gap-6">
        <AttendanceDashboard
          orders={orders}
          activeFilter={dashboardFilter}
          onSelectFilter={setDashboardFilter}
          expenses={expenses}
          onOpenExpenses={handleOpenExpenses}
          deliveries={deliveries}
          onOpenDeliveries={() => setIsDeliveryModalOpen(true)}
          onOpenFinancialAnalysis={() => setIsFinancialReportOpen(true)}
          isAdmin={['admin', 'administrador'].includes((currentUser.role || '').toLowerCase().trim())}
          techReturnNotice={techReturnNotice}
          onDismissReturnNotice={() => setTechReturnNotice(null)}
        />

        {/* Barra de Busca e Contagem da Lista */}
        <div className="flex flex-col gap-2.5 bg-[#121418] p-3 rounded-2xl border border-white/5 shadow-inner">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por cliente, telefone, aparelho, marca, técnico ou OS..."
                className="w-full pl-10 pr-3 py-2 bg-slate-900 border border-white/10 rounded-xl text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
              />
            </div>
            <div className="flex items-center justify-between sm:justify-end gap-2 text-xs text-slate-400 font-bold px-1">
              <span>
                Exibindo <strong className="text-cyan-400 font-num">{filteredOrders.length}</strong> {filteredOrders.length === 1 ? 'registro' : 'registros'}
              </span>
              {dashboardFilter !== 'todos' && (
                <button
                  onClick={() => setDashboardFilter('todos')}
                  className="px-2.5 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 text-[10px] font-black uppercase transition-colors cursor-pointer"
                >
                  Ver Todos
                </button>
              )}
            </div>
          </div>

          {dashboardFilter === 'pagou_so_visita_hoje' && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2.5 border-t border-purple-500/20 bg-purple-500/5 px-3 py-2.5 rounded-xl">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black uppercase tracking-wider text-purple-300 flex items-center gap-1.5">
                  <CalendarDays className="w-3.5 h-3.5 text-purple-400" />
                  Filtrar Só Visita por Data:
                </span>
                <input
                  type="date"
                  value={visitOnlyFilterDate}
                  onChange={(e) => setVisitOnlyFilterDate(e.target.value || getLocalDateString())}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-purple-500/40 text-xs font-bold text-white focus:outline-none focus:border-purple-400"
                />
                <button
                  type="button"
                  onClick={() => setVisitOnlyFilterDate(getLocalDateString())}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all cursor-pointer border ${
                    visitOnlyFilterDate === getLocalDateString()
                      ? 'bg-purple-600 text-white border-purple-400 shadow-sm'
                      : 'bg-slate-900 text-purple-300 border-purple-500/30 hover:bg-purple-500/20'
                  }`}
                >
                  Hoje
                </button>
              </div>

              <div className="text-xs font-bold text-purple-200 flex items-center gap-1.5 flex-wrap">
                <span>
                  Exibindo{' '}
                  <strong className="text-white font-num">
                    {filteredOrders.length}{' '}
                    {filteredOrders.length === 1
                      ? 'cliente que pagou só a visita'
                      : 'clientes que pagaram só a visita'}
                  </strong>{' '}
                  em <strong className="text-purple-300">{formatDate(visitOnlyFilterDate)}</strong>
                </span>
                <span className="text-slate-500">•</span>
                <span className="text-emerald-400 font-black font-num">
                  Total: {formatCurrency(visitOnlySelectedTotal)}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Lista de Ordens / Agendamentos */}
        <div className="space-y-2.5">
          {filteredOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 bg-[#121418] rounded-2xl border border-white/5 text-center">
              <CalendarDays className="w-10 h-10 text-slate-600 mb-2" />
              <p className="text-sm font-bold text-slate-300">Nenhum agendamento encontrado</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">
                {orders.length === 0
                  ? 'Ainda não existem agendamentos cadastrados. Clique em "+ Nova Garantia / OS" ou "Agendamento" acima para cadastrar.'
                  : 'Nenhum registro corresponde ao filtro ou busca selecionados.'}
              </p>
              {dashboardFilter !== 'todos' && orders.length > 0 && (
                <button
                  onClick={() => setDashboardFilter('todos')}
                  className="mt-4 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs cursor-pointer shadow-lg active:scale-95 transition-all"
                >
                  Ver Todos os Registros ({orders.length})
                </button>
              )}
            </div>
          ) : (
            filteredOrders.map((order) => (
              <OrderListRow
                key={order.id}
                order={order}
                onClick={() => {
                  setOrderToEdit(order);
                  setIsOrderModalOpen(true);
                }}
                onEdit={(e) => {
                  e.stopPropagation();
                  setOrderToEdit(order);
                  setIsOrderModalOpen(true);
                }}
                onDelete={(e) => {
                  e.stopPropagation();
                  setOrderToDelete(order);
                }}
                onWhatsApp={(e) => {
                  e.stopPropagation();
                  if (order.customerPhone) {
                    window.open(`https://wa.me/55${cleanNumeric(order.customerPhone)}`, '_blank');
                  }
                }}
                onReceipt={(e) => {
                  e.stopPropagation();
                  setSelectedReceiptOrder(order);
                }}
                onPrint={(e) => {
                  e.stopPropagation();
                  setPrintOrder(order);
                }}
                onDownloadPdf={(e) => {
                  e.stopPropagation();
                  downloadOrderServicePdf(order, company);
                }}
                onFinalize={(e) => handleFinalizeService(order, e)}
                onScheduleReturn={(e) => {
                  e.stopPropagation();
                  setOrderForReturn(order);
                }}
              />
            ))
          )}
        </div>
      </main>

      {/* MODALS */}
      <FinancialReportScreen
        isOpen={isFinancialReportOpen}
        onClose={() => setIsFinancialReportOpen(false)}
        orders={orders}
        expenses={expenses}
        company={company}
        carnes={carnes}
        deliveries={deliveries}
        onOpenExpenses={() => handleOpenExpenses('cadastrar')}
        onOpenReceipt={(order) => setSelectedReceiptOrder(order)}
        onEditOrder={(order) => {
          setOrderToEdit(order);
          setIsOrderModalOpen(true);
        }}
        onOrderUpdated={(updatedOrder) => {
          const next = orders.map((o) => (o.id === updatedOrder.id ? updatedOrder : o));
          setOrders(next);
          saveOrders(next);
        }}
        onDeleteOrder={async (orderId) => {
          await sbDeleteOrder(orderId);
          deleteOrder(orderId);
          const next = orders.filter((o) => o.id !== orderId);
          setOrders(next);
          saveOrders(next);
        }}
        onEditCarne={() => {
          setCarneInitialTab('lista');
          setIsCarneModalOpen(true);
        }}
        onDeleteCarne={(carneId) => {
          const next = deleteCarneSale(carneId);
          setCarnes(next);
        }}
        onEditDelivery={(del) => {
          setDeliveryToEdit(del);
          setIsDeliveryModalOpen(true);
        }}
        onDeleteDelivery={(delId) => {
          deleteDelivery(delId);
          setDeliveries([...getDeliveries()]);
        }}
      />

      {isOrderModalOpen && (
        <OrderFormModal
          isOpen={isOrderModalOpen}
          onClose={() => {
            setIsOrderModalOpen(false);
            setOrderToEdit(null);
          }}
          orderToEdit={orderToEdit}
          onSave={handleSaveOrder}
          staffList={staffList}
          onStaffAdded={handleStaffAdded}
        />
      )}

      {isScheduleModalOpen && (
        <ScheduleModal
          isOpen={isScheduleModalOpen}
          onClose={() => setIsScheduleModalOpen(false)}
          onSave={handleSaveSchedule}
          staffList={staffList}
          onStaffAdded={handleStaffAdded}
        />
      )}

      <ReturnScheduleModal
        isOpen={Boolean(orderForReturn)}
        onClose={() => setOrderForReturn(null)}
        order={orderForReturn}
        staffList={staffList}
        onConfirm={handleScheduleReturn}
      />

      {selectedReceiptOrder && (
        <ReceiptModal
          isOpen={Boolean(selectedReceiptOrder)}
          onClose={() => setSelectedReceiptOrder(null)}
          order={selectedReceiptOrder}
          company={company}
        />
      )}

      {selectedScheduleOrder && (
        <ScheduleReceiptModal
          isOpen={Boolean(selectedScheduleOrder)}
          onClose={() => setSelectedScheduleOrder(null)}
          order={selectedScheduleOrder}
          company={company}
        />
      )}

      {isStaffModalOpen && (
        <StaffManagementModal
          isOpen={isStaffModalOpen}
          onClose={() => setIsStaffModalOpen(false)}
          onStaffChange={() => setStaffList([...getStaff()])}
        />
      )}

      <ExpensesModal
        isOpen={isExpensesModalOpen}
        onClose={() => setIsExpensesModalOpen(false)}
        initialTab={expensesModalTab}
        orders={orders}
        expenses={expenses}
        onExpensesChanged={handleExpensesChanged}
        currentUser={currentUser}
        todayRevenue={todayRevenue}
        totalRevenue={totalRevenue}
      />

      {isDeliveryModalOpen && (
        <DeliveryModal
          isOpen={isDeliveryModalOpen}
          onClose={() => {
            setIsDeliveryModalOpen(false);
            setDeliveryToEdit(null);
          }}
          onSave={handleSaveDelivery}
          deliveryToEdit={deliveryToEdit}
          staffList={staffList}
          onStaffAdded={handleStaffAdded}
        />
      )}

      {isCustomerModalOpen && (
        <CustomerManagementModal
          isOpen={isCustomerModalOpen}
          onClose={() => setIsCustomerModalOpen(false)}
          orders={orders}
        />
      )}

      <CarneModal
        isOpen={isCarneModalOpen}
        onClose={() => setIsCarneModalOpen(false)}
        initialTab={carneInitialTab}
        carnes={carnes}
        carneSettings={carneSettings}
        onCarnesUpdated={async (c) => {
          setCarnes(c);
          saveCarnes(c);
          await loadAllData();
        }}
        onSettingsUpdated={handleUpdateCarneSettings}
        company={company}
        staffList={staffList}
        onCarneCreated={async (carne) => {
          if (carne.dispatchMode === 'com_tecnico' && carne.technicianName) {
            const linkedOrder = addOrder({
              orderType: 'garantia',
              dispatchMode: 'com_tecnico',
              attendanceStatus: 'Na fila / Aguardando',
              customerName: carne.customerName,
              customerPhone: carne.customerPhone,
              cep: '',
              street: carne.deliveryAddress || 'Atendimento vinculado ao Carnê',
              number: 'S/N',
              neighborhood: '',
              city: '',
              state: 'SP',
              applianceType: 'Outro Eletrodoméstico',
              applianceBrand: 'Venda Carnê',
              attendantName: currentUser?.name || 'Atendente da Loja',
              technicianName: carne.technicianName,
              technicianId: carne.technicianId,
              defectDescription: `Venda Carnê ${carne.id}`,
              serviceDescription: carne.description,
              partsReplaced: 'Venda / Instalação Carnê',
              totalValue: carne.totalValue,
              paymentMethod: 'Boleto Bancário',
              paymentStatus: 'Parcial',
              warrantyMonths: 3,
              scheduledDate: getLocalDateString(),
              scheduledTime: '09:00',
            });
            await sbSaveOrder(linkedOrder);
            setOrders([...getOrders()]);
          } else if (carne.dispatchMode === 'com_motorista' && carne.driverName) {
            addDelivery({
              customerName: carne.customerName,
              customerPhone: carne.customerPhone,
              cep: '',
              street: carne.deliveryAddress || 'Endereço a confirmar com o cliente',
              number: 'S/N',
              neighborhood: '',
              city: '',
              state: 'SP',
              description: `[Carnê ${carne.id}] ${carne.description}`,
              type: 'Entrega',
              driverName: carne.driverName,
              attendantName: currentUser?.name || 'Atendente da Loja',
              scheduledDate: getLocalDateString(),
              scheduledTime: '09:00',
            });
            setDeliveries([...getDeliveries()]);
          }
          await loadAllData();
        }}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        initialMode={authInitialMode}
        onSuccess={(logged) => setCurrentUser(logged)}
      />

      <CompanySettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        settings={company}
        onSave={handleSaveCompany}
      />

      {orderToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-rose-500/40 rounded-3xl p-6 shadow-[0_0_50px_rgba(244,63,94,0.25)]">
            <div className="flex items-center gap-3 text-rose-400 mb-3">
              <div className="h-10 w-10 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-white text-sm">Excluir Ordem de Serviço</h4>
                <p className="text-[11px] text-slate-400">Esta ação não poderá ser desfeita</p>
              </div>
            </div>
            <p className="text-xs text-slate-300 mb-5 leading-relaxed">
              Deseja realmente excluir a OS <strong className="text-white">{orderToDelete.id}</strong> do cliente <strong className="text-white">{orderToDelete.customerName}</strong>?
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setOrderToDelete(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  sbDeleteOrder(orderToDelete.id).then(() => {
                    const next = orders.filter((o) => o.id !== orderToDelete.id);
                    setOrders(next);
                    saveOrders(next);
                    setOrderToDelete(null);
                  });
                }}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg"
              >
                Sim, Excluir OS
              </button>
            </div>
          </div>
        </div>
      )}

      {printOrder && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col overflow-y-auto p-4">
          <div className="max-w-3xl w-full mx-auto bg-white text-black p-8 rounded-2xl shadow-2xl my-auto">
            <div className="flex justify-between items-center mb-6 print:hidden">
              <span className="font-bold text-sm text-slate-800">Visualização de Impressão (OS #{printOrder.id})</span>
              <div className="flex gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-cyan-600 text-white font-bold text-xs rounded-xl hover:bg-cyan-500"
                >
                  Imprimir / Salvar PDF
                </button>
                <button
                  onClick={() => downloadOrderServicePdf(printOrder, company)}
                  className="px-4 py-2 bg-emerald-600 text-white font-bold text-xs rounded-xl hover:bg-emerald-500"
                >
                  Baixar PDF
                </button>
                <button
                  onClick={() => setPrintOrder(null)}
                  className="px-4 py-2 bg-slate-200 text-slate-800 font-bold text-xs rounded-xl hover:bg-slate-300"
                >
                  Fechar
                </button>
              </div>
            </div>

            <div className="space-y-4 text-xs font-sans">
              <div className="flex items-center justify-between border-b-2 border-black pb-3">
                <div className="flex items-center gap-3">
                  {company.logoUrl ? (
                    <img src={company.logoUrl} alt="Logo" className="h-12 w-12 object-contain" />
                  ) : (
                    <div className="h-12 w-12 bg-slate-200 rounded-lg flex items-center justify-center font-bold text-slate-700 text-sm">
                      NF
                    </div>
                  )}
                  <div>
                    <h2 className="font-black text-sm tracking-tight">{company.name}</h2>
                    <p className="text-[10px] text-neutral-600">{company.slogan}</p>
                    <p className="text-[10px] text-neutral-600">CNPJ: {company.cnpj} • Tel: {company.phone}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-black text-blue-700">ORDEM DE SERVIÇO</div>
                  <div className="text-xs font-bold font-mono">#{printOrder.id}</div>
                  <div className="text-[10px] text-neutral-600">{formatDate(printOrder.createdAt)}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 bg-neutral-50 p-3 rounded-lg border border-neutral-200">
                <div>
                  <div className="text-[10px] font-bold text-neutral-500 uppercase">Cliente</div>
                  <div className="font-bold text-sm">{printOrder.customerName}</div>
                  <div className="text-neutral-700">Tel / WhatsApp: {printOrder.customerPhone}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-neutral-500 uppercase">Endereço de Atendimento</div>
                  <div className="text-neutral-700">{printOrder.street}, {printOrder.number}</div>
                  <div className="text-neutral-700">{printOrder.neighborhood} - {printOrder.city}/{printOrder.state}</div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 bg-neutral-50 p-3 rounded-lg border border-neutral-200">
                <div>
                  <div className="text-[10px] font-bold text-neutral-500 uppercase">Aparelho / Equipamento</div>
                  <div className="font-bold">{printOrder.applianceType}</div>
                  <div className="text-neutral-700">{printOrder.applianceBrand} {printOrder.applianceModel}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-neutral-500 uppercase">Defeito Relatado</div>
                  <div className="text-neutral-800 font-medium">{printOrder.defectDescription || 'Não informado'}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-neutral-500 uppercase">Técnico Responsável</div>
                  <div className="font-bold text-blue-700">{printOrder.technicianName || 'Não atribuído'}</div>
                </div>
              </div>

              <div className="border border-neutral-300 rounded-lg p-3 space-y-1.5">
                <div className="text-[10px] font-bold text-neutral-500 uppercase">Serviço Realizado</div>
                <div className="text-neutral-800 whitespace-pre-wrap leading-relaxed min-h-[40px]">{printOrder.serviceDescription || 'Nenhum serviço detalhado.'}</div>
              </div>

              <div className="flex items-center justify-between bg-neutral-900 text-white p-3 rounded-lg">
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-neutral-400">Condição de Pagamento</span>
                  <div className="font-bold text-sm">{printOrder.paymentMethod} • Status: {printOrder.paymentStatus}</div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase tracking-wider text-neutral-400">Valor Total</span>
                  <div className="text-xl font-black text-cyan-400">{formatCurrency(printOrder.totalValue)}</div>
                </div>
              </div>

              {(() => {
                const totalAmount = Number(printOrder.totalValue || 0);
                const pixKey = (company.pixKey || '').trim();
                if (totalAmount <= 0 || !pixKey) return null;
                const payload = generatePixPayload({
                  pixKey,
                  merchantName: company.name || 'NEO FIX',
                  merchantCity: company.pixCity || company.city || 'Brasil',
                  amount: totalAmount,
                  txId: printOrder.id,
                });
                const qrSvg = buildPixQrSvgData(payload);
                if (!payload || !qrSvg) return null;

                return (
                  <div className="p-3 bg-emerald-50 border-2 border-emerald-500 rounded-xl flex flex-col sm:flex-row items-center gap-3 print:p-2 print:gap-2">
                    <div className="bg-white p-1.5 rounded-lg border border-emerald-300 shrink-0">
                      <svg
                        viewBox={`-1 -1 ${qrSvg.size + 2} ${qrSvg.size + 2}`}
                        className="w-24 h-24"
                        shapeRendering="crispEdges"
                      >
                        <path d={qrSvg.pathD} fill="#0f172a" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0 space-y-1 text-center sm:text-left">
                      <div className="flex items-center justify-center sm:justify-start gap-1.5 text-emerald-900 font-black text-xs uppercase">
                        <QrCode className="w-4 h-4 text-emerald-700 shrink-0" />
                        <span>Pague com Pix • {formatCurrency(totalAmount)}</span>
                      </div>
                      <p className="text-[11px] text-neutral-800">
                        Chave Pix: <strong className="font-mono text-black">{pixKey}</strong>
                      </p>
                      <div className="p-1.5 rounded-md bg-white border border-emerald-200 text-[9px] font-mono text-neutral-700 break-all leading-tight">
                        <span className="font-bold text-emerald-800 block text-[8px] uppercase mb-0.5">
                          Pix Copia e Cola:
                        </span>
                        {payload}
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(payload);
                            setCopiedPrintPix(true);
                            setTimeout(() => setCopiedPrintPix(false), 2500);
                          } catch {}
                        }}
                        className="print:hidden mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold cursor-pointer transition-all"
                      >
                        {copiedPrintPix ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedPrintPix ? 'Código Pix Copiado!' : 'Copiar Pix Copia e Cola'}</span>
                      </button>
                    </div>
                  </div>
                );
              })()}

              <div className="text-[9px] text-neutral-600 leading-tight border-t border-neutral-200 pt-2 whitespace-pre-line">
                <strong>Termos de Garantia:</strong> {company.warrantyTerms}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
