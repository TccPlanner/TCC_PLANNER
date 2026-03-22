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
    LayoutGrid,
    ListChecks,
    Repeat,
} from "lucide-react";

/* =========================================================
  CicloEstudos
========================================================= */

function formatHM(min) {
    const h = Math.floor((min || 0) / 60);
    const m = (min || 0) % 60;
    if (h <= 0) return `${m}m`;
    return `${h}h ${m}m`;
}

function formatHMS(segundos) {
    const s = Math.max(0, Math.floor(segundos || 0));
    const hh = String(Math.floor(s / 3600)).padStart(2, "0");
    const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
    const ss = String(s % 60).padStart(2, "0");
    return `${hh}:${mm}:${ss}`;
}

function clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
}

export default function CicloEstudos({ user }) {
    const [abaInterna, setAbaInterna] = useState("agora");
    const [loading, setLoading] = useState(false);

    const [modoAgora, setModoAgora] = useState("ciclo");

    const [cycle, setCycle] = useState(null);
    const [subjects, setSubjects] = useState([]);

    const [nomeMateria, setNomeMateria] = useState("");
    const [pesoMateria, setPesoMateria] = useState(1);
    const [metaMateria, setMetaMateria] = useState(60);

    const [nomeCiclo, setNomeCiclo] = useState("Meu ciclo");
    const [metaCicloTotal, setMetaCicloTotal] = useState(180);

    const [metaHoras, setMetaHoras] = useState(3);
    const [metaMin, setMetaMin] = useState(0);
    const [metaSeg, setMetaSeg] = useState(0);

    const [blocoDefault, setBlocoDefault] = useState(25);

    const timerRef = useRef(null);
    const [running, setRunning] = useState(false);
    const [remainingSec, setRemainingSec] = useState(0);

    const dragIndexRef = useRef(null);
    const dragSubjectIdRef = useRef(null);

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

    const blocoSecTotal = useMemo(() => {
        return (cycle?.bloco_minutos_default || 25) * 60;
    }, [cycle?.bloco_minutos_default]);

    const feitoAgoraSec = useMemo(() => {
        return Math.max(0, blocoSecTotal - (remainingSec || 0));
    }, [blocoSecTotal, remainingSec]);

    const totalFeitoAtualComRodandoSec = useMemo(() => {
        const base = (currentSubject?.minutos_feitos || 0) * 60;
        return base + (running ? feitoAgoraSec : 0);
    }, [currentSubject?.minutos_feitos, running, feitoAgoraSec]);

    /* =========================
       CARREGAR / CRIAR CICLO
    ========================= */
    const ensureCycle = async () => {
        if (!user?.id) return;

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

            const lsKey = `study_cycle_mode:${user.id}`;
            const savedMode = localStorage.getItem(lsKey);
            if (savedMode === "ciclo" || savedMode === "quadro") setModoAgora(savedMode);

            const c = await ensureCycle();
            setCycle(c);

            setNomeCiclo(c.nome || "Meu ciclo");
            setMetaCicloTotal(c.meta_minutos_total || 180);
            setBlocoDefault(c.bloco_minutos_default || 25);

            const totalMin = Number(c.meta_minutos_total || 180);
            setMetaHoras(Math.floor(totalMin / 60));
            setMetaMin(totalMin % 60);
            setMetaSeg(0);

            const { data: subs, error: e2 } = await supabase
                .from("study_cycle_subjects")
                .select("*")
                .eq("user_id", user.id)
                .eq("cycle_id", c.id)
                .order("ordem", { ascending: true });

            if (e2) throw e2;
            setSubjects(subs || []);

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

    useEffect(() => {
        if (!user?.id) return;
        const lsKey = `study_cycle_mode:${user.id}`;
        localStorage.setItem(lsKey, modoAgora);
    }, [modoAgora, user?.id]);

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
        }, 2000);

        return () => clearTimeout(t);
    }, [remainingSec, running, cycle?.id, user?.id]);

    const displayTime = useMemo(() => {
        const sec = Math.max(0, remainingSec);
        const mm = String(Math.floor(sec / 60)).padStart(2, "0");
        const ss = String(sec % 60).padStart(2, "0");
        return `${mm}:${ss}`;
    }, [remainingSec]);

    /* =========================
       AÇÕES - SETUP
    ========================= */
    const salvarConfigCiclo = async () => {
        try {
            setLoading(true);
            if (!cycle?.id || !user?.id) return;

            const metaMinutosTotal =
                Number(metaHoras || 0) * 60 +
                Number(metaMin || 0) +
                Math.ceil(Number(metaSeg || 0) / 60);

            setMetaCicloTotal(metaMinutosTotal || 180);

            const { data, error } = await supabase
                .from("study_cycles")
                .update({
                    nome: nomeCiclo.trim() || "Meu ciclo",
                    meta_minutos_total: metaMinutosTotal || 180,
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

    const zerarCiclosFeitos = async () => {
        try {
            setLoading(true);
            if (!cycle?.id || !user?.id) return;

            const [
                { data, error },
                { error: resetSubjectsError },
                { error: deleteSessionsError },
            ] = await Promise.all([
                supabase
                    .from("study_cycles")
                    .update({ cycles_completed: 0 })
                    .eq("id", cycle.id)
                    .eq("user_id", user.id)
                    .select("*")
                    .single(),
                supabase
                    .from("study_cycle_subjects")
                    .update({ minutos_feitos: 0, status: "estudar" })
                    .eq("cycle_id", cycle.id)
                    .eq("user_id", user.id),
                supabase
                    .from("study_cycle_sessions")
                    .delete()
                    .eq("cycle_id", cycle.id)
                    .eq("user_id", user.id),
            ]);

            if (error || resetSubjectsError || deleteSessionsError) {
                throw error || resetSubjectsError || deleteSessionsError;
            }

            setCycle(data);
            setSubjects((prev) =>
                prev.map((s) => ({ ...s, minutos_feitos: 0, status: "estudar" }))
            );
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

        setSubjects((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));

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
       AÇÕES - AGORA (Modelo Ciclo)
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
            if (!currentSubject?.id) return alert("Cadastre matérias no Setup.");

            const blocoMin = cycle?.bloco_minutos_default || 25;
            const passouMin = Math.max(0, Math.round(blocoMin - remainingSec / 60));
            const minutosParaSomar = passouMin > 0 ? passouMin : blocoMin;

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

            const novoFeito = (currentSubject.minutos_feitos || 0) + minutosParaSomar;
            await atualizarMateria(currentSubject.id, { minutos_feitos: novoFeito });

            const nextIndex =
                subjects.length > 0 ? (cycle.current_index + 1) % subjects.length : 0;
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

            const [
                { data, error },
                { error: resetSubjectsError },
            ] = await Promise.all([
                supabase
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
                    .single(),
                supabase
                    .from("study_cycle_subjects")
                    .update({
                        minutos_feitos: 0,
                        status: "estudar",
                    })
                    .eq("cycle_id", cycle.id)
                    .eq("user_id", user.id),
            ]);

            if (error || resetSubjectsError) {
                throw error || resetSubjectsError;
            }

            setCycle(data);
            setSubjects((prev) =>
                prev.map((s) => ({
                    ...s,
                    minutos_feitos: 0,
                    status: "estudar",
                }))
            );
            setRemainingSec(resetSec);
            setRunning(false);
        } finally {
            setLoading(false);
        }
    };

    /* =========================
       MODELO QUADRO
    ========================= */
    const dropToStatus = async (status) => {
        const id = dragSubjectIdRef.current;
        dragSubjectIdRef.current = null;
        if (!id) return;

        const target = subjects.find((s) => s.id === id);
        if (!target) return;

        if (target.status === "concluida" && status === "estudar") {
            await atualizarMateria(id, {
                status: "estudar",
                minutos_feitos: 0,
            });
            return;
        }

        if (target.status !== "concluida" && status === "concluida") {
            const meta = Number(target.meta_minutos || 0);
            const novoFeito = meta > 0 ? meta : target.minutos_feitos || 0;

            await atualizarMateria(id, {
                status: "concluida",
                minutos_feitos: novoFeito,
            });
            return;
        }

        await atualizarMateria(id, { status });
    };

    const reiniciarCicloQuadro = async () => {
        try {
            setLoading(true);
            if (!user?.id || !cycle?.id) return;

            for (const s of subjects) {
                await supabase
                    .from("study_cycle_subjects")
                    .update({
                        status: "estudar",
                        minutos_feitos: 0,
                    })
                    .eq("id", s.id)
                    .eq("user_id", user.id);
            }

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
            setSubjects((prev) =>
                prev.map((x) => ({ ...x, status: "estudar", minutos_feitos: 0 }))
            );
            setRemainingSec(resetSec);
            setRunning(false);
        } finally {
            setLoading(false);
        }
    };

    const quadroTotal = subjects.length;
    const quadroConcluidas = useMemo(
        () => subjects.filter((s) => s.status === "concluida").length,
        [subjects]
    );
    const quadroProgresso = useMemo(() => {
        if (quadroTotal <= 0) return 0;
        return Math.round((quadroConcluidas / quadroTotal) * 100);
    }, [quadroConcluidas, quadroTotal]);

    /* =========================
       UI
    ========================= */
    return (
        <div className="w-full">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-600 text-white shadow-sm shadow-cyan-900/20">
                        <Repeat className="h-6 w-6" />
                    </div>

                    <div>
                        <p className="text-2xl font-black text-white leading-tight">
                            Ciclo de estudos
                        </p>
                        <p className="text-sm text-cyan-100">
                            Configure seu ciclo e acompanhe seu progresso
                        </p>
                    </div>
                </div>

                <div className="flex bg-slate-100 dark:bg-slate-800 rounded-xl p-1 border border-slate-200 dark:border-slate-700">
                    <button
                        onClick={() => setAbaInterna("setup")}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${abaInterna === "setup"
                            ? "bg-white dark:bg-slate-900 shadow text-slate-900 dark:text-white"
                            : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                            }`}
                    >
                        Configuração
                    </button>
                    <button
                        onClick={() => setAbaInterna("agora")}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${abaInterna === "agora"
                            ? "bg-white dark:bg-slate-900 shadow text-slate-900 dark:text-white"
                            : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                            }`}
                    >
                        Agora
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6">
                <div className="space-y-6">
                    {abaInterna === "agora" && (
                        <>
                            <div className="rounded-2xl border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 p-4 shadow-sm">
                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                    <div>
                                        <div className="text-sm font-bold text-slate-900 dark:text-white">
                                            Escolha o modelo do “Agora”
                                        </div>
                                        <div className="text-xs text-slate-500 dark:text-slate-400">
                                            Modelo Ciclo com timer e etapas ou Modelo Quadro.
                                        </div>
                                    </div>

                                    <div className="flex bg-slate-100 dark:bg-slate-800 rounded-xl p-1 border border-slate-200 dark:border-slate-700">
                                        <button
                                            onClick={() => setModoAgora("ciclo")}
                                            className={`px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${modoAgora === "ciclo"
                                                ? "bg-white dark:bg-slate-900 shadow text-slate-900 dark:text-white"
                                                : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                                                }`}
                                        >
                                            <ListChecks size={16} />
                                            Modelo Ciclo
                                        </button>
                                        <button
                                            onClick={() => setModoAgora("quadro")}
                                            className={`px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${modoAgora === "quadro"
                                                ? "bg-white dark:bg-slate-900 shadow text-slate-900 dark:text-white"
                                                : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                                                }`}
                                        >
                                            <LayoutGrid size={16} />
                                            Modelo Quadro
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {modoAgora === "ciclo" && (
                                <>
                                    <div className="rounded-2xl border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 p-6 shadow-sm">
                                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                                            <div>
                                                <div className="text-5xl font-black tracking-tight">
                                                    {progressoCiclo}%
                                                </div>
                                                <div className="mt-1 text-slate-600 dark:text-slate-400 text-sm">
                                                    Progresso do ciclo
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

                                    <div className="rounded-2xl border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 p-6 shadow-sm">
                                        <div className="flex flex-col lg:flex-row justify-between gap-6">
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
                                                            {currentSubject?.nome ||
                                                                "Nenhuma matéria cadastrada"}
                                                        </div>
                                                        <div className="text-sm text-slate-600 dark:text-slate-400">
                                                            Peso: {currentSubject?.peso ?? "-"} • Meta:{" "}
                                                            {formatHM(currentSubject?.meta_minutos ?? 0)}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 py-3">
                                                        <div className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
                                                            Feito agora
                                                        </div>
                                                        <div className="text-lg font-black text-slate-900 dark:text-white">
                                                            {formatHMS(running ? feitoAgoraSec : 0)}
                                                        </div>
                                                    </div>

                                                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 py-3">
                                                        <div className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
                                                            Total feito na matéria
                                                        </div>
                                                        <div className="text-lg font-black text-slate-900 dark:text-white">
                                                            {formatHMS(totalFeitoAtualComRodandoSec)}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                                                    O ciclo salva automaticamente onde você parou.
                                                </div>
                                            </div>

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
                                                    const isCurrent =
                                                        idx === (cycle?.current_index ?? 0);
                                                    const perc = s.meta_minutos
                                                        ? Math.min(
                                                            100,
                                                            Math.round(
                                                                ((s.minutos_feitos || 0) /
                                                                    s.meta_minutos) *
                                                                100
                                                            )
                                                        )
                                                        : 0;

                                                    const falta = Math.max(
                                                        0,
                                                        (s.meta_minutos || 0) -
                                                        (s.minutos_feitos || 0)
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

                                        <div className="mt-6 flex items-center justify-between">
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
                            )}

                            {modoAgora === "quadro" && (
                                <>
                                    <div className="rounded-2xl border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 p-6 shadow-sm">
                                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                                            <div>
                                                <div className="text-5xl font-black tracking-tight">
                                                    {quadroProgresso}%
                                                </div>
                                                <div className="mt-1 text-slate-600 dark:text-slate-400 text-sm">
                                                    Progresso do quadro
                                                </div>
                                            </div>

                                            <div className="text-right">
                                                <div className="text-emerald-500 font-bold text-xl">
                                                    Concluídas: {quadroConcluidas}/{quadroTotal}
                                                </div>
                                                <div className="text-slate-500 dark:text-slate-400 text-sm italic">
                                                    Ciclos concluídos: <b>{cycle?.cycles_completed ?? 0}</b>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="mt-4 w-full h-3 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                                            <div
                                                className="h-full bg-emerald-500 transition-all"
                                                style={{ width: `${quadroProgresso}%` }}
                                            />
                                        </div>
                                    </div>

                                    <div className="rounded-2xl border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 p-6 shadow-sm">
                                        <div className="flex items-center gap-2 mb-4">
                                            <BarChart3 size={18} className="text-cyan-500" />
                                            <h3 className="text-lg font-bold">
                                                Quadro (arrastar para concluir)
                                            </h3>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div
                                                onDragOver={(e) => e.preventDefault()}
                                                onDrop={() => dropToStatus("estudar")}
                                                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4 min-h-[220px]"
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
                                                                onDragStart={() =>
                                                                    (dragSubjectIdRef.current = s.id)
                                                                }
                                                                className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 shadow-sm cursor-grab active:cursor-grabbing"
                                                            >
                                                                <div className="font-semibold">
                                                                    {s.nome}
                                                                </div>
                                                                <div className="text-xs text-slate-500 dark:text-slate-400">
                                                                    Peso: {s.peso} • Meta:{" "}
                                                                    {formatHM(s.meta_minutos || 0)}
                                                                </div>
                                                                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                                                                    Feito:{" "}
                                                                    {formatHMS(
                                                                        (s.minutos_feitos || 0) * 60
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ))}
                                                </div>
                                            </div>

                                            <div
                                                onDragOver={(e) => e.preventDefault()}
                                                onDrop={() => dropToStatus("concluida")}
                                                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-emerald-500/5 p-4 min-h-[220px]"
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
                                                                onDragStart={() =>
                                                                    (dragSubjectIdRef.current = s.id)
                                                                }
                                                                className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 shadow-sm cursor-grab active:cursor-grabbing"
                                                            >
                                                                <div className="font-semibold">
                                                                    {s.nome}
                                                                </div>
                                                                <div className="text-xs text-slate-500 dark:text-slate-400">
                                                                    Feito:{" "}
                                                                    {formatHMS(
                                                                        (s.minutos_feitos || 0) * 60
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ))}
                                                </div>
                                            </div>
                                        </div>

                                        {subjects.length > 0 &&
                                            subjects.every((s) => s.status === "concluida") && (
                                                <div className="mt-4 flex justify-end">
                                                    <button
                                                        onClick={reiniciarCicloQuadro}
                                                        className="rounded-xl px-5 py-3 font-bold bg-indigo-600 hover:bg-indigo-700 text-white"
                                                    >
                                                        Reiniciar ciclo (voltar disciplinas para Estudar)
                                                    </button>
                                                </div>
                                            )}

                                        <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
                                            Arraste uma matéria para <b>Concluídas</b> para marcar.
                                            Se voltar para <b>Estudar</b>, o progresso é desfeito.
                                        </p>
                                    </div>
                                </>
                            )}
                        </>
                    )}

                    {abaInterna === "setup" && (
                        <>
                            <div className="rounded-2xl border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 p-6 shadow-sm">
                                <div className="text-lg font-bold mb-4">
                                    Configuração do Ciclo
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

                                    <div className="md:col-span-2">
                                        <div className="flex items-center justify-between mb-2">
                                            <label className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                                                Meta total do ciclo
                                            </label>

                                            <span className="text-[11px] px-2 py-1 rounded-full border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-950/40 text-slate-500 dark:text-slate-400">
                                                {String(metaHoras).padStart(2, "0")}:
                                                {String(metaMin).padStart(2, "0")}:
                                                {String(metaSeg).padStart(2, "0")}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <div className="flex-1">
                                                <div className="text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                                                    Horas
                                                </div>
                                                <select
                                                    value={metaHoras}
                                                    onChange={(e) =>
                                                        setMetaHoras(Number(e.target.value))
                                                    }
                                                    className="w-full h-10 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 text-sm outline-none focus:ring-2 focus:ring-cyan-500"
                                                >
                                                    {Array.from({ length: 13 }).map((_, i) => (
                                                        <option key={i} value={i}>
                                                            {i}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>

                                            <div className="flex-1">
                                                <div className="text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                                                    Min
                                                </div>
                                                <select
                                                    value={metaMin}
                                                    onChange={(e) =>
                                                        setMetaMin(Number(e.target.value))
                                                    }
                                                    className="w-full h-10 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 text-sm outline-none focus:ring-2 focus:ring-cyan-500"
                                                >
                                                    {Array.from({ length: 60 }).map((_, i) => (
                                                        <option key={i} value={i}>
                                                            {i}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>

                                            <div className="flex-1">
                                                <div className="text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                                                    Seg
                                                </div>
                                                <select
                                                    value={metaSeg}
                                                    onChange={(e) =>
                                                        setMetaSeg(Number(e.target.value))
                                                    }
                                                    className="w-full h-10 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 text-sm outline-none focus:ring-2 focus:ring-cyan-500"
                                                >
                                                    {Array.from({ length: 60 }).map((_, i) => (
                                                        <option key={i} value={i}>
                                                            {i}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>

                                        <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                                            Use horas para metas maiores.
                                        </div>
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

                                <div className="mt-4 flex items-center justify-between flex-col sm:flex-row gap-3">
                                    <div className="text-xs text-slate-500 dark:text-slate-400">
                                        Ciclos concluídos atualmente:{" "}
                                        <b className="text-slate-900 dark:text-white">
                                            {cycle?.cycles_completed ?? 0}
                                        </b>
                                    </div>

                                    <button
                                        onClick={zerarCiclosFeitos}
                                        className="rounded-xl px-4 py-2 font-bold bg-rose-600 hover:bg-rose-700 text-white"
                                    >
                                        Zerar ciclos feitos
                                    </button>
                                </div>
                            </div>

                            <div className="rounded-2xl border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 p-6 shadow-sm">
                                <div className="flex items-center justify-between gap-3 mb-4">
                                    <div className="text-lg font-bold">Matérias</div>
                                    <div className="text-sm text-slate-500 dark:text-slate-400">
                                        Total de metas: <b>{formatHM(totalMetaMaterias)}</b>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                    <div className="md:col-span-2">
                                        <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                                            Nome da matéria
                                        </div>
                                        <input
                                            value={nomeMateria}
                                            onChange={(e) => setNomeMateria(e.target.value)}
                                            placeholder="Ex: Auditoria"
                                            className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-4 py-3 outline-none focus:ring-2 focus:ring-cyan-500"
                                        />
                                    </div>

                                    <div>
                                        <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                                            Peso
                                        </div>
                                        <input
                                            type="number"
                                            value={pesoMateria}
                                            onChange={(e) => setPesoMateria(e.target.value)}
                                            placeholder="1"
                                            className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-4 py-3 outline-none focus:ring-2 focus:ring-cyan-500"
                                        />
                                    </div>

                                    <div>
                                        <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                                            Meta (min)
                                        </div>
                                        <input
                                            type="number"
                                            value={metaMateria}
                                            onChange={(e) => setMetaMateria(e.target.value)}
                                            placeholder="60"
                                            className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-4 py-3 outline-none focus:ring-2 focus:ring-cyan-500"
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

                                <div className="mt-6">
                                    <div className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-3">
                                        Ordem de execução
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
                                                                Peso: {s.peso} • Meta:{" "}
                                                                {formatHM(s.meta_minutos || 0)} • Status:{" "}
                                                                <b>{s.status}</b>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex flex-col sm:flex-row gap-2">
                                                        <button
                                                            onClick={() =>
                                                                atualizarMateria(s.id, {
                                                                    status:
                                                                        s.status === "concluida"
                                                                            ? "estudar"
                                                                            : "concluida",
                                                                    minutos_feitos:
                                                                        s.status === "concluida"
                                                                            ? 0
                                                                            : s.meta_minutos || 0,
                                                                })
                                                            }
                                                            className="rounded-xl px-4 py-2 font-semibold border border-slate-200 dark:border-slate-800 hover:bg-white dark:hover:bg-slate-900"
                                                        >
                                                            Alternar status
                                                        </button>

                                                        <button
                                                            onClick={() =>
                                                                atualizarMateria(s.id, {
                                                                    minutos_feitos: 0,
                                                                })
                                                            }
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
                                        Quando você muda a ordem, o sistema ajusta o ponto onde
                                        parou para continuar na mesma matéria.
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                <aside className="space-y-6">
                    <div className="rounded-2xl border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 p-6 shadow-sm">
                        <div className="flex items-center gap-2 mb-4">
                            <Target size={18} className="text-cyan-500" />
                            <h3 className="text-lg font-bold">Estatísticas</h3>
                        </div>

                        <div className="space-y-3 text-sm">
                            <div className="flex justify-between text-slate-600 dark:text-slate-300">
                                <span>Meta do ciclo</span>
                                <b className="text-slate-900 dark:text-white">
                                    {formatHM(cycle?.meta_minutos_total || 0)}
                                </b>
                            </div>

                            <div className="flex justify-between text-slate-600 dark:text-slate-300">
                                <span>Feito</span>
                                <b className="text-slate-900 dark:text-white">
                                    {formatHM(totalFeitoMaterias)}
                                </b>
                            </div>

                            <div className="flex justify-between text-slate-600 dark:text-slate-300">
                                <span>Falta</span>
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
                                <b className="text-slate-900 dark:text-white">
                                    {subjects.length}
                                </b>
                            </div>

                            <div className="flex justify-between text-slate-600 dark:text-slate-300">
                                <span>Ciclos concluídos</span>
                                <b className="text-slate-900 dark:text-white">
                                    {cycle?.cycles_completed || 0}
                                </b>
                            </div>

                            <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
                                <div className="text-slate-500 dark:text-slate-400 text-xs mb-2">
                                    Matéria atual
                                </div>
                                <div className="font-bold">{currentSubject?.nome || "—"}</div>
                                <div className="text-xs text-slate-500 dark:text-slate-400">
                                    Você volta exatamente daqui.
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-2xl border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 p-6 shadow-sm">
                        <div className="text-sm font-bold mb-3">Ranking de esforço</div>

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
                                                        width: `${Math.min(
                                                            100,
                                                            (s.peso || 0) * 20
                                                        )}%`,
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