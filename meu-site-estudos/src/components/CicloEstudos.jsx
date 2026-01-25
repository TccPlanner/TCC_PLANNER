import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabaseClient";
import {
    Play,
    Pause,
    RotateCcw,
    Plus,
    ArrowRight,
    CheckCircle2,
    Trophy,
    GripVertical,
    BarChart3,
    Clock3,
    Target,
    Layers,
    Repeat,
    KanbanSquare,
} from "lucide-react";

/* =========================================================
  CicloEstudos.jsx
  ✅ 2 Guias: Configuração | Execução
  ✅ Execução tem 2 modelos separados:
     - Modelo Ciclo (timer + concluir bloco + progresso por minutos)
     - Modelo Quadro (Trello: arrastar cards, progresso por cards)
  ✅ Se voltar card Concluída -> Estudar, desfaz progresso (zera minutos_feitos)
  ✅ Persistência: current_index / paused / remaining_seconds / modelo
========================================================= */

function formatHM(min) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    if (h <= 0) return `${m}m`;
    return `${h}h ${m}m`;
}

function clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
}

export default function CicloEstudos({ user }) {
    // Guias principais
    const [abaInterna, setAbaInterna] = useState("execucao"); // configuracao | execucao

    const [loading, setLoading] = useState(false);

    // ciclo
    const [cycle, setCycle] = useState(null);

    // matérias
    const [subjects, setSubjects] = useState([]);

    // setup form
    const [nomeMateria, setNomeMateria] = useState("");
    const [pesoMateria, setPesoMateria] = useState(1);
    const [metaMateria, setMetaMateria] = useState(60);

    // config ciclo
    const [nomeCiclo, setNomeCiclo] = useState("Meu ciclo");
    const [metaCicloTotal, setMetaCicloTotal] = useState(180);
    const [metaHoras, setMetaHoras] = useState(3);
    const [metaMin, setMetaMin] = useState(0);
    const [metaSeg, setMetaSeg] = useState(0);

    const [blocoDefault, setBlocoDefault] = useState(25);

    // modelo escolhido pelo usuário (salvo no supabase)
    const [modelo, setModelo] = useState("ciclo"); // ciclo | quadro

    // timer
    const timerRef = useRef(null);
    const [running, setRunning] = useState(false);
    const [remainingSec, setRemainingSec] = useState(0);

    // drag setup reorder
    const dragIndexRef = useRef(null);

    // drag trello
    const dragSubjectIdRef = useRef(null);

    /* =========================
       DERIVADOS
    ========================= */
    const currentSubject = useMemo(() => {
        if (!subjects?.length) return null;
        const idx = clamp(cycle?.current_index ?? 0, 0, subjects.length - 1);
        return subjects[idx] || null;
    }, [subjects, cycle?.current_index]);

    const totalMetaMaterias = useMemo(() => {
        return subjects.reduce((acc, s) => acc + (s.meta_minutos || 0), 0);
    }, [subjects]);

    const totalFeitoMaterias = useMemo(() => {
        return subjects.reduce((acc, s) => acc + (s.minutos_feitos || 0), 0);
    }, [subjects]);

    // Progresso do Modelo Ciclo (por minutos)
    const progressoCiclo = useMemo(() => {
        const meta = cycle?.meta_minutos_total || 0;
        const feito = totalFeitoMaterias || 0;
        if (meta <= 0) return 0;
        return Math.min(100, Math.round((feito / meta) * 100));
    }, [cycle?.meta_minutos_total, totalFeitoMaterias]);

    const faltaMin = useMemo(() => {
        const meta = cycle?.meta_minutos_total || 0;
        const feito = totalFeitoMaterias || 0;
        return Math.max(0, meta - feito);
    }, [cycle?.meta_minutos_total, totalFeitoMaterias]);

    // Progresso do Modelo Quadro (por cards concluídos)
    const progressoQuadro = useMemo(() => {
        if (!subjects.length) return 0;
        const concluidas = subjects.filter((s) => s.status === "concluida").length;
        return Math.round((concluidas / subjects.length) * 100);
    }, [subjects]);

    const cardsConcluidos = useMemo(() => {
        return subjects.filter((s) => s.status === "concluida").length;
    }, [subjects]);

    const displayTime = useMemo(() => {
        const sec = Math.max(0, remainingSec);
        const mm = String(Math.floor(sec / 60)).padStart(2, "0");
        const ss = String(sec % 60).padStart(2, "0");
        return `${mm}:${ss}`;
    }, [remainingSec]);

    /* =========================
       CARREGAR / CRIAR CICLO
    ========================= */
    const ensureCycle = async () => {
        if (!user?.id) return null;

        // tenta pegar 1 ciclo do usuário
        const { data: cycles, error } = await supabase
            .from("study_cycles")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: true })
            .limit(1);

        if (error) throw error;

        if (cycles && cycles.length > 0) {
            return cycles[0];
        }

        // cria ciclo padrão
        const { data: created, error: err2 } = await supabase
            .from("study_cycles")
            .insert([
                {
                    user_id: user.id,
                    nome: "Meu ciclo",
                    meta_minutos_total: 180,
                    bloco_minutos_default: 25,
                    current_index: 0,
                    is_paused: true,
                    current_remaining_seconds: 0,
                    cycles_completed: 0,
                    modelo: "ciclo",
                },
            ])
            .select("*")
            .single();

        if (err2) throw err2;
        return created;
    };

    const loadAll = async () => {
        try {
            setLoading(true);
            if (!user?.id) return;

            const c = await ensureCycle();
            if (!c) return;

            setCycle(c);

            setNomeCiclo(c.nome || "Meu ciclo");
            setMetaCicloTotal(c.meta_minutos_total || 180);

            const totalMin = c.meta_minutos_total || 180;

            const h = Math.floor(totalMin / 60);
            const m = totalMin % 60;

            setMetaHoras(h);
            setMetaMin(m);
            setMetaSeg(0);


            setBlocoDefault(c.bloco_minutos_default || 25);

            setModelo(c.modelo || "ciclo");

            const { data: subs, error: e2 } = await supabase
                .from("study_cycle_subjects")
                .select("*")
                .eq("user_id", user.id)
                .eq("cycle_id", c.id)
                .order("ordem", { ascending: true });

            if (e2) throw e2;
            setSubjects(subs || []);

            // timer: carregar estado persistido
            const persisted = c.current_remaining_seconds || 0;
            if (persisted > 0) setRemainingSec(persisted);
            else setRemainingSec((c.bloco_minutos_default || 25) * 60);

            setRunning(!c.is_paused && persisted > 0);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadAll();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id]);

    /* =========================
       TIMER LOOP
    ========================= */
    useEffect(() => {
        if (!running) {
            if (timerRef.current) clearInterval(timerRef.current);
            timerRef.current = null;
            return;
        }

        timerRef.current = setInterval(() => {
            setRemainingSec((prev) => {
                if (prev <= 1) {
                    clearInterval(timerRef.current);
                    timerRef.current = null;
                    setRunning(false);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            timerRef.current = null;
        };
    }, [running]);

    // persistir remainingSec e paused
    useEffect(() => {
        const t = setTimeout(async () => {
            if (!cycle?.id || !user?.id) return;
            await supabase
                .from("study_cycles")
                .update({
                    current_remaining_seconds: remainingSec,
                    is_paused: !running,
                })
                .eq("id", cycle.id)
                .eq("user_id", user.id);
        }, 1200);

        return () => clearTimeout(t);
    }, [remainingSec, running, cycle?.id, user?.id]);

    /* =========================
       AÇÕES - MODELO (SALVAR)
    ========================= */
    const trocarModelo = async (novo) => {
        setModelo(novo);

        if (!cycle?.id || !user?.id) return;

        const { data, error } = await supabase
            .from("study_cycles")
            .update({ modelo: novo })
            .eq("id", cycle.id)
            .eq("user_id", user.id)
            .select("*")
            .single();

        if (!error && data) setCycle(data);
    };

    /* =========================
       AÇÕES - SETUP
    ========================= */
    const salvarConfigCiclo = async () => {
        try {
            setLoading(true);
            if (!cycle?.id || !user?.id) return;

            const { data, error } = await supabase
                .from("study_cycles")
                .update({
                    nome: nomeCiclo.trim() || "Meu ciclo",
                    meta_minutos_total: Number(metaCicloTotal) || 180,
                    bloco_minutos_default: Number(blocoDefault) || 25,
                })
                .eq("id", cycle.id)
                .eq("user_id", user.id)
                .select("*")
                .single();

            if (error) throw error;
            setCycle(data);

            if (!remainingSec || remainingSec <= 0) {
                setRemainingSec((Number(blocoDefault) || 25) * 60);
            }
        } finally {
            setLoading(false);
        }
    };

    const adicionarMateria = async () => {
        try {
            setLoading(true);
            if (!cycle?.id || !user?.id) return;

            const nome = nomeMateria.trim();
            if (!nome) return alert("Digite o nome da matéria.");

            const ordem = subjects.length;

            const { data, error } = await supabase
                .from("study_cycle_subjects")
                .insert([
                    {
                        user_id: user.id,
                        cycle_id: cycle.id,
                        nome,
                        peso: Number(pesoMateria) || 1,
                        meta_minutos: Number(metaMateria) || 60,
                        ordem,
                        status: "estudar",
                        minutos_feitos: 0,
                    },
                ])
                .select("*")
                .single();

            if (error) throw error;

            setSubjects((prev) => [...prev, data]);
            setNomeMateria("");
            setPesoMateria(1);
            setMetaMateria(60);
        } finally {
            setLoading(false);
        }
    };

    const atualizarMateria = async (id, patch) => {
        if (!user?.id) return;

        // otimista
        setSubjects((prev) =>
            prev.map((s) => (s.id === id ? { ...s, ...patch } : s))
        );

        await supabase
            .from("study_cycle_subjects")
            .update(patch)
            .eq("id", id)
            .eq("user_id", user.id);
    };

    const reorderSubjects = async (fromIndex, toIndex) => {
        if (fromIndex === toIndex) return;

        const newList = [...subjects];
        const [moved] = newList.splice(fromIndex, 1);
        newList.splice(toIndex, 0, moved);

        const withOrder = newList.map((s, idx) => ({ ...s, ordem: idx }));
        setSubjects(withOrder);

        if (!user?.id) return;

        for (const s of withOrder) {
            await supabase
                .from("study_cycle_subjects")
                .update({ ordem: s.ordem })
                .eq("id", s.id)
                .eq("user_id", user.id);
        }

        // manter a mesma matéria atual selecionada
        if (cycle?.id && currentSubject?.id) {
            const newIndex = withOrder.findIndex((s) => s.id === currentSubject.id);
            if (newIndex >= 0) {
                const { data } = await supabase
                    .from("study_cycles")
                    .update({ current_index: newIndex })
                    .eq("id", cycle.id)
                    .eq("user_id", user.id)
                    .select("*")
                    .single();
                if (data) setCycle(data);
            }
        }
    };

    /* =========================
       AÇÕES - EXECUÇÃO / CICLO
    ========================= */
    const pausarOuRetomar = async () => {
        const next = !running;
        setRunning(next);

        if (cycle?.id && user?.id) {
            const { data } = await supabase
                .from("study_cycles")
                .update({
                    is_paused: !next,
                    current_remaining_seconds: remainingSec,
                })
                .eq("id", cycle.id)
                .eq("user_id", user.id)
                .select("*")
                .single();
            if (data) setCycle(data);
        }
    };

    const resetarBloco = async () => {
        const sec = (cycle?.bloco_minutos_default || 25) * 60;
        setRemainingSec(sec);
        setRunning(false);

        if (cycle?.id && user?.id) {
            const { data } = await supabase
                .from("study_cycles")
                .update({
                    current_remaining_seconds: sec,
                    is_paused: true,
                })
                .eq("id", cycle.id)
                .eq("user_id", user.id)
                .select("*")
                .single();
            if (data) setCycle(data);
        }
    };

    const concluirBloco = async () => {
        try {
            setLoading(true);
            if (!cycle?.id || !user?.id) return;
            if (!currentSubject?.id) return alert("Cadastre matérias na Configuração.");

            const blocoMin = cycle?.bloco_minutos_default || 25;
            const passouMin = Math.max(0, Math.round(blocoMin - remainingSec / 60));
            const minutosParaSomar = passouMin > 0 ? passouMin : blocoMin;

            // 1) salvar sessão
            await supabase.from("study_cycle_sessions").insert([
                {
                    user_id: user.id,
                    cycle_id: cycle.id,
                    subject_id: currentSubject.id,
                    minutos: minutosParaSomar,
                    started_at: new Date().toISOString(),
                    ended_at: new Date().toISOString(),
                },
            ]);

            // 2) somar minutos feitos
            const novoFeito =
                (currentSubject.minutos_feitos || 0) + minutosParaSomar;
            await atualizarMateria(currentSubject.id, { minutos_feitos: novoFeito });

            // 3) próxima matéria
            const nextIndex =
                subjects.length > 0
                    ? (cycle.current_index + 1) % subjects.length
                    : 0;

            const resetSec = (cycle.bloco_minutos_default || 25) * 60;

            const { data: newCycle, error } = await supabase
                .from("study_cycles")
                .update({
                    current_index: nextIndex,
                    current_remaining_seconds: resetSec,
                    is_paused: true,
                })
                .eq("id", cycle.id)
                .eq("user_id", user.id)
                .select("*")
                .single();

            if (error) throw error;

            setCycle(newCycle);
            setRemainingSec(resetSec);
            setRunning(false);
        } finally {
            setLoading(false);
        }
    };

    const concluirCicloAtual = async () => {
        try {
            setLoading(true);
            if (!cycle?.id || !user?.id) return;

            const resetSec = (cycle.bloco_minutos_default || 25) * 60;

            const { data, error } = await supabase
                .from("study_cycles")
                .update({
                    cycles_completed: (cycle.cycles_completed || 0) + 1,
                    current_index: 0,
                    current_remaining_seconds: resetSec,
                    is_paused: true,
                })
                .eq("id", cycle.id)
                .eq("user_id", user.id)
                .select("*")
                .single();

            if (error) throw error;

            setCycle(data);
            setRemainingSec(resetSec);
            setRunning(false);
        } finally {
            setLoading(false);
        }
    };

    /* =========================
       TRELLO - drag/drop status
       ✅ regra: voltar concluida -> estudar desfaz progresso
    ========================= */
    const dropToStatus = async (status) => {
        const id = dragSubjectIdRef.current;
        dragSubjectIdRef.current = null;
        if (!id) return;

        const target = subjects.find((s) => s.id === id);
        if (!target) return;

        // ✅ Se voltar de concluída -> estudar: desfaz progresso
        if (target.status === "concluida" && status === "estudar") {
            await atualizarMateria(id, {
                status: "estudar",
                minutos_feitos: 0,
            });
            return;
        }

        await atualizarMateria(id, { status });
    };

    /* =========================
       COMPONENTES VISUAIS
    ========================= */
    const HeaderProgressoCiclo = () => (
        <div className="rounded-2xl border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 p-6 shadow-sm">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <div className="text-5xl font-black tracking-tight">{progressoCiclo}%</div>
                    <div className="mt-1 text-slate-600 dark:text-slate-400 text-sm">
                        Progresso do ciclo (minutos)
                    </div>
                </div>

                <div className="text-right">
                    <div className="text-amber-500 font-bold text-xl">
                        Falta: {formatHM(faltaMin)}
                    </div>
                    <div className="text-slate-500 dark:text-slate-400 text-sm italic">
                        Meta: {formatHM(cycle?.meta_minutos_total || 0)}
                    </div>
                </div>
            </div>

            <div className="mt-4 w-full h-3 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                <div
                    className="h-full bg-cyan-500 transition-all"
                    style={{ width: `${progressoCiclo}%` }}
                />
            </div>
        </div>
    );

    const HeaderProgressoQuadro = () => (
        <div className="rounded-2xl border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 p-6 shadow-sm">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <div className="text-5xl font-black tracking-tight">{progressoQuadro}%</div>
                    <div className="mt-1 text-slate-600 dark:text-slate-400 text-sm">
                        Progresso do quadro (cards)
                    </div>
                </div>

                <div className="text-right">
                    <div className="text-emerald-500 font-bold text-xl">
                        Concluídos: {cardsConcluidos}/{subjects.length}
                    </div>
                    <div className="text-slate-500 dark:text-slate-400 text-sm italic">
                        Total de matérias: {subjects.length}
                    </div>
                </div>
            </div>

            <div className="mt-4 w-full h-3 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                <div
                    className="h-full bg-emerald-500 transition-all"
                    style={{ width: `${progressoQuadro}%` }}
                />
            </div>
        </div>
    );

    const ModeloCiclo = () => (
        <>
            <HeaderProgressoCiclo />

            {/* Matéria da vez + Timer */}
            <div className="rounded-2xl border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 p-6 shadow-sm">
                <div className="flex flex-col lg:flex-row justify-between gap-6">
                    {/* Indicador */}
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2 text-slate-600 dark:text-slate-300">
                            <Layers size={18} />
                            <span className="font-semibold">Matéria da vez</span>
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-300">
                                <ArrowRight />
                            </div>

                            <div>
                                <div className="text-xl font-bold">
                                    {currentSubject?.nome || "Nenhuma matéria cadastrada"}
                                </div>
                                <div className="text-sm text-slate-600 dark:text-slate-400">
                                    Peso: {currentSubject?.peso ?? "-"} • Meta:{" "}
                                    {formatHM(currentSubject?.meta_minutos ?? 0)} • Feito:{" "}
                                    {formatHM(currentSubject?.minutos_feitos ?? 0)}
                                </div>
                            </div>
                        </div>

                        <div className="mt-4 text-sm text-slate-500 dark:text-slate-400">
                            ✅ O ciclo salva automaticamente onde você parou (matéria e tempo).
                        </div>
                    </div>

                    {/* Timer box */}
                    <div className="w-full lg:w-[320px] rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-5">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300 font-semibold">
                                <Clock3 size={18} />
                                Timer do bloco
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                                {cycle?.bloco_minutos_default || 25} min
                            </div>
                        </div>

                        <div className="mt-3 text-4xl font-black tracking-tight">
                            {displayTime}
                        </div>

                        <div className="mt-4 flex gap-2">
                            <button
                                onClick={pausarOuRetomar}
                                className={`flex-1 rounded-xl px-4 py-3 font-semibold transition-all flex items-center justify-center gap-2 ${running
                                    ? "bg-amber-500 text-white hover:bg-amber-600"
                                    : "bg-cyan-600 text-white hover:bg-cyan-700"
                                    }`}
                            >
                                {running ? <Pause size={18} /> : <Play size={18} />}
                                {running ? "Pausar" : "Iniciar"}
                            </button>

                            <button
                                onClick={resetarBloco}
                                className="rounded-xl px-4 py-3 font-semibold border border-slate-200 dark:border-slate-800 hover:bg-white dark:hover:bg-slate-900 flex items-center justify-center"
                                title="Resetar bloco"
                            >
                                <RotateCcw size={18} />
                            </button>
                        </div>

                        <button
                            onClick={concluirBloco}
                            className="mt-3 w-full rounded-xl px-4 py-3 font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-2"
                        >
                            <CheckCircle2 size={18} />
                            Concluir bloco
                        </button>
                    </div>
                </div>
            </div>

            {/* Etapas */}
            <div className="rounded-2xl border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                    <div className="text-lg font-bold">Etapas</div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                        Matéria atual destacada
                    </div>
                </div>

                {subjects.length === 0 ? (
                    <div className="py-10 text-center text-slate-500">
                        Nenhuma matéria cadastrada ainda. Vá em <b>Configuração</b>.
                    </div>
                ) : (
                    <div className="space-y-3">
                        {subjects.map((s, idx) => {
                            const isCurrent = idx === (cycle?.current_index ?? 0);
                            const perc = s.meta_minutos
                                ? Math.min(
                                    100,
                                    Math.round(((s.minutos_feitos || 0) / s.meta_minutos) * 100)
                                )
                                : 0;

                            const falta = Math.max(
                                0,
                                (s.meta_minutos || 0) - (s.minutos_feitos || 0)
                            );

                            return (
                                <div
                                    key={s.id}
                                    className={`rounded-xl border p-4 transition-all ${isCurrent
                                        ? "border-cyan-500 bg-cyan-500/5"
                                        : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
                                        }`}
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <div className="font-bold flex items-center gap-2">
                                                {isCurrent && (
                                                    <span className="inline-flex items-center gap-1 text-cyan-600 dark:text-cyan-300 text-sm">
                                                        <ArrowRight size={16} />
                                                        Agora
                                                    </span>
                                                )}
                                                <span>{s.nome}</span>
                                            </div>
                                            <div className="text-xs text-slate-500 dark:text-slate-400">
                                                Falta: <b>{formatHM(falta)}</b> • Meta:{" "}
                                                <b>{formatHM(s.meta_minutos || 0)}</b>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3">
                                            <div className="text-sm text-slate-500 dark:text-slate-400">
                                                {perc}%
                                            </div>
                                            <div className="w-28 h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-cyan-500"
                                                    style={{ width: `${perc}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                <div className="mt-6 flex items-center justify-between gap-4 flex-col sm:flex-row">
                    <div className="text-slate-600 dark:text-slate-300 flex items-center gap-2">
                        <Trophy size={18} className="text-amber-500" />
                        <span>
                            Ciclos concluídos:{" "}
                            <b className="text-slate-900 dark:text-white">
                                {cycle?.cycles_completed ?? 0}
                            </b>
                        </span>
                    </div>

                    <button
                        onClick={concluirCicloAtual}
                        className="rounded-xl px-5 py-3 font-bold bg-indigo-600 hover:bg-indigo-700 text-white"
                    >
                        Concluir ciclo atual
                    </button>
                </div>
            </div>
        </>
    );

    const ModeloQuadro = () => (
        <>
            <HeaderProgressoQuadro />

            {/* Quadro */}
            <div className="rounded-2xl border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                    <KanbanSquare size={18} className="text-emerald-500" />
                    <h3 className="text-lg font-bold">Quadro (arrastar para concluir)</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Estudar */}
                    <div
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => dropToStatus("estudar")}
                        className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4 min-h-[240px]"
                    >
                        <div className="font-bold mb-3 text-slate-700 dark:text-slate-200">
                            Estudar
                        </div>

                        <div className="space-y-3">
                            {subjects
                                .filter((s) => s.status !== "concluida")
                                .map((s) => (
                                    <div
                                        key={s.id}
                                        draggable
                                        onDragStart={() => (dragSubjectIdRef.current = s.id)}
                                        className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 shadow-sm cursor-grab active:cursor-grabbing"
                                    >
                                        <div className="font-semibold">{s.nome}</div>
                                        <div className="text-xs text-slate-500 dark:text-slate-400">
                                            Peso: {s.peso} • Meta: {formatHM(s.meta_minutos || 0)}
                                        </div>
                                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                                            Feito: <b>{formatHM(s.minutos_feitos || 0)}</b>
                                        </div>
                                    </div>
                                ))}
                        </div>
                    </div>

                    {/* Concluídas */}
                    <div
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => dropToStatus("concluida")}
                        className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-emerald-500/5 p-4 min-h-[240px]"
                    >
                        <div className="font-bold mb-3 text-emerald-600 dark:text-emerald-300">
                            Concluídas
                        </div>

                        <div className="space-y-3">
                            {subjects
                                .filter((s) => s.status === "concluida")
                                .map((s) => (
                                    <div
                                        key={s.id}
                                        draggable
                                        onDragStart={() => (dragSubjectIdRef.current = s.id)}
                                        className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 shadow-sm cursor-grab active:cursor-grabbing"
                                    >
                                        <div className="font-semibold">{s.nome}</div>
                                        <div className="text-xs text-slate-500 dark:text-slate-400">
                                            Concluída ✅ (se voltar, zera o progresso)
                                        </div>
                                    </div>
                                ))}
                        </div>
                    </div>
                </div>

                <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
                    Dica: arraste para <b>Concluídas</b>. Se você voltar para <b>Estudar</b>, o
                    progresso é desfeito automaticamente.
                </p>
            </div>
        </>
    );

    /* =========================
       UI PRINCIPAL
    ========================= */
    return (
        <div className="w-full">
            {/* TOP BAR */}
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-6">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Ciclo de estudos</h2>
                    <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">
                        Configure e execute seus estudos de forma simples — com o modelo que você preferir.
                    </p>
                </div>

                {/* Guias principais */}
                <div className="flex bg-slate-100 dark:bg-slate-800 rounded-xl p-1 border border-slate-200 dark:border-slate-700">
                    <button
                        onClick={() => setAbaInterna("configuracao")}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${abaInterna === "configuracao"
                            ? "bg-white dark:bg-slate-900 shadow text-slate-900 dark:text-white"
                            : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                            }`}
                    >
                        Configuração
                    </button>

                    <button
                        onClick={() => setAbaInterna("execucao")}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${abaInterna === "execucao"
                            ? "bg-white dark:bg-slate-900 shadow text-slate-900 dark:text-white"
                            : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                            }`}
                    >
                        Execução
                    </button>
                </div>
            </div>

            {/* GRID (conteúdo + estatísticas à direita) */}
            <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6">
                {/* LEFT */}
                <div className="space-y-6">
                    {/* EXECUÇÃO */}
                    {abaInterna === "execucao" && (
                        <>
                            {/* Seletor de Modelo */}
                            <div className="rounded-2xl border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 p-4 shadow-sm">
                                <div className="flex items-center justify-between flex-col sm:flex-row gap-3">
                                    <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                                        <Repeat size={18} className="text-indigo-500" />
                                        <span className="font-bold">Modelo de Execução</span>
                                        <span className="text-xs text-slate-500 dark:text-slate-400">
                                            (você escolhe o que é mais fácil)
                                        </span>
                                    </div>

                                    <div className="flex bg-slate-100 dark:bg-slate-800 rounded-xl p-1 border border-slate-200 dark:border-slate-700">
                                        <button
                                            onClick={() => trocarModelo("ciclo")}
                                            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${modelo === "ciclo"
                                                ? "bg-white dark:bg-slate-900 shadow text-slate-900 dark:text-white"
                                                : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                                                }`}
                                        >
                                            Modelo Ciclo
                                        </button>

                                        <button
                                            onClick={() => trocarModelo("quadro")}
                                            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${modelo === "quadro"
                                                ? "bg-white dark:bg-slate-900 shadow text-slate-900 dark:text-white"
                                                : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                                                }`}
                                        >
                                            Modelo Quadro
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Renderiza só UM modelo por vez */}
                            {modelo === "ciclo" && <ModeloCiclo />}
                            {modelo === "quadro" && <ModeloQuadro />}
                        </>
                    )}

                    {/* CONFIGURAÇÃO */}
                    {abaInterna === "configuracao" && (
                        <>
                            {/* Config do ciclo */}
                            <div className="rounded-2xl border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 p-6 shadow-sm">
                                <div className="text-lg font-bold mb-4">
                                    Configuração do Ciclo (Setup)
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                                            Nome do ciclo
                                        </label>
                                        <input
                                            value={nomeCiclo}
                                            onChange={(e) => setNomeCiclo(e.target.value)}
                                            className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-4 py-3 outline-none focus:ring-2 focus:ring-cyan-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                                            Meta total (minutos)
                                        </label>
                                        <input
                                            type="number"
                                            value={metaCicloTotal}
                                            onChange={(e) => setMetaCicloTotal(e.target.value)}
                                            className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-4 py-3 outline-none focus:ring-2 focus:ring-cyan-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                                            Bloco padrão (minutos)
                                        </label>
                                        <input
                                            type="number"
                                            value={blocoDefault}
                                            onChange={(e) => setBlocoDefault(e.target.value)}
                                            className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-4 py-3 outline-none focus:ring-2 focus:ring-cyan-500"
                                        />
                                    </div>
                                </div>

                                <button
                                    onClick={salvarConfigCiclo}
                                    className="mt-4 rounded-xl px-5 py-3 font-bold bg-cyan-600 hover:bg-cyan-700 text-white"
                                >
                                    Salvar configurações
                                </button>
                            </div>

                            {/* Adicionar matéria */}
                            <div className="rounded-2xl border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 p-6 shadow-sm">
                                <div className="flex items-center justify-between gap-3 mb-4 flex-col md:flex-row">
                                    <div className="text-lg font-bold">Matérias</div>
                                    <div className="text-sm text-slate-500 dark:text-slate-400">
                                        Total de metas (somadas): <b>{formatHM(totalMetaMaterias)}</b>
                                    </div>
                                </div>

                                {/* CAMPOS COM CABEÇALHO */}
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                    <div className="md:col-span-2">
                                        <label className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                                            Nome da matéria
                                        </label>
                                        <input
                                            value={nomeMateria}
                                            onChange={(e) => setNomeMateria(e.target.value)}
                                            className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-4 py-3 outline-none focus:ring-2 focus:ring-cyan-500"
                                            placeholder="Ex: Matemática"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                                            Peso (importância)
                                        </label>
                                        <input
                                            type="number"
                                            value={pesoMateria}
                                            onChange={(e) => setPesoMateria(e.target.value)}
                                            className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-4 py-3 outline-none focus:ring-2 focus:ring-cyan-500"
                                            min={1}
                                        />
                                    </div>

                                    <div>
                                        <label className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                                            Meta (minutos)
                                        </label>
                                        <input
                                            type="number"
                                            value={metaMateria}
                                            onChange={(e) => setMetaMateria(e.target.value)}
                                            className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-4 py-3 outline-none focus:ring-2 focus:ring-cyan-500"
                                            min={1}
                                        />
                                    </div>
                                </div>

                                <button
                                    onClick={adicionarMateria}
                                    className="mt-3 rounded-xl px-5 py-3 font-bold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-2"
                                >
                                    <Plus size={18} />
                                    Adicionar matéria
                                </button>

                                {/* Lista com drag order */}
                                <div className="mt-6">
                                    <div className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-3">
                                        Ordem de execução (arraste para reordenar)
                                    </div>

                                    {subjects.length === 0 ? (
                                        <div className="py-10 text-center text-slate-500">
                                            Nenhuma matéria cadastrada.
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {subjects.map((s, idx) => (
                                                <div
                                                    key={s.id}
                                                    draggable
                                                    onDragStart={() => (dragIndexRef.current = idx)}
                                                    onDragOver={(e) => e.preventDefault()}
                                                    onDrop={() => {
                                                        const from = dragIndexRef.current;
                                                        if (from === null || from === undefined) return;
                                                        reorderSubjects(from, idx);
                                                        dragIndexRef.current = null;
                                                    }}
                                                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 cursor-grab active:cursor-grabbing"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="text-slate-400">
                                                            <GripVertical />
                                                        </div>
                                                        <div>
                                                            <div className="font-bold">{s.nome}</div>
                                                            <div className="text-xs text-slate-500 dark:text-slate-400">
                                                                Peso: {s.peso} • Meta: {formatHM(s.meta_minutos || 0)} • Status:{" "}
                                                                <b>{s.status}</b>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex flex-col sm:flex-row gap-2">
                                                        <button
                                                            onClick={async () => {
                                                                // ✅ se voltar para estudar, desfaz progresso
                                                                if (s.status === "concluida") {
                                                                    await atualizarMateria(s.id, {
                                                                        status: "estudar",
                                                                        minutos_feitos: 0,
                                                                    });
                                                                } else {
                                                                    await atualizarMateria(s.id, {
                                                                        status: "concluida",
                                                                    });
                                                                }
                                                            }}
                                                            className="rounded-xl px-4 py-2 font-semibold border border-slate-200 dark:border-slate-800 hover:bg-white dark:hover:bg-slate-900"
                                                        >
                                                            Alternar status
                                                        </button>

                                                        <button
                                                            onClick={() => atualizarMateria(s.id, { minutos_feitos: 0 })}
                                                            className="rounded-xl px-4 py-2 font-semibold border border-slate-200 dark:border-slate-800 hover:bg-white dark:hover:bg-slate-900"
                                                            title="Zerar minutos feitos desta matéria"
                                                        >
                                                            Zerar feito
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <div className="mt-4 text-xs text-slate-500 dark:text-slate-400">
                                        ✅ Quando você muda a ordem, o sistema ajusta o <b>ponto onde parou</b> para
                                        continuar na mesma matéria.
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* RIGHT - STATISTICS */}
                <aside className="space-y-6">
                    <div className="rounded-2xl border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 p-6 shadow-sm">
                        <div className="flex items-center gap-2 mb-4">
                            <Target size={18} className="text-cyan-500" />
                            <h3 className="text-lg font-bold">Estatísticas</h3>
                        </div>

                        <div className="space-y-3 text-sm">
                            {/* PROGRESSO CONFORME O MODELO */}
                            <div className="flex justify-between text-slate-600 dark:text-slate-300">
                                <span>Modelo</span>
                                <b className="text-slate-900 dark:text-white">
                                    {modelo === "ciclo" ? "Ciclo" : "Quadro"}
                                </b>
                            </div>

                            <div className="flex justify-between text-slate-600 dark:text-slate-300">
                                <span>Progresso</span>
                                <b className="text-slate-900 dark:text-white">
                                    {modelo === "ciclo" ? `${progressoCiclo}%` : `${progressoQuadro}%`}
                                </b>
                            </div>

                            <div className="pt-3 border-t border-slate-200 dark:border-slate-800" />

                            <div className="flex justify-between text-slate-600 dark:text-slate-300">
                                <span>Meta do ciclo</span>
                                <b className="text-slate-900 dark:text-white">
                                    {formatHM(cycle?.meta_minutos_total || 0)}
                                </b>
                            </div>

                            <div className="flex justify-between text-slate-600 dark:text-slate-300">
                                <span>Feito (minutos)</span>
                                <b className="text-slate-900 dark:text-white">
                                    {formatHM(totalFeitoMaterias)}
                                </b>
                            </div>

                            <div className="flex justify-between text-slate-600 dark:text-slate-300">
                                <span>Falta (minutos)</span>
                                <b className="text-amber-500">{formatHM(faltaMin)}</b>
                            </div>

                            <div className="flex justify-between text-slate-600 dark:text-slate-300">
                                <span>Bloco padrão</span>
                                <b className="text-slate-900 dark:text-white">
                                    {cycle?.bloco_minutos_default || 25} min
                                </b>
                            </div>

                            <div className="flex justify-between text-slate-600 dark:text-slate-300">
                                <span>Matérias</span>
                                <b className="text-slate-900 dark:text-white">{subjects.length}</b>
                            </div>

                            <div className="flex justify-between text-slate-600 dark:text-slate-300">
                                <span>Ciclos concluídos</span>
                                <b className="text-slate-900 dark:text-white">
                                    {cycle?.cycles_completed || 0}
                                </b>
                            </div>

                            <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
                                <div className="text-slate-500 dark:text-slate-400 text-xs mb-2">
                                    Matéria atual (ponto onde parou)
                                </div>
                                <div className="font-bold">{currentSubject?.nome || "—"}</div>
                                <div className="text-xs text-slate-500 dark:text-slate-400">
                                    Você volta exatamente daqui.
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-2xl border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 p-6 shadow-sm">
                        <div className="flex items-center gap-2 mb-3">
                            <BarChart3 size={18} className="text-indigo-500" />
                            <div className="text-sm font-bold">Ranking de esforço (peso)</div>
                        </div>

                        {subjects.length === 0 ? (
                            <div className="text-sm text-slate-500">Sem matérias.</div>
                        ) : (
                            <div className="space-y-3">
                                {[...subjects]
                                    .sort((a, b) => (b.peso || 0) - (a.peso || 0))
                                    .slice(0, 6)
                                    .map((s) => (
                                        <div key={s.id}>
                                            <div className="flex justify-between text-xs text-slate-600 dark:text-slate-300">
                                                <span className="font-semibold">{s.nome}</span>
                                                <span>Peso {s.peso}</span>
                                            </div>
                                            <div className="mt-1 w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-indigo-500"
                                                    style={{
                                                        width: `${Math.min(100, (s.peso || 0) * 20)}%`,
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        )}
                    </div>

                    {loading && (
                        <div className="rounded-2xl border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 p-4 text-sm text-slate-500">
                            Salvando / carregando...
                        </div>
                    )}
                </aside>
            </div>
        </div>
    );
}
