import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import {
  LayoutDashboard,
  Timer,
  Calendar,
  CheckSquare,
  BookOpen,
  History,
  LogOut,
  Menu,
  Eye,
  EyeOff
} from 'lucide-react';

// --- 1. COMPONENTE: CRONÔMETRO ---
const Cronometro = ({ user }) => {
  const [segundos, setSegundos] = useState(0);
  const [ativo, setAtivo] = useState(false);
  const [materia, setMateria] = useState('');
  const [tipo, setTipo] = useState('Estudo');
  const [conteudo, setConteudo] = useState('');
  const [verSenha, setVerSenha] = useState(false);

  useEffect(() => {
    let intervalo = null;
    if (ativo) {
      intervalo = setInterval(() => {
        setSegundos((s) => s + 1);
      }, 1000);
    } else {
      clearInterval(intervalo);
    }
    return () => clearInterval(intervalo);
  }, [ativo]);

  const formatarTempo = (s) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const seg = s % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${seg.toString().padStart(2, '0')}`;
  };

  const salvarEstudo = async () => {
    if (!materia) return alert("Por favor, digite a matéria antes de salvar.");
    const { error } = await supabase.from('estudos').insert([{
      usuario_id: user.id,
      materia: materia,
      conteudo: conteudo,
      tipo: tipo,
      duracao_segundos: segundos
    }]);
    if (error) alert("Erro ao salvar: " + error.message);
    else {
      alert("Sessão de estudo salva com sucesso!");
      setSegundos(0);
      setAtivo(false);
      setMateria('');
      setConteudo('');
    }
  };

  return (
    <div className="flex flex-col items-center gap-6 max-w-md mx-auto p-8 bg-slate-800 rounded-3xl border border-slate-700 shadow-2xl">
      <div className="text-7xl font-mono font-bold text-cyan-400 tracking-tighter tabular-nums">
        {formatarTempo(segundos)}
      </div>
      <div className="w-full space-y-4">
        <input type="text" placeholder="Qual a matéria?" value={materia} onChange={(e) => setMateria(e.target.value)} className="w-full p-3 bg-slate-900 text-white border border-slate-700 rounded-xl outline-none focus:border-cyan-500 transition-all" />
        <input type="text" placeholder="Conteúdo estudado" value={conteudo} onChange={(e) => setConteudo(e.target.value)} className="w-full p-3 bg-slate-900 text-white border border-slate-700 rounded-xl outline-none focus:border-cyan-500 transition-all" />
        <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="w-full p-3 bg-slate-900 text-white border border-slate-700 rounded-xl outline-none">
          <option value="Estudo">📖 Teoria / Estudo</option>
          <option value="Revisão">🔁 Revisão</option>
          <option value="Questões">📝 Questões</option>
          <option value="Simulado">📊 Simulado</option>
        </select>
      </div>
      <div className="flex gap-4 w-full">
        <button onClick={() => setAtivo(!ativo)} className={`flex-1 py-4 rounded-2xl font-bold text-lg transition-all ${ativo ? 'bg-amber-600' : 'bg-emerald-600'}`}>
          {ativo ? 'Pausar' : 'Iniciar'}
        </button>
        <button onClick={salvarEstudo} className="flex-1 py-4 bg-cyan-600 rounded-2xl font-bold text-lg">Salvar</button>
      </div>
    </div>
  );
};

// --- 2. COMPONENTE: WELCOME SCREEN ---
import { Rocket, TrendingUp, Target, Sparkles, Star } from 'lucide-react';

const WelcomeScreen = ({ onGetStarted }) => (
  <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center overflow-hidden relative">

    {/* ELEMENTOS DE FUNDO DINÂMICOS */}
    <div className="absolute top-1/4 left-10 text-cyan-500/20 animate-float">
      <Rocket size={120} />
    </div>
    <div className="absolute bottom-1/4 right-10 text-purple-500/20 animate-float" style={{ animationDelay: '1s' }}>
      <TrendingUp size={100} />
    </div>
    <div className="absolute top-10 right-1/4 text-yellow-500/20 animate-spin-slow">
      <Sparkles size={60} />
    </div>
    <div className="absolute bottom-10 left-1/3 text-white/10 animate-pulse">
      <Star size={40} />
    </div>

    {/* CÍRCULOS DE BRILHO (BLUR) */}
    <div className="absolute top-20 left-10 w-72 h-72 bg-cyan-900/30 rounded-full blur-[120px] animate-pulse"></div>
    <div className="absolute bottom-20 right-10 w-72 h-72 bg-purple-900/30 rounded-full blur-[120px] animate-pulse"></div>

    <div className="relative z-10 max-w-4xl">
      <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-8 text-sm font-semibold text-cyan-400 uppercase bg-cyan-950/50 rounded-full border border-cyan-800 animate-bounce">
        <Rocket size={16} />
        <span>Decole rumo à aprovação</span>
      </div>

      <h1 className="text-6xl md:text-8xl font-black text-white mb-8 leading-tight tracking-tighter">
        Estude com <br />
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-500">
          Alta Performance.
        </span>
      </h1>

      <p className="text-slate-400 text-xl md:text-2xl mb-12 max-w-2xl mx-auto leading-relaxed">
        A ferramenta definitiva para quem não aceita nada menos que o <strong>sucesso</strong>. Organize, mensure e conquiste.
      </p>

      {/* CARDS COM HOVER ANIMADO */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
        {[
          { icon: <Timer className="text-cyan-400" />, title: "Foco Total", desc: "Ciclos de estudo inteligentes." },
          { icon: <Target className="text-purple-400" />, title: "Metas Reais", desc: "Acompanhe cada conquista." },
          { icon: <TrendingUp className="text-emerald-400" />, title: "Evolução", desc: "Gráficos de desempenho." }
        ].map((item, i) => (
          <div key={i} className="p-6 bg-slate-900/40 backdrop-blur-md rounded-3xl border border-slate-800 hover:border-cyan-500/50 transition-all hover:-translate-y-2 group">
            <div className="mb-4 flex justify-center group-hover:scale-110 transition-transform">
              {item.icon}
            </div>
            <h3 className="text-white font-bold text-xl mb-2">{item.title}</h3>
            <p className="text-slate-500 text-sm">{item.desc}</p>
          </div>
        ))}
      </div>

      <button
        onClick={onGetStarted}
        className="px-12 py-5 font-black text-xl text-white bg-gradient-to-r from-cyan-600 to-cyan-500 rounded-2xl hover:from-cyan-500 hover:to-cyan-400 transition-all transform hover:scale-105 shadow-[0_0_40px_rgba(6,182,212,0.3)] active:scale-95"
      >
        QUERO SER APROVADO
      </button>
    </div>
  </div>
);

// --- 3. COMPONENTE: DASHBOARD ---
function Dashboard({ user }) {
  const [abaAtiva, setAbaAtiva] = useState('inicio');
  const [menuAberto, setMenuAberto] = useState(true);

  const MenuLink = ({ id, icon: Icon, label }) => (
    <button onClick={() => setAbaAtiva(id)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${abaAtiva === id ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-900/40' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
      <Icon size={20} className="min-w-[20px]" />
      {menuAberto && <span className="font-medium whitespace-nowrap">{label}</span>}
    </button>
  );

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100 w-full">
      <aside className={`bg-slate-900 border-r border-slate-800 p-4 flex flex-col h-screen sticky top-0 transition-all duration-300 ${menuAberto ? 'w-64' : 'w-20'}`}>
        <div className={`flex items-center mb-8 ${menuAberto ? 'justify-between' : 'justify-center'}`}>
          {menuAberto && <h2 className="text-xl font-bold text-cyan-400 px-2 tracking-tight">PLANNER PRO</h2>}
          <button onClick={() => setMenuAberto(!menuAberto)} className="p-2 hover:bg-slate-800 rounded-lg text-cyan-400 transition-colors">
            <Menu size={24} />
          </button>
        </div>
        <nav className="flex-1 flex flex-col gap-2">
          <MenuLink id="inicio" icon={LayoutDashboard} label="Dashboard" />
          <MenuLink id="cronometro" icon={Timer} label="Estudar Agora" />
          <MenuLink id="calendario" icon={Calendar} label="Calendário" />
          <MenuLink id="tarefas" icon={CheckSquare} label="To-Do List" />
          <MenuLink id="revisoes" icon={BookOpen} label="Revisões" />
          <MenuLink id="historico" icon={History} label="Histórico" />
        </nav>
        <button onClick={() => supabase.auth.signOut()} className={`mt-auto flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-red-950/30 rounded-lg transition-all mb-4 ${!menuAberto && 'justify-center'}`}>
          <LogOut size={20} />
          {menuAberto && <span className="font-medium">Sair</span>}
        </button>
      </aside>
      <main className="flex-1 p-8 overflow-y-auto">
        <header className="mb-10">
          <h1 className="text-3xl font-bold">
            {abaAtiva === 'inicio' && "Visão Geral"}
            {abaAtiva === 'cronometro' && "Sessão de Estudo"}
          </h1>
          <p className="text-slate-400 text-sm mt-1">Logado como: {user.email}</p>
        </header>
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 min-h-[500px] shadow-xl">
          {abaAtiva === 'inicio' && <div className="text-center py-20 text-slate-500">Inicie um estudo para gerar métricas.</div>}
          {abaAtiva === 'cronometro' && <Cronometro user={user} />}
        </section>
      </main>
    </div>
  );
}

// --- 4. COMPONENTE PRINCIPAL (APP) ---
export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mostrarLogin, setMostrarLogin] = useState(false);

  // Estados do Formulário
  const [tipoForm, setTipoForm] = useState('login'); // 'login' ou 'cadastro'
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [nome, setNome] = useState('');
  const [genero, setGenero] = useState('');
  const [objetivo, setObjetivo] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);


  const handleAuth = async () => {
    setLoading(true);

    if (tipoForm === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
      if (error) alert(error.message);
    } else {
      // PROCESSO DE CADASTRO
      const { data, error } = await supabase.auth.signUp({ email, password: senha });

      if (error) {
        alert(error.message);
      } else if (data.user) {
        // Se criou o usuário, salva os dados extras na tabela 'perfis' (SQL)
        const { error: profileError } = await supabase
          .from('perfis')
          .insert([
            { id: data.user.id, nome, genero, objetivo }
          ]);

        if (profileError) console.error("Erro ao salvar perfil:", profileError.message);
        alert("Conta criada! Verifique seu e-mail para confirmar.");
      }
    }
    setLoading(false);
  };

  if (loading && !user) return <div className="h-screen bg-slate-950 flex items-center justify-center text-cyan-500 italic">Carregando...</div>;

  if (!user) {
    if (!mostrarLogin) return <WelcomeScreen onGetStarted={() => setMostrarLogin(true)} />;

    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950 p-4 relative overflow-y-auto">
        <button onClick={() => setMostrarLogin(false)} className="absolute top-10 left-10 text-slate-500 hover:text-white transition-colors">← Voltar</button>

        <div className="bg-slate-900 p-8 rounded-3xl w-full max-w-md border border-slate-800 shadow-2xl my-10">
          <h2 className="text-3xl font-black text-cyan-400 mb-2 text-center">
            {tipoForm === 'login' ? 'Bem-vindo de volta' : 'Crie sua conta'}
          </h2>
          <p className="text-slate-500 text-center mb-8 text-sm">
            {tipoForm === 'login' ? 'Acesse seu painel de estudos' : 'Preencha seus dados para começar'}
          </p>

          <div className="space-y-4">
            {/* CAMPOS EXTRAS APENAS NO CADASTRO */}
            {tipoForm === 'cadastro' && (
              <>
                <input
                  type="text"
                  placeholder="Como quer ser chamado?"
                  onChange={e => setNome(e.target.value)}
                  className="w-full p-4 bg-slate-800 rounded-xl border border-slate-700 text-white outline-none focus:border-cyan-500 transition-all"
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <select
                    onChange={e => setGenero(e.target.value)}
                    className="w-full p-4 bg-slate-800 rounded-xl border border-slate-700 text-white outline-none focus:border-cyan-500 cursor-pointer"
                  >
                    <option value="">Gênero</option>
                    <option value="Masculino">Masculino</option>
                    <option value="Feminino">Feminino</option>
                    <option value="Outro">Outro</option>
                  </select>

                  <select
                    onChange={e => setObjetivo(e.target.value)}
                    className="w-full p-4 bg-slate-800 rounded-xl border border-slate-700 text-white outline-none focus:border-cyan-500 cursor-pointer"
                  >
                    <option value="">Seu Objetivo</option>
                    <option value="ENEM">ENEM</option>
                    <option value="Vestibulares">Vestibulares</option>
                    <option value="Concursos">Concursos Públicos</option>
                    <option value="OAB">Exame da OAB</option>
                    <option value="Residência">Residência Médica</option>
                    <option value="Escola">Escola / Colégio</option>
                    <option value="Faculdade">Faculdade / Graduação</option>
                    <option value="Idiomas">Aprender Idiomas</option>
                    <option value="Outros">Outros</option>
                  </select>
                </div>
              </>
            )}

            <input type="email" placeholder="Seu melhor e-mail" onChange={e => setEmail(e.target.value)} className="w-full p-4 bg-slate-800 rounded-xl border border-slate-700 text-white outline-none focus:border-cyan-500 transition-all" />
            <input type="password" placeholder="Crie uma senha forte" onChange={e => setSenha(e.target.value)} className="w-full p-4 bg-slate-800 rounded-xl border border-slate-700 text-white outline-none focus:border-cyan-500 transition-all" />

            <button
              onClick={handleAuth}
              className="w-full bg-cyan-600 p-4 rounded-xl font-bold text-lg hover:bg-cyan-500 transition-all shadow-lg shadow-cyan-900/20 mt-4"
            >
              {tipoForm === 'login' ? 'Entrar' : 'Finalizar Cadastro'}
            </button>

            <button
              onClick={() => setTipoForm(tipoForm === 'login' ? 'cadastro' : 'login')}
              className="w-full text-slate-400 hover:text-white transition-colors text-sm font-medium mt-2"
            >
              {tipoForm === 'login' ? 'Não tem conta? Cadastre-se agora' : 'Já tem conta? Faça login'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <Dashboard user={user} />;
}