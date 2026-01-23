import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { LayoutDashboard, Timer, Calendar, CheckSquare, BookOpen, History, LogOut, Menu } from 'lucide-react';
import EstudarAgora from './EstudarAgora';
import Calendario from "./Calendario";



function Dashboard({ user }) {
    const [abaAtiva, setAbaAtiva] = useState('inicio');
    const [menuAberto, setMenuAberto] = useState(true);

    const MenuLink = ({ id, icon: Icon, label }) => (
        <button
            onClick={() => setAbaAtiva(id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all
        ${abaAtiva === id
                    ? 'bg-cyan-600 text-white shadow-lg'
                    : 'text-slate-600 hover:bg-slate-200 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white'
                }`}
        >
            <Icon size={20} className="min-w-[20px]" />
            {menuAberto && <span className="font-medium whitespace-nowrap">{label}</span>}
        </button>
    );

    return (

        <div className="flex min-h-screen w-full font-sans bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
            <aside className={`border-r p-4 flex flex-col h-screen sticky top-0 transition-all duration-300
        ${menuAberto ? 'w-64' : 'w-20'}
        bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-800`}
            >
                <div className={`flex items-center mb-8 ${menuAberto ? 'justify-between' : 'justify-center'}`}>
                    {menuAberto && <h2 className="text-xl font-bold px-2 tracking-tight text-cyan-600 dark:text-cyan-400">PLANNER PRO</h2>}
                    <button onClick={() => setMenuAberto(!menuAberto)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg text-cyan-600 dark:text-cyan-400 cursor-pointer">
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
                <button
                    onClick={() => supabase.auth.signOut()}
                    className="mt-auto flex items-center gap-3 px-4 py-3 text-red-500 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30 rounded-lg transition-all mb-4 cursor-pointer"
                >
                    <LogOut size={20} /> {menuAberto && <span className="font-medium">Sair</span>}
                </button>
            </aside>
            <main className="flex-1 p-8 overflow-y-auto">
                <header className="mb-10">
                    <h1 className="text-3xl font-bold uppercase">{abaAtiva === 'inicio' ? "Visão Geral" : "Sessão de Estudo"}</h1>
                    <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">Conectado: {user.email}</p>
                </header>
                <section className="rounded-2xl p-6 min-h-[500px] shadow-xl border bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-800">
                    {abaAtiva === 'inicio' && <div className="text-center py-20 text-slate-500">Bem-vindo ao seu painel estratégico.</div>}
                    {abaAtiva === 'cronometro' && <EstudarAgora user={user} />}
                    {abaAtiva === "calendario" && <Calendario user={user} />}

                </section>
            </main>
        </div>

    );
}

export default Dashboard;