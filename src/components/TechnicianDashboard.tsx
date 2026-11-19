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
  AlertTriangle,
  QrCode,
  Copy,
  CreditCard,
  Banknote,
  DollarSign,
  X,
  FileText,
  RotateCcw,
  BarChart3,
} from 'lucide-react';
import { User, WarrantyOrder, CompanySettings, PaymentMethod } from '../types';
import { TechnicianOrderCard } from './TechnicianOrderCard';
import { TechnicianCompletionModal } from './TechnicianCompletionModal';
import { ReceiptModal } from './ReceiptModal';
import { ReturnScheduleModal } from './ReturnScheduleModal';
import { FinancialReportScreen } from './FinancialReportScreen';
import {
  normalizeOrder,
  normalizeCompanyProfile,
  isCarneOrderRow,
  isCarneConfigRow,
  sbSaveOrder,
  sbSelectByCompany,
  sbGetCompany,
  resolveCompanyId,
  setActiveCompanyId,
} from '../utils/supabaseService';
import { isWarrantyReturnOrder } from '../utils/returnHelpers';
import { superdb, superdbSchema } from '../lib/superdbClient';
import { getOrders, updateOrder, setMemoryOrders } from '../utils/storage';
import { formatCurrency, formatDate, formatDateWithWeekday, extractDateOnly, getLocalDateString } from '../utils/formatters';
import { buildPixQrSvgData, generatePixPayload } from '../utils/pixGenerator';
import { PWAInstallButton } from './PWAInstallButton';
import {
  enablePwaNotifications,
  ensureServiceWorkerRegistered,
  getNotificationPermissionStatus,
  sendBrowserNotification,
} from '../utils/notifications';
import {
  playTechAlertMelody,
  playUrgentSirenPulse,
  stopUrgentSiren,
  TECH_ALERT_MELODIES,
  unlockAudioContext,
} from '../utils/audio';

interface TechnicianDashboardProps {
  user: User;
  company: CompanySettings;
  onLogout: () => void;
}

export type TechFilterType = 'hoje' | 'futuros' | 'retornos' | 'concluidos' | 'aguardando' | 'campo' | 'data' | 'todos';

