import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import { CalendarDays, Clock3, Filter, History, TimerReset } from "lucide-react";

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

const formatarHorasResumo = (segundos = 0) => {
    const total = Math.max(0, Number(segundos) || 0);
    const horas = Math.floor(total / 3600);
    const minutos = Math.floor((total % 3600) / 60);

    if (horas > 0 && minutos > 0) return `${horas}h ${minutos}min`;
    if (horas > 0) return `${horas}h`;
    return `${minutos}min`;
};

const formatarDataCabecalho = (dateKey) => {
    const data = new Date(`${dateKey}T00:00:00`);

    const diaSemana = data.toLocaleDateString("pt-BR", { weekday: "long" });
    const dia = data.toLocaleDateString("pt-BR", { day: "2-digit" });
    const mesAno = data.toLocaleDateString("pt-BR", {
        month: "long",
        year: "numeric",
    });
    const dataCompleta = data.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
    });

    return {
        diaSemana: diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1),
        dia,
        mesAno: mesAno.charAt(0).toUpperCase() + mesAno.slice(1),
        dataCompleta,
    };
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

        if (inicio > fim) {
            return {
                inicio: inicioDoDia(new Date(`${dataFimCustom}T12:00:00`)),
                fim: fimDoDia(new Date(`${dataInicioCustom}T12:00:00`)),
            };
        }

        return { inicio, fim };
    }, [periodo, dataBase, dataInicioCustom, dataFimCustom]);

    const carregarHistorico = async () => {
        if (!user?.id) return;
        setLoading(true);

        const inicioISO = intervalo.inicio.toISOString();
        const fimISO = intervalo.fim.toISOString();

        try {
            const [{ data: sessoes }, { data: subjects }, { data: blocos }] = await Promise.all([
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
        // eslint-disable-next-line
    }, [user?.id, intervalo.inicio.getTime(), intervalo.fim.getTime()]);

    const diasAgrupados = useMemo(() => {
        const bucket = new Map();

        entradas.forEach((item) => {
            const data = new Date(item.inicio);
            const chave = data.toISOString().slice(0, 10);

            if (!bucket.has(chave)) {
                bucket.set(chave, {
                    key: chave,
                    data: new Date(`${chave}T00:00:00`),
                    totalSegundos: 0,
                    totalItens: 0,
                    itens: [],
                });
            }

            const grupo = bucket.get(chave);
            grupo.totalSegundos += item.segundos;
            grupo.totalItens += 1;
            grupo.itens.push(item);
        });

        return Array.from(bucket.values()).sort((a, b) => b.data - a.data);
    }, [entradas]);

    const totalPeriodo = useMemo(
        () => diasAgrupados.reduce((acc, d) => acc + d.totalSegundos, 0),
        [diasAgrupados]
    );

    const totalSessoes = useMemo(
        () => diasAgrupados.reduce((acc, d) => acc + d.totalItens, 0),
        [diasAgrupados]
    );

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 bg-slate-50 dark:bg-slate-900/60 xl:col-span-3 shadow-sm">
                    <div className="flex items-center gap-2 text-cyan-600 dark:text-cyan-400 mb-3">
                        <Filter size={16} />
                        <p className="text-xs font-black uppercase tracking-widest">Filtro de período</p>
                    </div>

                    <div className="flex flex-wrap gap-2 mb-4">
                        {Object.entries(PERIODOS).map(([valor, label]) => (
                            <button
                                key={valor}
                                onClick={() => setPeriodo(valor)}
                                className={`px-3 py-2 rounded-xl text-sm font-bold border transition-all duration-200 cursor-pointer ${periodo === valor
                                    ? "bg-cyan-600 text-white border-cyan-500 shadow-[0_0_0_1px_rgba(34,211,238,0.18)]"
                                    : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-cyan-400/60 hover:text-cyan-600 dark:hover:text-cyan-400"
                                    }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>

                    <div className={`grid gap-3 ${periodo === "personalizado" ? "grid-cols-1 md:grid-cols-3" : "grid-cols-1 md:grid-cols-1"}`}>
                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                            {periodo === "personalizado" ? "Data base" : "Data de referência"}
                            <input
                                type="date"
                                value={dataBase}
                                onChange={(e) => setDataBase(e.target.value)}
                                className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2.5 text-slate-800 dark:text-slate-100 outline-none focus:border-cyan-500"
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
                                        className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2.5 text-slate-800 dark:text-slate-100 outline-none focus:border-cyan-500"
                                    />
                                </label>

                                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                                    Fim
                                    <input
                                        type="date"
                                        value={dataFimCustom}
                                        onChange={(e) => setDataFimCustom(e.target.value)}
                                        className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2.5 text-slate-800 dark:text-slate-100 outline-none focus:border-cyan-500"
                                    />
                                </label>
                            </>
                        )}
                    </div>
                </div>

                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 bg-white dark:bg-slate-900 shadow-sm">
                    <p className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                        Total no período
                    </p>

                    <p className="mt-2 text-3xl font-black text-cyan-600 dark:text-cyan-400">
                        {formatarHMS(totalPeriodo)}
                    </p>

                    <div className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                        <div className="flex items-center gap-2">
                            <CalendarDays size={15} className="text-cyan-500" />
                            <span>{diasAgrupados.length} dia(s) com estudo</span>
                        </div>

                        <div className="flex items-center gap-2">
                            <History size={15} className="text-cyan-500" />
                            <span>{totalSessoes} registro(s) no histórico</span>
                        </div>

                        <div className="flex items-center gap-2">
                            <TimerReset size={15} className="text-cyan-500" />
                            <span>{formatarHorasResumo(totalPeriodo)} acumulados</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="space-y-5">
                {loading && (
                    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 text-slate-500 dark:text-slate-400">
                        Carregando histórico...
                    </div>
                )}

                {!loading && diasAgrupados.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-10 text-center text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900">
                        Nenhum estudo encontrado no período selecionado.
                    </div>
                )}

                {!loading &&
                    diasAgrupados.map((dia) => {
                        const cabecalho = formatarDataCabecalho(dia.key);

                        return (
                            <article
                                key={dia.key}
                                className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm transition-all duration-300 hover:border-cyan-400/40 dark:hover:border-cyan-500/30"
                            >
                                <div className="grid grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)]">
                                    <div className="relative border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-5">
                                        <div className="absolute left-0 top-0 h-full w-1 bg-cyan-500/80" />

                                        <div className="pl-3">
                                            <div className="flex items-center gap-2 text-cyan-600 dark:text-cyan-400 mb-3">
                                                <CalendarDays size={16} />
                                                <span className="text-[11px] font-black uppercase tracking-[0.22em]">
                                                    Dia
                                                </span>
                                            </div>

                                            <p className="text-3xl lg:text-4xl font-black leading-none text-white dark:text-white">
                                                {cabecalho.dia}
                                            </p>

                                            <p className="mt-3 text-xl lg:text-2xl font-black text-slate-900 dark:text-slate-100 leading-tight">
                                                {cabecalho.diaSemana}
                                            </p>

                                            <p className="mt-2 text-base lg:text-lg font-semibold text-cyan-600 dark:text-cyan-400">
                                                {cabecalho.mesAno}
                                            </p>

                                            <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-cyan-200 dark:border-cyan-900/60 bg-cyan-50 dark:bg-cyan-950/30 px-3 py-1.5 text-sm font-bold text-cyan-700 dark:text-cyan-300">
                                                <Clock3 size={14} />
                                                {formatarHMS(dia.totalSegundos)}
                                            </div>

                                            <p className="mt-3 text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                                                {dia.totalItens} registro(s)
                                            </p>
                                        </div>
                                    </div>

                                    <div className="p-5 lg:p-6">
                                        <div className="mb-5">
                                            <h3 className="text-lg lg:text-xl font-black text-slate-900 dark:text-white">
                                                {cabecalho.dataCompleta}
                                            </h3>

                                        </div>

                                        <div className="relative">
                                            <div className="absolute left-[11px] top-0 bottom-0 w-px bg-cyan-500/20" />

                                            <div className="space-y-4">
                                                {dia.itens.map((item) => (
                                                    <div key={item.id} className="relative pl-8">
                                                        <div className="absolute left-0 top-5 h-[10px] w-[10px] rounded-full bg-cyan-500 shadow-[0_0_0_5px_rgba(6,182,212,0.08)]" />

                                                        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 p-4 transition-all duration-200 hover:border-cyan-400/40 dark:hover:border-cyan-500/30 hover:-translate-y-[1px]">
                                                            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                                                                <div className="min-w-0">
                                                                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-cyan-600 dark:text-cyan-400">
                                                                        {item.origem}
                                                                    </p>

                                                                    <p className="mt-1 text-lg font-bold text-slate-900 dark:text-white break-words">
                                                                        {item.materia}
                                                                    </p>

                                                                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300 break-words">
                                                                        {item.conteudo}
                                                                    </p>
                                                                </div>

                                                                <div className="shrink-0 rounded-xl border border-cyan-200 dark:border-cyan-900/50 bg-cyan-50 dark:bg-cyan-950/30 px-3 py-2 text-sm font-bold text-cyan-700 dark:text-cyan-300">
                                                                    {formatarHMS(item.segundos)}
                                                                </div>
                                                            </div>

                                                            <div className="mt-4 flex flex-wrap gap-2">
                                                                <span className="rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
                                                                    {item.tipo}
                                                                </span>

                                                                <span className="rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
                                                                    {new Date(item.inicio).toLocaleTimeString("pt-BR", {
                                                                        hour: "2-digit",
                                                                        minute: "2-digit",
                                                                    })}
                                                                </span>

                                                                <span className="rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
                                                                    {formatarHorasResumo(item.segundos)}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
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