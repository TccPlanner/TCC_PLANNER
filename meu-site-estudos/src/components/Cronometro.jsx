import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Timer } from 'lucide-react';

const Cronometro = ({ user }) => {
    const [segundos, setSegundos] = useState(0);
    const [ativo, setAtivo] = useState(false);
    const [materia, setMateria] = useState('');
    const [tipo, setTipo] = useState('Estudo');
    const [conteudo, setConteudo] = useState('');

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
        <div className="flex flex-col items-center gap-6 max-w-md mx-auto p-8 rounded-3xl border shadow-2xl
      bg-white border-slate-200 text-slate-900
      dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100">
            <div className="text-7xl font-mono font-bold tracking-tighter tabular-nums text-cyan-600 dark:text-cyan-400">
                {formatarTempo(segundos)}
            </div>
            <div className="w-full space-y-4">
                <input
                    type="text"
                    placeholder="Qual a matéria?"
                    value={materia}
                    onChange={(e) => setMateria(e.target.value)}
                    className="w-full p-3 rounded-xl outline-none transition-all
            bg-slate-100 text-slate-900 border border-slate-300 focus:border-cyan-500
            dark:bg-slate-900 dark:text-white dark:border-slate-700 dark:focus:border-cyan-500"
                />
                <input
                    type="text"
                    placeholder="Conteúdo estudado"
                    value={conteudo}
                    onChange={(e) => setConteudo(e.target.value)}
                    className="w-full p-3 rounded-xl outline-none transition-all
            bg-slate-100 text-slate-900 border border-slate-300 focus:border-cyan-500
            dark:bg-slate-900 dark:text-white dark:border-slate-700 dark:focus:border-cyan-500"
                />
                <select
                    value={tipo}
                    onChange={(e) => setTipo(e.target.value)}
                    className="w-full p-3 rounded-xl outline-none
            bg-slate-100 text-slate-900 border border-slate-300
            dark:bg-slate-900 dark:text-white dark:border-slate-700"
                >
                    <option value="Estudo">📖 Teoria / Estudo</option>
                    <option value="Revisão">🔁 Revisão</option>
                    <option value="Questões">📝 Questões</option>
                    <option value="Simulado">📊 Simulado</option>
                </select>
            </div>
            <div className="flex gap-4 w-full">
                <button
                    onClick={() => setAtivo(!ativo)}
                    className={`flex-1 py-4 rounded-2xl font-bold text-lg transition-all text-white
            ${ativo ? 'bg-amber-600' : 'bg-emerald-600'}`}
                >
                    {ativo ? 'Pausar' : 'Iniciar'}
                </button>
                <button
                    onClick={salvarEstudo}
                    className="flex-1 py-4 bg-cyan-600 hover:bg-cyan-500 rounded-2xl font-bold text-lg text-white transition-all"
                >
                    Salvar
                </button>
            </div>
        </div>
    );
};

export default Cronometro;