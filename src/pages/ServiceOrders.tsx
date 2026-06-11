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

  // Diagnostic states
  const [diagnosticOpen, setDiagnosticOpen] = useState(false);
  const [diagnosticEmail, setDiagnosticEmail] = useState('');
  const [diagnosticLogs, setDiagnosticLogs] = useState<string[]>([]);
  const [diagnosticIsSending, setDiagnosticIsSending] = useState(false);

  const handleRunDiagnostic = async () => {
    if (!diagnosticEmail) {
      alert('Por favor, informe seu e-mail para o teste.');
      return;
    }
    
    setDiagnosticIsSending(true);
    const logs: string[] = [];
    const addLog = (msg: string) => {
      logs.push(`[${new Date().toLocaleTimeString()}] ${msg}`);
      setDiagnosticLogs([...logs]);
    };

    addLog('Iniciando diagnóstico técnico de envio de e-mail...');

    const rawUrl = import.meta.env.VITE_GMAIL_SCRIPT_URL || '';
    const gmailScriptUrl = rawUrl.trim();
    addLog(`VITE_GMAIL_SCRIPT_URL detectado: ${gmailScriptUrl ? 'Sim (Preenchido)' : 'Não (Vazio)'}`);
    
    if (gmailScriptUrl) {
      addLog(`URL do script (tratada/sem espaços): "${gmailScriptUrl.substring(0, Math.min(45, gmailScriptUrl.length))}..."`);
      
      if (rawUrl !== gmailScriptUrl) {
        addLog('⚠️ AVISO DE FORMATO: A URL configurada contém espaços extras ou quebra de linha nas pontas. Corrigimos isso automaticamente no envio, mas sugerimos salvar sem espaços no painel de ambiente.');
      }
      
      if (!gmailScriptUrl.startsWith('https://script.google.com/')) {
        addLog('⚠️ ALERTA CRÍTICO: A URL configurada não começa com "https://script.google.com/". Certifique-se de que copiou o Link do Web App gerado no Passo "Implantar > Nova implantação".');
      }
      
      if (!gmailScriptUrl.endsWith('/exec')) {
        addLog('❌ ERRO GRAVE DE FORMATO: A URL detectada não termina com "/exec". Endpoints do Google Apps Script precisam obrigatoriamente terminar com "/exec" para processar requisições. Se sua URL termina com "/edit" ou "/dev", o Google vai recusar ou ignorar o carregamento do payload!');
      }
    } else {
      addLog('ERRO CRÍTICO: VITE_GMAIL_SCRIPT_URL não foi preenchida! Preencha na Vercel e salve no painel de segredos do AI Studio.');
      setDiagnosticIsSending(false);
      return;
    }

    addLog(`Preparando payload de teste de email para: ${diagnosticEmail}`);
    const testPayload = {
      to: diagnosticEmail,
      subject: '[TESTE DE CONEXÃO] Diagnóstico PD Manutenção',
      htmlBody: `
        <div style="font-family: Arial, sans-serif; padding: 25px; background-color: #f4f6f7; border-radius: 12px; border: 1px solid #e1e8ed; max-width: 500px; margin: 0 auto; color: #333;">
          <div style="background-color: #121414; padding: 15px; text-align: center; border-radius: 8px 8px 0 0; color: #fff;">
            <h2 style="color: #caf300; margin: 0; font-size: 18px; text-transform: uppercase;">PD Empilhadeiras</h2>
          </div>
          <div style="padding: 20px; background-color: #ffffff; border-radius: 0 0 8px 8px; border: 1px solid #e2e8f0; border-top: 0;">
            <p style="font-size: 14px; line-height: 1.6; color: #334155;">Olá!</p>
            <p style="font-size: 14px; line-height: 1.6; color: #334155;">Este é um <strong>e-mail de teste síncrono</strong> disparado diretamente pelo painel de diagnóstico técnico do sistema de gerenciamento de frotas <strong>PD Manutenção</strong>.</p>
            <p style="font-size: 13px; color: #00c853; font-weight: bold;">✓ Se você recebeu esta mensagem, sua integração com o Google Apps Script está operando perfeitamente!</p>
            <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
            <p style="font-size: 11px; color: #64748b; text-align: center; margin: 0;">Disparado em: ${new Date().toLocaleString('pt-BR')}</p>
          </div>
        </div>
      `,
      fromName: 'PD Manutenção (Diagnóstico)'
    };

    try {
      addLog('Disparando requisição HTTP POST para o Google Apps Script...');
      addLog('Usando modo "no-cors" para o fetch. Isso permite que a requisição seja entregue com sucesso, mesmo que o script do Google não exponha cabeçalhos CORS explícitos.');
      
      await fetch(gmailScriptUrl, {
        method: 'POST',
        mode: 'no-cors',
        body: JSON.stringify(testPayload)
      });

      addLog('Requisição concluída! Tipo de resposta recebido: "opaque" (comportamento nativo seguro do navegador).');
      addLog('O navegador confirmou a entrega do pacote HTTP POST sem rejeições na rede.');
      addLog('AÇÃO RECOMENDADA: Verifique IMEDIATAMENTE a caixa de entrada da sua conta (e também a caixa de SPAM ou Lixo Eletrônico) para ver se o e-mail chegou.');
      addLog('Processamento encerrado.');
    } catch (err: any) {
      addLog(`MENSAGEM DE ERRO: ${err.message || err.toString()}`);
      addLog('Isso indica que o navegador bloqueou o envio ou a URL informada não pôde ser alcançada.');
    } finally {
      setDiagnosticIsSending(false);
    }
  };

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
      // 1. Fetch latest used parts for this service order to refund them to stock
      const { data: partsToReturn, error: partsFetchError } = await supabase
        .from('used_parts')
        .select('*')
        .eq('service_order_id', orderId);
      
      if (partsFetchError) throw partsFetchError;

      // Fetch the service order details for the log reason
      const { data: orderData } = await supabase
        .from('service_orders')
        .select('title')
        .eq('id', orderId)
        .single();

      const orderTitle = orderData?.title || '';

      // 2. Fetch inventory items to find matches
      const { data: invItems, error: queryErr } = await supabase
        .from('inventory')
        .select('*');

      if (queryErr) throw queryErr;

      if (partsToReturn && partsToReturn.length > 0 && invItems) {
        for (const part of partsToReturn) {
          let parsedCode = '';
          const codeMatch = part.part_name ? part.part_name.match(/^\[(.*?)\]/) : null;
          if (codeMatch && codeMatch[1]) {
            parsedCode = codeMatch[1].trim();
          }

          const matchedItem = invItems.find(i => {
            const itemCodeLower = (i.code || '').toLowerCase().trim();
            const itemNameLower = (i.name || '').toLowerCase().trim();
            const partNameLower = (part.part_name || '').toLowerCase();
            
            if (parsedCode && itemCodeLower === parsedCode.toLowerCase().trim()) {
              return true;
            }
            if (itemNameLower && (partNameLower === itemNameLower || partNameLower.includes(itemNameLower))) {
              return true;
            }
            return false;
          });

          if (matchedItem) {
            // Fetch absolute latest quantity from database of this inventory item to prevent stale cache overwrites
            const { data: dbItemArray } = await supabase
              .from('inventory')
              .select('*')
              .eq('id', matchedItem.id);

            const dbItem = dbItemArray && dbItemArray.length > 0 ? dbItemArray[0] : null;
            const currentQty = dbItem ? Number(dbItem.quantity || 0) : Number(matchedItem.quantity || 0);
            const partQtyToReturn = Number(part.quantity || 0);
            const returnedQty = currentQty + partQtyToReturn;
            
            // Revert inventory quantity with absolute defensive casting
            const { error: updateInvErr } = await supabase
              .from('inventory')
              .update({ quantity: returnedQty })
              .eq('id', matchedItem.id);
            if (updateInvErr) throw updateInvErr;

            // Log history
            const historyLogPayload = {
              item_id: matchedItem.id,
              item_code: matchedItem.code,
              item_name: matchedItem.name,
              type: 'entrada',
              quantity: partQtyToReturn,
              reason: `Retorno ao estoque - Exclusão da OS #${orderId} - ${orderTitle}`,
              location: matchedItem.location,
              user_name: profile?.full_name || 'Administrador',
              created_at: new Date().toISOString()
            };
            await supabase.from('inventory_history').insert([historyLogPayload]);
          }
        }
      }

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
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black italic tracking-tighter text-white">ORDENS DE SERVIÇO</h2>
          <p className="text-[#c5c9ac] font-['JetBrains_Mono'] text-xs uppercase tracking-widest">Execução técnica e monitoramento</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <button 
            onClick={() => {
              setDiagnosticEmail(profile?.email || 'raoniespin@gmail.com');
              setDiagnosticLogs([]);
              setDiagnosticOpen(true);
            }}
            className="bg-[#1e2020] hover:bg-[#282a2b] text-[#c5c9ac] hover:text-white border border-[#444932] hover:border-[#caf300]/40 px-4 py-2 font-bold text-[10px] tracking-widest flex items-center gap-2 rounded-lg cursor-pointer transition-all uppercase"
          >
            <Mail size={14} className="text-[#caf300]" /> Diagnosticar E-mail
          </button>

          <button 
            onClick={() => { setEditingOrder(null); setIsModalOpen(true); }}
            className="bg-[#caf300] text-[#121414] px-4 py-2 font-bold text-[10px] tracking-widest flex items-center gap-2 rounded-lg hover:brightness-110 cursor-pointer"
          >
            <ClipboardList size={14} /> NOVA OS
          </button>
        </div>
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
                    <span className="text-[#caf300] font-bold">DE:</span> Google Apps Script / Conta Google Gmail
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

      {/* DIAGNOSTIC MODAL */}
      <AnimatePresence>
        {diagnosticOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in overflow-y-auto"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-[#121414] border border-[#444932] w-full max-w-2xl flex flex-col shadow-2xl rounded-2xl overflow-hidden max-h-[90vh]"
            >
              <div className="bg-[#1e2020] border-b border-[#444932] p-5 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="bg-[#caf300]/10 p-2 rounded-xl text-[#caf300] border border-[#caf300]/20">
                    <Mail size={18} />
                  </div>
                  <div>
                    <h3 className="text-white font-black text-xs uppercase tracking-wider">Diagnóstico Técnico de E-mail</h3>
                    <p className="text-[#c5c9ac] text-[10px] font-mono">Validação do Google Apps Script Web App</p>
                  </div>
                </div>
                <button 
                  onClick={() => setDiagnosticOpen(false)}
                  className="text-[#c5c9ac] hover:text-white bg-[#282a2b] hover:bg-[#333535] p-2 rounded-xl transition-all cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="flex-1 p-6 space-y-5 overflow-y-auto font-sans text-xs">
                {/* Status Indicator */}
                <div className="bg-[#0c0f0f] border border-[#444932] rounded-xl p-4 space-y-2">
                  <div className="flex justify-between items-center text-[10px] font-mono">
                    <span className="text-[#c5c9ac] uppercase">Configuração Atual:</span>
                    {import.meta.env.VITE_GMAIL_SCRIPT_URL ? (
                      <span className="text-emerald-400 font-bold">✓ CADASTRADA (GMAIL WEB APP)</span>
                    ) : (
                      <span className="text-[#ffb4ab] font-bold">✗ NÃO CADASTRADA (VITE_GMAIL_SCRIPT_URL VAZIA)</span>
                    )}
                  </div>
                  <div className="text-[10px] text-[#c5c9ac] font-mono break-all bg-[#121414] p-2 rounded border border-[#444932]/40">
                    URL: {import.meta.env.VITE_GMAIL_SCRIPT_URL || 'Nenhuma URL preenchida nas variáveis de ambiente (.env ou Vercel)'}
                  </div>
                </div>

                {/* Test Input Form */}
                <div className="space-y-2.5">
                  <h4 className="text-[#caf300] font-black text-[10px] uppercase tracking-wider">Disparar Envio de Teste Imediato</h4>
                  <div className="flex gap-2">
                    <input 
                      type="email" 
                      value={diagnosticEmail}
                      onChange={(e) => setDiagnosticEmail(e.target.value)}
                      placeholder="seu-email@gmail.com"
                      className="flex-1 bg-[#0c0f0f] border border-[#444932] text-[11px] font-mono text-[#e2e2e2] px-3.5 py-2.5 outline-none focus:border-[#caf300] rounded-xl"
                    />
                    <button
                      onClick={handleRunDiagnostic}
                      disabled={diagnosticIsSending}
                      className="bg-[#caf300] text-[#121414] px-5 py-2.5 text-[10px] font-black tracking-widest hover:brightness-110 active:scale-[0.98] rounded-xl disabled:opacity-50 transition-all flex items-center gap-2 cursor-pointer"
                    >
                      {diagnosticIsSending ? (
                        <>
                          <Loader2 size={13} className="animate-spin" /> ENVIANDO...
                        </>
                      ) : (
                        <>
                          <Send size={13} /> ENVIAR TESTE
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Live Output Logs */}
                {diagnosticLogs.length > 0 && (
                  <div className="space-y-1.5">
                    <h4 className="text-white font-black text-[10px] uppercase tracking-wider">Logs da Execução em Tempo Real:</h4>
                    <div className="bg-[#0c0f0f] border border-[#444932] rounded-xl p-4 font-mono text-[10px] text-[#c5c9ac] space-y-1.5 max-h-[160px] overflow-y-auto">
                      {diagnosticLogs.map((log, i) => (
                        <div key={i} className="leading-relaxed whitespace-pre-wrap">{log}</div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Instructions Box */}
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 space-y-3 font-sans">
                  <h4 className="text-yellow-400 font-bold text-[11px] uppercase tracking-wider flex items-center gap-1.5 font-black">
                    ⚠️ GUIA DE CORREÇÃO DO GOOGLE APPS SCRIPT (MUITO IMPORTANTE!)
                  </h4>
                  <p className="text-[#c5c9ac] leading-relaxed text-[11px]">
                    Se o botão acusou sucesso mas o e-mail não chegou na caixa de entrada, o problema está nas permissões da sua publicação Google. Verifique os pontos abaixo:
                  </p>
                  <ol className="list-decimal list-inside space-y-2 text-[#c5c9ac] text-[11px] pl-1">
                    <li>
                      <strong className="text-white">Quem tem acesso:</strong> Ao clicar em <em className="text-yellow-400">Implantar &gt; Nova implantação</em> no editor de Apps Script, certifique-se de configurar a opção <strong className="text-white">"Quem tem acesso" (Who has access)</strong> como <strong className="text-yellow-300">Qualquer pessoa (Anyone)</strong>. Se estiver marcado "Apenas eu", o sistema não conseguirá enviar requisições.
                    </li>
                    <li>
                      <strong className="text-white">Autorização Manual:</strong> Na primeira publicação, o Google exige autorização. Clique em implantar, selecione para prosseguir (<em className="text-[#c5c9ac]">Avançado &gt; Abrir projeto não seguro</em>) e autorize o acesso à sua conta.
                    </li>
                    <li>
                      <strong className="text-white">Atualização de Código:</strong> Se você alterar o código do script no site do Google, <strong className="text-white">salvar não atualiza a URL de envio!</strong> Você precisa clicar em <em className="text-yellow-400 font-black">Implantar &gt; Gerenciar implantações &gt; Editar (ícone de lápis) &gt; Versão: Nova Versão &gt; Implantar</em>.
                    </li>
                  </ol>
                  <div className="bg-[#0c0f0f] p-3 rounded-lg border border-[#444932]/40">
                    <span className="text-white font-bold text-[10px] block mb-1 uppercase tracking-wider">Código recomendado para o seu Google Apps Script:</span>
                    <pre className="text-[#c5c9ac] font-mono text-[9px] overflow-x-auto p-2 bg-[#121414] rounded leading-relaxed select-all">
{`function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    MailApp.sendEmail({
      to: data.to,
      subject: data.subject,
      htmlBody: data.htmlBody,
      name: data.fromName || "PD Manutenção"
    });
    return ContentService.createTextOutput(JSON.stringify({ status: "success" }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}`}
                    </pre>
                  </div>
                </div>
              </div>

              <div className="bg-[#1e2020] border-t border-[#444932] p-4 flex justify-end">
                <button 
                  onClick={() => setDiagnosticOpen(false)}
                  className="bg-[#caf300] text-[#121414] px-6 py-2.5 text-[10px] font-black tracking-widest hover:brightness-110 active:scale-[0.98] rounded-xl transition-all cursor-pointer"
                >
                  FECHAR DIAGNÓSTICO
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
