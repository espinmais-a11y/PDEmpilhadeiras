import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { Forklift, Loader2 } from 'lucide-react';


export function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');

  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const emailNormalized = email.trim().toLowerCase();
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email: emailNormalized, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email: emailNormalized,
          password,
          options: {
            data: {
              full_name: fullName,
              role: 'Employee',
            }
          }
        });
        if (error) throw error;
        
        // Com o Trigger no banco, não precisamos de insert manual aqui.
        // O usuário já será redirecionado.
      }
      navigate('/');
    } catch (err: any) {
      console.error('[Auth] Error:', err);
      let userFriendyMessage = 'Ocorreu um erro na autenticação.';
      
      const errorCode = err.code || '';
      const errorMessage = err.message || '';
      
      if (
        errorCode.includes('invalid-credential') || 
        errorMessage.includes('invalid-credential') || 
        errorMessage.includes('Invalid credentials') ||
        errorMessage.includes('Invalid login credentials') ||
        errorCode.includes('wrong-password') ||
        errorCode.includes('user-not-found')
      ) {
        userFriendyMessage = 'E-mail ou senha incorretos, ou usuário ainda não cadastrado.';
      } else if (errorCode.includes('email-already-in-use') || errorMessage.includes('User already registered') || errorMessage.includes('email already in use')) {
        userFriendyMessage = 'Este e-mail já está cadastrado no sistema.';
      } else if (errorCode.includes('weak-password') || errorMessage.includes('Password should be at least 6 characters')) {
        userFriendyMessage = 'A senha deve conter no mínimo 6 caracteres.';
      } else if (errorCode.includes('invalid-email')) {
        userFriendyMessage = 'O formato do e-mail inserido é inválido.';
      } else if (errorMessage.includes('Email not confirmed')) {
        userFriendyMessage = 'Por favor, confirme seu e-mail antes de acessar.';
      } else {
        userFriendyMessage = `${err.message || 'Erro desconhecido na autenticação.'}`;
      }

      setError(userFriendyMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#121414] flex items-center justify-center p-6 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]">
      <div className="w-full max-w-md bg-[#1e2020] border border-[#444932] shadow-2xl relative overflow-hidden rounded-3xl">
        <div className="absolute top-0 left-0 w-full h-1 bg-repeating-linear-gradient-[45deg,#caf300,#caf300_10px,#121414_10px,#121414_20px]">
           <div className="h-full w-full opacity-20 bg-[#caf300]"></div>
        </div>
        
        <div className="p-8">
          <div className="flex flex-col items-center mb-8">
            <div className="w-24 h-24 bg-[#121414] border border-[#caf300]/20 flex items-center justify-center rounded-2xl mb-4 shadow-[0_0_20px_rgba(202,243,0,0.1)] overflow-hidden">
               <img src="/logo.png" alt="Logo" className="w-full h-full object-contain p-2 drop-shadow-[0_0_8px_rgba(202,243,0,0.4)]" />
            </div>
            <h1 className="text-3xl font-black text-white tracking-tighter italic">PD EMPILHADEIRAS</h1>
            <p className="text-[#c5c9ac] font-['JetBrains_Mono'] text-[10px] tracking-widest uppercase mt-2 text-center">
              Locação e Manutenção
            </p>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            {!isLogin && (
              <>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[#8f9378] tracking-widest uppercase">NOME COMPLETO</label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value.toUpperCase())}
                    className="w-full bg-[#0c0f0f] border border-[#444932] p-3 text-white focus:border-[#caf300] outline-none transition-all placeholder:text-[#333535] rounded-xl uppercase"
                    placeholder="EX: ROBERTO ALENCAR"
                  />
                </div>

              </>
            )}

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-[#8f9378] tracking-widest uppercase">EMAIL CORPORATIVO</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value.toLowerCase())}
                className="w-full bg-[#0c0f0f] border border-[#444932] p-3 text-white focus:border-[#caf300] outline-none transition-all placeholder:text-[#333535] rounded-xl lowercase"
                placeholder="email@empresa.com"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-[#8f9378] tracking-widest uppercase">SENHA DE ACESSO</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#0c0f0f] border border-[#444932] p-3 text-white focus:border-[#caf300] outline-none transition-all placeholder:text-[#333535] rounded-xl"
                placeholder="********"
              />
            </div>

            {error && (
              <p className="text-[#ffb4ab] text-[10px] font-bold tracking-tight uppercase bg-[#93000a]/20 p-2 border-l-2 border-[#ffb4ab] rounded-r-lg">
                ERRO: {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#caf300] text-[#121414] font-bold py-4 hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2 group rounded-xl"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                <>
                  <span className="tracking-[0.2em] uppercase font-['JetBrains_Mono']">
                    {isLogin ? 'ENTRAR NO SISTEMA' : 'SOLICITAR ACESSO'}
                  </span>
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-[#c5c9ac] text-[10px] font-bold tracking-widest uppercase hover:text-[#caf300] transition-all"
            >
              {isLogin ? 'NÃO POSSUI CONTA? CADASTRE-SE' : 'JÁ POSSUI CONTA? ENTRAR'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
