/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
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
} from 'lucide-react';
import { CompanySettings, Expense, StaffMember, User, WarrantyOrder } from './types';
import confetti from 'canvas-confetti';
import { requestNotificationPermission, sendBrowserNotification } from './utils/notifications';
import {
  getCompanySettings,
  getCurrentUser,
  getOrders,
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
  sbGetStaff,
  sbGetExpenses,
  sbGetCompany,
  sbGetDeliveries,
  sbGetCustomers,
} from './utils/supabaseService';
import { addSyncListener } from './utils/cloudSync';
import { formatCurrency, formatDate, formatDateWithWeekday, getDaysRemaining, cleanNumeric, extractDateOnly, getLocalDateString } from './utils/formatters';
import { OrderFormModal } from './components/OrderFormModal';
import { ReceiptModal } from './components/ReceiptModal';
import { ScheduleModal } from './components/ScheduleModal';
import { ScheduleReceiptModal } from './components/ScheduleReceiptModal';
import { AuthModal } from './components/AuthModal';
import { CompanySettingsModal } from './components/CompanySettingsModal';
import { AttendanceDashboard, DashboardFilter } from './components/AttendanceDashboard';
import { StaffManagementModal } from './components/StaffManagementModal';
import { OrderListRow } from './components/OrderListRow';
import { ExpensesModal } from './components/ExpensesModal';
import { DeliveryModal } from './components/DeliveryModal';
import { CustomerManagementModal } from './components/CustomerManagementModal';

import { TechnicianDashboard } from './components/TechnicianDashboard';
import { DriverDashboard } from './components/DriverDashboard';
import { FinancialDashboardModal } from './components/FinancialDashboardModal';
import { FinancialReportScreen } from './components/FinancialReportScreen';
import { PWAInstallButton } from './components/PWAInstallButton';

