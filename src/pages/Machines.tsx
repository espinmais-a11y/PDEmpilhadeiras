import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Machine, Customer, EnergyType, MastType, Brand, Model, BatteryType, ChargerType } from '../types';
import { Forklift, Search, Plus, Filter, Gauge, Info, Loader2, X, ChevronRight, Activity, Wrench } from 'lucide-react';
import { clsx } from 'clsx';

export function Machines() {
  const { profile } = useAuth();
  const [machines, setMachines] = useState<Machine[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [batteryTypes, setBatteryTypes] = useState<BatteryType[]>([]);
  const [chargerTypes, setChargerTypes] = useState<ChargerType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showAddBrandModal, setShowAddBrandModal] = useState(false);
  const [showAddModelModal, setShowAddModelModal] = useState(false);
  const [showAddBatteryModal, setShowAddBatteryModal] = useState(false);
  const [showAddChargerModal, setShowAddChargerModal] = useState(false);
  const [newBrandName, setNewBrandName] = useState('');
  const [newModelName, setNewModelName] = useState('');
  const [newBatteryName, setNewBatteryName] = useState('');
  const [newChargerName, setNewChargerName] = useState('');
  const [selectedBrandForModel, setSelectedBrandForModel] = useState('');

  const [formData, setFormData] = useState({
    customer_id: '',
    brand: '',
    model: '',
    serial_number: '',
    internal_id: '',
    mfg_year: new Date().getFullYear(),
    energy_type: 'GLP' as EnergyType,
    battery_model: '',
    charger_model: '',
    load_capacity_tons: 2.5,
    mast_type: 'Triplex' as MastType,
    max_elevation_meters: 4.5,
    current_hour_meter: 0,
    daily_usage_avg_hours: 0,
    status: 'Operational'
  });

  const [selectedMachineForDetails, setSelectedMachineForDetails] = useState<Machine | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    const [machinesRes, customersRes, brandsRes, modelsRes, batteryRes, chargerRes] = await Promise.all([
      supabase.from('machines').select('*').order('created_at', { ascending: false }),
      supabase.from('customers').select('id, name').order('name'),
      supabase.from('brands').select('*').order('name'),
      supabase.from('models').select('*').order('name'),
      supabase.from('battery_types').select('*').order('name'),
      supabase.from('charger_types').select('*').order('name')
    ]);
    
    if (machinesRes.data) setMachines(machinesRes.data as Machine[]);
    if (customersRes.data) setCustomers(customersRes.data as Customer[]);
    if (brandsRes.data) setBrands(brandsRes.data as Brand[]);
    if (modelsRes.data) setModels(modelsRes.data as Model[]);
    if (batteryRes.data) setBatteryTypes(batteryRes.data as BatteryType[]);
    if (chargerRes.data) setChargerTypes(chargerRes.data as ChargerType[]);
    setLoading(false);
  }

  const handleAddBrand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBrandName) return;
    const name = newBrandName.toUpperCase().trim();
    const { error } = await supabase.from('brands').insert([{ name }]);
    if (error) {
      alert('Erro ao adicionar marca: ' + error.message);
    } else {
      setNewBrandName('');
      setShowAddBrandModal(false);
      fetchData();
    }
  };

  const handleAddModel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newModelName || !selectedBrandForModel) return;
    const name = newModelName.toUpperCase().trim();
    const { error } = await supabase.from('models').insert([{ 
      name,
      brand_id: selectedBrandForModel
    }]);
    if (error) {
      alert('Erro ao adicionar modelo: ' + error.message);
    } else {
      setNewModelName('');
      setShowAddModelModal(false);
      fetchData();
    }
  };

  const handleAddBattery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBatteryName) return;
    const name = newBatteryName.toUpperCase().trim();
    const { error } = await supabase.from('battery_types').insert([{ name }]);
    if (error) {
      alert('Erro ao adicionar bateria: ' + error.message);
    } else {
      setNewBatteryName('');
      setShowAddBatteryModal(false);
      fetchData();
    }
  };

  const handleAddCharger = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChargerName) return;
    const name = newChargerName.toUpperCase().trim();
    const { error } = await supabase.from('charger_types').insert([{ name }]);
    if (error) {
      alert('Erro ao adicionar carregador: ' + error.message);
    } else {
      setNewChargerName('');
      setShowAddChargerModal(false);
      fetchData();
    }
  };

  const handleEdit = (machine: Machine) => {
    if (profile?.role !== 'Admin' && profile?.role !== 'admin') return;
    setEditingId(machine.id);
    setFormData({
      customer_id: machine.customer_id,
      brand: machine.brand,
      model: machine.model,
      serial_number: machine.serial_number,
      internal_id: machine.internal_id || '',
      mfg_year: machine.mfg_year || new Date().getFullYear(),
      energy_type: machine.energy_type as EnergyType,
      battery_model: (machine as any).battery_model || '',
      charger_model: (machine as any).charger_model || '',
      load_capacity_tons: machine.load_capacity_tons || 2.5,
      mast_type: machine.mast_type as MastType,
      max_elevation_meters: (machine as any).max_elevation_meters || 4.5,
      current_hour_meter: machine.current_hour_meter || 0,
      daily_usage_avg_hours: (machine as any).daily_usage_avg_hours || 0,
      status: machine.status || 'Operational'
    });
    setShowModal(true);
    setSelectedMachineForDetails(null);
  };

  const handleNew = () => {
    setEditingId(null);
    setFormData({
      customer_id: '',
      brand: '',
      model: '',
      serial_number: '',
      internal_id: '',
      mfg_year: new Date().getFullYear(),
      energy_type: 'GLP',
      battery_model: '',
      charger_model: '',
      load_capacity_tons: 2.5,
      mast_type: 'Triplex',
      max_elevation_meters: 4.5,
      current_hour_meter: 0,
      daily_usage_avg_hours: 0,
      status: 'Operational'
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    console.log('[Machines] Submitting form:', { editingId, formData });

    try {
      if (editingId) {
        const { error: updateError } = await supabase
          .from('machines')
          .update(formData)
          .eq('id', editingId);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase.from('machines').insert([formData]);
        if (insertError) throw insertError;
      }
      
      console.log('[Machines] Success!');
      setShowModal(false);
      setEditingId(null);
      fetchData();
      setFormData({
        customer_id: '',
        brand: '',
        model: '',
        serial_number: '',
        internal_id: '',
        mfg_year: new Date().getFullYear(),
        energy_type: 'GLP',
        battery_model: '',
        charger_model: '',
        load_capacity_tons: 2.5,
        mast_type: 'Triplex',
        max_elevation_meters: 4.5,
        current_hour_meter: 0,
        daily_usage_avg_hours: 0,
        status: 'Operational'
      });
    } catch (err: any) {
      console.error('[Machines] Persistence error:', err);
      let userFriendyMessage = 'Erro ao salvar equipamento. Por favor, tente novamente.';
      
      const errorMessage = err.message || '';
      if (errorMessage.includes('machines_serial_number_key')) {
        userFriendyMessage = 'Este número de série já está cadastrado em outro equipamento.';
      } else if (errorMessage.includes('duplicate key value')) {
        userFriendyMessage = 'Já existe um registro com estas informações.';
      }
      
      setError(userFriendyMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black italic tracking-tighter text-white uppercase">Parque de Máquinas</h2>
          <p className="text-[#c5c9ac] font-['JetBrains_Mono'] text-xs uppercase tracking-widest">Controle técnico e histórico de ativos</p>
        </div>
        
        <button 
          onClick={handleNew}
          className="bg-[#caf300] text-[#121414] px-6 py-3 font-black text-xs tracking-widest flex items-center gap-2 hover:brightness-110 shadow-lg rounded-xl"
        >
          <Plus size={16} /> REGISTRAR EMPILHADEIRA
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {machines.map((machine) => (
          <div 
            key={machine.id} 
            className={clsx(
              "bg-[#1e2020] border rounded-2xl overflow-hidden shadow-xl hover:border-[#caf300]/50 transition-all p-6 space-y-6 group relative",
              machine.status === 'Maintenance' ? 'border-orange-500/50 bg-orange-500/5' : 'border-[#444932]'
            )}
          >
             {machine.status === 'Maintenance' && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-orange-500 text-[#121414] px-4 py-1 rounded-b-lg text-[8px] font-black tracking-[0.2em] flex items-center gap-1 shadow-lg">
                   <Wrench size={10} /> EM MANUTENÇÃO
                </div>
             )}
             <div className="flex justify-between items-start">
               <div className="w-12 h-12 bg-[#caf300]/10 rounded-2xl flex items-center justify-center text-[#caf300] border border-[#caf300]/20">
                 <Forklift size={24} />
               </div>
               {machine.status !== 'Maintenance' && (
                 <span className={clsx(
                   "text-[9px] font-black tracking-widest px-2 py-1 rounded-lg border flex items-center gap-1",
                   machine.status === 'Operational' ? 'bg-[#caf300]/10 text-[#caf300] border-[#caf300]/30' : 
                   'bg-[#93000a]/10 text-[#ffb4ab] border-[#ffb4ab]/30'
                 )}>
                   {machine.status === 'Operational' ? 'OPERACIONAL' : 'FORA DE SERVIÇO'}
                 </span>
               )}
             </div>

             <div>
               <div className="flex justify-between items-start mb-1">
                 <h3 className="text-xl font-black italic text-white tracking-tighter uppercase leading-none">{machine.brand} {machine.model}</h3>
                 <span className="text-[9px] font-bold text-blue-400 px-2 py-1 bg-blue-400/10 border border-blue-400/20 rounded-lg tracking-widest uppercase whitespace-nowrap">
                   {customers.find(c => c.id === machine.customer_id)?.name.split(' ')[0] || '---'}
                 </span>
               </div>
               <p className="text-[10px] font-bold font-['JetBrains_Mono'] text-[#c5c9ac] tracking-widest uppercase">SN: {machine.serial_number}</p>
             </div>

             <div className="grid grid-cols-2 gap-4">
               <div className="bg-[#0c0f0f] border border-[#444932] p-3 rounded-xl">
                 <p className="text-[9px] text-[#8f9378] font-bold mb-1 uppercase">Horímetro</p>
                 <div className="flex items-center gap-2 text-white font-['JetBrains_Mono'] font-bold">
                    <Gauge size={14} className="text-[#caf300]" />
                    {machine.current_hour_meter}h
                 </div>
               </div>
               <div className="bg-[#0c0f0f] border border-[#444932] p-3 rounded-xl">
                 <p className="text-[9px] text-[#8f9378] font-bold mb-1 uppercase">Capacidade</p>
                 <div className="flex items-center gap-2 text-white font-['JetBrains_Mono'] font-bold">
                    <Activity size={14} className="text-[#00ffff]" />
                    {machine.load_capacity_tons}t
                 </div>
               </div>
             </div>

             <button 
                onClick={() => setSelectedMachineForDetails(machine)}
                className="w-full flex items-center justify-center gap-2 text-[10px] font-bold text-[#c5c9ac] py-3 border border-[#444932] rounded-xl hover:bg-[#333535] hover:text-[#caf300] transition-all tracking-widest uppercase"
             >
                <Info size={14} /> Detalhes Técnicos
             </button>
          </div>
        ))}

        {machines.length === 0 && !loading && (
          <div className="col-span-full py-20 text-center border-2 border-dashed border-[#444932] opacity-30 rounded-2xl">
             <Forklift size={48} className="mx-auto mb-4" />
             <p className="text-sm font-bold uppercase tracking-widest">Nenhum equipamento registrado</p>
          </div>
        )}
      </div>

      {/* Modal Detalhes Técnicos */}
      {selectedMachineForDetails && (
        <div className="fixed inset-0 bg-[#0c0f0f]/90 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
           <div className="bg-[#1e2020] border border-[#444932] w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="p-6 border-b border-[#444932] bg-[#282a2b] flex justify-between items-center text-[#caf300]">
                 <h3 className="font-black italic tracking-tighter uppercase text-xl">Prontuário Técnico</h3>
                 <button onClick={() => setSelectedMachineForDetails(null)} className="text-[#c5c9ac] hover:text-white transition-colors">
                    <X size={20} />
                 </button>
              </div>
              
              <div className="p-8 space-y-8 overflow-y-auto max-h-[80vh]">
                 <div className="flex items-center gap-4 border-b border-[#444932] pb-6">
                    <div className="w-16 h-16 bg-[#caf300] rounded-2xl flex items-center justify-center text-[#121414]">
                       <Forklift size={32} />
                    </div>
                    <div>
                       <h4 className="text-[10px] font-bold text-[#caf300] tracking-widest uppercase">Equipamento</h4>
                       <p className="text-2xl font-black italic text-white uppercase tracking-tighter">
                          {selectedMachineForDetails.brand} {selectedMachineForDetails.model}
                       </p>
                       <p className="text-xs font-mono text-[#c5c9ac]">S/N: {selectedMachineForDetails.serial_number}</p>
                    </div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                    <DetailItem label="Cliente Proprietário" value={customers.find(c => c.id === selectedMachineForDetails.customer_id)?.name || 'NÃO IDENTIFICADO'} />
                    <DetailItem label="ID Interno / Prefixo" value={selectedMachineForDetails.internal_id || 'NÃO DEFINIDO'} />
                    <DetailItem label="Ano de Fabricação" value={selectedMachineForDetails.mfg_year?.toString() || 'NÃO INFORMADO'} />
                    <DetailItem label="Tipo de Energia" value={selectedMachineForDetails.energy_type === 'Eletrica' ? 'ELÉTRICA' : selectedMachineForDetails.energy_type.toUpperCase()} />
                    {selectedMachineForDetails.energy_type === 'Eletrica' && (
                       <>
                          <DetailItem label="Modelo Bateria" value={selectedMachineForDetails.battery_model || 'NÃO INFORMADO'} />
                          <DetailItem label="Modelo Carregador" value={selectedMachineForDetails.charger_model || 'NÃO INFORMADO'} />
                       </>
                    )}
                    <DetailItem label="Capacidade" value={selectedMachineForDetails.load_capacity_tons ? `${selectedMachineForDetails.load_capacity_tons} TONELADAS` : 'NÃO INFORMADO'} />
                    <DetailItem label="Tipo da Torre" value={selectedMachineForDetails.mast_type?.toUpperCase() || 'NÃO INFORMADO'} />
                    <DetailItem label="Elevação Máxima" value={selectedMachineForDetails.max_elevation_meters ? `${selectedMachineForDetails.max_elevation_meters}m` : 'NÃO INFORMADO'} />
                    <DetailItem label="Horímetro Atual" value={`${selectedMachineForDetails.current_hour_meter} HORAS`} />
                    <DetailItem label="Status Operacional" value={
                       selectedMachineForDetails.status === 'Maintenance' ? 'EM MANUTENÇÃO' : 
                       selectedMachineForDetails.status === 'Operational' ? 'OPERACIONAL' : 'FORA DE SERVIÇO'
                    } />
                 </div>

                 <div className="pt-6 space-y-4">
                    {(profile?.role === 'Admin' || profile?.role === 'admin') && (
                       <button 
                         onClick={() => handleEdit(selectedMachineForDetails)}
                         className="w-full py-4 bg-[#caf300] text-[#121414] font-bold text-xs tracking-widest rounded-xl hover:brightness-110 shadow-lg uppercase"
                       >
                         Editar Informações
                       </button>
                    )}
                    <button 
                       onClick={() => setSelectedMachineForDetails(null)}
                       className="w-full py-4 bg-[#333535] text-white font-bold text-xs tracking-widest rounded-xl hover:bg-[#444932] transition-colors uppercase"
                    >
                       Fechar Prontuário
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* Modal Cadastro de Máquina */}
      {showModal && (
        <div className="fixed inset-0 bg-[#0c0f0f]/90 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
           <div className="bg-[#1e2020] border border-[#444932] w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="p-6 border-b border-[#444932] bg-[#282a2b] flex justify-between items-center text-[#caf300]">
                 <h3 className="font-black italic tracking-tighter uppercase text-xl">
                    {editingId ? 'Editar Ativo: Empilhadeira' : 'Novo Ativo: Empilhadeira'}
                 </h3>
                 <button onClick={() => setShowModal(false)} className="text-[#c5c9ac] hover:text-white transition-colors">
                    <X size={20} />
                 </button>
              </div>
              
              <form onSubmit={handleSubmit} className="p-8 h-[70vh] overflow-y-auto space-y-6">
                 {error && (
                   <div className="bg-red-500/10 border border-red-500/50 p-4 rounded-xl text-red-500 text-xs font-bold uppercase tracking-widest">
                     {error}
                   </div>
                 )}
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Field label="Cliente Proprietário" required className="col-span-full">
                       <select 
                         required 
                         className="auth-input rounded-xl"
                         value={formData.customer_id}
                         onChange={e => setFormData({...formData, customer_id: e.target.value})}
                       >
                          <option value="">SELECIONAR CLIENTE...</option>
                          {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                       </select>
                    </Field>
                    
                    <Field label="Marca" required>
                       <div className="flex gap-2">
                        <select 
                          required 
                          className="auth-input rounded-xl"
                          value={formData.brand}
                          onChange={e => {
                            const val = e.target.value;
                            setFormData({...formData, brand: val, model: ''});
                          }}
                        >
                           <option value="">SELECIONAR MARCA...</option>
                           {brands.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
                        </select>
                        {(profile?.role === 'Admin' || profile?.role === 'admin') && (
                          <button 
                            type="button"
                            onClick={() => setShowAddBrandModal(true)}
                            className="bg-[#333535] border border-[#444932] text-[#caf300] p-3 rounded-xl hover:bg-[#444932] transition-all"
                          >
                            <Plus size={20} />
                          </button>
                        )}
                       </div>
                    </Field>
                    
                    <Field label="Modelo" required>
                       <div className="flex gap-2">
                        <select 
                          required 
                          disabled={!formData.brand}
                          className="auth-input rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
                          value={formData.model}
                          onChange={e => setFormData({...formData, model: e.target.value})}
                        >
                           <option value="">{formData.brand ? 'SELECIONAR MODELO...' : 'PRIMEIRO SELECIONE A MARCA'}</option>
                           {models
                             .filter(m => {
                               const brandId = brands.find(b => b.name === formData.brand)?.id;
                               return m.brand_id === brandId;
                             })
                             .map(m => <option key={m.id} value={m.name}>{m.name}</option>)
                           }
                        </select>
                        {(profile?.role === 'Admin' || profile?.role === 'admin') && (
                          <button 
                            type="button"
                            onClick={() => {
                              const brandId = brands.find(b => b.name === formData.brand)?.id;
                              if (brandId) {
                                setSelectedBrandForModel(brandId);
                                setShowAddModelModal(true);
                              } else {
                                alert('Selecione uma marca primeiro.');
                              }
                            }}
                            className="bg-[#333535] border border-[#444932] text-[#caf300] p-3 rounded-xl hover:bg-[#444932] transition-all"
                          >
                            <Plus size={20} />
                          </button>
                        )}
                       </div>
                    </Field>

                    <Field label="Número de Série (Chassi)" required>
                       <input 
                         required 
                         className="auth-input rounded-xl uppercase"
                         value={formData.serial_number}
                         onChange={e => setFormData({...formData, serial_number: e.target.value.toUpperCase()})}
                       />
                    </Field>

                    <Field label="ID Interno / Prefixo">
                       <input 
                         className="auth-input rounded-xl font-['JetBrains_Mono'] uppercase"
                         value={formData.internal_id}
                         onChange={e => setFormData({...formData, internal_id: e.target.value.toUpperCase()})}
                         placeholder="Ex: EMP-01"
                       />
                    </Field>

                    <Field label="Ano de Fabricação">
                       <input 
                         type="number"
                         className="auth-input rounded-xl font-['JetBrains_Mono']"
                         value={formData.mfg_year}
                         onChange={e => setFormData({...formData, mfg_year: Number(e.target.value)})}
                         placeholder={new Date().getFullYear().toString()}
                       />
                    </Field>

                    <div className="col-span-full border-t border-[#444932] pt-6 space-y-4">
                       <h4 className="text-[10px] font-bold text-[#caf300] tracking-widest uppercase">Especificações do Projeto</h4>
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <Field label="Combustão / Energia">
                             <select 
                               className="auth-input rounded-xl"
                               value={formData.energy_type}
                               onChange={e => setFormData({...formData, energy_type: e.target.value as EnergyType})}
                             >
                                <option value="GLP">GLP (GÁS)</option>
                                <option value="Diesel">DIESEL</option>
                                <option value="Eletrica">ELÉTRICA</option>
                              </select>
                           </Field>
                           {formData.energy_type === 'Eletrica' && (
                             <>
                               <Field label="Modelo da Bateria" required>
                                 <div className="flex gap-2">
                                   <select 
                                     required={formData.energy_type === 'Eletrica'}
                                     className="auth-input rounded-xl"
                                     value={formData.battery_model}
                                     onChange={e => setFormData({...formData, battery_model: e.target.value})}
                                   >
                                      <option value="">SELECIONAR BATERIA...</option>
                                      {batteryTypes.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                                   </select>
                                   {(profile?.role === 'Admin' || profile?.role === 'admin') && (
                                     <button 
                                       type="button"
                                       onClick={() => setShowAddBatteryModal(true)}
                                       className="bg-[#333535] border border-[#444932] text-[#caf300] p-3 rounded-xl hover:bg-[#444932] transition-all"
                                     >
                                       <Plus size={20} />
                                     </button>
                                   )}
                                 </div>
                               </Field>
                               <Field label="Modelo do Carregador" required>
                                 <div className="flex gap-2">
                                   <select 
                                     required={formData.energy_type === 'Eletrica'}
                                     className="auth-input rounded-xl"
                                     value={formData.charger_model}
                                     onChange={e => setFormData({...formData, charger_model: e.target.value})}
                                   >
                                      <option value="">SELECIONAR CARREGADOR...</option>
                                      {chargerTypes.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                                   </select>
                                   {(profile?.role === 'Admin' || profile?.role === 'admin') && (
                                     <button 
                                       type="button"
                                       onClick={() => setShowAddChargerModal(true)}
                                       className="bg-[#333535] border border-[#444932] text-[#caf300] p-3 rounded-xl hover:bg-[#444932] transition-all"
                                     >
                                       <Plus size={20} />
                                     </button>
                                   )}
                                 </div>
                               </Field>
                             </>
                           )}
                           <Field label="Horímetro Atual">
                             <input 
                               type="number"
                               className="auth-input rounded-xl font-['JetBrains_Mono']"
                               value={formData.current_hour_meter}
                               onChange={e => setFormData({...formData, current_hour_meter: Number(e.target.value)})}
                             />
                          </Field>
                          <Field label="Capacidade Carga (Tons)">
                             <input 
                               type="number"
                               step="0.1"
                               className="auth-input rounded-xl"
                               value={formData.load_capacity_tons}
                               onChange={e => setFormData({...formData, load_capacity_tons: Number(e.target.value)})}
                             />
                          </Field>
                          <Field label="Tipo da Torre">
                             <select 
                               className="auth-input rounded-xl"
                               value={formData.mast_type}
                               onChange={e => setFormData({...formData, mast_type: e.target.value as MastType})}
                             >
                                <option value="Simplex">SIMPLEX</option>
                                <option value="Duplex">DUPLEX</option>
                                <option value="Triplex">TRIPLEX</option>
                              </select>
                           </Field>
                           <Field label="Elevação Máxima (Mts)">
                              <input 
                                type="number"
                                step="0.1"
                                className="auth-input rounded-xl"
                                value={formData.max_elevation_meters}
                                onChange={e => setFormData({...formData, max_elevation_meters: Number(e.target.value)})}
                              />
                           </Field>
                           <Field label="Status Operacional">
                              <select 
                                className="auth-input rounded-xl"
                                value={formData.status}
                                onChange={e => setFormData({...formData, status: e.target.value})}
                              >
                                 <option value="Operational">OPERACIONAL</option>
                                 <option value="Maintenance">EM MANUTENÇÃO</option>
                                 <option value="Down">FORA DE SERVIÇO</option>
                              </select>
                           </Field>
                        </div>
                     </div>
                  </div>

                 <div className="pt-6 flex gap-4">
                    <button 
                      type="button"
                      onClick={() => setShowModal(false)}
                      className="flex-1 py-4 border border-[#444932] text-[#c5c9ac] font-bold text-xs tracking-widest rounded-xl hover:bg-[#333535]"
                    >
                      DESCARTAR
                    </button>
                    <button 
                      type="submit"
                      disabled={loading}
                      className="flex-1 py-4 bg-[#caf300] text-[#121414] font-bold text-xs tracking-widest rounded-xl hover:brightness-110 shadow-lg flex items-center justify-center gap-2"
                    >
                      {loading ? <Loader2 className="animate-spin" /> : (editingId ? 'SALVAR ALTERAÇÕES' : 'CONFIRMAR ATIVO')}
                    </button>
                 </div>
              </form>
           </div>
        </div>
      )}

      {/* Modal Adicionar Marca */}
      {showAddBrandModal && (
        <div className="fixed inset-0 bg-[#0c0f0f]/95 z-[100] flex items-center justify-center p-4 backdrop-blur-md">
           <div className="bg-[#1e2020] border border-[#caf300]/30 w-full max-w-sm rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(202,243,0,0.1)]">
              <div className="p-6 border-b border-[#444932] bg-[#282a2b] flex justify-between items-center text-[#caf300]">
                 <h3 className="font-black italic tracking-tighter uppercase">Nova Marca</h3>
                 <button onClick={() => setShowAddBrandModal(false)} className="text-[#c5c9ac] hover:text-white transition-colors">
                    <X size={20} />
                 </button>
              </div>
              <form onSubmit={handleAddBrand} className="p-6 space-y-4">
                 <Field label="Nome da Marca">
                    <input 
                      autoFocus
                      required 
                      className="auth-input rounded-xl uppercase"
                      value={newBrandName}
                      onChange={e => setNewBrandName(e.target.value.toUpperCase())}
                      placeholder="EX: TOYOTA"
                    />
                 </Field>
                 <button type="submit" className="w-full py-4 bg-[#caf300] text-[#121414] font-bold text-xs tracking-widest rounded-xl hover:brightness-110 shadow-lg">
                    ADICIONAR MARCA
                 </button>
              </form>
           </div>
        </div>
      )}

      {/* Modal Adicionar Modelo */}
      {showAddModelModal && (
        <div className="fixed inset-0 bg-[#0c0f0f]/95 z-[100] flex items-center justify-center p-4 backdrop-blur-md">
           <div className="bg-[#1e2020] border border-[#caf300]/30 w-full max-w-sm rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(202,243,0,0.1)]">
              <div className="p-6 border-b border-[#444932] bg-[#282a2b] flex justify-between items-center text-[#caf300]">
                 <h3 className="font-black italic tracking-tighter uppercase">Novo Modelo</h3>
                 <button onClick={() => setShowAddModelModal(false)} className="text-[#c5c9ac] hover:text-white transition-colors">
                    <X size={20} />
                 </button>
              </div>
              <form onSubmit={handleAddModel} className="p-6 space-y-4">
                 <Field label="Marca Selecionada">
                    <input 
                      disabled
                      className="auth-input rounded-xl opacity-50 font-bold"
                      value={brands.find(b => b.id === selectedBrandForModel)?.name || ''}
                    />
                 </Field>
                 <Field label="Nome do Modelo">
                    <input 
                      autoFocus
                      required 
                      className="auth-input rounded-xl uppercase"
                      value={newModelName}
                      onChange={e => setNewModelName(e.target.value.toUpperCase())}
                      placeholder="EX: 8FGU25"
                    />
                 </Field>
                 <button type="submit" className="w-full py-4 bg-[#caf300] text-[#121414] font-bold text-xs tracking-widest rounded-xl hover:brightness-110 shadow-lg">
                    ADICIONAR MODELO
                 </button>
              </form>
           </div>
        </div>
      )}

      {/* Modal Adicionar Bateria */}
      {showAddBatteryModal && (
        <div className="fixed inset-0 bg-[#0c0f0f]/95 z-[100] flex items-center justify-center p-4 backdrop-blur-md">
           <div className="bg-[#1e2020] border border-[#caf300]/30 w-full max-w-sm rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(202,243,0,0.1)]">
              <div className="p-6 border-b border-[#444932] bg-[#282a2b] flex justify-between items-center text-[#caf300]">
                 <h3 className="font-black italic tracking-tighter uppercase">Nova Bateria</h3>
                 <button onClick={() => setShowAddBatteryModal(false)} className="text-[#c5c9ac] hover:text-white transition-colors">
                    <X size={20} />
                 </button>
              </div>
              <form onSubmit={handleAddBattery} className="p-6 space-y-4">
                 <Field label="Modelo da Bateria">
                    <input 
                      autoFocus
                      required 
                      className="auth-input rounded-xl uppercase"
                      value={newBatteryName}
                      onChange={e => setNewBatteryName(e.target.value.toUpperCase())}
                      placeholder="EX: 48V 600AH"
                    />
                 </Field>
                 <button type="submit" className="w-full py-4 bg-[#caf300] text-[#121414] font-bold text-xs tracking-widest rounded-xl hover:brightness-110 shadow-lg">
                    ADICIONAR BATERIA
                 </button>
              </form>
           </div>
        </div>
      )}

      {/* Modal Adicionar Carregador */}
      {showAddChargerModal && (
        <div className="fixed inset-0 bg-[#0c0f0f]/95 z-[100] flex items-center justify-center p-4 backdrop-blur-md">
           <div className="bg-[#1e2020] border border-[#caf300]/30 w-full max-w-sm rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(202,243,0,0.1)]">
              <div className="p-6 border-b border-[#444932] bg-[#282a2b] flex justify-between items-center text-[#caf300]">
                 <h3 className="font-black italic tracking-tighter uppercase">Novo Carregador</h3>
                 <button onClick={() => setShowAddChargerModal(false)} className="text-[#c5c9ac] hover:text-white transition-colors">
                    <X size={20} />
                 </button>
              </div>
              <form onSubmit={handleAddCharger} className="p-6 space-y-4">
                 <Field label="Modelo do Carregador">
                    <input 
                      autoFocus
                      required 
                      className="auth-input rounded-xl uppercase"
                      value={newChargerName}
                      onChange={e => setNewChargerName(e.target.value.toUpperCase())}
                      placeholder="EX: 48V 100A"
                    />
                 </Field>
                 <button type="submit" className="w-full py-4 bg-[#caf300] text-[#121414] font-bold text-xs tracking-widest rounded-xl hover:brightness-110 shadow-lg">
                    ADICIONAR CARREGADOR
                 </button>
              </form>
           </div>
        </div>
      )}
    </div>
  );
}

function DetailItem({ label, value }: { label: string, value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-bold text-[#8f9378] tracking-widest uppercase">{label}</p>
      <p className="text-sm font-bold text-white uppercase">{value}</p>
    </div>
  );
}

function Field({ label, children, required, className = '' }: any) {
  return (
    <div className={clsx("space-y-1.5", className)}>
      <label className="text-[10px] font-bold text-[#8f9378] tracking-widest uppercase flex items-center gap-1">
        {label}
        {required && <span className="text-[#ffb4ab]">*</span>}
      </label>
      {children}
    </div>
  );
}

// forced sync
