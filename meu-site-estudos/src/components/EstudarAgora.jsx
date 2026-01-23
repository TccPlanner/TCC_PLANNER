import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    Play,
    Pause,
    RotateCcw,
    Calendar,
    Bell,
    History,
    Clock3,
} from "lucide-react";
import { supabase } from "../supabaseClient";

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
    const [questoes, setQuestoes] = useState({
        feitas: 0,
        acertos: 0,
        erros: 0,
    });

    // Manual
    const hojeISO = useMemo(() => new Date().toISOString().split("T")[0], []);
    const agoraHHMM = useMemo(() => {
        const d = new Date();
        return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }, []);

    const [dataInicio, setDataInicio] = useState(hojeISO);
    const [horaInicio, setHoraInicio] = useState(agoraHHMM);

    // ✅ Duração em modal
    const [duracaoModalAberto, setDuracaoModalAberto] = useState(false);
    const [duracaoManual, setDuracaoManual] = useState({ h: 0, m: 0, s: 0 });

    // Cronômetro
    const [segundos, setSegundos] = useState(0);
    const [ativo, setAtivo] = useState(false);
    const [inicioCronometroEm, setInicioCronometroEm] = useState(null);

    // Alarmes
    const [alarmeTipo, setAlarmeTipo] = useState("nenhum"); // nenhum | duracao | horario
    const [alarmeDuracaoMin, setAlarmeDuracaoMin] = useState("30");
    const [alarmeHorario, setAlarmeHorario] = useState("21:42");

    const alarmTimeoutRef = useRef(null);

    // Últimas atividades reais
    const [ultimasAtividades, setUltimasAtividades] = useState([]);

    // ✅ Toast
    const [toast, setToast] = useState({ show: false, title: "", message: "" });
    const toastTimer = useRef(null);

    const showToast = (title, message) => {
        clearTimeout(toastTimer.current);
        setToast({ show: true, title, message });
        toastTimer.current = setTimeout(() => {
            setToast({ show: false, title: "", message: "" });
        }, 4500);
    };

    // ✅ Notificações
    const suporteNotificacao =
        typeof window !== "undefined" && "Notification" in window;

    const pedirPermissaoNotificacao = async () => {
        if (!suporteNotificacao) {
            showToast("Seu navegador não suporta", "Notificações não estão disponíveis aqui.");
            return;
        }

        if (Notification.permission === "granted") {
            showToast("Notificações ativadas ✅", "Agora seu alarme pode aparecer como notificação.");
            return;
        }

        if (Notification.permission === "denied") {
            showToast("Notificações bloqueadas ❌", "Ative manualmente nas configurações do navegador.");
            return;
        }

        const perm = await Notification.requestPermission();
        if (perm === "granted") {
            showToast("Notificações ativadas ✅", "Agora seu alarme pode aparecer como notificação.");
        } else {
            showToast("Permissão negada", "Sem notificação, usaremos apenas som/vibração.");
        }
    };

    // ✅ Som beep (WebAudio)
    const playBeep = () => {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            const ctx = new AudioContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = "sine";
            osc.frequency.value = 880;
            gain.gain.value = 0.08;

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start();
            setTimeout(() => {
                osc.stop();
                ctx.close();
            }, 700);
        } catch (e) { }
    };

    // ✅ Vibração
    const vibrar = () => {
        try {
            if ("vibrate" in navigator) {
                navigator.vibrate([200, 120, 200, 120, 300]);
            }
        } catch (e) { }
    };

    const dispararNotificacao = () => {
        if (suporteNotificacao && Notification.permission === "granted") {
            const n = new Notification("⏰ Hora de pausar!", {
                body: `Sessão: ${materia || "Estudo"} • ${conteudo || "Sem conteúdo"}`,
                silent: false,
            });

            n.onclick = () => {
                window.focus();
                n.close();
            };
        }
    };

    const dispararAlarme = () => {
        playBeep();
        vibrar();
        dispararNotificacao();
        showToast("⏰ Alarme!", "Seu tempo atingiu o limite configurado.");
    };

    const limparAlarmeAgendado = () => {
        if (alarmTimeoutRef.current) {
            clearTimeout(alarmTimeoutRef.current);
            alarmTimeoutRef.current = null;
        }
    };

    const msAteHorario = (hhmm) => {
        const [hh, mm] = hhmm.split(":").map(Number);
        const agora = new Date();
        const alvo = new Date();

        alvo.setHours(hh);
        alvo.setMinutes(mm);
        alvo.setSeconds(0);
        alvo.setMilliseconds(0);

        if (alvo.getTime() <= agora.getTime()) alvo.setDate(alvo.getDate() + 1);
        return alvo.getTime() - agora.getTime();
    };

    const agendarAlarme = () => {
        limparAlarmeAgendado();
        if (!ativo) return;
        if (alarmeTipo === "nenhum") return;

        if (alarmeTipo === "duracao") {
            const alvoSeg = Number(alarmeDuracaoMin) * 60;
            const restante = alvoSeg - segundos;
            if (restante <= 0) return;

            alarmTimeoutRef.current = setTimeout(() => {
                dispararAlarme();
            }, restante * 1000);
        }

        if (alarmeTipo === "horario") {
            const ms = msAteHorario(alarmeHorario);
            alarmTimeoutRef.current = setTimeout(() => {
                dispararAlarme();
            }, ms);
        }
    };

    useEffect(() => {
        if (!ativo) {
            limparAlarmeAgendado();
            return;
        }
        agendarAlarme();
        // eslint-disable-next-line
    }, [ativo, alarmeTipo, alarmeDuracaoMin, alarmeHorario]);

    useEffect(() => {
        let intervalo = null;
        if (ativo) intervalo = setInterval(() => setSegundos((s) => s + 1), 1000);
        return () => clearInterval(intervalo);
    }, [ativo]);

    useEffect(() => {
        buscarUltimasAtividades();
        // eslint-disable-next-line
    }, []);

    const buscarUltimasAtividades = async () => {
        const { data, error } = await supabase
            .from("sessoes_estudo")
            .select("*")
            .eq("user_id", user.id)
            .order("inicio_em", { ascending: false })
            .limit(50);

        if (!error && data) setUltimasAtividades(data);
    };


    const formatarTempo = (s) => {
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        const seg = s % 60;
        return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${seg
            .toString()
            .padStart(2, "0")}`;
    };

    const iniciarOuPausar = () => {
        if (!ativo && segundos === 0) setInicioCronometroEm(new Date().toISOString());
        setAtivo((v) => !v);
    };

    const resetarCronometro = () => {
        setSegundos(0);
        setAtivo(false);
        setInicioCronometroEm(null);
        limparAlarmeAgendado();
    };

    // ✅ validação questões
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

    // Revisão espaçada
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

    const duracaoManualEmSegundos = () => {
        const h = Number(duracaoManual.h || 0);
        const m = Number(duracaoManual.m || 0);
        const s = Number(duracaoManual.s || 0);
        return h * 3600 + m * 60 + s;
    };

    const salvarSessao = async () => {
        if (!materia.trim()) return showToast("Faltou matéria", "Defina uma matéria antes de salvar.");

        if (tipoEstudo === "Exercícios") {
            const feitas = Number(questoes.feitas || 0);
            const acertos = Number(questoes.acertos || 0);
            const erros = Number(questoes.erros || 0);

            if (acertos > feitas || erros > feitas || acertos + erros > feitas) {
                return showToast("Números inconsistentes", "Acertos/Erros não podem ultrapassar Questões feitas.");
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

            const payload = {
                user_id: user.id,
                materia: materia.trim(),
                conteudo: conteudo.trim(),
                tipo_estudo: tipoEstudo,
                inicio_em: inicio_em_iso,
                duracao_segundos,
                modo,
                anotacao: anotacao.trim(),
                questoes_feitas: (tipoEstudo === "Exercícios" || tipoEstudo === "Simulado") ? Number(questoes.feitas || 0) : 0,
                questoes_acertos: (tipoEstudo === "Exercícios" || tipoEstudo === "Simulado") ? Number(questoes.acertos || 0) : 0,
                questoes_erros: (tipoEstudo === "Exercícios" || tipoEstudo === "Simulado") ? Number(questoes.erros || 0) : 0,

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
                showToast("Erro ao salvar", error.message);
                return;
            }

            if (agendarRevisao) await criarRevisoes(materia.trim());

            showToast("✅ Salvo!", "Atividade registrada com sucesso.");

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

    const DuracaoTexto = useMemo(() => {
        const hh = String(duracaoManual.h).padStart(2, "0");
        const mm = String(duracaoManual.m).padStart(2, "0");
        const ss = String(duracaoManual.s).padStart(2, "0");
        return `${hh}:${mm}:${ss}`;
    }, [duracaoManual]);

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            {/* ✅ TOAST */}
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
                        className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl outline-none border border-slate-200 dark:border-slate-700"
                    />

                    <input
                        type="text"
                        placeholder="Conteúdo"
                        value={conteudo}
                        onChange={(e) => setConteudo(e.target.value)}
                        className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl outline-none border border-slate-200 dark:border-slate-700"
                    />

                    <select
                        value={tipoEstudo}
                        onChange={(e) => setTipoEstudo(e.target.value)}
                        className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl outline-none border border-slate-200 dark:border-slate-700 md:col-span-2
            text-slate-900 dark:text-slate-100"
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
                        <div
                            className={`space-y-2 ${verMaisAtividades ? "max-h-56 overflow-y-auto pr-1" : ""
                                }`}
                        >
                            {(verMaisAtividades ? ultimasAtividades : ultimasAtividades.slice(0, 2)).map((a) => (
                                <div
                                    key={a.id}
                                    className="flex items-center justify-between text-sm p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                                >
                                    <div className="flex flex-col">
                                        <span className="font-bold">{a.materia}</span>
                                        <span className="text-xs text-slate-600 dark:text-slate-300">
                                            {a.tipo_estudo} • {new Date(a.inicio_em).toLocaleString()}
                                        </span>

                                        {/* ✅ Se tiver questões (Exercícios ou Simulado), mostramos mini-resumo */}
                                        {(a.tipo_estudo === "Exercícios" || a.tipo_estudo === "Simulado") && (
                                            <span className="text-[11px] mt-1 text-slate-500 dark:text-slate-300">
                                                Q: {a.questoes_feitas || 0} • ✅ {a.questoes_acertos || 0} • ❌{" "}
                                                {a.questoes_erros || 0}
                                            </span>
                                        )}
                                    </div>

                                    {/* ✅ TEMPO HH:MM:SS */}
                                    <span className="font-mono font-black text-slate-800 dark:text-slate-100">
                                        {formatarTempo(a.duracao_segundos || 0)}
                                    </span>
                                </div>
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
                                className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl outline-none border border-slate-200 dark:border-slate-700 text-sm
                text-slate-900 dark:text-slate-100"
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
                                className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl outline-none border border-slate-200 dark:border-slate-700 text-sm
                text-slate-900 dark:text-slate-100"
                            />
                        </div>

                        <div className="col-span-2">
                            <p className="text-xs font-black text-slate-500 dark:text-slate-300 mb-2">
                                Duração
                            </p>

                            <button
                                onClick={() => setDuracaoModalAberto(true)}
                                className="w-full p-4 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700
                flex items-center justify-between font-black cursor-pointer"
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

                        {/* ✅ Alarmes (Botão notificação agora embaixo do Disparar às) */}
                        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-black flex items-center gap-2 text-slate-800 dark:text-slate-100">
                                    <Bell size={14} /> Alarme
                                </span>

                                <select
                                    value={alarmeTipo}
                                    onChange={(e) => setAlarmeTipo(e.target.value)}
                                    className="bg-transparent text-sm outline-none font-black text-slate-900 dark:text-slate-100 cursor-pointer"
                                >
                                    <option value="nenhum">Nenhum</option>
                                    <option value="duracao">Por duração</option>
                                    <option value="horario">Por horário</option>
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
                                        className="bg-transparent text-sm outline-none font-black text-slate-900 dark:text-slate-100 cursor-pointer"
                                    >
                                        <option value="15">15 min</option>
                                        <option value="30">30 min</option>
                                        <option value="45">45 min</option>
                                        <option value="60">60 min</option>
                                        <option value="90">90 min</option>
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

                            {/* ✅ AGORA AQUI EMBAIXO */}
                            {(alarmeTipo === "duracao" || alarmeTipo === "horario") && (
                                <button
                                    onClick={pedirPermissaoNotificacao}
                                    className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-sm cursor-pointer"
                                >
                                    Ativar Notificações
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* Exercícios */}
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
                                className="bg-white/70 dark:bg-slate-900 text-center outline-none font-black rounded-xl py-3
        border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                            />
                            <input
                                type="number"
                                placeholder="0"
                                value={questoes.acertos}
                                onChange={(e) => setAcertos(e.target.value)}
                                className="bg-white/70 dark:bg-slate-900 text-center outline-none font-black rounded-xl py-3
        border border-slate-200 dark:border-slate-800 text-emerald-600"
                            />
                            <input
                                type="number"
                                placeholder="0"
                                value={questoes.erros}
                                onChange={(e) => setErros(e.target.value)}
                                className="bg-white/70 dark:bg-slate-900 text-center outline-none font-black rounded-xl py-3
        border border-slate-200 dark:border-slate-800 text-red-500"
                            />
                        </div>
                    </div>
                )}


                {/* Anotações */}
                <textarea
                    placeholder="Anotações..."
                    value={anotacao}
                    onChange={(e) => setAnotacao(e.target.value)}
                    className="w-full p-4 h-24 bg-slate-50 dark:bg-slate-800 rounded-2xl outline-none border border-slate-200 dark:border-slate-700 text-sm
          text-slate-900 dark:text-slate-100"
                />

                {/* Revisões */}
                <div className="space-y-3">
                    <button
                        onClick={() => setAgendarRevisao((v) => !v)}
                        className={`text-sm font-black flex items-center gap-2 cursor-pointer ${agendarRevisao ? "text-indigo-600" : "text-slate-500 dark:text-slate-300"
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
                    onClick={salvarSessao}
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

                    <button onClick={() => onSave(temp)} className="text-rose-400 hover:text-rose-300 cursor-pointer">
                        SALVAR
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EstudarAgora;
