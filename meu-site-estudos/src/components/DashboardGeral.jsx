import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import { Activity, BarChart3, CalendarCheck2, Clock3, Layers, PieChart, RefreshCw, Target } from "lucide-react";

const fmtHoras = (minutos) => `${(Number(minutos || 0) / 60).toFixed(1)}h`;
const fmtHMS = (totalSegundos) => {
    const total = Math.max(0, Math.floor(Number(totalSegundos || 0)));
    const horas = Math.floor(total / 3600);
    const minutos = Math.floor((total % 3600) / 60);
    const segundos = total % 60;
    return `${String(horas).padStart(2, "0")}:${String(minutos).padStart(2, "0")}:${String(segundos).padStart(2, "0")}`;
};

const cardThemes = [
    {
        wrap: "from-cyan-500/10 via-sky-500/10 to-indigo-500/10 dark:from-cyan-500/20 dark:via-sky-500/10 dark:to-indigo-500/20",
        icon: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-300",
    },
    {
        wrap: "from-violet-500/10 via-fuchsia-500/10 to-pink-500/10 dark:from-violet-500/20 dark:via-fuchsia-500/10 dark:to-pink-500/20",
        icon: "bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300",
    },
    {
        wrap: "from-emerald-500/10 via-teal-500/10 to-cyan-500/10 dark:from-emerald-500/20 dark:via-teal-500/10 dark:to-cyan-500/20",
        icon: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
    },
    {
        wrap: "from-amber-500/10 via-orange-500/10 to-rose-500/10 dark:from-amber-500/20 dark:via-orange-500/10 dark:to-rose-500/20",
        icon: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
    },
];

const materiasColors = ["bg-cyan-500", "bg-violet-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500"];

const dayKey = (dateValue) => {
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return "";
    return date.toISOString().slice(0, 10);
};

