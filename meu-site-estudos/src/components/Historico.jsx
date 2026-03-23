import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import { CalendarDays, Clock3, Filter, History } from "lucide-react";

const PERIODOS = {
    dia: "Dia",
    semana: "Semana",
    ano: "Ano",
    personalizado: "Personalizado",
};

const inicioDoDia = (d) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
};

const fimDoDia = (d) => {
    const x = new Date(d);
    x.setHours(23, 59, 59, 999);
    return x;
};

const inicioDaSemana = (d) => {
    const x = inicioDoDia(d);
    const diaSemana = x.getDay();
    const diff = diaSemana === 0 ? -6 : 1 - diaSemana;
    x.setDate(x.getDate() + diff);
    return x;
};

const fimDaSemana = (d) => {
    const x = inicioDaSemana(d);
    x.setDate(x.getDate() + 6);
    return fimDoDia(x);
};

const inicioDoAno = (d) => new Date(d.getFullYear(), 0, 1, 0, 0, 0, 0);
const fimDoAno = (d) => new Date(d.getFullYear(), 11, 31, 23, 59, 59, 999);

const formatarHMS = (segundos = 0) => {
    const total = Math.max(0, Number(segundos) || 0);
    const h = String(Math.floor(total / 3600)).padStart(2, "0");
    const m = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
    const s = String(total % 60).padStart(2, "0");
    return `${h}:${m}:${s}`;
};

const dataDaChaveLocal = (chave) => {
    if (!chave || typeof chave !== "string" || !chave.includes("-")) return null;
    const [ano, mes, dia] = chave.split("-").map(Number);
    if (!ano || !mes || !dia) return null;
    return new Date(ano, mes - 1, dia);
};

