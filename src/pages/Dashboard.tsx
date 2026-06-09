import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { ServiceOrder } from '../types';
import { useNavigate } from 'react-router-dom';
import { 
  TrendingUp, 
  AlertTriangle, 
  ArrowUpRight, 
  CheckCircle2, 
  Clock, 
  Wrench,
  ClipboardList,
} from 'lucide-react';
import { clsx } from 'clsx';
import { format, startOfMonth } from 'date-fns';
import { ServiceOrderModal } from '../components/ServiceOrderModal';

export function Dashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [allOrders, setAllOrders] = useState<ServiceOrder[]>([]);
  const [recentOs, setRecentOs] = useState<ServiceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [hourlyRate, setHourlyRate] = useState(0);
  const [machinesInMaintenance, setMachinesInMaintenance] = useState(0);

  useEffect(() => {
    fetchDashboardData();
  }, [profile]);

  async function fetchDashboardData() {
    if (!profile) return;

    const startOfCurrentMonth = startOfMonth(new Date());

    let query = supabase.from('service_orders').select('*')
      .gte('created_at', startOfCurrentMonth.toISOString());

    const role = (profile?.role || '').toString().toLowerCase().trim();

    if (role === 'employee') {
      query = query.eq('employee_id', profile?.id);
    }

    const { data: osData } = await query.order('created_at', { ascending: false });
    
    if (osData) {
      setAllOrders(osData);
      setRecentOs(osData.slice(0, 10));
    }

    const { count: maintenanceCount } = await supabase
      .from('machines')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'Maintenance');
    setMachinesInMaintenance(maintenanceCount || 0);

    if (role === 'admin') {
      try {
        const { data: rateData } = await supabase
          .from('admin_settings')
          .select('value')
          .eq('key', 'hourly_rate')
          .single();
        if (rateData) setHourlyRate(parseFloat(rateData.value) || 0);
      } catch {}
    }
    setLoading(false);
  }

  const openOrdersCount = allOrders.filter(os => os.status === 'Pending' || os.status === 'In Route' || os.status === 'Executing').length;
  const maintenanceDoneCount = allOrders.filter(os => os.status === 'Maintenance Done').length;
  const totalReceivable = allOrders
    .filter(os => os.status === 'Maintenance Done' && !os.is_paid)
    .reduce((sum, os) => sum + (Number(os.work_hours || 0) * hourlyRate) + Number(os.total_value || 0), 0);

  const isAdmin = profile?.role?.toString().toLowerCase().trim() === 'admin';

  return (
    <div className="space-y-5 md:space-y-8 animate-in fade-in duration-700">
      <header>
        <h2 className="text-2xl md:text-3xl font-black italic tracking-tighter text-white">DASHBOARD</h2>
        <p className="text-[#c5c9ac] font-['JetBrains_Mono'] text-[10px] md:text-xs uppercase tracking-widest">Controle operacional de frota</p>
      </header>

      {/* Stats Cards — 2 colunas em mobile, 4 em desktop */}
      <div className={clsx(
        "grid gap-3 md:gap-6",
        isAdmin
          ? "grid-cols-2 md:grid-cols-2 lg:grid-cols-4"
          : "grid-cols-2 md:grid-cols-3"
      )}>
        <StatCard 
          label="OS ABERTAS" 
          value={`${openOrdersCount}`} 
          subtext="Pend / Rota / Exec"
          icon={ClipboardList}
          color="text-[#ffbf00]"
          onClick={() => navigate('/os')}
        />
        <StatCard 
          label="EM MANUTENÇÃO" 
          value={`${machinesInMaintenance}`} 
          subtext="Equipamentos inativos"
          icon={AlertTriangle}
          color="text-[#ffb4ab]"
          onClick={() => navigate('/machines')}
        />
        <StatCard 
          label="CONCLUÍDAS" 
          value={`${maintenanceDoneCount}`} 
          subtext="Serviços finalizados"
          icon={Wrench}
          color="text-[#00c853]"
        />
        {isAdmin && (
          <StatCard 
            label="A RECEBER" 
            value={`R$${totalReceivable.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`} 
            subtext="Não recebidos"
            icon={TrendingUp}
            color="text-[#caf300]"
            onClick={() => navigate('/finance')}
          />
        )}
      </div>

      {/* Recent Orders */}
      <div className="bg-[#1e2020] border border-[#444932] rounded-2xl shadow-xl overflow-hidden">
        <div className="p-4 md:p-6 border-b border-[#444932] bg-[#282a2b] flex justify-between items-center">
          <h3 className="font-bold text-[10px] md:text-xs tracking-widest uppercase font-['JetBrains_Mono']">REGISTROS RECENTES</h3>
          <button 
            onClick={() => navigate('/os')}
            className="text-[10px] font-bold text-[#caf300] tracking-widest uppercase hover:brightness-110"
          >
            VER TODOS →
          </button>
        </div>
        <div className="divide-y divide-[#444932]/30">
          {recentOs.length > 0 ? recentOs.map((os) => (
            <div key={os.id} className="p-3 md:p-4 hover:bg-[#333535] transition-all cursor-pointer group" onClick={() => navigate('/os')}>
              <div className="flex justify-between items-start mb-1">
                <span className="text-[#caf300] font-bold text-[9px] md:text-[10px]">#{os.id.slice(0, 8)}</span>
                <span className="text-[8px] md:text-[9px] text-[#c5c9ac]">{format(new Date(os.created_at), 'dd/MM HH:mm')}</span>
              </div>
              <h4 className="text-xs md:text-sm font-bold text-white mb-1.5 md:mb-2 uppercase truncate">{os.title}</h4>
              <div className="flex items-center justify-between">
                <span className={clsx(
                  "px-1.5 py-0.5 text-[7px] md:text-[8px] font-bold tracking-widest uppercase rounded",
                  os.status === 'Executing' ? 'bg-[#caf300] text-[#121414]' : 
                  os.status === 'Pending' ? 'bg-[#ffbf00] text-[#121414]' : 
                  os.status === 'Maintenance Done' ? 'bg-[#00c853] text-[#121414]' : 
                  os.status === 'Cancelled' ? 'bg-[#ffb4ab] text-[#690005]' :
                  'bg-[#333535] text-[#c5c9ac]'
                )}>
                  {os.status === 'Executing' ? 'EXECUTANDO' : 
                   os.status === 'Pending' ? 'PENDENTE' : 
                   os.status === 'Maintenance Done' ? 'CONCLUÍDA' :
                   os.status === 'Cancelled' ? 'CANCELADA' :
                   os.status === 'In Route' ? 'EM ROTA' : os.status}
                </span>
                <ArrowUpRight size={12} className="text-[#c5c9ac] group-hover:text-[#caf300] transition-colors" />
              </div>
            </div>
          )) : (
            <div className="p-8 md:p-10 text-center space-y-3 opacity-50">
              <Clock size={28} className="mx-auto" />
              <p className="text-[10px] font-bold uppercase tracking-widest">Sem atividades recentes</p>
            </div>
          )}
        </div>
      </div>

      <ServiceOrderModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSuccess={fetchDashboardData}
      />
    </div>
  );
}

