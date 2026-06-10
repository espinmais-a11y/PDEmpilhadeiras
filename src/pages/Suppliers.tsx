import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Supplier } from '../types';
import { Search, Plus, Trash2, Edit3, Loader2, X, AlertTriangle, Truck, Mail, Phone, FileText } from 'lucide-react';
import { clsx } from 'clsx';

export function Suppliers() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'Admin' || profile?.role === 'admin';

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    tax_id: '',
    phone: '',
    contact_email: ''
  });

  useEffect(() => {
    fetchSuppliers();
  }, []);

  async function fetchSuppliers() {
    try {
      setLoading(true);
      setError(null);
      const { data, error: fetchErr } = await supabase
        .from('suppliers')
        .select('*')
        .order('name');
      
      if (fetchErr) throw fetchErr;
      setSuppliers((data || []) as Supplier[]);
    } catch (err: any) {
      console.error('[Suppliers] Load error:', err);
      setError('Erro ao carregar fornecedores.');
    } finally {
      setLoading(false);
    }
  }

  const handleNew = () => {
    setEditingId(null);
    setFormData({
      name: '',
      tax_id: '',
      phone: '',
      contact_email: ''
    });
    setError(null);
    setShowModal(true);
  };

  const handleEdit = (supplier: Supplier) => {
    setEditingId(supplier.id);
    setFormData({
      name: supplier.name,
      tax_id: supplier.tax_id,
      phone: supplier.phone || '',
      contact_email: supplier.contact_email || ''
    });
    setError(null);
    setShowModal(true);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!isAdmin) {
      alert('Apenas administradores podem remover fornecedores do catálogo.');
      return;
    }
    const confirmed = window.confirm(`Tem certeza que deseja excluir o fornecedor "${name}" permanentemente?`);
    if (!confirmed) return;

    setLoading(true);
    try {
      const { error: delErr } = await supabase.from('suppliers').delete().eq('id', id);
      if (delErr) throw delErr;
      
      setSuccess('Fornecedor removido com sucesso!');
      fetchSuppliers();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error('[Suppliers] Delete error:', err);
      setError('Erro ao remover fornecedor do banco de dados.');
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const nameUpper = formData.name.trim().toUpperCase();
    const taxClean = formData.tax_id.replace(/\D/g, "");

    if (!nameUpper || !taxClean) {
      setError('Razão Social e CNPJ são campos obrigatórios.');
      setLoading(false);
      return;
    }

    const payload = {
      name: nameUpper,
      tax_id: formatCNPJ(taxClean),
      phone: formData.phone.trim(),
      contact_email: formData.contact_email.trim().toLowerCase()
    };

    try {
      if (editingId) {
        const { error: updErr } = await supabase
          .from('suppliers')
          .update(payload)
          .eq('id', editingId);
        
        if (updErr) throw updErr;
        setSuccess('Fornecedor atualizado com sucesso!');
      } else {
        const { error: insErr } = await supabase
          .from('suppliers')
          .insert([payload]);
        
        if (insErr) throw insErr;
        setSuccess('Fornecedor cadastrado com sucesso!');
      }

      setShowModal(false);
      fetchSuppliers();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error('[Suppliers] Save error:', err);
      setError('Erro ao salvar informações de fornecedor. Tente novamente.');
      setLoading(false);
    }
  };

  const filteredSuppliers = suppliers.filter(s => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      (s.tax_id || '').includes(q) ||
      (s.contact_email || '').toLowerCase().includes(q) ||
      (s.phone || '').includes(q)
    );
  });

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-500">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black italic tracking-tighter text-white uppercase flex items-center gap-2">
            <Truck className="text-[#caf300]" size={28} /> Fornecedores de Peças
          </h2>
          <p className="text-[#c5c9ac] font-['JetBrains_Mono'] text-xs uppercase tracking-widest">Cadastro e Gestão de Fornecedores Homologados e Distribuidores</p>
        </div>
        
        <button 
          onClick={handleNew}
          className="bg-[#caf300] text-[#121414] px-6 py-3 font-black text-xs tracking-widest flex items-center gap-2 hover:brightness-110 shadow-lg rounded-xl"
        >
          <Plus size={16} /> NOVO FORNECEDOR
        </button>
      </div>

      {/* Alert Messaging */}
      {success && (
        <div className="bg-emerald-950/80 border border-emerald-500/50 p-4 rounded-xl text-emerald-400 text-xs font-bold uppercase tracking-widest">
          {success}
        </div>
      )}

      {error && (
        <div className="bg-red-950/80 border border-red-500/50 p-4 rounded-xl text-red-400 text-xs font-bold uppercase tracking-widest">
          {error}
        </div>
      )}

      {/* search field */}
      <div className="flex bg-[#1e2020] border border-[#444932] p-4 rounded-2xl select-none">
        <div className="flex-1 flex items-center bg-[#0c0f0f] border border-[#444932] rounded-xl px-4 py-2.5">
          <Search size={16} className="text-[#c5c9ac] mr-2" />
          <input
            type="text"
            placeholder="BUSCAR FORNECEDORES POR NOME, CNPJ, EMAIL OU TELEFONE..."
            className="bg-transparent border-none focus:ring-0 text-xs font-bold font-['JetBrains_Mono'] text-[#e2e2e2] w-full placeholder-[#c5c9ac]/30 outline-none uppercase"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="text-[#c5c9ac] hover:text-white transition-colors">
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Main Grid List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-20 flex flex-col items-center justify-center gap-3 text-[#c5c9ac] font-['JetBrains_Mono'] text-xs uppercase animate-pulse">
            <Loader2 className="animate-spin text-[#caf300]" size={36} />
            <span>Carregando dados de parceiros homologados...</span>
          </div>
        ) : filteredSuppliers.length === 0 ? (
          <div className="col-span-full py-20 text-center border-2 border-dashed border-[#444932] opacity-30 rounded-3xl">
             <Truck size={48} className="mx-auto mb-4 text-[#caf300]" />
             <p className="text-sm font-semibold uppercase tracking-widest">Nenhum fornecedor registrado correspondente</p>
          </div>
        ) : (
          filteredSuppliers.map((supplier) => (
            <div 
              key={supplier.id}
              className="bg-[#1e2020] border border-[#444932] p-6 rounded-2xl flex flex-col justify-between hover:border-[#caf300]/40 transition-all shadow-xl gap-6"
            >
              <div className="space-y-4">
                <div className="flex justify-between items-start gap-4">
                  <div className="w-10 h-10 bg-[#caf300]/10 rounded-xl flex items-center justify-center text-[#caf300] shrink-0">
                    <Truck size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[9px] font-bold font-['JetBrains_Mono'] text-[#caf300] uppercase tracking-widest">
                      CNPJ: {supplier.tax_id || '---'}
                    </p>
                    <h3 className="text-base font-black italic text-white uppercase tracking-tighter truncate mt-0.5" title={supplier.name}>
                      {supplier.name}
                    </h3>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-[#444932]/50 text-xs text-gray-300">
                  <div className="flex items-center gap-2">
                    <Mail size={13} className="text-[#c5c9ac]" />
                    <span className="truncate">{supplier.contact_email || 'Sem email cadastrado'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone size={13} className="text-[#c5c9ac]" />
                    <span>{supplier.phone || 'Sem telefone cadastrado'}</span>
                  </div>
                </div>
              </div>

              {/* actions */}
              <div className="pt-4 border-t border-[#444932] flex justify-end gap-2 shrink-0">
                <button
                  onClick={() => handleEdit(supplier)}
                  className="p-2 border border-[#444932] text-[#c5c9ac] hover:text-[#caf300] hover:border-[#caf300]/40 rounded-lg transition-all"
                  title="Editar Fornecedor"
                >
                  <Edit3 size={14} />
                </button>

                {isAdmin && (
                  <button
                    onClick={() => handleDelete(supplier.id, supplier.name)}
                    className="p-2 border border-[#444932] text-red-450 hover:bg-[#ffb4ab]/10 hover:border-red-400/50 rounded-lg transition-all"
                    title="Excluir Registro"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal Cadastro/Edição de Fornecedores */}
      {showModal && (
        <div className="fixed inset-0 bg-[#0c0f0f]/90 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#1e2020] border border-[#444932] w-full max-w-md rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            
            <div className="p-6 border-b border-[#444932] bg-[#282a2b] flex justify-between items-center text-[#caf300]">
              <h3 className="font-black italic tracking-tighter uppercase text-xl flex items-center gap-2">
                <Truck size={20} />
                {editingId ? 'Editar Fornecedor' : 'Cadastrar Fornecedor'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-[#c5c9ac] hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && (
                <div className="bg-red-500/10 border border-red-500/50 p-4 rounded-xl text-red-500 text-xs font-bold uppercase tracking-widest">
                  {error}
                </div>
              )}

              <div className="space-y-3">
                {/* Name */}
                <div>
                  <label className="text-[10px] font-bold text-[#8f9378] tracking-widest uppercase block mb-1">
                    Razão Social / Nome Fantasia <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    className="auth-input rounded-xl uppercase font-bold text-xs"
                    placeholder="Ex: IMPÉRIO DAS EMPILHADEIRAS LTDA"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                {/* CNPJ */}
                <div>
                  <label className="text-[10px] font-bold text-[#8f9378] tracking-widest uppercase block mb-1">
                    CNPJ <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    className="auth-input rounded-xl font-['JetBrains_Mono'] text-xs font-bold"
                    placeholder="00.000.000/0001-00"
                    value={formData.tax_id}
                    onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="text-[10px] font-bold text-[#8f9378] tracking-widest uppercase block mb-1">
                    Email de Contato
                  </label>
                  <input
                    type="email"
                    className="auth-input rounded-xl text-xs font-bold font-sans"
                    placeholder="vendas@fornecedor.com.br"
                    value={formData.contact_email}
                    onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="text-[10px] font-bold text-[#8f9378] tracking-widest uppercase block mb-1">
                    Telefone de Contato
                  </label>
                  <input
                    type="text"
                    className="auth-input rounded-xl text-xs font-bold font-['JetBrains_Mono']"
                    placeholder="(11) 4002-8922"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
              </div>

              <div className="pt-6 flex gap-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-3 border border-[#444932] text-[#c5c9ac] font-bold text-xs tracking-widest rounded-xl hover:bg-[#333535] transition-all"
                >
                  CANCELAR
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-3 bg-[#caf300] text-[#121414] font-bold text-xs tracking-widest rounded-xl hover:brightness-110 shadow-lg flex items-center justify-center gap-2 transition-all"
                >
                  {loading ? <Loader2 className="animate-spin" size={14} /> : 'SALVAR CADASTRO'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function formatCNPJ(v: string) {
  v = v.replace(/\D/g, "");
  if (v.length > 14) v = v.substring(0, 14);
  return v.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/g, "$1.$2.$3/$4-$5");
}
