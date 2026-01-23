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

    // Modal duração manual
    const [duracaoModalAberto, setDuracaoModalAberto] = useState(false);
    const [duracaoManual, setDuracaoManual] = useState({ h: 0, m: 0, s: 0 });

    // Cronômetro
    const [segundos, setSegundos] = useState(0);
    const [ativo, setAtivo] = useState(false);
    const [inicioCronometroEm, setInicioCronometroEm] = useState(null);

    // Alarmes
    const [alarmeTipo, setAlarmeTipo] = useState("nenhum"); // nenhum | duracao | horario
    const [alarmeDuracaoMin, setAlarmeDuracaoMin] = useState("30");
    const [alarmeHorario, setAlarmeHorario] = useState(agoraHHMM);

    // ✅ Alarmes ativos e concluídos
    const [alarmesAtivos, setAlarmesAtivos] = useState([]);
    const [alarmesConcluidos, setAlarmesConcluidos] = useState([]);

    // guarda os timeouts de cada alarme (id -> timeout)
    const alarmesTimeoutsRef = useRef(new Map());

    // ✅ Overlay chamativo do alarme
    const [alarmeTocando, setAlarmeTocando] = useState(false);
    const [alarmeTitulo, setAlarmeTitulo] = useState("⏰ Alarme!");
    const [alarmeMensagem, setAlarmeMensagem] = useState("Seu tempo atingiu o limite configurado.");

    const alarmRingIntervalRef = useRef(null);
    const alarmRingStopRef = useRef(null);

    // Últimas atividades
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

    // =============================
    // Helpers de tempo
    // =============================
    const formatarTempo = (s) => {
        const total = Math.max(0, Number(s || 0));
        const h = Math.floor(total / 3600);
        const m = Math.floor((total % 3600) / 60);
        const seg = total % 60;
        return `${h.toString().padStart(2, "0")}:${m
            .toString()
            .padStart(2, "0")}:${seg.toString().padStart(2, "0")}`;
    };

    const calcularRemainingSeg = (fireAt) => {
        return Math.max(0, Math.ceil((fireAt - Date.now()) / 1000));
    };

    const formatarRestante = (totalSeg) => {
        return formatarTempo(Math.max(0, Number(totalSeg || 0)));
    };

    const msAteHorario = (hhmm) => {
        const [hh, mm] = String(hhmm || "00:00").split(":").map(Number);
        if (Number.isNaN(hh) || Number.isNaN(mm)) return -1;

        const agora = new Date();
        const alvo = new Date();

        alvo.setHours(hh);
        alvo.setMinutes(mm);
        alvo.setSeconds(0);
        alvo.setMilliseconds(0);

        if (alvo.getTime() <= agora.getTime()) alvo.setDate(alvo.getDate() + 1);

        return alvo.getTime() - agora.getTime();
    };

    // =============================
    // Notificações + Som
    // =============================
    const suporteNotificacao =
        typeof window !== "undefined" && "Notification" in window;

    const pedirPermissaoNotificacao = async () => {
        if (!suporteNotificacao) return false;
        if (Notification.permission === "granted") return true;

        if (Notification.permission === "denied") {
            showToast(
                "Notificações bloqueadas ❌",
                "Ative manualmente nas configurações do navegador."
            );
            return false;
        }

        const perm = await Notification.requestPermission();
        return perm === "granted";
    };

    // ✅ Beep forte + repetido (sem baixar arquivo)
    const playBeep = () => {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            const ctx = new AudioContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = "square"; // mais chamativo que sine
            osc.frequency.value = 980;
            gain.gain.value = 0.12;

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start();
            setTimeout(() => {
                osc.stop();
                ctx.close();
            }, 240);
        } catch (e) { }
    };

    const vibrar = () => {
        try {
            if ("vibrate" in navigator) navigator.vibrate([250, 120, 250, 120, 400]);
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

    // ✅ Alarme EXTENSO e chamativo (overlay + beeps por ~12s)
    const pararAlarmeChamativo = () => {
        setAlarmeTocando(false);
        if (alarmRingIntervalRef.current) {
            clearInterval(alarmRingIntervalRef.current);
            alarmRingIntervalRef.current = null;
        }
        if (alarmRingStopRef.current) {
            clearTimeout(alarmRingStopRef.current);
            alarmRingStopRef.current = null;
        }
    };

    const iniciarAlarmeChamativo = (titulo, mensagem) => {
        // evita duplicar tocando
        pararAlarmeChamativo();

        setAlarmeTitulo(titulo || "⏰ Alarme!");
        setAlarmeMensagem(mensagem || "Seu tempo atingiu o limite configurado.");
        setAlarmeTocando(true);

        // beeps repetidos
        alarmRingIntervalRef.current = setInterval(() => {
            playBeep();
            vibrar();
        }, 520);

        // auto para em 12 segundos
        alarmRingStopRef.current = setTimeout(() => {
            pararAlarmeChamativo();
        }, 12000);
    };

    const dispararAlarme = (tituloExtra) => {
        // Notificação
        dispararNotificacao();

        // Overlay chamativo + som/vibração repetida
        iniciarAlarmeChamativo(
            tituloExtra || "⏰ Alarme!",
            "Seu tempo atingiu o limite configurado."
        );

        // Toast também
        showToast("⏰ Alarme!", "Seu tempo atingiu o limite configurado.");
    };

    // =============================
    // Alarmes ativos/concluídos
    // =============================
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

    const removerConcluido = (id) => {
        setAlarmesConcluidos((prev) => prev.filter((a) => a.id !== id));
    };

    const usarTempoConcluido = (item) => {
        // aplica a duração pra salvar a sessão com esse tempo
        if (typeof item?.duracaoSeg === "number") {
            setSegundos(item.duracaoSeg);
            setAtivo(false); // pausa
            showToast("✅ Tempo aplicado", "Agora você pode salvar a tarefa com essa duração.");
        } else {
            showToast("Sem duração fixa", "Esse alarme não possui duração definida.");
        }
    };

    const concluirAlarme = (alarmeObj) => {
        // remove dos ativos
        removerAlarmeAtivo(alarmeObj.id);

        // adiciona nos concluídos
        setAlarmesConcluidos((prev) => [
            {
                id: `done-${Date.now()}`,
                label: alarmeObj.label,
                concluidoEm: new Date().toISOString(),
                duracaoSeg: alarmeObj.duracaoSeg ?? null,
            },
            ...prev,
        ]);
    };

    const criarAlarmeAtivo = async () => {
        if (alarmeTipo === "nenhum") {
            showToast("Selecione um tipo", "Escolha 'Por duração' ou 'Por horário'.");
            return;
        }

        // tenta permissão (melhor experiência)
        await pedirPermissaoNotificacao();

        // ✅ Por duração (precisa cronômetro rodando)
        if (alarmeTipo === "duracao") {
            if (!ativo) {
                showToast(
                    "Inicie o cronômetro",
                    "O alarme por duração funciona com o cronômetro rodando."
                );
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

            const alarmeObj = {
                id,
                tipo: "duracao",
                label: `Duração • ${alarmeDuracaoMin} min`,
                fireAt,
                remaining: restante,
                duracaoSeg: alvoSeg, // ✅ isso permite salvar com esse tempo depois
            };

            setAlarmesAtivos((prev) => [...prev, alarmeObj]);

            const t = setTimeout(() => {
                // quando dispara -> pausa cronômetro e aplica exatamente a duração configurada
                setAtivo(false);
                setSegundos(alvoSeg);

                dispararAlarme("⏰ Hora de pausar!");
                concluirAlarme(alarmeObj);
            }, restante * 1000);

            alarmesTimeoutsRef.current.set(id, t);

            showToast("✅ Alarme ativado", `Vai disparar em ~${Math.ceil(restante / 60)} min.`);
            return;
        }

        // ✅ Por horário
        if (alarmeTipo === "horario") {
            const ms = msAteHorario(alarmeHorario);
            if (ms <= 0) {
                showToast("Horário inválido", "Não consegui calcular o horário do alarme.");
                return;
            }

            const id = `hr-${Date.now()}`;
            const fireAt = Date.now() + ms;

            const alarmeObj = {
                id,
                tipo: "horario",
                label: `Horário • ${alarmeHorario}`,
                fireAt,
                remaining: Math.ceil(ms / 1000),
                duracaoSeg: null, // horário não tem duração fixa
            };

            setAlarmesAtivos((prev) => [...prev, alarmeObj]);

            const t = setTimeout(() => {
                dispararAlarme("⏰ Alarme por horário!");
                concluirAlarme(alarmeObj);
            }, ms);

            alarmesTimeoutsRef.current.set(id, t);

            showToast("✅ Alarme ativado", `Vai disparar às ${alarmeHorario}.`);
        }
    };

    // ✅ atualiza contagem regressiva dos alarmes ativos
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

    // =============================
    // Cronômetro ticking
    // =============================
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

    // =============================
    // Supabase
    // =============================
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

    // =============================
    // Questões (validação)
    // =============================
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
        if (acertosClamped + erros > feitas)
            erros = Math.max(0, feitas - acertosClamped);

        setQuestoes({ ...questoes, acertos: acertosClamped, erros });
    };

    const setErros = (val) => {
        const erros = Math.max(0, Number(val || 0));
        const feitas = Number(questoes.feitas || 0);
        let acertos = Number(questoes.acertos || 0);

        const errosClamped = Math.min(erros, feitas);
        if (acertos + errosClamped > feitas)
            acertos = Math.max(0, feitas - errosClamped);

        setQuestoes({ ...questoes, erros: errosClamped, acertos });
    };

    // =============================
    // Revisões espaçadas
    // =============================
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

    // =============================
    // Salvar sessão
    // =============================
    const duracaoManualEmSegundos = () => {
        const h = Number(duracaoManual.h || 0);
        const m = Number(duracaoManual.m || 0);
        const s = Number(duracaoManual.s || 0);
        return h * 3600 + m * 60 + s;
    };

    const salvarSessao = async () => {
        if (!materia.trim()) {
            return showToast("Faltou matéria", "Defina uma matéria antes de salvar.");
        }

        if (tipoEstudo === "Exercícios" || tipoEstudo === "Simulado") {
            const feitas = Number(questoes.feitas || 0);
            const acertos = Number(questoes.acertos || 0);
            const erros = Number(questoes.erros || 0);

            if (acertos > feitas || erros > feitas || acertos + erros > feitas) {
                return showToast(
                    "Números inconsistentes",
                    "Acertos/Erros não podem ultrapassar Questões feitas."
                );
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

    // =============================
    // UI
    // =============================
    return (
        <div className="max-w-2xl mx-auto space-y-6">
            {/* ✅ OVERLAY DO ALARME CHAMATIVO */}
            {alarmeTocando && (
                <div className="fixed inset-0 z-[999999] bg-black/70 flex items-center justify-center p-4">
                    <div className="w-full max-w-md rounded-3xl border border-rose-400/40 bg-slate-950 p-6 shadow-2xl">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <p className="text-2xl font-black text-white animate-pulse">
                                    {alarmeTitulo}
                                </p>
                                <p className="mt-2 text-sm text-slate-200">
                                    {alarmeMensagem}
                                </p>
                                <p className="mt-2 text-xs text-slate-400">
                                    {materia ? `📘 ${materia}` : "📘 Estudo"}{" "}
                                    {conteudo ? `• ${conteudo}` : ""}
                                </p>
                            </div>

                            <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-400/40">
                                <Bell className="text-rose-300 animate-bounce" />
                            </div>
                        </div>

                        <div className="mt-5 grid grid-cols-2 gap-3">
                            <button
                                onClick={pararAlarmeChamativo}
                                className="py-3 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-black cursor-pointer"
                                type="button"
                            >
                                Parar alarme
                            </button>

                            <button
                                onClick={() => {
                                    pararAlarmeChamativo();
                                    showToast("💾 Dica", "Se quiser salvar com a duração, clique em SALVAR ATIVIDADE.");
                                }}
                                className="py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-black cursor-pointer"
                                type="button"
                            >
                                Ok
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ✅ TOAST */}
            {toast.show && (
                <div className="fixed top-6 right-6 z-[99999] w-[320px] rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl p-4">
                    <p className="font-black text-slate-900 dark:text-white">{toast.title}</p>
                    <p className="text-sm mt-1 text-slate-600 dark:text-slate-300">{toast.message}</p>
                    <button
                        onClick={() => setToast({ show: false, title: "", message: "" })}
                        className="mt-3 text-xs font-black text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                        type="button"
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
                    type="button"
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
                    type="button"
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
                                type="button"
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
                            {(verMaisAtividades
                                ? ultimasAtividades
                                : ultimasAtividades.slice(0, 2)
                            ).map((a) => (
                                <div
                                    key={a.id}
                                    className="flex items-center justify-between text-sm p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                                >
                                    <div className="flex flex-col">
                                        <span className="font-bold">{a.materia}</span>
                                        <span className="text-xs text-slate-600 dark:text-slate-300">
                                            {a.tipo_estudo} • {new Date(a.inicio_em).toLocaleString()}
                                        </span>

                                        {(a.tipo_estudo === "Exercícios" ||
                                            a.tipo_estudo === "Simulado") && (
                                                <span className="text-[11px] mt-1 text-slate-500 dark:text-slate-300">
                                                    Q: {a.questoes_feitas || 0} • ✅ {a.questoes_acertos || 0}{" "}
                                                    • ❌ {a.questoes_erros || 0}
                                                </span>
                                            )}
                                    </div>

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
                                type="button"
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
                                type="button"
                            >
                                {ativo ? <Pause /> : <Play />}
                            </button>

                            <button
                                onClick={resetarCronometro}
                                className="p-4 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer transition-all active:scale-95"
                                type="button"
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

                            {(alarmeTipo === "duracao" || alarmeTipo === "horario") && (
                                <div className="space-y-3">
                                    <button
                                        onClick={criarAlarmeAtivo}
                                        className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-sm cursor-pointer"
                                        type="button"
                                    >
                                        Ativar Alarme
                                    </button>

                                    {/* ✅ Alarmes ativos */}
                                    {alarmesAtivos.length > 0 && (
                                        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 space-y-2">
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
                                                            {formatarRestante(a.remaining)}
                                                        </span>
                                                    </div>

                                                    <button
                                                        onClick={() => cancelarAlarmeAtivo(a.id)}
                                                        className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                                                        title="Cancelar alarme"
                                                        type="button"
                                                    >
                                                        <X size={16} className="text-slate-500 dark:text-slate-300" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* ✅ Alarmes concluídos */}
                                    {alarmesConcluidos.length > 0 && (
                                        <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/30 bg-emerald-50 dark:bg-emerald-950/15 p-3 space-y-2">
                                            <p className="text-xs font-black text-emerald-800 dark:text-emerald-200">
                                                Alarmes concluídos
                                            </p>

                                            {alarmesConcluidos.map((c) => (
                                                <div
                                                    key={c.id}
                                                    className="flex items-center justify-between rounded-xl border border-emerald-200 dark:border-emerald-900/30 bg-white/60 dark:bg-slate-900/40 px-3 py-2"
                                                >
                                                    <div className="flex flex-col text-left">
                                                        <span className="text-xs font-black text-slate-800 dark:text-slate-100">
                                                            {c.label}
                                                        </span>

                                                        <span className="text-[11px] font-mono font-black text-emerald-700 dark:text-emerald-300">
                                                            {typeof c.duracaoSeg === "number"
                                                                ? `Duração: ${formatarTempo(c.duracaoSeg)}`
                                                                : `Concluído às: ${new Date(c.concluidoEm).toLocaleTimeString()}`}
                                                        </span>
                                                    </div>

                                                    <div className="flex items-center gap-2">
                                                        {typeof c.duracaoSeg === "number" && (
                                                            <button
                                                                onClick={() => usarTempoConcluido(c)}
                                                                className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black cursor-pointer"
                                                                type="button"
                                                                title="Aplicar essa duração no cronômetro para salvar"
                                                            >
                                                                Usar este tempo
                                                            </button>
                                                        )}

                                                        <button
                                                            onClick={() => removerConcluido(c.id)}
                                                            className="p-2 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/30 cursor-pointer"
                                                            type="button"
                                                            title="Remover"
                                                        >
                                                            <X size={16} className="text-emerald-700 dark:text-emerald-200" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
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
                        type="button"
                    >
                        <Calendar size={16} className="text-indigo-600 dark:text-indigo-400" />
                        {agendarRevisao ? "Revisões serão agendadas ✅" : "Agendar revisões (espaçadas)?"}
                    </button>

                    {agendarRevisao && (
                        <div className="flex flex-wrap gap-2">
                            {revisoesPreset.map((opt) => {
                                const ativoOpt = revisoesSelecionadas.includes(opt.days);
                                return (
                                    <button
                                        key={opt.days}
                                        onClick={() => alternarDiaRevisao(opt.days)}
                                        className={`px-4 py-2 rounded-2xl text-sm font-black border transition-all active:scale-95 cursor-pointer
                      ${ativoOpt
                                                ? "bg-indigo-600 text-white border-indigo-600"
                                                : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-800"
                                            }`}
                                        type="button"
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
                    type="button"
                >
                    {loading ? "SALVANDO..." : "SALVAR ATIVIDADE"}
                </button>
            </div>

            {/* Modal duração */}
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
                    <button
                        onClick={onClose}
                        className="text-rose-400 hover:text-rose-300 cursor-pointer"
                        type="button"
                    >
                        CANCELAR
                    </button>

                    <button
                        onClick={() => onSave(temp)}
                        className="text-rose-400 hover:text-rose-300 cursor-pointer"
                        type="button"
                    >
                        SALVAR
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EstudarAgora;
