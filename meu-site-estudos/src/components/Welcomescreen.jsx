import React, { useRef } from 'react';
import { Rocket, TrendingUp, Sparkles, Star, Book, GraduationCap, Timer, Target } from 'lucide-react';

const Welcomescreen = ({ onGetStarted }) => {
    const finalSeccaoRef = useRef(null);

    const scrollParaFinal = () => {
        finalSeccaoRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    return (
        // ADICIONADO: pb-32 para dar espaço no fim da tela
        <div className="min-h-screen flex flex-col items-center justify-center p-6 pb-32 text-center overflow-hidden relative bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100 transition-colors duration-500">

            {/* VETORES DINÂMICOS DE FUNDO */}
            <div className="absolute top-1/4 left-10 text-cyan-500/20 animate-float"><Rocket size={120} /></div>
            <div className="absolute bottom-1/4 right-10 text-purple-500/20 animate-float" style={{ animationDelay: '1s' }}><TrendingUp size={100} /></div>
            <div className="absolute top-10 right-1/4 text-yellow-500/20 animate-spin-slow"><Sparkles size={60} /></div>
            <div className="absolute bottom-10 left-10 text-black/10 dark:text-white/10 animate-pulse"><Star size={40} /></div>
            {/* Dentro do Welcomescreen.jsx */}
            <div className="absolute top-20 left-1/4 text-blue-500/10 animate-float"><Book size={80} /></div>
            <div className="absolute top-1/3 right-10 text-amber-500/15 animate-float"><GraduationCap size={110} /></div>


            <div className="relative z-10 max-w-4xl w-full">
                {/* SELO DE TOPO - AGORA COM 20PX PARA BAIXO */}
                <div
                    onClick={scrollParaFinal}
                    className="inline-flex items-center gap-2 px-4 py-1.5 mb-8 mt-[20px] text-sm font-semibold uppercase rounded-full border animate-bounce cursor-pointer text-cyan-600 border-cyan-200 bg-cyan-50 dark:text-cyan-400 dark:border-cyan-800 dark:bg-cyan-950/50 hover:bg-cyan-100 dark:hover:bg-cyan-900/50 transition-colors"
                >
                    <Rocket size={16} /> <span>Decole rumo à aprovação</span>
                </div>

                <h1 className="text-6xl md:text-8xl font-black mb-8 leading-tight tracking-tighter">
                    Estude com <br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 to-purple-600 dark:from-cyan-400 dark:to-purple-500 font-extrabold">
                        Alta Performance.
                    </span>
                </h1>

                <p className="text-slate-600 dark:text-slate-400 text-xl md:text-2xl mb-16 max-w-2xl mx-auto leading-relaxed font-medium">
                    A ferramenta definitiva para quem não aceita nada menos que o <strong>sucesso</strong>. Organize, mensure e conquiste.
                </p>

                {/* CARDS COM MARGEM INFERIOR MAIOR */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-24">
                    {[
                        { icon: <Timer className="text-cyan-500" />, title: "Foco Total", desc: "Ciclos de estudo inteligentes." },
                        { icon: <Target className="text-purple-500" />, title: "Metas Reais", desc: "Acompanhe cada conquista." },
                        { icon: <TrendingUp className="text-emerald-500" />, title: "Evolução", desc: "Gráficos de desempenho." }
                    ].map((item, i) => (
                        <div key={i} className="p-8 rounded-3xl border bg-white/80 border-slate-200 dark:bg-slate-900/60 dark:border-slate-800 shadow-sm transition-all hover:border-cyan-500">
                            <div className="mb-4 flex justify-center group-hover:scale-110 transition-transform">{item.icon}</div>
                            <h3 className="font-bold text-xl mb-2">{item.title}</h3>
                            <p className="text-slate-600 dark:text-slate-500 text-sm leading-relaxed">{item.desc}</p>
                        </div>
                    ))}
                </div>

                {/* SEÇÃO DO BOTÃO FINAL - COM RESPIRO ABAIXO */}
                <div ref={finalSeccaoRef} className="pt-10 pb-10">
                    <button
                        onClick={onGetStarted}
                        className="px-16 py-6 font-black text-2xl text-white bg-gradient-to-r from-cyan-600 to-cyan-500 rounded-2xl hover:scale-105 transition-all shadow-[0_20px_50px_rgba(6,182,212,0.3)] cursor-pointer active:scale-95"
                    >
                        QUERO SER APROVADO
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Welcomescreen;