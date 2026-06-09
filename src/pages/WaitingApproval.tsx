import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Clock, ShieldAlert, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function WaitingApproval() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <div className="min-h-screen bg-[#121414] flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-[#1e2020] border border-[#444932] p-10 text-center shadow-2xl rounded-3xl">
        <div className="w-20 h-20 bg-[#caf300]/10 border border-[#caf300]/30 flex items-center justify-center rounded-full mx-auto mb-8 animate-pulse text-[#caf300]">
          <Clock size={40} />
        </div>
        
        <h1 className="text-2xl font-black text-white italic tracking-tighter mb-4">MÓDULO DE SEGURANÇA</h1>
        
        <div className="bg-[#0c0f0f] border border-[#444932] p-6 mb-8 text-left space-y-4 rounded-2xl">
           <div className="flex items-center gap-3 text-[#ffb4ab]">
              <ShieldAlert size={20} />
              <span className="text-[10px] font-bold tracking-widest uppercase">Acesso Bloqueado</span>
           </div>
           
           <p className="text-[#e2e2e2] text-sm font-['IBM_Plex_Sans'] leading-relaxed">
             Olá, <span className="font-bold text-[#caf300]">{profile?.full_name}</span>. 
             Sua conta foi registrada com sucesso, mas para garantir a integridade do sistema, 
             seu acesso aguarda a **aprovação manual do administrador**.
           </p>
           
           <div className="pt-4 border-t border-[#444932]">
              <p className="text-[10px] text-[#c5c9ac] uppercase font-bold tracking-widest">
                Status Atual: <span className="text-[#caf300]">PENDENTE DE VALIDAÇÃO</span>
              </p>
           </div>
        </div>

        <button
          onClick={handleSignOut}
          className="flex items-center justify-center gap-2 w-full border border-[#444932] p-4 text-[#c5c9ac] hover:bg-[#333535] hover:text-[#ffb4ab] transition-all text-xs font-bold tracking-widest uppercase rounded-xl"
        >
          <LogOut size={16} />
          ENCERRAR SESSÃO
        </button>
      </div>
    </div>
  );
}

// forced sync
