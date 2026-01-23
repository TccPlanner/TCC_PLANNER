import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    Play,
    Pause,
    RotateCcw,
    Calendar,
    Bell,
    History,
    Clock3,
    X,
} from "lucide-react";

import { supabase } from "../supabaseClient";

/* ============================
   COMPONENTE MODAL CENTRAL
============================ */
const ModalCentral = ({ open, onClose, title, message, variant = "info", actions }) => {
    if (!open) return null;

    const ring =
        variant === "alarm"
            ? "ring-rose-400/30 dark:ring-rose-500/30"
            : "ring-indigo-400/30 dark:ring-indigo-500/30";

    const badge =
        variant === "alarm"
            ? "bg-rose-500/15 text-rose-600 dark:text-rose-300 border border-rose-500/30"
            : "bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 border border-indigo-500/30";

    const glow =
        variant === "alarm"
            ? "shadow-[0_0_45px_-20px_rgba(244,63,94,0.55)]"
            : "shadow-[0_0_45px_-20px_rgba(99,102,241,0.55)]";

    return (
        <div className="fixed inset-0 z-[999999] bg-black/60 flex items-center justify-center p-4">
            <div className={`w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 ring-2 ${ring} ${glow}`}>
                <div className="flex items-start justify-between gap-4">
                    <div className={`px-3 py-1 rounded-full text-xs font-black ${badge}`}>
                        {variant === "alarm" ? "⏰ ALARME" : "✅ STATUS"}
                    </div>

                    <button
                        onClick={onClose}
                        className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                        aria-label="Fechar"
                    >
                        <X size={18} className="text-slate-500 dark:text-slate-300" />
                    </button>
                </div>

                <h3 className="mt-3 text-2xl font-black text-slate-900 dark:text-white">
                    {title}
                </h3>

                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                    {message}
                </p>

                {actions?.length > 0 && (
                    <div className="mt-6 flex flex-col gap-3">
                        {actions.map((a) => (
                            <button
                                key={a.label}
                                onClick={a.onClick}
                                className={
                                    a.kind === "primary"
                                        ? "w-full py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-sm cursor-pointer active:scale-[0.99] transition-all"
                                        : a.kind === "danger"
                                            ? "w-full py-3 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-black text-sm cursor-pointer active:scale-[0.99] transition-all"
                                            : "w-full py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-black text-sm cursor-pointer active:scale-[0.99] transition-all"
                                }
                            >
                                {a.label}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

/* ============================
   MODAL DETALHES ATIVIDADE
============================ */
const ModalAtividade = ({ open, onClose, atividade, formatarTempo }) => {
    if (!open || !atividade) return null;

    const inicio = new Date(atividade.inicio_em);
    const fim = new Date(inicio.getTime() + (atividade.duracao_segundos || 0) * 1000);

    return (
        <div className="fixed inset-0 z-[999999] bg-black/60 flex items-center justify-center p-4">
            <div className="w-full max-w-2xl rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <p className="text-xs font-black text-slate-500 dark:text-slate-300">
                            Resumo da atividade
                        </p>
                        <h3 className="text-2xl font-black text-slate-900 dark:text-white">
                            {atividade.materia}
                        </h3>
                    </div>

                    <button
                        onClick={onClose}
                        className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    >
                        <X size={18} className="text-slate-500 dark:text-slate-300" />
                    </button>
                </div>

                <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 p-4">
                        <p className="text-xs font-black text-slate-500 dark:text-slate-300">
                            Conteúdo
                        </p>
                        <p className="mt-1 font-bold text-slate-900 dark:text-white">
                            {atividade.conteudo || "—"}
                        </p>
                    </div>

                    <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 p-4">
                        <p className="text-xs font-black text-slate-500 dark:text-slate-300">
                            Tipo de estudo
                        </p>
                        <p className="mt-1 font-bold text-slate-900 dark:text-white">
                            {atividade.tipo_estudo}
                        </p>
                    </div>

                    <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 p-4">
                        <p className="text-xs font-black text-slate-500 dark:text-slate-300">
                            Início
                        </p>
                        <p className="mt-1 font-bold text-slate-900 dark:text-white">
                            {inicio.toLocaleString()}
                        </p>
                    </div>

                    <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 p-4">
                        <p className="text-xs font-black text-slate-500 dark:text-slate-300">
                            Fim
                        </p>
                        <p className="mt-1 font-bold text-slate-900 dark:text-white">
                            {fim.toLocaleString()}
                        </p>
                    </div>

                    <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 p-4 md:col-span-2">
                        <p className="text-xs font-black text-slate-500 dark:text-slate-300">
                            Duração
                        </p>
                        <p className="mt-1 font-black font-mono text-indigo-600 dark:text-indigo-400 text-xl">
                            {formatarTempo(atividade.duracao_segundos || 0)}
                        </p>
                    </div>

                    {(atividade.tipo_estudo === "Exercícios" || atividade.tipo_estudo === "Simulado") && (
                        <div className="rounded-2xl bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 p-4 md:col-span-2">
                            <p className="text-xs font-black text-slate-700 dark:text-slate-200 mb-2">
                                Questões
                            </p>
                            <div className="grid grid-cols-3 gap-3">
                                <div className="rounded-xl bg-white/70 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 text-center">
                                    <p className="text-[11px] text-slate-500 dark:text-slate-300 font-black">Feitas</p>
                                    <p className="font-black text-slate-900 dark:text-white">{atividade.questoes_feitas || 0}</p>
                                </div>
                                <div className="rounded-xl bg-white/70 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 text-center">
                                    <p className="text-[11px] text-slate-500 dark:text-slate-300 font-black">Acertos</p>
                                    <p className="font-black text-emerald-600">{atividade.questoes_acertos || 0}</p>
                                </div>
                                <div className="rounded-xl bg-white/70 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 text-center">
                                    <p className="text-[11px] text-slate-500 dark:text-slate-300 font-black">Erros</p>
                                    <p className="font-black text-rose-500">{atividade.questoes_erros || 0}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 p-4 md:col-span-2">
                        <p className="text-xs font-black text-slate-500 dark:text-slate-300">
                            Anotações
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white whitespace-pre-wrap">
                            {atividade.anotacao?.trim() ? atividade.anotacao : "—"}
                        </p>
                    </div>
                </div>

                <div className="mt-6 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-5 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-black cursor-pointer"
                    >
                        Fechar
                    </button>
                </div>
            </div>
        </div>
    );
};

/* ============================
   COMPONENTE PRINCIPAL
============================ */
const EstudarAgora = ({ user }) => {
    const [abaAtiva, setAbaAtiva] = useState("cronometro"); // manual | cronometro
    const [loading, setLoading] = useState(false);

    // Inputs gerais
    const [materia, setMateria] = useState("");
    const [conteudo, setConteudo] = useState("");
    const [tipoEstudo, setTipoEstudo] = useState("Teoria");
    const [anotacao, setAnotacao] = useState("");
    const [verMaisAtividades, setVerMaisAtividades] = useState(false);

    // Revisões
    const [agendarRevisao, setAgendarRevisao] = useState(false);
    const revisoesPreset = useMemo(
        () => [
            { label: "1 dia", days: 1 },
            { label: "3 dias", days: 3 },
            { label: "7 dias", days: 7 },
            { label: "15 dias", days: 15 },
            { label: "30 dias", days: 30 },
        ],
        []
    );
    const [revisoesSelecionadas, setRevisoesSelecionadas] = useState([1]);

    // Questões
    const [questoes, setQuestoes] = useState({ feitas: 0, acertos: 0, erros: 0 });

    // Manual
    const hojeISO = useMemo(() => new Date().toISOString().split("T")[0], []);
    const agoraHHMM = useMemo(() => {
        const d = new Date();
        return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }, []);

    const [dataInicio, setDataInicio] = useState(hojeISO);
    const [horaInicio, setHoraInicio] = useState(agoraHHMM);

    // Modal duração manual
    const [duracaoModalAberto, setDuracaoModalAberto] = useState(false);
    const [duracaoManual, setDuracaoManual] = useState({ h: 0, m: 0, s: 0 });

    // Cronômetro
    const [segundos, setSegundos] = useState(0);
    const [ativo, setAtivo] = useState(false);
    const [inicioCronometroEm, setInicioCronometroEm] = useState(null);

    // Alarmes (configs)
    const [alarmeTipo, setAlarmeTipo] = useState("nenhum"); // nenhum | duracao | horario
    const [alarmeDuracaoMin, setAlarmeDuracaoMin] = useState("30");
    const [alarmeHorario, setAlarmeHorario] = useState(agoraHHMM);

    // ✅ Alarmes ativos (com countdown)
    const [alarmesAtivos, setAlarmesAtivos] = useState([]);
    const alarmesTimeoutsRef = useRef(new Map());

    // ✅ Alarmes concluídos (para usar o tempo ao salvar)
    const [alarmesConcluidos, setAlarmesConcluidos] = useState([]);

    // Últimas atividades
    const [ultimasAtividades, setUltimasAtividades] = useState([]);

    // Modal detalhes atividade
    const [atividadeSelecionada, setAtividadeSelecionada] = useState(null);
    const [modalAtividadeOpen, setModalAtividadeOpen] = useState(false);

    // Modal Central
    const [modalCentral, setModalCentral] = useState({
        open: false,
        title: "",
        message: "",
        variant: "info", // info | alarm
        actions: [],
    });

    // Toast (opcional, ainda útil)
    const [toast, setToast] = useState({ show: false, title: "", message: "" });
    const toastTimer = useRef(null);

    const showToast = (title, message) => {
        clearTimeout(toastTimer.current);
        setToast({ show: true, title, message });
        toastTimer.current = setTimeout(() => {
            setToast({ show: false, title: "", message: "" });
        }, 4500);
    };

    /* ========= NOTIFICAÇÕES ========= */
    const suporteNotificacao =
        typeof window !== "undefined" && "Notification" in window;

    const pedirPermissaoNotificacao = async () => {
        if (!suporteNotificacao) return false;

        if (Notification.permission === "granted") return true;
        if (Notification.permission === "denied") return false;

        const perm = await Notification.requestPermission();
        return perm === "granted";
    };

    // ✅ Som beep (não precisa arquivo)
    const playBeep = () => {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            const ctx = new AudioContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = "sine";
            osc.frequency.value = 880;
            gain.gain.value = 0.12;

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start();
            setTimeout(() => {
                osc.stop();
                ctx.close();
            }, 1100);
        } catch (e) { }
    };

    const vibrar = () => {
        try {
            if ("vibrate" in navigator) navigator.vibrate([250, 120, 250, 120, 350]);
        } catch (e) { }
    };

    const dispararNotificacao = () => {
        if (suporteNotificacao && Notification.permission === "granted") {
            const n = new Notification("⏰ Alarme!", {
                body: `Sessão: ${materia || "Estudo"} • ${conteudo || "Sem conteúdo"}`,
                silent: false,
            });

            n.onclick = () => {
                window.focus();
                n.close();
            };
        }
    };

    /* ========= HELPERS ========= */
    const formatarTempo = (s) => {
        const total = Math.max(0, Number(s || 0));
        const h = Math.floor(total / 3600);
        const m = Math.floor((total % 3600) / 60);
        const seg = total % 60;
        return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${seg
            .toString()
            .padStart(2, "0")}`;
    };

    const calcularRemainingSeg = (fireAt) => Math.max(0, Math.ceil((fireAt - Date.now()) / 1000));

    const msAteHorario = (hhmm) => {
        const [hh, mm] = String(hhmm || "00:00").split(":").map(Number);
        if (Number.isNaN(hh) || Number.isNaN(mm)) return 0;

        const agora = new Date();
        const alvo = new Date();
        alvo.setHours(hh, mm, 0, 0);

        if (alvo.getTime() <= agora.getTime()) alvo.setDate(alvo.getDate() + 1);
        return alvo.getTime() - agora.getTime();
    };

    /* ========= ALARME: DISPARO ========= */
    const dispararAlarme = (alarmeData) => {
        playBeep();
        vibrar();
        dispararNotificacao();

        // guarda nos concluídos
        setAlarmesConcluidos((prev) => [
            ...prev,
            {
                id: `done-${Date.now()}`,
                label: alarmeData?.label || "Alarme concluído",
                duracaoSegundos: alarmeData?.duracaoSegundos || 0,
                firedAt: Date.now(),
            },
        ]);

        // ✅ Modal central chamativo
        setModalCentral({
            open: true,
            variant: "alarm",
            title: "⏰ Hora de pausar!",
            message: "Seu alarme disparou. Você pode salvar sua atividade com esse tempo se quiser.",
            actions: [
                {
                    label: "Salvar atividade com este tempo",
                    kind: "danger",
                    onClick: async () => {
                        // força salvar usando o tempo do alarme (se for duração)
                        const dur = alarmeData?.duracaoSegundos ?? 0;
                        await salvarSessao({ forceDuration: dur });
                        setModalCentral((m) => ({ ...m, open: false }));
                    },
                },
                { label: "Fechar", kind: "secondary", onClick: () => setModalCentral((m) => ({ ...m, open: false })) },
            ],
        });
    };

    /* ========= ALARMES ATIVOS: add/remove ========= */
    const removerAlarmeAtivo = (id) => {
        setAlarmesAtivos((prev) => prev.filter((a) => a.id !== id));
        const timeout = alarmesTimeoutsRef.current.get(id);
        if (timeout) {
            clearTimeout(timeout);
            alarmesTimeoutsRef.current.delete(id);
        }
    };

    const cancelarAlarmeAtivo = (id) => {
        removerAlarmeAtivo(id);
        showToast("⛔ Alarme cancelado", "O alarme foi removido.");
    };

    const criarAlarmeAtivo = async () => {
        if (alarmeTipo === "nenhum") {
            showToast("Selecione um tipo", "Escolha 'Por duração' ou 'Por horário'.");
            return;
        }

        // ✅ pede permissão se suportar
        await pedirPermissaoNotificacao();

        if (alarmeTipo === "duracao") {
            if (!ativo) {
                showToast("Inicie o cronômetro", "O alarme por duração funciona com o cronômetro rodando.");
                return;
            }

            const alvoSeg = Number(alarmeDuracaoMin || 0) * 60;
            const restante = alvoSeg - segundos;
            if (restante <= 0) {
                showToast("Tempo inválido", "A duração escolhida já foi atingida.");
                return;
            }

            const id = `dur-${Date.now()}`;
            const fireAt = Date.now() + restante * 1000;

            const alarmeData = {
                id,
                tipo: "duracao",
                label: `Duração • ${alarmeDuracaoMin} min`,
                fireAt,
                remaining: restante,
                duracaoSegundos: alvoSeg, // duração total configurada
            };

            setAlarmesAtivos((prev) => [...prev, alarmeData]);

            const t = setTimeout(() => {
                dispararAlarme(alarmeData);
                removerAlarmeAtivo(id);
            }, restante * 1000);

            alarmesTimeoutsRef.current.set(id, t);

            showToast("✅ Alarme ativado", `Vai disparar em ${Math.ceil(restante / 60)} min.`);
            return;
        }

        if (alarmeTipo === "horario") {
            const ms = msAteHorario(alarmeHorario);
            if (ms <= 0) {
                showToast("Horário inválido", "Não consegui calcular o horário do alarme.");
                return;
            }

            const id = `hr-${Date.now()}`;
            const fireAt = Date.now() + ms;

            const alarmeData = {
                id,
                tipo: "horario",
                label: `Horário • ${alarmeHorario}`,
                fireAt,
                remaining: Math.ceil(ms / 1000),
                duracaoSegundos: 0,
            };

            setAlarmesAtivos((prev) => [...prev, alarmeData]);

            const t = setTimeout(() => {
                dispararAlarme(alarmeData);
                removerAlarmeAtivo(id);
            }, ms);

            alarmesTimeoutsRef.current.set(id, t);

            showToast("✅ Alarme ativado", `Vai disparar às ${alarmeHorario}.`);
        }
    };

    // ✅ Atualiza countdown
    useEffect(() => {
        if (alarmesAtivos.length === 0) return;

        const interval = setInterval(() => {
            setAlarmesAtivos((prev) =>
                prev.map((a) => ({
                    ...a,
                    remaining: calcularRemainingSeg(a.fireAt),
                }))
            );
        }, 1000);

        return () => clearInterval(interval);
    }, [alarmesAtivos.length]);

    /* ========= CRONÔMETRO ========= */
    useEffect(() => {
        let intervalo = null;
        if (ativo) intervalo = setInterval(() => setSegundos((s) => s + 1), 1000);
        return () => clearInterval(intervalo);
    }, [ativo]);

    const iniciarOuPausar = () => {
        if (!ativo && segundos === 0) setInicioCronometroEm(new Date().toISOString());
        setAtivo((v) => !v);
    };

    const resetarCronometro = () => {
        setSegundos(0);
        setAtivo(false);
        setInicioCronometroEm(null);
    };

    /* ========= QUESTÕES: validação ========= */
    const setFeitas = (val) => {
        const feitas = Math.max(0, Number(val || 0));
        let acertos = Number(questoes.acertos || 0);
        let erros = Number(questoes.erros || 0);

        if (acertos > feitas) acertos = feitas;
        if (erros > feitas) erros = feitas;
        if (acertos + erros > feitas) erros = Math.max(0, feitas - acertos);

        setQuestoes({ feitas, acertos, erros });
    };

    const setAcertos = (val) => {
        const acertos = Math.max(0, Number(val || 0));
        const feitas = Number(questoes.feitas || 0);
        let erros = Number(questoes.erros || 0);

        const acertosClamped = Math.min(acertos, feitas);
        if (acertosClamped + erros > feitas) erros = Math.max(0, feitas - acertosClamped);

        setQuestoes({ ...questoes, acertos: acertosClamped, erros });
    };

    const setErros = (val) => {
        const erros = Math.max(0, Number(val || 0));
        const feitas = Number(questoes.feitas || 0);
        let acertos = Number(questoes.acertos || 0);

        const errosClamped = Math.min(erros, feitas);
        if (acertos + errosClamped > feitas) acertos = Math.max(0, feitas - errosClamped);

        setQuestoes({ ...questoes, erros: errosClamped, acertos });
    };

    /* ========= REVISÕES ========= */
    const alternarDiaRevisao = (days) => {
        setRevisoesSelecionadas((atual) => {
            if (atual.includes(days)) {
                const novo = atual.filter((d) => d !== days);
                return novo.length === 0 ? [1] : novo;
            }
            return [...atual, days].sort((a, b) => a - b);
        });
    };

    const criarRevisoes = async (materiaBase) => {
        const inserts = revisoesSelecionadas.map((dias) => {
            const dataRev = new Date();
            dataRev.setDate(dataRev.getDate() + dias);

            return {
                user_id: user.id,
                titulo: `Revisar: ${materiaBase} (+${dias}d)`,
                data_revisao: dataRev.toISOString().split("T")[0],
            };
        });

        const { error } = await supabase.from("revisoes_agendadas").insert(inserts);
        if (error) showToast("Erro ao agendar", error.message);
    };

    /* ========= SUPABASE: últimas atividades ========= */
    const buscarUltimasAtividades = async () => {
        const { data, error } = await supabase
            .from("sessoes_estudo")
            .select("*")
            .eq("user_id", user.id)
            .order("inicio_em", { ascending: false })
            .limit(50);

        if (!error && data) setUltimasAtividades(data);
    };

    useEffect(() => {
        buscarUltimasAtividades();
        // eslint-disable-next-line
    }, []);

    /* ========= SALVAR SESSÃO ========= */
    const duracaoManualEmSegundos = () => {
        const h = Number(duracaoManual.h || 0);
        const m = Number(duracaoManual.m || 0);
        const s = Number(duracaoManual.s || 0);
        return h * 3600 + m * 60 + s;
    };

    // ✅ permite forçar duração via alarme concluído
    const salvarSessao = async ({ forceDuration } = {}) => {
        if (!materia.trim()) {
            setModalCentral({
                open: true,
                variant: "info",
                title: "Faltou matéria",
                message: "Defina uma matéria antes de salvar.",
                actions: [{ label: "Entendi", kind: "primary", onClick: () => setModalCentral((m) => ({ ...m, open: false })) }],
            });
            return;
        }

        // validação de questões
        if (tipoEstudo === "Exercícios" || tipoEstudo === "Simulado") {
            const feitas = Number(questoes.feitas || 0);
            const acertos = Number(questoes.acertos || 0);
            const erros = Number(questoes.erros || 0);

            if (acertos > feitas || erros > feitas || acertos + erros > feitas) {
                setModalCentral({
                    open: true,
                    variant: "info",
                    title: "Números inconsistentes",
                    message: "Acertos/Erros não podem ultrapassar Questões feitas.",
                    actions: [{ label: "Ok", kind: "primary", onClick: () => setModalCentral((m) => ({ ...m, open: false })) }],
                });
                return;
            }
        }

        setLoading(true);

        try {
            let inicio_em_iso = null;
            let duracao_segundos = 0;
            const modo = abaAtiva;

            if (abaAtiva === "manual") {
                const inicioLocal = new Date(`${dataInicio}T${horaInicio}:00`);
                inicio_em_iso = inicioLocal.toISOString();
                duracao_segundos = duracaoManualEmSegundos();
            } else {
                inicio_em_iso = inicioCronometroEm ?? new Date().toISOString();
                duracao_segundos = Math.max(0, Number(segundos || 0));
            }

            // ✅ se veio de alarme concluído, força a duração
            if (typeof forceDuration === "number" && forceDuration > 0) {
                duracao_segundos = forceDuration;
            }

            const payload = {
                user_id: user.id,
                materia: materia.trim(),
                conteudo: conteudo.trim(),
                tipo_estudo: tipoEstudo,
                inicio_em: inicio_em_iso,
                duracao_segundos,
                modo,
                anotacao: anotacao.trim(),

                questoes_feitas:
                    tipoEstudo === "Exercícios" || tipoEstudo === "Simulado"
                        ? Number(questoes.feitas || 0)
                        : 0,
                questoes_acertos:
                    tipoEstudo === "Exercícios" || tipoEstudo === "Simulado"
                        ? Number(questoes.acertos || 0)
                        : 0,
                questoes_erros:
                    tipoEstudo === "Exercícios" || tipoEstudo === "Simulado"
                        ? Number(questoes.erros || 0)
                        : 0,

                alarme_tipo: alarmeTipo,
                alarme_valor:
                    alarmeTipo === "duracao"
                        ? String(alarmeDuracaoMin)
                        : alarmeTipo === "horario"
                            ? String(alarmeHorario)
                            : null,
            };

            const { error } = await supabase.from("sessoes_estudo").insert([payload]);

            if (error) {
                setModalCentral({
                    open: true,
                    variant: "info",
                    title: "Erro ao salvar",
                    message: error.message,
                    actions: [{ label: "Ok", kind: "primary", onClick: () => setModalCentral((m) => ({ ...m, open: false })) }],
                });
                return;
            }

            if (agendarRevisao) await criarRevisoes(materia.trim());

            // ✅ limpa alarmes concluídos após registrar
            setAlarmesConcluidos([]);

            // ✅ modal central de “salvo”
            setModalCentral({
                open: true,
                variant: "info",
                title: "✅ Atividade registrada!",
                message: `Salvo com duração ${formatarTempo(duracao_segundos)}.`,
                actions: [{ label: "Fechar", kind: "primary", onClick: () => setModalCentral((m) => ({ ...m, open: false })) }],
            });

            // reset inputs
            setMateria("");
            setConteudo("");
            setAnotacao("");
            setAgendarRevisao(false);
            setRevisoesSelecionadas([1]);
            setQuestoes({ feitas: 0, acertos: 0, erros: 0 });

            if (abaAtiva === "cronometro") resetarCronometro();
            if (abaAtiva === "manual") setDuracaoManual({ h: 0, m: 0, s: 0 });

            await buscarUltimasAtividades();
        } finally {
            setLoading(false);
        }
    };

    /* ========= UI: duração manual texto ========= */
    const DuracaoTexto = useMemo(() => {
        const hh = String(duracaoManual.h).padStart(2, "0");
        const mm = String(duracaoManual.m).padStart(2, "0");
        const ss = String(duracaoManual.s).padStart(2, "0");
        return `${hh}:${mm}:${ss}`;
    }, [duracaoManual]);

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            {/* ✅ MODAL CENTRAL (ALARME/SALVO) */}
            <ModalCentral
                open={modalCentral.open}
                onClose={() => setModalCentral((m) => ({ ...m, open: false }))}
                title={modalCentral.title}
                message={modalCentral.message}
                variant={modalCentral.variant}
                actions={modalCentral.actions}
            />

            {/* ✅ MODAL DETALHES ATIVIDADE */}
            <ModalAtividade
                open={modalAtividadeOpen}
                onClose={() => setModalAtividadeOpen(false)}
                atividade={atividadeSelecionada}
                formatarTempo={formatarTempo}
            />

            {/* ✅ TOAST opcional */}
            {toast.show && (
                <div className="fixed top-6 right-6 z-[99999] w-[320px] rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl p-4">
                    <p className="font-black text-slate-900 dark:text-white">{toast.title}</p>
                    <p className="text-sm mt-1 text-slate-600 dark:text-slate-300">{toast.message}</p>
                    <button
                        onClick={() => setToast({ show: false, title: "", message: "" })}
                        className="mt-3 text-xs font-black text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                    >
                        Fechar
                    </button>
                </div>
            )}

            {/* Tabs */}
            <div className="flex bg-slate-200 dark:bg-slate-800 p-1 rounded-2xl shadow-inner">
                <button
                    onClick={() => setAbaAtiva("manual")}
                    className={`flex-1 py-3 rounded-xl font-bold transition-all cursor-pointer
            ${abaAtiva === "manual"
                            ? "bg-indigo-600 text-white shadow-md"
                            : "text-slate-600 dark:text-slate-200"
                        }`}
                >
                    Manual
                </button>

                <button
                    onClick={() => setAbaAtiva("cronometro")}
                    className={`flex-1 py-3 rounded-xl font-bold transition-all cursor-pointer
            ${abaAtiva === "cronometro"
                            ? "bg-indigo-600 text-white shadow-md"
                            : "text-slate-600 dark:text-slate-200"
                        }`}
                >
                    Cronômetro
                </button>
            </div>

            {/* Card */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-6 shadow-xl">
                {/* Inputs Base */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input
                        type="text"
                        placeholder="Matéria"
                        value={materia}
                        onChange={(e) => setMateria(e.target.value)}
                        className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl outline-none border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                    />

                    <input
                        type="text"
                        placeholder="Conteúdo"
                        value={conteudo}
                        onChange={(e) => setConteudo(e.target.value)}
                        className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl outline-none border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                    />

                    <select
                        value={tipoEstudo}
                        onChange={(e) => setTipoEstudo(e.target.value)}
                        className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl outline-none border border-slate-200 dark:border-slate-700 md:col-span-2 text-slate-900 dark:text-slate-100 font-black cursor-pointer"
                    >
                        <option value="Teoria">📖 Teoria</option>
                        <option value="Exercícios">📝 Exercícios</option>
                        <option value="Revisão">🔁 Revisão</option>
                        <option value="Simulado">📊 Simulado</option>
                    </select>
                </div>

                {/* Últimas atividades */}
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 p-4">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2 text-sm font-black text-slate-700 dark:text-slate-200">
                            <History size={16} />
                            Últimas atividades
                        </div>

                        {ultimasAtividades.length > 2 && (
                            <button
                                onClick={() => setVerMaisAtividades((v) => !v)}
                                className="text-xs font-black text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                            >
                                {verMaisAtividades ? "Ver menos" : "Ver mais"}
                            </button>
                        )}
                    </div>

                    {ultimasAtividades.length === 0 ? (
                        <p className="text-sm text-slate-600 dark:text-slate-300">
                            Nenhuma atividade registrada ainda.
                        </p>
                    ) : (
                        <div className={`space-y-2 ${verMaisAtividades ? "max-h-56 overflow-y-auto pr-1 custom-scroll" : ""}`}>
                            {(verMaisAtividades ? ultimasAtividades : ultimasAtividades.slice(0, 2)).map((a) => (
                                <button
                                    key={a.id}
                                    onClick={() => {
                                        setAtividadeSelecionada(a);
                                        setModalAtividadeOpen(true);
                                    }}
                                    className="w-full text-left flex items-center justify-between text-sm p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:scale-[1.01] transition cursor-pointer"
                                >
                                    <div className="flex flex-col">
                                        <span className="font-bold text-slate-900 dark:text-white">{a.materia}</span>
                                        <span className="text-xs text-slate-600 dark:text-slate-300">
                                            {a.tipo_estudo} • {new Date(a.inicio_em).toLocaleString()}
                                        </span>
                                        {(a.tipo_estudo === "Exercícios" || a.tipo_estudo === "Simulado") && (
                                            <span className="text-[11px] mt-1 text-slate-500 dark:text-slate-300">
                                                Q: {a.questoes_feitas || 0} • ✅ {a.questoes_acertos || 0} • ❌ {a.questoes_erros || 0}
                                            </span>
                                        )}
                                    </div>

                                    <span className="font-mono font-black text-slate-800 dark:text-slate-100">
                                        {formatarTempo(a.duracao_segundos || 0)}
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Manual ou Cronômetro */}
                {abaAtiva === "manual" ? (
                    <div className="grid grid-cols-2 gap-4 border-t border-slate-200 dark:border-slate-800 pt-4">
                        <div className="space-y-1">
                            <p className="text-xs font-black text-slate-500 dark:text-slate-300 flex items-center gap-2">
                                <Calendar size={16} className="text-indigo-600 dark:text-indigo-400" />
                                Data de início
                            </p>

                            <input
                                type="date"
                                value={dataInicio}
                                onChange={(e) => setDataInicio(e.target.value)}
                                className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl outline-none border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
                            />
                        </div>

                        <div className="space-y-1">
                            <p className="text-xs font-black text-slate-500 dark:text-slate-300 flex items-center gap-2">
                                <Clock3 size={16} className="text-indigo-600 dark:text-indigo-400" />
                                Hora de início
                            </p>

                            <input
                                type="time"
                                value={horaInicio}
                                onChange={(e) => setHoraInicio(e.target.value)}
                                className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl outline-none border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
                            />
                        </div>

                        <div className="col-span-2">
                            <p className="text-xs font-black text-slate-500 dark:text-slate-300 mb-2">
                                Duração
                            </p>

                            <button
                                onClick={() => setDuracaoModalAberto(true)}
                                className="w-full p-4 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 flex items-center justify-between font-black cursor-pointer"
                            >
                                <span className="text-lg font-mono">{DuracaoTexto}</span>
                                <span className="text-indigo-600 dark:text-indigo-400 text-sm font-black">
                                    Alterar
                                </span>
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="text-center space-y-6 border-t border-slate-200 dark:border-slate-800 pt-4">
                        <div className="text-6xl font-mono font-black tracking-tighter tabular-nums text-indigo-600 dark:text-indigo-400">
                            {formatarTempo(segundos)}
                        </div>

                        <div className="flex justify-center gap-4">
                            <button
                                onClick={iniciarOuPausar}
                                className={`p-4 rounded-full text-white cursor-pointer transition-all active:scale-95
                  ${ativo ? "bg-amber-500" : "bg-indigo-600"}`}
                            >
                                {ativo ? <Pause /> : <Play />}
                            </button>

                            <button
                                onClick={resetarCronometro}
                                className="p-4 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer transition-all active:scale-95"
                            >
                                <RotateCcw />
                            </button>
                        </div>

                        {/* ✅ Alarmes */}
                        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-black flex items-center gap-2 text-slate-800 dark:text-slate-100">
                                    <Bell size={14} /> Alarme
                                </span>

                                <select
                                    value={alarmeTipo}
                                    onChange={(e) => setAlarmeTipo(e.target.value)}
                                    className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700
             bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100
             text-sm font-black outline-none cursor-pointer"
                                >

                                    <option value="nenhum" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                                        Nenhum
                                    </option>
                                    <option value="duracao" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                                        Por duração
                                    </option>
                                    <option value="horario" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                                        Por horário
                                    </option>

                                </select>
                            </div>

                            {alarmeTipo === "duracao" && (
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                                        Disparar em:
                                    </span>

                                    <select
                                        value={alarmeDuracaoMin}
                                        onChange={(e) => setAlarmeDuracaoMin(e.target.value)}
                                        className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700
             bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100
             text-sm font-black outline-none cursor-pointer"
                                    >

                                        <option value="15" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">15 min</option>
                                        <option value="30" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">30 min</option>
                                        <option value="45" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">45 min</option>
                                        <option value="60" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">60 min</option>
                                        <option value="90" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">90 min</option>

                                    </select>
                                </div>
                            )}

                            {alarmeTipo === "horario" && (
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold flex items-center gap-2 text-slate-700 dark:text-slate-200">
                                        <Clock3 size={16} className="text-indigo-600 dark:text-indigo-400" />
                                        Disparar às:
                                    </span>

                                    <input
                                        type="time"
                                        value={alarmeHorario}
                                        onChange={(e) => setAlarmeHorario(e.target.value)}
                                        className="bg-transparent text-sm outline-none font-black text-slate-900 dark:text-slate-100 cursor-pointer"
                                    />
                                </div>
                            )}

                            {(alarmeTipo === "duracao" || alarmeTipo === "horario") && (
                                <button
                                    onClick={criarAlarmeAtivo}
                                    className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-sm cursor-pointer"
                                >
                                    Ativar Alarme
                                </button>
                            )}

                            {/* Alarmes ativos */}
                            {alarmesAtivos.length > 0 && (
                                <div className="mt-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 space-y-2">
                                    <p className="text-xs font-black text-slate-700 dark:text-slate-200">
                                        Alarmes ativos
                                    </p>

                                    {alarmesAtivos.map((a) => (
                                        <div
                                            key={a.id}
                                            className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 px-3 py-2"
                                        >
                                            <div className="flex flex-col text-left">
                                                <span className="text-xs font-black text-slate-800 dark:text-slate-100">
                                                    {a.label}
                                                </span>

                                                <span className="text-[11px] font-mono font-black text-indigo-600 dark:text-indigo-400">
                                                    {formatarTempo(a.remaining)}
                                                </span>
                                            </div>

                                            <button
                                                onClick={() => cancelarAlarmeAtivo(a.id)}
                                                className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                                                title="Cancelar alarme"
                                            >
                                                <X size={16} className="text-slate-500 dark:text-slate-300" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Alarmes concluídos */}
                            {alarmesConcluidos.length > 0 && (
                                <div className="mt-3 rounded-2xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-950/20 p-3 space-y-2">
                                    <p className="text-xs font-black text-emerald-700 dark:text-emerald-200">
                                        Alarmes concluídos
                                    </p>

                                    {alarmesConcluidos.map((a) => (
                                        <div
                                            key={a.id}
                                            className="flex items-center justify-between rounded-xl border border-emerald-200 dark:border-emerald-900/40 bg-white/70 dark:bg-slate-900 px-3 py-2"
                                        >
                                            <div className="flex flex-col text-left">
                                                <span className="text-xs font-black text-slate-800 dark:text-slate-100">
                                                    {a.label}
                                                </span>

                                                <span className="text-[11px] font-mono font-black text-emerald-700 dark:text-emerald-300">
                                                    Tempo: {a.duracaoSegundos ? formatarTempo(a.duracaoSegundos) : "—"}
                                                </span>
                                            </div>

                                            {a.duracaoSegundos > 0 && (
                                                <button
                                                    onClick={() => salvarSessao({ forceDuration: a.duracaoSegundos })}
                                                    className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black cursor-pointer"
                                                >
                                                    Salvar com esse tempo
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Questões */}
                {(tipoEstudo === "Exercícios" || tipoEstudo === "Simulado") && (
                    <div className="rounded-2xl border border-indigo-100 dark:border-indigo-900/30 bg-indigo-50 dark:bg-indigo-950/20 p-4 space-y-3">
                        <div className="grid grid-cols-3 gap-3 text-xs font-black text-slate-700 dark:text-slate-200">
                            <span className="text-center">Questões</span>
                            <span className="text-center">Acertos</span>
                            <span className="text-center">Erros</span>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                            <input
                                type="number"
                                placeholder="0"
                                value={questoes.feitas}
                                onChange={(e) => setFeitas(e.target.value)}
                                className="bg-white/70 dark:bg-slate-900 text-center outline-none font-black rounded-xl py-3 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                            />
                            <input
                                type="number"
                                placeholder="0"
                                value={questoes.acertos}
                                onChange={(e) => setAcertos(e.target.value)}
                                className="bg-white/70 dark:bg-slate-900 text-center outline-none font-black rounded-xl py-3 border border-slate-200 dark:border-slate-800 text-emerald-600"
                            />
                            <input
                                type="number"
                                placeholder="0"
                                value={questoes.erros}
                                onChange={(e) => setErros(e.target.value)}
                                className="bg-white/70 dark:bg-slate-900 text-center outline-none font-black rounded-xl py-3 border border-slate-200 dark:border-slate-800 text-rose-500"
                            />
                        </div>
                    </div>
                )}

                {/* Anotações */}
                <textarea
                    placeholder="Anotações..."
                    value={anotacao}
                    onChange={(e) => setAnotacao(e.target.value)}
                    className="w-full p-4 h-24 bg-slate-50 dark:bg-slate-800 rounded-2xl outline-none border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
                />

                {/* Revisões */}
                <div className="space-y-3">
                    <button
                        onClick={() => setAgendarRevisao((v) => !v)}
                        className={`text-sm font-black flex items-center gap-2 cursor-pointer ${agendarRevisao
                            ? "text-indigo-600"
                            : "text-slate-500 dark:text-slate-300"
                            }`}
                    >
                        <Calendar size={16} className="text-indigo-600 dark:text-indigo-400" />
                        {agendarRevisao ? "Revisões serão agendadas ✅" : "Agendar revisões (espaçadas)?"}
                    </button>

                    {agendarRevisao && (
                        <div className="flex flex-wrap gap-2">
                            {revisoesPreset.map((opt) => {
                                const ativo = revisoesSelecionadas.includes(opt.days);
                                return (
                                    <button
                                        key={opt.days}
                                        onClick={() => alternarDiaRevisao(opt.days)}
                                        className={`px-4 py-2 rounded-2xl text-sm font-black border transition-all active:scale-95 cursor-pointer
                      ${ativo
                                                ? "bg-indigo-600 text-white border-indigo-600"
                                                : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-800"
                                            }`}
                                    >
                                        {opt.label}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Salvar */}
                <button
                    onClick={() => salvarSessao()}
                    disabled={loading}
                    className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-2xl shadow-lg active:scale-95 transition-all cursor-pointer disabled:opacity-60"
                >
                    {loading ? "SALVANDO..." : "SALVAR ATIVIDADE"}
                </button>
            </div>

            {duracaoModalAberto && (
                <DuracaoModal
                    valorInicial={duracaoManual}
                    onClose={() => setDuracaoModalAberto(false)}
                    onSave={(novoValor) => {
                        setDuracaoManual(novoValor);
                        setDuracaoModalAberto(false);
                    }}
                />
            )}
        </div>
    );
};

/* ============================
   MODAL DE DURAÇÃO
============================ */
const DuracaoModal = ({ valorInicial, onClose, onSave }) => {
    const [temp, setTemp] = useState(valorInicial);

    const horas = Array.from({ length: 25 }, (_, i) => i);
    const minsSecs = Array.from({ length: 60 }, (_, i) => i);

    return (
        <div
            className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center p-4"
            onClick={onClose}
        >
            <div
                className="w-full max-w-2xl rounded-3xl bg-slate-900 text-white p-6 md:p-8 shadow-2xl border border-slate-700"
                onClick={(e) => e.stopPropagation()}
            >
                <h3 className="text-2xl font-black mb-6">Duração</h3>

                <div className="grid grid-cols-3 gap-6 items-center text-center">
                    <div>
                        <p className="text-xs font-black text-slate-400 mb-2">Horas</p>
                        <select
                            value={temp.h}
                            onChange={(e) => setTemp({ ...temp, h: Number(e.target.value) })}
                            className="w-full text-center text-2xl font-black bg-transparent border-b-2 border-cyan-400 pb-2 outline-none"
                        >
                            {horas.map((n) => (
                                <option key={n} value={n} className="text-slate-900">
                                    {n}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <p className="text-xs font-black text-slate-400 mb-2">Min</p>
                        <select
                            value={temp.m}
                            onChange={(e) => setTemp({ ...temp, m: Number(e.target.value) })}
                            className="w-full text-center text-2xl font-black bg-transparent border-b-2 border-cyan-400 pb-2 outline-none"
                        >
                            {minsSecs.map((n) => (
                                <option key={n} value={n} className="text-slate-900">
                                    {n}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <p className="text-xs font-black text-slate-400 mb-2">Seg</p>
                        <select
                            value={temp.s}
                            onChange={(e) => setTemp({ ...temp, s: Number(e.target.value) })}
                            className="w-full text-center text-2xl font-black bg-transparent border-b-2 border-cyan-400 pb-2 outline-none"
                        >
                            {minsSecs.map((n) => (
                                <option key={n} value={n} className="text-slate-900">
                                    {n}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="flex justify-end gap-6 mt-8 text-sm font-black">
                    <button onClick={onClose} className="text-rose-400 hover:text-rose-300 cursor-pointer">
                        CANCELAR
                    </button>

                    <button onClick={() => onSave(temp)} className="text-emerald-400 hover:text-emerald-300 cursor-pointer">
                        SALVAR
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EstudarAgora;
