import React, { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Customer, Machine, Profile, OSStatus, ServiceOrder, ChecklistItem, ChecklistAnswer, ServiceOrderPhoto } from '../types';
import { 
  X, Loader2, AlertCircle, Clock, Trash2, Info, Wrench, ShieldCheck, 
  Camera, PenLine, MapPin, User, CheckCircle2, AlertTriangle, 
  Plus, Upload, ImageIcon, RotateCcw, Save, ClipboardList
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { clsx } from 'clsx';

interface ServiceOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingOrder?: ServiceOrder | null;
  onCheckOut?: (orderId: string) => void;
}

type TabId = 'info' | 'service' | 'preventive' | 'photos' | 'signature';

export function ServiceOrderModal({ isOpen, onClose, onSuccess, editingOrder, onCheckOut }: ServiceOrderModalProps) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [activeTab, setActiveTab] = useState<TabId>('info');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Customer detail for Info tab
  const [customerDetail, setCustomerDetail] = useState<Customer | null>(null);
  const [customerOsCount, setCustomerOsCount] = useState(0);
  const [customerMachineCount, setCustomerMachineCount] = useState(0);
  const [creatorName, setCreatorName] = useState<string | null>(null);

  const isAdmin = profile?.role?.toString().toLowerCase().trim() === 'admin';
  const isEmployee = profile?.role?.toString().toLowerCase().trim() === 'employee';
  const isEditing = !!editingOrder;
  const isReadOnly = isEditing && editingOrder?.status === 'Maintenance Done';
  const isExecuting = isEditing && editingOrder?.status === 'Executing';

  const getInitialFormData = () => ({
    customer_id: '',
    machine_id: '',
    employee_id: '',
    title: '',
    description: '',
    status: 'Pending' as OSStatus,
    work_hours: 0,
    is_preventive: false,
  });

  const [formData, setFormData] = useState(getInitialFormData());

  // Checklist state
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [checklistAnswers, setChecklistAnswers] = useState<Record<string, 'ok' | 'pending'>>({});
  const [savingChecklist, setSavingChecklist] = useState(false);
  const [newItemLabel, setNewItemLabel] = useState('');
  const [addingItem, setAddingItem] = useState(false);

  // Photos state
  const [photos, setPhotos] = useState<ServiceOrderPhoto[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Signature state
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSavedSignature, setHasSavedSignature] = useState(false);
  const [savingSignature, setSavingSignature] = useState(false);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  // Determine which tabs to show
  const showPreventiveTab = formData.is_preventive || editingOrder?.is_preventive;
  const showPhotosTab = isEditing;
  const showSignatureTab = true;

  const tabs: { id: TabId; label: string; icon: React.ElementType; show: boolean }[] = [
    { id: 'info' as TabId, label: 'Info', icon: Info, show: true },
    { id: 'service' as TabId, label: 'Serviço', icon: Wrench, show: true },
    { id: 'preventive' as TabId, label: 'Preventiva', icon: ShieldCheck, show: !!showPreventiveTab },
    { id: 'photos' as TabId, label: 'Fotos', icon: Camera, show: !!showPhotosTab },
    { id: 'signature' as TabId, label: 'Assinatura', icon: PenLine, show: !!showSignatureTab },
  ].filter(t => t.show);

  // Reset on open/close
  useEffect(() => {
    if (isOpen) {
      setError(null);
      setSuccessMsg(null);
      setActiveTab(isEditing ? 'info' : 'service');
      fetchInitialData();
      
      if (editingOrder) {
        setFormData({
          customer_id: editingOrder.customer_id || '',
          machine_id: editingOrder.machine_id || '',
          employee_id: editingOrder.employee_id || '',
          title: editingOrder.title || '',
          description: editingOrder.description || '',
          status: editingOrder.status || 'Pending',
          work_hours: editingOrder.work_hours || 0,
          is_preventive: editingOrder.is_preventive || false,
        });
        fetchChecklistData(editingOrder.id);
        fetchPhotos(editingOrder.id);
        if (editingOrder.vibe_signature) {
          setHasSavedSignature(true);
          setSignatureDataUrl(editingOrder.vibe_signature);
        } else {
          setHasSavedSignature(false);
          setSignatureDataUrl(null);
        }
        if (editingOrder.created_by) {
          fetchCreatorName(editingOrder.created_by);
        }
      } else {
        setFormData(getInitialFormData());
        setChecklistAnswers({});
        setPhotos([]);
        setHasSavedSignature(false);
        setSignatureDataUrl(null);
        setCreatorName(null);
      }
    }
  }, [isOpen, editingOrder]);

  // Fetch customer detail when customer changes
  useEffect(() => {
    if (formData.customer_id) {
      fetchCustomerDetail(formData.customer_id);
    } else {
      setCustomerDetail(null);
    }
  }, [formData.customer_id]);

  // Load signature if exists
  useEffect(() => {
    if (activeTab === 'signature' && signatureDataUrl && canvasRef.current) {
      const img = new Image();
      img.onload = () => {
        const ctx = canvasRef.current?.getContext('2d');
        if (ctx && canvasRef.current) {
          ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
          ctx.drawImage(img, 0, 0);
        }
      };
      img.src = signatureDataUrl;
    }
  }, [activeTab, signatureDataUrl]);

  async function fetchInitialData() {
    try {
      setLoading(true);
      const [customersRes, employeesRes, checklistRes] = await Promise.all([
        supabase.from('customers').select('*').order('name'),
        supabase.from('profiles').select('id, full_name, role').in('role', ['Admin', 'Employee']).eq('is_approved', true).order('full_name'),
        supabase.from('preventive_checklist_items').select('*').eq('is_active', true).order('display_order'),
      ]);

      setCustomers(customersRes.data || []);
      setEmployees(employeesRes.data || []);
      setChecklistItems(checklistRes.data || []);
    } catch (err: any) {
      setError('Erro ao carregar dados.');
    } finally {
      setLoading(false);
    }
  }

  async function fetchCustomerDetail(customerId: string) {
    try {
      const [customerRes, osCountRes, machineCountRes] = await Promise.all([
        supabase.from('customers').select('*').eq('id', customerId).single(),
        supabase.from('service_orders').select('*', { count: 'exact', head: true }).eq('customer_id', customerId),
        supabase.from('machines').select('*', { count: 'exact', head: true }).eq('customer_id', customerId),
      ]);
      if (customerRes.data) setCustomerDetail(customerRes.data);
      setCustomerOsCount(osCountRes.count || 0);
      setCustomerMachineCount(machineCountRes.count || 0);
    } catch {}
  }

  async function fetchCreatorName(creatorId: string) {
    const { data } = await supabase.from('profiles').select('full_name').eq('id', creatorId).single();
    if (data) setCreatorName(data.full_name);
  }

  useEffect(() => {
    if (formData.customer_id) {
      fetchMachines(formData.customer_id);
    } else {
      setMachines([]);
      setFormData(prev => ({ ...prev, machine_id: '' }));
    }
  }, [formData.customer_id]);

  async function fetchMachines(customerId: string) {
    const { data } = await supabase.from('machines').select('id, brand, model, serial_number').eq('customer_id', customerId).order('brand');
    if (data) setMachines(data);
  }

  async function fetchChecklistData(osId: string) {
    const { data } = await supabase.from('preventive_checklist_answers').select('*').eq('service_order_id', osId);
    if (data) {
      const answersMap: Record<string, 'ok' | 'pending'> = {};
      data.forEach((a: ChecklistAnswer) => { answersMap[a.item_id] = a.answer; });
      setChecklistAnswers(answersMap);
    }
  }

  async function fetchPhotos(osId: string) {
    const { data } = await supabase.from('service_order_photos').select('*').eq('service_order_id', osId).order('created_at');
    if (data) setPhotos(data);
  }

  // ——— FORM SUBMIT ———
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading || isReadOnly) return;

    // Block finalization if no signature is saved
    if (formData.status === 'Maintenance Done') {
      if (!signatureDataUrl) {
        setError('A assinatura não foi realizada. Por favor, salve a assinatura na aba de Assinatura antes de alterar o status para "Manutenção Concluída".');
        setActiveTab('signature');
        return;
      }
    }

    // Block finalization if preventive has pending items
    if (formData.status === 'Maintenance Done' && formData.is_preventive && editingOrder) {
      const hasPending = checklistItems.some(item => checklistAnswers[item.id] === 'pending');
      const hasUnanswered = checklistItems.some(item => !checklistAnswers[item.id]);
      if (hasPending || hasUnanswered) {
        setError('Não é possível finalizar: o questionário de manutenção preventiva possui itens pendentes ou não respondidos.');
        setActiveTab('preventive');
        return;
      }
    }

    setLoading(true);
    setError(null);

    try {
      if (!formData.customer_id || !formData.machine_id || !formData.title) {
        throw new Error('Preencha os campos obrigatórios (Cliente, Máquina e Título).');
      }

      const payload: any = {
        customer_id: formData.customer_id,
        machine_id: formData.machine_id,
        employee_id: formData.employee_id || null,
        title: formData.title.toUpperCase(),
        description: formData.description?.toUpperCase() || '',
        status: formData.status,
        work_hours: formData.work_hours || 0,
        is_preventive: formData.is_preventive,
        vibe_signature: signatureDataUrl,
        updated_at: new Date().toISOString(),
      };

      if (isEditing && editingOrder) {
        const { error: updateError } = await supabase.from('service_orders').update(payload).eq('id', editingOrder.id);
        if (updateError) throw updateError;

        // Auto checkout when status becomes 'Maintenance Done'
        if (formData.status === 'Maintenance Done' && editingOrder.status !== 'Maintenance Done' && navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(async (pos) => {
            await supabase.from('service_orders').update({
              check_out_at: new Date().toISOString(),
              check_out_lat: pos.coords.latitude,
              check_out_lng: pos.coords.longitude,
            }).eq('id', editingOrder.id);
          }, () => {
            // Geolocation denied, just update without coords
            supabase.from('service_orders').update({ check_out_at: new Date().toISOString() }).eq('id', editingOrder.id);
          });
        }
      } else {
        payload.created_by = profile?.id || null;
        const { error: insertError } = await supabase.from('service_orders').insert([payload]);
        if (insertError) throw insertError;
      }

      onSuccess();
      onClose();
      setFormData(getInitialFormData());
    } catch (err: any) {
      let msg = isEditing ? 'Erro ao atualizar OS.' : 'Erro ao criar OS.';
      if (err.message?.includes('Preencha')) msg = err.message;
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!editingOrder || !isAdmin) return;
    if (!confirm('Tem certeza que deseja EXCLUIR permanentemente esta Ordem de Serviço?')) return;

    setLoading(true);
    try {
      await supabase.from('used_parts').delete().eq('service_order_id', editingOrder.id);
      await supabase.from('preventive_checklist_answers').delete().eq('service_order_id', editingOrder.id);
      await supabase.from('service_order_photos').delete().eq('service_order_id', editingOrder.id);
      const { error } = await supabase.from('service_orders').delete().eq('id', editingOrder.id);
      if (error) throw error;
      onSuccess();
      onClose();
    } catch (err: any) {
      setError('Erro ao excluir OS: ' + (err.message || ''));
    } finally {
      setLoading(false);
    }
  }

  // ——— CHECKLIST ———
  async function saveChecklist() {
    if (!editingOrder) return;
    const unanswered = checklistItems.filter(item => !checklistAnswers[item.id]);
    if (unanswered.length > 0) {
      setError(`Responda todos os itens do questionário (${unanswered.length} pendente(s)).`);
      return;
    }

    setSavingChecklist(true);
    setError(null);
    try {
      const upserts = checklistItems.map(item => ({
        service_order_id: editingOrder.id,
        item_id: item.id,
        answer: checklistAnswers[item.id],
        answered_by: profile?.id,
        answered_at: new Date().toISOString(),
      }));

      const { error } = await supabase.from('preventive_checklist_answers').upsert(upserts, { onConflict: 'service_order_id,item_id' });
      if (error) throw error;
      setSuccessMsg('Questionário salvo com sucesso!');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setError('Erro ao salvar questionário: ' + (err.message || ''));
    } finally {
      setSavingChecklist(false);
    }
  }

  async function addChecklistItem() {
    if (!newItemLabel.trim() || !isAdmin) return;
    setAddingItem(true);
    try {
      const { data, error } = await supabase.from('preventive_checklist_items').insert([{
        label: newItemLabel.trim(),
        display_order: checklistItems.length + 1,
        is_active: true,
        created_by: profile?.id,
      }]).select().single();
      if (error) throw error;
      if (data) setChecklistItems(prev => [...prev, data]);
      setNewItemLabel('');
    } catch (err: any) {
      setError('Erro ao adicionar item: ' + (err.message || ''));
    } finally {
      setAddingItem(false);
    }
  }

  async function deleteChecklistItem(itemId: string) {
    if (!isAdmin) return;
    if (!confirm('Remover este item do questionário de todas as futuras OS?')) return;
    const { error } = await supabase.from('preventive_checklist_items').update({ is_active: false }).eq('id', itemId);
    if (!error) setChecklistItems(prev => prev.filter(i => i.id !== itemId));
  }

  // ——— PHOTOS ———
  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!editingOrder || !e.target.files?.length) return;
    const file = e.target.files[0];
    if (file.size > 10 * 1024 * 1024) {
      setError('Arquivo muito grande. Máximo 10MB.');
      return;
    }

    setUploadingPhoto(true);
    setError(null);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${editingOrder.id}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = (await supabase.storage.from('service-photos').upload(fileName, file)) as any;
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('service-photos').getPublicUrl(fileName);
      
      const { data, error: dbError } = await supabase.from('service_order_photos').insert([{
        service_order_id: editingOrder.id,
        photo_url: urlData.publicUrl,
        uploaded_by: profile?.id,
      }]).select().single();
      if (dbError) throw dbError;
      if (data) setPhotos(prev => [...prev, data]);
    } catch (err: any) {
      setError('Erro ao enviar foto. Verifique se o bucket "service-photos" existe no Supabase Storage.');
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function deletePhoto(photo: ServiceOrderPhoto) {
    if (!isAdmin && photo.uploaded_by !== profile?.id) return;
    try {
      const path = photo.photo_url.split('/service-photos/')[1];
      if (path) await supabase.storage.from('service-photos').remove([path]);
      await supabase.from('service_order_photos').delete().eq('id', photo.id);
      setPhotos(prev => prev.filter(p => p.id !== photo.id));
    } catch (err: any) {
      setError('Erro ao remover foto.');
    }
  }

  // ——— SIGNATURE CANVAS ———
  const getCanvasPos = (e: React.TouchEvent | React.MouseEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ('touches' in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDraw = (e: React.TouchEvent<HTMLCanvasElement> | React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!canvasRef.current) return;
    setIsDrawing(true);
    lastPos.current = getCanvasPos(e, canvasRef.current);
  };

  const draw = (e: React.TouchEvent<HTMLCanvasElement> | React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isDrawing || !canvasRef.current || !lastPos.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    const pos = getCanvasPos(e, canvasRef.current);
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = '#caf300';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    lastPos.current = pos;
  };

  const endDraw = () => {
    setIsDrawing(false);
    lastPos.current = null;
  };

  const clearSignature = () => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    setSignatureDataUrl(null);
    setHasSavedSignature(false);
  };

  async function saveSignature() {
    if (!canvasRef.current) return;
    setSavingSignature(true);
    try {
      const dataUrl = canvasRef.current.toDataURL('image/png');
      setSignatureDataUrl(dataUrl);
      setHasSavedSignature(true);

      if (isEditing && editingOrder) {
        const { error } = await supabase.from('service_orders').update({
          vibe_signature: dataUrl,
          updated_at: new Date().toISOString(),
        }).eq('id', editingOrder.id);
        if (error) throw error;
      }
      
      setSuccessMsg('Assinatura salva com sucesso!');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setError('Erro ao salvar assinatura.');
    } finally {
      setSavingSignature(false);
    }
  }

  const statusOptions: { value: OSStatus; label: string }[] = [
    { value: 'Pending', label: 'PENDENTE' },
    { value: 'In Route', label: 'EM ROTA' },
    { value: 'Executing', label: 'EXECUTANDO' },
    { value: 'Maintenance Done', label: 'MANUTENÇÃO CONCLUÍDA' },
    { value: 'Cancelled', label: 'CANCELADA' },
  ];

  const inputClass = "w-full bg-[#0c0f0f] border border-[#444932] text-sm text-white px-4 py-3 rounded-xl focus:border-[#caf300] outline-none transition-all disabled:opacity-50";
  const labelClass = "text-[10px] font-bold text-[#c5c9ac] tracking-widest uppercase";

  const hasPendingChecklist = checklistItems.some(i => checklistAnswers[i.id] === 'pending');
  const hasUnansweredChecklist = checklistItems.some(i => !checklistAnswers[i.id]);
  const checklistBlocking = formData.is_preventive && editingOrder && (hasPendingChecklist || hasUnansweredChecklist);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />
          
          <motion.div 
            initial={{ scale: 0.97, opacity: 0, y: 30 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.97, opacity: 0, y: 30 }}
            className="bg-[#1e2020] border border-[#444932] w-full max-w-2xl rounded-t-3xl md:rounded-2xl shadow-2xl overflow-hidden flex flex-col z-10"
            style={{ maxHeight: '92vh' }}
          >
            {/* Header */}
            <div className="p-4 md:p-6 border-b border-[#444932] bg-[#282a2b] flex justify-between items-center shrink-0">
              <div>
                <h3 className="text-lg md:text-xl font-black italic tracking-tighter text-white uppercase">
                  {isReadOnly ? 'Detalhes da OS' : isEditing ? 'Editar OS' : 'Nova Ordem de Serviço'}
                </h3>
                {editingOrder && (
                  <p className="text-[10px] text-[#c5c9ac] font-['JetBrains_Mono'] tracking-widest mt-0.5">
                    OS #{editingOrder.id.slice(0, 8).toUpperCase()}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {isEditing && isAdmin && (
                  <button 
                    onClick={handleDelete}
                    className="text-[#ffb4ab] hover:text-white hover:bg-[#93000a] transition-all p-2 rounded-lg"
                    title="Excluir OS"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
                <button onClick={onClose} className="text-[#c5c9ac] hover:text-white transition-colors p-1">
                  <X size={22} />
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-[#444932] bg-[#1a1c1c] shrink-0 overflow-x-auto">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={clsx(
                    "flex items-center gap-1.5 px-3 md:px-5 py-3 text-[10px] md:text-xs font-bold tracking-widest whitespace-nowrap transition-all border-b-2 relative",
                    activeTab === tab.id
                      ? "text-[#caf300] border-[#caf300] bg-[#1e2020]"
                      : "text-[#c5c9ac] border-transparent hover:text-white hover:bg-[#282a2b]"
                  )}
                >
                  <tab.icon size={13} />
                  {tab.label.toUpperCase()}
                  {tab.id === 'preventive' && checklistBlocking && (
                    <span className="w-2 h-2 bg-[#ffbf00] rounded-full animate-pulse ml-0.5" />
                  )}
                </button>
              ))}
            </div>

            {/* Alerts */}
            <div className="px-4 md:px-6 pt-4 space-y-2 shrink-0">
              {error && (
                <div className="bg-red-500/10 border border-red-500/50 p-3 rounded-xl flex items-center gap-3 text-red-400 text-xs font-bold uppercase tracking-wide">
                  <AlertCircle size={16} className="shrink-0" />
                  <p>{error}</p>
                  <button onClick={() => setError(null)} className="ml-auto"><X size={14} /></button>
                </div>
              )}
              {successMsg && (
                <div className="bg-green-500/10 border border-green-500/50 p-3 rounded-xl flex items-center gap-3 text-green-400 text-xs font-bold uppercase tracking-wide">
                  <CheckCircle2 size={16} className="shrink-0" />
                  <p>{successMsg}</p>
                </div>
              )}
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto">
              
              {/* ——— TAB: INFO ——— */}
              {activeTab === 'info' && (
                <div className="p-4 md:p-6 space-y-5">
                  {!isEditing ? (
                    <div className="text-center py-12 opacity-40">
                      <Info size={36} className="mx-auto mb-3" />
                      <p className="text-sm font-bold uppercase tracking-widest">Crie a OS para ver os detalhes</p>
                    </div>
                  ) : (
                    <>
                      {/* Status badge */}
                      <div className="flex items-center gap-3">
                        <span className={clsx(
                          "px-3 py-1.5 text-[9px] font-black tracking-[0.2em] rounded-lg uppercase",
                          editingOrder?.status === 'Executing' ? 'bg-[#caf300] text-[#121414]' :
                          editingOrder?.status === 'Pending' ? 'bg-[#ffbf00] text-[#121414]' :
                          editingOrder?.status === 'Maintenance Done' ? 'bg-[#00c853] text-[#121414]' :
                          editingOrder?.status === 'Cancelled' ? 'bg-[#ffb4ab] text-[#690005]' :
                          'bg-[#00bcd4] text-[#121414]'
                        )}>
                          {editingOrder?.status === 'Executing' ? 'EXECUTANDO' :
                           editingOrder?.status === 'Pending' ? 'PENDENTE' :
                           editingOrder?.status === 'Maintenance Done' ? 'CONCLUÍDA' :
                           editingOrder?.status === 'Cancelled' ? 'CANCELADA' : 'EM ROTA'}
                        </span>
                        {editingOrder?.is_preventive && (
                          <span className="px-3 py-1.5 text-[9px] font-black tracking-[0.2em] rounded-lg uppercase bg-[#7c3aed] text-white">
                            PREVENTIVA
                          </span>
                        )}
                      </div>

                      {/* Client info */}
                      {customerDetail && (
                        <div className="bg-[#0c0f0f] border border-[#444932] rounded-2xl p-4 space-y-3">
                          <h4 className="text-[10px] font-black text-[#caf300] tracking-widest uppercase flex items-center gap-2">
                            <User size={12} /> DADOS DO CLIENTE
                          </h4>
                          <div className="grid grid-cols-2 gap-3 text-xs">
                            <div>
                              <p className="text-[9px] text-[#c5c9ac] uppercase tracking-widest">Nome</p>
                              <p className="font-bold text-white uppercase">{customerDetail.name}</p>
                            </div>
                            <div>
                              <p className="text-[9px] text-[#c5c9ac] uppercase tracking-widest">Telefone</p>
                              <p className="font-bold text-white">{customerDetail.phone || customerDetail.whatsapp || '—'}</p>
                            </div>
                            <div className="col-span-2">
                              <p className="text-[9px] text-[#c5c9ac] uppercase tracking-widest">Endereço</p>
                              <p className="font-bold text-white">
                                {[customerDetail.street, customerDetail.number, customerDetail.neighborhood, customerDetail.city, customerDetail.state]
                                  .filter(Boolean).join(', ') || '—'}
                              </p>
                            </div>
                            <div>
                              <p className="text-[9px] text-[#c5c9ac] uppercase tracking-widest">Equipamentos</p>
                              <p className="font-bold text-[#caf300]">{customerMachineCount}</p>
                            </div>
                            <div>
                              <p className="text-[9px] text-[#c5c9ac] uppercase tracking-widest">OS Atendidas</p>
                              <p className="font-bold text-[#caf300]">{customerOsCount}</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Timeline */}
                      <div className="bg-[#0c0f0f] border border-[#444932] rounded-2xl p-4 space-y-3">
                        <h4 className="text-[10px] font-black text-[#caf300] tracking-widest uppercase flex items-center gap-2">
                          <Clock size={12} /> HISTÓRICO DE AÇÕES
                        </h4>
                        <div className="space-y-2.5">
                          {/* Created */}
                          <TimelineItem
                            icon={<ClipboardListIcon />}
                            label="OS CRIADA"
                            value={editingOrder?.created_at ? format(new Date(editingOrder.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : '—'}
                            sub={creatorName ? `Por: ${creatorName}` : undefined}
                            color="text-[#c5c9ac]"
                          />
                          {/* Tecnico */}
                          {employees.find(e => e.id === editingOrder?.employee_id) && (
                            <TimelineItem
                              icon={<WrenchIcon />}
                              label="TÉCNICO RESPONSÁVEL"
                              value={employees.find(e => e.id === editingOrder?.employee_id)?.full_name?.toUpperCase() || '—'}
                              color="text-[#00bcd4]"
                            />
                          )}
                          {/* Check-in */}
                          {editingOrder?.check_in_at && (
                            <TimelineItem
                              icon={<MapPin size={12} />}
                              label="CHECK-IN"
                              value={format(new Date(editingOrder.check_in_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                              sub={editingOrder.check_in_lat ? `📍 ${editingOrder.check_in_lat?.toFixed(4)}, ${editingOrder.check_in_lng?.toFixed(4)}` : undefined}
                              color="text-[#caf300]"
                            />
                          )}
                          {/* Check-out */}
                          {editingOrder?.check_out_at && (
                            <TimelineItem
                              icon={<CheckCircle2 size={12} />}
                              label="CHECK-OUT"
                              value={format(new Date(editingOrder.check_out_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                              sub={editingOrder.check_out_lat ? `📍 ${editingOrder.check_out_lat?.toFixed(4)}, ${editingOrder.check_out_lng?.toFixed(4)}` : undefined}
                              color="text-[#00c853]"
                            />
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* ——— TAB: SERVIÇO ——— */}
              {activeTab === 'service' && (
                <form onSubmit={handleSubmit} className="p-4 md:p-6 space-y-5">
                  {isReadOnly && (
                    <div className="bg-[#caf300]/10 border border-[#caf300]/30 p-3 rounded-xl flex items-center gap-3 text-[#caf300] text-xs font-bold uppercase tracking-widest">
                      <AlertCircle size={16} />
                      <p>Ordem finalizada — somente leitura.</p>
                    </div>
                  )}

                  {/* Preventive toggle */}
                  {!isEditing && (
                    <div
                      onClick={() => !isReadOnly && setFormData(prev => ({ ...prev, is_preventive: !prev.is_preventive }))}
                      className={clsx(
                        "flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all",
                        formData.is_preventive
                          ? "bg-[#7c3aed]/20 border-[#7c3aed]"
                          : "bg-[#0c0f0f] border-[#444932] hover:border-[#7c3aed]/50"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <ShieldCheck size={18} className={formData.is_preventive ? "text-[#a78bfa]" : "text-[#c5c9ac]"} />
                        <div>
                          <p className={clsx("text-xs font-bold uppercase tracking-widest", formData.is_preventive ? "text-[#a78bfa]" : "text-[#c5c9ac]")}>
                            Manutenção Preventiva
                          </p>
                          <p className="text-[9px] text-[#c5c9ac] mt-0.5">Ativa questionário de inspeção</p>
                        </div>
                      </div>
                      <div className={clsx(
                        "w-12 h-6 rounded-full transition-all relative",
                        formData.is_preventive ? "bg-[#7c3aed]" : "bg-[#333535]"
                      )}>
                        <div className={clsx(
                          "absolute top-1 w-4 h-4 rounded-full bg-white transition-all",
                          formData.is_preventive ? "left-7" : "left-1"
                        )} />
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className={labelClass}>Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({...formData, status: e.target.value as OSStatus})}
                      disabled={isReadOnly}
                      className={inputClass}
                    >
                      {statusOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className={labelClass}>Cliente *</label>
                      <select
                        required
                        value={formData.customer_id}
                        onChange={(e) => setFormData({...formData, customer_id: e.target.value})}
                        disabled={isReadOnly}
                        className={inputClass}
                      >
                        <option value="">SELECIONE O CLIENTE</option>
                        {customers?.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className={labelClass}>Equipamento *</label>
                      <select
                        required
                        value={formData.machine_id}
                        onChange={(e) => setFormData({...formData, machine_id: e.target.value})}
                        disabled={!formData.customer_id || isReadOnly}
                        className={inputClass}
                      >
                        <option value="">{formData.customer_id ? 'SELECIONE O EQUIPAMENTO' : 'SELECIONE UM CLIENTE PRIMEIRO'}</option>
                        {machines?.map(m => (
                          <option key={m.id} value={m.id}>{m.brand} {m.model} - {m.serial_number}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className={labelClass}>Técnico Responsável</label>
                    <select
                      value={formData.employee_id}
                      onChange={(e) => setFormData({...formData, employee_id: e.target.value})}
                      disabled={isReadOnly}
                      className={inputClass}
                    >
                      <option value="">NÃO ATRIBUÍDO</option>
                      {employees?.map(e => (
                        <option key={e.id} value={e.id}>{e.full_name || 'TÉCNICO'}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className={labelClass}>Título do Serviço *</label>
                    <input
                      type="text"
                      required
                      value={formData.title}
                      onChange={(e) => setFormData({...formData, title: e.target.value.toUpperCase()})}
                      placeholder="Ex: Manutenção Preventiva — 500h"
                      disabled={isReadOnly}
                      className={inputClass + " placeholder:text-[#444932] uppercase"}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className={labelClass + " flex items-center gap-2"}>
                      <Clock size={12} className="text-[#caf300]" />
                      Horas de Trabalho
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={formData.work_hours || ''}
                      onChange={(e) => setFormData({...formData, work_hours: parseFloat(e.target.value) || 0})}
                      placeholder="Ex: 4.5"
                      disabled={isReadOnly}
                      className={inputClass + " placeholder:text-[#444932]"}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className={labelClass}>Descrição / Observações</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({...formData, description: e.target.value.toUpperCase()})}
                      rows={3}
                      placeholder="Descreva o serviço a ser realizado..."
                      disabled={isReadOnly}
                      className={inputClass + " placeholder:text-[#444932] resize-none uppercase"}
                    />
                  </div>

                  {/* Preventive blocking warning */}
                  {checklistBlocking && formData.status === 'Maintenance Done' && (
                    <div className="bg-[#ffbf00]/10 border border-[#ffbf00]/50 p-3 rounded-xl flex items-center gap-3 text-[#ffbf00] text-xs font-bold uppercase tracking-wide">
                      <AlertTriangle size={16} className="shrink-0" />
                      <p>Questionário preventivo com itens pendentes — finalização bloqueada.</p>
                    </div>
                  )}

                  {/* Footer actions */}
                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={onClose}
                      className="flex-1 px-4 py-3.5 text-xs font-bold text-[#c5c9ac] hover:text-white transition-colors uppercase tracking-widest border border-[#444932] rounded-xl hover:bg-[#282a2b]"
                    >
                      {isReadOnly ? 'Fechar' : 'Cancelar'}
                    </button>
                    {!isReadOnly && (
                      <button
                        type="submit"
                        disabled={loading}
                        className="flex-1 bg-[#caf300] text-[#121414] px-4 py-3.5 rounded-xl font-black text-xs tracking-widest uppercase flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50"
                      >
                        {loading ? <Loader2 className="animate-spin" size={16} /> : isEditing ? 'SALVAR ALTERAÇÕES' : 'CRIAR ORDEM DE SERVIÇO'}
                      </button>
                    )}
                  </div>
                </form>
              )}

              {/* ——— TAB: PREVENTIVA ——— */}
              {activeTab === 'preventive' && (
                <div className="p-4 md:p-6 space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-black text-white uppercase tracking-tight">Questionário de Inspeção</h4>
                      <p className="text-[10px] text-[#c5c9ac] mt-0.5">Todas as questões são obrigatórias</p>
                    </div>
                    {editingOrder && !isReadOnly && (
                      <button
                        onClick={saveChecklist}
                        disabled={savingChecklist}
                        className="bg-[#7c3aed] text-white px-4 py-2 rounded-lg text-[10px] font-black tracking-widest uppercase flex items-center gap-2 hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
                      >
                        {savingChecklist ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                        SALVAR
                      </button>
                    )}
                  </div>

                  {/* Progress */}
                  {editingOrder && (
                    <div className="bg-[#0c0f0f] rounded-xl p-3 space-y-2">
                      <div className="flex justify-between text-[9px] font-bold uppercase tracking-widest">
                        <span className="text-[#c5c9ac]">Progresso</span>
                        <span className="text-[#caf300]">
                          {Object.keys(checklistAnswers).length}/{checklistItems.length} respondidos
                        </span>
                      </div>
                      <div className="h-1.5 bg-[#333535] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#caf300] rounded-full transition-all"
                          style={{ width: `${checklistItems.length ? (Object.keys(checklistAnswers).length / checklistItems.length) * 100 : 0}%` }}
                        />
                      </div>
                      {hasPendingChecklist && (
                        <p className="text-[9px] text-[#ffbf00] font-bold uppercase tracking-wide flex items-center gap-1">
                          <AlertTriangle size={10} /> Há itens marcados como pendentes — OS não pode ser finalizada.
                        </p>
                      )}
                    </div>
                  )}

                  {/* Checklist items */}
                  <div className="space-y-2.5">
                    {checklistItems.map((item, idx) => {
                      const answer = checklistAnswers[item.id];
                      return (
                        <div
                          key={item.id}
                          className={clsx(
                            "border rounded-xl p-3 md:p-4 transition-all",
                            answer === 'ok' ? "bg-green-500/5 border-green-500/30" :
                            answer === 'pending' ? "bg-[#ffbf00]/5 border-[#ffbf00]/30" :
                            "bg-[#0c0f0f] border-[#444932]"
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3 flex-1">
                              <span className="text-[9px] font-black text-[#c5c9ac] mt-1 w-5 shrink-0">{idx + 1}.</span>
                              <p className="text-xs font-bold text-white leading-relaxed">{item.label}</p>
                            </div>
                            {isAdmin && !isReadOnly && (
                              <button
                                onClick={() => deleteChecklistItem(item.id)}
                                className="text-[#444932] hover:text-[#ffb4ab] transition-colors shrink-0 p-1"
                                title="Remover item"
                              >
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                          {(editingOrder || !isEditing) && !isReadOnly && (
                            <div className="flex gap-2 mt-3 ml-8">
                              <label className={clsx(
                                "flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer text-[10px] font-black uppercase tracking-widest transition-all border",
                                answer === 'ok'
                                  ? "bg-green-500/20 border-green-500/50 text-green-400"
                                  : "bg-[#1e2020] border-[#444932] text-[#c5c9ac] hover:border-green-500/30"
                              )}>
                                <input
                                  type="radio"
                                  name={`checklist-${item.id}`}
                                  value="ok"
                                  checked={answer === 'ok'}
                                  onChange={() => setChecklistAnswers(prev => ({ ...prev, [item.id]: 'ok' }))}
                                  className="sr-only"
                                />
                                <CheckCircle2 size={12} />
                                OK
                              </label>
                              <label className={clsx(
                                "flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer text-[10px] font-black uppercase tracking-widest transition-all border",
                                answer === 'pending'
                                  ? "bg-[#ffbf00]/20 border-[#ffbf00]/50 text-[#ffbf00]"
                                  : "bg-[#1e2020] border-[#444932] text-[#c5c9ac] hover:border-[#ffbf00]/30"
                              )}>
                                <input
                                  type="radio"
                                  name={`checklist-${item.id}`}
                                  value="pending"
                                  checked={answer === 'pending'}
                                  onChange={() => setChecklistAnswers(prev => ({ ...prev, [item.id]: 'pending' }))}
                                  className="sr-only"
                                />
                                <AlertTriangle size={12} />
                                PENDENTE
                              </label>
                            </div>
                          )}
                          {isReadOnly && answer && (
                            <div className="ml-8 mt-2">
                              <span className={clsx(
                                "px-2 py-1 text-[9px] font-black uppercase tracking-widest rounded-lg",
                                answer === 'ok' ? "bg-green-500/20 text-green-400" : "bg-[#ffbf00]/20 text-[#ffbf00]"
                              )}>
                                {answer === 'ok' ? '✓ OK' : '⚠ PENDENTE'}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Add item (Admin only) */}
                  {isAdmin && !isReadOnly && (
                    <div className="border-t border-[#444932] pt-4 space-y-3">
                      <p className="text-[9px] font-bold text-[#c5c9ac] uppercase tracking-widest">Adicionar item ao questionário</p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newItemLabel}
                          onChange={(e) => setNewItemLabel(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addChecklistItem())}
                          placeholder="Descrição do item de inspeção..."
                          className="flex-1 bg-[#0c0f0f] border border-[#444932] text-sm text-white px-4 py-2.5 rounded-xl focus:border-[#7c3aed] outline-none transition-all placeholder:text-[#444932]"
                        />
                        <button
                          onClick={addChecklistItem}
                          disabled={addingItem || !newItemLabel.trim()}
                          className="bg-[#7c3aed] text-white px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-1.5"
                        >
                          {addingItem ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                          ADD
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ——— TAB: FOTOS ——— */}
              {activeTab === 'photos' && (
                <div className="p-4 md:p-6 space-y-5">
                  {!isReadOnly && (
                    <div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handlePhotoUpload}
                        className="sr-only"
                        id="photo-upload"
                      />
                      <label
                        htmlFor="photo-upload"
                        className={clsx(
                          "flex items-center justify-center gap-3 w-full py-4 border-2 border-dashed rounded-2xl cursor-pointer transition-all",
                          uploadingPhoto
                            ? "border-[#caf300]/50 text-[#caf300]"
                            : "border-[#444932] text-[#c5c9ac] hover:border-[#caf300]/50 hover:text-[#caf300]"
                        )}
                      >
                        {uploadingPhoto ? (
                          <><Loader2 size={20} className="animate-spin" /><span className="text-xs font-bold uppercase tracking-widest">ENVIANDO...</span></>
                        ) : (
                          <><Upload size={20} /><span className="text-xs font-bold uppercase tracking-widest">TIRAR / ENVIAR FOTO</span></>
                        )}
                      </label>
                    </div>
                  )}

                  {photos.length === 0 ? (
                    <div className="text-center py-12 opacity-40">
                      <ImageIcon size={36} className="mx-auto mb-3" />
                      <p className="text-xs font-bold uppercase tracking-widest">Nenhuma foto ainda</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {photos.map(photo => (
                        <div key={photo.id} className="relative group rounded-xl overflow-hidden aspect-square bg-[#0c0f0f] border border-[#444932]">
                          <img
                            src={photo.photo_url}
                            alt="Foto do serviço"
                            className="w-full h-full object-cover"
                          />
                          {(isAdmin || photo.uploaded_by === profile?.id) && !isReadOnly && (
                            <button
                              onClick={() => deletePhoto(photo)}
                              className="absolute top-1 right-1 bg-black/60 text-[#ffb4ab] p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-[#93000a]"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 p-2">
                            <p className="text-[8px] text-white/70 font-bold">
                              {format(new Date(photo.created_at), 'dd/MM HH:mm')}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ——— TAB: ASSINATURA ——— */}
              {activeTab === 'signature' && (
                <div className="p-4 md:p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-black text-white uppercase tracking-tight">Assinatura do Cliente</h4>
                      <p className="text-[10px] text-[#c5c9ac] mt-0.5">Assine com o dedo na área abaixo</p>
                    </div>
                    {hasSavedSignature && (
                      <span className="px-3 py-1 text-[9px] font-black bg-green-500/20 text-green-400 rounded-lg uppercase tracking-widest flex items-center gap-1">
                        <CheckCircle2 size={10} /> SALVA
                      </span>
                    )}
                  </div>

                  <div className="relative bg-[#0c0f0f] border-2 border-[#444932] rounded-2xl overflow-hidden" style={{ touchAction: 'none' }}>
                    <canvas
                      ref={canvasRef}
                      width={600}
                      height={280}
                      className="w-full"
                      style={{ touchAction: 'none', cursor: 'crosshair' }}
                      onMouseDown={startDraw}
                      onMouseMove={draw}
                      onMouseUp={endDraw}
                      onMouseLeave={endDraw}
                      onTouchStart={startDraw}
                      onTouchMove={draw}
                      onTouchEnd={endDraw}
                    />
                    {!isDrawing && !hasSavedSignature && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <p className="text-[#444932] text-sm font-bold uppercase tracking-widest">Assine aqui</p>
                      </div>
                    )}
                  </div>

                  {!isReadOnly && (
                    <div className="flex gap-3">
                      <button
                        onClick={clearSignature}
                        className="flex items-center gap-2 px-4 py-2.5 border border-[#444932] rounded-xl text-[10px] font-bold text-[#c5c9ac] hover:text-white hover:bg-[#282a2b] transition-all uppercase tracking-widest"
                      >
                        <RotateCcw size={13} /> LIMPAR
                      </button>
                      <button
                        onClick={saveSignature}
                        disabled={savingSignature}
                        className="flex-1 bg-[#caf300] text-[#121414] py-2.5 rounded-xl font-black text-xs tracking-widest uppercase flex items-center justify-center gap-2 hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
                      >
                        {savingSignature ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        SALVAR ASSINATURA
                      </button>
                    </div>
                  )}
                </div>
              )}

            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

// Timeline helper component
function TimelineItem({ icon, label, value, sub, color }: { icon: React.ReactNode; label: string; value: string; sub?: string; color: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className={clsx("mt-0.5 shrink-0", color)}>{icon}</div>
      <div>
        <p className={clsx("text-[9px] font-black uppercase tracking-widest", color)}>{label}</p>
        <p className="text-xs font-bold text-white">{value}</p>
        {sub && <p className="text-[9px] text-[#c5c9ac] mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// Icon helpers
function ClipboardListIcon() {
  return <ClipboardList size={12} />;
}
function WrenchIcon() {
  return <Wrench size={12} />;
}

