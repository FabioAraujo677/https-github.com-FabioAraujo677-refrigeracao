import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Search,
  Users,
  Phone,
  MapPin,
  Calendar,
  ShieldCheck,
  ChevronRight,
  Clock,
  FileText,
  Smartphone,
} from 'lucide-react';
import { CustomerRecord, WarrantyOrder } from '../types';
import { sbGetCustomers } from '../utils/supabaseService';
import { formatDate } from '../utils/formatters';

interface CustomerManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  orders: WarrantyOrder[];
  onSelectOrder?: (order: WarrantyOrder) => void;
}

export const CustomerManagementModal: React.FC<CustomerManagementModalProps> = ({
  isOpen,
  onClose,
  orders,
  onSelectOrder,
}) => {
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRecord | null>(null);

  const loadData = async () => {
    try {
      const data = await sbGetCustomers();
      setCustomers(data || []);
    } catch (err) {
      console.error('Error loading customers:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const filteredCustomers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone.replace(/\D/g, '').includes(q.replace(/\D/g, '')) ||
        (c.cpf && c.cpf.includes(q))
    );
  }, [customers, searchQuery]);

  const customerOrders = useMemo(() => {
    if (!selectedCustomer) return [];
    const cleanPhone = selectedCustomer.phone.replace(/\D/g, '');
    return orders.filter(
      (o) =>
        o.customerPhone.replace(/\D/g, '') === cleanPhone ||
        o.customerName.toLowerCase() === selectedCustomer.name.toLowerCase()
    );
  }, [selectedCustomer, orders]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-cyan-500/30 rounded-3xl shadow-[0_0_50px_rgba(6,182,212,0.2)] overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-slate-950/90 border-b border-cyan-500/20 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-slate-950 shadow-[0_0_20px_rgba(6,182,212,0.4)]">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-wide">
                Cadastro de Clientes e Histórico
              </h2>
              <p className="text-xs text-slate-400">
                Busque por nome ou telefone para consultar garantias e atendimentos
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar cliente por nome, telefone ou CPF..."
              className="w-full pl-11 pr-4 py-3 rounded-2xl bg-slate-950/60 border border-slate-800 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-cyan-500/50 shadow-inner"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Customer List Column */}
            <div className="md:col-span-1 space-y-2 max-h-[60vh] overflow-y-auto pr-1">
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-1">
                Clientes Cadastrados ({filteredCustomers.length})
              </div>
              {filteredCustomers.length === 0 ? (
                <div className="p-6 text-center text-slate-600 text-xs font-bold uppercase tracking-wider bg-slate-950/30 rounded-2xl border border-dashed border-slate-800">
                  Nenhum cliente encontrado
                </div>
              ) : (
                filteredCustomers.map((cust) => (
                  <div
                    key={cust.id}
                    onClick={() => setSelectedCustomer(cust)}
                    className={`cursor-pointer p-3.5 rounded-2xl border transition-all ${
                      selectedCustomer?.id === cust.id
                        ? 'bg-cyan-500/10 border-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.15)]'
                        : 'bg-slate-950/40 border-slate-800 hover:border-slate-700 hover:bg-slate-950/60'
                    }`}
                  >
                    <div className="font-bold text-white text-xs truncate">{cust.name}</div>
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-cyan-400 font-mono">
                      <Phone className="w-3 h-3" />
                      {cust.phone}
                    </div>
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5 text-[9px] text-slate-500">
                      <span>{cust.totalOrders} atendimento(s)</span>
                      <span className="text-emerald-400 font-bold">{cust.city}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Customer History Detail Column */}
            <div className="md:col-span-2 space-y-4">
              {selectedCustomer ? (
                <div className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-base font-black text-white">{selectedCustomer.name}</h3>
                      <p className="text-xs text-cyan-400 font-mono mt-0.5">{selectedCustomer.phone}</p>
                    </div>
                    <div className="px-3 py-1 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-[10px] font-bold">
                      {selectedCustomer.totalOrders} Atendimento(s)
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-slate-500 block text-[9px] uppercase font-bold">Endereço</span>
                      <span className="text-slate-200 font-medium">
                        {selectedCustomer.street}, {selectedCustomer.number} - {selectedCustomer.neighborhood}, {selectedCustomer.city}/{selectedCustomer.state}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[9px] uppercase font-bold">CEP</span>
                      <span className="text-slate-200 font-mono">{selectedCustomer.cep || 'Não informado'}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                      Histórico de Ordens e Garantias ({customerOrders.length})
                    </h4>
                    {customerOrders.length === 0 ? (
                      <div className="p-4 text-center text-slate-600 text-xs">Nenhum registro encontrado para este cliente.</div>
                    ) : (
                      <div className="space-y-2 max-h-[35vh] overflow-y-auto pr-1">
                        {customerOrders.map((ord) => (
                          <div
                            key={ord.id}
                            className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-3"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-mono font-black text-cyan-400">{ord.id}</span>
                                <span className="text-[10px] font-bold text-slate-400">{ord.applianceType} ({ord.applianceBrand})</span>
                              </div>
                              <p className="text-[11px] text-slate-300 italic">"{ord.defectDescription}"</p>
                              <div className="flex items-center gap-3 text-[9px] text-slate-500 font-mono">
                                <span>Data: {formatDate(ord.createdAt)}</span>
                                <span className="text-emerald-400 font-bold">Status: {ord.status}</span>
                              </div>
                            </div>
                            {onSelectOrder && (
                              <button
                                onClick={() => onSelectOrder(ord)}
                                className="px-3 py-1.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 text-[10px] font-bold transition-all shrink-0"
                              >
                                Ver Recibo
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center p-12 text-center bg-slate-950/30 rounded-2xl border border-dashed border-slate-800 text-slate-600">
                  <Users className="w-12 h-12 mb-3 text-slate-700" />
                  <p className="text-xs font-bold uppercase tracking-wider">Selecione um cliente ao lado para ver o histórico</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
