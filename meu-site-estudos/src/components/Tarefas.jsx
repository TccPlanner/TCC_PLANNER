import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Plus, Trash2, CheckCircle, Circle, Trophy } from 'lucide-react';

const Tarefas = ({ user }) => {
    const [tarefas, setTarefas] = useState([]);
    const [novaTarefa, setNovaTarefa] = useState('');

    useEffect(() => {
        buscarTarefas();
    }, []);

    const buscarTarefas = async () => {
        const { data } = await supabase.from('tarefas').select('*').eq('user_id', user.id).order('id', { ascending: true });
        if (data) setTarefas(data);
    };

    const adicionarTarefa = async (e) => {
        e.preventDefault();
        if (!novaTarefa.trim()) return;
        const { data, error } = await supabase.from('tarefas').insert([{ texto: novaTarefa, concluida: false, user_id: user.id }]).select();
        if (!error) { setTarefas([...tarefas, data[0]]); setNovaTarefa(''); }
    };

    const alternarConcluida = async (id, status) => {
        await supabase.from('tarefas').update({ concluida: !status }).eq('id', id);
        setTarefas(tarefas.map(t => t.id === id ? { ...t, concluida: !status } : t));
    };

    const deletarTarefa = async (id) => {
        await supabase.from('tarefas').delete().eq('id', id);
        setTarefas(tarefas.filter(t => t.id !== id));
    };

    const progresso = tarefas.length > 0 ? Math.round((tarefas.filter(t => t.concluida).length / tarefas.length) * 100) : 0;

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div className="bg-slate-50 dark:bg-slate-800 p-6 rounded-3xl border dark:border-slate-700 shadow-inner">
                <div className="flex justify-between items-end mb-4">
                    <h3 className="text-xl font-black flex items-center gap-2">Seu Progresso <Trophy className="text-amber-500" size={20} /></h3>
                    <span className="text-3xl font-black text-indigo-600">{progresso}%</span>
                </div>
                <div className="h-4 w-full bg-slate-200 dark:bg-slate-900 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-600 transition-all duration-700" style={{ width: `${progresso}%` }} />
                </div>
            </div>

            <form onSubmit={adicionarTarefa} className="flex gap-2">
                <input type="text" placeholder="Nova tarefa..." value={novaTarefa} onChange={(e) => setNovaTarefa(e.target.value)} className="flex-1 p-4 rounded-2xl bg-white dark:bg-slate-900 border dark:border-slate-800 outline-none focus:border-indigo-600" />
                <button type="submit" className="bg-indigo-600 text-white p-4 rounded-2xl"><Plus size={28} /></button>
            </form>

            <div className="space-y-3">
                {tarefas.map(tarefa => (
                    <div key={tarefa.id} className={`flex items-center justify-between p-4 rounded-2xl border ${tarefa.concluida ? 'opacity-50' : 'bg-white dark:bg-slate-800'}`}>
                        <div className="flex items-center gap-4 cursor-pointer flex-1" onClick={() => alternarConcluida(tarefa.id, tarefa.concluida)}>
                            {tarefa.concluida ? <CheckCircle className="text-indigo-600" /> : <Circle className="text-slate-400" />}
                            <span className={tarefa.concluida ? 'line-through' : ''}>{tarefa.texto}</span>
                        </div>
                        <button onClick={() => deletarTarefa(tarefa.id)} className="text-slate-300 hover:text-red-500"><Trash2 size={20} /></button>
                    </div>
                ))}
            </div>
        </div>
    );
};
export default Tarefas;