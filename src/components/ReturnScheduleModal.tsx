import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  RotateCcw,
  Calendar,
  Clock,
  Wrench,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  FileText,
} from 'lucide-react';
import { StaffMember, WarrantyOrder } from '../types';
import { resolveCompanyId, sbSelectByCompany } from '../utils/supabaseService';
import { getCurrentUser, getStaff } from '../utils/storage';
import { getLocalDateString } from '../utils/formatters';

interface ReturnScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: WarrantyOrder | null;
  staffList?: StaffMember[];
  onConfirm: (payload: {
    orderId: string;
    scheduledDate: string;
    scheduledTime: string;
    technicianName: string;
    technicianId?: string;
    priority: 'Urgente' | 'Alta' | 'Normal';
    returnReason: string;
  }) => Promise<void> | void;
}

export const ReturnScheduleModal: React.FC<ReturnScheduleModalProps> = ({
  isOpen,
  onClose,
  order,
  staffList = [],
  onConfirm,
}) => {
  const todayStr = getLocalDateString();
  const tomorrowStr = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return getLocalDateString(d);
  })();

  const [scheduledDate, setScheduledDate] = useState<string>(todayStr);
  const [scheduledTime, setScheduledTime] = useState<string>('09:00');
  const [technicianName, setTechnicianName] = useState<string>('');
  const [technicianId, setTechnicianId] = useState<string>('');
  const [priority, setPriority] = useState<'Urgente' | 'Alta' | 'Normal'>('Alta');
  const [returnReason, setReturnReason] = useState<string>('');
  const [profilesList, setProfilesList] = useState<StaffMember[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !order) return;
    setScheduledDate(todayStr);
    setScheduledTime(order.scheduledTime && /^\d{2}:\d{2}$/.test(order.scheduledTime) ? order.scheduledTime : '09:00');
    setTechnicianName(order.technicianName || '');
    setTechnicianId(order.technicianId || '');
    setPriority(
      order.priority === 'Urgente' || order.priority === 'Normal' ? order.priority : 'Alta'
    );
    setReturnReason(order.returnReason || '');
    setFormError(null);
    setIsSaving(false);

    let cancelled = false;
    async function loadProfiles() {
      try {
        const targetCompanyId = resolveCompanyId(getCurrentUser()?.companyId);
        const { data, error } = await sbSelectByCompany('profiles', targetCompanyId);
        if (!cancelled && !error && Array.isArray(data) && data.length > 0) {
          const mapped: StaffMember[] = data.map((row: any) => ({
            id: String(row.id),
            companyId: row.company_id || row.companyId || 'icerefrigeracaopreventiva@gmail.com',
            name: row.name || row.full_name || (row.email ? row.email.split('@')[0] : 'Técnico'),
            role: row.role || 'tecnico',
            phone: row.phone || '',
            email: row.email || '',
            active: row.active !== false,
          }));
          setProfilesList(mapped);
        }
      } catch {}
    }
    loadProfiles();
    return () => {
      cancelled = true;
    };
  }, [isOpen, order, todayStr]);

  const techOptions = useMemo(() => {
    const map = new Map<string, StaffMember>();
    const localStaff = staffList.length > 0 ? staffList : getStaff();
    [...localStaff, ...profilesList].forEach((s) => {
      if (s && s.id && s.active !== false) {
        map.set(s.id, s);
      }
    });

    const all = Array.from(map.values());
    const filtered = all.filter((s) => {
      const r = (s.role || '').toLowerCase().trim();
      const n = (s.name || '').toLowerCase().trim();
      const e = (s.email || '').toLowerCase().trim();
      return (
        r === 'tecnico' ||
        r === 'técnico' ||
        r === 'funcionario de campo' ||
        n.includes('wilian') ||
        e.includes('wilian')
      );
    });

    return filtered.length > 0 ? filtered : all;
  }, [staffList, profilesList]);

  useEffect(() => {
    if (!isOpen || techOptions.length === 0) return;
    if (!technicianName) {
      setTechnicianName(techOptions[0].name);
      setTechnicianId(techOptions[0].id);
    } else if (!technicianId) {
      const match = techOptions.find(
        (t) => t.name.toLowerCase().trim() === technicianName.toLowerCase().trim()
      );
      if (match) setTechnicianId(match.id);
    }
  }, [isOpen, techOptions, technicianName, technicianId]);

  if (!isOpen || !order) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduledDate) {
      setFormError('Informe a data do retorno.');
      return;
    }
    if (!technicianName.trim()) {
      setFormError('Selecione o técnico responsável pelo retorno.');
      return;
    }
    setFormError(null);
    setIsSaving(true);
    try {
      await onConfirm({
        orderId: order.id,
        scheduledDate,
        scheduledTime: scheduledTime || '09:00',
        technicianName: technicianName.trim(),
        technicianId: technicianId || undefined,
        priority,
        returnReason: returnReason.trim(),
      });
      onClose();
    } catch (err: any) {
      setFormError(err?.message || 'Erro ao agendar retorno de garantia.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-[#10141d] border border-red-500/45 rounded-3xl overflow-hidden shadow-[0_0_60px_rgba(220,38,38,0.28)] my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-red-950/70 via-rose-950/50 to-slate-900 border-b border-red-500/30 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-2xl bg-red-600/25 border border-red-500/50 flex items-center justify-center text-red-400 shrink-0">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-black text-white uppercase tracking-tight">
                  Agendar Retorno de Garantia
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-red-600 text-white text-[9px] font-black uppercase tracking-wider">
                  R$ 0,00
                </span>
              </div>
              <p className="text-xs text-red-300 font-mono truncate">
                {order.id} • {order.customerName}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Resumo da OS */}
          <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-bold text-white truncate">
                {order.applianceType} {order.applianceBrand ? `• ${order.applianceBrand}` : ''}
              </span>
              <span className="text-[10px] font-mono text-cyan-400 shrink-0">{order.customerPhone}</span>
            </div>
            {(order.street || order.neighborhood) && (
              <p className="text-[11px] text-slate-400 truncate">
                {[order.street, order.number, order.neighborhood, order.city].filter(Boolean).join(', ')}
              </p>
            )}
          </div>

          {/* Destaque informativo */}
          <div className="p-3 rounded-2xl bg-red-500/10 border border-red-500/35 flex items-start gap-2.5 text-xs text-red-200">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed text-[11px]">
              Ao salvar, a OS receberá a etiqueta vermelha{' '}
              <strong className="bg-red-600 text-white px-1.5 py-0.5 rounded text-[10px] uppercase">
                RETORNO DE GARANTIA
              </strong>
              , será listada na aba <strong className="text-white">RETORNOS</strong> do relatório e terá valor{' '}
              <strong className="text-emerald-300">R$ 0,00</strong> no faturamento líquido.
            </div>
          </div>

          {/* Data e Hora */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-red-400" />
                  Nova Data *
                </label>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setScheduledDate(todayStr)}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                      scheduledDate === todayStr
                        ? 'bg-red-600 text-white'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    Hoje
                  </button>
                  <button
                    type="button"
                    onClick={() => setScheduledDate(tomorrowStr)}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                      scheduledDate === tomorrowStr
                        ? 'bg-red-600 text-white'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    Amanhã
                  </button>
                </div>
              </div>
              <input
                type="date"
                required
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-bold focus:border-red-500 focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-red-400" />
                  Horário *
                </label>
                <div className="flex items-center gap-1">
                  {['09:00', '14:00'].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setScheduledTime(t)}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                        scheduledTime === t
                          ? 'bg-red-600 text-white'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <input
                type="time"
                required
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-bold focus:border-red-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Técnico Responsável */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Wrench className="w-3.5 h-3.5 text-cyan-400" />
              Técnico Responsável *
            </label>
            <select
              required
              value={technicianName}
              onChange={(e) => {
                const chosenName = e.target.value;
                setTechnicianName(chosenName);
                const found = techOptions.find((t) => t.name === chosenName);
                setTechnicianId(found?.id || '');
              }}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-bold focus:border-red-500 focus:outline-none cursor-pointer"
            >
              <option value="" disabled>
                Selecione o técnico...
              </option>
              {technicianName && !techOptions.some((t) => t.name === technicianName) && (
                <option value={technicianName}>{technicianName}</option>
              )}
              {techOptions.map((tech) => (
                <option key={tech.id} value={tech.name}>
                  {tech.name} ({tech.role})
                </option>
              ))}
            </select>
          </div>

          {/* Prioridade */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Nível de Prioridade
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['Urgente', 'Alta', 'Normal'] as const).map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setPriority(lvl)}
                  className={`py-2 rounded-xl border text-xs font-black uppercase transition-all cursor-pointer ${
                    priority === lvl
                      ? lvl === 'Urgente'
                        ? 'bg-red-600 text-white border-red-400 shadow-[0_0_15px_rgba(220,38,38,0.4)]'
                        : lvl === 'Alta'
                          ? 'bg-amber-500 text-slate-950 border-amber-400'
                          : 'bg-cyan-500 text-slate-950 border-cyan-400'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>

          {/* Motivo do retorno */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              Motivo / Observação do Retorno
            </label>
            <textarea
              rows={2}
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
              placeholder="Ex: Cliente informou que o aparelho voltou a apresentar o mesmo defeito..."
              className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:border-red-500 focus:outline-none resize-none"
            />
          </div>

          {formError && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs font-bold">
              {formError}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-xs font-black uppercase tracking-wide shadow-[0_0_20px_rgba(220,38,38,0.4)] flex items-center gap-2 transition-all active:scale-95 disabled:opacity-60 cursor-pointer"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              <span>Confirmar Retorno de Garantia</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
