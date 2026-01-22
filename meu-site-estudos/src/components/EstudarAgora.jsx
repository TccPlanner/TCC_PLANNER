import React, { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, Save, Timer, Edit3, CheckCircle2, XCircle, History, MessageSquare, Bell } from 'lucide-react';
import { supabase } from '../supabaseClient';

const EstudarAgora = ({ user }) => {
    const [abaAtiva, setAbaAtiva] = useState('cronometro');
    const [loading, setLoading] = useState(false);
    const [historicoReal, setHistoricoReal] = useState([]);

    // Estados dos inputs
    const [materia, setMateria] = useState('');
    const [conteudo, setConteudo] = useState('');
    const [tipoEstudo, setTipoEstudo] = useState('Teoria');
    const [anotacao, setAnotacao] = useState('');
    const [agendarRevisao, setAgendarRevisao] = useState(false);
    const [questoes, setQuestoes] = useState({ feitas: 0, acertos: 0, erros: 0 });

    // Estados Manual
    const [dataInicio, setDataInicio] = useState(new Date().toISOString().split('T')[0]);
    const [horaInicio, setHoraInicio] = useState(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    const [duracaoManual, setDuracaoManual] = useState(0);

    // Estados Cronômetro
    const [segundos, setSegundos] = useState(0);
    const [ativo, setAtivo] = useState(false);
    const [modoAlarme, setModoAlarme] = useState('nenhum');

    useEffect(() => {
        let intervalo = null;
        if (ativo) intervalo = setInterval(() => setSegundos((s) => s + 1), 1000);
        else clearInterval(intervalo);
        return () => clearInterval(intervalo);
    }, [ativo]);

    const formatarTempo = (s) => {
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        const seg = s % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${seg.toString().padStart(2, '0')}`;
    };

    const salvarSessao = async () => {
        if (!materia) return alert("Defina a matéria.");
        setLoading(true);
        const duracaoFinal = abaAtiva === 'cronometro' ? Math.floor(segundos / 60) : parseInt(duracaoManual);

        const { error } = await supabase.from('sessoes_estudo').insert([{
            user_id: user.id, materia, conteudo, tipo_estudo: tipoEstudo,
            duracao_minutos: duracaoFinal, questoes_feitas: questoes.feitas,
            questoes_acertos: questoes.acertos, questoes_erros: questoes.erros, anotacao
        }]);

        if (agendarRevisao) {
            const dataRev = new Date();
            dataRev.setDate(dataRev.getDate() + 1);
            await supabase.from('revisoes_agendadas').insert([{
                user_id: user.id, titulo: `Revisar: ${materia}`, data_revisao: dataRev.toISOString().split('T')[0]
            }]);
        }

        if (error) alert(error.message);
        else { alert("Sessão salva!"); setSegundos(0); setAtivo(false); }
        setLoading(false);
    };

    return (
        <div className="max-w-xl mx-auto space-y-6">
            <div className="flex bg-slate-200 dark:bg-slate-800 p-1 rounded-2xl shadow-inner">
                <button onClick={() => setAbaAtiva('manual')} className={`flex-1 py-3 rounded-xl font-bold transition-all ${abaAtiva === 'manual' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500'}`}>Manual</button>
                <button onClick={() => setAbaAtiva('cronometro')} className={`flex-1 py-3 rounded-xl font-bold transition-all ${abaAtiva === 'cronometro' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500'}`}>Cronômetro</button>
            </div>

            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-6">
                <div className="space-y-4">
                    <input type="text" placeholder="Matéria" value={materia} onChange={e => setMateria(e.target.value)} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl outline-none border dark:border-slate-700" />
                    <input type="text" placeholder="Conteúdo" value={conteudo} onChange={e => setConteudo(e.target.value)} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl outline-none border dark:border-slate-700" />
                    <select value={tipoEstudo} onChange={e => setTipoEstudo(e.target.value)} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl outline-none border dark:border-slate-700">
                        <option value="Teoria">Teoria</option>
                        <option value="Exercícios">Exercícios</option>
                        <option value="Revisão">Revisão</option>
                    </select>
                </div>

                {abaAtiva === 'manual' ? (
                    <div className="grid grid-cols-2 gap-4 border-t dark:border-slate-800 pt-4">
                        <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg text-sm" />
                        <input type="time" value={horaInicio} onChange={e => setHoraInicio(e.target.value)} className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg text-sm" />
                        <div className="col-span-2 text-center">
                            <p className="text-xs font-bold text-slate-400">DURAÇÃO (MINUTOS)</p>
                            <input type="number" value={duracaoManual} onChange={e => setDuracaoManual(e.target.value)} className="text-3xl font-black bg-transparent text-center outline-none w-full" />
                        </div>
                    </div>
                ) : (
                    <div className="text-center space-y-6">
                        <div className="text-5xl font-mono font-black text-slate-800 dark:text-white">{formatarTempo(segundos)}</div>
                        <div className="flex justify-center gap-4">
                            <button onClick={() => setAtivo(!ativo)} className={`p-4 rounded-full text-white ${ativo ? 'bg-amber-500' : 'bg-indigo-600'}`}>{ativo ? <Pause /> : <Play />}</button>
                            <button onClick={() => { setSegundos(0); setAtivo(false) }} className="p-4 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500"><RotateCcw /></button>
                        </div>
                        <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-between">
                            <span className="text-xs font-bold"><Bell size={14} className="inline mr-2" /> Alarme:</span>
                            <select value={modoAlarme} onChange={e => setModoAlarme(e.target.value)} className="bg-transparent text-sm">
                                <option value="nenhum">Nenhum</option>
                                <option value="30">30 min</option>
                                <option value="60">60 min</option>
                            </select>
                        </div>
                    </div>
                )}

                {tipoEstudo === 'Exercícios' && (
                    <div className="grid grid-cols-3 gap-2 p-3 bg-indigo-50 dark:bg-indigo-950/20 rounded-xl">
                        <input type="number" placeholder="Total" onChange={e => setQuestoes({ ...questoes, feitas: e.target.value })} className="bg-transparent text-center outline-none" />
                        <input type="number" placeholder="Acertos" onChange={e => setQuestoes({ ...questoes, acertos: e.target.value })} className="bg-transparent text-center outline-none text-emerald-500" />
                        <input type="number" placeholder="Erros" onChange={e => setQuestoes({ ...questoes, erros: e.target.value })} className="bg-transparent text-center outline-none text-red-500" />
                    </div>
                )}

                <textarea placeholder="Anotações..." value={anotacao} onChange={e => setAnotacao(e.target.value)} className="w-full p-3 h-20 bg-slate-50 dark:bg-slate-800 rounded-xl outline-none border dark:border-slate-700 text-sm" />

                <button onClick={() => setAgendarRevisao(!agendarRevisao)} className={`text-xs font-bold ${agendarRevisao ? 'text-indigo-600' : 'text-slate-400'}`}>
                    <Calendar size={14} className="inline mr-1" /> Agendar Revisão Automática?
                </button>

                <button onClick={salvarSessao} disabled={loading} className="w-full py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-lg active:scale-95 transition-all">
                    {loading ? "SALVANDO..." : "SALVAR ATIVIDADE"}
                </button>
            </div>
        </div>
    );
};

export default EstudarAgora;