function StatCard({ label, value, subtext, icon: Icon, color, onClick }: any) {
  return (
    <div 
      onClick={onClick}
      className={clsx(
        "bg-[#1e2020] border border-[#444932] p-4 md:p-6 relative overflow-hidden group rounded-2xl shadow-lg transition-all",
        onClick ? "cursor-pointer hover:border-[#caf300]/50 active:scale-[0.98]" : "hover:border-[#caf300]/30"
      )}
    >
      <div className="absolute top-0 right-0 w-20 h-20 bg-[#caf300]/5 -mr-6 -mt-6 rounded-full blur-2xl group-hover:bg-[#caf300]/10 transition-all"></div>
      <div className="flex justify-between items-start z-10 relative">
        <span className={clsx("text-[8px] md:text-[10px] font-bold tracking-widest font-['JetBrains_Mono'] leading-tight", color)}>{label}</span>
        <Icon className={clsx(color, "shrink-0")} size={14} />
      </div>
      <div className="mt-4 md:mt-8 z-10 relative">
        <p className={clsx("text-xl md:text-2xl font-black italic tracking-tighter", color)}>{value}</p>
        <p className="text-[8px] md:text-[10px] text-[#c5c9ac] font-bold tracking-tight mt-0.5 md:mt-1 leading-tight">{subtext}</p>
      </div>
    </div>
  );
}

// forced sync
