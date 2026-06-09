import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { ServiceOrder, Customer } from '../types';
import { 
  ClipboardList, 
  Search, 
  Filter, 
  MoreVertical, 
  Play, 
  CheckCircle2, 
  MapPin, 
  Clock,
  Camera,
  Signature,
  Pencil,
  Wrench,
  Calendar,
  X
} from 'lucide-react';
import { clsx } from 'clsx';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ServiceOrderModal } from '../components/ServiceOrderModal';

export function ServiceOrders() {
  const { profile } = useAuth();
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<ServiceOrder | null>(null);
  
  // Customer filter
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerFilter, setCustomerFilter] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  // Date filter - default to current month
  const now = new Date();
  const [dateStart, setDateStart] = useState(format(startOfMonth(now), 'yyyy-MM-dd'));
  const [dateEnd, setDateEnd] = useState(format(endOfMonth(now), 'yyyy-MM-dd'));

  useEffect(() => {
    fetchCustomers();
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [profile, statusFilter, customerFilter, dateStart, dateEnd]);

  async function fetchCustomers() {
    const { data } = await supabase.from('customers').select('id, name').order('name');
    if (data) setCustomers(data as Customer[]);
  }

  async function fetchOrders() {
    try {
      setLoading(true);
      let query = supabase.from('service_orders').select('*, machines ( brand, model )');
      
      if (profile?.role === 'Employee' || profile?.role === 'employee') {
        query = query.eq('employee_id', profile.id);
      }
      
      if (statusFilter !== 'All') {
        query = query.eq('status', statusFilter);
      }

      if (customerFilter) {
        query = query.eq('customer_id', customerFilter);
      }

      if (dateStart) {
        query = query.gte('created_at', new Date(`${dateStart}T00:00:00`).toISOString());
      }
      if (dateEnd) {
        query = query.lte('created_at', new Date(`${dateEnd}T23:59:59`).toISOString());
      }

      // Otimização e Segurança: Trava de leitura caso os filtros de data estejam vazios
      if (!dateStart && !dateEnd) {
        query = query.limit(50);
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      if (data) setOrders(data);
    } catch (err) {
      console.error('[ServiceOrders] Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }

  const handleCheckIn = async (orderId: string) => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude, longitude } = pos.coords;
      const { error } = await supabase
        .from('service_orders')
        .update({
          status: 'Executing',
          check_in_at: new Date().toISOString(),
          check_in_lat: latitude,
          check_in_lng: longitude,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);
      if (!error) fetchOrders();
    });
  };

  const handleCheckOut = async (orderId: string) => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude, longitude } = pos.coords;
      const { error } = await supabase
        .from('service_orders')
        .update({
          status: 'Maintenance Done',
          check_out_at: new Date().toISOString(),
          check_out_lat: latitude,
          check_out_lng: longitude,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);
      if (!error) fetchOrders();
    });
  };

  const handleEdit = (order: ServiceOrder) => {
    setEditingOrder(order);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingOrder(null);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Executing':
        return { bg: 'bg-[#caf300] text-[#121414]', label: 'EXECUTANDO' };
      case 'Pending':
        return { bg: 'bg-[#ffbf00] text-[#121414]', label: 'PENDENTE' };
      case 'Maintenance Done':
        return { bg: 'bg-[#00c853] text-[#121414]', label: 'MANUTENÇÃO CONCLUÍDA' };
      case 'Cancelled':
        return { bg: 'bg-[#ffb4ab] text-[#690005]', label: 'CANCELADA' };
      case 'In Route':
        return { bg: 'bg-[#00bcd4] text-[#121414]', label: 'EM ROTA' };
      default:
        return { bg: 'bg-[#444932] text-[#c5c9ac]', label: status.toUpperCase() };
    }
  };

  // Customer name lookup
  const customerNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    customers.forEach(c => { map[c.id] = c.name; });
    return map;
  }, [customers]);

  const filteredCustomerList = customers.filter(c => 
    !customerSearch || c.name.toLowerCase().includes(customerSearch.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black italic tracking-tighter text-white">ORDENS DE SERVIÇO</h2>
          <p className="text-[#c5c9ac] font-['JetBrains_Mono'] text-xs uppercase tracking-widest">Execução técnica e monitoramento</p>
        </div>
        
        <button 
          onClick={() => { setEditingOrder(null); setIsModalOpen(true); }}
          className="bg-[#caf300] text-[#121414] px-4 py-2 font-bold text-[10px] tracking-widest flex items-center gap-2 rounded-lg hover:brightness-110"
        >
          <ClipboardList size={14} /> NOVA OS
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-[#1e2020] border border-[#444932] rounded-2xl p-4 space-y-4">
        <div className="flex flex-wrap gap-3 items-end">
          {/* Filtro Status */}
          <div className="space-y-1">
            <label className="text-[9px] font-bold text-[#c5c9ac] tracking-widest uppercase">Status</label>
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-[#0c0f0f] border border-[#444932] text-[10px] font-bold font-['JetBrains_Mono'] text-[#e2e2e2] px-3 py-2 outline-none focus:border-[#caf300] rounded-lg"
            >
              <option value="All">TODOS</option>
              <option value="Pending">PENDENTES</option>
              <option value="In Route">EM ROTA</option>
              <option value="Executing">EXECUTANDO</option>
              <option value="Maintenance Done">MANUTENÇÃO CONCLUÍDA</option>
              <option value="Cancelled">CANCELADAS</option>
            </select>
          </div>

          {/* Filtro Cliente */}
          <div className="space-y-1 relative">
            <label className="text-[9px] font-bold text-[#c5c9ac] tracking-widest uppercase">Cliente</label>
            <div className="relative">
              <input
                type="text"
                placeholder="BUSCAR CLIENTE..."
                value={customerSearch || (customerFilter ? customerNameMap[customerFilter] || '' : '')}
                onChange={(e) => {
                  setCustomerSearch(e.target.value);
                  setShowCustomerDropdown(true);
                  if (!e.target.value) {
                    setCustomerFilter('');
                  }
                }}
                onFocus={() => setShowCustomerDropdown(true)}
                className="bg-[#0c0f0f] border border-[#444932] text-[10px] font-bold font-['JetBrains_Mono'] text-[#e2e2e2] px-3 py-2 outline-none focus:border-[#caf300] rounded-lg w-48 uppercase"
              />
              {customerFilter && (
                <button 
                  onClick={() => { setCustomerFilter(''); setCustomerSearch(''); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[#c5c9ac] hover:text-white"
                >
                  <X size={12} />
                </button>
              )}
              {showCustomerDropdown && (
                <div className="absolute top-full left-0 mt-1 w-64 bg-[#1e2020] border border-[#444932] rounded-xl shadow-2xl z-20 max-h-48 overflow-y-auto">
                  <button
                    onClick={() => { setCustomerFilter(''); setCustomerSearch(''); setShowCustomerDropdown(false); }}
                    className="w-full text-left px-3 py-2 text-[10px] font-bold text-[#c5c9ac] hover:bg-[#333535] hover:text-[#caf300] transition-all uppercase"
                  >
                    TODOS OS CLIENTES
                  </button>
                  {filteredCustomerList.map(c => (
                    <button
                      key={c.id}
                      onClick={() => { setCustomerFilter(c.id); setCustomerSearch(''); setShowCustomerDropdown(false); }}
                      className={clsx(
                        "w-full text-left px-3 py-2 text-[10px] font-bold hover:bg-[#333535] transition-all uppercase",
                        customerFilter === c.id ? "text-[#caf300] bg-[#333535]" : "text-[#e2e2e2]"
                      )}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Filtro Data Início */}
          <div className="space-y-1 relative">
            <label className="text-[9px] font-bold text-[#c5c9ac] tracking-widest uppercase flex items-center gap-1">
              <Calendar size={10} /> Data Início
            </label>
            <div className="relative">
              <input
                type="date"
                value={dateStart}
                onClick={(e) => { try { if ('showPicker' in e.currentTarget) e.currentTarget.showPicker(); } catch {} }}
                onChange={(e) => setDateStart(e.target.value)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              <div className="bg-[#0c0f0f] border border-[#444932] text-[10px] font-bold font-['JetBrains_Mono'] text-[#e2e2e2] px-3 py-2 rounded-lg pointer-events-none min-w-[100px] text-center">
                {dateStart ? dateStart.split('-').reverse().join('/') : 'DD/MM/AAAA'}
              </div>
            </div>
          </div>

          {/* Filtro Data Fim */}
          <div className="space-y-1 relative">
            <label className="text-[9px] font-bold text-[#c5c9ac] tracking-widest uppercase flex items-center gap-1">
              <Calendar size={10} /> Data Fim
            </label>
            <div className="relative">
              <input
                type="date"
                value={dateEnd}
                onClick={(e) => { try { if ('showPicker' in e.currentTarget) e.currentTarget.showPicker(); } catch {} }}
                onChange={(e) => setDateEnd(e.target.value)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              <div className="bg-[#0c0f0f] border border-[#444932] text-[10px] font-bold font-['JetBrains_Mono'] text-[#e2e2e2] px-3 py-2 rounded-lg pointer-events-none min-w-[100px] text-center">
                {dateEnd ? dateEnd.split('-').reverse().join('/') : 'DD/MM/AAAA'}
              </div>
            </div>
          </div>
        </div>

        <div className="text-[9px] font-['JetBrains_Mono'] text-[#c5c9ac] tracking-wide">
          {orders.length} ordem(ns) encontrada(s) • Período: {dateStart.split('-').reverse().join('/')} a {dateEnd.split('-').reverse().join('/')}
          {customerFilter && ` • Cliente: ${customerNameMap[customerFilter] || ''}`}
        </div>
      </div>

      {/* Click outside handler */}
      {showCustomerDropdown && (
        <div className="fixed inset-0 z-10" onClick={() => setShowCustomerDropdown(false)} />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {orders.map((os) => {
          const badge = getStatusBadge(os.status);
          const isConcluded = os.status === 'Maintenance Done';
          return (
          <div key={os.id} className="bg-[#1e2020] border border-[#444932] flex flex-col shadow-xl rounded-2xl overflow-hidden group hover:border-[#caf300]/50 transition-all">
              <div className="p-4 border-b border-[#444932] bg-[#282a2b] flex justify-between items-start">
                <div className="flex flex-wrap gap-1.5 items-center">
                  <span className={clsx(
                    "px-2 py-1 text-[8px] font-black tracking-[0.2em] rounded",
                    badge.bg
                  )}>
                    {badge.label}
                  </span>
                  {os.is_preventive && (
                    <span className="px-2 py-1 text-[8px] font-black tracking-[0.2em] rounded bg-purple-500/20 text-purple-400 border border-purple-500/30 font-bold uppercase">
                      PREVENTIVA
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-['JetBrains_Mono'] text-[#c5c9ac]">OS #{os.id.slice(0, 8)}</span>
                  <button 
                    onClick={() => handleEdit(os)}
                    className={clsx(
                      "transition-colors p-1 rounded-lg",
                      isConcluded 
                        ? "text-[#c5c9ac] hover:text-white hover:bg-[#333535]" 
                        : "text-[#c5c9ac] hover:text-[#caf300] hover:bg-[#333535]"
                    )}
                    title={isConcluded ? "Ver detalhes" : "Editar OS"}
                  >
                    <Pencil size={14} />
                  </button>
                </div>
             </div>

             <div className="p-6 space-y-4 flex-1">
                <div>
                   <h3 className="text-lg font-bold text-white tracking-tight leading-tight mb-1 uppercase">{os.title}</h3>
                   {os.machines && (
                     <p className="text-[10px] text-[#00bcd4] font-bold font-['JetBrains_Mono'] mb-1 tracking-widest uppercase">
                       {os.machines.brand} {os.machines.model}
                     </p>
                   )}
                   <p className="text-xs text-[#c5c9ac]">{os.description || 'Sem descrição detalhada.'}</p>
                   {customerNameMap[os.customer_id] && (
                     <p className="text-[10px] text-[#caf300] font-bold mt-2 uppercase">{customerNameMap[os.customer_id]}</p>
                   )}
                </div>

                <div className="bg-[#0c0f0f] border border-[#444932] p-3 space-y-2 rounded-xl">
                   <div className="flex items-center gap-2 text-[9px] font-bold text-[#c5c9ac] uppercase">
                      <Clock size={12} className="text-[#caf300]" />
                      <span>ABERTA EM: {format(new Date(os.created_at), 'dd/MM HH:mm')}</span>
                   </div>
                   {os.check_in_at && (
                     <div className="flex items-center gap-2 text-[9px] font-bold text-[#caf300] uppercase">
                        <MapPin size={12} />
                        <span>INÍCIO: {format(new Date(os.check_in_at), 'HH:mm')} ({os.check_in_lat?.toFixed(4)}, {os.check_in_lng?.toFixed(4)})</span>
                     </div>
                   )}
                   {(os.work_hours > 0) && (
                     <div className="flex items-center gap-2 text-[9px] font-bold text-[#00bcd4] uppercase">
                        <Wrench size={12} />
                        <span>HORAS TRABALHADAS: {os.work_hours}h</span>
                     </div>
                   )}
                </div>
             </div>

             <div className="p-4 bg-[#121414] border-t border-[#444932]">
                {(profile?.role === 'Employee' || profile?.role === 'employee') && os.status === 'Pending' && (
                  <button 
                    onClick={() => handleCheckIn(os.id)}
                    className="w-full bg-[#caf300] text-[#121414] py-3 text-[10px] font-black tracking-widest flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.98] rounded-xl shadow-lg"
                  >
                    <Play size={14} fill="currentColor" /> REALIZAR CHECK-IN
                  </button>
                )}

                {(profile?.role === 'Employee' || profile?.role === 'employee') && os.status === 'Executing' && (
                  <div className="flex flex-col gap-2">
                    <button 
                      onClick={() => handleEdit(os)}
                      className="w-full bg-[#caf300] text-[#121414] py-2.5 text-[10px] font-black tracking-widest flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.98] rounded-xl shadow-lg uppercase"
                    >
                      <Wrench size={14} /> ENTRAR E EDITAR OS
                    </button>
                    <button 
                      onClick={() => handleCheckOut(os.id)}
                      className="w-full bg-[#333535] text-white border border-[#444932] py-2.5 text-[10px] font-bold tracking-widest flex items-center justify-center gap-2 hover:bg-[#444932] active:scale-[0.98] rounded-xl transition-all uppercase"
                    >
                      <CheckCircle2 size={14} /> FINALIZAR SERVIÇO (CHECK-OUT)
                    </button>
                  </div>
                )}

                {os.status === 'Maintenance Done' && (
                   <div className="flex items-center justify-center gap-2 py-3 text-[10px] font-bold text-[#00c853] tracking-widest uppercase">
                      <Wrench size={16} /> MANUTENÇÃO CONCLUÍDA
                   </div>
                )}

                {os.status === 'Cancelled' && (
                   <div className="flex items-center justify-center gap-2 py-3 text-[10px] font-bold text-[#ffb4ab] tracking-widest uppercase">
                      CANCELADA
                   </div>
                )}

                {os.status === 'In Route' && (
                   <div className="flex items-center justify-center gap-2 py-3 text-[10px] font-bold text-[#00bcd4] tracking-widest uppercase">
                      <MapPin size={16} /> EM ROTA
                   </div>
                )}
             </div>
          </div>
        );
        })}

        {orders.length === 0 && !loading && (
          <div className="col-span-full py-20 text-center border-2 border-dashed border-[#444932] opacity-30 rounded-2xl">
             <ClipboardList size={48} className="mx-auto mb-4" />
             <p className="text-sm font-bold uppercase tracking-widest">Nenhuma Ordem de Serviço encontrada</p>
          </div>
        )}
      </div>

      <ServiceOrderModal 
        isOpen={isModalOpen} 
        onClose={handleCloseModal} 
        onSuccess={fetchOrders}
        editingOrder={editingOrder}
      />
    </div>
  );
}

// forced sync
