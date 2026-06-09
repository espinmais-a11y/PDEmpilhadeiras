import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { ServiceOrder, Customer } from '../types';
import { 
  TrendingUp, 
  AlertTriangle, 
  Search, 
  Download, 
  Banknote, 
  CheckCircle2, 
  Clock,
  MoreVertical,
  Briefcase,
  Wrench,
  Timer,
  Calendar
} from 'lucide-react';
import { clsx } from 'clsx';
import { format, startOfMonth, endOfMonth } from 'date-fns';

export function FinancialPanel() {
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('All');
  const [hourlyRate, setHourlyRate] = useState(0);
  const [customerSearch, setCustomerSearch] = useState('');
  
  // Customer data for name lookup
  const [customers, setCustomers] = useState<Customer[]>([]);
  
  // Date filter - default to current month
  const now = new Date();
  const [dateStart, setDateStart] = useState(format(startOfMonth(now), 'yyyy-MM-dd'));
  const [dateEnd, setDateEnd] = useState(format(endOfMonth(now), 'yyyy-MM-dd'));

  useEffect(() => {
    fetchCustomers();
    fetchHourlyRate();
  }, []);

  useEffect(() => {
    fetchFinancialData();
  }, [statusFilter, dateStart, dateEnd]);

  async function fetchCustomers() {
    const { data } = await supabase.from('customers').select('id, name').order('name');
    if (data) setCustomers(data as Customer[]);
  }

  async function fetchHourlyRate() {
    try {
      const { data, error } = await supabase
        .from('admin_settings')
        .select('value')
        .eq('key', 'hourly_rate')
        .single();
      
      if (data && !error) {
        setHourlyRate(parseFloat(data.value) || 0);
      }
    } catch (err) {
      console.error('[FinancialPanel] Error fetching hourly rate:', err);
    }
  }

  async function fetchFinancialData() {
    let query = supabase.from('service_orders').select('*').eq('status', 'Maintenance Done');
    
    if (statusFilter !== 'All') {
      const isPaid = statusFilter === 'Paid';
      query = query.eq('is_paid', isPaid);
    }

    // Date range filter
    if (dateStart) {
      query = query.gte('updated_at', new Date(`${dateStart}T00:00:00`).toISOString());
    }
    if (dateEnd) {
      query = query.lte('updated_at', new Date(`${dateEnd}T23:59:59`).toISOString());
    }

    const { data } = await query.order('updated_at', { ascending: false });
    if (data) setOrders(data);
    setLoading(false);
  }

  const togglePaidStatus = async (orderId: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from('service_orders')
      .update({ is_paid: !currentStatus, updated_at: new Date().toISOString() })
      .eq('id', orderId);

    if (!error) {
      setOrders(orders.map(os => os.id === orderId ? { ...os, is_paid: !currentStatus } : os));
    }
  };

  // Customer name lookup
  const customerNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    customers.forEach(c => { map[c.id] = c.name; });
    return map;
  }, [customers]);

  // Filter by customer name
  const filteredOrders = orders.filter(os => {
    if (!customerSearch) return true;
    const q = customerSearch.toLowerCase();
    const customerName = customerNameMap[os.customer_id] || '';
    return customerName.toLowerCase().includes(q);
  });

  const totalWorkHours = filteredOrders.reduce((sum, os) => sum + Number(os.work_hours || 0), 0);
  const totalHourlyRevenue = totalWorkHours * hourlyRate;
  
  const totalPartsRevenue = filteredOrders.reduce((sum, os) => sum + Number(os.total_value || 0), 0);
  const totalRevenue = totalHourlyRevenue + totalPartsRevenue;
  
  const paidOrders = filteredOrders.filter(os => os.is_paid);
  const paidHours = paidOrders.reduce((sum, os) => sum + Number(os.work_hours || 0), 0);
  const paidHourlyRevenue = paidHours * hourlyRate;
  const paidPartsRevenue = paidOrders.reduce((sum, os) => sum + Number(os.total_value || 0), 0);
  const paidTotal = paidHourlyRevenue + paidPartsRevenue;
  
  const pendingTotal = totalRevenue - paidTotal;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black italic tracking-tighter text-white uppercase">Painel Financeiro</h2>
          <p className="text-[#c5c9ac] font-['JetBrains_Mono'] text-xs uppercase tracking-widest">Relatório de faturamento e fluxo de caixa industrial</p>
        </div>
        
        <button className="bg-[#caf300] text-[#121414] px-6 py-3 font-bold text-[10px] tracking-widest flex items-center gap-2 hover:brightness-110 shadow-lg rounded-xl">
          <Download size={14} /> EXPORTAR RELATÓRIO CSV
        </button>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <FinanceCard 
          label="RECEITA HORA SERVIÇO" 
          value={`R$ ${totalHourlyRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} 
          sub={`${totalWorkHours.toFixed(1)}h × R$ ${hourlyRate.toFixed(2)}/h`}
          icon={Timer}
          color="text-[#caf300]"
        />
        <FinanceCard 
          label="RECEITA TOTAL (PEÇAS + MÃO DE OBRA)" 
          value={`R$ ${totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} 
          sub="Soma de todas as OS concluídas"
          icon={TrendingUp}
          color="text-[#caf300]"
        />
        <FinanceCard 
          label="VALOR RECEBIDO" 
          value={`R$ ${paidTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} 
          sub="Transações confirmadas"
          icon={CheckCircle2}
          color="text-[#00ffff]"
        />
        <FinanceCard 
          label="PENDENTE FATURAMENTO" 
          value={`R$ ${pendingTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} 
          sub="Aguardando liquidação"
          icon={Clock}
          color="text-[#ffbf00]"
        />
      </div>

      {/* Valor Hora Informativo */}
      {hourlyRate > 0 && (
        <div className="bg-[#282a2b] border border-[#444932] rounded-xl px-6 py-3 flex items-center gap-3">
          <Wrench size={16} className="text-[#caf300]" />
          <span className="text-[10px] font-bold text-[#c5c9ac] tracking-widest uppercase font-['JetBrains_Mono']">
            VALOR HORA CONFIGURADO: <span className="text-[#caf300]">R$ {hourlyRate.toFixed(2)}</span>
            {' '}• TOTAL HORAS LANÇADAS: <span className="text-white">{totalWorkHours.toFixed(1)}h</span>
          </span>
        </div>
      )}

      {/* Tabela de OS */}
      <div className="bg-[#1e2020] border border-[#444932] rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-[#444932] bg-[#282a2b] flex flex-wrap items-center justify-between gap-4">
           <div className="flex border border-[#444932] overflow-hidden shadow-inner rounded-xl">
              <FilterBtn label="TODOS" active={statusFilter === 'All'} onClick={() => setStatusFilter('All')} />
              <FilterBtn label="PAGOS" active={statusFilter === 'Paid'} onClick={() => setStatusFilter('Paid')} />
              <FilterBtn label="PENDENTES" active={statusFilter === 'Pending'} onClick={() => setStatusFilter('Pending')} />
           </div>
           
           <div className="flex flex-wrap items-end gap-3">
             {/* Busca por cliente */}
             <div className="flex items-center bg-[#0c0f0f] border border-[#444932] rounded-xl px-3 py-1 w-full max-w-xs">
               <Search size={14} className="text-[#c5c9ac] mr-2" />
               <input 
                 type="text" 
                 placeholder="BUSCAR POR CLIENTE..." 
                 value={customerSearch}
                 onChange={(e) => setCustomerSearch(e.target.value)}
                 className="bg-transparent border-none focus:ring-0 text-[10px] text-white w-full uppercase" 
               />
             </div>

             {/* Date Start */}
             <div className="space-y-0.5 relative">
               <label className="text-[8px] font-bold text-[#c5c9ac] tracking-widest uppercase flex items-center gap-1">
                 <Calendar size={8} /> Início
               </label>
               <div className="relative">
                 <input
                   type="date"
                   value={dateStart}
                   onClick={(e) => { try { if ('showPicker' in e.currentTarget) e.currentTarget.showPicker(); } catch {} }}
                   onChange={(e) => setDateStart(e.target.value)}
                   className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                 />
                 <div className="bg-[#0c0f0f] border border-[#444932] text-[10px] font-bold font-['JetBrains_Mono'] text-[#e2e2e2] px-2 py-1 rounded-lg pointer-events-none min-w-[80px] text-center">
                   {dateStart ? dateStart.split('-').reverse().join('/') : 'DD/MM/AAAA'}
                 </div>
               </div>
             </div>

             {/* Date End */}
             <div className="space-y-0.5 relative">
               <label className="text-[8px] font-bold text-[#c5c9ac] tracking-widest uppercase flex items-center gap-1">
                 <Calendar size={8} /> Fim
               </label>
               <div className="relative">
                 <input
                   type="date"
                   value={dateEnd}
                   onClick={(e) => { try { if ('showPicker' in e.currentTarget) e.currentTarget.showPicker(); } catch {} }}
                   onChange={(e) => setDateEnd(e.target.value)}
                   className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                 />
                 <div className="bg-[#0c0f0f] border border-[#444932] text-[10px] font-bold font-['JetBrains_Mono'] text-[#e2e2e2] px-2 py-1 rounded-lg pointer-events-none min-w-[80px] text-center">
                   {dateEnd ? dateEnd.split('-').reverse().join('/') : 'DD/MM/AAAA'}
                 </div>
               </div>
             </div>
           </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-[#333535] text-[#c5c9ac] text-[10px] uppercase font-bold tracking-widest border-b border-[#444932]">
                <th className="px-6 py-4">ID FATURA</th>
                <th className="px-6 py-4">OS / TÍTULO</th>
                <th className="px-6 py-4 text-right">HORAS</th>
                <th className="px-6 py-4 text-right">VALOR HORA</th>
                <th className="px-6 py-4 text-right">VALOR PEÇAS</th>
                <th className="px-6 py-4 text-right">TOTAL</th>
                <th className="px-6 py-4">DATA</th>
                <th className="px-6 py-4 text-center">STATUS</th>
                <th className="px-6 py-4 text-right">AÇÕES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#444932]/30 font-['JetBrains_Mono'] text-xs">
              {filteredOrders.map((os) => {
                const osHourlyValue = Number(os.work_hours || 0) * hourlyRate;
                const osPartsValue = Number(os.total_value || 0);
                const osTotal = osHourlyValue + osPartsValue;
                const customerName = customerNameMap[os.customer_id] || '';

                return (
                <React.Fragment key={os.id}>
                  <tr className="hover:bg-[#333535] transition-colors">
                    <td className="px-6 pt-4 pb-1 text-[#caf300]">#INV-{os.id.slice(0, 6).toUpperCase()}</td>
                    <td className="px-6 pt-4 pb-1">
                       <p className="font-bold text-[#e2e2e2] uppercase">{os.title}</p>
                    </td>
                    <td className="px-6 pt-4 pb-1 text-right text-[#00bcd4] font-bold">
                       {Number(os.work_hours || 0).toFixed(1)}h
                    </td>
                    <td className="px-6 pt-4 pb-1 text-right text-[#c5c9ac]">
                       R$ {osHourlyValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 pt-4 pb-1 text-right text-[#c5c9ac]">
                       R$ {osPartsValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 pt-4 pb-1 text-right font-bold text-white">
                       R$ {osTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 pt-4 pb-1 text-[#c5c9ac]">
                       {format(new Date(os.updated_at), 'dd/MM/yyyy')}
                    </td>
                    <td className="px-6 pt-4 pb-1 text-center">
                       <span className={clsx(
                         "px-3 py-1 font-black text-[10px] tracking-widest rounded",
                         os.is_paid ? "bg-[#caf300]/20 text-[#caf300] border border-[#caf300]" : "bg-[#93000a] text-white"
                       )}>
                          {os.is_paid ? 'LIQUIDADO' : 'PENDENTE'}
                       </span>
                    </td>
                    <td className="px-6 pt-4 pb-1 text-right">
                       <button 
                         onClick={() => togglePaidStatus(os.id, os.is_paid)}
                         className={clsx(
                           "px-3 py-1.5 text-[9px] font-bold tracking-widest uppercase transition-all active:scale-95 rounded-lg",
                           os.is_paid 
                             ? "bg-[#93000a]/20 text-[#ffb4ab] hover:bg-[#93000a] hover:text-white border border-[#93000a]/50"
                             : "bg-[#caf300]/20 text-[#caf300] hover:bg-[#caf300] hover:text-[#121414] border border-[#caf300]/50"
                         )}
                       >
                          {os.is_paid ? 'ESTORNAR' : 'LIQUIDAR'}
                       </button>
                    </td>
                  </tr>
                  {/* Linha extra com nome do cliente */}
                  {customerName && (
                    <tr className="hover:bg-[#333535] transition-colors">
                      <td colSpan={9} className="px-6 pb-3 pt-0">
                        <span className="text-[9px] font-bold text-[#caf300]/70 tracking-widest uppercase">
                          CLIENTE: {customerName}
                        </span>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
              })}
            </tbody>
          </table>
          
          {filteredOrders.length === 0 && (
             <div className="py-20 text-center text-[#c5c9ac] opacity-50 space-y-2">
                <Briefcase size={32} className="mx-auto" />
                <p className="text-[10px] font-bold uppercase tracking-widest">Nenhuma fatura encontrada</p>
             </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FinanceCard({ label, value, sub, icon: Icon, color }: any) {
  return (
    <div className="bg-[#1e2020] border border-[#444932] p-6 group rounded-2xl shadow-lg hover:border-[#caf300]/50 transition-all">
      <div className="flex justify-between items-start mb-6">
        <span className="text-[10px] font-bold text-[#c5c9ac] tracking-widest uppercase font-['JetBrains_Mono']">{label}</span>
        <Icon size={18} className={color} />
      </div>
      <p className={clsx("text-2xl font-black italic tracking-tighter mb-1", color)}>{value}</p>
      <p className="text-[10px] text-[#c5c9ac] font-bold tracking-tight uppercase">{sub}</p>
    </div>
  );
}

function FilterBtn({ label, active, onClick }: any) {
  return (
    <button 
      onClick={onClick}
      className={clsx(
        "px-4 py-2 text-[9px] font-bold tracking-widest transition-all",
        active ? "bg-[#caf300] text-[#121414]" : "bg-[#121414] text-[#c5c9ac] hover:bg-[#333535]"
      )}
    >
      {label}
    </button>
  );
}

// forced sync
