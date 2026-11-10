import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  LogOut, 
  Truck, 
  Clock, 
  Bell, 
  BellOff, 
  History, 
  Calendar,
  ShieldCheck,
  AlertCircle,
  LayoutGrid,
  List as ListIcon
} from 'lucide-react';
import { CompanySettings, DeliveryTask, User } from '../types';
import { sbGetDeliveries, sbSaveDelivery } from '../utils/supabaseService';
import { getDeliveries, updateDelivery } from '../utils/storage';
import { initRealtimeSync, addSyncListener, fetchServerState } from '../utils/cloudSync';
import { getLocalDateString, extractDateOnly } from '../utils/formatters';
import { DriverTaskCard } from './DriverTaskCard';
import { PWAInstallButton } from './PWAInstallButton';

interface DriverDashboardProps {
  user: User;
  company: CompanySettings;
  onLogout: () => void;
}

export const DriverDashboard: React.FC<DriverDashboardProps> = ({ user, company, onLogout }) => {
  const [deliveries, setDeliveries] = useState<DeliveryTask[]>(getDeliveries());
  const [isLoading, setIsLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);

  const todayStr = getLocalDateString();

  const loadData = async () => {
    try {
      const local = getDeliveries();
      if (local && local.length > 0) {
        setDeliveries(local);
      }
      await fetchServerState();
      setDeliveries(getDeliveries());

      const data = await sbGetDeliveries(user.companyId);
      if (data && data.length > 0) {
        setDeliveries(data);
      }
    } catch (err) {
      console.error('Error loading driver deliveries:', err);
      setDeliveries(getDeliveries());
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    initRealtimeSync();
    loadData();

    const unsub = addSyncListener((payload) => {
      if (payload.table === 'deliveries' || payload.action === 'REPLACE_ALL') {
        setDeliveries([...getDeliveries()]);
      }
    });

    const interval = setInterval(loadData, 20000);
    return () => {
      unsub();
      clearInterval(interval);
    };
  }, [user.companyId]);

  // DERIVED STATE
  const todayTasks = useMemo(() => 
    deliveries.filter(d => extractDateOnly(d.scheduledDate) === todayStr && d.status !== 'Concluído' && d.status !== 'Cancelado'),
  [deliveries, todayStr]);

  const historyTasks = useMemo(() => 
    deliveries.filter(d => d.status === 'Concluído' || d.status === 'Cancelado' || extractDateOnly(d.scheduledDate) < todayStr),
  [deliveries, todayStr]);

  const pendingTasks = useMemo(() => 
    deliveries.filter(d => d.status === 'Pendente' && extractDateOnly(d.scheduledDate) === todayStr),
  [deliveries, todayStr]);

  const handleUpdateStatus = async (id: string, status: DeliveryTask['status']) => {
    const updated = updateDelivery(id, { status });
    if (updated) {
      setDeliveries(getDeliveries());
      sbSaveDelivery(updated, user.companyId).catch(() => {});
    }
  };

  const playAlertSound = () => {
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
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } catch (e) {}
  };

  useEffect(() => {
    if (pendingTasks.length > 0 && audioEnabled) {
      const timer = setInterval(playAlertSound, 5000);
      return () => clearInterval(timer);
    }
  }, [pendingTasks.length, audioEnabled]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0f1115] flex items-center justify-center">
        <div className="h-12 w-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f1115] text-slate-100 font-sans pb-12">
      {/* Background blurs */}
      <div className="fixed top-0 left-1/4 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-0 right-1/4 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Mobile Header (Compact) */}
      <header className="sticky top-0 z-50 bg-[#121418]/90 backdrop-blur-xl border-b border-white/5 px-4 py-3">
        <div className="flex items-center justify-between gap-4 max-w-2xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="relative h-10 w-10 rounded-xl bg-[#0f1115] border border-white/10 flex items-center justify-center overflow-hidden">
              {company.logoUrl ? (
                <img src={company.logoUrl} alt="Logo" className="h-full w-full object-contain p-1" />
              ) : (
                <ShieldCheck className="w-5 h-5 text-cyan-400/70" />
              )}
            </div>
            <div>
              <h1 className="text-xs font-black uppercase tracking-wider text-white leading-none">
                Painel do Ormamentista
              </h1>
              <p className="text-[9px] text-cyan-400 font-bold uppercase mt-1">
                {user.name}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <PWAInstallButton variant="header" />

            <button
              onClick={() => setAudioEnabled(!audioEnabled)}
              className={`p-2 rounded-xl border transition-all ${
                audioEnabled 
                  ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400' 
                  : 'bg-white/5 border-white/5 text-slate-500'
              }`}
            >
              {audioEnabled ? <Bell className="w-4 h-4 animate-ring" /> : <BellOff className="w-4 h-4" />}
            </button>
            <button
              onClick={onLogout}
              className="p-2 rounded-xl bg-white/5 border border-white/5 text-rose-400"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="p-4 max-w-2xl mx-auto space-y-4">
        {/* Audio Alert Reminder (Compact) */}
        {!audioEnabled && pendingTasks.length > 0 && (
          <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 animate-pulse">
            <div className="flex items-center gap-2 text-amber-400">
              <AlertCircle className="w-4 h-4" />
              <p className="text-[10px] font-black uppercase tracking-wider">
                Ative o som para alertas
              </p>
            </div>
          </div>
        )}

        {/* Task Stats (Compact Grid) */}
        <div className="grid grid-cols-2 gap-3 mb-6 px-1">
          <div className="p-3 rounded-2xl bg-[#121418] border border-cyan-500/20 shadow-lg shadow-cyan-500/5">
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="w-3 h-3 text-cyan-400" />
              <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">Tarefas Hoje</span>
            </div>
            <div className="text-xl font-black text-white">{todayTasks.length}</div>
          </div>
          <div className="p-3 rounded-2xl bg-[#121418] border border-white/5 shadow-lg">
            <div className="flex items-center gap-2 mb-1">
              <History className="w-3 h-3 text-slate-500" />
              <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">Histórico</span>
            </div>
            <div className="text-xl font-black text-slate-300">{historyTasks.length}</div>
          </div>
        </div>

        {/* Header Title (Compact) */}
        <div className="flex items-center justify-between px-1 mb-2">
          <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-500 flex items-center gap-2">
            <ListIcon className="w-3.5 h-3.5" />
            {showHistory ? 'Histórico Geral' : 'Lista de Entregas'}
          </h2>
          <button 
            onClick={() => setShowHistory(!showHistory)}
            className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all flex items-center gap-1.5 border ${
              showHistory 
                ? 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400' 
                : 'bg-white/5 border-white/5 text-slate-500 hover:text-white'
            }`}
          >
            {showHistory ? <Calendar className="w-3 h-3" /> : <History className="w-3 h-3" />}
            {showHistory ? 'Voltar Hoje' : 'Ver Histórico'}
          </button>
        </div>

        {/* Task List (Compact) */}
        <div className="space-y-3">
          {!showHistory ? (
            todayTasks.length === 0 ? (
              <div className="py-12 text-center bg-white/[0.02] rounded-2xl border border-dashed border-white/5">
                <p className="text-slate-600 font-bold text-[10px] uppercase tracking-widest">Sem tarefas pendentes</p>
              </div>
            ) : (
              todayTasks.map(task => (
                <DriverTaskCard 
                  key={task.id} 
                  task={task} 
                  onUpdateStatus={handleUpdateStatus} 
                />
              ))
            )
          ) : (
            historyTasks.length === 0 ? (
              <div className="py-12 text-center text-slate-700">
                <p className="text-[10px] font-black uppercase tracking-widest">Histórico Vazio</p>
              </div>
            ) : (
              historyTasks.map(task => (
                <DriverTaskCard 
                  key={task.id} 
                  task={task} 
                  onUpdateStatus={handleUpdateStatus} 
                />
              ))
            )
          )}
        </div>
      </main>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes ring {
          0%, 100% { transform: rotate(0); }
          25% { transform: rotate(15deg); }
          75% { transform: rotate(-15deg); }
        }
        .animate-ring {
          animation: ring 0.5s infinite;
        }
      `}} />
    </div>
  );
};
