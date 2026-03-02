import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import {
    BarChart3,
    Clock3,
    Target,
    Layers,
    CalendarCheck2,
    RefreshCw,
    TrendingUp,
} from "lucide-react";

import {
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Tooltip,
    Legend,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    LineChart,
    Line,
} from "recharts";

const fmtHoras = (minutos) => `${(Number(minutos || 0) / 60).toFixed(1)}h`;

function toISODate(d) {
    const dt = new Date(d);
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const day = String(dt.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

function labelDia(iso) {
    const [, m, d] = iso.split("-");
    return `${d}/${m}`;
}

function sumBy(arr, fn) {
    return (arr || []).reduce((acc, x) => acc + Number(fn(x) || 0), 0);
}

function safeBool(v) {
    return v === true || v === "true" || v === 1 || v === "1";
}

export default function DashboardGeral({ user }) {
    const [loading, setLoading] = useState(true);
    const [erro, setErro] = useState("");
    const [dados, setDados] = useState({
        sessoes: [],
        cicloSessoes: [],
        cicloMaterias: [],
        cards: [],
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
                { data: cicloMateriasRaw, error: e3 },
                { data: cardsRaw, error: e4 },
                { data: tarefas, error: e5 },
                { data: revisoes, error: e6 },
            ] = await Promise.all([
                supabase
                    .from("sessoes_estudo")
                    .select("duracao_segundos, modo, materia, inicio_em")
                    .eq("user_id", user.id),

                supabase
                    .from("study_cycle_sessions")
                    .select("minutos, started_at")
                    .eq("user_id", user.id),

                supabase.from("study_cycle_subjects").select("*").eq("user_id", user.id),

                // ✅ você TEM flash_cards e tem is_favorite / repetitions / wrong_total / last_review_at
                supabase.from("flash_cards").select("*").eq("user_id", user.id),

                supabase
                    .from("tarefas")
                    .select("id, concluida, concluida_em, created_at")
                    .eq("user_id", user.id),

                supabase
                    .from("revisoes_agendadas")
                    .select("id, executada, qtd_feitas, qtd_acertos, data_revisao")
                    .eq("user_id", user.id),
            ]);

            const erroQuery = e1 || e2 || e3 || e4 || e5 || e6;
            if (erroQuery) throw erroQuery;

            // ✅ ciclo: seu schema real tem meta_minutos, minutos_planejados, minutos_feitos
            const cicloMaterias = (cicloMateriasRaw || []).map((row) => ({
                ...row,
                nome: row.nome ?? row.name ?? "Sem nome",
                meta_minutos: Number(row.meta_minutos ?? 0),
                minutos_planejados: Number(row.minutos_planejados ?? row.meta_minutos ?? 0),
                minutos_feitos: Number(row.minutos_feitos ?? 0),
            }));

            // ✅ cards: favoritos é is_favorite no seu SQL
            const cards = (cardsRaw || []).map((c) => ({
                ...c,
                favoritos: safeBool(c.is_favorite ?? c.favorite ?? c.favoritos ?? false),
                repetitions: Number(c.repetitions ?? 0),
                wrong_total: Number(c.wrong_total ?? 0),
            }));

            setDados({
                sessoes: sessoes || [],
                cicloSessoes: cicloSessoes || [],
                cicloMaterias,
                cards,
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
        // Estudo (sessoes_estudo)
        const totalSegSessoes = sumBy(dados.sessoes, (s) => s.duracao_segundos);
        const segCronometro = sumBy(
            dados.sessoes.filter((s) => s.modo === "cronometro"),
            (s) => s.duracao_segundos
        );
        const segManual = sumBy(
            dados.sessoes.filter((s) => s.modo === "manual"),
            (s) => s.duracao_segundos
        );

        // Ciclo (study_cycle_sessions)
        const minutosCiclo = sumBy(dados.cicloSessoes, (s) => s.minutos);
        const minutosPlanejadosCiclo = sumBy(
            dados.cicloMaterias,
            (s) => s.minutos_planejados
        );
        const minutosFeitosCiclo = sumBy(
            dados.cicloMaterias,
            (s) => s.minutos_feitos
        );

        // Tarefas
        const tarefasTotal = dados.tarefas.length;
        const tarefasConcluidas = dados.tarefas.filter((t) => t.concluida).length;

        // Revisões agendadas
        const revisoesTotal = dados.revisoes.length;
        const revisoesConcluidas = dados.revisoes.filter((r) => r.executada).length;
        const revisoesQuestoesFeitas = sumBy(dados.revisoes, (r) => r.qtd_feitas);
        const revisoesAcertos = sumBy(dados.revisoes, (r) => r.qtd_acertos);

        // Flashcards: sem tabela de reviews -> usar campos do próprio flash_cards
        const cardsTotal = dados.cards.length;
        const cardsFavoritos = dados.cards.filter((c) => c.favoritos).length;

        // “Total de revisões de flashcards” aproximado: soma de repetitions
        const flashReviewsTotal = sumBy(dados.cards, (c) => c.repetitions);

        // “Erros de flashcards”: soma wrong_total
        const flashWrongTotal = sumBy(dados.cards, (c) => c.wrong_total);

        const topMaterias = Object.entries(
            dados.sessoes.reduce((acc, s) => {
                const nome = (s.materia || "Sem matéria").trim() || "Sem matéria";
                acc[nome] = (acc[nome] || 0) + Number(s.duracao_segundos || 0);
                return acc;
            }, {})
        )
            .map(([nome, segundos]) => ({ nome, segundos }))
            .sort((a, b) => b.segundos - a.segundos)
            .slice(0, 8);

        const taxaConclusaoTarefas = tarefasTotal
            ? Math.round((tarefasConcluidas / tarefasTotal) * 100)
            : 0;

        const taxaConclusaoRevisoes = revisoesTotal
            ? Math.round((revisoesConcluidas / revisoesTotal) * 100)
            : 0;

        const taxaAcertoRevisoes = revisoesQuestoesFeitas
            ? Math.round((revisoesAcertos / revisoesQuestoesFeitas) * 100)
            : 0;

        const progressoCiclo = minutosPlanejadosCiclo
            ? Math.round((minutosFeitosCiclo / minutosPlanejadosCiclo) * 100)
            : 0;

        return {
            horasTotais: totalSegSessoes / 3600 + minutosCiclo / 60,
            horasCronometro: segCronometro / 3600,
            horasManual: segManual / 3600,
            horasCiclo: minutosCiclo / 60,

            minutosPlanejadosCiclo,
            minutosFeitosCiclo,
            progressoCiclo,

            tarefasTotal,
            tarefasConcluidas,
            taxaConclusaoTarefas,

            revisoesTotal,
            revisoesConcluidas,
            taxaConclusaoRevisoes,
            taxaAcertoRevisoes,

            cardsTotal,
            cardsFavoritos,

            flashReviewsTotal,
            flashWrongTotal,

            topMaterias,
        };
    }, [dados]);

    const charts = useMemo(() => {
        // Pizza: fontes (horas)
        const fontes = [
            { name: "Cronômetro", value: Number(stats.horasCronometro || 0) },
            { name: "Manual", value: Number(stats.horasManual || 0) },
            { name: "Ciclo", value: Number(stats.horasCiclo || 0) },
        ].filter((x) => x.value > 0);

        // Barras: top matérias (horas)
        const materias = stats.topMaterias.map((m) => ({
            name: m.nome.length > 14 ? `${m.nome.slice(0, 14)}…` : m.nome,
            horas: Number((m.segundos / 3600).toFixed(2)),
        }));

        // Linha: últimos 14 dias (minutos)
        const days = 14;
        const series = [];
        for (let i = days - 1; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const iso = toISODate(d);
            series.push({ iso, dia: labelDia(iso), minutos: 0 });
        }
        const idx = new Map(series.map((x, i) => [x.iso, i]));

        dados.sessoes.forEach((s) => {
            if (!s.inicio_em) return;
            const iso = toISODate(s.inicio_em);
            const i = idx.get(iso);
            if (i === undefined) return;
            series[i].minutos += Number(s.duracao_segundos || 0) / 60;
        });

        dados.cicloSessoes.forEach((s) => {
            if (!s.started_at) return;
            const iso = toISODate(s.started_at);
            const i = idx.get(iso);
            if (i === undefined) return;
            series[i].minutos += Number(s.minutos || 0);
        });

        series.forEach((x) => (x.minutos = Number(x.minutos.toFixed(0))));
        return { fontes, materias, series };
    }, [dados, stats]);

    const Card = ({ title, value, subtitle, icon: Icon }) => (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-slate-500 dark:text-slate-400">{title}</p>
                <div className="p-2 rounded-lg bg-cyan-100 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-300">
                    <Icon size={18} />
                </div>
            </div>
            <p className="text-2xl font-black mt-2">{value}</p>
            {subtitle && (
                <p className="text-xs mt-1 text-slate-500 dark:text-slate-400">
                    {subtitle}
                </p>
            )}
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <h2 className="text-2xl font-black text-cyan-600 dark:text-cyan-400">
                        Dashboard Geral
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Estatísticas consolidadas (com gráficos).
                    </p>
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
                        <Card
                            title="Horas totais estudadas"
                            value={fmtHoras(stats.horasTotais * 60)}
                            subtitle="Cronômetro + Manual + Ciclo"
                            icon={Clock3}
                        />
                        <Card
                            title="Progresso no ciclo"
                            value={`${stats.progressoCiclo}%`}
                            subtitle={`Planejado: ${fmtHoras(
                                stats.minutosPlanejadosCiclo
                            )} • Feito: ${fmtHoras(stats.minutosFeitosCiclo)}`}
                            icon={Target}
                        />
                        <Card
                            title="Flashcards"
                            value={`${stats.cardsTotal} cards`}
                            subtitle={`${stats.flashReviewsTotal} revisões • ${stats.cardsFavoritos} favoritos`}
                            icon={Layers}
                        />
                        <Card
                            title="Tarefas concluídas"
                            value={`${stats.tarefasConcluidas}/${stats.tarefasTotal}`}
                            subtitle={`Taxa: ${stats.taxaConclusaoTarefas}%`}
                            icon={CalendarCheck2}
                        />
                    </div>

                    <div className="grid lg:grid-cols-2 gap-4">
                        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-5 bg-white dark:bg-slate-900">
                            <h3 className="font-bold mb-3 flex items-center gap-2">
                                <BarChart3 size={16} /> Fontes de estudo
                            </h3>

                            {charts.fontes.length === 0 ? (
                                <p className="text-sm text-slate-500">
                                    Ainda não há horas suficientes para exibir o gráfico.
                                </p>
                            ) : (
                                <div style={{ width: "100%", height: 260 }}>
                                    <ResponsiveContainer>
                                        <PieChart>
                                            <Pie
                                                dataKey="value"
                                                data={charts.fontes}
                                                nameKey="name"
                                                innerRadius={55}
                                                outerRadius={85}
                                            >
                                                {charts.fontes.map((_, i) => (
                                                    <Cell key={i} />
                                                ))}
                                            </Pie>
                                            <Tooltip formatter={(v) => `${Number(v).toFixed(2)}h`} />
                                            <Legend />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            )}
                        </div>

                        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-5 bg-white dark:bg-slate-900">
                            <h3 className="font-bold mb-3 flex items-center gap-2">
                                <TrendingUp size={16} /> Estudo por dia (14 dias)
                            </h3>

                            <div style={{ width: "100%", height: 260 }}>
                                <ResponsiveContainer>
                                    <LineChart data={charts.series}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="dia" />
                                        <YAxis />
                                        <Tooltip formatter={(v) => `${v} min`} />
                                        <Line type="monotone" dataKey="minutos" dot={false} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-5 bg-white dark:bg-slate-900">
                        <h3 className="font-bold mb-4">Matérias mais estudadas</h3>

                        {charts.materias.length === 0 ? (
                            <p className="text-sm text-slate-500">
                                Ainda não há sessões registradas para montar ranking.
                            </p>
                        ) : (
                            <div style={{ width: "100%", height: 320 }}>
                                <ResponsiveContainer>
                                    <BarChart data={charts.materias} margin={{ left: 10, right: 10 }}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis
                                            dataKey="name"
                                            interval={0}
                                            angle={-20}
                                            textAnchor="end"
                                            height={70}
                                        />
                                        <YAxis />
                                        <Tooltip formatter={(v) => `${v}h`} />
                                        <Bar dataKey="horas" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </div>

                    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-5 bg-white dark:bg-slate-900">
                        <h3 className="font-bold mb-2">Saúde dos flashcards</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Erros acumulados (wrong_total): <b>{stats.flashWrongTotal}</b>
                        </p>
                    </div>
                </>
            )}
        </div>
    );
}