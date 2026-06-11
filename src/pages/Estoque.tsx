import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { InventoryItem, InventoryHistory } from '../types';
import { 
  Boxes, 
  Search, 
  Plus, 
  MapPin, 
  AlertTriangle, 
  Trash2, 
  Loader2, 
  X, 
  Edit3, 
  RefreshCw, 
  ArrowUpRight, 
  ArrowDownLeft, 
  TrendingDown, 
  History, 
  Check,
  Scale,
  FileSpreadsheet,
  Calendar,
  Truck,
  FileText
} from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '../context/AuthContext';

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

export function Estoque() {
  const { profile } = useAuth();
  const isAdmin = profile?.role?.toString().toLowerCase().trim() === 'admin';

  const [activeTab, setActiveTab ] = useState<'items' | 'catalog' | 'history'>('items');
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [history, setHistory] = useState<InventoryHistory[]>([]);
  const [entries, setEntries] = useState<InventoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('ALL');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);

  // Search/Filter for Entradas
  const [entrySearch, setEntrySearch] = useState('');

  // Modal controls
  const [showItemModal, setShowItemModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [showEntryModal, setShowEntryModal] = useState(false);
  
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [adjustingItem, setAdjustingItem] = useState<InventoryItem | null>(null);

  // Form states
  const [itemFormData, setItemFormData] = useState({
    code: '',
    name: '',
    category: 'Filtros',
    location: 'Estoque Geral',
    quantity: 0,
    unit_price: 0,
    min_stock: 2
  });

  const [adjustFormData, setAdjustFormData] = useState({
    type: 'saida' as 'entrada' | 'saida' | 'ajuste',
    quantity: 0,
    reason: 'Ajuste geral de inventário'
  });

  const [entryFormData, setEntryFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    supplier: '',
    item_code: '',
    item_name: '',
    quantity: 1,
    invoice_number: ''
  });

  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Lists of unique categories & locations
  const categories = ['Filtros', 'Pneus', 'Lubrificantes', 'Elétrica', 'Mastro', 'Vedação', 'Outros'];
  const locations = ['Estoque Geral', 'Recebimento - 10500', 'Penal'];

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      setLoading(true);
      setError(null);
      const [itemsRes, historyRes, entriesRes] = await Promise.all([
        supabase.from('inventory').select('*').order('code'),
        supabase.from('inventory_history').select('*').order('created_at', { ascending: false }),
        supabase.from('inventory_entries').select('*').order('created_at', { ascending: false })
      ]);

      if (itemsRes.error) throw itemsRes.error;
      if (historyRes.error) throw historyRes.error;

      setItems((itemsRes.data || []) as InventoryItem[]);
      setHistory((historyRes.data || []) as InventoryHistory[]);
      setEntries((entriesRes.data || []) as InventoryEntry[]);
    } catch (err: any) {
      console.error('[Estoque] Error loading data:', err);
      setError('Erro ao carregar dados do estoque.');
    } finally {
      setLoading(false);
    }
  }

  const handleOpenNewItem = () => {
    if (!isAdmin) return;
    setEditingItem(null);
    setItemFormData({
      code: '',
      name: '',
      category: 'Filtros',
      location: 'Estoque Geral',
      quantity: 0,
      unit_price: 0,
      min_stock: 2
    });
    setError(null);
    setShowItemModal(true);
  };

  const handleOpenEditItem = (item: InventoryItem) => {
    if (!isAdmin) return;
    setEditingItem(item);
    setItemFormData({
      code: item.code,
      name: item.name,
      category: item.category,
      location: item.location,
      quantity: item.quantity,
      unit_price: item.unit_price,
      min_stock: item.min_stock
    });
    setError(null);
    setShowItemModal(true);
  };

  const handleOpenAdjustItem = (item: InventoryItem, defaultType: 'entrada' | 'saida' | 'ajuste' = 'saida', customReason = '') => {
    if (!isAdmin) return;
    setAdjustingItem(item);
    setAdjustFormData({
      type: defaultType,
      quantity: defaultType === 'saida' && customReason.includes('Zerar') ? item.quantity : 0,
      reason: customReason || (defaultType === 'saida' ? 'Saída manual de estoque' : 'Entrada manual de estoque')
    });
    setError(null);
    setShowAdjustModal(true);
  };

  const handleOpenEntryModal = () => {
    if (!isAdmin) return;
    setEntryFormData({
      date: new Date().toISOString().split('T')[0],
      supplier: '',
      item_code: '',
      item_name: '',
      quantity: 1,
      invoice_number: ''
    });
    setError(null);
    setShowEntryModal(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      setError('Apenas administradores podem salvar itens no estoque.');
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const codeUpper = itemFormData.code.trim().toUpperCase();
      const nameUpper = itemFormData.name.trim().toUpperCase();

      if (!codeUpper || !nameUpper) {
        throw new Error('Código e Nome são obrigatórios.');
      }

      const payload = {
        code: codeUpper,
        name: nameUpper,
        category: itemFormData.category,
        location: itemFormData.location,
        quantity: Number(itemFormData.quantity),
        unit_price: Number(itemFormData.unit_price),
        min_stock: Number(itemFormData.min_stock)
      };

      if (editingItem) {
        // Update item
        const { error: updateError } = await supabase
          .from('inventory')
          .update(payload)
          .eq('id', editingItem.id);

        if (updateError) throw updateError;

        // Automatically write history
        const qtyDiff = Number(itemFormData.quantity) - editingItem.quantity;
        if (qtyDiff !== 0) {
          await registerHistoryLog(
            editingItem.id,
            codeUpper,
            nameUpper,
            qtyDiff > 0 ? 'entrada' : 'saida',
            Math.abs(qtyDiff),
            'Ajuste de quantidade no cadastro',
            itemFormData.location
          );
        }

        setSuccessMessage('Item atualizado com sucesso!');
      } else {
        // Insert new item
        const { data: insertedData, error: insertError } = await supabase
          .from('inventory')
          .insert([payload]);

        if (insertError) throw insertError;

        const newItem = (insertedData && insertedData[0]) || null;
        if (newItem && Number(itemFormData.quantity) > 0) {
          await registerHistoryLog(
            newItem.id,
            codeUpper,
            nameUpper,
            'entrada',
            Number(itemFormData.quantity),
            'Carga inicial do item',
            itemFormData.location
          );
        }

        setSuccessMessage('Novo item cadastrado!');
      }

      setShowItemModal(false);
      await fetchData();

      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      console.error('[Estoque] Save error:', err);
      setError(err.message || 'Erro ao salvar o item.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      setError('Apenas administradores podem realizar movimentações de ajuste.');
      return;
    }
    if (!adjustingItem) return;

    setLoading(true);
    setError(null);

    try {
      const adjustQty = Number(adjustFormData.quantity);
      if (adjustQty <= 0) {
        throw new Error('A quantidade deve ser maior do que zero.');
      }

      let newQuantity = adjustingItem.quantity;
      if (adjustFormData.type === 'entrada') {
        newQuantity += adjustQty;
      } else if (adjustFormData.type === 'saida') {
        if (adjustQty > adjustingItem.quantity) {
          throw new Error('Quantidade insuficiente em estoque para esta saída.');
        }
        newQuantity -= adjustQty;
      } else if (adjustFormData.type === 'ajuste') {
        newQuantity = adjustQty;
      }

      const { error: updateError } = await supabase
        .from('inventory')
        .update({ quantity: newQuantity })
        .eq('id', adjustingItem.id);

      if (updateError) throw updateError;

      // Register log
      await registerHistoryLog(
        adjustingItem.id,
        adjustingItem.code,
        adjustingItem.name,
        adjustFormData.type,
        adjustQty,
        adjustFormData.reason || 'Alteração de quantidade',
        adjustingItem.location
      );

      setSuccessMessage(`Movimentação realizada com sucesso! Novo saldo: ${newQuantity}`);
      setShowAdjustModal(false);
      await fetchData();

      setTimeout(() => setSuccessMessage(null), 3500);
    } catch (err: any) {
      console.error('[Estoque] Adjustment error:', err);
      setError(err.message || 'Erro ao registrar movimentação.');
    } finally {
      setLoading(false);
    }
  };

  // Process launching a new Entry (NF input)
  const handleSaveEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      setError('Apenas administradores podem lançar entradas via NF.');
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const codeUpper = entryFormData.item_code.trim().toUpperCase();
      const nameUpper = entryFormData.item_name.trim().toUpperCase();
      const qtyEntered = Number(entryFormData.quantity);
      const supplierUpper = entryFormData.supplier.trim().toUpperCase();
      const nfUpper = entryFormData.invoice_number.trim().toUpperCase();

      if (!codeUpper || !nameUpper || qtyEntered <= 0 || !supplierUpper || !nfUpper) {
        throw new Error('Preencha todos os campos obrigatórios corretamente.');
      }

      // 1. Log to inventory_entries collection
      const newEntryPayload = {
        date: entryFormData.date,
        supplier: supplierUpper,
        item_code: codeUpper,
        item_name: nameUpper,
        quantity: qtyEntered,
        invoice_number: nfUpper,
        user_name: profile?.full_name || 'Usuário do Sistema',
        created_at: new Date().toISOString()
      };

      const { error: insertEntryErr } = await supabase
        .from('inventory_entries')
        .insert([newEntryPayload]);
      
      if (insertEntryErr) throw insertEntryErr;

      // 2. Adjust stock inside inventory
      const existingItem = items.find(i => i.code.trim().toUpperCase() === codeUpper);
      if (existingItem) {
        // Increment quantity
        const newQty = existingItem.quantity + qtyEntered;
        const { error: updateInvErr } = await supabase
          .from('inventory')
          .update({ quantity: newQty })
          .eq('id', existingItem.id);
        
        if (updateInvErr) throw updateInvErr;

        // Write to history log
        await registerHistoryLog(
          existingItem.id,
          codeUpper,
          nameUpper,
          'entrada',
          qtyEntered,
          `COMPRA NF ${nfUpper} | FORN: ${supplierUpper}`,
          existingItem.location
        );
      } else {
        // Create new inventory item
        const newInvPayload = {
          code: codeUpper,
          name: nameUpper,
          category: 'Outros',
          location: 'Estoque Geral',
          quantity: qtyEntered,
          unit_price: 0,
          min_stock: 2
        };

        const { data: insertedData, error: createInvErr } = await supabase
          .from('inventory')
          .insert([newInvPayload]);
        
        if (createInvErr) throw createInvErr;

        const createdItem = (insertedData && insertedData[0]) || null;
        await registerHistoryLog(
          createdItem?.id || 'new',
          codeUpper,
          nameUpper,
          'entrada',
          qtyEntered,
          `CADASTRO COMPRA NF ${nfUpper} | FORN: ${supplierUpper}`,
          'Estoque Geral'
        );
      }

      setSuccessMessage('Entrada de material correspondente à NF registrada com sucesso!');
      setShowEntryModal(false);
      await fetchData();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      console.error('[Estoque] Save Entry Error:', err);
      setError(err.message || 'Erro ao registrar entrada de mercadoria.');
    } finally {
      setLoading(false);
    }
  };

  // Direct fast-zero balance command
  const handleFastZeroBalance = async (item: InventoryItem) => {
    if (!isAdmin) return;
    if (item.quantity === 0) {
      alert('O saldo deste item já é zero.');
      return;
    }

    const defaultReason = `Zerar saldo para correção de furo de estoque da Penal (${item.location})`;
    const confirmed = confirm(
      `AVISO DE AJUSTE FÍSICO:\n\nTem certeza que deseja ZERAR o saldo de "${item.name}" (Código: ${item.code})?\n` +
      `Isso registrará uma saída de ajuste de ${item.quantity} unidades para corrigir o saldo no local: "${item.location}".`
    );

    if (!confirmed) return;

    setLoading(true);
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from('inventory')
        .update({ quantity: 0 })
        .eq('id', item.id);

      if (updateError) throw updateError;

      await registerHistoryLog(
        item.id,
        item.code,
        item.name,
        'saida',
        item.quantity,
        defaultReason,
        item.location
      );

      setSuccessMessage(`Saldo zerado com sucesso para ${item.code}!`);
      await fetchData();
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      console.error('[Estoque] Fast zero error:', err);
      setError('Erro ao zerar saldo do item.');
    } finally {
      setLoading(false);
    }
  };

  async function registerHistoryLog(
    itemId: string,
    code: string,
    name: string,
    type: 'entrada' | 'saida' | 'ajuste',
    quantity: number,
    reason: string,
    location: string
  ) {
    const log = {
      item_id: itemId,
      item_code: code,
      item_name: name,
      type,
      quantity,
      reason,
      location,
      user_name: profile?.full_name || 'Usuário do Sistema',
      created_at: new Date().toISOString()
    };

    const { error } = await supabase.from('inventory_history').insert([log]);
    if (error) console.error('[Estoque] Failed to save history log:', error);
  }

  const handleDeleteItem = async (id: string, name: string) => {
    if (!isAdmin) return;
    if (!confirm(`Deseja realmente EXCLUIR o item "${name}" do cadastro de estoque permanentemente?`)) return;

    setLoading(true);
    try {
      const { error: deleteError } = await supabase.from('inventory').delete().eq('id', id);
      if (deleteError) throw deleteError;
      
      setSuccessMessage('Item excluído com sucesso.');
      await fetchData();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      console.error('[Estoque] Delete error:', err);
      setError('Erro ao excluir o item.');
    } finally {
      setLoading(false);
    }
  };

  // Filter application
  const filteredItems = items.filter(item => {
    const matchesSearch = 
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.category.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesLocation = selectedLocation === 'ALL' || item.location === selectedLocation;
    const matchesCategory = selectedCategory === 'ALL' || item.category === selectedCategory;
    const matchesLowStock = !showLowStockOnly || item.quantity <= item.min_stock;

    return matchesSearch && matchesLocation && matchesCategory && matchesLowStock;
  });

  const filteredEntries = entries.filter(ent => {
    if (!entrySearch) return true;
    const s = entrySearch.toLowerCase();
    return (
      ent.item_code.toLowerCase().includes(s) ||
      ent.item_name.toLowerCase().includes(s) ||
      ent.supplier.toLowerCase().includes(s) ||
      ent.invoice_number.toLowerCase().includes(s)
    );
  });

  // KPI Calculations
  const totalItems = items.length;
  const itemsIn10500 = items.filter(i => i.location === 'Recebimento - 10500');
  const lowStockCount = items.filter(i => i.quantity <= i.min_stock).length;
  const totalStockValue = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
  const valIn10500 = itemsIn10500.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
  const totalEntriesLaunched = entries.reduce((sum, ent) => sum + ent.quantity, 0);
  const totalPhysicalStock = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-500">
      
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 py-2 border-b border-[#333535]">
        <div>
          <h2 className="text-3xl font-black italic tracking-tighter text-white uppercase flex items-center gap-3">
            <Boxes className="text-[#caf300]" size={32} />
            Controle de Estoque
          </h2>
          <p className="text-[#c5c9ac] font-['JetBrains_Mono'] text-xs uppercase tracking-widest leading-relaxed mt-0.5">
            Registro estruturado de entradas de materiais via NF e acompanhamento de saídas automatizadas
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={fetchData}
            title="Sincronizar dados"
            className="p-3 border border-[#444932] bg-[#1e2020] text-white hover:text-[#caf300] transition-colors rounded-xl flex items-center justify-center bg-[#282a2b]"
          >
            <RefreshCw size={16} className={clsx(loading && "animate-spin")} />
          </button>

          {isAdmin && (
            <button 
              onClick={handleOpenNewItem}
              className={clsx(
                "px-5 py-3 font-black text-xs tracking-widest flex items-center gap-2 rounded-xl transition-all shadow-lg",
                activeTab === 'catalog'
                  ? "bg-[#caf300] text-[#121414] hover:brightness-110"
                  : "bg-[#282a2b] hover:bg-[#333535] border border-[#444932] text-[#caf300]"
              )}
            >
              <Plus size={16} /> CADASTRAR NOVO SKU
            </button>
          )}
        </div>
      </div>

      {/* Success/Error displays */}
      {error && (
        <div className="p-4 bg-red-950/80 border-2 border-red-500 rounded-xl flex items-center gap-3 text-red-200 text-xs animate-bounce font-medium">
          <AlertTriangle className="shrink-0 text-red-400" size={18} />
          <span>{error}</span>
        </div>
      )}

      {successMessage && (
        <div className="p-4 bg-emerald-950/80 border-2 border-emerald-500 rounded-xl flex items-center gap-3 text-emerald-200 text-xs animate-pulse font-medium">
          <Check className="shrink-0 text-emerald-400" size={18} />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Stats Summary Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Total material stock quantity card */}
        <div className="bg-[#1e2020] border border-[#444932] rounded-2xl p-6 relative overflow-hidden group">
          <div className="absolute right-0 top-0 translate-x-3 -translate-y-3 opacity-5 group-hover:scale-110 transition-transform">
            <Boxes size={120} className="text-[#caf300]" />
          </div>
          <p className="text-[10px] font-bold font-['JetBrains_Mono'] text-[#c5c9ac] tracking-widest uppercase">Saldo Total em Estoque</p>
          <p className="text-3xl font-black text-white italic tracking-tight mt-2 font-['JetBrains_Mono']">
            {totalPhysicalStock} <span className="text-xs not-italic font-bold text-[#c5c9ac] tracking-normal uppercase">Unidades</span>
          </p>
          <div className="flex items-center gap-2 mt-4 text-[11px] text-[#c5c9ac]">
            Valor estimado: <span className="font-bold text-[#caf300]">R$ {totalStockValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>

        {/* Active Catalog SKUs count card */}
        <div className="bg-[#1e2020] border border-[#444932] rounded-2xl p-6 relative overflow-hidden group">
          <div className="absolute right-0 top-0 translate-x-3 -translate-y-3 opacity-5">
            <FileText size={120} className="text-white" />
          </div>
          <p className="text-[10px] font-bold font-['JetBrains_Mono'] text-[#c5c9ac] tracking-widest uppercase">Códigos Ativos no Catálogo</p>
          <p className="text-3xl font-black text-[#caf300] italic tracking-tight mt-2 font-['JetBrains_Mono']">
            {totalItems} <span className="text-xs not-italic font-bold text-[#c5c9ac] tracking-normal uppercase">SKUs</span>
          </p>
          <div className="flex items-center gap-2 mt-4 text-[11px] text-[#c5c9ac]">
            Total de categorias: <span className="font-bold text-white">7 ativas</span>
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div className="bg-[#1e2020] border border-[#444932] rounded-2xl p-6 relative overflow-hidden group">
          <div className="absolute right-0 top-0 translate-x-3 -translate-y-3 opacity-5">
            <AlertTriangle size={120} className="text-red-400" />
          </div>
          <p className="text-[10px] font-bold font-['JetBrains_Mono'] text-red-400 tracking-widest uppercase">Estoque de Segurança Atingido</p>
          <p className="text-3xl font-black text-white italic tracking-tight mt-2 font-['JetBrains_Mono']">
            {lowStockCount} <span className="text-xs not-italic font-bold text-red-400 tracking-normal uppercase">Itens</span>
          </p>
          <div className="flex items-center gap-2 mt-4 text-[11px] text-red-400">
            Necessitam de novas compras urgentes
          </div>
        </div>
      </div>

      {/* Tabs selector */}
      <div className="flex border-b border-[#444932]">
        <button
          onClick={() => setActiveTab('items')}
          className={clsx(
            "px-6 py-3 font-bold text-xs tracking-widest uppercase font-['JetBrains_Mono'] border-b-2 transition-all",
            activeTab === 'items'
              ? "border-[#caf300] text-[#caf300]"
              : "border-transparent text-[#c5c9ac] hover:text-white"
          )}
        >
          Inventário Atual (Saldos)
        </button>

        <button
          onClick={() => setActiveTab('catalog')}
          className={clsx(
            "px-6 py-3 font-bold text-xs tracking-widest uppercase font-['JetBrains_Mono'] border-b-2 transition-all flex items-center gap-2",
            activeTab === 'catalog'
              ? "border-[#caf300] text-[#caf300]"
              : "border-transparent text-[#c5c9ac] hover:text-white"
          )}
        >
          <Boxes size={14} /> Cadastro de Produtos (SKU)
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={clsx(
            "px-6 py-3 font-bold text-xs tracking-widest uppercase font-['JetBrains_Mono'] border-b-2 transition-all flex items-center gap-2",
            activeTab === 'history'
              ? "border-[#caf300] text-[#caf300]"
              : "border-transparent text-[#c5c9ac] hover:text-white"
          )}
        >
          <History size={14} /> Log de Movimentações
        </button>
      </div>

      {/* Tab: Items list (Balances) */}
      {activeTab === 'items' && (
        <div className="bg-[#1e2020] border border-[#444932] rounded-2xl overflow-hidden shadow-xl">
          
          {/* Filtering Rail */}
          <div className="p-4 border-b border-[#444932] bg-[#282a2b] flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="flex items-center bg-[#0c0f0f] border border-[#444932] rounded-xl px-3 py-2 w-full max-w-sm focus-within:border-[#caf300] transition-all">
              <Search size={14} className="text-[#c5c9ac] mr-2" />
              <input 
                type="text" 
                placeholder="BUSCAR CÓDIGO, PEÇA OU CATEGORIA..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-transparent border-none focus:ring-0 text-xs text-white w-full uppercase font-bold outline-none" 
              />
            </div>

            <div className="flex flex-wrap gap-2 w-full md:w-auto">
              {/* Location Select filter */}
              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="bg-[#0c0f0f] border border-[#444932] text-xs font-bold text-[#c5c9ac] rounded-xl px-3 py-2 uppercase font-['JetBrains_Mono'] outline-none"
              >
                <option value="ALL">Locais: Todos</option>
                <option value="Estoque Geral">Estoque Geral</option>
                <option value="Recebimento - 10500">Recebimento - 10500</option>
                <option value="Penal">Penal</option>
              </select>

              {/* Category Select Filter */}
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="bg-[#0c0f0f] border border-[#444932] text-xs font-bold text-[#c5c9ac] rounded-xl px-3 py-2 uppercase font-['JetBrains_Mono'] outline-none"
              >
                <option value="ALL">Categoria: Todas</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>

              {/* Low stock checkbox indicator */}
              <button
                onClick={() => setShowLowStockOnly(!showLowStockOnly)}
                className={clsx(
                  "text-xs font-bold font-['JetBrains_Mono'] px-3 py-2 rounded-xl border transition-all uppercase flex items-center gap-1.5",
                  showLowStockOnly 
                    ? "bg-red-950/40 text-red-400 border-red-500" 
                    : "bg-[#0c0f0f] text-[#c5c9ac] border-[#444932]"
                )}
              >
                🚨 Mínimo Atingido
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-[#c5c9ac] font-['JetBrains_Mono'] text-xs uppercase animate-pulse">
                <Loader2 className="animate-spin text-[#caf300]" size={36} />
                <span>Carregando saldos em estoque...</span>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center text-[#c5c9ac] font-['JetBrains_Mono'] text-xs uppercase">
                <span>Nenhum item cadastrado com os filtros correspondentes</span>
              </div>
            ) : (
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-[#333535] text-[#c5c9ac] text-[10px] uppercase font-bold tracking-widest border-b border-[#444932]">
                    <th className="px-6 py-4">Código</th>
                    <th className="px-6 py-4">Descrição</th>
                    <th className="px-6 py-4">Categoria / Localização</th>
                    <th className="px-6 py-4 text-center">Quantidade</th>
                    <th className="px-6 py-4 text-center">Estoque Mínimo</th>
                    <th className="px-6 py-4 text-center">Status</th>
                    <th className="px-6 py-4 text-right">Preço Un. / Total</th>
                    {isAdmin && <th className="px-6 py-4 text-right">Ações</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#444932]">
                  {filteredItems.map((item) => {
                    const totalVal = item.quantity * item.unit_price;
                    
                    // Rules:
                    // 1. Saldo atual <= estoque mínimo => status "Comprar"
                    // 2. Saldo atual <= estoque mínimo * 1.5 (ou seja, estoque mínimo representa pelo menos 2/3 do saldo atual) => status "Atenção"
                    // 3. Caso contrário => status "OK"
                    let statusText = 'OK';
                    let statusColorClass = 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/40';
                    
                    if (item.quantity <= item.min_stock) {
                      statusText = 'Comprar';
                      statusColorClass = 'bg-red-950 text-red-400 border border-red-500 animate-pulse';
                    } else if (item.quantity <= item.min_stock * 1.5) {
                      statusText = 'Atenção';
                      statusColorClass = 'bg-amber-950 text-amber-400 border border-amber-500/40';
                    }

                    return (
                      <tr 
                        key={item.id} 
                        className={clsx(
                          "hover:bg-[#282a2b]/60 transition-colors duration-150 text-xs font-['JetBrains_Mono']",
                          item.quantity === 0 && "opacity-60 bg-black/10"
                        )}
                      >
                        <td className="px-6 py-4 font-black text-white uppercase">{item.code}</td>
                        <td className="px-6 py-4 text-[#e2e2e2] font-sans font-medium uppercase tracking-tight">{item.name}</td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1 items-start">
                            <span className="bg-[#0c0f0f] border border-[#444932] px-2 py-0.5 rounded text-[9px] text-[#c5c9ac] uppercase font-black">
                              {item.category}
                            </span>
                            <span className="text-[#c5c9ac] text-[10px] flex items-center gap-1">
                              <MapPin size={10} />
                              {item.location}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center text-white">
                          <span className="text-sm font-black px-2.5 py-0.5 rounded-full inline-block bg-[#0c0f0f] border border-[#444932]">
                            {item.quantity} U
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center text-white font-bold">
                          {item.min_stock} U
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={clsx(
                            "px-3 py-1 rounded-full text-[10px] font-black uppercase inline-flex items-center gap-1.5 shadow-sm",
                            statusColorClass
                          )}>
                            {statusText === 'Comprar' && <AlertTriangle size={11} className="text-red-400 animate-bounce" />}
                            {statusText}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="text-[11px] text-gray-400">
                            Un: R$ {item.unit_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </div>
                          <div className="font-black text-[#caf300]">
                            Total: R$ {totalVal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </div>
                        </td>
                        {isAdmin && (
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {item.quantity > 0 ? (
                                <button
                                  onClick={() => handleFastZeroBalance(item)}
                                  className="bg-amber-600/20 text-amber-300 border border-amber-600 hover:bg-amber-600 hover:text-[#121414] px-2.5 py-1.5 rounded-lg text-[9px] font-black tracking-widest uppercase transition-all flex items-center gap-1 shrink-0"
                                  title="Zerar imediatamente o saldo físico desta filial"
                                >
                                  <Scale size={11} />
                                  ZERAR SALDO
                                </button>
                              ) : (
                                <span className="text-[9px] font-extrabold text-emerald-400 bg-emerald-950/40 border border-emerald-900/40 px-2 py-1 rounded text-center shrink-0">
                                  ✓ SALDO ZERADO
                                </span>
                              )}

                              <button
                                onClick={() => handleOpenAdjustItem(item)}
                                className="text-xs font-bold text-[#c5c9ac] hover:text-[#caf300] bg-[#282a2b] hover:bg-[#333535] p-2 rounded-lg transition-all border border-[#444932]"
                                title="Registrar ajuste manual"
                              >
                                <TrendingDown size={14} />
                              </button>

                              <button
                                onClick={() => handleOpenEditItem(item)}
                                className="text-xs font-bold text-[#c5c9ac] hover:text-white bg-[#282a2b] hover:bg-[#333535] p-2 rounded-lg transition-all border border-[#444932]"
                                title="Editar metadata da peça"
                              >
                                <Edit3 size={14} />
                              </button>

                              <button
                                onClick={() => handleDeleteItem(item.id, item.name)}
                                className="text-xs font-bold text-[#ffb4ab] hover:text-red-500 bg-[#282a2b] hover:bg-black/40 p-2 rounded-lg transition-all border border-[#444932]"
                                title="Excluir do catálogo"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Tab: Cadastro de Produtos (SKU) */}
      {activeTab === 'catalog' && (
        <div className="bg-[#1e2020] border border-[#444932] rounded-2xl overflow-hidden shadow-xl animate-fade-in">
          
          {/* Filtering Rail */}
          <div className="p-4 border-b border-[#444932] bg-[#282a2b] flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="flex items-center bg-[#0c0f0f] border border-[#444932] rounded-xl px-3 py-2.5 w-full max-w-sm focus-within:border-[#caf300] transition-all">
              <Search size={14} className="text-[#c5c9ac] mr-2" />
              <input 
                type="text" 
                placeholder="BUSCAR SKU OU DESCRIÇÃO NO CATÁLOGO..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-transparent border-none focus:ring-0 text-xs text-white w-full uppercase font-bold outline-none font-['JetBrains_Mono'] placeholder-[#c5c9ac]/30" 
              />
            </div>

            <div className="flex flex-wrap gap-2 w-full md:w-auto">
              {/* Category Select Filter */}
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="bg-[#0c0f0f] border border-[#444932] text-xs font-bold text-[#c5c9ac] rounded-xl px-3 py-2 uppercase font-['JetBrains_Mono'] outline-none"
              >
                <option value="ALL">Categoria: Todas</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>

              {isAdmin && (
                <button
                  onClick={handleOpenNewItem}
                  className="bg-[#caf300] text-[#121414] text-xs font-black tracking-widest uppercase px-4 py-2 rounded-xl hover:brightness-110 flex items-center gap-1.5 transition-all"
                >
                  <Plus size={14} /> CADASTRAR SKU
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-[#c5c9ac] font-['JetBrains_Mono'] text-xs uppercase animate-pulse">
                <Loader2 className="animate-spin text-[#caf300]" size={36} />
                <span>Carregando catálogo de SKU...</span>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center text-[#c5c9ac] font-['JetBrains_Mono'] text-xs uppercase">
                <span>Nenhum SKU encontrado com o padrão pesquisado</span>
              </div>
            ) : (
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-[#333535] text-[#c5c9ac] text-[10px] uppercase font-bold tracking-widest border-b border-[#444932]">
                    <th className="px-6 py-4">Código SKU</th>
                    <th className="px-6 py-4">Descrição da Peça</th>
                    <th className="px-6 py-4">Categoria / Local Padrão</th>
                    <th className="px-6 py-4 text-center">Mínimo Segurança</th>
                    <th className="px-6 py-4 text-right">Preço de Referência</th>
                    {isAdmin && <th className="px-6 py-4 text-center">Ações</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#444932]">
                  {filteredItems.map((item) => (
                    <tr 
                      key={item.id} 
                      className="hover:bg-[#282a2b]/60 transition-colors duration-150 text-xs font-['JetBrains_Mono']"
                    >
                      <td className="px-6 py-4 font-black text-[#caf300] uppercase">{item.code}</td>
                      <td className="px-6 py-4 text-[#e2e2e2] font-sans font-bold uppercase tracking-tight">{item.name}</td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1 items-start">
                          <span className="bg-[#0c0f0f] border border-[#444932] px-2 py-0.5 rounded text-[9px] text-[#c5c9ac] uppercase font-black">
                            {item.category}
                          </span>
                          <span className="text-[#c5c9ac] text-[10px] flex items-center gap-1 font-sans">
                            <MapPin size={10} />
                            {item.location}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center text-white font-black">
                        {item.min_stock} U
                      </td>
                      <td className="px-6 py-4 text-right text-gray-200 font-bold">
                        R$ {item.unit_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                      {isAdmin && (
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleOpenEditItem(item)}
                              className="text-xs font-bold text-[#c5c9ac] hover:text-white bg-[#282a2b] hover:bg-[#333535] p-2 rounded-lg transition-all border border-[#444932]"
                              title="Editar SKU"
                            >
                              <Edit3 size={14} />
                            </button>

                            <button
                              onClick={() => handleDeleteItem(item.id, item.name)}
                              className="text-xs font-bold text-[#ffb4ab] hover:text-red-500 bg-[#282a2b] hover:bg-black/40 p-2 rounded-lg transition-all border border-[#444932]"
                              title="Remover do Catálogo"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Tab: Operations History */}
      {activeTab === 'history' && (
        <div className="bg-[#1e2020] border border-[#444932] rounded-2xl overflow-hidden shadow-xl">
          <div className="p-4 bg-[#282a2b] border-b border-[#444932] flex items-center justify-between">
            <span className="text-xs font-black uppercase text-[#caf300] font-['JetBrains_Mono'] tracking-widest flex items-center gap-2">
              <History size={14} /> HISTÓRICO COMPLETO DA AUDITORIA DE PEÇAS
            </span>
            <span className="text-[10px] text-[#c5c9ac] font-['JetBrains_Mono']">Total de {history.length} movimentações de pátio</span>
          </div>

          <div className="overflow-x-auto">
            {history.length === 0 ? (
              <div className="p-12 text-center text-xs text-[#c5c9ac] font-['JetBrains_Mono'] uppercase">
                Pesquisa concluída: Nenhuma movimentação registrada no log de auditoria.
              </div>
            ) : (
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-[#333535] text-[#c5c9ac] text-[10px] uppercase font-bold tracking-widest border-b border-[#444932]">
                    <th className="px-6 py-4">Data / Hora</th>
                    <th className="px-6 py-4">Código SKU</th>
                    <th className="px-6 py-4">Nome da Peça</th>
                    <th className="px-6 py-4">Estoque Setor</th>
                    <th className="px-6 py-4 text-center">Tipo</th>
                    <th className="px-6 py-4 text-center">Quantidade</th>
                    <th className="px-6 py-4 font-sans">Finalidade / Motivo da Ação</th>
                    <th className="px-6 py-4 text-right">Operador</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#444932]">
                  {history.map((log) => {
                    const isEntrada = log.type === 'entrada';
                    const isSaida = log.type === 'saida';
                    return (
                      <tr key={log.id} className="hover:bg-[#282a2b]/30 text-xs font-['JetBrains_Mono'] transition-colors duration-100">
                        <td className="px-6 py-4 text-gray-400">
                          {new Date(log.created_at).toLocaleString('pt-BR')}
                        </td>
                        <td className="px-6 py-4 font-bold text-white uppercase">{log.item_code}</td>
                        <td className="px-6 py-4 text-gray-300 font-sans uppercase font-medium">{log.item_name}</td>
                        <td className="px-6 py-4">
                          <span className="text-[#c5c9ac] flex items-center gap-1">
                            <MapPin size={10} />
                            {log.location}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={clsx(
                            "px-2 py-0.5 rounded text-[8px] font-black uppercase flex items-center gap-1 w-fit mx-auto",
                            isEntrada 
                              ? "bg-emerald-950 text-emerald-400 border border-emerald-800" 
                              : isSaida 
                              ? "bg-amber-950 text-amber-400 border border-amber-800"
                              : "bg-blue-950 text-blue-400 border border-blue-800"
                          )}>
                            {isEntrada ? <ArrowUpRight size={10} /> : <ArrowDownLeft size={10} />}
                            {log.type}
                          </span>
                        </td>
                        <td className={clsx(
                          "px-6 py-4 text-center text-sm font-black",
                          isEntrada ? "text-emerald-400" : "text-amber-400"
                        )}>
                          {isEntrada ? '+' : '-'}{log.quantity}
                        </td>
                        <td className="px-6 py-4 text-gray-300 max-w-sm truncate uppercase tracking-tight font-sans" title={log.reason}>
                          {log.reason}
                        </td>
                        <td className="px-6 py-4 text-right text-[#caf300] font-black uppercase">
                          {log.user_name}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* MODAL 1: Cadastro ou Edição de Item */}
      {showItemModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#1e2020] border-2 border-[#444932] rounded-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 bg-[#282a2b] border-b border-[#444932] flex items-center justify-between">
              <h3 className="text-lg font-black italic text-white uppercase flex items-center gap-2">
                <Boxes className="text-[#caf300]" size={20} />
                {editingItem ? 'ALTERAR ITEM EM ESTOQUE' : 'CADASTRAR NOVO ITEM'}
              </h3>
              <button 
                onClick={() => setShowItemModal(false)}
                className="text-[#c5c9ac] hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold font-['JetBrains_Mono'] text-[#c5c9ac] uppercase mb-1.5">Código / SKU*</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: FIL-H10"
                    value={itemFormData.code}
                    onChange={(e) => setItemFormData({...itemFormData, code: e.target.value})}
                    className="w-full bg-[#0c0f0f] border border-[#444932] rounded-xl px-4 py-2 text-xs text-white uppercase focus:border-[#caf300] focus:ring-1 focus:ring-[#caf300] outline-none font-bold font-['JetBrains_Mono']"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold font-['JetBrains_Mono'] text-[#c5c9ac] uppercase mb-1.5">Categoria</label>
                  <select
                    value={itemFormData.category}
                    onChange={(e) => setItemFormData({...itemFormData, category: e.target.value})}
                    className="w-full bg-[#0c0f0f] border border-[#444932] rounded-xl px-4 py-2 text-xs text-white focus:border-[#caf300] focus:ring-1 focus:ring-[#caf300] outline-none font-bold"
                  >
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold font-['JetBrains_Mono'] text-[#c5c9ac] uppercase mb-1.5">Descrição da Peça*</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: FILTRO DE RETORNO HIDRÁULICO DO MASTRO"
                  value={itemFormData.name}
                  onChange={(e) => setItemFormData({...itemFormData, name: e.target.value})}
                  className="w-full bg-[#0c0f0f] border border-[#444932] rounded-xl px-4 py-2 text-xs text-white uppercase focus:border-[#caf300] focus:ring-1 focus:ring-[#caf300] outline-none font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold font-['JetBrains_Mono'] text-[#c5c9ac] uppercase mb-1.5">Alocação / Localização</label>
                  <select
                    value={itemFormData.location}
                    onChange={(e) => setItemFormData({...itemFormData, location: e.target.value})}
                    className="w-full bg-[#0c0f0f] border border-[#444932] rounded-xl px-4 py-2 text-xs text-white focus:border-[#caf300] focus:ring-1 focus:ring-[#caf300] outline-none font-bold"
                  >
                    <option value="Estoque Geral">Estoque Geral</option>
                    {editingItem && itemFormData.location !== 'Estoque Geral' && (
                      <option value={itemFormData.location}>{itemFormData.location}</option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold font-['JetBrains_Mono'] text-[#c5c9ac] uppercase mb-1.5">Preço Unitário (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={itemFormData.unit_price}
                    onChange={(e) => setItemFormData({...itemFormData, unit_price: Number(e.target.value)})}
                    className="w-full bg-[#0c0f0f] border border-[#444932] rounded-xl px-4 py-2 text-xs text-white focus:border-[#caf300] focus:ring-1 focus:ring-[#caf300] outline-none font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold font-['JetBrains_Mono'] text-[#c5c9ac] uppercase mb-1.5">Quantidade Atual</label>
                  <input
                    type="number"
                    min="0"
                    value={itemFormData.quantity}
                    onChange={(e) => setItemFormData({...itemFormData, quantity: Number(e.target.value)})}
                    className="w-full bg-[#0c0f0f] border border-[#444932] rounded-xl px-4 py-2 text-xs text-white focus:border-[#caf300] focus:ring-1 focus:ring-[#caf300] outline-none font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold font-['JetBrains_Mono'] text-[#c5c9ac] uppercase mb-1.5">Estoque Mínimo</label>
                  <input
                    type="number"
                    min="0"
                    value={itemFormData.min_stock}
                    onChange={(e) => setItemFormData({...itemFormData, min_stock: Number(e.target.value)})}
                    className="w-full bg-[#0c0f0f] border border-[#444932] rounded-xl px-4 py-2 text-xs text-white focus:border-[#caf300] focus:ring-1 focus:ring-[#caf300] outline-none font-bold"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-[#444932] flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setShowItemModal(false)}
                  className="px-4 py-2 text-xs font-bold uppercase text-[#c5c9ac] hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-[#caf300] text-[#121414] px-6 py-2.5 font-bold text-xs tracking-widest uppercase rounded-lg hover:brightness-110 flex items-center gap-2"
                >
                  {loading && <Loader2 className="animate-spin" size={12} />}
                  {editingItem ? 'SALVAR ALTERAÇÕES' : 'CONFIRMAR CADASTRO'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Movimentação ou Ajuste de Saldo */}
      {showAdjustModal && adjustingItem && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#1e2020] border-2 border-[#444932] rounded-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 bg-[#282a2b] border-b border-[#444932] flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-lg font-black italic text-white uppercase flex items-center gap-2">
                  <Scale className="text-[#caf300]" size={18} />
                  AJUSTAR INVENTÁRIO
                </span>
                <span className="text-[10px] text-[#caf300] font-['JetBrains_Mono'] tracking-wider uppercase mt-1">
                  Item: {adjustingItem.code} / {adjustingItem.name}
                </span>
              </div>
              <button 
                onClick={() => setShowAdjustModal(false)}
                className="text-[#c5c9ac] hover:text-white transition-colors"
                disabled={loading}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveAdjustment} className="p-6 space-y-4">
              
              <div className="bg-[#0c0f0f] border border-[#ffbf00]/30 rounded-xl p-3 text-xs text-[#c5c9ac] space-y-1">
                <div className="flex justify-between">
                  <span>Localização Atual:</span>
                  <span className="font-extrabold text-white text-right">{adjustingItem.location}</span>
                </div>
                <div className="flex justify-between">
                  <span>Quantidade Atual:</span>
                  <span className="font-extrabold text-[#caf300]">{adjustingItem.quantity} U</span>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold font-['JetBrains_Mono'] text-[#c5c9ac] uppercase mb-1.5">Tipo de Movimentação</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustFormData({...adjustFormData, type: 'entrada'})}
                    className={clsx(
                      "px-3 py-2 text-xs font-bold font-['JetBrains_Mono'] tracking-wider border rounded-lg uppercase",
                      adjustFormData.type === 'entrada'
                        ? "bg-emerald-950 text-emerald-400 border-emerald-500"
                        : "bg-[#0c0f0f] text-[#c5c9ac] border-[#444932] hover:bg-[#282a2b]"
                    )}
                  >
                    Entrada (+)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustFormData({...adjustFormData, type: 'saida'})}
                    className={clsx(
                      "px-3 py-2 text-xs font-bold font-['JetBrains_Mono'] tracking-wider border rounded-lg uppercase",
                      adjustFormData.type === 'saida'
                        ? "bg-amber-950 text-amber-400 border-amber-500"
                        : "bg-[#0c0f0f] text-[#c5c9ac] border-[#444932] hover:bg-[#282a2b]"
                    )}
                  >
                    Saída (-)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustFormData({...adjustFormData, type: 'ajuste'})}
                    className={clsx(
                      "px-3 py-2 text-xs font-bold font-['JetBrains_Mono'] tracking-wider border rounded-lg uppercase",
                      adjustFormData.type === 'ajuste'
                        ? "bg-blue-950 text-blue-400 border-blue-500"
                        : "bg-[#0c0f0f] text-[#c5c9ac] border-[#444932] hover:bg-[#282a2b]"
                    )}
                  >
                    Ajustar p/
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold font-['JetBrains_Mono'] text-[#c5c9ac] uppercase mb-1.5">
                    {adjustFormData.type === 'ajuste' ? 'Ajustar Para Saldo' : 'Quantidade'}
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    placeholder="Quantidade"
                    value={adjustFormData.quantity || ''}
                    onChange={(e) => setAdjustFormData({...adjustFormData, quantity: Number(e.target.value)})}
                    className="w-full bg-[#0c0f0f] border border-[#444932] rounded-xl px-4 py-2 text-xs text-white focus:border-[#caf300] focus:ring-1 focus:ring-[#caf300] outline-none font-bold"
                  />
                </div>
                
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => setAdjustFormData({
                      ...adjustFormData, 
                      quantity: adjustingItem.quantity,
                      type: 'saida',
                      reason: `Regularização de saldo do Recebimento 10500 (Zerar estoque Penal)`
                    })}
                    className="bg-amber-600/20 text-amber-400 border border-amber-600/30 hover:bg-amber-600 hover:text-[#121414] transition-all px-3 py-2.5 rounded-xl w-full text-[10px] font-extrabold uppercase text-center"
                  >
                    Zerar Saldo Total
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold font-['JetBrains_Mono'] text-[#c5c9ac] uppercase mb-1.5">Motivo / Justificativa*</label>
                <textarea
                  required
                  rows={2}
                  placeholder="Justifique o motivo do ajuste físico"
                  value={adjustFormData.reason}
                  onChange={(e) => setAdjustFormData({...adjustFormData, reason: e.target.value})}
                  className="w-full bg-[#0c0f0f] border border-[#444932] rounded-xl px-4 py-2 text-xs text-white focus:border-[#caf300] focus:ring-1 focus:ring-[#caf300] outline-none font-bold"
                />
              </div>

              <div className="pt-4 border-t border-[#444932] flex gap-3 justify-end font-sans">
                <button
                  type="button"
                  onClick={() => setShowAdjustModal(false)}
                  className="px-4 py-2 text-xs font-bold uppercase text-[#c5c9ac] hover:text-white"
                  disabled={loading}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-[#caf300] text-[#121414] px-6 py-2.5 font-bold text-xs tracking-widest uppercase rounded-lg hover:brightness-110 flex items-center gap-2"
                >
                  {loading && <Loader2 className="animate-spin" size={12} />}
                  REGISTRAR
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: LANÇAMENTO DE ENTRADA (NF) */}
      {showEntryModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-[#1e2020] border-2 border-[#444932] rounded-2xl w-full max-w-lg overflow-hidden shrink-0">
            <div className="p-6 bg-[#282a2b] border-b border-[#444932] flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black italic text-white uppercase flex items-center gap-2">
                  <FileSpreadsheet className="text-[#caf300]" size={20} />
                  LANÇAR ENTRADA DE MATERIAL (NF)
                </h3>
                <p className="text-[10px] text-[#c5c9ac] uppercase font-['JetBrains_Mono'] tracking-wide mt-1">
                  Os valores lançados darão entrada direta e incremental no saldo geral do estoque
                </p>
              </div>
              <button 
                onClick={() => setShowEntryModal(false)}
                className="text-[#c5c9ac] hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveEntry} className="p-6 space-y-4">
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold font-['JetBrains_Mono'] text-[#c5c9ac] uppercase mb-1.5">
                    <Calendar size={10} className="inline mr-1" /> Data do Lançamento*
                  </label>
                  <input
                    type="date"
                    required
                    value={entryFormData.date}
                    onChange={(e) => setEntryFormData({...entryFormData, date: e.target.value})}
                    className="w-full bg-[#0c0f0f] border border-[#444932] rounded-xl px-4 py-2 text-xs text-white uppercase focus:border-[#caf300] focus:ring-1 focus:ring-[#caf300] outline-none font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold font-['JetBrains_Mono'] text-[#c5c9ac] uppercase mb-1.5">
                    <FileText size={10} className="inline mr-1" /> Número da Nota Fiscal (NF)*
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: NF-12543"
                    value={entryFormData.invoice_number}
                    onChange={(e) => setEntryFormData({...entryFormData, invoice_number: e.target.value})}
                    className="w-full bg-[#0c0f0f] border border-[#444932] rounded-xl px-4 py-2 text-xs text-white uppercase focus:border-[#caf300] focus:ring-1 focus:ring-[#caf300] outline-none font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold font-['JetBrains_Mono'] text-[#c5c9ac] uppercase mb-1.5">
                  <Truck size={10} className="inline mr-1" /> Fornecedor*
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: DISTRIBUIDORA DE PEÇAS BRASIL LTDA"
                  value={entryFormData.supplier}
                  onChange={(e) => setEntryFormData({...entryFormData, supplier: e.target.value})}
                  className="w-full bg-[#0c0f0f] border border-[#444932] rounded-xl px-4 py-2 text-xs text-white uppercase focus:border-[#caf300] focus:ring-1 focus:ring-[#caf300] outline-none font-bold"
                />
              </div>

              <div className="p-3 bg-red-950/10 border border-[#444932] rounded-xl space-y-3">
                <span className="text-[10px] font-black text-[#caf300] uppercase font-['JetBrains_Mono'] tracking-wider block">
                  Autocompletar com Peça em Catálogo (Opcional)
                </span>
                <select
                  onChange={(e) => {
                    const selectedId = e.target.value;
                    if (!selectedId) return;
                    const matched = items.find(i => i.id === selectedId);
                    if (matched) {
                      setEntryFormData({
                        ...entryFormData,
                        item_code: matched.code,
                        item_name: matched.name
                      });
                    }
                  }}
                  className="w-full bg-[#0c0f0f] border border-[#444932] text-xs font-bold text-gray-300 rounded-xl px-3 py-2 uppercase font-['JetBrains_Mono'] outline-none"
                >
                  <option value="">Escolher Peça para Autofill...</option>
                  {items.map(item => (
                    <option key={item.id} value={item.id}>{item.code} - {item.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-1">
                  <label className="block text-[10px] font-bold font-['JetBrains_Mono'] text-[#c5c9ac] uppercase mb-1.5">Código / SKU*</label>
                  <input
                    type="text"
                    required
                    placeholder="FIL-H10"
                    value={entryFormData.item_code}
                    onChange={(e) => setEntryFormData({...entryFormData, item_code: e.target.value})}
                    className="w-full bg-[#0c0f0f] border border-[#444932] rounded-xl px-4 py-2 text-xs text-white uppercase focus:border-[#caf300] focus:ring-1 focus:ring-[#caf300] outline-none font-bold font-['JetBrains_Mono']"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-[10px] font-bold font-['JetBrains_Mono'] text-[#c5c9ac] uppercase mb-1.5">Descrição Física do Item*</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: FILTRO MASTRO"
                    value={entryFormData.item_name}
                    onChange={(e) => setEntryFormData({...entryFormData, item_name: e.target.value})}
                    className="w-full bg-[#0c0f0f] border border-[#444932] rounded-xl px-4 py-2 text-xs text-white uppercase focus:border-[#caf300] focus:ring-1 focus:ring-[#caf300] outline-none font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold font-['JetBrains_Mono'] text-[#c5c9ac] uppercase mb-1.5">Quantidade Fornecida (Unidades)*</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={entryFormData.quantity}
                  onChange={(e) => setEntryFormData({...entryFormData, quantity: Number(e.target.value)})}
                  className="w-full bg-[#0c0f0f] border border-[#444932] rounded-xl px-4 py-2 text-xs text-white focus:border-[#caf300] focus:ring-1 focus:ring-[#caf300] outline-none font-bold"
                />
              </div>

              <div className="pt-4 border-t border-[#444932] flex gap-3 justify-end font-sans">
                <button
                  type="button"
                  onClick={() => setShowEntryModal(false)}
                  className="px-4 py-2 text-xs font-bold uppercase text-[#c5c9ac] hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-[#caf300] text-[#121414] px-6 py-2.5 font-bold text-xs tracking-widest uppercase rounded-lg hover:brightness-110 flex items-center gap-2"
                >
                  {loading && <Loader2 className="animate-spin" size={12} />}
                  REGISTRAR ENTRADA
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
