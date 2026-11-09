import React from 'react';
import { 
  Truck, 
  Package, 
  MapPin, 
  Phone, 
  Clock, 
  User, 
  ExternalLink, 
  MessageSquare, 
  CheckCircle2, 
  Navigation,
  Box,
  Calendar,
  Volume2
} from 'lucide-react';
import { DeliveryTask } from '../types';
import { formatDate } from '../utils/formatters';

interface DriverTaskCardProps {
  task: DeliveryTask;
  onUpdateStatus: (id: string, status: DeliveryTask['status']) => void;
}

export const DriverTaskCard: React.FC<DriverTaskCardProps> = ({ task, onUpdateStatus }) => {
  const isDelivery = task.type === 'Entrega';
  
  const handleOpenMaps = (e: React.MouseEvent) => {
    e.stopPropagation();
    const address = encodeURIComponent(`${task.street}, ${task.number}, ${task.neighborhood}, ${task.city}, ${task.state} - CEP ${task.cep}`);
    window.open(`https://www.google.com/maps/search/?api=1&query=${address}`, '_blank');
  };

  const handleWhatsApp = (e: React.MouseEvent) => {
    e.stopPropagation();
    const cleanPhone = task.customerPhone.replace(/\D/g, '');
    const phone = cleanPhone.length >= 10 ? `55${cleanPhone}` : '';
    window.open(`https://wa.me/${phone}`, '_blank');
  };

  const statusColors = {
    Pendente: isDelivery ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' : 'bg-amber-500/10 border-amber-500/30 text-amber-400',
    'Em Rota': 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400',
    Concluído: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
    Cancelado: 'bg-rose-500/10 border-rose-500/30 text-rose-400'
  };

  return (
    <div className={`relative overflow-hidden rounded-[2.5rem] border-2 transition-all shadow-2xl ${
      isDelivery 
        ? 'bg-[#121418] border-blue-500/20' 
        : 'bg-[#121418] border-amber-500/20'
    }`}>
      {/* Type Badge (Right Top) */}
      <div className={`absolute top-0 right-0 px-8 py-3 rounded-bl-[2rem] text-[11px] font-black uppercase tracking-[0.15em] shadow-lg z-10 ${
        isDelivery ? 'bg-blue-600 text-white' : 'bg-amber-500 text-slate-950'
      }`}>
        {task.type}
      </div>

      <div className="p-6 space-y-5">
        {/* Header Badges */}
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <div className={`text-[10px] font-mono font-black px-3 py-1 rounded-xl border ${statusColors.Pendente}`}>
            {task.id}
          </div>
          
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-black">
            <Calendar className="w-3.5 h-3.5" />
            {task.scheduledDate}
          </div>

          <div className="px-3 py-1 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 text-[10px] font-black uppercase tracking-wider">
            {task.description?.split(' ')[0] || 'Item'}
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400 text-[10px] font-black uppercase">
            <Volume2 className="w-3.5 h-3.5" />
            Aviso: 30 min antes
          </div>
        </div>

        {/* Customer Name */}
        <h3 className="text-2xl font-black text-white tracking-tight px-1">{task.customerName}</h3>

        {/* Address Card */}
        <button 
          onClick={handleOpenMaps}
          className="w-full text-left p-5 rounded-[2rem] bg-slate-950/50 border border-slate-800 hover:border-cyan-500/40 transition-all group"
        >
          <div className="flex items-start gap-4">
            <div className={`mt-1 p-3 rounded-2xl border ${statusColors.Pendente}`}>
              <MapPin className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-lg text-slate-100 font-bold leading-tight">
                {task.street}, {task.number}
              </p>
              <p className="text-xs text-slate-500 mt-1 uppercase font-medium">
                {task.neighborhood}, {task.city} - {task.state}
              </p>
              <div className="flex items-center gap-2 mt-3 text-[11px] text-cyan-400 font-black uppercase tracking-widest group-hover:text-cyan-300">
                <Navigation className="w-4 h-4" />
                ABRIR NO GOOGLE MAPS
              </div>
            </div>
          </div>
        </button>

        {/* Phone & Time Grid */}
        <div className="grid grid-cols-2 gap-4">
          <button 
            onClick={handleWhatsApp}
            className="p-4 rounded-[2rem] bg-slate-950/50 border border-slate-800 hover:border-emerald-500/40 transition-all text-left group"
          >
            <div className="text-[10px] font-black uppercase text-slate-500 mb-2 tracking-widest">WhatsApp / Celular</div>
            <div className="flex items-center gap-2 text-sm font-black text-slate-200 group-hover:text-emerald-400 transition-colors">
              <Phone className="w-4 h-4 text-emerald-500" />
              {task.customerPhone}
            </div>
          </button>

          <div className="p-4 rounded-[2rem] bg-slate-950/50 border border-slate-800">
            <div className="text-[10px] font-black uppercase text-slate-500 mb-2 tracking-widest">Horário Agendado</div>
            <div className="flex items-center gap-2 text-sm font-black text-slate-200">
              <Clock className="w-4 h-4 text-purple-400" />
              {task.scheduledTime}
            </div>
          </div>
        </div>

        {/* Observations */}
        <div className="p-5 rounded-[2rem] bg-slate-950/50 border border-slate-800 space-y-3">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-500 tracking-widest">
            <Box className="w-4 h-4" />
            <span>Descrição do Item / Observações</span>
          </div>
          <p className="text-xs text-slate-300 font-medium leading-relaxed italic px-1">
            "{task.description || 'Nenhuma observação informada.'}"
          </p>
        </div>

        {/* Action Button */}
        <div className="pt-2">
          {task.status === 'Pendente' && (
            <button
              onClick={() => onUpdateStatus(task.id, 'Em Rota')}
              className={`w-full py-5 rounded-[1.8rem] font-black uppercase tracking-[0.2em] text-xs flex items-center justify-center gap-3 transition-all active:scale-95 shadow-2xl ${
                isDelivery 
                  ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30' 
                  : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/30'
              }`}
            >
              <Navigation className="w-5 h-5" />
              Iniciar Rota Agora
            </button>
          )}

          {task.status === 'Em Rota' && (
            <button
              onClick={() => onUpdateStatus(task.id, 'Concluído')}
              className="w-full py-5 rounded-[1.8rem] bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-[0.2em] text-xs flex items-center justify-center gap-3 transition-all active:scale-95 shadow-2xl shadow-emerald-600/30"
            >
              <CheckCircle2 className="w-5 h-5" />
              Concluir {task.type}
            </button>
          )}

          {task.status === 'Concluído' && (
            <div className="w-full py-5 rounded-[1.8rem] bg-slate-800/50 text-slate-400 font-black uppercase tracking-[0.2em] text-xs flex items-center justify-center gap-3 border border-slate-700/50">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              Tarefa Concluída
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

