import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Customer } from '../types';
import { Users, Search, Plus, MapPin, Phone, Mail, Loader2, X, ChevronRight, Edit3, Forklift, Gauge, Activity } from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '../context/AuthContext';
import { Machine } from '../types';

import { maskTaxId, maskPhone, maskCEP } from '../lib/masks';
import { BRAZILIAN_STATES } from '../constants';

export function Customers() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'Admin' || profile?.role === 'admin';

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [selectedCustomerFleet, setSelectedCustomerFleet] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    tax_id: '',
    contact_email: '',
    phone: '',
    whatsapp: '',
    cep: '',
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: ''
  });

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const cep = formData.cep.replace(/\D/g, '');
    if (cep.length === 8) {
      handleCEPLookup(cep);
    }
  }, [formData.cep]);

  async function handleCEPLookup(cep: string) {
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await response.json();
      
      if (!data.erro) {
        setFormData(prev => ({
          ...prev,
          street: data.logradouro.toUpperCase(),
          city: data.localidade.toUpperCase(),
          state: data.uf.toUpperCase()
        }));
      }
    } catch (err) {
      console.error('[Customers] CEP lookup error:', err);
    }
  }

  useEffect(() => {
    fetchCustomers();
  }, []);

  async function fetchCustomers() {
    try {
      setLoading(true);
      const [customersRes, machinesRes] = await Promise.all([
        supabase.from('customers').select('*').order('name'),
        supabase.from('machines').select('*')
      ]);

      if (customersRes.error) throw customersRes.error;
      if (machinesRes.error) throw machinesRes.error;

      if (customersRes.data) setCustomers(customersRes.data as Customer[]);
      if (machinesRes.data) setMachines(machinesRes.data as Machine[]);
    } catch (err: any) {
      console.error('[Customers] Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }

  const handleEdit = (customer: Customer) => {
    if (!isAdmin) return;
    setEditingId(customer.id);
    setFormData({
      name: customer.name || '',
      tax_id: customer.tax_id || '',
      contact_email: customer.contact_email || '',
      phone: customer.phone || '',
      whatsapp: customer.whatsapp || '',
      cep: customer.cep || '',
      street: customer.street || '',
      number: customer.number || '',
      complement: customer.complement || '',
      neighborhood: customer.neighborhood || '',
      city: customer.city || '',
      state: customer.state || ''
    });
    setShowModal(true);
  };

  const handleNew = () => {
    setEditingId(null);
    setFormData({
      name: '',
      tax_id: '',
      contact_email: '',
      phone: '',
      whatsapp: '',
      cep: '',
      street: '',
      number: '',
      complement: '',
      neighborhood: '',
      city: '',
      state: ''
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    console.log('[Customers] Submitting form:', { editingId, formData });

    try {
      if (editingId) {
        const { error: updateError } = await supabase
          .from('customers')
          .update(formData)
          .eq('id', editingId);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase.from('customers').insert([formData]);
        if (insertError) throw insertError;
      }
      
      console.log('[Customers] Success!');
      setShowModal(false);
      fetchCustomers();
    } catch (err: any) {
      console.error('[Customers] Persistence error:', err);
      let userFriendyMessage = 'Erro ao salvar cliente. Por favor, tente novamente.';
      
      const errorMessage = err.message || '';
      if (errorMessage.includes('customers_tax_id_key')) {
        userFriendyMessage = 'Este CPF ou CNPJ já está cadastrado para outro cliente.';
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
          <h2 className="text-3xl font-black italic tracking-tighter text-white uppercase">Gestão de Clientes</h2>
          <p className="text-[#c5c9ac] font-['JetBrains_Mono'] text-xs uppercase tracking-widest">Base de dados e faturamento industrial</p>
        </div>
        
        <button 
          onClick={handleNew}
          className="bg-[#caf300] text-[#121414] px-6 py-3 font-black text-xs tracking-widest flex items-center gap-2 hover:brightness-110 shadow-lg rounded-xl"
        >
          <Plus size={16} /> NOVO CLIENTE
        </button>
      </div>

      <div className="bg-[#1e2020] border border-[#444932] rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-[#444932] bg-[#282a2b] flex items-center">
           <div className="flex items-center bg-[#0c0f0f] border border-[#444932] rounded-xl px-3 py-2 w-full max-w-sm focus-within:border-[#caf300] transition-all">
             <Search size={14} className="text-[#c5c9ac] mr-2" />
             <input type="text" placeholder="BUSCAR POR NOME OU CNPJ..." className="bg-transparent border-none focus:ring-0 text-xs text-white w-full uppercase font-bold" />
           </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-[#333535] text-[#c5c9ac] text-[10px] uppercase font-bold tracking-widest border-b border-[#444932]">
                <th className="px-6 py-4">Identificação</th>
                <th className="px-6 py-4">Contato</th>
                <th className="px-6 py-4">Localização</th>
                <th className="px-6 py-4">Frota</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#444932]/30 font-['JetBrains_Mono'] text-xs">
              {customers.map((customer) => (
                <tr 
                  key={customer.id} 
                  className={clsx(
                    "hover:bg-[#333535]/50 transition-colors group",
                    isAdmin && "cursor-pointer"
                  )}
                  onClick={() => isAdmin && handleEdit(customer)}
                >
                  <td className="px-6 py-5">
                     <div>
                        <p className="font-bold text-[#e2e2e2] uppercase group-hover:text-[#caf300] transition-colors">
                          {customer.name}
                        </p>
                        <p className="text-[10px] text-[#c5c9ac] mt-0.5">{customer.tax_id}</p>
                     </div>
                  </td>
                  <td className="px-6 py-5">
                     <div className="space-y-1">
                        <div className="flex items-center gap-2 text-[#c5c9ac]">
                           <Mail size={12} className="text-[#caf300]" />
                           <span className="truncate max-w-[150px]">{customer.contact_email}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[#c5c9ac]">
                           <Phone size={12} className="text-[#caf300]" />
                           <span>{customer.phone || 'Sem fone'}</span>
                        </div>
                     </div>
                  </td>
                  <td className="px-6 py-5">
                     <div className="flex items-center gap-2 text-[#c5c9ac]">
                        <MapPin size={12} className="text-[#ffb4ab]" />
                        <span>{customer.city}/{customer.state}</span>
                     </div>
                  </td>
                  <td className="px-6 py-5">
                     <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCustomerFleet(customer);
                        }}
                        className="flex items-center gap-2 bg-[#caf300]/10 hover:bg-[#caf300]/20 border border-[#caf300]/20 text-[#caf300] px-3 py-1.5 rounded-lg transition-all"
                     >
                        <Forklift size={12} />
                        <span className="text-[10px] font-black tracking-widest uppercase">
                           {machines.filter(m => m.customer_id === customer.id).length} EQUIP.
                        </span>
                     </button>
                  </td>
                  <td className="px-6 py-5 text-right">
                     <button className="text-[#c5c9ac] hover:text-[#caf300] p-2 bg-[#333535] rounded-lg transition-all">
                        {isAdmin ? <Edit3 size={14} /> : <ChevronRight size={14} />}
                     </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {loading && (
            <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-[#caf300]" /></div>
          )}
          {customers.length === 0 && !loading && (
            <div className="py-20 text-center text-[#c5c9ac] opacity-50 space-y-2">
               <Users size={48} className="mx-auto mb-2" />
               <p className="text-[10px] font-bold uppercase tracking-widest">Nenhum cliente cadastrado</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal Frota do Cliente */}
      {selectedCustomerFleet && (
        <div className="fixed inset-0 bg-[#0c0f0f]/90 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
           <div className="bg-[#1e2020] border border-[#444932] w-full max-w-4xl rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="p-6 border-b border-[#444932] bg-[#282a2b] flex justify-between items-center">
                 <div>
                    <h3 className="font-black italic tracking-tighter text-[#caf300] uppercase text-xl leading-none">Frota de Ativos</h3>
                    <p className="text-[10px] text-[#c5c9ac] font-bold tracking-widest mt-1 uppercase">{selectedCustomerFleet.name}</p>
                 </div>
                 <button onClick={() => setSelectedCustomerFleet(null)} className="text-[#c5c9ac] hover:text-white transition-colors p-2 bg-[#333535] rounded-xl">
                    <X size={20} />
                 </button>
              </div>
              
              <div className="p-6 overflow-y-auto max-h-[70vh]">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {machines.filter(m => m.customer_id === selectedCustomerFleet.id).length > 0 ? (
                      machines.filter(m => m.customer_id === selectedCustomerFleet.id).map(machine => (
                        <div key={machine.id} className="bg-[#0c0f0f] border border-[#444932] p-5 rounded-2xl flex gap-4 group hover:border-[#caf300]/30 transition-all">
                           <div className="w-12 h-12 bg-[#caf300]/10 rounded-xl flex items-center justify-center text-[#caf300] border border-[#caf300]/10">
                              <Forklift size={24} />
                           </div>
                           <div className="flex-1 space-y-3">
                              <div className="flex justify-between items-start">
                                 <div>
                                    <h4 className="text-sm font-black italic text-white uppercase tracking-tight">{machine.brand} {machine.model}</h4>
                                    <p className="text-[10px] font-mono text-[#c5c9ac]">S/N: {machine.serial_number}</p>
                                 </div>
                                 <span className={clsx(
                                    "text-[8px] font-black tracking-widest px-1.5 py-0.5 rounded border uppercase",
                                    machine.status === 'Operational' ? 'bg-[#caf300]/10 text-[#caf300] border-[#caf300]/30' : 'bg-[#93000a]/10 text-[#ffb4ab] border-[#ffb4ab]/30'
                                 )}>
                                    {machine.status}
                                 </span>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                 <div className="flex items-center gap-1.5 text-[9px] font-bold text-[#c5c9ac]">
                                    <Gauge size={10} className="text-[#caf300]" />
                                    {machine.current_hour_meter}H
                                 </div>
                                 <div className="flex items-center gap-1.5 text-[9px] font-bold text-[#c5c9ac]">
                                    <Activity size={10} className="text-[#00ffff]" />
                                    {machine.load_capacity_tons}T
                                 </div>
                              </div>
                           </div>
                        </div>
                      ))
                    ) : (
                      <div className="col-span-full py-12 text-center border-2 border-dashed border-[#444932] rounded-2xl opacity-40">
                         <Forklift size={32} className="mx-auto mb-2" />
                         <p className="text-xs font-bold uppercase tracking-widest">Nenhum equipamento vinculado a este cliente</p>
                      </div>
                    )}
                 </div>
              </div>

              <div className="p-6 bg-[#121414] border-t border-[#444932] flex justify-end">
                 <button 
                   onClick={() => setSelectedCustomerFleet(null)}
                   className="px-8 py-3 bg-[#333535] text-white font-bold text-xs tracking-widest rounded-xl hover:bg-[#444932] transition-colors uppercase"
                 >
                   Fechar Lista
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* Modal Cadastro de Cliente */}
      {showModal && (
        <div className="fixed inset-0 bg-[#0c0f0f]/90 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
           <div className="bg-[#1e2020] border border-[#444932] w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="p-6 border-b border-[#444932] bg-[#282a2b] flex justify-between items-center">
                 <h3 className="font-black italic tracking-tighter text-[#caf300] uppercase text-xl">
                   {editingId ? 'Editar Cliente' : 'Novo Cadastro: Cliente'}
                 </h3>
                 <button onClick={() => setShowModal(false)} className="text-[#c5c9ac] hover:text-white transition-colors">
                    <X size={20} />
                 </button>
              </div>
              
              <form onSubmit={handleSubmit} className="p-8 space-y-6 overflow-y-auto max-h-[80vh]">
                 {error && (
                   <div className="bg-red-500/10 border border-red-500/50 p-4 rounded-xl text-red-500 text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                     <span>{error}</span>
                   </div>
                 )}
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Field label="Nome Completo / Razão Social" required>
                       <input 
                         required 
                         className="auth-input rounded-xl uppercase"
                         value={formData.name}
                         onChange={e => setFormData({...formData, name: e.target.value.toUpperCase()})}
                       />
                    </Field>
                    <Field label="CPF / CNPJ" required>
                       <input 
                         required 
                         placeholder="000.000.000-00 / 00.000.000/0000-00"
                         className="auth-input rounded-xl uppercase"
                         value={formData.tax_id}
                         onChange={e => setFormData({...formData, tax_id: maskTaxId(e.target.value)})}
                       />
                    </Field>
                    <Field label="Email Corporativo" required>
                       <input 
                         required 
                         type="email"
                         className="auth-input rounded-xl uppercase"
                         value={formData.contact_email}
                         onChange={e => setFormData({...formData, contact_email: e.target.value.toUpperCase()})}
                       />
                    </Field>
                    <Field label="Telefone">
                       <input 
                         className="auth-input rounded-xl uppercase"
                         value={formData.phone}
                         onChange={e => setFormData({...formData, phone: maskPhone(e.target.value)})}
                         placeholder="(00) 0000-0000"
                       />
                    </Field>
                    <Field label="WhatsApp">
                       <input 
                         className="auth-input rounded-xl uppercase"
                         value={formData.whatsapp}
                         onChange={e => setFormData({...formData, whatsapp: maskPhone(e.target.value)})}
                         placeholder="(00) 00000-0000"
                       />
                    </Field>
                    <div className="col-span-full border-t border-[#444932] pt-6">
                       <h4 className="text-[10px] font-bold text-[#caf300] mb-4 tracking-widest uppercase">Localização Industrial</h4>
                       <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                          <Field label="CEP">
                             <input 
                               className="auth-input rounded-xl uppercase" 
                               value={formData.cep} 
                               onChange={e => setFormData({...formData, cep: maskCEP(e.target.value)})} 
                               placeholder="00000-000"
                             />
                          </Field>
                          <Field label="Rua" className="md:col-span-2">
                             <input className="auth-input rounded-xl uppercase" value={formData.street} onChange={e => setFormData({...formData, street: e.target.value.toUpperCase()})} />
                          </Field>
                          <Field label="Nº">
                             <input className="auth-input rounded-xl uppercase" value={formData.number} onChange={e => setFormData({...formData, number: e.target.value.toUpperCase()})} />
                          </Field>
                          <Field label="Bairro" className="md:col-span-2">
                             <input className="auth-input rounded-xl uppercase" value={formData.neighborhood} onChange={e => setFormData({...formData, neighborhood: e.target.value.toUpperCase()})} />
                          </Field>
                          <Field label="Complemento" className="md:col-span-2">
                             <input className="auth-input rounded-xl uppercase" value={formData.complement} onChange={e => setFormData({...formData, complement: e.target.value.toUpperCase()})} />
                          </Field>
                          <Field label="Cidade" className="md:col-span-2">
                             <input className="auth-input rounded-xl uppercase" value={formData.city} onChange={e => setFormData({...formData, city: e.target.value.toUpperCase()})} />
                          </Field>
                          <Field label="Estado (UF)" className="md:col-span-2">
                             <select 
                               className="auth-input rounded-xl uppercase" 
                               value={formData.state} 
                               onChange={e => setFormData({...formData, state: e.target.value})}
                             >
                                <option value="">UF</option>
                                {BRAZILIAN_STATES.map(state => (
                                  <option key={state.value} value={state.value}>
                                    {state.value} - {state.label}
                                  </option>
                                ))}
                             </select>
                          </Field>
                       </div>
                    </div>
                 </div>

                 <div className="pt-6 flex gap-4">
                    <button 
                      type="button"
                      onClick={() => setShowModal(false)}
                      className="flex-1 py-4 border border-[#444932] text-[#c5c9ac] font-bold text-xs tracking-widest rounded-xl hover:bg-[#333535] transition-all"
                    >
                      DESCARTAR
                    </button>
                    <button 
                      type="submit"
                      disabled={loading}
                      className="flex-1 py-4 bg-[#caf300] text-[#121414] font-bold text-xs tracking-widest rounded-xl hover:brightness-110 shadow-lg flex items-center justify-center gap-2"
                    >
                      {loading ? <Loader2 className="animate-spin" /> : 'CONFIRMAR CADASTRO'}
                    </button>
                 </div>
              </form>
           </div>
        </div>
      )}
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
