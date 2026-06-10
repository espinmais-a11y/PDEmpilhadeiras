import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { InventoryItem, Supplier } from '../types';
import { 
  FileSpreadsheet, 
  Search, 
  Plus, 
  Calendar, 
  Truck, 
  FileText, 
  Loader2, 
  X, 
  Check, 
  Boxes, 
  ArrowUpRight,
  TrendingUp
} from 'lucide-react';
import { clsx } from 'clsx';

interface InventoryEntry {
  id: string;
  date: string;
  supplier: string;
  item_code: string;
  item_name: string;
  quantity: number;
  invoice_number: string;
  user_name: string;
  created_at: string;
}

export function MaterialEntries() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // General lists
  const [entries, setEntries] = useState<InventoryEntry[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  // Filtering for list
  const [listSearch, setListSearch] = useState('');

  // Lançamento State
  const [showForm, setShowForm] = useState(false);
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  
  // Searchable supplier state
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [supplierQuery, setSupplierQuery] = useState('');
  const [supplierDropdownOpen, setSupplierDropdownOpen] = useState(false);

  // Searchable SKU state
  const [selectedItemId, setSelectedItemId] = useState('');
  const [itemQuery, setItemQuery] = useState('');
  const [itemDropdownOpen, setItemDropdownOpen] = useState(false);

  const [quantity, setQuantity] = useState<number>(1);
  const [launching, setLaunching] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      setLoading(true);
      setError(null);
      const [entriesRes, itemsRes, suppliersRes] = await Promise.all([
        supabase.from('inventory_entries').select('*').order('created_at', { ascending: false }),
        supabase.from('inventory').select('*').order('code'),
        supabase.from('suppliers').select('*').order('name')
      ]);

      if (entriesRes.error) throw entriesRes.error;
      if (itemsRes.error) throw itemsRes.error;
      if (suppliersRes.error) throw suppliersRes.error;

      setEntries((entriesRes.data || []) as InventoryEntry[]);
      setItems((itemsRes.data || []) as InventoryItem[]);
      setSuppliers((suppliersRes.data || []) as Supplier[]);
    } catch (err: any) {
      console.error('[MaterialEntries] Error loading data:', err);
      setError('Erro ao carregar dados de entradas e catálogo.');
    } finally {
      setLoading(false);
    }
  }

  // Handle supplier select
  const handleSelectSupplier = (s: Supplier) => {
    setSelectedSupplierId(s.id);
    setSupplierQuery(s.name);
    setSupplierDropdownOpen(false);
  };

  // Handle item select
  const handleSelectItem = (item: InventoryItem) => {
    setSelectedItemId(item.id);
    setItemQuery(`[${item.code}] ${item.name}`);
    setItemDropdownOpen(false);
  };

  // Filter suppliers on input
  const filteredSuppliersInput = suppliers.filter(s => {
    if (!supplierQuery) return true;
    const q = supplierQuery.toLowerCase();
    return s.name.toLowerCase().includes(q) || s.tax_id.includes(q);
  });

  // Filter items on input
  const filteredItemsInput = items.filter(item => {
    if (!itemQuery) return true;
    const q = itemQuery.toLowerCase();
    // exclude the bracketed prefix if already selected
    return item.code.toLowerCase().includes(q) || item.name.toLowerCase().includes(q);
  });

  const handleOpenForm = () => {
    setEntryDate(new Date().toISOString().split('T')[0]);
    setInvoiceNumber('');
    setSelectedSupplierId('');
    setSupplierQuery('');
    setSelectedItemId('');
    setItemQuery('');
    setQuantity(1);
    setError(null);
    setShowForm(true);
  };

  const handleManualLaunch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLaunching(true);
    setError(null);
    setSuccess(null);

    const nfUpper = invoiceNumber.trim().toUpperCase();
    const qtyNum = Number(quantity);

    if (!nfUpper) {
      setError('O número da Nota Fiscal é obrigatório.');
      setLaunching(false);
      return;
    }

    if (!selectedSupplierId) {
      setError('Por favor, selecione um Fornecedor cadastrado da lista.');
      setLaunching(false);
      return;
    }

    if (!selectedItemId) {
      setError('Por favor, pesquise e selecione um Item do catálogo.');
      setLaunching(false);
      return;
    }

    if (qtyNum <= 0) {
      setError('A quantidade deve ser maior do que zero.');
      setLaunching(false);
      return;
    }

    try {
      const supplierObj = suppliers.find(s => s.id === selectedSupplierId);
      const itemObj = items.find(i => i.id === selectedItemId);

      if (!supplierObj || !itemObj) {
        throw new Error('Fornecedor ou Item selecionados não existem no banco de dados.');
      }

      // 1. Log to inventory_entries collection
      const newEntryPayload = {
        date: entryDate,
        supplier: supplierObj.name,
        item_code: itemObj.code,
        item_name: itemObj.name,
        quantity: qtyNum,
        invoice_number: nfUpper,
        user_name: profile?.full_name || 'Usuário do Sistema',
        created_at: new Date().toISOString()
      };

      const { error: insertEntryErr } = await supabase
        .from('inventory_entries')
        .insert([newEntryPayload]);
      
      if (insertEntryErr) throw insertEntryErr;

      // 2. Adjust stock inside inventory
      const newQty = itemObj.quantity + qtyNum;
      const { error: updateInvErr } = await supabase
        .from('inventory')
        .update({ quantity: newQty })
        .eq('id', itemObj.id);
      
      if (updateInvErr) throw updateInvErr;

      // 3. Write to history log (auditoria)
      const auditLog = {
        item_id: itemObj.id,
        item_code: itemObj.code,
        item_name: itemObj.name,
        type: 'entrada',
        quantity: qtyNum,
        reason: `COMPRA NF ${nfUpper} | FORN: ${supplierObj.name}`,
        location: itemObj.location,
        user_name: profile?.full_name || 'Usuário do Sistema',
        created_at: new Date().toISOString()
      };

      const { error: historyErr } = await supabase
        .from('inventory_history')
        .insert([auditLog]);

      if (historyErr) console.error('[MaterialEntries] Failed and skipped recording history:', historyErr);

      setSuccess(`Lançamento realizado com sucesso! Foram adicionadas ${qtyNum} unidades de "${itemObj.name}" ao estoque.`);
      setShowForm(false);
      fetchData();
      setTimeout(() => setSuccess(null), 5000);
    } catch (err: any) {
      console.error('[MaterialEntries] Save launch error:', err);
      setError(err.message || 'Erro ao processar lançamento de mercadorias.');
    } finally {
      setLaunching(false);
    }
  };

  const filteredEntries = entries.filter(ent => {
    if (!listSearch) return true;
    const s = listSearch.toLowerCase();
    return (
      ent.item_code.toLowerCase().includes(s) ||
      ent.item_name.toLowerCase().includes(s) ||
      ent.supplier.toLowerCase().includes(s) ||
      ent.invoice_number.toLowerCase().includes(s)
    );
  });

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-500">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black italic tracking-tighter text-white uppercase flex items-center gap-2">
            <FileSpreadsheet className="text-[#caf300]" size={28} /> Entrada de Materiais
          </h2>
          <p className="text-[#c5c9ac] font-['JetBrains_Mono'] text-xs uppercase tracking-widest">Lançamentos de Nota Fiscal e entrada física de peças compradas</p>
        </div>
        
        <button 
          onClick={handleOpenForm}
          className="bg-[#caf300] text-[#121414] px-6 py-3 font-black text-xs tracking-widest flex items-center gap-2 hover:brightness-110 shadow-lg rounded-xl"
        >
          <Plus size={16} /> REGISTRAR ENTRADA FISCAL (NF)
        </button>
      </div>

      {/* Success Alert */}
      {success && (
        <div className="bg-emerald-950/80 border border-emerald-500/50 p-4 rounded-xl text-emerald-400 text-xs font-bold uppercase tracking-widest leading-relaxed">
          {success}
        </div>
      )}

      {/* Error Alert */}
      {error && !showForm && (
        <div className="bg-red-950/80 border border-red-500/50 p-4 rounded-xl text-red-450 text-xs font-bold uppercase tracking-widest">
          {error}
        </div>
      )}

      {/* Filters bar */}
      <div className="flex bg-[#1e2020] border border-[#444932] p-4 rounded-2xl select-none">
        <div className="flex-1 flex items-center bg-[#0c0f0f] border border-[#444932] rounded-xl px-4 py-2.5">
          <Search size={16} className="text-[#c5c9ac] mr-2" />
          <input
            type="text"
            placeholder="CONECTAR PESQUISA: DIGITE FORNECEDOR, SKU, DESCRIÇÃO OU NÚMERO DE NOTA FISCAL..."
            className="bg-transparent border-none focus:ring-0 text-xs font-bold font-['JetBrains_Mono'] text-[#e2e2e2] w-full placeholder-[#c5c9ac]/30 outline-none uppercase"
            value={listSearch}
            onChange={(e) => setListSearch(e.target.value)}
          />
          {listSearch && (
            <button onClick={() => setListSearch('')} className="text-[#c5c9ac] hover:text-white transition-colors">
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Table List of entries */}
      <div className="bg-[#1e2020] border border-[#444932] rounded-2xl overflow-hidden shadow-xl animate-fade-in">
        <div className="p-4 border-b border-[#444932] bg-[#282a2b] flex items-center justify-between">
          <span className="text-xs font-black uppercase text-[#caf300] font-['JetBrains_Mono'] tracking-widest">
            HISTÓRICO DE ENTRADAS DE NOTAS FISCAIS
          </span>
          <span className="text-[10px] text-[#c5c9ac] font-['JetBrains_Mono']">
            Exibindo {filteredEntries.length} lançamentos
          </span>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-[#c5c9ac] font-['JetBrains_Mono'] text-xs uppercase animate-pulse">
              <Loader2 className="animate-spin text-[#caf300]" size={36} />
              <span>Carregando histórico de notas fiscais...</span>
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="py-20 text-center text-xs text-[#c5c9ac] font-['JetBrains_Mono'] uppercase">
              Sem dados para exibir para os filtros escolhidos.
            </div>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="bg-[#333535] text-[#c5c9ac] text-[10px] uppercase font-bold tracking-widest border-b border-[#444932]">
                  <th className="px-6 py-4">Data NF</th>
                  <th className="px-6 py-4">Nota Fiscal / NF</th>
                  <th className="px-6 py-4">Fornecedor</th>
                  <th className="px-6 py-4">Cód. SKU</th>
                  <th className="px-6 py-4">Peça / Insumo</th>
                  <th className="px-6 py-4 text-center">Quantidade</th>
                  <th className="px-6 py-4 text-right">Lançado Por</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#444932]">
                {filteredEntries.map((ent) => (
                  <tr key={ent.id} className="hover:bg-[#282a2b]/30 text-xs font-['JetBrains_Mono'] transition-colors">
                    <td className="px-6 py-4 text-gray-400">
                      {ent.date ? new Date(ent.date + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}
                    </td>
                    <td className="px-6 py-4 font-black text-white">{ent.invoice_number}</td>
                    <td className="px-6 py-4 text-gray-300 font-sans font-semibold uppercase">{ent.supplier}</td>
                    <td className="px-6 py-4 font-bold text-[#caf300]">{ent.item_code}</td>
                    <td className="px-6 py-4 text-gray-300 uppercase font-sans font-medium">{ent.item_name}</td>
                    <td className="px-6 py-4 text-center">
                      <span className="bg-emerald-950 text-emerald-400 border border-emerald-900 font-black px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                        <ArrowUpRight size={10} /> +{ent.quantity} U
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-gray-400 font-medium font-sans uppercase">
                      {ent.user_name}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal para Registro de nova Entrada */}
      {showForm && (
        <div className="fixed inset-0 bg-[#0c0f0f]/92 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#1e2020] border-2 border-[#444932] w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            
            <div className="p-6 border-b border-[#444932] bg-[#282a2b] flex justify-between items-center text-[#caf300]">
              <h3 className="font-black italic tracking-tighter uppercase text-xl flex items-center gap-2">
                <FileSpreadsheet size={20} />
                Lançar Nova Entrada de Materiais
              </h3>
              <button onClick={() => setShowForm(false)} className="text-[#c5c9ac] hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleManualLaunch} className="p-8 space-y-5 max-h-[80vh] overflow-y-auto">
              {error && (
                <div className="bg-red-500/10 border border-red-500/50 p-4 rounded-xl text-red-500 text-xs font-bold uppercase tracking-widest">
                  {error}
                </div>
              )}

              <div className="space-y-4">
                
                {/* Dates & NF Number */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-[#8f9378] tracking-widest uppercase block mb-1.5">
                      Data da Emissão / NF <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      className="auth-input rounded-xl text-center font-['JetBrains_Mono'] focus:border-[#caf300] outline-none text-xs"
                      value={entryDate}
                      onChange={(e) => setEntryDate(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-[#8f9378] tracking-widest uppercase block mb-1.5">
                      Número da Nota Fiscal (NF) <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      className="auth-input rounded-xl uppercase font-['JetBrains_Mono'] focus:border-[#caf300] outline-none text-xs"
                      placeholder="Ex: NF-12049"
                      value={invoiceNumber}
                      onChange={(e) => setInvoiceNumber(e.target.value)}
                    />
                  </div>
                </div>

                {/* Searchable Required Supplier */}
                <div className="relative">
                  <label className="text-[10px] font-bold text-[#8f9378] tracking-widest uppercase block mb-1.5">
                    Fornecedor (Buscar no Cadastro) <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      placeholder="DIGITE PARTE DO NOME DO FORNECEDOR..."
                      className="auth-input rounded-xl uppercase font-bold text-xs pr-10"
                      value={supplierQuery}
                      onChange={(e) => {
                        setSupplierQuery(e.target.value);
                        setSelectedSupplierId('');
                        setSupplierDropdownOpen(true);
                      }}
                      onFocus={() => setSupplierDropdownOpen(true)}
                    />
                    {supplierQuery && (
                      <button 
                        type="button" 
                        onClick={() => { setSupplierQuery(''); setSelectedSupplierId(''); }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  {/* Dropdown list for Supplier search */}
                  {supplierDropdownOpen && filteredSuppliersInput.length > 0 && (
                    <div className="absolute z-50 left-0 right-0 mt-1.5 bg-[#121414] border border-[#444932] rounded-xl max-h-40 overflow-y-auto shadow-2xl divide-y divide-[#444932]/40">
                      {filteredSuppliersInput.map(s => (
                        <button
                          key={s.id}
                          type="button"
                          className="w-full text-left px-4 py-2.5 text-xs text-[#e2e2e2] uppercase hover:bg-[#282a2b] transition-colors focus:outline-none flex justify-between items-center font-bold"
                          onClick={() => handleSelectSupplier(s)}
                        >
                          <span>{s.name}</span>
                          <span className="text-[9px] font-['JetBrains_Mono'] text-gray-400 font-medium">CNPJ: {s.tax_id}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {supplierDropdownOpen && filteredSuppliersInput.length === 0 && (
                    <div className="absolute z-50 left-0 right-0 mt-1.5 bg-[#121414] border border-red-500/40 rounded-xl p-3 text-[10px] text-red-400 font-bold uppercase text-center tracking-wider">
                      ⚠️ Nenhum fornecedor cadastrado com este nome! Cadastre no menu Fornecedores primeiro.
                    </div>
                  )}
                </div>

                {/* Searchable SKU/Description Item */}
                <div className="relative">
                  <label className="text-[10px] font-bold text-[#8f9378] tracking-widest uppercase block mb-1.5">
                    Procurar SKU ou Descrição no Catálogo <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      placeholder="PESQUISE EXEMPLO: FIL-H10 OU PNEU..."
                      className="auth-input rounded-xl uppercase font-bold text-xs pr-10"
                      value={itemQuery}
                      onChange={(e) => {
                        setItemQuery(e.target.value);
                        setSelectedItemId('');
                        setItemDropdownOpen(true);
                      }}
                      onFocus={() => setItemDropdownOpen(true)}
                    />
                    {itemQuery && (
                      <button 
                        type="button" 
                        onClick={() => { setItemQuery(''); setSelectedItemId(''); }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  {/* Dropdown list for Item search */}
                  {itemDropdownOpen && filteredItemsInput.length > 0 && (
                    <div className="absolute z-50 left-0 right-0 mt-1.5 bg-[#121414] border border-[#444932] rounded-xl max-h-44 overflow-y-auto shadow-2xl divide-y divide-[#444932]/40">
                      {filteredItemsInput.map(item => (
                        <button
                          key={item.id}
                          type="button"
                          className="w-full text-left px-4 py-2.5 text-xs text-[#e2e2e2] uppercase hover:bg-[#282a2b] transition-colors focus:outline-none flex justify-between items-center"
                          onClick={() => handleSelectItem(item)}
                        >
                          <div className="flex flex-col">
                            <span className="font-['JetBrains_Mono'] font-extrabold text-[#caf300]">{item.code}</span>
                            <span className="text-gray-300 font-sans font-medium text-[11px] truncate max-w-[280px]">{item.name}</span>
                          </div>
                          <span className="bg-[#0c0f0f] border border-[#444932] text-[9px] text-[#c5c9ac] px-2 py-0.5 rounded font-bold uppercase select-none shrink-0">
                            Saldo: {item.quantity} U
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {itemDropdownOpen && filteredItemsInput.length === 0 && (
                    <div className="absolute z-50 left-0 right-0 mt-1.5 bg-[#121414] border border-red-500/40 rounded-xl p-3 text-[10px] text-red-200 font-bold uppercase text-center tracking-wider">
                      ⚠️ Item não cadastrado no estoque! Por favor, cadastre o SKU no Controle de Estoque primeiro.
                    </div>
                  )}
                </div>

                {/* Quantity */}
                <div>
                  <label className="text-[10px] font-bold text-[#8f9378] tracking-widest uppercase block mb-1.5">
                    Quantidade Solicitada na Entrada <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    step="1"
                    className="auth-input rounded-xl font-['JetBrains_Mono'] text-xs font-bold"
                    placeholder="Ex: 10"
                    value={quantity || ''}
                    onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                  />
                </div>

              </div>

              {/* Action buttons */}
              <div className="pt-6 flex gap-4">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 py-3.5 border border-[#444932] text-[#c5c9ac] font-bold text-xs tracking-widest rounded-xl hover:bg-[#333535] transition-all"
                >
                  CANCELAR
                </button>
                <button
                  type="submit"
                  disabled={launching}
                  className="flex-1 py-3.5 bg-[#caf300] text-[#121414] font-bold text-xs tracking-widest rounded-xl hover:brightness-110 shadow-lg flex items-center justify-center gap-2 transition-all"
                >
                  {launching ? <Loader2 className="animate-spin" size={14} /> : 'CONFIRMAR ENTRADA'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
