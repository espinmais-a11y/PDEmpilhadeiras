import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Machine, Customer, ForkliftRental, RentalStatus } from '../types';
import { Calendar, DollarSign, Plus, Search, Trash2, Forklift, Info, Loader2, X, Edit3, Clipboard, TrendingUp, CheckCircle2, AlertCircle } from 'lucide-react';
import { clsx } from 'clsx';

export function Rentals() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'Admin' || profile?.role === 'admin';

  const [rentals, setRentals] = useState<ForkliftRental[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Form State
  const [formData, setFormData] = useState({
    machine_id: '',
    customer_id: '',
    start_date: '',
    end_date: '',
    monthly_value: 0,
    status: 'Active' as RentalStatus,
    contract_number: '',
    notes: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      setLoading(true);
      setError(null);
      
      const [rentalsRes, machinesRes, customersRes] = await Promise.all([
        supabase.from('rentals').select('*').order('created_at', { ascending: false }),
        supabase.from('machines').select('*'),
        supabase.from('customers').select('*').order('name')
      ]);

      if (rentalsRes.error && rentalsRes.error.message?.includes('not found')) {
        // Se a coleção rentals não existe no firestore ainda, criamos vazio para não quebrar
         setRentals([]);
      } else if (rentalsRes.data) {
         setRentals(rentalsRes.data as ForkliftRental[]);
      }

      if (machinesRes.data) setMachines(machinesRes.data as Machine[]);
      if (customersRes.data) setCustomers(customersRes.data as Customer[]);
    } catch (err: any) {
      console.error('[Rentals] Error loading data:', err);
      setError('Erro ao carregar dados de locações.');
    } finally {
      setLoading(false);
    }
  }

  // Filter only own fleet forklifts for rental select box
  const ownMachines = machines.filter(m => {
    const owner = customers.find(c => c.id === m.customer_id);
    return m.customer_id === 'c-pd' || owner?.name?.toUpperCase().includes('PD EMPILHADEIRAS');
  });

  const handleEdit = (rental: ForkliftRental) => {
    setEditingId(rental.id);
    setFormData({
      machine_id: rental.machine_id,
      customer_id: rental.customer_id,
      start_date: rental.start_date.split('T')[0],
      end_date: rental.end_date.split('T')[0],
      monthly_value: rental.monthly_value,
      status: rental.status,
      contract_number: rental.contract_number || '',
      notes: rental.notes || ''
    });
    setError(null);
    setShowModal(true);
  };

  const handleNew = () => {
    setEditingId(null);
    setFormData({
      machine_id: '',
      customer_id: '',
      start_date: new Date().toISOString().split('T')[0],
      end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // +30 days
      monthly_value: 1500,
      status: 'Active',
      contract_number: `CON-${Math.floor(1000 + Math.random() * 9000)}`,
      notes: ''
    });
    setError(null);
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!isAdmin) {
      alert('Apenas administradores podem excluir contratos de locação.');
      return;
    }
    if (!window.confirm('Tem certeza que deseja excluir esta locação permanente do histórico?')) {
      return;
    }

    try {
      setLoading(true);
      const { error: delError } = await supabase.from('rentals').delete().eq('id', id);
      if (delError) throw delError;
      fetchData();
    } catch (err: any) {
      console.error('[Rentals] Delete error:', err);
      setError('Erro ao deletar contrato de locação.');
      setLoading(false);
    }
  };

  const handleQuickStatusChange = async (rental: ForkliftRental, newStatus: RentalStatus) => {
    try {
      setLoading(true);
      const { error: updateError } = await supabase
        .from('rentals')
        .update({ status: newStatus })
        .eq('id', rental.id);

      if (updateError) throw updateError;
      fetchData();
    } catch (err: any) {
      console.error('[Rentals] status change error:', err);
      setError('Erro ao atualizar status do contrato.');
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!formData.machine_id || !formData.customer_id) {
      setError('Selecione uma máquina de frota própria e um cliente solicitante.');
      setLoading(false);
      return;
    }

    try {
      if (editingId) {
        const { error: updateError } = await supabase
          .from('rentals')
          .update(formData)
          .eq('id', editingId);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase.from('rentals').insert([formData]);
        if (insertError) throw insertError;
      }

      setShowModal(false);
      setEditingId(null);
      fetchData();
    } catch (err: any) {
      console.error('[Rentals] Save error:', err);
      setError('Erro ao salvar contrato de locação. Verifique os dados inseridos.');
      setLoading(false);
    }
  };

  // Metrics calculating
  const activeRentals = rentals.filter(r => r.status === 'Active');
  const monthlyRevenue = activeRentals.reduce((acc, curr) => acc + (curr.monthly_value || 0), 0);
  
  // Rented machines count (machines of own fleet that are in an Active rental)
  const activeRentedMachineIds = activeRentals.map(r => r.machine_id);
  const totalOwnMachinesCount = ownMachines.length;
  const rentedOwnMachinesCount = ownMachines.filter(m => activeRentedMachineIds.includes(m.id)).length;
  const availableOwnMachinesCount = Math.max(0, totalOwnMachinesCount - rentedOwnMachinesCount);

  // Filter rentals matches
  const filteredRentals = rentals.filter(rental => {
    const machine = machines.find(m => m.id === rental.machine_id);
    const customer = customers.find(c => c.id === rental.customer_id);
    
    // Status filter
    if (statusFilter !== 'ALL' && rental.status !== statusFilter) {
      return false;
    }

    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const clientName = customer?.name.toLowerCase() || '';
      const machineName = machine ? `${machine.brand} ${machine.model}`.toLowerCase() : '';
      const sn = machine?.serial_number.toLowerCase() || '';
      const docNum = (rental.contract_number || '').toLowerCase();
      
      return (
        clientName.includes(q) ||
        machineName.includes(q) ||
        sn.includes(q) ||
        docNum.includes(q)
      );
    }

    return true;
  });

  const getStatusBadge = (status: RentalStatus) => {
    switch (status) {
      case 'Active':
        return (
          <span className="text-[10px] font-black tracking-widest px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5 w-fit">
            <CheckCircle2 size={12} /> ATIVO
          </span>
        );
      case 'Completed':
        return (
          <span className="text-[10px] font-black tracking-widest px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center gap-1.5 w-fit">
            ✓ FINALIZADO
          </span>
        );
      case 'Pending':
        return (
          <span className="text-[10px] font-black tracking-widest px-2.5 py-1 rounded-lg bg-yellow-500/10 text-yellow-500 border border-yellow-500/30 flex items-center gap-1.5 w-fit animate-pulse">
            ⏱ PENDENTE
          </span>
        );
      case 'Cancelled':
        return (
          <span className="text-[10px] font-black tracking-widest px-2.5 py-1 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 flex items-center gap-1.5 w-fit">
            ✕ CANCELADO
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-500">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black italic tracking-tighter text-white uppercase flex items-center gap-2">
            <Clipboard className="text-[#caf300]" size={28} /> Locações de Frota
          </h2>
          <p className="text-[#c5c9ac] font-['JetBrains_Mono'] text-xs uppercase tracking-widest">Controle de contratos, faturamento de aluguel e vigência de prazos</p>
        </div>
        
        <button 
          onClick={handleNew}
          className="bg-[#caf300] text-[#121414] px-6 py-3 font-black text-xs tracking-widest flex items-center gap-2 hover:brightness-110 shadow-lg rounded-xl"
        >
          <Plus size={16} /> REGISTRAR NOVA LOCAÇÃO
        </button>
      </div>

      {/* Metrics Banner */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-[#1e2020] border border-[#444932] p-5 rounded-2xl flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl flex items-center justify-center">
            <TrendingUp size={24} />
          </div>
          <div>
            <p className="text-[9px] text-[#8f9378] font-black tracking-widest uppercase">Faturamento Mensal</p>
            <p className="text-xl font-bold font-['JetBrains_Mono'] text-white">
              S$ {monthlyRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        <div className="bg-[#1e2020] border border-[#444932] p-5 rounded-2xl flex items-center gap-4">
          <div className="w-12 h-12 bg-[#caf300]/10 text-[#caf300] border border-[#caf300]/20 rounded-xl flex items-center justify-center">
            <Clipboard size={24} />
          </div>
          <div>
            <p className="text-[9px] text-[#8f9378] font-black tracking-widest uppercase">Contratos Ativos</p>
            <p className="text-xl font-bold font-['JetBrains_Mono'] text-white">
              {activeRentals.length} Locações
            </p>
          </div>
        </div>

        <div className="bg-[#1e2020] border border-[#444932] p-5 rounded-2xl flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-xl flex items-center justify-center">
            <Forklift size={24} />
          </div>
          <div>
            <p className="text-[9px] text-[#8f9378] font-black tracking-widest uppercase">Frota Própria Alugada</p>
            <p className="text-xl font-bold font-['JetBrains_Mono'] text-white">
              {rentedOwnMachinesCount} / {totalOwnMachinesCount} Máquinas
            </p>
          </div>
        </div>

        <div className="bg-[#1e2020] border border-[#444932] p-5 rounded-2xl flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-500/10 text-amber-400 border border-[#444932] rounded-xl flex items-center justify-center">
            <Forklift size={24} className="opacity-70" />
          </div>
          <div>
            <p className="text-[9px] text-[#8f9378] font-black tracking-widest uppercase">Disponíveis p/ Aluguel</p>
            <p className="text-xl font-bold font-['JetBrains_Mono'] text-[#caf300]">
              {availableOwnMachinesCount} Máquinas
            </p>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col lg:flex-row gap-4 bg-[#1e2020] border border-[#444932] p-4 rounded-2xl select-none">
        
        {/* Search */}
        <div className="flex-1 flex items-center bg-[#0c0f0f] border border-[#444932] rounded-xl px-4 py-2.5">
          <Search size={16} className="text-[#c5c9ac] mr-2" />
          <input
            type="text"
            placeholder="BUSCAR LOCAÇÃO POR CLIENTE, EQUIPAMENTO, S/N OU NÚMERO DO CONTRATO..."
            className="bg-transparent border-none focus:ring-0 text-xs font-bold font-['JetBrains_Mono'] text-[#e2e2e2] w-full placeholder-[#c5c9ac]/30 outline-none"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="text-[#c5c9ac] hover:text-white transition-colors">
              <X size={16} />
            </button>
          )}
        </div>

        {/* Status Filters */}
        <div className="flex gap-2 overflow-x-auto pb-1 lg:pb-0">
          {['ALL', 'Active', 'Pending', 'Completed', 'Cancelled'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={clsx(
                "px-4 py-2 rounded-xl text-[10px] font-black tracking-wider uppercase transition-all duration-200 whitespace-nowrap",
                statusFilter === status 
                  ? "bg-[#caf300] text-[#121414] font-black"
                  : "bg-[#121414] text-[#c5c9ac] hover:bg-[#333535] hover:text-[#caf300]"
              )}
            >
              {status === 'ALL' ? 'Todos' : 
               status === 'Active' ? 'Ativos' : 
               status === 'Pending' ? 'Pendentes' : 
               status === 'Completed' ? 'Finalizados' : 'Cancelados'}
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid / Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredRentals.map((rental) => {
          const machine = machines.find(m => m.id === rental.machine_id);
          const customer = customers.find(c => c.id === rental.customer_id);

          const daysRemaining = (() => {
            const end = new Date(rental.end_date);
            const now = new Date();
            const diffTime = end.getTime() - now.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            return diffDays;
          })();

          return (
            <div 
              key={rental.id}
              className="bg-[#1e2020] border border-[#444932] p-6 rounded-2xl flex flex-col justify-between hover:border-[#caf300]/40 transition-all shadow-xl gap-6 relative"
            >
              {/* Top part */}
              <div className="space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-[10px] font-bold font-['JetBrains_Mono'] text-[#caf300] uppercase tracking-widest">
                      Contrato: {rental.contract_number || 'S/Nº'}
                    </p>
                    <h3 className="text-lg font-black italic text-white uppercase tracking-tighter mt-1">
                      {customer?.name || 'Cliente Desconhecido'}
                    </h3>
                  </div>
                  {getStatusBadge(rental.status)}
                </div>

                <div className="bg-[#0c0f0f] border border-[#444932] p-4 rounded-xl flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#caf300]/10 rounded-lg flex items-center justify-center text-[#caf300] flex-shrink-0">
                    <Forklift size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[9px] text-[#8f9378] font-bold uppercase">Empilhadeira Alugada (Frota Própria)</p>
                    <p className="text-sm font-black text-white italic uppercase truncate mt-0.5">
                      {machine ? `${machine.brand} ${machine.model}` : 'Equipamento não identificado'}
                    </p>
                    <p className="text-[9px] font-bold font-['JetBrains_Mono'] text-[#c5c9ac] tracking-widest mt-0.5">
                      S/N: {machine?.serial_number || '---'} | Horímetro: {machine?.current_hour_meter || 0}h
                    </p>
                  </div>
                </div>

                {/* Dates & Values */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <h5 className="text-[9px] text-[#8f9378] font-black uppercase">Data Início</h5>
                    <p className="text-xs font-bold font-['JetBrains_Mono'] text-white mt-1">
                      {new Date(rental.start_date).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <div>
                    <h5 className="text-[9px] text-[#8f9378] font-black uppercase">Vencimento Contrato</h5>
                    <p className="text-xs font-bold font-['JetBrains_Mono'] text-white mt-1">
                      {new Date(rental.end_date).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <div className="col-span-2 md:col-span-1">
                    <h5 className="text-[9px] text-[#8f9378] font-black uppercase">Valor de Aluguel</h5>
                    <p className="text-sm font-black font-['JetBrains_Mono'] text-[#caf300] mt-0.5">
                      R$ {rental.monthly_value?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} <span className="text-[8px] font-bold text-[#c5c9ac]">/mês</span>
                    </p>
                  </div>
                </div>

                {/* Notes */}
                {rental.notes && (
                  <div className="text-[11px] text-[#c5c9ac] italic bg-[#121414]/50 p-2.5 rounded-lg border border-[#444932]/50">
                    "{rental.notes}"
                  </div>
                )}
              </div>

              {/* Bottom Actions Bar */}
              <div className="pt-4 border-t border-[#444932] flex flex-wrap justify-between items-center gap-3">
                
                {/* Remaining alert */}
                <div>
                  {rental.status === 'Active' && (
                    daysRemaining <= 0 ? (
                      <span className="text-[9px] font-black bg-red-500/10 text-red-400 border border-red-500/30 px-2 py-1 rounded flex items-center gap-1">
                        <AlertCircle size={10} /> EXPINOU HÁ {Math.abs(daysRemaining)} DIAS
                      </span>
                    ) : daysRemaining <= 15 ? (
                      <span className="text-[9px] font-black bg-yellow-500/10 text-yellow-500 border border-yellow-500/30 px-2 py-1 rounded flex items-center gap-1 animate-pulse">
                        <AlertCircle size={10} /> VENCE EM {daysRemaining} DIAS
                      </span>
                    ) : (
                      <span className="text-[9px] font-bold text-[#c5c9ac] flex items-center gap-1 font-['JetBrains_Mono']">
                        Vigente por mais {daysRemaining} dias
                      </span>
                    )
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2">
                  {rental.status === 'Active' && (
                    <button
                      onClick={() => handleQuickStatusChange(rental, 'Completed')}
                      className="px-3 py-1.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500 hover:text-white rounded-lg text-[9px] font-black tracking-widest transition-all uppercase"
                      title="Marcar contrato como finalizado com entrega do equipamento"
                    >
                      ENCERRAR
                    </button>
                  )}
                  
                  <button
                    onClick={() => handleEdit(rental)}
                    className="p-2 border border-[#444932] text-[#c5c9ac] hover:text-[#caf300] hover:border-[#caf300]/40 rounded-lg transition-all"
                    title="Editar Contrato"
                  >
                    <Edit3 size={14} />
                  </button>

                  {isAdmin && (
                    <button
                      onClick={() => handleDelete(rental.id)}
                      className="p-2 border border-[#444932] text-red-400 hover:bg-[#ffb4ab]/10 hover:border-red-400/50 rounded-lg transition-all"
                      title="Excluir Registro"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {filteredRentals.length === 0 && !loading && (
          <div className="col-span-full py-20 text-center border-2 border-dashed border-[#444932] opacity-30 rounded-3xl">
             <Clipboard size={48} className="mx-auto mb-4 text-[#caf300]" />
             <p className="text-sm font-semibold uppercase tracking-widest">Nenhuma locação encontrada correspondendo aos filtros</p>
          </div>
        )}
      </div>

      {/* Modal Cadastro/Edição de Locação */}
      {showModal && (
        <div className="fixed inset-0 bg-[#0c0f0f]/90 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#1e2020] border border-[#444932] w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            
            <div className="p-6 border-b border-[#444932] bg-[#282a2b] flex justify-between items-center text-[#caf300]">
              <h3 className="font-black italic tracking-tighter uppercase text-xl">
                {editingId ? 'Editar Contrato de Locação' : 'Novo Contrato de Locação'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-[#c5c9ac] hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-8 space-y-5 max-h-[75vh] overflow-y-auto">
              {error && (
                <div className="bg-red-500/10 border border-red-500/50 p-4 rounded-xl text-red-500 text-xs font-bold uppercase tracking-widest">
                  {error}
                </div>
              )}

              <div className="space-y-4">
                
                {/* Contract Number */}
                <Field label="Número do Contrato" required>
                  <input
                    required
                    className="auth-input rounded-xl font-['JetBrains_Mono'] uppercase"
                    value={formData.contract_number}
                    onChange={(e) => setFormData({ ...formData, contract_number: e.target.value.toUpperCase() })}
                    placeholder="CON-0001"
                  />
                </Field>

                {/* Customer */}
                <Field label="Cliente Locatário" required>
                  <select
                    required
                    className="auth-input rounded-xl"
                    value={formData.customer_id}
                    onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                  >
                    <option value="">SELECIONAR COM QUAL CLIENTE FECHAR...</option>
                    {/* Não permitir alugar para nós mesmos */}
                    {customers.filter(c => c.id !== 'c-pd').map((c) => (
                      <option key={c.id} value={c.id}>{c.name} ({maskTaxId(c.tax_id)})</option>
                    ))}
                  </select>
                </Field>

                {/* Forklift owned by PD */}
                <Field label="Selecione a Empilhadeira (Frota Própria)" required>
                  <select
                    required
                    className="auth-input rounded-xl"
                    value={formData.machine_id}
                    onChange={(e) => setFormData({ ...formData, machine_id: e.target.value })}
                  >
                    <option value="">SELECIONAR ATIVO DA FROTA DISPONÍVEL...</option>
                    {ownMachines.map((m) => {
                      // Check if already on another active rent! (excluding current editing)
                      const isAlreadyRented = activeRentals.some(r => r.machine_id === m.id && r.id !== editingId);
                      return (
                        <option 
                          key={m.id} 
                          value={m.id}
                          disabled={isAlreadyRented}
                        >
                          {m.brand} {m.model} | S/N: {m.serial_number} {isAlreadyRented ? ' (JÁ LOCADA EM OUTRO CONTRATO)' : ''}
                        </option>
                      );
                    })}
                  </select>
                </Field>

                {/* Dates */}
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Data Início Contrato" required>
                    <input
                      type="date"
                      required
                      className="auth-input rounded-xl text-center font-['JetBrains_Mono']"
                      value={formData.start_date}
                      onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    />
                  </Field>
                  <Field label="Data Fim / Vencimento" required>
                    <input
                      type="date"
                      required
                      className="auth-input rounded-xl text-center font-['JetBrains_Mono']"
                      value={formData.end_date}
                      onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    />
                  </Field>
                </div>

                {/* Rental Cost & Status */}
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Aluguel Mensal (R$)" required>
                    <input
                      type="number"
                      required
                      min="0"
                      step="1"
                      className="auth-input rounded-xl font-['JetBrains_Mono']"
                      value={formData.monthly_value || ''}
                      onChange={(e) => setFormData({ ...formData, monthly_value: Number(e.target.value) })}
                    />
                  </Field>
                  
                  <Field label="Status do Contrato" required>
                    <select
                      className="auth-input rounded-xl"
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as RentalStatus })}
                    >
                      <option value="Active">ATIVO / EM VIGÊNCIA</option>
                      <option value="Pending">PENDENTE / ASSINATURA</option>
                      <option value="Completed">ENCERRADO / FINALIZADO</option>
                      <option value="Cancelled">CANCELADO</option>
                    </select>
                  </Field>
                </div>

                {/* notes */}
                <Field label="Notas e Informações Adicionais">
                  <textarea
                    rows={2}
                    className="auth-input rounded-xl text-xs"
                    placeholder="Condições de manutenção de mastro, pneus, limites de horas, etc."
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  />
                </Field>
              </div>

              <div className="pt-6 flex gap-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-3.5 border border-[#444932] text-[#c5c9ac] font-bold text-xs tracking-widest rounded-xl hover:bg-[#333535] transition-all"
                >
                  CANCELAR
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-3.5 bg-[#caf300] text-[#121414] font-bold text-xs tracking-widest rounded-xl hover:brightness-110 shadow-lg flex items-center justify-center gap-2 transition-all"
                >
                  {loading ? <Loader2 className="animate-spin" /> : 'DEFINIR CONTRATO'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Reuse helper mask UI functions safely
function maskTaxId(v: string) {
  if (!v) return '---';
  v = v.replace(/\D/g, "");
  if (v.length <= 11) {
    return v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/g, "$1.$2.$3-$4");
  } else {
    return v.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/g, "$1.$2.$3/$4-$5");
  }
}

function Field({ label, children, required, className = '' }: any) {
  return (
    <div className={clsx("space-y-1.5", className)}>
      <label className="text-[10px] font-bold text-[#8f9378] tracking-widest uppercase flex items-center gap-1">
        {label}
        {required && <span className="text-red-400">*</span>}
      </label>
      {children}
    </div>
  );
}
