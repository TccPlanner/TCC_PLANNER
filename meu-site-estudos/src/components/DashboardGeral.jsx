import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import { BarChart3, Clock3, Target, Layers, CalendarCheck2, RefreshCw, TrendingUp } from "lucide-react";

const fmtHoras = (minutos) => `${(Number(minutos || 0) / 60).toFixed(1)}h`;

export default function DashboardGeral({ user }) {
    const [loading, setLoading] = useState(true);
    const [erro, setErro] = useState("");
    const [dados, setDados] = useState({
        sessoes: [],
        cicloSessoes: [],
        cicloMaterias: [],
        cards: [],
        revisoesCards: [],
        tarefas: [],
        revisoes: [],
    });

    const carregar = async () => {
        if (!user?.id) return;
        setLoading(true);
        setErro("");
        try {
            const [
                { data: sessoes, error: e1 },
                { data: cicloSessoes, error: e2 },
                { data: cicloMaterias, error: e3 },
                { data: cards, error: e4 },
                { data: revisoesCards, error: e5 },
                { data: tarefas, error: e6 },
                { data: revisoes, error: e7 },
            ] = await Promise.all([
                supabase
                    .from("sessoes_estudo")
                    .select("duracao_segundos, modo, materia, tipo_estudo, inicio_em")
                    .eq("user_id", user.id),
                supabase
                    .from("study_cycle_sessions")
                    .select("minutos, started_at, subject_id")
                    .eq("user_id", user.id),
                supabase
                    .from("study_cycle_subjects")
                    .select("id, nome, minutos_planejados, minutos_feitos")
                    .eq("user_id", user.id),
                supabase
                    .from("flash_cards")
                    .select("id, favoritos, created_at")
                    .eq("user_id", user.id),
                supabase
                    .from("flash_card_reviews")
                    .select("resultado, created_at")
                    .eq("user_id", user.id),
                supabase
                    .from("tarefas")
                    .select("id, concluida, concluida_em, created_at")
                    .eq("user_id", user.id),
                supabase
                    .from("revisoes_agendadas")
                    .select("id, executada, qtd_feitas, qtd_acertos, data_revisao")
                    .eq("user_id", user.id),
            ]);

            const erroQuery = e1 || e2 || e3 || e4 || e5 || e6 || e7;
            if (erroQuery) throw erroQuery;

            setDados({
                sessoes: sessoes || [],
                cicloSessoes: cicloSessoes || [],
                cicloMaterias: cicloMaterias || [],
                cards: cards || [],
                revisoesCards: revisoesCards || [],
                tarefas: tarefas || [],
                revisoes: revisoes || [],
            });
        } catch (e) {
            setErro(e?.message || "Não foi possível carregar as estatísticas.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        carregar();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id]);

    const stats = useMemo(() => {
        const totalSegSessoes = dados.sessoes.reduce((acc, s) => acc + Number(s.duracao_segundos || 0), 0);
        const segCronometro = dados.sessoes
            .filter((s) => s.modo === "cronometro")
            .reduce((acc, s) => acc + Number(s.duracao_segundos || 0), 0);
        const segManual = dados.sessoes
            .filter((s) => s.modo === "manual")
            .reduce((acc, s) => acc + Number(s.duracao_segundos || 0), 0);

        const minutosCiclo = dados.cicloSessoes.reduce((acc, s) => acc + Number(s.minutos || 0), 0);
        const minutosPlanejadosCiclo = dados.cicloMaterias.reduce((acc, s) => acc + Number(s.minutos_planejados || 0), 0);
        const minutosFeitosCiclo = dados.cicloMaterias.reduce((acc, s) => acc + Number(s.minutos_feitos || 0), 0);

        const tarefasTotal = dados.tarefas.length;
        const tarefasConcluidas = dados.tarefas.filter((t) => t.concluida).length;

        const revisoesTotal = dados.revisoes.length;
        const revisoesConcluidas = dados.revisoes.filter((r) => r.executada).length;
        const revisoesQuestoesFeitas = dados.revisoes.reduce((acc, r) => acc + Number(r.qtd_feitas || 0), 0);
        const revisoesAcertos = dados.revisoes.reduce((acc, r) => acc + Number(r.qtd_acertos || 0), 0);

        const reviewsTotal = dados.revisoesCards.length;
        const cardsTotal = dados.cards.length;
        const cardsFavoritos = dados.cards.filter((c) => c.favoritos).length;

        const topMaterias = Object.entries(
            dados.sessoes.reduce((acc, s) => {
                const nome = (s.materia || "Sem matéria").trim() || "Sem matéria";
                acc[nome] = (acc[nome] || 0) + Number(s.duracao_segundos || 0);
                return acc;
            }, {})
        )
            .map(([nome, segundos]) => ({ nome, segundos }))
            .sort((a, b) => b.segundos - a.segundos)
            .slice(0, 5);

        const taxaConclusaoTarefas = tarefasTotal ? Math.round((tarefasConcluidas / tarefasTotal) * 100) : 0;
        const taxaConclusaoRevisoes = revisoesTotal ? Math.round((revisoesConcluidas / revisoesTotal) * 100) : 0;
        const taxaAcertoRevisoes = revisoesQuestoesFeitas ? Math.round((revisoesAcertos / revisoesQuestoesFeitas) * 100) : 0;
        const progressoCiclo = minutosPlanejadosCiclo
            ? Math.round((minutosFeitosCiclo / minutosPlanejadosCiclo) * 100)
            : 0;

        return {
            horasTotais: (totalSegSessoes / 3600) + (minutosCiclo / 60),
            horasCronometro: segCronometro / 3600,
            horasManual: segManual / 3600,
            horasCiclo: minutosCiclo / 60,
            tarefasTotal,
            tarefasConcluidas,
            taxaConclusaoTarefas,
            revisoesTotal,
            revisoesConcluidas,
            taxaConclusaoRevisoes,
            taxaAcertoRevisoes,
            cardsTotal,
            cardsFavoritos,
            reviewsTotal,
            progressoCiclo,
            topMaterias,
        };
    }, [dados]);

    const Card = ({ title, value, subtitle, icon: Icon }) => (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-slate-500 dark:text-slate-400">{title}</p>
                <div className="p-2 rounded-lg bg-cyan-100 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-300">
                    <Icon size={18} />
                </div>
            </div>
            <p className="text-2xl font-black mt-2">{value}</p>
            {subtitle && <p className="text-xs mt-1 text-slate-500 dark:text-slate-400">{subtitle}</p>}
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <h2 className="text-2xl font-black text-cyan-600 dark:text-cyan-400">Dashboard Geral</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Estatísticas reais consolidadas do seu banco de dados.</p>
                </div>
                <button
                    onClick={carregar}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                    <RefreshCw size={16} /> Atualizar
                </button>
            </div>

            {erro && (
                <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/40 dark:border-red-900 text-red-700 dark:text-red-300 p-4 text-sm">
                    {erro}
                </div>
            )}

            {loading ? (
                <div className="text-sm text-slate-500">Carregando estatísticas...</div>
            ) : (
                <>
                    <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
                        <Card title="Horas totais estudadas" value={fmtHoras(stats.horasTotais * 60)} subtitle="Cronômetro + Manual + Ciclo" icon={Clock3} />
                        <Card title="Progresso no ciclo" value={`${stats.progressoCiclo}%`} subtitle={`Inclui sessões do ciclo: ${fmtHoras(stats.horasCiclo * 60)}`} icon={Target} />
                        <Card title="Flashcards" value={`${stats.cardsTotal} cards`} subtitle={`${stats.reviewsTotal} revisões • ${stats.cardsFavoritos} favoritos`} icon={Layers} />
                        <Card title="Tarefas concluídas" value={`${stats.tarefasConcluidas}/${stats.tarefasTotal}`} subtitle={`Taxa de conclusão: ${stats.taxaConclusaoTarefas}%`} icon={CalendarCheck2} />
                    </div>

                    <div className="grid lg:grid-cols-2 gap-4">
                        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
                            <h3 className="font-bold mb-3 flex items-center gap-2"><BarChart3 size={16} /> Fontes de horas</h3>
                            <ul className="space-y-2 text-sm">
                                <li className="flex justify-between"><span>Cronômetro</span><strong>{fmtHoras(stats.horasCronometro * 60)}</strong></li>
                                <li className="flex justify-between"><span>Lançamentos manuais</span><strong>{fmtHoras(stats.horasManual * 60)}</strong></li>
                                <li className="flex justify-between"><span>Sessões do ciclo</span><strong>{fmtHoras(stats.horasCiclo * 60)}</strong></li>
                            </ul>
                        </div>

                        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
                            <h3 className="font-bold mb-3 flex items-center gap-2"><TrendingUp size={16} /> Revisões</h3>
                            <ul className="space-y-2 text-sm">
                                <li className="flex justify-between"><span>Revisões concluídas</span><strong>{stats.revisoesConcluidas}/{stats.revisoesTotal}</strong></li>
                                <li className="flex justify-between"><span>Taxa de conclusão</span><strong>{stats.taxaConclusaoRevisoes}%</strong></li>
                                <li className="flex justify-between"><span>Taxa de acerto (questões)</span><strong>{stats.taxaAcertoRevisoes}%</strong></li>
                            </ul>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
                        <h3 className="font-bold mb-4">Matérias mais estudadas</h3>
                        {stats.topMaterias.length === 0 ? (
                            <p className="text-sm text-slate-500">Ainda não há sessões registradas para montar ranking.</p>
                        ) : (
                            <div className="space-y-3">
                                {stats.topMaterias.map((m, idx) => {
                                    const pct = stats.topMaterias[0]?.segundos
                                        ? Math.round((m.segundos / stats.topMaterias[0].segundos) * 100)
                                        : 0;
                                    return (
                                        <div key={m.nome}>
                                            <div className="flex justify-between text-sm mb-1">
                                                <span>{idx + 1}. {m.nome}</span>
                                                <strong>{(m.segundos / 3600).toFixed(1)}h</strong>
                                            </div>
                                            <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                                                <div className="h-full bg-cyan-500" style={{ width: `${pct}%` }} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
