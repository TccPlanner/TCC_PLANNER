import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { HexColorPicker } from "react-colorful";
import { BookOpen, Clock, ChevronRight, Settings2, Trash2 } from "lucide-react";

const Materias = ({ user }) => {
    const [materias, setMaterias] = useState([]);
    const [loading, setLoading] = useState(true);
    const [materiaEditando, setMateriaEditando] = useState(null);
    const [novaCor, setNovaCor] = useState("#6366f1");

    useEffect(() => {
        buscarMateriasEStats();
    }, []);

    const buscarMateriasEStats = async () => {
        setLoading(true);
        // Busca matérias e faz o join com as sessões para somar o tempo e contar conteúdos
        const { data, error } = await supabase
            .from("materias")
            .select(`
                *,
                sessoes_estudo (duracao_segundos, conteudo)
            `)
            .eq("user_id", user.id);

        if (data) {
            const formatadas = data.map(m => {
                const totalSegundos = m.sessoes_estudo.reduce((acc, s) => acc + (s.duracao_segundos || 0), 0);
                const conteudosUnicos = [...new Set(m.sessoes_estudo.map(s => s.conteudo))].filter(Boolean);

                return {
                    ...m,
                    tempoTotal: formatarTempo(totalSegundos),
                    qtdConteudos: conteudosUnicos.length,
                    listaConteudos: conteudosUnicos
                };
            });
            setMaterias(formatadas);
        }
        setLoading(false);
    };

    const formatarTempo = (s) => {
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        return `${h}h ${m}m`;
    };

    const atualizarCor = async (id) => {
        await supabase.from("materias").update({ cor: novaCor }).eq("id", id);
        setMateriaEditando(null);
        buscarMateriasEStats();
    };

    if (loading) return <div className="p-10 text-center animate-pulse">Carregando matérias...</div>;

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {materias.map((m) => (
                    <div
                        key={m.id}
                        className="relative overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all group"
                    >
                        {/* Barra lateral de cor estilizada */}
                        <div
                            className="absolute left-0 top-0 bottom-0 w-2"
                            style={{ backgroundColor: m.cor }}
                        />

                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                                    {m.nome}
                                </h3>
                                <p className="text-xs font-bold text-slate-500 mt-1 flex items-center gap-1">
                                    <BookOpen size={14} /> {m.qtdConteudos} CONTEÚDOS
                                </p>
                            </div>
                            <button
                                onClick={() => { setMateriaEditando(m); setNovaCor(m.cor); }}
                                className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 opacity-0 group-hover:opacity-100 transition-all hover:text-indigo-500"
                            >
                                <Settings2 size={18} />
                            </button>
                        </div>

                        <div className="mt-6 flex items-center justify-between">
                            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-mono font-black text-lg">
                                <Clock size={18} />
                                {m.tempoTotal}
                            </div>
                            <ChevronRight className="text-slate-300" />
                        </div>
                    </div>
                ))}
            </div>

            {/* Modal de Edição com Seletor Photoshop */}
            {materiaEditando && (
                <div className="fixed inset-0 z-[1000] bg-black/70 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 rounded-[40px] p-8 w-full max-w-sm border border-slate-200 dark:border-slate-800 shadow-2xl">
                        <h3 className="text-2xl font-black mb-6 text-center">Editar Matéria</h3>

                        <div className="flex flex-col items-center gap-6">
                            {/* Seletor Estilo Photoshop */}
                            <div className="photoshop-picker">
                                <HexColorPicker color={novaCor} onChange={setNovaCor} />
                            </div>

                            <div className="flex items-center gap-3 w-full bg-slate-50 dark:bg-slate-800 p-3 rounded-2xl">
                                <div className="w-7 h-7 rounded-full ring-2 ring-black/10 dark:ring-white/10" style={{ backgroundColor: novaCor }} />

                                <input
                                    className="bg-transparent font-mono font-bold uppercase w-full outline-none"
                                    value={novaCor}
                                    onChange={(e) => setNovaCor(e.target.value)}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3 w-full">
                                <button
                                    onClick={() => setMateriaEditando(null)}
                                    className="py-4 rounded-2xl font-black text-slate-500 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 transition-all"
                                >
                                    CANCELAR
                                </button>
                                <button
                                    onClick={() => atualizarCor(materiaEditando.id)}
                                    className="py-4 rounded-2xl font-black text-white bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-500/30 transition-all"
                                >
                                    SALVAR
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .photoshop-picker .react-colorful {
                    width: 100%;
                    height: 200px;
                    border-radius: 20px;
                }
                .photoshop-picker .react-colorful__saturation {
                    border-radius: 20px 20px 0 0;
                }
                .photoshop-picker .react-colorful__hue {
                    height: 15px;
                    border-radius: 0 0 20px 20px;
                    margin-top: 10px;
                }
            `}</style>
        </div>
    );
};

export default Materias;