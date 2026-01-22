import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { Eye, EyeOff, Sun, Moon } from 'lucide-react';
import './index.css';

// Importando os componentes (Certifique-se que os nomes dos arquivos estão exatamente assim)
import Welcomescreen from './components/Welcomescreen';
import SuccessScreen from './components/SuccessScreen';
import Dashboard from './components/Dashboard';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mostrarLogin, setMostrarLogin] = useState(false);
  const [cadastroConcluido, setCadastroConcluido] = useState(false);
  const [tipoForm, setTipoForm] = useState('login');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [nome, setNome] = useState('');
  const [objetivo, setObjetivo] = useState('');
  const [verSenha, setVerSenha] = useState(false);
  const [tema, setTema] = useState('dark');

  useEffect(() => {
    if (tema === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [tema]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setCadastroConcluido(false);
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  const loginComGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error) alert("Erro ao conectar Google: Verifique se configurou o Client ID no Supabase.");
  };

  const handleAuth = async () => {
    setLoading(true);
    try {
      if (tipoForm === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
        if (error) alert("E-mail ou senha incorretos.");
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password: senha,
          options: { emailRedirectTo: window.location.origin }
        });
        if (error) alert(error.message);
        else if (data.user) {
          await supabase.from('perfis').insert([{ id: data.user.id, nome, objetivo }]);
          if (!data.session) setCadastroConcluido(true);
        }
      }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  if (loading && !user) return (
    <div className="h-screen flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-950 transition-colors">
      <div className="w-16 h-16 border-4 border-cyan-900/30 border-t-cyan-500 rounded-full animate-spin"></div>
      <p className="text-cyan-600 dark:text-cyan-500 font-medium animate-pulse mt-4">Sincronizando...</p>
    </div>
  );

  return (
    <>
      <button onClick={() => setTema(t => (t === 'dark' ? 'light' : 'dark'))} className="fixed top-6 right-6 p-3 rounded-full border shadow-lg z-[9999] bg-white dark:bg-slate-800 text-amber-500 dark:text-cyan-400 border-slate-200 dark:border-slate-700 cursor-pointer">
        {tema === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
      </button>

      {!user ? (
        cadastroConcluido ? <SuccessScreen email={email} /> :
          !mostrarLogin ? <Welcomescreen onGetStarted={() => setMostrarLogin(true)} /> :
            <div className="flex items-center justify-center min-h-screen p-4 bg-slate-100 dark:bg-slate-950 transition-colors">
              <button onClick={() => { setMostrarLogin(false); setTipoForm('login'); }} className="absolute top-10 left-10 text-slate-500 hover:text-cyan-600 font-medium cursor-pointer">← Voltar</button>
              <div className="p-8 rounded-3xl w-full max-w-md border shadow-2xl bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-800">
                <h2 className="text-3xl font-black mb-6 text-center text-cyan-600 dark:text-cyan-400">{tipoForm === 'login' ? 'Login' : 'Cadastro'}</h2>
                <div className="space-y-4">
                  <button onClick={loginComGoogle} className="w-full flex items-center justify-center gap-3 p-4 rounded-xl font-bold border bg-slate-900 dark:bg-slate-800/50 hover:border-cyan-500 transition-all cursor-pointer group">
                    <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="G" />
                    <span className="text-white group-hover:text-cyan-400">Entrar com Google</span>
                  </button>
                  <div className="relative py-2 text-center text-xs uppercase text-slate-400"><span className="bg-white dark:bg-slate-900 px-2 relative z-10">Ou via e-mail</span><hr className="absolute top-1/2 w-full border-slate-200 dark:border-slate-800" /></div>
                  {tipoForm === 'cadastro' && <input type="text" placeholder="Como quer ser chamado?" onChange={e => setNome(e.target.value)} className="w-full p-4 rounded-xl border bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:border-cyan-500" />}
                  <input type="email" placeholder="E-mail" onChange={e => setEmail(e.target.value)} className="w-full p-4 rounded-xl border bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:border-cyan-500" />
                  <div className="relative">
                    <input type={verSenha ? "text" : "password"} placeholder="Senha" onChange={e => setSenha(e.target.value)} className="w-full p-4 rounded-xl border bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:border-cyan-500" />
                    <button onClick={() => setVerSenha(!verSenha)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer">{verSenha ? <EyeOff size={20} /> : <Eye size={20} />}</button>
                  </div>
                  <button onClick={handleAuth} className="w-full bg-cyan-600 p-4 rounded-xl font-bold text-white hover:bg-cyan-500 transition-all cursor-pointer">{tipoForm === 'login' ? 'Entrar' : 'Finalizar'}</button>
                  <button onClick={() => setTipoForm(tipoForm === 'login' ? 'cadastro' : 'login')} className="w-full text-center text-slate-500 text-sm mt-2 cursor-pointer hover:underline">{tipoForm === 'login' ? 'Não tem conta? Cadastre-se' : 'Já tem conta? Login'}</button>
                </div>
              </div>
            </div>
      ) : <Dashboard user={user} />}
    </>
  );
}