export default function App() {
  // Global States
  const [currentUser, setCurrentUser] = useState<User | null>(getCurrentUser());
  const [company, setCompany] = useState<CompanySettings>(getCompanySettings());
  const [orders, setOrders] = useState<WarrantyOrder[]>(getOrders());
  const [staffList, setStaffList] = useState<StaffMember[]>(getStaff());
  const [expenses, setExpenses] = useState<Expense[]>(getExpenses());
  const [deliveries, setDeliveries] = useState(getDeliveries());

  // UI Modals
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [orderToEdit, setOrderToEdit] = useState<WarrantyOrder | null>(null);
  const [orderToDelete, setOrderToDelete] = useState<WarrantyOrder | null>(null);
  const [selectedReceiptOrder, setSelectedReceiptOrder] = useState<WarrantyOrder | null>(null);
  const [selectedScheduleOrder, setSelectedScheduleOrder] = useState<WarrantyOrder | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authInitialMode, setAuthInitialMode] = useState<'login' | 'register'>('login');
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isExpensesModalOpen, setIsExpensesModalOpen] = useState(false);
  const [isDeliveryModalOpen, setIsDeliveryModalOpen] = useState(false);
  const [isFinancialModalOpen, setIsFinancialModalOpen] = useState(false);
  const [isFinancialReportOpen, setIsFinancialReportOpen] = useState(false);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [deliveryToEdit, setDeliveryToEdit] = useState<any>(null);
  const [expensesModalTab, setExpensesModalTab] = useState<'cadastrar' | 'lista' | 'lucro'>('cadastrar');
  const [successNotification, setSuccessNotification] = useState<string | null>(null);

  const handleExpensesChanged = () => {
    setExpenses(getExpenses());
  };

  const handleOpenExpenses = (tab: 'cadastrar' | 'lista' | 'lucro' = 'cadastrar') => {
    setExpensesModalTab(tab);
    setIsExpensesModalOpen(true);
  };

  // Search, Filter & View Mode (Default: 'faltam_hoje' and compact 'lista')
  const [searchQuery, setSearchQuery] = useState('');
  const [dashboardFilter, setDashboardFilterState] = useState<DashboardFilter>(() => {
    try {
      const saved = sessionStorage.getItem('neo_dash_filter');
      if (saved) return saved as DashboardFilter;
    } catch (e) {}
    return 'faltam_hoje';
  });
  const setDashboardFilter = (f: DashboardFilter) => {
    setDashboardFilterState(f);
    try {
      if (f) {
        sessionStorage.setItem('neo_dash_filter', f);
      } else {
        sessionStorage.removeItem('neo_dash_filter');
      }
    } catch (e) {}
  };

  const [viewMode, setViewModeState] = useState<'lista' | 'cards'>(() => {
    try {
      const saved = sessionStorage.getItem('neo_view_mode');
      if (saved) return saved as 'lista' | 'cards';
    } catch (e) {}
    return 'lista';
  });
  const setViewMode = (v: 'lista' | 'cards') => {
    setViewModeState(v);
    try {
      sessionStorage.setItem('neo_view_mode', v);
    } catch (e) {}
  };

  // New Returns Alert
  const [lastPendingCount, setLastPendingCount] = useState(0);
  const [showNewReturnAlert, setShowNewReturnAlert] = useState(false);
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

  // Check if first user ever
  const totalUsers = getUsers().length;

  useEffect(() => {
    async function loadData() {
      console.log('[App] Initializing & fetching direct Cloud state from Supabase...');

      const user = getCurrentUser();
      setCurrentUser(user);

      try {
        const [orders, staff, expenses, company, deliveries, customers] = await Promise.all([
          sbGetOrders(),
          sbGetStaff(),
          sbGetExpenses(),
          sbGetCompany(),
          sbGetDeliveries(),
          sbGetCustomers()
        ]);

        if (orders && orders.length > 0) {
          const merged = mergeOrders(orders);
          setOrders([...merged]);
        } else {
          setOrders(getOrders());
        }
        if (staff && staff.length > 0) {
          setStaffList(staff);
          saveStaff(staff);
          syncAllStaffToUsers();
        } else {
          setStaffList(getStaff());
        }
        if (expenses && expenses.length > 0) {
          setExpenses(expenses);
          saveExpenses(expenses);
        }
        if (company) {
          setCompany(company);
          saveCompanySettings(company);
        }
        if (deliveries && deliveries.length > 0) {
          setDeliveries(deliveries);
          saveDeliveries(deliveries);
        }
        if (customers && customers.length > 0) {
          saveCustomers(customers);
        }
      } catch (err) {
        console.warn('[App] Supabase cloud load notice:', err);
      }
    }

    loadData();
  }, []);

  // Filtered orders list (searches across customer, phone, OS, appliance, defects, parts, staff, and dashboardFilter)
  const filteredOrders = useMemo(() => {
    const todayStr = getLocalDateString();
    const yesterdayStr = (() => {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      return getLocalDateString(d);
    })();

    const isToday = (dateStr?: string) => {
      if (!dateStr) return false;
      return extractDateOnly(dateStr) === todayStr;
    };

    const isYesterday = (dateStr?: string) => {
      if (!dateStr) return false;
      return extractDateOnly(dateStr) === yesterdayStr;
    };

    const isThisWeek = (dateStr?: string) => {
      if (!dateStr) return false;
      const datePart = extractDateOnly(dateStr);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return false;
      const [y, m, d] = datePart.split('-').map(Number);
      const orderDate = new Date(y, m - 1, d, 12, 0, 0);
      const diffDays = Math.floor((new Date().getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24));
      return diffDays >= 0 && diffDays <= 7;
    };

    const isThisMonth = (dateStr?: string) => {
      if (!dateStr) return false;
      const datePart = extractDateOnly(dateStr);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return false;
      const [y, m] = datePart.split('-').map(Number);
      const now = new Date();
      return y === now.getFullYear() && m === now.getMonth() + 1;
    };

    const isFuture = (dateStr?: string) => {
      if (!dateStr) return false;
      return extractDateOnly(dateStr) > todayStr;
    };

    return orders.filter((order) => {
      const orderDate = extractDateOnly(order.scheduledDate || order.createdAt);
      const isOrderToday = orderDate === todayStr;
      const isOrderFuture = orderDate > todayStr;

      // 1. Dashboard Filter
      if (dashboardFilter === 'faltam_hoje' || dashboardFilter === null) {
        // Faltam atender hoje: agendados para hoje que ainda não foram concluídos
        if (!isOrderToday || order.attendanceStatus === 'Concluído') return false;
      } else if (dashboardFilter === 'concluidos_hoje') {
        // Concluídos hoje
        if (!isOrderToday || order.attendanceStatus !== 'Concluído') return false;
      } else if (dashboardFilter === 'todos_hoje') {
        // Todos os agendamentos de hoje
        if (!isOrderToday) return false;
      } else if (dashboardFilter === 'futuros') {
        // Agendamentos dos próximos dias (futuros)
        if (!isOrderFuture || order.attendanceStatus === 'Concluído') return false;
      } else if (dashboardFilter === 'pendente_confirmacao') {
        if (order.attendanceStatus !== 'Pendente Confirmação') return false;
      } else if (dashboardFilter === 'entregas') {
        // Find deliveries if needed, but since deliveries is a separate state,
        // we might need to handle them differently if we want them in the main list.
        // For now, let's assume 'entregas' filter hides orders and we'll show a separate list.
        return false;
      } else if (dashboardFilter === 'todos') {
        // Histórico geral / Todos os registros: nenhum filtro de data aplicado
      }

      // 2. Search Query
      const query = searchQuery.toLowerCase().trim();
      if (!query) return true;
      return (
        order.customerName.toLowerCase().includes(query) ||
        order.customerPhone.includes(query) ||
        order.id.toLowerCase().includes(query) ||
        order.applianceType.toLowerCase().includes(query) ||
        order.applianceBrand.toLowerCase().includes(query) ||
        (order.applianceModel && order.applianceModel.toLowerCase().includes(query)) ||
        order.technicianName.toLowerCase().includes(query) ||
        order.attendantName.toLowerCase().includes(query) ||
        (order.defectDescription && order.defectDescription.toLowerCase().includes(query)) ||
        (order.serviceDescription && order.serviceDescription.toLowerCase().includes(query)) ||
        (order.partsReplaced && order.partsReplaced.toLowerCase().includes(query)) ||
        order.city.toLowerCase().includes(query) ||
        order.neighborhood.toLowerCase().includes(query) ||
        order.cep.includes(query)
      );
    });
  }, [orders, searchQuery, dashboardFilter]);

  // Statistics calculation
  const stats = useMemo(() => {
    const total = orders.length;
    const active = orders.filter((o) => o.status === 'Ativa').length;
    const revenue = orders.reduce((acc, curr) => acc + (curr.totalValue || 0), 0);
    const expiringSoon = orders.filter((o) => {
      if (o.status !== 'Ativa') return false;
      const days = getDaysRemaining(o.warrantyEndDate);
      return days >= 0 && days <= 30;
    }).length;

    return { total, active, revenue, expiringSoon };
  }, [orders]);

  // Financial Calculations for Today (Faturamento, Gastos e Lucro Real)
  const todayStr = getLocalDateString();
  const hojeOrders = useMemo(() => {
    const isToday = (dateStr?: string) => {
      if (!dateStr) return false;
      return extractDateOnly(dateStr) === todayStr;
    };
    return orders.filter((o) => isToday(o.scheduledDate) || (!o.scheduledDate && isToday(o.createdAt)));
  }, [orders, todayStr]);

  const todayRevenue = useMemo(() => {
    return hojeOrders.reduce((acc, curr) => acc + (curr.totalValue || 0), 0);
  }, [hojeOrders]);

  const todayExpenses = useMemo(() => {
    return expenses.filter((e) => e.date === todayStr);
  }, [expenses, todayStr]);

  const todayExpensesTotal = useMemo(() => {
    return todayExpenses.reduce((acc, curr) => acc + (curr.amount || 0), 0);
  }, [todayExpenses]);

  const todayNetProfit = todayRevenue - todayExpensesTotal;

  // Sound Alert Logic for Attendant (New Return)
  const pendingApprovals = useMemo(() => 
    orders.filter(o => o.attendanceStatus === 'Pendente Confirmação'),
  [orders]);

  useEffect(() => {
    if (pendingApprovals.length > lastPendingCount && currentUser?.role !== 'tecnico') {
      setShowNewReturnAlert(true);
      sendBrowserNotification(
        'Nova OS Finalizada pelo Técnico!',
        `Existem ${pendingApprovals.length} serviço(s) aguardando sua confirmação.`
      );
      // Play high priority return sound
      const playReturnSound = () => {
        try {
          const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const playNote = (freq: number, startTime: number, duration: number, type: OscillatorType = 'sine') => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.type = type;
            osc.frequency.setValueAtTime(freq, startTime);
            gain.gain.setValueAtTime(0, startTime);
            gain.gain.linearRampToValueAtTime(0.2, startTime + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
            osc.start(startTime);
            osc.stop(startTime + duration);
          };
          // Arpeggio
          playNote(523.25, audioCtx.currentTime, 0.5); // C5
          playNote(659.25, audioCtx.currentTime + 0.15, 0.5); // E5
          playNote(783.99, audioCtx.currentTime + 0.3, 0.5); // G5
          playNote(1046.50, audioCtx.currentTime + 0.45, 1.0, 'triangle'); // C6
        } catch (e) {}
      };
      playReturnSound();
    }
    setLastPendingCount(pendingApprovals.length);
  }, [pendingApprovals.length, currentUser?.role]);

  // Persistent background chime if there are pending returns (to not forget)
  useEffect(() => {
    let interval: number | null = null;
    if (pendingApprovals.length > 0 && currentUser?.role !== 'tecnico') {
      const playSoftChime = () => {
        try {
          const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.frequency.setValueAtTime(880, audioCtx.currentTime);
          gain.gain.setValueAtTime(0, audioCtx.currentTime);
          gain.gain.linearRampToValueAtTime(0.05, audioCtx.currentTime + 0.05);
          gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.8);
          osc.start();
          osc.stop(audioCtx.currentTime + 0.8);
        } catch (e) {}
      };
      interval = window.setInterval(playSoftChime, 10000); // Gentle reminder every 10s
    }
    return () => { if (interval) clearInterval(interval); };
  }, [pendingApprovals.length, currentUser?.role]);

  const handleFinalizeService = (order: WarrantyOrder, e: React.MouseEvent) => {
    e.stopPropagation();
    // Open edit modal with technician's values already filled
    setOrderToEdit({
      ...order,
      attendanceStatus: 'Concluído'
    });
    setIsOrderModalOpen(true);
  };

  const handleSaveOrder = (orderData: any, editId?: string) => {
    if (editId) {
      const updated = updateOrder(editId, orderData);
      if (updated && updated.attendanceStatus === 'Concluído') {
        setSelectedReceiptOrder(updated);
      }
    } else {
      const created = addOrder(orderData);
      if (created.orderType !== 'agendamento') {
        setSelectedReceiptOrder(created);
      } else {
        // Prompt for new appointment when sent to technician
        if (window.confirm('Agendamento enviado para o técnico responsável com sucesso! Deseja criar um novo agendamento?')) {
          setOrderToEdit(null);
          setIsOrderModalOpen(true);
        }
      }
    }
    // Update state immediately with a brand new array reference
    setOrders([...getOrders()]);
    setIsOrderModalOpen(false);
    setOrderToEdit(null);

    // Run customer upsert in the background without blocking or interfering with order creation
    try {
      upsertCustomerFromOrder(orderData).catch((err) => {
        console.warn('[CustomerSync] Non-blocking notice in handleSaveOrder:', err);
      });
    } catch (err) {
      console.warn('[CustomerSync] Non-blocking notice:', err);
    }
  };

  const handleSaveSchedule = (scheduleData: Omit<WarrantyOrder, 'id' | 'createdAt' | 'status'>) => {
    // 1. Create order first so nothing can ever block or delay the appointment
    const created = addOrder({
      ...scheduleData,
      orderType: 'agendamento',
      attendanceStatus: scheduleData.attendanceStatus || 'Na fila / Aguardando',
    });

    // 2. Immediately update state with a brand new array reference so UI re-renders instantly
    setOrders([...getOrders()]);
    setIsOrderModalOpen(false);
    setIsScheduleModalOpen(false);
    setSelectedScheduleOrder(created);

    confetti({
      particleCount: 100,
      spread: 80,
      origin: { y: 0.6 }
    });
    setSuccessNotification(`✨ Agendamento realizado com sucesso! Técnico ${scheduleData.technicianName || 'escalado'} notificado com sucesso!`);
    setTimeout(() => {
      setSuccessNotification(null);
    }, 5000);

    // 3. Run customer upsert in the background without blocking order creation
    try {
      upsertCustomerFromOrder(scheduleData).catch((err) => {
        console.warn('[CustomerSync] Non-blocking notice in handleSaveSchedule:', err);
      });
    } catch (err) {
      console.warn('[CustomerSync] Non-blocking notice:', err);
    }

    if (window.confirm('Agendamento enviado para o técnico responsável com sucesso! Deseja criar um novo agendamento?')) {
      setIsScheduleModalOpen(true);
    }
  };

  const handleSaveDelivery = (deliveryData: any) => {
    if (deliveryToEdit) {
      updateDelivery(deliveryToEdit.id, deliveryData);
    } else {
      addDelivery(deliveryData);
    }
    setDeliveries(getDeliveries());
    setIsDeliveryModalOpen(false);
    setDeliveryToEdit(null);
  };

  const handleConvertToWarranty = (scheduledOrder: WarrantyOrder) => {
    setSelectedScheduleOrder(null);
    setOrderToEdit({
      ...scheduledOrder,
      orderType: 'garantia',
      attendanceStatus: 'Em campo',
    });
    setIsOrderModalOpen(true);
  };

  const handleEditOrder = (order: WarrantyOrder, e: React.MouseEvent) => {
    e.stopPropagation();
    setOrderToEdit(order);
    setIsOrderModalOpen(true);
  };

  const handleDeleteOrder = (order: WarrantyOrder, e: React.MouseEvent) => {
    e.stopPropagation();
    setOrderToDelete(order);
  };

  const confirmDeleteOrder = () => {
    if (!orderToDelete) return;
    deleteOrder(orderToDelete.id);
    setOrders(getOrders());
    setOrderToDelete(null);
  };

  const handleQuickWhatsApp = (order: WarrantyOrder, e: React.MouseEvent) => {
    e.stopPropagation();
    const rawPhone = cleanNumeric(order.customerPhone);
    const dest = rawPhone.length >= 10 ? `55${rawPhone}` : '';
    let text = '';
    if (order.orderType === 'agendamento') {
      text = encodeURIComponent(
        `Olá ${order.customerName}! Aqui é da ${company.name}. Confirmamos o agendamento da sua visita técnica (${order.id}) para o aparelho ${order.applianceType} (${order.applianceBrand}). Data agendada: ${order.scheduledDate ? formatDate(order.scheduledDate) : 'A combinar'} - ${order.scheduledTime || 'Horário Comercial'}. Técnico designado: ${order.technicianName}. Qualquer dúvida estamos à disposição no WhatsApp!`
      );
    } else {
      text = encodeURIComponent(
        `Olá ${order.customerName}! Aqui é da ${company.name}. Segue o comprovante de garantia da sua Ordem de Serviço ${order.id} (${order.applianceType}). Prazo de garantia: ${order.warrantyMonths} meses válido até ${formatDate(order.warrantyEndDate)}. Estamos sempre à disposição!`
      );
    }
    const url = dest ? `https://wa.me/${dest}?text=${text}` : `https://wa.me/?text=${text}`;
    window.open(url, '_blank');
  };

  const handleLogout = () => {
    logoutUser();
    setCurrentUser(null);
    setAuthInitialMode('login');
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#0f1115] text-slate-100 flex flex-col font-sans overflow-hidden">
        {/* Background charcoal glow blurs */}
        <div className="fixed top-0 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="fixed bottom-0 right-1/4 w-96 h-96 bg-indigo-600/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="absolute top-4 right-4 z-20">
          <PWAInstallButton variant="header" />
        </div>
        
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

  const handleStaffAdded = (newStaff: StaffMember) => {
    setStaffList([...getStaff()]);
  };

  const handleSaveCompany = (newSettings: CompanySettings) => {
    saveCompanySettings(newSettings);
    setCompany(newSettings);
  };

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

  return (
    <div className="min-h-screen bg-[#0f1115] text-slate-100 flex flex-col font-sans pb-16 md:pb-8 overflow-x-hidden">
      {successNotification && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white shadow-[0_10px_40px_rgba(16,185,129,0.5)] border border-emerald-400/50 animate-bounce">
          <Sparkles className="w-5 h-5 text-emerald-200 shrink-0" />
          <span className="text-xs sm:text-sm font-extrabold tracking-wide">{successNotification}</span>
        </div>
      )}

      {/* Background charcoal glow blurs */}
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-0 right-1/4 w-96 h-96 bg-indigo-600/5 rounded-full blur-3xl pointer-events-none" />

      {/* TOP HEADER: Barra Superior (Logo à Esquerda | Administrador + Sair à Direita) + Barra de Navegação Dedicada */}
      <header className="sticky top-0 z-40 bg-[#121418]/95 backdrop-blur-xl border-b border-white/5 shadow-2xl">
        {/* LINHA 1: Lado Esquerdo (Branding/Logo) & Lado Direito (Administrador + Sair) */}
        <div className="w-full px-3 sm:px-6 py-2.5 flex items-center justify-between gap-4">
          
          {/* LADO ESQUERDO: Logo & Informações da Empresa */}
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
                  title="Sincronização em tempo real ativa entre computadores e celulares"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                  <span className="hidden sm:inline">Sincronizado</span>
                </div>
              </div>
              <p className="text-[10px] sm:text-[11px] text-cyan-400/70 font-semibold truncate max-w-[200px] sm:max-w-md lg:max-w-xl mt-0.5 italic">
                {company.slogan}
              </p>
            </div>
          </div>

          {/* LADO DIREITO: Administrador + Botão de Sair (+ Horário em telas grandes) */}
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0 ml-auto">
            <div className="hidden xl:flex flex-col text-[11px] text-slate-400 pr-3 border-r border-white/5 text-right">
              <span className="flex items-center justify-end gap-1.5 text-slate-200 font-bold">
                <Clock className="w-3.5 h-3.5 text-cyan-400" />
                {company.businessHours}
              </span>
              <span className="flex items-center justify-end gap-1.5 font-num text-cyan-400 mt-0.5">
                <Phone className="w-3.5 h-3.5 text-emerald-400" />
                {company.phone}
              </span>
            </div>

            {currentUser ? (
              <div className="flex items-center gap-2">
                {/* Administrador Badge */}
                <div className="flex items-center gap-2 bg-slate-900/80 border border-white/10 rounded-2xl p-1 sm:pr-3 shadow-inner">
                  <div
                    className={`h-8 w-8 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 ${
                      currentUser.role === 'admin'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-[0_0_12px_rgba(245,158,11,0.2)]'
                        : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                    }`}
                  >
                    {currentUser.role === 'admin' ? (
                      <Crown className="w-3.5 h-3.5 text-amber-400" />
                    ) : (
                      <UserIcon className="w-3.5 h-3.5" />
                    )}
                  </div>
                  <div className="hidden sm:block text-left">
                    <div className="font-bold text-slate-200 text-xs sm:text-sm truncate max-w-[120px] leading-tight">
                      {currentUser.name.split(' ')[0]}
                    </div>
                    <div className="text-[9px] text-cyan-400 font-black uppercase tracking-wider">
                      {currentUser.role === 'admin' ? 'Administrador' : currentUser.role}
                    </div>
                  </div>
                </div>

                {/* Botão de Sair no lado direito */}
                <button
                  onClick={handleLogout}
                  className="px-3 sm:px-3.5 py-2 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 hover:border-rose-500/60 text-rose-300 hover:text-rose-100 transition-all text-xs font-bold flex items-center gap-1.5 shadow-md active:scale-95 group shrink-0"
                  title="Sair da Conta (Logout)"
                >
                  <LogOut className="w-3.5 h-3.5 text-rose-400 group-hover:scale-110 transition-transform" />
                  <span className="font-semibold">Sair</span>
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className="px-4 py-2 rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-600 text-white text-xs font-bold shadow-lg active:scale-95 transition-all shrink-0"
              >
                Entrar
              </button>
            )}
          </div>

        </div>

        {/* LINHA 2: Barra de Navegação e Ações Rápidas (Nenhum botão cortado ou sobreposto) */}
        <div className="w-full px-3 sm:px-6 py-1.5 bg-[#0b0e13]/70 border-t border-white/5 flex items-center justify-between gap-3 overflow-x-auto no-scrollbar">
          {/* Navegação Principal */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              onClick={() => setIsStaffModalOpen(true)}
              className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-900/60 border border-white/5 hover:border-cyan-500/30 text-slate-300 hover:text-cyan-300 transition-all text-xs font-bold flex items-center gap-1.5 shadow-md active:scale-95 group shrink-0"
            >
              <Users className="w-3.5 h-3.5 text-cyan-400 group-hover:scale-110 transition-transform" />
              <span>Equipe</span>
            </button>

            <button
              onClick={() => setIsCustomerModalOpen(true)}
              className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-900/60 border border-white/5 hover:border-cyan-500/30 text-slate-300 hover:text-cyan-300 transition-all text-xs font-bold flex items-center gap-1.5 shadow-md active:scale-95 group shrink-0"
            >
              <Users className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition-transform" />
              <span>Clientes</span>
            </button>

            <button
              onClick={() => setIsFinancialReportOpen(true)}
              className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-900/60 border border-emerald-500/30 hover:border-emerald-400/60 text-emerald-300 hover:text-emerald-200 transition-all text-xs font-bold flex items-center gap-1.5 shadow-md active:scale-95 group shrink-0"
              title="Abrir tela de relatório de entrada, saída e lucro"
            >
              <BarChart3 className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition-transform" />
              <span>Relatórios</span>
            </button>

            <button
              onClick={() => setIsSettingsModalOpen(true)}
              className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-900/60 border border-white/5 hover:border-cyan-500/30 text-slate-300 hover:text-cyan-300 transition-all text-xs font-bold flex items-center gap-1.5 shadow-md active:scale-95 group shrink-0"
            >
              <Settings className="w-3.5 h-3.5 text-cyan-400 group-hover:rotate-90 transition-transform duration-500" />
              <span>Empresa</span>
            </button>
          </div>

          {/* Ações do Sistema (Alertas & Instalação PWA) */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 ml-auto">
            <button
              onClick={handleEnableNotifications}
              className={`px-2.5 sm:px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 shadow-md transition-all active:scale-95 shrink-0 ${
                notifGranted 
                  ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300' 
                  : 'bg-slate-900/60 border-white/5 text-slate-400 hover:text-cyan-300'
              }`}
              title={notifGranted ? 'Notificações Push ativadas' : 'Ativar Notificações Push no Desktop/Mobile'}
            >
              <Bell className={`w-3.5 h-3.5 ${notifGranted ? 'text-cyan-400 animate-bounce' : 'text-slate-400'}`} />
              <span>{notifGranted ? 'Alertas Ativos' : 'Ativar Alertas'}</span>
            </button>

            <PWAInstallButton variant="header" />
          </div>
        </div>
      </header>

      {/* FLOATING CRITICAL NOTIFICATION: NEW TECHNICIAN RETURN */}
      {showNewReturnAlert && pendingApprovals.length > 0 && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[60] w-[92%] max-w-lg animate-bounce">
          <div 
            onClick={() => {
              setShowNewReturnAlert(false);
              setDashboardFilter('pendente_confirmacao');
            }}
            className="cursor-pointer p-4 rounded-3xl bg-amber-500 text-slate-950 shadow-[0_0_50px_rgba(245,158,11,0.5)] border-2 border-white/20 flex items-center justify-between gap-4 group"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-slate-950 flex items-center justify-center text-amber-500 shadow-inner">
                <AlertTriangle className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h4 className="text-sm font-black uppercase tracking-tight leading-none">Novo Retorno do Técnico!</h4>
                <p className="text-[11px] font-bold opacity-80 mt-1 flex items-center gap-1.5">
                  Existem <span className="font-num text-slate-950 bg-white/30 px-1 rounded">{pendingApprovals.length}</span> serviços aguardando finalização.
                </p>
              </div>
            </div>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setShowNewReturnAlert(false);
              }}
              className="p-2 rounded-xl hover:bg-slate-950/20 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* MAIN CONTAINER (Compact & Screen efficient) */}
      <main className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-5 sm:space-y-8 flex-1">
        {/* Banner if no user registered yet */}
        {totalUsers === 0 && (
          <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/15 via-indigo-500/15 to-cyan-500/15 border border-amber-500/40 backdrop-blur-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-[0_0_30px_rgba(245,158,11,0.15)]">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-amber-500/20 border border-amber-500/50 flex items-center justify-center text-amber-300 shrink-0">
                <Crown className="w-6 h-6 animate-bounce" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-amber-300">
                  Bem-vindo! Cadastre o Primeiro Usuário
                </h4>
                <p className="text-xs text-slate-300">
                  Conforme configurado: <strong>o primeiro usuário cadastrado será sempre o Administrador</strong> com privilégios mestre.
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setAuthInitialMode('register');
                setIsAuthModalOpen(true);
              }}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-lg active:scale-95 transition-all shrink-0"
            >
              Criar Cadastro de Admin
            </button>
          </div>
        )}

        {/* NOTIFICAÇÃO CRÍTICA: SERVIÇOS DEVOLVIDOS PELO TÉCNICO (AGUARDANDO FINALIZAÇÃO DO ATENDENTE) */}
        {pendingApprovals.length > 0 && (
          <section className="animate-fadeIn space-y-3">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-500 flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 animate-bounce" />
                Atenção: Retornos do Técnico
                <span className="flex h-1.5 w-1.5 rounded-full bg-rose-500 animate-ping" />
              </h3>
              <span className="text-[10px] font-mono font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
                {pendingApprovals.length} pendentes
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {pendingApprovals.map(order => (
                <div 
                  key={order.id} 
                  className="relative p-5 rounded-[2rem] bg-slate-900 border-2 border-amber-500 shadow-[0_0_40px_rgba(245,158,11,0.1)] flex flex-col md:flex-row md:items-center justify-between gap-6 transition-all hover:shadow-[0_0_50px_rgba(245,158,11,0.2)] group overflow-hidden"
                >
                  {/* Status Badge (Match user screenshot) */}
                  <div className="absolute top-0 right-0">
                    <div className="px-5 py-2 rounded-bl-3xl bg-amber-500 text-slate-950 text-[10px] font-black uppercase tracking-[0.1em] shadow-lg">
                      Aguardando Atendente
                    </div>
                  </div>

                  <div className="space-y-4 flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-xs font-mono font-black text-amber-500 bg-amber-500/10 px-3 py-1.5 rounded-xl border border-amber-500/30">
                        {order.id}
                      </span>
                      <h2 className="text-xl font-black text-white tracking-tight">{order.customerName}</h2>
                      <div className="px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-[10px] font-black uppercase text-slate-400">
                        {order.applianceType}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Tech Details Box */}
                      <div className="p-4 rounded-2xl bg-slate-950/50 border border-slate-800 space-y-2.5">
                        <div className="flex items-center gap-2 text-[10px] font-black uppercase text-cyan-400">
                          <Wrench className="w-3.5 h-3.5" />
                          <span>Serviço Realizado / O que foi trocado</span>
                        </div>
                        <p className="text-xs text-slate-200 font-medium leading-relaxed italic">
                          "{order.serviceDescription || 'Não informado'}"
                        </p>
                        {order.partsReplaced && (
                          <div className="flex items-center gap-2 pt-1 border-t border-slate-800/50">
                            <Layers className="w-3 h-3 text-slate-500" />
                            <span className="text-[10px] text-slate-400">
                              Peças: <strong className="text-slate-200">{order.partsReplaced}</strong>
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Financial / Tech Info Box */}
                      <div className="p-4 rounded-2xl bg-slate-950/50 border border-slate-800 flex flex-col justify-center gap-3">
                        <div className="flex justify-between items-end">
                          <div className="space-y-0.5">
                            <span className="text-[9px] uppercase font-black text-slate-500 tracking-tighter">Valor Final Sugerido</span>
                            <div className="text-2xl font-mono font-black text-emerald-400 leading-none">
                              {formatCurrency(order.totalValue)}
                            </div>
                          </div>
                          <div className="text-right space-y-0.5">
                            <span className="text-[9px] uppercase font-black text-slate-500 tracking-tighter">Forma de Pagto</span>
                            <div className="px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-400 text-[10px] font-black border border-emerald-500/20">
                              {order.paymentMethod || 'Pix'}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 pt-2 border-t border-slate-800/50">
                          <UserIcon className="w-3 h-3 text-cyan-500" />
                          <span className="text-[10px] text-slate-400 font-bold">
                            Técnico Responsável: <span className="text-cyan-400">{order.technicianName}</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-[10px] text-amber-500/80 font-bold bg-amber-500/5 p-2 rounded-xl border border-amber-500/20">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Devolvido ao atendente principal para confirmação e emissão de notinha/garantia.</span>
                    </div>
                  </div>

                  <div className="flex items-stretch gap-3 shrink-0 pt-4 md:pt-0 border-t md:border-t-0 border-slate-800">
                    <button
                      onClick={(e) => handleQuickWhatsApp(order, e)}
                      className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500 hover:text-slate-950 transition-all active:scale-90"
                      title="WhatsApp Cliente"
                    >
                      <Share2 className="w-6 h-6" />
                    </button>

                    <button 
                      onClick={(e) => handleFinalizeService(order, e)}
                      className="flex-1 md:flex-none px-8 py-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black uppercase tracking-[0.1em] shadow-[0_0_30px_rgba(16,185,129,0.3)] transition-all active:scale-95 flex items-center justify-center gap-3 group/btn"
                    >
                      <CheckCircle2 className="w-6 h-6 group-hover/btn:scale-125 transition-transform" />
                      <span>Finalizar & Emitir Garantia</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* TELA DE DASHBOARD DE ATENDIMENTO & GARANTIAS (METRICS ONLY) */}
        <section className="space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <h2 className="text-xs font-black uppercase tracking-[0.3em] text-cyan-500 flex items-center gap-3 bg-cyan-500/5 px-5 py-2 rounded-full border border-cyan-500/20 w-fit">
              <span className="flex h-2.5 w-2.5 rounded-full bg-cyan-400 shadow-[0_0_10px_#22d3ee] animate-pulse" />
              Dashboard de Atendimento
            </h2>
          </div>

          {/* SEARCH, FILTERS & ACTION BAR (MOVED UP) */}
          <div className="pb-2 space-y-3">
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
              {/* Search Input */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3.5 top-3 text-cyan-400" />
                <input
                  type="text"
                  placeholder="Buscar por cliente, telefone, OS, Geladeira, Máquina de Lavar..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-slate-900/90 border border-slate-800 text-white placeholder-slate-500 text-xs sm:text-sm focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400/40 transition-all shadow-inner"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-2.5 text-xs text-slate-500 hover:text-white"
                  >
                    Limpar
                  </button>
                )}
              </div>

              {/* View Mode Toggle & Action Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Toggle Lista Compacta vs Cards */}
                <div className="flex items-center p-1 rounded-xl bg-slate-900 border border-slate-800 shrink-0">
                  <button
                    type="button"
                    onClick={() => setViewMode('lista')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      viewMode === 'lista'
                        ? 'bg-cyan-500 text-slate-950 shadow-[0_0_12px_rgba(6,182,212,0.4)]'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                    title="Modo Lista Compacta"
                  >
                    <List className="w-3.5 h-3.5" />
                    <span>Lista</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('cards')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      viewMode === 'cards'
                        ? 'bg-cyan-500 text-slate-950 shadow-[0_0_12px_rgba(6,182,212,0.4)]'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                    title="Modo Cards Expandidos"
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    <span>Cards</span>
                  </button>
                </div>

                {/* Action Buttons */}
                <button
                  onClick={() => setIsScheduleModalOpen(true)}
                  className="px-3.5 sm:px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-500 hover:from-purple-500 hover:to-cyan-400 text-white font-bold text-xs sm:text-sm shadow-[0_0_20px_rgba(168,85,247,0.3)] active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Calendar className="w-4 h-4 text-purple-200" />
                  <span>Agendamento</span>
                </button>

                <button
                  onClick={() => {
                    setDeliveryToEdit(null);
                    setIsDeliveryModalOpen(true);
                  }}
                  className="px-3 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-bold text-xs shadow-[0_0_20px_rgba(245,158,11,0.3)] active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Truck className="w-4 h-4 text-amber-100" />
                  <span>Entregas / Retirada</span>
                </button>

                <button
                  onClick={() => {
                    setOrderToEdit(null);
                    setIsOrderModalOpen(true);
                  }}
                  className="px-3 py-2 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold text-xs shadow-[0_0_20px_rgba(6,182,212,0.3)] active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Nova Garantia / OS</span>
                </button>
              </div>
            </div>

            {/* Context bar with count and quick feedback */}
            <div className="flex items-center justify-between text-xs text-slate-400 px-1 pt-0.5">
              <span className="flex items-center gap-1.5">
                <span>Exibindo:</span>
                <strong className="text-white">
                  {dashboardFilter === 'faltam_hoje' || dashboardFilter === null
                    ? '⚡ Faltam Atender Hoje (Pendentes no Dia)'
                    : dashboardFilter === 'concluidos_hoje'
                    ? '✅ Concluídos de Hoje'
                    : dashboardFilter === 'todos_hoje'
                    ? '📋 Todos de Hoje'
                    : dashboardFilter === 'futuros'
                    ? '📅 Próximos Dias'
                    : dashboardFilter === 'pendente_confirmacao'
                    ? '📥 Devolvidos pelo Técnico'
                    : dashboardFilter === 'entregas'
                    ? '🚚 Entregas & Retiradas de Hoje'
                    : '🗂️ Histórico Geral'}
                </strong>
                {searchQuery && <span className="text-cyan-400 italic font-normal">• busca "{searchQuery}"</span>}
              </span>
              <span className="text-[11px] font-mono font-semibold text-cyan-300 bg-cyan-500/10 border border-cyan-500/30 px-2.5 py-0.5 rounded-full">
                {filteredOrders.length} {filteredOrders.length === 1 ? 'registro' : 'registros'}
              </span>
            </div>
          </div>

          <AttendanceDashboard
            orders={orders}
            activeFilter={dashboardFilter}
            onSelectFilter={setDashboardFilter}
            expenses={expenses}
            onOpenExpenses={handleOpenExpenses}
            deliveries={deliveries}
            onOpenDeliveries={() => setDashboardFilter('entregas')}
            onOpenFinancialAnalysis={() => setIsFinancialReportOpen(true)}
          />
        </section>

        {/* DELIVERY LIST VIEW (When filter is 'entregas') */}
        {dashboardFilter === 'entregas' && (
          <section className="space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-xs font-black uppercase tracking-widest text-amber-500 flex items-center gap-2">
                <Truck className="w-4 h-4" />
                Lista de Entregas & Retiradas (Logística)
              </h3>
              <button
                onClick={() => setDashboardFilter('faltam_hoje')}
                className="text-[10px] font-bold text-slate-400 hover:text-white flex items-center gap-1"
              >
                <X className="w-3 h-3" /> Fechar
              </button>
            </div>
            
            {deliveries.filter(d => extractDateOnly(d.scheduledDate) === getLocalDateString()).length === 0 ? (
              <div className="text-center py-12 bg-slate-900/40 rounded-3xl border border-slate-800">
                <Truck className="w-10 h-10 text-slate-600 mx-auto mb-2 opacity-50" />
                <p className="text-xs text-slate-500">Nenhuma entrega ou retirada agendada para hoje.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {deliveries
                  .filter(d => extractDateOnly(d.scheduledDate) === getLocalDateString())
                  .map((delivery) => (
                    <div 
                      key={delivery.id}
                      className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-amber-500/40 transition-all flex flex-col gap-3 group"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                            delivery.type === 'Entrega' ? 'bg-blue-500/20 text-blue-400' : 'bg-orange-500/20 text-orange-400'
                          }`}>
                            {delivery.type}
                          </span>
                          <span className="text-xs font-mono font-bold text-slate-400">{delivery.id}</span>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          delivery.status === 'Concluído' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                        }`}>
                          {delivery.status}
                        </span>
                      </div>
                      
                      <div>
                        <h4 className="text-sm font-bold text-white">{delivery.customerName}</h4>
                        <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 text-cyan-400" />
                          {delivery.street}, {delivery.number} - {delivery.neighborhood}
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-800/50 mt-auto">
                        <div className="flex items-center gap-3 text-[10px] text-slate-500">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-amber-500" />
                            {delivery.scheduledTime}
                          </span>
                          <span className="flex items-center gap-1">
                            <Truck className="w-3 h-3 text-cyan-500" />
                            {delivery.driverName}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button 
                            onClick={() => {
                              setDeliveryToEdit(delivery);
                              setIsDeliveryModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </section>
        )}

        {/* WARRANTY ORDERS LIST (COMPACT CLICKABLE LIST OR CARDS) */}
        <section className="space-y-2">
          {filteredOrders.length === 0 ? (
            <div className="text-center py-16 px-4 bg-slate-900/40 rounded-3xl border border-slate-800/80">
              <Wrench className="w-12 h-12 text-slate-600 mx-auto mb-3 animate-pulse" />
              <h3 className="text-base font-bold text-white mb-1">Nenhum agendamento encontrado</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4">
                {dashboardFilter === 'faltam_hoje' || dashboardFilter === null
                  ? 'Nenhum agendamento pendente para hoje! Todas as visitas técnicas do dia foram atendidas ou não há agendamentos marcados.'
                  : searchQuery
                  ? `Nenhum resultado corresponde à busca "${searchQuery}".`
                  : 'Nenhum registro encontrado nesta categoria.'}
              </p>
              <div className="flex items-center justify-center gap-2">
                {dashboardFilter !== 'todos' && (
                  <button
                    onClick={() => setDashboardFilter('todos')}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all"
                  >
                    Ver Histórico Completo
                  </button>
                )}
                <button
                  onClick={() => setIsScheduleModalOpen(true)}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-lg transition-all"
                >
                  Novo Agendamento
                </button>
              </div>
            </div>
          ) : viewMode === 'lista' ? (
            /* COMPACT CLICKABLE LIST VIEW */
            <div className="space-y-1.5">
              {/* Header for Desktop */}
              <div className="hidden md:flex items-center justify-between text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 px-4 py-1.5 bg-slate-950/70 rounded-xl border border-slate-800/60">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <span className="w-24 shrink-0">Horário / Data</span>
                  <span className="w-px h-3 bg-slate-800 shrink-0" />
                  <span className="flex-1">OS / Cliente / Aparelho / Defeito</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="hidden lg:inline-block w-28">Técnico</span>
                  <span className="w-28 text-center">Status</span>
                  <span className="w-20 text-right">Valor</span>
                  <span className="w-32 text-center">Ações</span>
                </div>
              </div>

              {/* Rows */}
              {filteredOrders.map((order) => (
                <OrderListRow
                  key={order.id}
                  order={order}
                  onClick={() => {
                    if (order.orderType === 'agendamento') {
                      setSelectedScheduleOrder(order);
                    } else {
                      setSelectedReceiptOrder(order);
                    }
                  }}
                  onEdit={(e) => handleEditOrder(order, e)}
                  onDelete={(e) => handleDeleteOrder(order, e)}
                  onWhatsApp={(e) => handleQuickWhatsApp(order, e)}
                  onReceipt={(e) => {
                    e.stopPropagation();
                    if (order.orderType === 'agendamento') {
                      setSelectedScheduleOrder(order);
                    } else {
                      setSelectedReceiptOrder(order);
                    }
                  }}
                  onFinalize={(e) => handleFinalizeService(order, e)}
                />
              ))}
            </div>
          ) : (
            /* EXPANDED CARDS VIEW */
            <div className="space-y-3.5">
              {filteredOrders.map((order) => {
                const daysLeft = getDaysRemaining(order.warrantyEndDate);
                const isExpired = order.status === 'Expirada' || daysLeft < 0;

                return (
                  <div
                    key={order.id}
                    onClick={() => {
                      if (order.orderType === 'agendamento') {
                        setSelectedScheduleOrder(order);
                      } else {
                        setSelectedReceiptOrder(order);
                      }
                    }}
                    className="group relative p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-slate-900/90 border border-slate-800 hover:border-cyan-500/50 transition-all duration-200 shadow-md hover:shadow-[0_0_30px_rgba(6,182,212,0.12)] cursor-pointer"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-800/80">
                      {/* OS number, Appliance type and brand */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`font-mono text-xs font-black px-2.5 py-1 rounded-lg border ${
                          order.orderType === 'agendamento'
                            ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                            : 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                        }`}>
                          {order.id}
                        </span>
                        <span className="text-xs font-bold text-white flex items-center gap-1.5">
                          <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                          {order.applianceType}
                        </span>
                        <span className="text-[11px] font-medium text-slate-400">
                          • {order.applianceBrand} {order.applianceModel || ''}
                        </span>
                        {order.attendanceStatus && (
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-md border flex items-center gap-1 ${
                              order.attendanceStatus === 'Pendente Confirmação'
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 animate-pulse'
                                : order.attendanceStatus === 'Na fila / Aguardando'
                                ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                                : order.attendanceStatus === 'Em campo'
                                ? 'bg-purple-500/15 text-purple-300 border-purple-500/40'
                                : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                            }`}
                          >
                            {order.attendanceStatus === 'Pendente Confirmação' ? 'Devolvido pelo Técnico' : order.attendanceStatus}
                          </span>
                        )}
                      </div>

                      {/* Status Badge with countdown / visit date */}
                      <div className="flex items-center gap-2">
                        {order.orderType === 'agendamento' ? (
                          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full border flex items-center gap-1.5 bg-purple-500/15 border-purple-500/40 text-purple-300">
                            <Calendar className="w-3 h-3 text-purple-400" />
                            <span>Visita: {order.scheduledDate ? formatDateWithWeekday(order.scheduledDate) : 'A agendar'}</span>
                          </span>
                        ) : (
                          <span
                            className={`text-[11px] font-bold px-2.5 py-1 rounded-full border flex items-center gap-1 ${
                              isExpired
                                ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                                : daysLeft <= 30
                                ? 'bg-amber-500/10 border-amber-500/30 text-amber-300 animate-pulse'
                                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                            }`}
                          >
                            <Shield className="w-3 h-3" />
                            {isExpired
                              ? 'Garantia Expirada'
                              : `${order.warrantyMonths} Meses (${daysLeft}d restantes)`}
                          </span>
                        )}

                        {/* Admin quick delete icon */}
                        {currentUser?.role === 'admin' && (
                          <button
                            onClick={(e) => handleDeleteOrder(order, e)}
                            className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                            title="Excluir Registro"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Customer, Address & Service details */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-3 text-xs">
                      {/* Customer & Address */}
                      <div className="md:col-span-5 space-y-1">
                        <div className="flex items-center gap-1.5 font-bold text-slate-100">
                          <UserIcon className="w-3.5 h-3.5 text-cyan-400" />
                          <span>{order.customerName}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1">
                          <Phone className="w-3 h-3 text-emerald-400" />
                          <span className="font-mono">{order.customerPhone}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-start gap-1">
                          <MapPin className="w-3 h-3 text-cyan-400 shrink-0 mt-0.5" />
                          <span className="truncate">
                            {order.street}, {order.number} - {order.neighborhood}, {order.city}/{order.state} (CEP {order.cep})
                          </span>
                        </div>
                      </div>

                      {/* Service & Replaced Part */}
                      <div className="md:col-span-4 space-y-1 bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/60">
                        <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center justify-between">
                          <span>{order.orderType === 'agendamento' ? 'Defeito / Solicitação' : 'Serviço & Peça Trocada'}</span>
                          {order.scheduledTime && (
                            <span className="text-purple-300 font-normal lowercase">{order.scheduledTime}</span>
                          )}
                        </div>
                        <p className="text-slate-200 line-clamp-2 text-[11px]">
                          {order.serviceDescription}
                        </p>
                        {order.partsReplaced && (
                          <div className="text-[10px] text-cyan-300 font-medium truncate">
                            🔩 Peça: {order.partsReplaced}
                          </div>
                        )}
                      </div>

                      {/* Financials & Quick Action buttons */}
                      <div className="md:col-span-3 flex flex-col justify-between items-start md:items-end gap-2 pt-1">
                        <div>
                          <div className="text-sm sm:text-base font-black text-cyan-400 font-mono">
                            {formatCurrency(order.totalValue)}
                          </div>
                          <span className="text-[10px] text-slate-400">
                            {order.paymentMethod} ({order.paymentStatus})
                          </span>
                        </div>

                        {/* Quick Action buttons */}
                        <div className="flex items-center gap-1.5 w-full md:w-auto flex-wrap justify-end">
                          {order.attendanceStatus === 'Pendente Confirmação' ? (
                            <button
                              type="button"
                              onClick={(e) => handleFinalizeService(order, e)}
                              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-400 hover:to-rose-500 text-white font-black text-xs shadow-md shadow-rose-900/30 active:scale-95 transition-all animate-pulse cursor-pointer"
                              title="Finalizar atendimento devolvido pelo técnico e emitir garantia/notinha"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Finalizar Atendimento</span>
                            </button>
                          ) : order.orderType === 'agendamento' ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedScheduleOrder(order);
                              }}
                              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-bold text-xs shadow-md shadow-cyan-900/30 active:scale-95 transition-all cursor-pointer"
                              title={`Enviar agendamento para o técnico responsável (${order.technicianName})`}
                            >
                              <Send className="w-3.5 h-3.5" />
                              <span>Enviar p/ Técnico</span>
                            </button>
                          ) : null}

                          <button
                            type="button"
                            onClick={(e) => handleQuickWhatsApp(order, e)}
                            className="flex-1 sm:flex-none flex items-center justify-center gap-1 py-1.5 px-2.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 text-[11px] font-semibold active:scale-95 transition-all cursor-pointer"
                            title="Enviar aviso no WhatsApp"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                            <span>WhatsApp</span>
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (order.orderType === 'agendamento') {
                                setSelectedScheduleOrder(order);
                              } else {
                                setSelectedReceiptOrder(order);
                              }
                            }}
                            className="flex-1 sm:flex-none flex items-center justify-center gap-1 py-1.5 px-2.5 rounded-xl bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/40 text-[11px] font-semibold active:scale-95 transition-all cursor-pointer"
                            title={order.orderType === 'agendamento' ? "Ver Comprovante da Visita" : "Abrir Recibo e Baixar PDF"}
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>{order.orderType === 'agendamento' ? 'Comprovante' : 'Recibo / PDF'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={(e) => handleEditOrder(order, e)}
                            className="flex-1 sm:flex-none flex items-center justify-center gap-1 py-1.5 px-2.5 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/40 text-[11px] font-semibold active:scale-95 transition-all cursor-pointer"
                            title="Editar informações desta garantia"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            <span>Editar</span>
                          </button>

                          <button
                            type="button"
                            onClick={(e) => handleDeleteOrder(order, e)}
                            className="flex-1 sm:flex-none flex items-center justify-center gap-1 py-1.5 px-2.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-[11px] font-semibold active:scale-95 transition-all cursor-pointer"
                            title="Excluir esta ordem de serviço"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Excluir</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Footer tags: Technician, Attendant & Driver */}
                    <div className="mt-3 pt-2.5 border-t border-slate-800/60 flex items-center justify-between text-[10px] text-slate-500 flex-wrap gap-2">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span>👨‍🔧 Técnico: <strong className="text-slate-300">{order.technicianName}</strong></span>
                        <span>📋 Atendente: <strong className="text-slate-300">{order.attendantName}</strong></span>
                        {order.driverName && (
                          <span>🚚 Motorista: <strong className="text-amber-300">{order.driverName}</strong></span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {order.clientSignature && (
                          <span className="text-cyan-400 flex items-center gap-1 font-semibold">
                            <CheckCircle2 className="w-3 h-3" /> Assinado
                          </span>
                        )}
                        <span>Emissão: {formatDate(order.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* MOBILE BOTTOM NAVIGATION BAR (FIXED FOR FIELD OPERATION) */}
      <nav className="fixed bottom-0 inset-x-0 z-40 bg-slate-950/95 backdrop-blur-xl border-t border-cyan-500/20 px-3 py-2 sm:hidden flex items-center justify-around shadow-[0_-5px_25px_rgba(0,0,0,0.6)]">
        <button
          onClick={() => {
            setSearchQuery('');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className="flex flex-col items-center gap-1 text-[10px] text-cyan-400 font-medium"
        >
          <Layers className="w-4 h-4" />
          <span>Ordens</span>
        </button>

        <button
          onClick={() => setIsScheduleModalOpen(true)}
          className="flex flex-col items-center gap-1 text-[10px] text-purple-400 hover:text-purple-300 font-medium"
        >
          <Calendar className="w-4 h-4 text-purple-400" />
          <span>Agendar</span>
        </button>

        {/* Elevated Glowing Action Button */}
        <button
          onClick={() => setIsOrderModalOpen(true)}
          className="relative -top-4 flex items-center justify-center h-13 w-13 rounded-full bg-gradient-to-tr from-cyan-500 to-indigo-600 text-white shadow-[0_0_25px_rgba(6,182,212,0.6)] active:scale-90 transition-transform border-2 border-slate-950"
        >
          <Plus className="w-6 h-6" />
        </button>

        <button
          onClick={() => setIsStaffModalOpen(true)}
          className="flex flex-col items-center gap-1 text-[10px] text-slate-400 hover:text-cyan-400 font-medium"
        >
          <Users className="w-4 h-4" />
          <span>Equipe</span>
        </button>

        <button
          onClick={() => setIsFinancialReportOpen(true)}
          className="flex flex-col items-center gap-1 text-[10px] text-emerald-400 hover:text-emerald-300 font-medium"
        >
          <BarChart3 className="w-4 h-4" />
          <span>Relatórios</span>
        </button>

        <button
          onClick={() => setIsSettingsModalOpen(true)}
          className="flex flex-col items-center gap-1 text-[10px] text-slate-400 hover:text-cyan-400 font-medium"
        >
          <Building2 className="w-4 h-4" />
          <span>Empresa</span>
        </button>

        <button
          onClick={() => {
            if (currentUser) {
              handleLogout();
            } else {
              setAuthInitialMode(totalUsers === 0 ? 'register' : 'login');
              setIsAuthModalOpen(true);
            }
          }}
          className="flex flex-col items-center gap-1 text-[10px] text-slate-400 hover:text-cyan-400 font-medium"
        >
          <UserIcon className="w-5 h-5" />
          <span>{currentUser ? 'Sair' : 'Entrar'}</span>
        </button>
      </nav>

      {/* MODALS */}
      {/* 1. Order Creation & Edit Modal */}
      <OrderFormModal
        isOpen={isOrderModalOpen}
        onClose={() => {
          setIsOrderModalOpen(false);
          setOrderToEdit(null);
        }}
        onSave={handleSaveOrder}
        staffList={staffList}
        onStaffAdded={handleStaffAdded}
        orderToEdit={orderToEdit}
        onOpenStaffManagement={() => setIsStaffModalOpen(true)}
      />

      {/* 2. Technical Visit Scheduling Modal */}
      <ScheduleModal
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
        onSave={handleSaveSchedule}
        staffList={staffList}
        onStaffAdded={handleStaffAdded}
        onOpenStaffManagement={() => setIsStaffModalOpen(true)}
      />

      {/* 2.5 User / Staff Management Modal (Atendente, Técnico, Motorista) */}
      <StaffManagementModal
        isOpen={isStaffModalOpen}
        onClose={() => setIsStaffModalOpen(false)}
        onStaffChange={() => setStaffList([...getStaff()])}
      />

      {/* 3. Schedule Visit Receipt / Certificate Modal */}
      {selectedScheduleOrder && (
        <ScheduleReceiptModal
          order={selectedScheduleOrder}
          company={company}
          isOpen={Boolean(selectedScheduleOrder)}
          onClose={() => setSelectedScheduleOrder(null)}
          onOpenNewSchedule={() => setIsScheduleModalOpen(true)}
        />
      )}

      {/* 4. Receipt / Warranty Certificate Modal (PDF & WhatsApp) */}
      {selectedReceiptOrder && (
        <ReceiptModal
          order={selectedReceiptOrder}
          company={company}
          isOpen={Boolean(selectedReceiptOrder)}
          onClose={() => setSelectedReceiptOrder(null)}
        />
      )}

      {/* 3. Authentication & First User Admin Registration Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        company={company}
        onClose={() => setIsAuthModalOpen(false)}
        initialMode={authInitialMode}
        onSuccess={(logged) => {
          setCurrentUser(logged);
        }}
      />

      {/* 4. Company & Header Settings Modal */}
      <CompanySettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        settings={company}
        onSave={handleSaveCompany}
      />

      {/* 5. Delete Confirmation Modal */}
      {orderToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-rose-500/40 rounded-3xl p-6 shadow-[0_0_50px_rgba(244,63,94,0.25)]">
            <div className="flex items-center gap-3 text-rose-400 mb-3">
              <div className="h-10 w-10 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Excluir Registro de Garantia</h3>
                <span className="text-xs font-mono text-rose-300 font-semibold">{orderToDelete.id}</span>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              Tem certeza que deseja excluir a garantia de <strong className="text-white">{orderToDelete.customerName}</strong> referente ao equipamento <strong className="text-cyan-300">{orderToDelete.applianceType}</strong>? Esta ação removerá o registro permanentemente.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setOrderToDelete(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDeleteOrder}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-900/40 flex items-center gap-1.5 active:scale-95 transition-all"
              >
                <Trash2 className="w-4 h-4" />
                <span>Sim, Excluir</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Expenses & Real Profit Modal */}
      <ExpensesModal
        isOpen={isExpensesModalOpen}
        onClose={() => setIsExpensesModalOpen(false)}
        initialTab={expensesModalTab}
        orders={orders}
        expenses={expenses}
        onExpensesChanged={handleExpensesChanged}
        currentUser={currentUser}
        todayRevenue={todayRevenue}
        totalRevenue={stats.revenue}
        onOpenReport={() => setIsFinancialReportOpen(true)}
      />

      {/* 7. Deliveries & Logistics Modal */}
      <DeliveryModal
        isOpen={isDeliveryModalOpen}
        onClose={() => {
          setIsDeliveryModalOpen(false);
          setDeliveryToEdit(null);
        }}
        onSave={handleSaveDelivery}
        staffList={staffList}
        onStaffAdded={handleStaffAdded}
        deliveryToEdit={deliveryToEdit}
      />

      {/* 8. Financial Analysis & Round Chart Modal */}
      <FinancialDashboardModal
        isOpen={isFinancialModalOpen}
        onClose={() => setIsFinancialModalOpen(false)}
        revenue={todayRevenue}
        expenses={todayExpensesTotal}
        orderCount={hojeOrders.length}
        expenseCount={todayExpenses.length}
      />

      {/* 9. Customer Management Modal */}
      <CustomerManagementModal
        isOpen={isCustomerModalOpen}
        onClose={() => setIsCustomerModalOpen(false)}
        orders={orders}
        onSelectOrder={(ord) => {
          setIsCustomerModalOpen(false);
          setSelectedReceiptOrder(ord);
        }}
      />

      {/* 10. Financial Report Screen (Entrada, Saída e Lucro por Dia, Semana, Mês e Data de Tal a Tal) */}
      <FinancialReportScreen
        isOpen={isFinancialReportOpen}
        onClose={() => setIsFinancialReportOpen(false)}
        orders={orders}
        expenses={expenses}
        company={company}
      />

      {/* Floating PWA Install Prompt Dock */}
      <PWAInstallButton variant="floating" />
    </div>
  );
}

