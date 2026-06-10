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
  X,
  Mail,
  Send,
  Loader2,
  Trash2
} from 'lucide-react';
import { clsx } from 'clsx';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { ServiceOrderModal } from '../components/ServiceOrderModal';
import { sendFinishedOSReport } from '../lib/emailService';

export function ServiceOrders() {
  const { profile } = useAuth();
  const isAdmin = profile?.role?.toString().toLowerCase().trim() === 'admin';
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [deletingOsId, setDeletingOsId] = useState<string | null>(null);
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

  // Email report modal states
  const [selectedEmailLog, setSelectedEmailLog] = useState<any>(null);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailSendingText, setEmailSendingText] = useState<string | null>(null);

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
    setLoading(true);
    setEmailSendingText('Finalizando serviço e gerando relatório técnico do cliente...');
    
    const performCheckOut = async (lat?: number, lng?: number) => {
      try {
        const { error } = await supabase
          .from('service_orders')
          .update({
            status: 'Maintenance Done',
            check_out_at: new Date().toISOString(),
            check_out_lat: lat || null,
            check_out_lng: lng || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', orderId);

        if (!error) {
          setEmailSendingText('Enviando relatório de manutenção consolidado para o e-mail do cliente...');
          await sendFinishedOSReport(orderId);
          setEmailSendingText(null);
          fetchOrders();
        } else {
          setEmailSendingText(null);
          setLoading(false);
        }
      } catch (err) {
        console.error(err);
        setEmailSendingText(null);
        setLoading(false);
      }
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          await performCheckOut(pos.coords.latitude, pos.coords.longitude);
        },
        async () => {
          await performCheckOut();
        }
      );
    } else {
      await performCheckOut();
    }
  };

  const handleViewEmailLog = async (orderId: string) => {
    setLoading(true);
    setEmailSendingText('Buscando histórico do e-mail enviado...');
    try {
      const { data, error } = await supabase
        .from('email_logs')
        .eq('service_order_id', orderId)
        .single();
      
      if (error || !data) {
        // Generate retroactively for pre-existing or fallback situations
        setEmailSendingText('Gerando novo relatório de e-mail retroativo...');
        const res = await sendFinishedOSReport(orderId);
        if (res.success && res.data) {
          setSelectedEmailLog(res.data);
          setEmailModalOpen(true);
        } else {
          alert('Não foi possível gerar o relatório de e-mail: ' + (res.error || 'Erro desconhecido.'));
        }
      } else {
        setSelectedEmailLog(data);
        setEmailModalOpen(true);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setEmailSendingText(null);
      setLoading(false);
    }
  };

  const handleEdit = (order: ServiceOrder) => {
    setEditingOrder(order);
    setIsModalOpen(true);
  };

  const handleDeleteOS = async (orderId: string) => {
    if (!isAdmin) return;
    if (deletingOsId !== orderId) {
      setDeletingOsId(orderId);
      setTimeout(() => setDeletingOsId(null), 4000);
      return;
    }

    setLoading(true);
    try {
      await supabase.from('used_parts').delete().eq('service_order_id', orderId);
      await supabase.from('preventive_checklist_answers').delete().eq('service_order_id', orderId);
      await supabase.from('service_order_photos').delete().eq('service_order_id', orderId);
      await supabase.from('email_logs').delete().eq('service_order_id', orderId);

      const { error } = await supabase.from('service_orders').delete().eq('id', orderId);
      if (error) throw error;

      setDeletingOsId(null);
      fetchOrders();
    } catch (err: any) {
      console.error('[ServiceOrders] Delete error:', err);
      alert('Erro ao excluir ordem de serviço: ' + (err.message || 'Erro desconhecido.'));
    } finally {
      setLoading(false);
    }
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
                      "transition-colors p-1 rounded-lg cursor-pointer",
                      isConcluded 
                        ? "text-[#c5c9ac] hover:text-white hover:bg-[#333535]" 
                        : "text-[#c5c9ac] hover:text-[#caf300] hover:bg-[#333535]"
                    )}
                    title={isConcluded ? "Ver detalhes" : "Editar OS"}
                  >
                    <Pencil size={14} />
                  </button>
                  {isAdmin && (
                    <button 
                      onClick={() => handleDeleteOS(os.id)}
                      className={clsx(
                        "transition-all p-1.5 rounded-lg cursor-pointer flex items-center justify-center border",
                        deletingOsId === os.id
                          ? "bg-[#93000a] text-white border-[#f1554c] animate-pulse"
                          : "text-[#ffb4ab]/80 border-transparent hover:text-white hover:bg-[#93000a] hover:border-red-500/20"
                      )}
                      title={deletingOsId === os.id ? "Clique novamente para confirmar" : "Excluir OS"}
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
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
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-center gap-2 py-1.5 text-[10px] font-bold text-[#00c853] tracking-widest uppercase">
                       <Wrench size={16} /> MANUTENÇÃO CONCLUÍDA
                    </div>
                    <button 
                      onClick={() => handleViewEmailLog(os.id)}
                      className="w-full bg-[#1e2020] hover:bg-[#282a2b] text-[#caf300] border border-[#caf300]/20 hover:border-[#caf300]/60 py-2 rounded-xl text-[10px] font-black tracking-widest flex items-center justify-center gap-2 transition-all uppercase cursor-pointer"
                    >
                      <Mail size={13} /> VER E-MAIL ENVIADO
                    </button>
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

      {/* FULL-SCREEN OVERLAY FOR GENERATION/SENDING EMAIL FEEDBACK */}
      <AnimatePresence>
        {emailSendingText && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/85 backdrop-blur-md z-[100] flex flex-col items-center justify-center p-6 text-center"
          >
            <div className="relative mb-6">
              <div className="w-16 h-16 border-4 border-[#444932] border-t-[#caf300] rounded-full animate-spin"></div>
              <Mail className="absolute inset-x-0 inset-y-0 m-auto text-[#caf300] animate-pulse" size={24} />
            </div>
            <h3 className="text-white font-black text-xs uppercase tracking-[0.2em] mb-2">Processamento de Relatório</h3>
            <p className="text-[#c5c9ac] text-xs max-w-sm font-sans tracking-tight leading-relaxed">{emailSendingText}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* DETAILED EMAIL PREVIEW OVERLAY MODAL */}
      <AnimatePresence>
        {emailModalOpen && selectedEmailLog && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-[#121414] border border-[#444932] w-full max-w-4xl h-[90vh] flex flex-col shadow-2xl rounded-2xl overflow-hidden"
            >
              {/* Email Envelope Header */}
              <div className="bg-[#1e2020] border-b border-[#444932] p-5 flex flex-col gap-3">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="bg-emerald-950 p-2 rounded-xl text-emerald-400 border border-emerald-500/20">
                      <Mail size={18} />
                    </div>
                    <div>
                      <h3 className="text-white font-black text-xs uppercase tracking-wider mb-0.5">Relatório Concluído Enviado</h3>
                      <p className="text-[#c5c9ac] text-[10px] font-mono">ID Registro: {selectedEmailLog.id}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      setEmailModalOpen(false);
                      setSelectedEmailLog(null);
                    }}
                    className="text-[#c5c9ac] hover:text-white bg-[#282a2b] hover:bg-[#333535] p-2 rounded-xl transition-all cursor-pointer"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2 bg-[#0c0f0f] border border-[#444932] p-3.5 rounded-xl font-mono text-[11px] text-[#c5c9ac]">
                  <div>
                    <span className="text-[#caf300] font-bold">DE:</span> {import.meta.env.VITE_RESEND_FROM_EMAIL || 'onboarding@resend.dev'}
                  </div>
                  <div>
                    <span className="text-[#caf300] font-bold">PARA:</span> {selectedEmailLog.recipient_email}
                  </div>
                  <div className="md:col-span-2">
                    <span className="text-[#caf300] font-bold">ASSUNTO:</span> {selectedEmailLog.subject}
                  </div>
                  <div className="md:col-span-2">
                    <span className="text-[#caf300] font-bold">ENVIADO EM:</span> {new Date(selectedEmailLog.sent_at).toLocaleString('pt-BR')}
                  </div>
                </div>
              </div>

              {/* Email Body Preview via isolated Iframe */}
              <div className="flex-1 bg-white p-2">
                <iframe 
                  title="Visualização do Email"
                  srcDoc={selectedEmailLog.html_body}
                  className="w-full h-full border-0 rounded-lg text-black"
                  sandbox="allow-same-origin"
                />
              </div>

              {/* Modal Control Footer */}
              <div className="bg-[#1e2020] border-t border-[#444932] p-4 flex justify-between items-center text-xs text-[#c5c9ac] font-bold uppercase tracking-wider">
                <div className="flex items-center gap-2 text-[#00c853]">
                  <Send size={14} className="animate-bounce" />
                  <span>Log de envio verificado e salvo</span>
                </div>
                <button 
                  onClick={() => {
                    setEmailModalOpen(false);
                    setSelectedEmailLog(null);
                  }}
                  className="bg-[#caf300] text-[#121414] px-6 py-2.5 text-[10px] font-black tracking-widest hover:brightness-110 active:scale-[0.98] rounded-xl transition-all cursor-pointer"
                >
                  FECHAR PRÉVIA
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// forced sync