const Historico = ({ user }) => {
    const hoje = useMemo(() => new Date(), []);
    const hojeISO = useMemo(() => hoje.toISOString().slice(0, 10), [hoje]);

    const [loading, setLoading] = useState(true);
    const [entradas, setEntradas] = useState([]);
    const [periodo, setPeriodo] = useState("semana");
    const [dataBase, setDataBase] = useState(hojeISO);
    const [dataInicioCustom, setDataInicioCustom] = useState(hojeISO);
    const [dataFimCustom, setDataFimCustom] = useState(hojeISO);

    const intervalo = useMemo(() => {
        const base = dataBase ? new Date(`${dataBase}T12:00:00`) : new Date();

        if (periodo === "dia") {
            return { inicio: inicioDoDia(base), fim: fimDoDia(base) };
        }

        if (periodo === "semana") {
            return { inicio: inicioDaSemana(base), fim: fimDaSemana(base) };
        }

        if (periodo === "ano") {
            return { inicio: inicioDoAno(base), fim: fimDoAno(base) };
        }

        const inicio = dataInicioCustom
            ? inicioDoDia(new Date(`${dataInicioCustom}T12:00:00`))
            : inicioDoDia(base);
        const fim = dataFimCustom
            ? fimDoDia(new Date(`${dataFimCustom}T12:00:00`))
            : fimDoDia(base);

        if (inicio > fim) return { inicio: fimDoDia(fim), fim: inicioDoDia(inicio) };
        return { inicio, fim };
    }, [periodo, dataBase, dataInicioCustom, dataFimCustom]);

    const carregarHistorico = async () => {
        if (!user?.id) return;
        setLoading(true);

        const inicioISO = intervalo.inicio.toISOString();
        const fimISO = intervalo.fim.toISOString();

        try {
            const [{ data: sessoes }, { data: subjects }, { data: blocos }] =
                await Promise.all([
                    supabase
                        .from("sessoes_estudo")
                        .select("id,materia,conteudo,tipo_estudo,inicio_em,duracao_segundos,modo")
                        .eq("user_id", user.id)
                        .gte("inicio_em", inicioISO)
                        .lte("inicio_em", fimISO)
                        .order("inicio_em", { ascending: false }),
                    supabase
                        .from("study_cycle_subjects")
                        .select("id,nome")
                        .eq("user_id", user.id),
                    supabase
                        .from("study_cycle_sessions")
                        .select("id,subject_id,minutos,started_at")
                        .eq("user_id", user.id)
                        .gte("started_at", inicioISO)
                        .lte("started_at", fimISO)
                        .order("started_at", { ascending: false }),
                ]);

            const nomesMaterias = (subjects || []).reduce((acc, item) => {
                acc[item.id] = item.nome;
                return acc;
            }, {});

            const doEstudarAgora = (sessoes || []).map((item) => ({
                id: `sessao-${item.id}`,
                origem: item.modo === "manual" ? "Estudar Agora (manual)" : "Estudar Agora",
                materia: item.materia || "Sem matéria",
                conteudo: item.conteudo || "Sem conteúdo",
                inicio: item.inicio_em,
                segundos: Number(item.duracao_segundos) || 0,
                tipo: item.tipo_estudo || "Teoria",
            }));

            const doCiclo = (blocos || []).map((item) => ({
                id: `ciclo-${item.id}`,
                origem: "Ciclo de Estudos",
                materia: nomesMaterias[item.subject_id] || "Matéria do ciclo",
                conteudo: "Bloco concluído",
                inicio: item.started_at,
                segundos: (Number(item.minutos) || 0) * 60,
                tipo: "Bloco de ciclo",
            }));

            const combinado = [...doEstudarAgora, ...doCiclo].sort(
                (a, b) => new Date(b.inicio) - new Date(a.inicio)
            );

            setEntradas(combinado);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        carregarHistorico();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id, intervalo.inicio.getTime(), intervalo.fim.getTime()]);

    const diasAgrupados = useMemo(() => {
        const bucket = new Map();

        entradas.forEach((item) => {
            const data = new Date(item.inicio);
            const chave = data.toISOString().slice(0, 10);

            if (!bucket.has(chave)) {
                bucket.set(chave, {
                    key: chave,
                    data,
                    totalSegundos: 0,
                    itens: [],
                });
            }

            const grupo = bucket.get(chave);
            grupo.totalSegundos += item.segundos;
            grupo.itens.push(item);
        });

        return Array.from(bucket.values()).sort((a, b) => b.data - a.data);
    }, [entradas]);

    const totalPeriodo = useMemo(
        () => diasAgrupados.reduce((acc, d) => acc + d.totalSegundos, 0),
        [diasAgrupados]
    );

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-600 text-white shadow-sm shadow-cyan-900/20">
                    <History className="h-6 w-6" />
                </div>

                <div>
                    <p className="text-2xl font-black text-white leading-tight">
                        Histórico
                    </p>
                    <p className="text-sm text-cyan-100">
                        Visualize suas sessões e blocos concluídos por período
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 bg-slate-50 dark:bg-slate-900/60 xl:col-span-3">
                    <div className="flex items-center gap-2 text-cyan-600 dark:text-cyan-400 mb-3">
                        <Filter size={16} />
                        <p className="text-xs font-black uppercase tracking-widest">
                            Filtro de período
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-2 mb-4">
                        {Object.entries(PERIODOS).map(([valor, label]) => (
                            <button
                                key={valor}
                                onClick={() => setPeriodo(valor)}
                                className={`px-3 py-2 rounded-xl text-sm font-bold border cursor-pointer ${periodo === valor
                                    ? "bg-cyan-600 text-white border-cyan-500"
                                    : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                                    }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                            Data base
                            <input
                                type="date"
                                value={dataBase}
                                onChange={(e) => setDataBase(e.target.value)}
                                className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2"
                            />
                        </label>

                        {periodo === "personalizado" && (
                            <>
                                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                                    Início
                                    <input
                                        type="date"
                                        value={dataInicioCustom}
                                        onChange={(e) => setDataInicioCustom(e.target.value)}
                                        className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2"
                                    />
                                </label>

                                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                                    Fim
                                    <input
                                        type="date"
                                        value={dataFimCustom}
                                        onChange={(e) => setDataFimCustom(e.target.value)}
                                        className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2"
                                    />
                                </label>
                            </>
                        )}
                    </div>
                </div>

                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 bg-white dark:bg-slate-900">
                    <p className="text-xs font-black uppercase tracking-widest text-slate-500">
                        Total no período
                    </p>
                    <p className="mt-2 text-3xl font-black text-cyan-600 dark:text-cyan-400">
                        {formatarHMS(totalPeriodo)}
                    </p>
                    <p className="text-sm mt-2 text-slate-500">
                        {diasAgrupados.length} dia(s) com estudo
                    </p>
                </div>
            </div>

            <div className="space-y-5">
                {loading && <p className="text-slate-500">Carregando histórico...</p>}

                {!loading && diasAgrupados.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-10 text-center text-slate-500">
                        Nenhum estudo encontrado no período selecionado.
                    </div>
                )}

                {!loading &&
                    diasAgrupados.map((dia) => {
                        const dataFormatada = dataDaChaveLocal(dia.key);

                        const diaSemana = dataFormatada
                            ? dataFormatada.toLocaleDateString("pt-BR", {
                                weekday: "long",
                            })
                            : "Data inválida";

                        const diaNumero = dataFormatada
                            ? dataFormatada.toLocaleDateString("pt-BR", {
                                day: "2-digit",
                            })
                            : "--";

                        const mesAno = dataFormatada
                            ? dataFormatada.toLocaleDateString("pt-BR", {
                                month: "long",
                                year: "numeric",
                            })
                            : "Data inválida";

                        return (
                            <article
                                key={dia.key}
                                className="rounded-[28px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-[0_20px_60px_-36px_rgba(15,23,42,0.30)]"
                            >
                                <div className="grid grid-cols-1 xl:grid-cols-[240px_minmax(0,1fr)_220px]">
                                    <div className="min-w-0 overflow-hidden border-b xl:border-b-0 xl:border-r border-slate-200 dark:border-slate-800 bg-[linear-gradient(135deg,rgba(6,182,212,0.10),rgba(255,255,255,0.98),rgba(14,165,233,0.05))] dark:bg-[linear-gradient(135deg,rgba(8,47,73,0.92),rgba(2,6,23,0.96),rgba(14,116,144,0.70))] px-5 py-6 md:px-6 md:py-7">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-3">
                                                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] bg-cyan-600 text-white shadow-[0_18px_40px_-18px_rgba(8,145,178,0.8)] ring-1 ring-cyan-400/30">
                                                    <CalendarDays className="h-6 w-6" />
                                                </div>

                                                <div className="min-w-0">
                                                    <p className="text-[10px] md:text-[11px] font-black uppercase tracking-[0.28em] text-cyan-700 dark:text-cyan-300">
                                                        Dia estudado
                                                    </p>
                                                    <p className="mt-1 text-sm font-bold capitalize text-slate-500 dark:text-slate-300 break-words">
                                                        {diaSemana}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="mt-5 min-w-0">
                                                <div className="max-w-full overflow-hidden">
                                                    <span className="block text-5xl sm:text-6xl md:text-[4.25rem] leading-[0.9] font-black tracking-[-0.08em] text-slate-950 dark:text-white break-words">
                                                        {diaNumero}
                                                    </span>
                                                </div>

                                                <span className="mt-2 block text-base md:text-lg font-bold capitalize text-slate-600 dark:text-slate-300 break-words">
                                                    {mesAno}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="min-w-0 px-5 py-6 md:px-6">
                                        <div className="space-y-4">
                                            {dia.itens.map((item) => (
                                                <div
                                                    key={item.id}
                                                    className="rounded-[22px] border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-4 md:p-5 shadow-sm"
                                                >
                                                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                                                        <div className="min-w-0">
                                                            <p className="text-[11px] font-black uppercase tracking-widest text-cyan-600 dark:text-cyan-400">
                                                                {item.origem}
                                                            </p>

                                                            <h4 className="mt-1 text-lg md:text-xl font-black text-slate-900 dark:text-white leading-tight break-words">
                                                                {item.materia}
                                                            </h4>

                                                            <p className="mt-1.5 text-sm md:text-[15px] text-slate-600 dark:text-slate-300 break-words">
                                                                {item.conteudo}
                                                            </p>
                                                        </div>

                                                        <div className="flex flex-wrap gap-2 lg:justify-end">
                                                            <span className="inline-flex items-center rounded-full bg-white dark:bg-slate-950 px-3 py-1 text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800">
                                                                {item.tipo}
                                                            </span>

                                                            <span className="inline-flex items-center rounded-full bg-white dark:bg-slate-950 px-3 py-1 text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800">
                                                                {new Date(item.inicio).toLocaleTimeString("pt-BR", {
                                                                    hour: "2-digit",
                                                                    minute: "2-digit",
                                                                })}
                                                            </span>

                                                            <span className="inline-flex items-center rounded-full bg-cyan-50 dark:bg-cyan-950/30 px-3 py-1 text-xs font-black uppercase tracking-wider text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-900/50">
                                                                {formatarHMS(item.segundos)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="border-t xl:border-t-0 xl:border-l border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/40 px-5 py-6 md:px-6 flex xl:flex-col justify-between xl:justify-center gap-4">
                                        <div>
                                            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                                                Somatório do dia
                                            </p>
                                            <p className="mt-2 text-3xl md:text-4xl font-black leading-none text-cyan-600 dark:text-cyan-400">
                                                {formatarHMS(dia.totalSegundos)}
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-2 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-3">
                                            <Clock3 size={16} className="text-cyan-600 dark:text-cyan-400" />
                                            <div>
                                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                                                    Atividades
                                                </p>
                                                <p className="text-lg font-black text-slate-900 dark:text-white">
                                                    {dia.itens.length}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </article>
                        );
                    })}
            </div>
        </div>
    );
};

export default Historico;