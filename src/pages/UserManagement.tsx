import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Profile } from '../types';
import { Users, UserCheck, ShieldAlert, MoreVertical, Search, Loader2, Trash2, DollarSign, Save, Clock } from 'lucide-react';
import { clsx } from 'clsx';

export function UserManagement() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [userFilter, setUserFilter] = useState<'all' | 'approved' | 'pending'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Admin Settings
  const [hourlyRate, setHourlyRate] = useState('150.00');
  const [savingRate, setSavingRate] = useState(false);
  const [rateSaved, setRateSaved] = useState(false);

  useEffect(() => {
    fetchUsers();
    fetchHourlyRate();
  }, []);

  async function fetchUsers() {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('is_approved', { ascending: true })
      .order('created_at', { ascending: false });
    
    if (data) setUsers(data as Profile[]);
    setLoading(false);
  }

  async function fetchHourlyRate() {
    try {
      const { data, error } = await supabase
        .from('admin_settings')
        .select('value')
        .eq('key', 'hourly_rate')
        .single();
      
      if (data && !error) {
        setHourlyRate(data.value);
      }
    } catch (err) {
      console.error('[UserManagement] Error fetching hourly rate:', err);
    }
  }

  async function saveHourlyRate() {
    setSavingRate(true);
    setRateSaved(false);
    try {
      const { error } = await supabase
        .from('admin_settings')
        .upsert({ key: 'hourly_rate', value: hourlyRate, updated_at: new Date().toISOString() });

      if (error) throw error;
      setRateSaved(true);
      setTimeout(() => setRateSaved(false), 3000);
    } catch (err) {
      console.error('[UserManagement] Error saving hourly rate:', err);
      alert('Erro ao salvar valor da hora. Verifique se a tabela admin_settings existe no Supabase.');
    } finally {
      setSavingRate(false);
    }
  }

  async function toggleApproval(userId: string, currentStatus: boolean, newRole?: string) {
    const updates: { is_approved: boolean; role?: string } = { is_approved: !currentStatus };
    if (newRole) updates.role = newRole;

    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId);

    if (!error) {
      setUsers(users.map(u => u.id === userId ? { ...u, ...updates } : u));
    }
  }

  async function updateUserRole(userId: string, newRole: string) {
    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', userId);

    if (!error) {
      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
    }
  }

  async function deleteUser(userId: string) {
    if (!confirm('Tem certeza que deseja excluir permanentemente este usuário? Esta ação não removerá o acesso do Auth, apenas os dados do perfil.')) return;
    
    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', userId);

    if (error) {
      alert('Erro ao excluir usuário: ' + error.message);
    } else {
      setUsers(users.filter(u => u.id !== userId));
    }
  }

  const filteredUsers = users.filter(user => {
    // Filter by status
    if (userFilter === 'approved' && !user.is_approved) return false;
    if (userFilter === 'pending' && user.is_approved) return false;
    
    // Filter by search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        user.full_name?.toLowerCase().includes(q) ||
        user.email?.toLowerCase().includes(q) ||
        user.role?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const approvedCount = users.filter(u => u.is_approved).length;
  const pendingCount = users.filter(u => !u.is_approved).length;

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-500">
      <div>
        <h2 className="text-3xl font-black italic tracking-tighter text-white uppercase">Painel Administrativo</h2>
        <p className="text-[#c5c9ac] font-['JetBrains_Mono'] text-xs uppercase tracking-widest">Controle de acesso, configurações e aprovações</p>
      </div>

      {/* Admin Settings - Hourly Rate */}
      <div className="bg-[#1e2020] border border-[#444932] rounded-2xl shadow-xl overflow-hidden">
        <div className="p-4 border-b border-[#444932] bg-[#282a2b]">
          <h3 className="text-sm font-black tracking-widest text-white uppercase flex items-center gap-2">
            <DollarSign size={16} className="text-[#caf300]" />
            Configurações de Serviço
          </h3>
        </div>
        <div className="p-6">
          <div className="flex flex-col md:flex-row items-start md:items-end gap-4">
            <div className="space-y-2 flex-1 max-w-xs">
              <label className="text-[10px] font-bold text-[#c5c9ac] tracking-widest uppercase flex items-center gap-2">
                <Clock size={12} className="text-[#caf300]" />
                Valor da Hora de Serviço (R$)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)}
                className="w-full bg-[#0c0f0f] border border-[#444932] text-sm text-white px-4 py-3 rounded-xl focus:border-[#caf300] outline-none transition-all font-['JetBrains_Mono']"
              />
            </div>
            <button
              onClick={saveHourlyRate}
              disabled={savingRate}
              className={clsx(
                "px-6 py-3 text-[10px] font-bold tracking-widest uppercase flex items-center gap-2 rounded-xl transition-all active:scale-95 shadow-md",
                rateSaved 
                  ? "bg-[#00c853] text-white"
                  : "bg-[#caf300] text-[#121414] hover:brightness-110"
              )}
            >
              {savingRate ? (
                <Loader2 className="animate-spin" size={14} />
              ) : rateSaved ? (
                <><UserCheck size={14} /> SALVO!</>
              ) : (
                <><Save size={14} /> SALVAR VALOR</>
              )}
            </button>
          </div>
          <p className="text-[10px] text-[#c5c9ac] mt-3 font-['JetBrains_Mono'] tracking-wide">
            Este valor será usado para calcular a receita no Painel Financeiro (Horas × Valor/Hora).
          </p>
        </div>
      </div>

      {/* Users Management */}
      <div className="bg-[#1e2020] border border-[#444932] overflow-hidden rounded-2xl shadow-xl">
        <div className="p-4 border-b border-[#444932] bg-[#282a2b] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
           <div className="flex border border-[#444932] overflow-hidden shadow-inner rounded-xl">
              <button 
                onClick={() => setUserFilter('all')}
                className={clsx(
                  "px-4 py-2 text-[9px] font-bold tracking-widest transition-all",
                  userFilter === 'all' ? "bg-[#caf300] text-[#121414]" : "bg-[#121414] text-[#c5c9ac] hover:bg-[#333535]"
                )}
              >
                TODOS ({users.length})
              </button>
              <button 
                onClick={() => setUserFilter('approved')}
                className={clsx(
                  "px-4 py-2 text-[9px] font-bold tracking-widest transition-all",
                  userFilter === 'approved' ? "bg-[#caf300] text-[#121414]" : "bg-[#121414] text-[#c5c9ac] hover:bg-[#333535]"
                )}
              >
                ATIVOS ({approvedCount})
              </button>
              <button 
                onClick={() => setUserFilter('pending')}
                className={clsx(
                  "px-4 py-2 text-[9px] font-bold tracking-widest transition-all relative",
                  userFilter === 'pending' ? "bg-[#caf300] text-[#121414]" : "bg-[#121414] text-[#c5c9ac] hover:bg-[#333535]"
                )}
              >
                PENDENTES ({pendingCount})
                {pendingCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-[#ffbf00] rounded-full animate-pulse" />
                )}
              </button>
           </div>

           <div className="flex items-center bg-[#0c0f0f] border border-[#444932] rounded-xl px-3 py-1 w-full max-w-sm">
             <Search size={14} className="text-[#c5c9ac] mr-2" />
             <input 
               type="text" 
               placeholder="BUSCAR USUÁRIO..." 
               value={searchQuery}
               onChange={(e) => setSearchQuery(e.target.value)}
               className="bg-transparent border-none focus:ring-0 text-xs text-white w-full uppercase" 
             />
           </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-[#333535] text-[#c5c9ac] text-[10px] uppercase font-bold tracking-widest border-b border-[#444932]">
                <th className="px-6 py-4">Usuário</th>
                <th className="px-6 py-4">Categoria</th>
                <th className="px-6 py-4">Data Cadastro</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#444932]/30 font-['JetBrains_Mono'] text-xs">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-[#333535] transition-colors">
                  <td className="px-6 py-4">
                     <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-[#444932] flex items-center justify-center font-bold text-[#caf300]">
                           {user.full_name?.charAt(0)}
                        </div>
                        <div>
                           <p className="font-bold text-[#e2e2e2] uppercase">{user.full_name}</p>
                           <p className="text-[10px] text-[#c5c9ac] truncate">{user.email}</p>
                        </div>
                     </div>
                  </td>
                   <td className="px-6 py-4">
                      <select
                        value={user.role || 'Client'}
                        onChange={(e) => updateUserRole(user.id, e.target.value)}
                        className="bg-[#0c0f0f] border border-[#444932] text-[10px] text-[#c5c9ac] px-2 py-1 tracking-widest font-bold uppercase focus:border-[#caf300] outline-none rounded cursor-pointer"
                      >
                        <option value="Client">Cliente</option>
                        <option value="Employee">Técnico</option>
                        <option value="Admin">Administrador</option>
                      </select>
                   </td>
                  <td className="px-6 py-4 text-[#c5c9ac]">
                     {new Date(user.created_at).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-6 py-4">
                     {user.is_approved ? (
                        <div className="flex items-center gap-2 text-[#caf300]">
                           <UserCheck size={14} />
                           <span className="text-[9px] font-bold tracking-widest">APROVADO</span>
                        </div>
                     ) : (
                        <div className="flex items-center gap-2 text-[#ffbf00]">
                           <Loader2 size={14} className="animate-spin" />
                           <span className="text-[9px] font-bold tracking-widest">AGUARDANDO</span>
                        </div>
                     )}
                  </td>
                   <td className="px-6 py-4 text-right flex items-center justify-end gap-2">
                      {user.is_approved ? (
                        <>
                          <button
                            onClick={() => toggleApproval(user.id, user.is_approved)}
                            className="px-4 py-2 text-[10px] font-bold tracking-widest uppercase transition-all shadow-md active:scale-95 rounded-lg bg-[#93000a] text-white hover:bg-[#690005]"
                          >
                            REVOGAR
                          </button>
                          <button
                            onClick={() => deleteUser(user.id)}
                            className="p-2 text-[#ffb4ab] hover:bg-[#93000a]/20 hover:text-white transition-all rounded-lg"
                            title="Excluir Usuário"
                          >
                            <Trash2 size={16} />
                          </button>
                        </>
                      ) : (
                        <div className="flex items-center gap-2">
                          <select
                            id={`role-${user.id}`}
                            className="bg-[#0c0f0f] border border-[#444932] text-[10px] text-[#c5c9ac] px-2 py-2 tracking-widest font-bold uppercase focus:border-[#caf300] outline-none rounded cursor-pointer"
                          >
                            <option value="Client">Cliente</option>
                            <option value="Employee">Técnico</option>
                            <option value="Admin">Administrador</option>
                          </select>
                          <button
                            onClick={() => {
                              const select = document.getElementById(`role-${user.id}`) as HTMLSelectElement;
                              toggleApproval(user.id, user.is_approved, select.value);
                            }}
                            className="px-4 py-2 text-[10px] font-bold tracking-widest uppercase transition-all shadow-md active:scale-95 rounded-lg bg-[#caf300] text-[#121414] hover:brightness-110"
                          >
                            APROVAR
                          </button>
                          <button
                            onClick={() => deleteUser(user.id)}
                            className="p-2 text-[#ffb4ab] hover:bg-[#93000a]/20 hover:text-white transition-all rounded-lg"
                            title="Excluir Usuário"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      )}
                   </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {loading && (
             <div className="py-20 flex justify-center">
                <Loader2 className="animate-spin text-[#caf300]" size={32} />
             </div>
          )}

          {!loading && filteredUsers.length === 0 && (
             <div className="py-20 text-center text-[#c5c9ac] opacity-50 space-y-2">
                <Users size={32} className="mx-auto" />
                <p className="text-[10px] font-bold uppercase tracking-widest">Nenhum usuário encontrado</p>
             </div>
          )}
        </div>
      </div>
    </div>
  );
}

// forced sync