export default function DashboardGeral({ user }) {
    const [loading, setLoading] = useState(true);
    const [erro, setErro] = useState("");
    const [dados, setDados] = useState({
        sessoes: [],
        materias: [],
        cicloSessoes: [],
        cicloMaterias: [],
        cicloAtual: null,
        cards: [],
        cardsFavoritos: [],
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
                { data: materias, error: e2 },
                { data: ciclos, error: e3 },
                { data: cards, error: e5 },
                { data: cardsFavoritos, error: e6 },
                { data: tarefas, error: e8 },
                { data: revisoes, error: e9 },
            ] = await Promise.all([
                supabase.from("sessoes_estudo").select("duracao_segundos, modo, materia, inicio_em").eq("user_id", user.id),
                supabase.from("materias").select("nome").eq("user_id", user.id),
                supabase.from("study_cycles").select("id, cycles_completed").eq("user_id", user.id).order("created_at", { ascending: true }),
                supabase.from("flash_cards").select("id, created_at").eq("user_id", user.id),
                supabase.from("flash_card_favorites").select("card_id").eq("user_id", user.id),
                supabase.from("tarefas").select("id, concluida, concluida_em, created_at").eq("user_id", user.id),
                supabase.from("revisoes_agendadas").select("id, executada, qtd_feitas, qtd_acertos, data_revisao").eq("user_id", user.id),
            ]);

            const { data: revisoesCards, error: e7 } = await supabase
                .from("flash_card_reviews")
                .select("resultado, created_at")
                .eq("user_id", user.id);

            const podeIgnorarErroReviews =
                !!e7?.message &&
                (e7.message.includes("schema cache") ||
                    e7.message.includes("Could not find the table") ||
                    e7.message.includes("does not exist"));

            const cicloAtual = ciclos?.[0] || null;
            const cicloId = cicloAtual?.id;

            const [{ data: cicloSessoes, error: e10 }, { data: cicloMaterias, error: e11 }] = await Promise.all([
                cicloId
                    ? supabase.from("study_cycle_sessions").select("minutos, started_at").eq("user_id", user.id).eq("cycle_id", cicloId)
                    : Promise.resolve({ data: [], error: null }),
                cicloId
                    ? supabase
                          .from("study_cycle_subjects")
                          .select("id, nome, minutos_planejados, minutos_feitos")
                          .eq("user_id", user.id)
                          .eq("cycle_id", cicloId)
                    : Promise.resolve({ data: [], error: null }),
            ]);

            const erroQuery = e1 || e2 || e3 || e5 || e6 || e8 || e9 || e10 || e11 || (!podeIgnorarErroReviews ? e7 : null);
            if (erroQuery) throw erroQuery;

            setDados({
                sessoes: sessoes || [],
                materias: materias || [],
                cicloSessoes: cicloSessoes || [],
                cicloMaterias: cicloMaterias || [],
                cicloAtual,
                cards: cards || [],
                cardsFavoritos: cardsFavoritos || [],
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
        const segCronometro = dados.sessoes.filter((s) => s.modo === "cronometro").reduce((acc, s) => acc + Number(s.duracao_segundos || 0), 0);
        const segManual = dados.sessoes.filter((s) => s.modo === "manual").reduce((acc, s) => acc + Number(s.duracao_segundos || 0), 0);

        const minutosPlanejadosCiclo = dados.cicloMaterias.reduce((acc, s) => acc + Number(s.minutos_planejados || 0), 0);
        const minutosFeitosCiclo = dados.cicloMaterias.reduce((acc, s) => acc + Number(s.minutos_feitos || 0), 0);

        const tarefasTotal = dados.tarefas.length;
        const tarefasConcluidas = dados.tarefas.filter((t) => t.concluida).length;

        const revisoesTotal = dados.revisoes.length;
        const revisoesConcluidas = dados.revisoes.filter((r) => r.executada).length;
        const revisoesQuestoesFeitas = dados.revisoes.reduce((acc, r) => acc + Number(r.qtd_feitas || 0), 0);
        const revisoesAcertos = dados.revisoes.reduce((acc, r) => acc + Number(r.qtd_acertos || 0), 0);

        const cardsTotal = dados.cards.length;
        const cardsFavoritos = new Set((dados.cardsFavoritos || []).map((item) => item.card_id)).size;
        const reviewsTotal = dados.revisoesCards.length;

        const materiasAtivas = new Set((dados.materias || []).map((m) => String(m.nome || "").trim().toLowerCase()).filter(Boolean));
        const topMaterias = Object.entries(
            dados.sessoes.reduce((acc, s) => {
                const nome = (s.materia || "Sem matéria").trim() || "Sem matéria";
                if (nome !== "Sem matéria" && !materiasAtivas.has(nome.toLowerCase())) return acc;
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
        const progressoCiclo = minutosPlanejadosCiclo ? Math.round((minutosFeitosCiclo / minutosPlanejadosCiclo) * 100) : 0;

        const fontesHoras = [
            { nome: "Cronômetro", valor: segCronometro / 3600, cor: "bg-cyan-500" },
            { nome: "Manual", valor: segManual / 3600, cor: "bg-violet-500" },
            { nome: "Ciclo", valor: minutosFeitosCiclo / 60, cor: "bg-emerald-500" },
        ];
        const totalFontesHoras = fontesHoras.reduce((acc, f) => acc + f.valor, 0);

        const reviewsPorResultadoRaw = dados.revisoesCards.reduce((acc, review) => {
            const key = String(review.resultado || "outro").toLowerCase();
            acc[key] = (acc[key] || 0) + 1;
            return acc;
        }, {});
        const reviewsPorResultado = [
            { nome: "Acerto", valor: reviewsPorResultadoRaw.acerto || 0, cor: "bg-emerald-500" },
            { nome: "Dúvida", valor: reviewsPorResultadoRaw.duvida || 0, cor: "bg-amber-500" },
            { nome: "Erro", valor: reviewsPorResultadoRaw.erro || 0, cor: "bg-rose-500" },
        ];
        const reviewsResultadoTotal = reviewsPorResultado.reduce((acc, r) => acc + r.valor, 0);

        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        const ultimos7dias = Array.from({ length: 7 }, (_, i) => {
            const d = new Date(hoje);
            d.setDate(hoje.getDate() - (6 - i));
            return {
                key: dayKey(d),
                label: d.toLocaleDateString("pt-BR", { weekday: "short" }).slice(0, 3),
                horas: 0,
            };
        });

        const mapa7 = Object.fromEntries(ultimos7dias.map((d) => [d.key, 0]));

        dados.sessoes.forEach((s) => {
            const key = dayKey(s.inicio_em);
            if (!key || !(key in mapa7)) return;
            mapa7[key] += Number(s.duracao_segundos || 0) / 3600;
        });

        // histórico de sessões do ciclo segue sendo usado no gráfico dos últimos 7 dias
        dados.cicloSessoes.forEach((s) => {
            const key = dayKey(s.started_at);
            if (!key || !(key in mapa7)) return;
            mapa7[key] += Number(s.minutos || 0) / 60;
        });

        const estudo7dias = ultimos7dias.map((d) => ({ ...d, horas: Number((mapa7[d.key] || 0).toFixed(2)) }));
        const pico7dias = Math.max(1, ...estudo7dias.map((d) => d.horas));

        return {
            horasTotais: totalSegSessoes / 3600 + minutosFeitosCiclo / 60,
            horasCronometro: segCronometro / 3600,
            horasManual: segManual / 3600,
            horasCiclo: minutosFeitosCiclo / 60,
            ciclosConcluidos: Number(dados.cicloAtual?.cycles_completed || 0),
            progressoCiclo,
            cardsTotal,
            cardsFavoritos,
            reviewsTotal,
            tarefasTotal,
            tarefasConcluidas,
            revisoesTotal,
            revisoesConcluidas,
            taxaConclusaoTarefas,
            taxaConclusaoRevisoes,
            taxaAcertoRevisoes,
            topMaterias,
            fontesHoras,
            totalFontesHoras,
            reviewsPorResultado,
            reviewsResultadoTotal,
            estudo7dias,
            pico7dias,
        };
    }, [dados]);

    const Card = ({ title, value, subtitle, icon: Icon, theme = cardThemes[0] }) => (
        <div className={`rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 bg-gradient-to-br ${theme.wrap} shadow-sm`}>
            <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-slate-500 dark:text-slate-400">{title}</p>
                <div className={`p-2 rounded-lg ${theme.icon}`}>
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
                    <h2 className="text-2xl font-black bg-gradient-to-r from-cyan-500 via-violet-500 to-fuchsia-500 bg-clip-text text-transparent">Dashboard Geral</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Estatísticas reais consolidadas do seu banco de dados.</p>
                </div>
                <button
                    onClick={carregar}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                    <RefreshCw size={16} /> Atualizar
                </button>
            </div>

            {erro && <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/40 dark:border-red-900 text-red-700 dark:text-red-300 p-4 text-sm">{erro}</div>}

            {loading ? (
                <div className="text-sm text-slate-500">Carregando estatísticas...</div>
            ) : (
                <>
                    <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
                        <Card title="Horas totais estudadas" value={fmtHoras(stats.horasTotais * 60)} subtitle="Cronômetro + Manual + Ciclo" icon={Clock3} theme={cardThemes[0]} />
                        <Card title="Progresso no ciclo" value={`${stats.progressoCiclo}%`} subtitle={`Ciclos concluídos: ${stats.ciclosConcluidos}`} icon={Target} theme={cardThemes[1]} />
                        <Card title="Flashcards" value={`${stats.cardsTotal} cards`} subtitle={`${stats.reviewsTotal} revisões • ${stats.cardsFavoritos} favoritos`} icon={Layers} theme={cardThemes[2]} />
                        <Card title="Tarefas concluídas" value={`${stats.tarefasConcluidas}/${stats.tarefasTotal}`} subtitle={`Taxa de conclusão: ${stats.taxaConclusaoTarefas}%`} icon={CalendarCheck2} theme={cardThemes[3]} />
                    </div>

                    <div className="grid xl:grid-cols-3 gap-4">
                        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-5 bg-white/60 dark:bg-slate-900/40 xl:col-span-2">
                            <h3 className="font-bold mb-4 flex items-center gap-2"><Activity size={16} /> Estudo nos últimos 7 dias</h3>
                            <div className="grid grid-cols-7 gap-2 items-end h-40">
                                {stats.estudo7dias.map((dia) => {
                                    const altura = Math.max(8, Math.round((dia.horas / stats.pico7dias) * 100));
                                    return (
                                        <div key={dia.key} className="flex flex-col items-center gap-1">
                                            <div className="w-full rounded-md bg-slate-100 dark:bg-slate-800 h-28 flex items-end overflow-hidden">
                                                <div className="w-full bg-gradient-to-t from-cyan-500 via-violet-500 to-fuchsia-500 rounded-md" style={{ height: `${altura}%` }} />
                                            </div>
                                            <span className="text-[11px] text-slate-500 uppercase">{dia.label}</span>
                                            <span className="text-[11px] font-semibold">{dia.horas.toFixed(1)}h</span>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="mt-4">
                                <svg viewBox="0 0 100 30" className="w-full h-20">
                                    <polyline
                                        fill="none"
                                        stroke="url(#estudoGradient)"
                                        strokeWidth="1.6"
                                        points={stats.estudo7dias
                                            .map((dia, index) => {
                                                const x = (index / 6) * 100;
                                                const y = 28 - (dia.horas / stats.pico7dias) * 24;
                                                return `${x},${Number.isFinite(y) ? y : 28}`;
                                            })
                                            .join(" ")}
                                    />
                                    <defs>
                                        <linearGradient id="estudoGradient" x1="0" y1="0" x2="1" y2="0">
                                            <stop offset="0%" stopColor="#06b6d4" />
                                            <stop offset="50%" stopColor="#8b5cf6" />
                                            <stop offset="100%" stopColor="#d946ef" />
                                        </linearGradient>
                                    </defs>
                                </svg>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-5 bg-white/60 dark:bg-slate-900/40">
                            <h3 className="font-bold mb-4 flex items-center gap-2"><PieChart size={16} /> Revisões de flashcards</h3>
                            <div className="space-y-3">
                                {stats.reviewsPorResultado.map((item) => {
                                    const pct = stats.reviewsResultadoTotal ? Math.round((item.valor / stats.reviewsResultadoTotal) * 100) : 0;
                                    return (
                                        <div key={item.nome} className="space-y-1">
                                            <div className="flex justify-between text-sm">
                                                <span>{item.nome}</span>
                                                <strong>{item.valor} ({pct}%)</strong>
                                            </div>
                                            <div className="h-2.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                                                <div className={`h-full ${item.cor}`} style={{ width: `${pct}%` }} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    <div className="grid lg:grid-cols-2 gap-4">
                        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-5 bg-white/60 dark:bg-slate-900/40">
                            <h3 className="font-bold mb-4 flex items-center gap-2"><BarChart3 size={16} /> Fontes de horas</h3>
                            <div className="space-y-3">
                                {stats.fontesHoras.map((fonte) => {
                                    const pct = stats.totalFontesHoras ? Math.round((fonte.valor / stats.totalFontesHoras) * 100) : 0;
                                    return (
                                        <div key={fonte.nome} className="space-y-1">
                                            <div className="flex justify-between text-sm">
                                                <span>{fonte.nome}</span>
                                                <strong>{fmtHoras(fonte.valor * 60)} · {pct}%</strong>
                                            </div>
                                            <div className="h-2.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                                                <div className={`h-full ${fonte.cor}`} style={{ width: `${pct}%` }} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-5 bg-white/60 dark:bg-slate-900/40">
                            <h3 className="font-bold mb-4 flex items-center gap-2"><PieChart size={16} /> Revisões agendadas</h3>
                            <div className="grid grid-cols-3 gap-3 text-center mb-4">
                                <div className="rounded-xl p-3 bg-cyan-100/70 dark:bg-cyan-900/30">
                                    <p className="text-xs text-slate-500 dark:text-slate-400">Concluídas</p>
                                    <p className="text-lg font-black text-cyan-700 dark:text-cyan-300">{stats.revisoesConcluidas}</p>
                                </div>
                                <div className="rounded-xl p-3 bg-violet-100/70 dark:bg-violet-900/30">
                                    <p className="text-xs text-slate-500 dark:text-slate-400">Taxa conclusão</p>
                                    <p className="text-lg font-black text-violet-700 dark:text-violet-300">{stats.taxaConclusaoRevisoes}%</p>
                                </div>
                                <div className="rounded-xl p-3 bg-emerald-100/70 dark:bg-emerald-900/30">
                                    <p className="text-xs text-slate-500 dark:text-slate-400">Taxa acerto</p>
                                    <p className="text-lg font-black text-emerald-700 dark:text-emerald-300">{stats.taxaAcertoRevisoes}%</p>
                                </div>
                            </div>
                            <div className="h-2.5 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-800">
                                <div className="h-full bg-gradient-to-r from-cyan-500 via-violet-500 to-emerald-500" style={{ width: `${stats.taxaConclusaoRevisoes}%` }} />
                            </div>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-5 bg-white/60 dark:bg-slate-900/40">
                        <h3 className="font-bold mb-4">Matérias mais estudadas</h3>
                        {stats.topMaterias.length === 0 ? (
                            <p className="text-sm text-slate-500">Ainda não há sessões registradas para montar ranking.</p>
                        ) : (
                            <div className="space-y-3">
                                {stats.topMaterias.map((m, idx) => {
                                    const pct = stats.topMaterias[0]?.segundos ? Math.round((m.segundos / stats.topMaterias[0].segundos) * 100) : 0;
                                    return (
                                        <div key={m.nome}>
                                            <div className="flex justify-between text-sm mb-1">
                                                <span>{idx + 1}. {m.nome}</span>
                                                <strong>{fmtHMS(m.segundos)}</strong>
                                            </div>
                                            <div className="h-2.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                                                <div className={`h-full ${materiasColors[idx % materiasColors.length]}`} style={{ width: `${pct}%` }} />
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