export function isOrderForTechnician(order: WarrantyOrder, techUser: User): boolean {
  // Regras de separação: Vendas diretas sem técnico, entregas com motorista e carnês não aparecem para técnicos
  if (order.dispatchMode === 'sem_tecnico' || order.dispatchMode === 'com_motorista') {
    return false;
  }

  // Registros sem agendamento (garantia direta / venda de balcão antiga como GI LOJA DE BOLO) só aparecem se marcados explicitamente com técnico
  if (order.dispatchMode !== 'com_tecnico') {
    if (order.orderType !== 'agendamento') {
      return false;
    }
    if (!order.scheduledDate && !order.scheduledTime) {
      return false;
    }
  }

  if (!techUser) return true;
  const userRole = (techUser.role || '').toLowerCase().trim();
  if (userRole === 'admin' || userRole === 'gerente' || userRole === 'atendente' || userRole === 'administrador') {
    return true; // Admins and attendants can see all technician-eligible orders
  }

  // Check all possible technician fields regardless of column name in database
  const possibleTechValues = [
    order.technicianName,
    (order as any).technician,
    (order as any).technician_name,
    (order as any).technician_id,
    (order as any).technicianId,
    (order as any).tech_name,
    (order as any).tecnico,
    (order as any).tech,
    (order as any).assigned_to,
  ].filter(Boolean);

  // If explicitly assigned via Nova Garantia / Carnê ("com_tecnico"), require an actual matching technician
  if (order.dispatchMode === 'com_tecnico' && possibleTechValues.length === 0) {
    return false;
  }

  // For scheduled visits (Agendamento), keep existing unassigned behavior intact
  if (possibleTechValues.length === 0) {
    return true;
  }

  const normalizeStr = (str: string) =>
    str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

  const rawUserName = normalizeStr(techUser.name || '');
  const rawUserEmail = normalizeStr(techUser.email || '');
  const rawUserId = normalizeStr(techUser.id || '');
  const emailPrefix = rawUserEmail.includes('@') ? rawUserEmail.split('@')[0] : rawUserEmail;

  for (const val of possibleTechValues) {
    const rawOrderTech = normalizeStr(String(val));

    if (
      !rawOrderTech ||
      rawOrderTech === 'nao atribuido' ||
      rawOrderTech.includes('selecione') ||
      rawOrderTech === 'tecnico especialista' ||
      rawOrderTech === 'a definir'
    ) {
      if (order.dispatchMode === 'com_tecnico') continue;
      return true;
    }

    // Direct ID match
    if (rawUserId && (rawOrderTech === rawUserId || rawOrderTech.includes(rawUserId))) {
      return true;
    }

    // Clean strings by removing "(tecnico)", "(atendente)", etc.
    const orderTech = rawOrderTech.replace(/\([^)]*\)/g, '').trim();
    const userName = rawUserName.replace(/\([^)]*\)/g, '').trim();

    // Direct or substring match
    if (rawUserName && (rawOrderTech.includes(rawUserName) || rawUserName.includes(rawOrderTech))) return true;
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
    if (emailPrefix && emailPrefix.length >= 2) {
      if (rawOrderTech.includes(emailPrefix) || emailPrefix.includes(rawOrderTech)) {
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
  const [liveCompany, setLiveCompany] = useState<CompanySettings>(company);
  const [selectedOrderForCompletion, setSelectedOrderForCompletion] = useState<WarrantyOrder | null>(null);
  const [selectedOrderForVisitOnly, setSelectedOrderForVisitOnly] = useState<WarrantyOrder | null>(null);
  const [visitAmountStr, setVisitAmountStr] = useState<string>('');
  const [visitPayMethod, setVisitPayMethod] = useState<'Pix' | 'Dinheiro' | 'Cartão'>('Pix');
  const [visitCardType, setVisitCardType] = useState<'Cartão de Débito' | 'Cartão de Crédito'>('Cartão de Débito');
  const [visitTechObs, setVisitTechObs] = useState<string>('');
  const [copiedVisitPix, setCopiedVisitPix] = useState<boolean>(false);
  const [selectedOrderForReceipt, setSelectedOrderForReceipt] = useState<WarrantyOrder | null>(null);
  const [selectedOrderForReturn, setSelectedOrderForReturn] = useState<WarrantyOrder | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [warningToast, setWarningToast] = useState<string | null>(null);
  const [audioEnabled, setAudioEnabled] = useState<boolean>(true);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | 'unsupported'>(() =>
    getNotificationPermissionStatus()
  );

  useEffect(() => {
    setLiveCompany(company);
  }, [company]);
  const [nowTick, setNowTick] = useState<number>(() => Date.now());
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioEnabledRef = useRef<boolean>(audioEnabled);
  audioEnabledRef.current = audioEnabled;

  const orderMelodyMapRef = useRef<Map<string, number>>(new Map());
  const melodyCounterRef = useRef<number>((() => {
    try {
      const saved = sessionStorage.getItem('neo_tech_melody_counter');
      return saved ? parseInt(saved, 10) || 0 : 0;
    } catch {
      return 0;
    }
  })());
  const notifiedKeysRef = useRef<Set<string>>((() => {
    try {
      const raw = sessionStorage.getItem(`neo_tech_notified_${user.id || 'default'}`);
      return raw ? new Set<string>(JSON.parse(raw)) : new Set<string>();
    } catch {
      return new Set<string>();
    }
  })());

  const ackStorageKey = `neofix_tech_ack_${user.id || 'default'}`;
  const [acknowledgedKeys, setAcknowledgedKeys] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(ackStorageKey);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const firstInteractionHandledRef = useRef<boolean>(false);

  const isFetchingRef = useRef<boolean>(false);
  const pendingRefetchRef = useRef<boolean>(false);
  const userRef = useRef(user);
  userRef.current = user;

  const [todayStr, setTodayStr] = useState<string>(() => getLocalDateString());

  const buildOrderAckKey = (order: WarrantyOrder): string =>
    `${order.id}::${order.technicianLeadTimeAlert || 'imediato'}::${order.scheduledDate || ''}::${order.scheduledTime || ''}`;

  const isOrderAlertAcknowledged = (order: WarrantyOrder): boolean => {
    if (order.technicianAlertAcknowledgedAt) return true;
    return acknowledgedKeys.includes(buildOrderAckKey(order));
  };

  const normalizeLocalScheduleDate = (dateString?: string): string => {
    if (!dateString) return '';
    const trimmed = dateString.trim();
    const brMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (brMatch) {
      const [, d, m, y] = brMatch;
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    const isoDateMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})(?:$|T00:00:00)/);
    if (isoDateMatch) {
      return isoDateMatch[1];
    }
    return extractDateOnly(trimmed);
  };

  const getScheduledVisitTimestamp = (order: WarrantyOrder): number | null => {
    const dateStr = normalizeLocalScheduleDate(order.scheduledDate);
    if (!dateStr) return null;
    const parts = dateStr.split('-').map(Number);
    if (parts.length !== 3 || parts.some(Number.isNaN)) return null;
    const [year, month, day] = parts;

    const rawTime = (order.scheduledTime || '').toLowerCase();
    let hours = 8;
    let minutes = 0;

    const hhmmMatch = rawTime.match(/(\d{1,2})\s*[:h]\s*(\d{2})/);
    if (hhmmMatch) {
      hours = Math.min(23, Math.max(0, parseInt(hhmmMatch[1], 10)));
      minutes = Math.min(59, Math.max(0, parseInt(hhmmMatch[2], 10)));
    } else {
      const hOnlyMatch = rawTime.match(/(\d{1,2})\s*h\b/);
      if (hOnlyMatch) {
        hours = Math.min(23, Math.max(0, parseInt(hOnlyMatch[1], 10)));
      } else if (rawTime.includes('tarde')) {
        hours = 13;
      } else if (rawTime.includes('noite')) {
        hours = 18;
      }
    }

    return new Date(year, month - 1, day, hours, minutes, 0, 0).getTime();
  };

  const shouldOrderAlertNow = (order: WarrantyOrder, referenceNowMs: number): boolean => {
    if (order.attendanceStatus !== 'Na fila / Aguardando') return false;

    const leadTime = order.technicianLeadTimeAlert || 'imediato';
    if (leadTime === 'sem_aviso') return false;
    if (leadTime === 'imediato') return true;

    const leadOffsetMap: Record<string, number> = {
      '15m': 15 * 60 * 1000,
      '30m': 30 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '2h': 120 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000,
    };

    const offsetMs = leadOffsetMap[leadTime];
    if (!offsetMs) return true;

    const visitTs = getScheduledVisitTimestamp(order);
    if (visitTs === null) return true;

    return referenceNowMs >= visitTs - offsetMs;
  };

  const getMelodyIndexForOrder = (orderId: string): number => {
    const existing = orderMelodyMapRef.current.get(orderId);
    if (existing !== undefined) return existing;

    const assigned = melodyCounterRef.current % TECH_ALERT_MELODIES.length;
    orderMelodyMapRef.current.set(orderId, assigned);
    melodyCounterRef.current += 1;
    try {
      sessionStorage.setItem('neo_tech_melody_counter', String(melodyCounterRef.current));
    } catch {}
    return assigned;
  };

  const triggerOrderNotificationAndSound = (orderData: WarrantyOrder, isFromRealtime = false) => {
    if (!shouldOrderAlertNow(orderData, Date.now())) return;

    const notifyKey = `${orderData.id}::${orderData.technicianLeadTimeAlert || 'imediato'}`;
    if (notifiedKeysRef.current.has(notifyKey)) return;

    notifiedKeysRef.current.add(notifyKey);
    try {
      sessionStorage.setItem(
        `neo_tech_notified_${userRef.current?.id || 'default'}`,
        JSON.stringify(Array.from(notifiedKeysRef.current).slice(-100))
      );
    } catch {}

    const melodyIdx = getMelodyIndexForOrder(orderData.id);
    const melodyName = TECH_ALERT_MELODIES[melodyIdx]?.name || 'Alerta';
    const applianceLabel = [orderData.applianceType, orderData.applianceBrand].filter(Boolean).join(' ') || 'Eletrodoméstico';
    const dateLabel = orderData.scheduledDate ? formatDate(orderData.scheduledDate) : 'Hoje';
    const timeLabel = orderData.scheduledTime || 'A combinar';

    const isLeadTimeReminder = Boolean(
      orderData.technicianLeadTimeAlert && orderData.technicianLeadTimeAlert !== 'imediato'
    );

    const title = isLeadTimeReminder
      ? `⏰ Visita Próxima (${orderData.technicianLeadTimeAlert}) - NEO FIX`
      : isFromRealtime
      ? '🚀 Novo Agendamento Recebido!'
      : '🔔 Nova OS Pendente - NEO FIX';

    const body = `Cliente: ${orderData.customerName || 'Cliente'}\nAparelho: ${applianceLabel}\nHorário: ${dateLabel} às ${timeLabel}`;

    sendBrowserNotification(title, body, `neofix-os-${orderData.id}`, { orderId: orderData.id });

    setSuccessToast(
      `${isLeadTimeReminder ? '⏰ Lembrete de Visita' : '🚀 Novo Agendamento'}: ${orderData.customerName || 'Cliente'} • ${applianceLabel} (${dateLabel} ${timeLabel}) [Toque: ${melodyName}]`
    );
    setTimeout(() => setSuccessToast(null), 10000);
  };

  const loadData = async (showLoader = false) => {
    if (isFetchingRef.current) {
      pendingRefetchRef.current = true;
      return;
    }
    isFetchingRef.current = true;
    try {
      if (showLoader) setIsLoading(true);

      const targetCompanyId = resolveCompanyId(userRef.current?.companyId);
      setActiveCompanyId(targetCompanyId);

      // Consulta leitura na tabela 'service_orders' filtrada por company_id e ordenada por data
      const { data: cloudOrders, error: compErr } = await sbSelectByCompany(
        'service_orders',
        targetCompanyId,
        { orderBy: 'scheduled_date', ascending: false, nullsFirst: false }
      );

      if (compErr) {
        console.error('[TechnicianDashboard Cloud SELECT Error]:', compErr);
        return;
      }

      if (cloudOrders) {
        const normalized = cloudOrders
          .filter((row: any) => !isCarneOrderRow(row) && !isCarneConfigRow(row))
          .map(normalizeOrder);
        // Substitui integralmente a lista local pela lista atual do SuperDB (remove imediatamente excluídas)
        setMemoryOrders(normalized);
        setOrders(normalized);
      }

      const { data: perfilRows } = await sbSelectByCompany('perfil_empresa', targetCompanyId, { limit: 1 });
      if (perfilRows && perfilRows.length > 0) {
        setLiveCompany(normalizeCompanyProfile(perfilRows[0]));
      } else {
        const fallbackComp = await sbGetCompany(targetCompanyId);
        if (fallbackComp) {
          setLiveCompany(fallbackComp);
        }
      }
    } catch (err) {
      console.error('Error loading technician orders from SuperDB:', err);
    } finally {
      isFetchingRef.current = false;
      if (showLoader) setIsLoading(false);
      if (pendingRefetchRef.current) {
        pendingRefetchRef.current = false;
        loadData(false);
      }
    }
  };

  useEffect(() => {
    ensureServiceWorkerRegistered();
    setNotifPermission(getNotificationPermissionStatus());

    const handleUserAudioUnlock = async () => {
      const ctx = unlockAudioContext(audioContextRef.current);
      if (ctx) audioContextRef.current = ctx;

      if (!firstInteractionHandledRef.current) {
        firstInteractionHandledRef.current = true;
        await ensureServiceWorkerRegistered();
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
          try {
            const perm = await Notification.requestPermission();
            setNotifPermission(perm);
          } catch {}
        }
      }
    };
    window.addEventListener('pointerdown', handleUserAudioUnlock, { passive: true });
    window.addEventListener('keydown', handleUserAudioUnlock, { passive: true });

    loadData(orders.length === 0);

    // Ativa recarregamento em tempo real (somente leitura) diretamente da tabela 'service_orders'
    const realtimeChannel = superdb
      .channel('realtime:technician_service_orders')
      .on(
        'postgres_changes',
        { event: '*', schema: superdbSchema, table: 'service_orders' },
        (payload) => {
          console.log('[SuperDB Realtime] service_orders update:', payload);

          if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as any)?.id;
            if (deletedId) {
              setOrders((prev) => {
                const filtered = prev.filter((o) => o.id !== deletedId && (o as any).dbId !== deletedId);
                setMemoryOrders(filtered);
                return filtered;
              });
            }
          }

          loadData(false);

          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const rowData = payload.new;
            if (rowData && !isCarneOrderRow(rowData) && !isCarneConfigRow(rowData)) {
              const orderData = normalizeOrder(rowData);
              if (orderData && isOrderForTechnician(orderData, userRef.current)) {
                setNowTick(Date.now());
                if (!isOrderAlertAcknowledged(orderData)) {
                  triggerOrderNotificationAndSound(orderData, true);
                }
              }
            }
          }
        }
      )
      .subscribe();

    const interval = setInterval(() => loadData(false), 20000);
    const tickInterval = setInterval(() => setNowTick(Date.now()), 10000);
    const dayCheckInterval = setInterval(() => {
      const currentDay = getLocalDateString();
      setTodayStr((prev) => (prev !== currentDay ? currentDay : prev));
    }, 60000);

    return () => {
      window.removeEventListener('pointerdown', handleUserAudioUnlock);
      window.removeEventListener('keydown', handleUserAudioUnlock);
      superdb.removeChannel(realtimeChannel);
      clearInterval(interval);
      clearInterval(tickInterval);
      clearInterval(dayCheckInterval);
      stopUrgentSiren();
    };
  }, []);

  // DERIVED STATE: Filter orders assigned to this technician (or unassigned)
  const techOrders = useMemo(() => {
    return orders.filter(o => isOrderForTechnician(o, user));
  }, [orders, user]);

  const activeInFieldOrder = useMemo(() => 
    techOrders.find(o => o.attendanceStatus === 'Em campo'),
  [techOrders]);

  const hasActiveVisit = !!activeInFieldOrder;

  const isOrderAlarming = (order: WarrantyOrder) => {
    return shouldOrderAlertNow(order, nowTick) && !isOrderAlertAcknowledged(order);
  };

  const alarmingOrders = useMemo(() => 
    techOrders.filter(o => shouldOrderAlertNow(o, nowTick) && !isOrderAlertAcknowledged(o)),
  [techOrders, nowTick, acknowledgedKeys]);

  const pendingAlertOrder = alarmingOrders[0] || null;

  const isReturnedStatus = (status?: string) => {
    const st = (status || '').toLowerCase().trim();
    return st === 'pendente confirmação' || st === 'pendente confirmacao' || st === 'retorno';
  };

  const isHojeOrder = (order: WarrantyOrder) => {
    const orderDate = normalizeLocalScheduleDate(order.scheduledDate) || extractDateOnly(order.createdAt);
    const st = (order.attendanceStatus || '').toLowerCase().trim();
    const isFinishedOrReturned =
      st === 'concluído' ||
      st === 'concluido' ||
      st === 'finalizado' ||
      st === 'retorno' ||
      st === 'pendente confirmação' ||
      st === 'pendente confirmacao' ||
      st === 'aguardando_atendente';

    return orderDate === todayStr && !isFinishedOrReturned;
  };

  const isFuturoOrder = (order: WarrantyOrder) => {
    const orderDate = normalizeLocalScheduleDate(order.scheduledDate);
    return (
      Boolean(orderDate) &&
      orderDate > todayStr &&
      order.attendanceStatus !== 'Concluído' &&
      !isReturnedStatus(order.attendanceStatus)
    );
  };

  const getCompletionLocalDate = (order: WarrantyOrder): string => {
    const rawCompleted = order.completedAt || (order as any).completed_at;
    if (rawCompleted) {
      const parsed = new Date(rawCompleted);
      if (!isNaN(parsed.getTime())) {
        return getLocalDateString(parsed);
      }
      return extractDateOnly(String(rawCompleted));
    }
    return normalizeLocalScheduleDate(order.scheduledDate) || extractDateOnly(order.createdAt);
  };

  const isCompletedToday = (order: WarrantyOrder): boolean => {
    if (order.attendanceStatus !== 'Concluído' && !isReturnedStatus(order.attendanceStatus)) {
      return false;
    }
    const completedDate = getCompletionLocalDate(order);
    return Boolean(completedDate) && completedDate === todayStr;
  };

  const parseScheduleTimeToMinutes = (rawTime?: string): number => {
    if (!rawTime || !rawTime.trim()) return 9999;
    const t = rawTime.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

    const hhmmMatch = t.match(/(\d{1,2})\s*[:h]\s*(\d{2})/);
    if (hhmmMatch) {
      const h = Math.min(23, Math.max(0, parseInt(hhmmMatch[1], 10)));
      const m = Math.min(59, Math.max(0, parseInt(hhmmMatch[2], 10)));
      return h * 60 + m;
    }

    const hOnlyMatch = t.match(/(\d{1,2})\s*h\b/);
    if (hOnlyMatch) {
      const h = Math.min(23, Math.max(0, parseInt(hOnlyMatch[1], 10)));
      return h * 60;
    }

    if (t.includes('manha')) return 8 * 60;
    if (t.includes('tarde')) return 13 * 60;
    if (t.includes('noite')) return 18 * 60;

    return 9999;
  };

  const filteredOrders = useMemo(() => {
    const filtered = techOrders.filter(order => {
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

      if (filter === 'hoje') {
        return isHojeOrder(order);
      }
      if (filter === 'futuros') {
        return isFuturoOrder(order);
      }
      if (filter === 'retornos') {
        return isWarrantyReturnOrder(order);
      }
      if (filter === 'concluidos') return isCompletedToday(order);
      if (filter === 'aguardando') return order.attendanceStatus === 'Na fila / Aguardando';
      if (filter === 'campo') return order.attendanceStatus === 'Em campo';
      if (filter === 'data') {
        const orderDate = normalizeLocalScheduleDate(order.scheduledDate) || extractDateOnly(order.createdAt);
        return orderDate === selectedCustomDate;
      }
      
      return true; // 'todos'
    });

    return [...filtered].sort((a, b) => {
      const dateA = normalizeLocalScheduleDate(a.scheduledDate) || extractDateOnly(a.createdAt) || '9999-12-31';
      const dateB = normalizeLocalScheduleDate(b.scheduledDate) || extractDateOnly(b.createdAt) || '9999-12-31';
      if (dateA !== dateB) {
        return dateA.localeCompare(dateB);
      }

      const minsA = parseScheduleTimeToMinutes(a.scheduledTime);
      const minsB = parseScheduleTimeToMinutes(b.scheduledTime);
      if (minsA !== minsB) {
        return minsA - minsB;
      }

      return String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
    });
  }, [techOrders, filter, searchQuery, todayStr, selectedCustomDate]);

  const completedTodayOrders = useMemo(
    () => techOrders.filter(isCompletedToday),
    [techOrders, todayStr]
  );

  useEffect(() => {
    if (completedTodayOrders.length === 0 && filter === 'concluidos') {
      setFilter('hoje');
    }
  }, [completedTodayOrders.length, filter]);

  const countStats = useMemo(() => {
    const hoje = techOrders.filter(isHojeOrder).length;
    const futuros = techOrders.filter(isFuturoOrder).length;
    const retornos = techOrders.filter((o) => isWarrantyReturnOrder(o)).length;
    const openRetornos = techOrders.filter(
      (o) => isWarrantyReturnOrder(o) && o.attendanceStatus !== 'Concluído'
    ).length;
    const concluidos = completedTodayOrders.length;
    const aguardando = techOrders.filter(o => o.attendanceStatus === 'Na fila / Aguardando').length;
    const campo = techOrders.filter(o => o.attendanceStatus === 'Em campo').length;
    const todos = techOrders.length;

    return { hoje, futuros, retornos, openRetornos, concluidos, aguardando, campo, todos };
  }, [techOrders, completedTodayOrders.length, todayStr]);

  const playAlarmTones = (orderId?: string) => {
    if (!audioEnabledRef.current) return;
    const targetId = orderId || alarmingOrders[0]?.id || 'default';
    const melodyIdx = getMelodyIndexForOrder(targetId);
    const res = playTechAlertMelody(melodyIdx, audioContextRef.current);
    if (res.ctx) audioContextRef.current = res.ctx;
  };

  const handleEnableNotifications = async () => {
    const ctx = unlockAudioContext(audioContextRef.current);
    if (ctx) audioContextRef.current = ctx;

    await ensureServiceWorkerRegistered();
    let result = await enablePwaNotifications();

    if (!result.granted && typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const directPerm = await Notification.requestPermission();
        result = {
          granted: directPerm === 'granted',
          permission: directPerm,
          swRegistered: result.swRegistered,
        };
      } catch {}
    }

    setNotifPermission(result.permission);

    if (result.granted) {
      await sendBrowserNotification(
        '🔔 Notificações Ativas no Celular!',
        'O painel do técnico está conectado ao PWA. Novos agendamentos tocarão e aparecerão na barra do celular.',
        'neofix-test-notif'
      );
      setSuccessToast('Notificações e áudio desbloqueados com sucesso!');
      setTimeout(() => setSuccessToast(null), 5000);
    } else if (result.permission === 'denied') {
      setWarningToast('Notificações bloqueadas no navegador. Clique no cadeado da barra de endereços e permita Notificações (áudio do painel desbloqueado).');
      setTimeout(() => setWarningToast(null), 6500);
    } else {
      setWarningToast('Este navegador não liberou notificações nativas (áudio do painel desbloqueado).');
      setTimeout(() => setWarningToast(null), 5000);
    }
  };

  const handleToggleAlarmAudio = async () => {
    const nextEnabled = !audioEnabled;
    setAudioEnabled(nextEnabled);

    if (nextEnabled) {
      const ctx = unlockAudioContext(audioContextRef.current);
      if (ctx) audioContextRef.current = ctx;
      await ensureServiceWorkerRegistered();

      const perm = getNotificationPermissionStatus();
      if (perm === 'default') {
        const result = await enablePwaNotifications();
        setNotifPermission(result.permission);
        if (result.granted) {
          await sendBrowserNotification(
            '🔔 Alarme & Notificações Ativos!',
            'Você receberá alertas sonoros contínuos a cada novo agendamento.',
            'neofix-alarm-on'
          );
        }
      }

      if (alarmingOrders.length > 0) {
        const nextCtx = playUrgentSirenPulse(audioContextRef.current);
        if (nextCtx) audioContextRef.current = nextCtx;
      }
    } else {
      stopUrgentSiren();
    }
  };

  useEffect(() => {
    if (alarmingOrders.length === 0) {
      stopUrgentSiren();
      return;
    }

    // Dispara notificação PWA/browser e toast para agendamentos pendentes de "Entendi"
    alarmingOrders.forEach((order) => {
      triggerOrderNotificationAndSound(order, false);
    });

    if (!audioEnabled) {
      stopUrgentSiren();
      return;
    }

    // Loop sonoro contínuo a cada 1.5 segundos + vibração até o técnico clicar em "Entendi"
    const initialCtx = playUrgentSirenPulse(audioContextRef.current);
    if (initialCtx) audioContextRef.current = initialCtx;

    const timer = setInterval(() => {
      const nextCtx = playUrgentSirenPulse(audioContextRef.current);
      if (nextCtx) audioContextRef.current = nextCtx;
    }, 1500);

    return () => {
      clearInterval(timer);
      stopUrgentSiren();
    };
  }, [alarmingOrders, audioEnabled]);

  const handleAcknowledgeAlert = (order: WarrantyOrder) => {
    // 1. Para o som contínuo imediatamente
    stopUrgentSiren();
    const ctx = unlockAudioContext(audioContextRef.current);
    if (ctx) audioContextRef.current = ctx;

    // 2. Marca como reconhecido ("entendido") no estado, localStorage e Supabase
    const ackKey = buildOrderAckKey(order);
    setAcknowledgedKeys((prev) => {
      const next = prev.includes(ackKey) ? prev : [...prev.slice(-100), ackKey];
      try {
        localStorage.setItem(ackStorageKey, JSON.stringify(next));
      } catch {}
      return next;
    });

    const ackTimestamp = new Date().toISOString();
    const updated = updateOrder(order.id, {
      technicianAlertAcknowledgedAt: ackTimestamp,
    });
    if (updated) {
      setOrders(getOrders());
    }

    // Garante que o card fique visível para o técnico agir ("Aceitar Visita" e "Ver Endereço")
    const orderDate = normalizeLocalScheduleDate(order.scheduledDate) || extractDateOnly(order.createdAt);
    if (orderDate === todayStr) {
      setFilter('hoje');
    } else if (orderDate > todayStr) {
      setFilter('futuros');
    } else {
      setFilter('aguardando');
    }

    setSuccessToast(`Alerta reconhecido! Clique em "Aceitar Visita" ou "Ver Endereço" no card de ${order.customerName}.`);
    setTimeout(() => setSuccessToast(null), 5000);
  };

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

    stopUrgentSiren();
    const nowIso = new Date().toISOString();
    const updated = updateOrder(id, {
      attendanceStatus: 'Em campo',
      technicianAcceptedAt: nowIso,
      technicianAlertAcknowledgedAt: order.technicianAlertAcknowledgedAt || nowIso,
    });

    if (updated) {
      setOrders(getOrders());
      setSuccessToast(`Visita #${id} iniciada com sucesso!`);
      setTimeout(() => setSuccessToast(null), 4000);
    }
  };

  const handleOpenVisitOnlyModal = (order: WarrantyOrder) => {
    setSelectedOrderForVisitOnly(order);
    const presetFee =
      order.visitFee && Number(order.visitFee) > 0
        ? String(Number(order.visitFee))
        : order.totalValue && Number(order.totalValue) > 0
        ? String(Number(order.totalValue))
        : '';
    setVisitAmountStr(presetFee);
    setVisitPayMethod(
      order.paymentMethod === 'Dinheiro'
        ? 'Dinheiro'
        : order.paymentMethod === 'Cartão de Crédito' || order.paymentMethod === 'Cartão de Débito'
        ? 'Cartão'
        : 'Pix'
    );
    setVisitCardType(order.paymentMethod === 'Cartão de Crédito' ? 'Cartão de Crédito' : 'Cartão de Débito');
    setVisitTechObs('');
    setCopiedVisitPix(false);
  };

  const handleConfirmVisitOnly = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrderForVisitOnly) return;

    const parsedAmount = Math.max(0, parseFloat(visitAmountStr.replace(',', '.')) || 0);
    const finalMethod: PaymentMethod =
      visitPayMethod === 'Pix'
        ? 'Pix'
        : visitPayMethod === 'Dinheiro'
        ? 'Dinheiro'
        : visitCardType;

    const nowIso = new Date().toISOString();
    const existingNotes = (selectedOrderForVisitOnly.notes || '').trim();
    const visitTag = `[Pagou Só a Visita: ${formatCurrency(parsedAmount)} - ${finalMethod}]${
      visitTechObs.trim() ? ` • Obs. Técnico: ${visitTechObs.trim()}` : ''
    }`;
    const combinedNotes = [existingNotes, visitTag].filter(Boolean).join(' | ');

    const updated = updateOrder(selectedOrderForVisitOnly.id, {
      attendanceStatus: 'retorno',
      completedAt: nowIso,
      status: 'Ativa',
      visitFee: parsedAmount,
      totalValue: parsedAmount,
      paymentMethod: finalMethod,
      paymentStatus: 'Pago',
      serviceDescription: `Pagou só a visita (${formatCurrency(parsedAmount)} via ${finalMethod})${
        visitTechObs.trim() ? ` • ${visitTechObs.trim()}` : ''
      }`,
      notes: combinedNotes,
      ...({ paidVisitOnly: true } as any),
    });

    if (updated) {
      setOrders(getOrders());
      setSelectedOrderForVisitOnly(null);
      setFilter('hoje');
      setSuccessToast(
        `Visita ${updated.id} devolvida para o Atendente Responsável (Retornos)!`
      );
      setTimeout(() => setSuccessToast(null), 5000);
    }
  };

  const handleCompleteService = async (id: string, updates: Partial<WarrantyOrder>) => {
    const order = orders.find(o => o.id === id);
    if (!order) return;

    const updated = updateOrder(id, {
      ...updates,
      attendanceStatus: 'retorno',
      completedAt: updates.completedAt || new Date().toISOString(),
    });

    if (updated) {
      setOrders(getOrders());
      setFilter('hoje');
      setSuccessToast(
        `OS ${id} devolvida para o Atendente Responsável (Retornos)!`
      );
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
      setFilter('hoje');
      setSuccessToast(`Agendamento #${id} transferido para a lista de Hoje!`);
      setTimeout(() => setSuccessToast(null), 4000);
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
      setOrders(getOrders());
      setSelectedOrderForReturn(null);
      setSuccessToast(
        `RETORNO DE GARANTIA #${updated.id} agendado para ${formatDate(payload.scheduledDate)} às ${payload.scheduledTime} (${payload.technicianName}).`
      );
      setTimeout(() => setSuccessToast(null), 5000);
      await loadData(false);
    }
  };

  const hasCompletedToday = completedTodayOrders.length > 0;

  const summaryCards = [
    { id: 'hoje', label: 'Hoje', count: countStats.hoje, icon: Calendar, color: 'text-cyan-400' },
    { id: 'futuros', label: 'Futuros', count: countStats.futuros, icon: CalendarClock, color: 'text-indigo-400' },
    ...(hasCompletedToday
      ? [{ id: 'concluidos', label: 'Concluídos Hoje', count: countStats.concluidos, icon: CheckCircle2, color: 'text-emerald-400' }]
      : []),
    { id: 'aguardando', label: 'Na Fila', count: countStats.aguardando, icon: Clock, color: 'text-amber-400' },
  ];

  const tabs = [
    ...summaryCards,
    { id: 'retornos', label: 'Retornos Garantia', count: countStats.retornos, icon: RotateCcw, color: 'text-rose-400' },
    { id: 'campo', label: 'Em Rota', count: countStats.campo, icon: MapIcon, color: 'text-purple-400' },
    { id: 'todos', label: 'Todos', count: countStats.todos, icon: LayoutDashboard, color: 'text-slate-400' },
  ];

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
              onClick={() => setIsReportModalOpen(true)}
              title="Abrir Relatório de Retornos de Garantia e Prioridades"
              className="p-2 rounded-lg border text-[10px] font-black uppercase transition-all flex items-center gap-1.5 bg-red-500/15 border-red-500/45 text-red-300 hover:bg-red-500/25 cursor-pointer relative"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Retornos</span>
              {countStats.openRetornos > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-red-600 text-white text-[9px] font-black">
                  {countStats.openRetornos}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={handleEnableNotifications}
              title="Ativar notificações reais no celular (PWA)"
              className={`p-2 rounded-lg border text-[10px] font-black uppercase transition-all flex items-center gap-1.5 ${
                notifPermission === 'granted'
                  ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/20'
                  : notifPermission === 'denied'
                  ? 'bg-rose-500/10 border-rose-500/40 text-rose-300 hover:bg-rose-500/20'
                  : 'bg-amber-500/15 border-amber-500/50 text-amber-300 hover:bg-amber-500/25 animate-pulse'
              }`}
            >
              <Bell className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                {notifPermission === 'granted'
                  ? 'Notif. On'
                  : notifPermission === 'denied'
                  ? 'Notif. Bloq.'
                  : 'Ativar Notif.'}
              </span>
            </button>

            <button
              type="button"
              onClick={handleToggleAlarmAudio}
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
        {hasActiveVisit && activeInFieldOrder && (
          <div className="p-3 sm:p-4 rounded-2xl bg-[#121418] border border-purple-500/40 shadow-lg flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400 shrink-0">
                <MapIcon className="w-4 h-4 animate-pulse" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[8px] font-black uppercase tracking-widest bg-purple-600 text-white px-1.5 py-0.5 rounded">Em Campo</span>
                  <span className="text-[10px] font-mono font-bold text-slate-400">{activeInFieldOrder.id}</span>
                </div>
                <h4 className="text-sm font-black text-white truncate">{activeInFieldOrder.customerName}</h4>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSelectedOrderForCompletion(activeInFieldOrder)}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10px] sm:text-xs uppercase tracking-wider active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>FINALIZAR O ATENDIMENTO</span>
              </button>

              <button
                type="button"
                onClick={() => handleOpenVisitOnlyModal(activeInFieldOrder)}
                className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-black text-[10px] sm:text-xs uppercase tracking-wider active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <CreditCard className="w-4 h-4 shrink-0" />
                <span>PAGAR SÓ A VISITA</span>
              </button>
            </div>
          </div>
        )}

        {/* Main Stats (Compact) */}
        <section className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {summaryCards.map((tab) => (
            <div 
              key={tab.id}
              onClick={() => { setFilter(tab.id as TechFilterType); setSelectedCustomDate(''); }}
              className={`p-2.5 sm:p-3 rounded-xl border cursor-pointer transition-all min-w-0 ${
                filter === tab.id ? 'bg-cyan-950/20 border-cyan-500/50' : 'bg-[#121418] border-white/5 hover:bg-white/5'
              }`}
            >
              <div className="flex items-center justify-between mb-0.5">
                <p className={`text-[9px] uppercase font-black truncate ${filter === tab.id ? 'text-cyan-400' : 'text-slate-500'}`}>{tab.label}</p>
                <tab.icon className={`w-3 h-3 shrink-0 ${filter === tab.id ? 'text-cyan-400' : 'text-slate-600'}`} />
              </div>
              <p className="text-xl sm:text-2xl font-black text-white font-num">{tab.count}</p>
            </div>
          ))}
        </section>

        {/* Filter Navigation (Compact) */}
        <section className="space-y-3">
          <div className="flex flex-wrap gap-1.5 w-full">
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
                  className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all border ${
                    isActive 
                      ? 'bg-cyan-600 text-white border-cyan-500 shadow-lg' 
                      : 'bg-[#121418] border-white/5 text-slate-500 hover:text-slate-300'
                  }`}
                >
                  <Icon className="w-3 h-3 shrink-0" />
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
          {isLoading && filteredOrders.length === 0 ? (
            <div className="text-center py-12 bg-white/[0.02] rounded-2xl border border-dashed border-white/5">
              <div className="h-8 w-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-slate-500 font-bold text-xs uppercase tracking-widest">Carregando...</p>
            </div>
          ) : filteredOrders.length === 0 ? (
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
                  onPayVisitOnly={handleOpenVisitOnlyModal}
                  onViewReceipt={setSelectedOrderForReceipt}
                  onMoveToToday={filter === 'futuros' || filter === 'data' ? handleMoveToToday : undefined}
                  onScheduleReturn={setSelectedOrderForReturn}
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

      {/* Blocking Continuous Alarm Modal: "Chegou um Agendamento" */}
      {pendingAlertOrder && (
        <div
          className="fixed inset-0 z-[120] bg-black/85 backdrop-blur-md flex items-center justify-center p-4"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="tech-urgent-alert-title"
        >
          <div className="w-full max-w-md rounded-3xl bg-slate-950 border-2 border-rose-500 shadow-[0_0_70px_rgba(244,63,94,0.5)] overflow-hidden animate-fadeIn">
            <div className="px-6 py-5 bg-gradient-to-r from-rose-600 via-rose-500 to-amber-500 text-white flex items-center gap-3.5">
              <div className="h-12 w-12 rounded-2xl bg-white/20 border border-white/30 flex items-center justify-center shrink-0 animate-bounce">
                <Bell className="w-7 h-7 text-white" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest bg-black/30 px-2 py-0.5 rounded-full">
                  Alarme Contínuo Ativo
                </span>
                <h2 id="tech-urgent-alert-title" className="text-xl font-black tracking-tight mt-0.5">
                  Chegou um Agendamento
                </h2>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Cliente
                  </span>
                  <p className="text-lg font-black text-white leading-tight">
                    {pendingAlertOrder.customerName}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Horário
                    </span>
                    <p className="text-xs font-bold text-slate-100 mt-0.5">
                      {pendingAlertOrder.scheduledDate
                        ? formatDateWithWeekday(pendingAlertOrder.scheduledDate)
                        : 'Hoje'}{' '}
                      • {pendingAlertOrder.scheduledTime || 'Comercial'}
                    </p>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1">
                      <Wrench className="w-3 h-3" /> Aparelho
                    </span>
                    <p className="text-xs font-bold text-slate-100 mt-0.5">
                      {[
                        pendingAlertOrder.applianceType,
                        pendingAlertOrder.applianceBrand,
                        pendingAlertOrder.applianceModel,
                      ]
                        .filter(Boolean)
                        .join(' • ') || 'Eletrodoméstico'}
                    </p>
                  </div>
                </div>

                {(pendingAlertOrder.street || pendingAlertOrder.defectDescription) && (
                  <div className="pt-2 border-t border-slate-800 space-y-1 text-xs text-slate-300">
                    {pendingAlertOrder.street && (
                      <p className="truncate">
                        <strong className="text-slate-400">Local:</strong> {pendingAlertOrder.street}, {pendingAlertOrder.number} - {pendingAlertOrder.neighborhood}
                      </p>
                    )}
                    {pendingAlertOrder.defectDescription && (
                      <p className="italic text-slate-400 line-clamp-2">
                        "{pendingAlertOrder.defectDescription}"
                      </p>
                    )}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => handleAcknowledgeAlert(pendingAlertOrder)}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-black text-base uppercase tracking-wider shadow-[0_0_30px_rgba(16,185,129,0.5)] active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <CheckCircle2 className="w-6 h-6 stroke-[2.5]" />
                <span>Entendi</span>
              </button>

              <p className="text-[11px] text-center text-slate-400">
                O som continuará tocando até você clicar em <strong className="text-emerald-400">"Entendi"</strong>.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {selectedOrderForVisitOnly && (() => {
        const parsedVisitAmount = Math.max(0, parseFloat(visitAmountStr.replace(',', '.')) || 0);
        const trimmedPixKey = (liveCompany.pixKey || '').trim();
        const visitPixPayload =
          visitPayMethod === 'Pix' && parsedVisitAmount > 0 && trimmedPixKey
            ? generatePixPayload({
                pixKey: trimmedPixKey,
                merchantName: liveCompany.name || 'NEO FIX',
                merchantCity: liveCompany.pixCity || liveCompany.city || 'Brasil',
                amount: parsedVisitAmount,
                txId: selectedOrderForVisitOnly.id,
              })
            : '';
        const visitPixQr = visitPixPayload ? buildPixQrSvgData(visitPixPayload) : null;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm animate-fadeIn">
            <div className="w-full max-w-md bg-slate-900 border border-amber-500/40 rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(245,158,11,0.2)] animate-scaleIn">
              <div className="p-4 sm:p-5 border-b border-slate-800 bg-amber-500/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-black text-white uppercase tracking-tight">
                      Pagar Só a Visita
                    </h2>
                    <p className="text-xs text-amber-300 font-mono font-semibold">
                      {selectedOrderForVisitOnly.id} • {selectedOrderForVisitOnly.customerName}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedOrderForVisitOnly(null)}
                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleConfirmVisitOnly} className="p-4 sm:p-5 space-y-4 max-h-[82vh] overflow-y-auto custom-scrollbar">
                {/* Observações / Taxa cadastradas pela atendente */}
                <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-amber-400" />
                      Dados do Agendamento (Atendente)
                    </span>
                    <span className="text-amber-300 font-mono">
                      Taxa prevista: {formatCurrency(Number(selectedOrderForVisitOnly.visitFee || 0))}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {selectedOrderForVisitOnly.notes ||
                      selectedOrderForVisitOnly.defectDescription ||
                      'Sem observações adicionais da atendente.'}
                  </p>
                </div>

                {/* Valor da Visita */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-amber-400" />
                    Valor da Taxa de Visita (R$) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    placeholder="0,00"
                    value={visitAmountStr}
                    onChange={(e) => setVisitAmountStr(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl bg-slate-950 border border-slate-800 text-amber-300 text-lg font-black font-mono focus:border-amber-500 focus:outline-none transition-all"
                  />
                </div>

                {/* Observação opcional do técnico */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Observação do Técnico (Opcional)
                  </label>
                  <input
                    type="text"
                    value={visitTechObs}
                    onChange={(e) => setVisitTechObs(e.target.value)}
                    placeholder="Ex: Cliente optou por não aprovar o orçamento"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:border-amber-500 focus:outline-none transition-all"
                  />
                </div>

                {/* Forma de Pagamento */}
                <div className="space-y-3 p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-amber-400" />
                    Forma de Recebimento *
                  </label>

                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setVisitPayMethod('Pix')}
                      className={`py-2.5 px-2 rounded-xl border text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        visitPayMethod === 'Pix'
                          ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <QrCode className="w-4 h-4" />
                      <span>Pix</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setVisitPayMethod('Dinheiro')}
                      className={`py-2.5 px-2 rounded-xl border text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        visitPayMethod === 'Dinheiro'
                          ? 'bg-amber-500/20 border-amber-400 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.2)]'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <Banknote className="w-4 h-4" />
                      <span>Dinheiro</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setVisitPayMethod('Cartão')}
                      className={`py-2.5 px-2 rounded-xl border text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        visitPayMethod === 'Cartão'
                          ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.2)]'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <CreditCard className="w-4 h-4" />
                      <span>Cartão</span>
                    </button>
                  </div>

                  {visitPayMethod === 'Cartão' && (
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      {(['Cartão de Débito', 'Cartão de Crédito'] as const).map((ct) => (
                        <button
                          key={ct}
                          type="button"
                          onClick={() => setVisitCardType(ct)}
                          className={`py-2 rounded-xl border text-[11px] font-bold transition-all cursor-pointer ${
                            visitCardType === ct
                              ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                              : 'bg-slate-900 border-slate-800 text-slate-400'
                          }`}
                        >
                          {ct}
                        </button>
                      ))}
                    </div>
                  )}

                  {visitPayMethod === 'Pix' && (
                    <div className="pt-1 animate-fadeIn">
                      {!trimmedPixKey ? (
                        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/40 text-amber-300 text-xs flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                          <span>Chave Pix não cadastrada nos Dados da Empresa.</span>
                        </div>
                      ) : parsedVisitAmount <= 0 ? (
                        <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 text-xs text-center">
                          Informe o <strong className="text-amber-300">Valor da Visita</strong> acima para gerar o QR Code Pix.
                        </div>
                      ) : (
                        visitPixQr && (
                          <div className="p-3.5 rounded-2xl bg-white text-slate-900 border-2 border-emerald-500 flex flex-col items-center text-center space-y-2.5">
                            <div className="flex items-center gap-1.5 text-emerald-800 font-black text-xs uppercase">
                              <QrCode className="w-4 h-4 text-emerald-600" />
                              <span>Pix da Visita • {formatCurrency(parsedVisitAmount)}</span>
                            </div>

                            <div className="p-2 bg-white rounded-xl border border-slate-200">
                              <svg
                                viewBox={`-1 -1 ${visitPixQr.size + 2} ${visitPixQr.size + 2}`}
                                className="w-44 h-44"
                                shapeRendering="crispEdges"
                              >
                                <path d={visitPixQr.pathD} fill="#0f172a" />
                              </svg>
                            </div>

                            <p className="text-xs text-slate-700">
                              Chave Pix: <strong className="font-mono text-slate-950 break-all">{trimmedPixKey}</strong>
                            </p>

                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  await navigator.clipboard.writeText(visitPixPayload);
                                  setCopiedVisitPix(true);
                                  setTimeout(() => setCopiedVisitPix(false), 2500);
                                } catch {}
                              }}
                              className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wide flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                            >
                              {copiedVisitPix ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                              <span>{copiedVisitPix ? 'Código Pix Copiado!' : 'Copiar Código Pix (Copia e Cola)'}</span>
                            </button>
                          </div>
                        )
                      )}
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-600 to-orange-500 hover:from-amber-500 hover:to-orange-400 text-white font-black uppercase tracking-wider text-xs sm:text-sm shadow-[0_0_25px_rgba(245,158,11,0.3)] active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  <span>Confirmar Recebimento da Visita</span>
                </button>
              </form>
            </div>
          </div>
        );
      })()}

      {selectedOrderForCompletion && (
        <TechnicianCompletionModal
          isOpen={Boolean(selectedOrderForCompletion)}
          onClose={() => setSelectedOrderForCompletion(null)}
          order={selectedOrderForCompletion}
          company={liveCompany}
          onSave={handleCompleteService}
        />
      )}

      {selectedOrderForReceipt && (
        <ReceiptModal
          order={selectedOrderForReceipt}
          company={liveCompany}
          isOpen={Boolean(selectedOrderForReceipt)}
          onClose={() => setSelectedOrderForReceipt(null)}
        />
      )}

      <ReturnScheduleModal
        isOpen={Boolean(selectedOrderForReturn)}
        onClose={() => setSelectedOrderForReturn(null)}
        order={selectedOrderForReturn}
        onConfirm={handleScheduleReturn}
      />

      <FinancialReportScreen
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        orders={orders}
        expenses={[]}
        company={liveCompany}
        initialSection="retornos"
        isTechnicianView={true}
        onOpenReceipt={(order) => setSelectedOrderForReceipt(order)}
        onOrderUpdated={(updatedOrder) => {
          updateOrder(updatedOrder.id, updatedOrder);
          setOrders(getOrders());
        }}
      />
    </div>
  );
}
