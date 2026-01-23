// GerenciadorTarefas.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabaseClient";
import {
    Plus,
    Trash2,
    CheckCircle,
    Circle,
    Trophy,
    Calendar,
    Paperclip,
    RefreshCw,
    UploadCloud,
    FileText,
    Download,
    ExternalLink,
    X,
    ListTree,
    Link as LinkIcon,
    Edit3,
    Bell,
    Filter,
    Search,
    BarChart3,
} from "lucide-react";

const BUCKET_ANEXOS = "tarefas_anexos";

const PRIORITY_STRIPE = {
    1: "bg-emerald-500",
    2: "bg-amber-500",
    3: "bg-rose-500",
};

const toISODate = (d) => {
    const dt = new Date(d);
    const yyyy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    const dd = String(dt.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
};

const startOfDay = (date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
};

const endOfDay = (date) => {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
};

const addDays = (date, days) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
};

const GerenciadorTarefas = ({ user }) => {
    const [tarefas, setTarefas] = useState([]);
    const [loading, setLoading] = useState(false);

    // Tabs (To-do / Estatísticas)
    const [aba, setAba] = useState("todo"); // "todo" | "stats"

    // Subtarefa rápida (dentro do card, sem expandir)
    const [addSubAbertoId, setAddSubAbertoId] = useState(null);
    const [addSubTexto, setAddSubTexto] = useState("");

    // Form criação
    const [novaTarefa, setNovaTarefa] = useState("");
    const [mostrarOpcoes, setMostrarOpcoes] = useState(false);
    const [categoria, setCategoria] = useState("Geral");
    const [prioridade, setPrioridade] = useState("1");
    const [dataVencimento, setDataVencimento] = useState(
        new Date().toISOString().split("T")[0]
    );
    const [notas, setNotas] = useState("");
    const [recorrente, setRecorrente] = useState(false);
    const [lembrete, setLembrete] = useState(false);
    const [lembreteHora, setLembreteHora] = useState("09:00");

    // ✅ múltiplos links + múltiplos uploads
    const [novoLink, setNovoLink] = useState("");
    const [linksCriacao, setLinksCriacao] = useState([]);
    const [arquivosUpload, setArquivosUpload] = useState([]); // File[]

    // Subtarefas na criação
    const [mostrarSubCriacao, setMostrarSubCriacao] = useState(false);
    const [subCriacaoTexto, setSubCriacaoTexto] = useState("");
    const [subCriacaoLista, setSubCriacaoLista] = useState([]);

    // Edição
    const [editandoId, setEditandoId] = useState(null);
    const [editandoCampos, setEditandoCampos] = useState({});
    const [editNovoUrl, setEditNovoUrl] = useState("");
    const [editNovosArquivos, setEditNovosArquivos] = useState([]); // File[]
    const [editSubTexto, setEditSubTexto] = useState("");

    // UI
    const [expandida, setExpandida] = useState(null);

    // Confirmação de concluir tarefa com subs pendentes
    const [confirmarConclusao, setConfirmarConclusao] = useState(null);

    // Filtros
    const [fStatus, setFStatus] = useState("todas"); // todas | pendentes | concluidas
    const [fPrioridade, setFPrioridade] = useState("todas"); // todas | 1 | 2 | 3
    const [fCategoria, setFCategoria] = useState("todas"); // todas | ...
    const [fBusca, setFBusca] = useState("");
    const [ordenacao, setOrdenacao] = useState("vencimento_asc"); // vencimento_asc | vencimento_desc | prioridade_desc | created_desc

    // Estatísticas: período
    const [periodoStats, setPeriodoStats] = useState("30d"); // 7d | 30d | 90d | 1y | tudo | custom
    const [statsInicio, setStatsInicio] = useState("");
    const [statsFim, setStatsFim] = useState("");

    // Click fora do form para fechar modo avançado
    const formRef = useRef(null);

    useEffect(() => {
        if (!user) return;
        buscarTarefas();
    }, [user]);

    useEffect(() => {
        const handler = (e) => {
            if (!formRef.current) return;
            if (mostrarOpcoes && !formRef.current.contains(e.target)) {
                setMostrarOpcoes(false);
                setMostrarSubCriacao(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [mostrarOpcoes]);

    const buscarTarefas = async () => {
        const { data, error } = await supabase
            .from("tarefas")
            .select("*")
            .eq("user_id", user.id)
            .order("prioridade", { ascending: false });

        if (!error && data) setTarefas(data);
    };

    const uploadParaStorage = async (file) => {
        const safeName = file.name.replace(/\s/g, "_");
        const fileName = `${Date.now()}_${safeName}`;
        const filePath = `${user.id}/${fileName}`;

        const { error } = await supabase.storage
            .from(BUCKET_ANEXOS)
            .upload(filePath, file);

        if (error) throw error;

        const { data } = supabase.storage
            .from(BUCKET_ANEXOS)
            .getPublicUrl(filePath);

        return {
            nome: file.name,
            url: data.publicUrl,
            tipo: "upload",
            path: filePath,
        };
    };

    const baixarUpload = async (anexo) => {
        try {
            if (!anexo?.path) {
                alert("Esse anexo não tem 'path' salvo.");
                return;
            }

            const { data, error } = await supabase.storage
                .from(BUCKET_ANEXOS)
                .download(anexo.path);

            if (error) throw error;

            const blobUrl = URL.createObjectURL(data);
            const a = document.createElement("a");
            a.href = blobUrl;
            a.download = anexo.nome || "arquivo";
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(blobUrl);
        } catch (err) {
            alert("Falha ao baixar: " + err.message);
        }
    };

    // ---------- Subtarefas (criação) ----------
    const addSubCriacao = () => {
        if (!subCriacaoTexto.trim()) return;
        setSubCriacaoLista((prev) => [
            ...prev,
            { id: Date.now(), texto: subCriacaoTexto.trim(), concluida: false },
        ]);
        setSubCriacaoTexto("");
    };

    const removerSubCriacao = (subId) => {
        setSubCriacaoLista((prev) => prev.filter((s) => s.id !== subId));
    };

    // ---------- Links (criação) ----------
    const addLinkCriacao = () => {
        if (!novoLink.trim()) return;
        const url = novoLink.trim();
        setLinksCriacao((prev) => [...prev, { nome: "Link Externo", url, tipo: "url" }]);
        setNovoLink("");
    };

    const removerLinkCriacao = (idx) => {
        setLinksCriacao((prev) => prev.filter((_, i) => i !== idx));
    };

    // ---------- Uploads (criação) ----------
    const onSelecionarArquivosCriacao = (files) => {
        const arr = Array.from(files || []);
        if (!arr.length) return;
        setArquivosUpload((prev) => [...prev, ...arr]);
    };

    const removerArquivoCriacao = (idx) => {
        setArquivosUpload((prev) => prev.filter((_, i) => i !== idx));
    };

    const resetForm = () => {
        setNovaTarefa("");
        setNotas("");
        setMostrarOpcoes(false);
        setCategoria("Geral");
        setPrioridade("1");
        setDataVencimento(new Date().toISOString().split("T")[0]);
        setRecorrente(false);
        setLembrete(false);
        setLembreteHora("09:00");
        setNovoLink("");
        setLinksCriacao([]);
        setArquivosUpload([]);
        setMostrarSubCriacao(false);
        setSubCriacaoTexto("");
        setSubCriacaoLista([]);
    };

    const adicionarTarefa = async (e) => {
        if (e) e.preventDefault();
        if (!novaTarefa.trim()) return;

        setLoading(true);
        try {
            let anexosIniciais = [];

            // Links múltiplos
            if (linksCriacao.length > 0) anexosIniciais.push(...linksCriacao);

            // Upload múltiplo
            if (arquivosUpload.length > 0) {
                for (const f of arquivosUpload) {
                    const res = await uploadParaStorage(f);
                    anexosIniciais.push(res);
                }
            }

            const payload = {
                texto: novaTarefa.trim(),
                concluida: false,
                concluida_em: null,
                user_id: user.id,
                categoria,
                prioridade: parseInt(prioridade),
                data_vencimento: dataVencimento,
                notas,
                recorrente,
                lembrete,
                lembrete_hora: lembrete ? lembreteHora : null,
                anexos: anexosIniciais,
                subtarefas: subCriacaoLista,
            };

            const { data, error } = await supabase.from("tarefas").insert([payload]).select();
            if (error) throw error;

            if (data?.[0]) {
                setTarefas((prev) => [data[0], ...prev]);
                resetForm();
            }
        } catch (err) {
            alert("Falha ao criar: " + err.message);
        }
        setLoading(false);
    };

    // ---------- Edição ----------
    const iniciarEdicao = (tarefa) => {
        setEditandoId(tarefa.id);
        setEditandoCampos({ ...tarefa });
        setEditNovoUrl("");
        setEditNovosArquivos([]);
        setEditSubTexto("");
    };

    const salvarEdicao = async (id) => {
        setLoading(true);
        try {
            const payload = {
                texto: editandoCampos.texto,
                prioridade: parseInt(editandoCampos.prioridade),
                categoria: editandoCampos.categoria,
                data_vencimento: editandoCampos.data_vencimento,
                notas: editandoCampos.notas,
                anexos: editandoCampos.anexos || [],
                subtarefas: editandoCampos.subtarefas || [],
                recorrente: !!editandoCampos.recorrente,
                lembrete: !!editandoCampos.lembrete,
                lembrete_hora: editandoCampos.lembrete
                    ? editandoCampos.lembrete_hora || "09:00"
                    : null,
            };

            const { error } = await supabase.from("tarefas").update(payload).eq("id", id);
            if (error) throw error;

            setTarefas((prev) => prev.map((t) => (t.id === id ? { ...t, ...payload } : t)));
            setEditandoId(null);
        } catch (err) {
            alert(err.message);
        }
        setLoading(false);
    };

    const deletarTarefa = async (id) => {
        if (window.confirm("Apagar esta tarefa permanentemente?")) {
            await supabase.from("tarefas").delete().eq("id", id);
            setTarefas((prev) => prev.filter((t) => t.id !== id));
        }
    };

    // ---------- Concluir tarefa + subtarefas ----------
    const atualizarStatusTarefa = async (tarefa, novoStatus, opts = {}) => {
        const finishSubs = !!opts.finishSubs;

        let subtarefasAtualizadas = tarefa.subtarefas || [];
        if (novoStatus === true && finishSubs && subtarefasAtualizadas.length > 0) {
            subtarefasAtualizadas = subtarefasAtualizadas.map((s) => ({
                ...s,
                concluida: true,
            }));
        }

        const updatePayload = {
            concluida: novoStatus,
            concluida_em: novoStatus ? new Date().toISOString() : null,
            subtarefas: subtarefasAtualizadas,
        };

        const { error } = await supabase.from("tarefas").update(updatePayload).eq("id", tarefa.id);

        if (!error) {
            setTarefas((prev) => prev.map((t) => (t.id === tarefa.id ? { ...t, ...updatePayload } : t)));
        }
    };

    const aoClicarConcluirPrincipal = async (tarefa) => {
        const novoStatus = !tarefa.concluida;

        // Se está desmarcando, desmarca direto
        if (!novoStatus) {
            await atualizarStatusTarefa(tarefa, false);
            return;
        }

        // Se vai concluir e tem subtarefas pendentes -> perguntar
        const subs = tarefa.subtarefas || [];
        const temSubsPendentes = subs.some((s) => !s.concluida);

        if (subs.length > 0 && temSubsPendentes) {
            setConfirmarConclusao({ tarefa });
            return;
        }

        await atualizarStatusTarefa(tarefa, true);
    };

    // ✅ Adicionar subtarefa (campo abaixo do card)
    const adicionarSubtarefaRapida = async (tarefa) => {
        if (!addSubTexto.trim()) return;

        const novaSub = {
            id: Date.now(),
            texto: addSubTexto.trim(),
            concluida: false,
        };

        const subtarefasAtualizadas = [...(tarefa.subtarefas || []), novaSub];

        const { error } = await supabase
            .from("tarefas")
            .update({ subtarefas: subtarefasAtualizadas })
            .eq("id", tarefa.id);

        if (error) {
            alert("Erro ao adicionar subtarefa: " + error.message);
            return;
        }

        setTarefas((prev) =>
            prev.map((t) => (t.id === tarefa.id ? { ...t, subtarefas: subtarefasAtualizadas } : t))
        );

        setAddSubTexto("");
        setAddSubAbertoId(null);
    };

    const toggleSubtarefa = async (tarefa, subId) => {
        const subs = tarefa.subtarefas || [];
        const novas = subs.map((s) => (s.id === subId ? { ...s, concluida: !s.concluida } : s));

        const todasConcluidas = novas.length > 0 && novas.every((s) => s.concluida);

        const updatePayload = {
            subtarefas: novas,
            concluida: todasConcluidas ? true : tarefa.concluida,
            concluida_em: todasConcluidas
                ? tarefa.concluida_em || new Date().toISOString()
                : tarefa.concluida_em,
        };

        if (!todasConcluidas && tarefa.concluida) {
            updatePayload.concluida = false;
            updatePayload.concluida_em = null;
        }

        const { error } = await supabase.from("tarefas").update(updatePayload).eq("id", tarefa.id);

        if (!error) {
            setTarefas((prev) => prev.map((t) => (t.id === tarefa.id ? { ...t, ...updatePayload } : t)));
        }
    };

    // ---------- Anexos na Edição ----------
    const addAnexoUrlEdicao = () => {
        if (!editNovoUrl.trim()) return;
        const novos = [
            ...(editandoCampos.anexos || []),
            { nome: "Link Externo", url: editNovoUrl.trim(), tipo: "url" },
        ];
        setEditandoCampos({ ...editandoCampos, anexos: novos });
        setEditNovoUrl("");
    };

    const onSelecionarArquivosEdicao = (files) => {
        const arr = Array.from(files || []);
        if (!arr.length) return;
        setEditNovosArquivos((prev) => [...prev, ...arr]);
    };

    const removerArquivoEdicaoFila = (idx) => {
        setEditNovosArquivos((prev) => prev.filter((_, i) => i !== idx));
    };

    const addUploadsEdicao = async () => {
        if (!editNovosArquivos.length) return;
        setLoading(true);
        try {
            const anexosNovos = [];
            for (const f of editNovosArquivos) {
                const res = await uploadParaStorage(f);
                anexosNovos.push(res);
            }
            const novos = [...(editandoCampos.anexos || []), ...anexosNovos];
            setEditandoCampos({ ...editandoCampos, anexos: novos });
            setEditNovosArquivos([]);
        } catch (err) {
            alert("Falha no upload: " + err.message);
        }
        setLoading(false);
    };

    // Subtarefas na EDIÇÃO: apagar + adicionar
    const removerSubEdicao = (idx) => {
        const novas = (editandoCampos.subtarefas || []).filter((_, i) => i !== idx);
        setEditandoCampos({ ...editandoCampos, subtarefas: novas });
    };

    const addSubEdicao = () => {
        if (!editSubTexto.trim()) return;
        const novas = [
            ...(editandoCampos.subtarefas || []),
            { id: Date.now(), texto: editSubTexto.trim(), concluida: false },
        ];
        setEditandoCampos({ ...editandoCampos, subtarefas: novas });
        setEditSubTexto("");
    };

    // ---------- Progresso geral ----------
    const progresso = tarefas.length
        ? Math.round((tarefas.filter((t) => t.concluida).length / tarefas.length) * 100)
        : 0;

    // ---------- Filtros + Ordenação ----------
    const categoriasDisponiveis = useMemo(() => {
        const set = new Set(["Geral"]);
        tarefas.forEach((t) => {
            if (t.categoria) set.add(t.categoria);
        });
        return Array.from(set);
    }, [tarefas]);

    const tarefasFiltradas = useMemo(() => {
        let list = [...tarefas];

        if (fStatus === "pendentes") list = list.filter((t) => !t.concluida);
        if (fStatus === "concluidas") list = list.filter((t) => t.concluida);

        if (fPrioridade !== "todas") {
            list = list.filter((t) => String(t.prioridade) === String(fPrioridade));
        }

        if (fCategoria !== "todas") {
            list = list.filter((t) => t.categoria === fCategoria);
        }

        if (fBusca.trim()) {
            const q = fBusca.trim().toLowerCase();
            list = list.filter((t) => (t.texto || "").toLowerCase().includes(q));
        }

        if (ordenacao === "vencimento_asc") {
            list.sort(
                (a, b) => new Date(a.data_vencimento).getTime() - new Date(b.data_vencimento).getTime()
            );
        } else if (ordenacao === "vencimento_desc") {
            list.sort(
                (a, b) => new Date(b.data_vencimento).getTime() - new Date(a.data_vencimento).getTime()
            );
        } else if (ordenacao === "prioridade_desc") {
            list.sort((a, b) => (b.prioridade || 0) - (a.prioridade || 0));
        } else if (ordenacao === "created_desc") {
            list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        }

        return list;
    }, [tarefas, fStatus, fPrioridade, fCategoria, fBusca, ordenacao]);

    // =======================
    // ✅ ESTATÍSTICAS (FIXADAS)
    // =======================
    const rangeStats = useMemo(() => {
        const now = new Date();

        if (periodoStats === "tudo") {
            return { inicio: null, fim: null };
        }

        if (periodoStats === "custom" && statsInicio && statsFim) {
            return {
                inicio: startOfDay(new Date(statsInicio + "T00:00:00")),
                fim: endOfDay(new Date(statsFim + "T00:00:00")),
            };
        }

        let dias = 30;
        if (periodoStats === "7d") dias = 7;
        if (periodoStats === "30d") dias = 30;
        if (periodoStats === "90d") dias = 90;
        if (periodoStats === "1y") dias = 365;

        const inicio = startOfDay(addDays(now, -dias + 1));
        const fim = endOfDay(now);

        return { inicio, fim };
    }, [periodoStats, statsInicio, statsFim]);

    // Base do período: por data de vencimento (mais “real” pra produtividade)
    const tarefasNoPeriodo = useMemo(() => {
        const { inicio, fim } = rangeStats;
        if (!inicio || !fim) return [...tarefas];

        return tarefas.filter((t) => {
            if (!t.data_vencimento) return false;
            const dv = new Date(t.data_vencimento + "T00:00:00");
            return dv >= inicio && dv <= fim;
        });
    }, [tarefas, rangeStats]);

    const concluidasPeriodo = useMemo(
        () => tarefasNoPeriodo.filter((t) => t.concluida).length,
        [tarefasNoPeriodo]
    );

    const pendentesPeriodo = useMemo(
        () => tarefasNoPeriodo.filter((t) => !t.concluida).length,
        [tarefasNoPeriodo]
    );

    const totalPeriodo = useMemo(() => tarefasNoPeriodo.length, [tarefasNoPeriodo]);

    const taxaConclusaoPeriodo = useMemo(() => {
        if (!totalPeriodo) return 0;
        return Math.round((concluidasPeriodo / totalPeriodo) * 100);
    }, [concluidasPeriodo, totalPeriodo]);

    const pendentesAgora = useMemo(() => tarefas.filter((t) => !t.concluida), [tarefas]);

    const concluidasNoPeriodo = useMemo(() => {
        const { inicio, fim } = rangeStats;
        const concluidas = tarefas.filter((t) => t.concluida && t.concluida_em);
        if (!inicio || !fim) return concluidas;
        return concluidas.filter((t) => {
            const dt = new Date(t.concluida_em);
            return dt >= inicio && dt <= fim;
        });
    }, [tarefas, rangeStats]);

    const diarioSeries = useMemo(() => {
        const now = new Date();
        const dias = 7;
        const inicio = startOfDay(addDays(now, -dias + 1));
        const labels = [];
        const values = [];

        for (let i = 0; i < dias; i++) {
            const d = addDays(inicio, i);
            labels.push(d);
            values.push(0);
        }

        concluidasNoPeriodo.forEach((t) => {
            const dt = new Date(t.concluida_em);
            const key = toISODate(dt);
            labels.forEach((ld, idx) => {
                if (toISODate(ld) === key) values[idx] += 1;
            });
        });

        return { labels, values };
    }, [concluidasNoPeriodo]);

    const tarefasProx7Dias = useMemo(() => {
        const now = new Date();
        const inicio = startOfDay(now);
        const fim = endOfDay(addDays(now, 7));
        return tarefas
            .filter((t) => {
                const dv = new Date(t.data_vencimento + "T00:00:00");
                return dv >= inicio && dv <= fim;
            })
            .sort((a, b) => new Date(a.data_vencimento).getTime() - new Date(b.data_vencimento).getTime())
            .slice(0, 10);
    }, [tarefas]);

    const prioridadeCounts = useMemo(() => {
        const base = tarefasNoPeriodo;
        const baixa = base.filter((t) => Number(t.prioridade) === 1).length;
        const media = base.filter((t) => Number(t.prioridade) === 2).length;
        const alta = base.filter((t) => Number(t.prioridade) === 3).length;
        return { baixa, media, alta };
    }, [tarefasNoPeriodo]);

    const prioridadePercents = useMemo(() => {
        const total = totalPeriodo || 1;
        return {
            baixa: Math.round((prioridadeCounts.baixa / total) * 100),
            media: Math.round((prioridadeCounts.media / total) * 100),
            alta: Math.round((prioridadeCounts.alta / total) * 100),
        };
    }, [prioridadeCounts, totalPeriodo]);

    const categoriaCounts = useMemo(() => {
        const map = {};
        tarefasNoPeriodo.forEach((t) => {
            const cat = t.categoria || "Sem categoria";
            map[cat] = (map[cat] || 0) + 1;
        });
        return map;
    }, [tarefasNoPeriodo]);

    // ---------- UI Helpers ----------
    const Badge = ({ children }) => (
        <span className="text-[10px] font-black px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded uppercase tracking-widest text-slate-500">
            {children}
        </span>
    );

    const MiniButton = ({ children, onClick, className = "", title }) => (
        <button
            type="button"
            title={title}
            onClick={onClick}
            className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${className}`}
        >
            {children}
        </button>
    );

    // ---------- Modal ----------
    const ModalConfirmarSubs = ({ open, onClose, tarefa }) => {
        if (!open || !tarefa) return null;

        return (
            <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
                onMouseDown={onClose}
            >
                <div
                    className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4"
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">
                            Subtarefas pendentes
                        </p>
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
                            title="Fechar"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    <p className="text-sm text-slate-600 dark:text-slate-300">
                        Você está concluindo a tarefa principal, mas ainda existem subtarefas pendentes. O que deseja fazer?
                    </p>

                    <div className="space-y-2">
                        <button
                            type="button"
                            onClick={async () => {
                                await atualizarStatusTarefa(tarefa, true, { finishSubs: false });
                                onClose();
                            }}
                            className="w-full p-4 rounded-2xl bg-indigo-600 text-white font-black text-xs uppercase hover:bg-indigo-700"
                        >
                            Concluir mesmo assim (sem finalizar subs)
                        </button>

                        <button
                            type="button"
                            onClick={async () => {
                                await atualizarStatusTarefa(tarefa, true, { finishSubs: true });
                                onClose();
                            }}
                            className="w-full p-4 rounded-2xl bg-slate-900 text-white font-black text-xs uppercase hover:opacity-90"
                        >
                            Finalizar todas as subtarefas e concluir
                        </button>

                        <button
                            type="button"
                            onClick={onClose}
                            className="w-full p-4 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-black text-xs uppercase hover:opacity-90"
                        >
                            Cancelar
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="max-w-6xl mx-auto space-y-6 p-2 pb-24 font-sans text-slate-900 dark:text-slate-100">
            {/* Toggle (To-do / Estatísticas) */}
            <div className="bg-slate-900/90 dark:bg-slate-900 rounded-2xl p-2 flex items-center gap-2 shadow-lg border border-slate-800">
                <button
                    type="button"
                    onClick={() => setAba("todo")}
                    className={`flex-1 py-3 rounded-xl font-black uppercase text-sm transition-all ${aba === "todo"
                            ? "bg-indigo-600 text-white"
                            : "bg-transparent text-slate-200/80 hover:bg-white/5"
                        }`}
                >
                    To do list
                </button>

                <button
                    type="button"
                    onClick={() => setAba("stats")}
                    className={`flex-1 py-3 rounded-xl font-black uppercase text-sm transition-all flex items-center justify-center gap-2 ${aba === "stats"
                            ? "bg-indigo-600 text-white"
                            : "bg-transparent text-slate-200/80 hover:bg-white/5"
                        }`}
                >
                    <BarChart3 size={18} />
                    Estatísticas
                </button>
            </div>

            {/* MODAL CONFIRMA SUBS */}
            <ModalConfirmarSubs
                open={!!confirmarConclusao}
                tarefa={confirmarConclusao?.tarefa}
                onClose={() => setConfirmarConclusao(null)}
            />

            {/* ABA TODO */}
            {aba === "todo" && (
                <>
                    {/* Header de Progresso */}
                    <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 border border-slate-200 dark:border-slate-800 shadow-sm">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-2xl font-black uppercase italic tracking-tighter flex items-center gap-2">
                                Produtividade <Trophy className="text-amber-500" size={24} />
                            </h2>
                            <span className="text-5xl font-black text-indigo-600 italic">{progresso}%</span>
                        </div>

                        <div className="h-4 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-indigo-500 transition-all duration-1000"
                                style={{ width: `${progresso}%` }}
                            />
                        </div>
                    </div>

                    {/* Form de Criação */}
                    <form
                        ref={formRef}
                        onSubmit={adicionarTarefa}
                        className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden transition-all"
                    >
                        <div className="p-4 flex items-center gap-3 relative">
                            <input
                                type="text"
                                placeholder="O que vamos realizar agora?"
                                value={novaTarefa}
                                onFocus={() => setMostrarOpcoes(true)}
                                onChange={(e) => setNovaTarefa(e.target.value)}
                                className="flex-1 bg-transparent p-4 outline-none font-bold text-xl dark:text-white"
                            />

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-12 h-12 rounded-full bg-indigo-600 text-white flex items-center justify-center hover:bg-indigo-700 shadow-md mr-2 shrink-0 active:scale-90 transition-all"
                            >
                                {loading ? <RefreshCw className="animate-spin" size={24} /> : <Plus size={28} />}
                            </button>
                        </div>

                        {mostrarOpcoes && (
                            <div className="px-8 pb-8 space-y-4 animate-in slide-in-from-top-4 duration-300">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-b dark:border-slate-800 pb-6">
                                    <select
                                        value={categoria}
                                        onChange={(e) => setCategoria(e.target.value)}
                                        className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 font-bold text-sm"
                                    >
                                        <option value="Geral">📂 Geral</option>
                                        <option value="Estudo">📚 Estudo</option>
                                    </select>

                                    <select
                                        value={prioridade}
                                        onChange={(e) => setPrioridade(e.target.value)}
                                        className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 font-bold text-sm"
                                    >
                                        <option value="1">Prioridade Baixa</option>
                                        <option value="2">Prioridade Média</option>
                                        <option value="3">Alta 🔥</option>
                                    </select>

                                    <input
                                        type="date"
                                        value={dataVencimento}
                                        onChange={(e) => setDataVencimento(e.target.value)}
                                        className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 font-bold text-sm"
                                    />
                                </div>

                                {/* Recorrente / Lembrete / Subtarefas */}
                                <div className="flex flex-wrap gap-2">
                                    <MiniButton
                                        title="Recorrente"
                                        onClick={() => setRecorrente(!recorrente)}
                                        className={
                                            recorrente
                                                ? "bg-indigo-600 text-white"
                                                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-200"
                                        }
                                    >
                                        🔁 Recorrente
                                    </MiniButton>

                                    <MiniButton
                                        title="Lembrete"
                                        onClick={() => setLembrete(!lembrete)}
                                        className={
                                            lembrete
                                                ? "bg-amber-500 text-white"
                                                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-200"
                                        }
                                    >
                                        🔔 Lembrete
                                    </MiniButton>

                                    <MiniButton
                                        title="Adicionar subtarefas"
                                        onClick={() => setMostrarSubCriacao(!mostrarSubCriacao)}
                                        className={
                                            mostrarSubCriacao
                                                ? "bg-slate-900 text-white"
                                                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-200"
                                        }
                                    >
                                        ➕ Subtarefas
                                    </MiniButton>
                                </div>

                                {lembrete && (
                                    <div className="flex items-center gap-3">
                                        <span className="text-[10px] font-black uppercase text-slate-400">
                                            Hora do lembrete
                                        </span>
                                        <input
                                            type="time"
                                            value={lembreteHora}
                                            onChange={(e) => setLembreteHora(e.target.value)}
                                            className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 text-sm font-bold outline-none"
                                        />
                                    </div>
                                )}

                                {/* Subtarefas na criação */}
                                {mostrarSubCriacao && (
                                    <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                            Subtarefas da nova tarefa
                                        </p>

                                        <div className="flex gap-2">
                                            <input
                                                value={subCriacaoTexto}
                                                onChange={(e) => setSubCriacaoTexto(e.target.value)}
                                                placeholder="Ex: separar material…"
                                                className="flex-1 p-3 rounded-xl bg-white dark:bg-slate-900 text-xs font-bold outline-none border border-transparent focus:border-indigo-500"
                                            />
                                            <button
                                                type="button"
                                                onClick={addSubCriacao}
                                                className="px-4 rounded-xl bg-indigo-600 text-white text-[10px] font-black uppercase hover:bg-indigo-700"
                                            >
                                                Add
                                            </button>
                                        </div>

                                        {subCriacaoLista.length > 0 && (
                                            <div className="space-y-2 max-h-[130px] overflow-y-auto pr-2">
                                                {subCriacaoLista.map((sub) => (
                                                    <div
                                                        key={sub.id}
                                                        className="flex items-center justify-between bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200 dark:border-slate-700"
                                                    >
                                                        <span className="text-xs font-bold truncate">{sub.texto}</span>
                                                        <button
                                                            type="button"
                                                            onClick={() => removerSubCriacao(sub.id)}
                                                            className="text-rose-400 hover:text-rose-600"
                                                            title="Remover"
                                                        >
                                                            <X size={16} />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Links + Uploads */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Links */}
                                    <div className="space-y-2">
                                        <div className="flex gap-2">
                                            <input
                                                type="url"
                                                value={novoLink}
                                                onChange={(e) => setNovoLink(e.target.value)}
                                                placeholder="Adicionar Link URL..."
                                                className="flex-1 p-3 rounded-xl bg-slate-50 dark:bg-slate-800 text-sm font-medium outline-none border border-transparent focus:border-cyan-500"
                                            />
                                            <button
                                                type="button"
                                                onClick={addLinkCriacao}
                                                className="px-4 rounded-xl bg-cyan-600 text-white text-[10px] font-black uppercase hover:bg-cyan-700"
                                            >
                                                Add
                                            </button>
                                        </div>

                                        {linksCriacao.length > 0 && (
                                            <div className="flex flex-wrap gap-2">
                                                {linksCriacao.map((l, idx) => (
                                                    <div
                                                        key={`${l.url}-${idx}`}
                                                        className="flex items-center gap-2 bg-white dark:bg-slate-800 px-3 py-1 rounded-full text-[10px] font-bold border dark:border-slate-700"
                                                    >
                                                        <LinkIcon size={12} className="text-cyan-500" />
                                                        <span className="max-w-[160px] truncate">{l.url}</span>
                                                        <button
                                                            type="button"
                                                            onClick={() => removerLinkCriacao(idx)}
                                                            className="text-rose-400 hover:text-rose-600"
                                                            title="Remover"
                                                        >
                                                            <X size={14} />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Uploads */}
                                    <div className="space-y-2">
                                        <label className="flex items-center gap-3 p-3 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 border-2 border-dashed border-indigo-200 dark:border-indigo-800 cursor-pointer">
                                            <UploadCloud size={18} className="text-indigo-600" />
                                            <span className="text-xs font-bold text-indigo-600 truncate">
                                                {arquivosUpload.length
                                                    ? `${arquivosUpload.length} arquivo(s) selecionado(s)`
                                                    : "Upload de Arquivo(s)"}
                                            </span>
                                            <input
                                                type="file"
                                                multiple
                                                className="hidden"
                                                onChange={(e) => onSelecionarArquivosCriacao(e.target.files)}
                                            />
                                        </label>

                                        {arquivosUpload.length > 0 && (
                                            <div className="flex flex-wrap gap-2">
                                                {arquivosUpload.map((f, idx) => (
                                                    <div
                                                        key={`${f.name}-${idx}`}
                                                        className="flex items-center gap-2 bg-white dark:bg-slate-800 px-3 py-1 rounded-full text-[10px] font-bold border dark:border-slate-700"
                                                    >
                                                        <FileText size={12} className="text-indigo-500" />
                                                        <span className="max-w-[160px] truncate">{f.name}</span>
                                                        <button
                                                            type="button"
                                                            onClick={() => removerArquivoCriacao(idx)}
                                                            className="text-rose-400 hover:text-rose-600"
                                                            title="Remover"
                                                        >
                                                            <X size={14} />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <textarea
                                    value={notas}
                                    onChange={(e) => setNotas(e.target.value)}
                                    placeholder="Notas extras..."
                                    className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border-none outline-none font-medium text-sm min-h-[80px]"
                                />
                            </div>
                        )}
                    </form>

                    {/* Filtros */}
                    <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm p-5">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                            <div className="flex items-center gap-2">
                                <Filter size={18} className="text-indigo-500" />
                                <p className="font-black uppercase tracking-widest text-xs text-slate-500">
                                    Filtros
                                </p>
                            </div>

                            <div className="flex items-center gap-2 w-full md:w-auto">
                                <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 rounded-xl px-3 py-2 flex-1 md:flex-none">
                                    <Search size={16} className="text-slate-400" />
                                    <input
                                        value={fBusca}
                                        onChange={(e) => setFBusca(e.target.value)}
                                        placeholder="Buscar tarefa..."
                                        className="bg-transparent outline-none text-sm font-bold w-full md:w-[220px]"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-4">
                            <select
                                value={fStatus}
                                onChange={(e) => setFStatus(e.target.value)}
                                className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 font-bold text-sm"
                            >
                                <option value="todas">Todas</option>
                                <option value="pendentes">Pendentes</option>
                                <option value="concluidas">Concluídas</option>
                            </select>

                            <select
                                value={fPrioridade}
                                onChange={(e) => setFPrioridade(e.target.value)}
                                className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 font-bold text-sm"
                            >
                                <option value="todas">Todas prioridades</option>
                                <option value="1">Baixa</option>
                                <option value="2">Média</option>
                                <option value="3">Alta</option>
                            </select>

                            <select
                                value={fCategoria}
                                onChange={(e) => setFCategoria(e.target.value)}
                                className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 font-bold text-sm"
                            >
                                <option value="todas">Todas categorias</option>
                                {categoriasDisponiveis.map((c) => (
                                    <option key={c} value={c}>
                                        {c}
                                    </option>
                                ))}
                            </select>

                            <select
                                value={ordenacao}
                                onChange={(e) => setOrdenacao(e.target.value)}
                                className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 font-bold text-sm"
                            >
                                <option value="vencimento_asc">Data ↑</option>
                                <option value="vencimento_desc">Data ↓</option>
                                <option value="prioridade_desc">Prioridade</option>
                                <option value="created_desc">Mais recentes</option>
                            </select>
                        </div>
                    </div>

                    {/* Lista de Tarefas */}
                    <div className="space-y-4">
                        {tarefasFiltradas.map((t) => {
                            const stripeClass = PRIORITY_STRIPE[t.prioridade] || "bg-slate-300";
                            const temSubs = (t.subtarefas || []).length > 0;

                            return (
                                <div
                                    key={t.id}
                                    className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-all relative"
                                >
                                    {/* Faixa esquerda prioridade */}
                                    <div className={`absolute left-0 top-0 bottom-0 w-2 ${stripeClass}`} />

                                    {/* Corpo */}
                                    <div className="p-6 pl-7 flex items-start justify-between gap-4">
                                        <button
                                            type="button"
                                            onClick={() => aoClicarConcluirPrincipal(t)}
                                            className="shrink-0 mt-1"
                                            title="Concluir"
                                        >
                                            {t.concluida ? (
                                                <CheckCircle className="text-emerald-500" size={30} />
                                            ) : (
                                                <Circle className="text-slate-200 dark:text-slate-800" size={30} />
                                            )}
                                        </button>

                                        <div className="flex-1 min-w-0">
                                            {editandoId === t.id ? (
                                                /* ======= EDIT MODE (mantido) ======= */
                                                <div className="space-y-4 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-indigo-500/20">
                                                    <input
                                                        value={editandoCampos.texto || ""}
                                                        onChange={(e) =>
                                                            setEditandoCampos({ ...editandoCampos, texto: e.target.value })
                                                        }
                                                        className="w-full bg-transparent p-2 font-black text-xl border-b-2 border-indigo-500 outline-none"
                                                    />

                                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                                        <select
                                                            value={editandoCampos.categoria || "Geral"}
                                                            onChange={(e) =>
                                                                setEditandoCampos({ ...editandoCampos, categoria: e.target.value })
                                                            }
                                                            className="p-2 rounded-lg bg-white dark:bg-slate-800 text-xs font-bold"
                                                        >
                                                            <option value="Geral">📂 Geral</option>
                                                            <option value="Estudo">📚 Estudo</option>
                                                        </select>

                                                        <select
                                                            value={String(editandoCampos.prioridade || "1")}
                                                            onChange={(e) =>
                                                                setEditandoCampos({
                                                                    ...editandoCampos,
                                                                    prioridade: e.target.value,
                                                                })
                                                            }
                                                            className="p-2 rounded-lg bg-white dark:bg-slate-800 text-xs font-bold"
                                                        >
                                                            <option value="1">Baixa</option>
                                                            <option value="2">Média</option>
                                                            <option value="3">Alta</option>
                                                        </select>

                                                        <input
                                                            type="date"
                                                            value={editandoCampos.data_vencimento || dataVencimento}
                                                            onChange={(e) =>
                                                                setEditandoCampos({
                                                                    ...editandoCampos,
                                                                    data_vencimento: e.target.value,
                                                                })
                                                            }
                                                            className="p-2 rounded-lg bg-white dark:bg-slate-800 text-xs font-bold"
                                                        />
                                                    </div>

                                                    {/* Recorrente / Lembrete + hora */}
                                                    <div className="flex flex-wrap gap-2 items-center">
                                                        <MiniButton
                                                            onClick={() =>
                                                                setEditandoCampos({
                                                                    ...editandoCampos,
                                                                    recorrente: !editandoCampos.recorrente,
                                                                })
                                                            }
                                                            className={
                                                                editandoCampos.recorrente
                                                                    ? "bg-indigo-600 text-white"
                                                                    : "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                                                            }
                                                        >
                                                            🔁 Recorrente
                                                        </MiniButton>

                                                        <MiniButton
                                                            onClick={() =>
                                                                setEditandoCampos({
                                                                    ...editandoCampos,
                                                                    lembrete: !editandoCampos.lembrete,
                                                                })
                                                            }
                                                            className={
                                                                editandoCampos.lembrete
                                                                    ? "bg-amber-500 text-white"
                                                                    : "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                                                            }
                                                        >
                                                            🔔 Lembrete
                                                        </MiniButton>

                                                        {editandoCampos.lembrete && (
                                                            <div className="flex items-center gap-2 ml-1">
                                                                <Bell size={14} className="text-amber-500" />
                                                                <input
                                                                    type="time"
                                                                    value={editandoCampos.lembrete_hora || "09:00"}
                                                                    onChange={(e) =>
                                                                        setEditandoCampos({
                                                                            ...editandoCampos,
                                                                            lembrete_hora: e.target.value,
                                                                        })
                                                                    }
                                                                    className="p-2 rounded-lg bg-white dark:bg-slate-800 text-xs font-bold"
                                                                />
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Subtarefas (apagar só no editar) */}
                                                    <div className="space-y-2">
                                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                                            Subtarefas (editar)
                                                        </p>

                                                        <div className="space-y-2">
                                                            {(editandoCampos.subtarefas || []).map((sub, idx) => (
                                                                <div
                                                                    key={sub.id}
                                                                    className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                                                                >
                                                                    <span className="text-xs font-bold truncate">{sub.texto}</span>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => removerSubEdicao(idx)}
                                                                        className="text-rose-400 hover:text-rose-600"
                                                                        title="Apagar subtarefa"
                                                                    >
                                                                        <X size={16} />
                                                                    </button>
                                                                </div>
                                                            ))}
                                                        </div>

                                                        <div className="flex gap-2 mt-2">
                                                            <input
                                                                value={editSubTexto}
                                                                onChange={(e) => setEditSubTexto(e.target.value)}
                                                                placeholder="Nova subtarefa..."
                                                                className="flex-1 p-3 rounded-xl bg-white dark:bg-slate-900 text-xs font-bold outline-none border border-transparent focus:border-indigo-500"
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={addSubEdicao}
                                                                className="px-4 rounded-xl bg-indigo-600 text-white text-[10px] font-black uppercase hover:bg-indigo-700"
                                                            >
                                                                Add
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* Gerenciar anexos */}
                                                    <div className="space-y-2">
                                                        <p className="text-[10px] font-black text-slate-400 uppercase">
                                                            Gerenciar Anexos
                                                        </p>

                                                        <div className="flex flex-wrap gap-2">
                                                            {(editandoCampos.anexos || []).map((anexo, idx) => (
                                                                <div
                                                                    key={`${anexo.url}-${idx}`}
                                                                    className="flex items-center gap-2 bg-white dark:bg-slate-800 px-3 py-1 rounded-full text-[10px] font-bold border dark:border-slate-700"
                                                                >
                                                                    {anexo.tipo === "upload" ? (
                                                                        <FileText size={12} className="text-indigo-500" />
                                                                    ) : (
                                                                        <LinkIcon size={12} className="text-cyan-500" />
                                                                    )}
                                                                    <span className="max-w-[200px] truncate">
                                                                        {anexo.tipo === "upload" ? anexo.nome : anexo.url}
                                                                    </span>

                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            const novos = (editandoCampos.anexos || []).filter(
                                                                                (_, i) => i !== idx
                                                                            );
                                                                            setEditandoCampos({ ...editandoCampos, anexos: novos });
                                                                        }}
                                                                        className="text-rose-400 hover:text-rose-600"
                                                                        title="Remover"
                                                                    >
                                                                        <X size={14} />
                                                                    </button>
                                                                </div>
                                                            ))}
                                                        </div>

                                                        {/* Adicionar URL */}
                                                        <div className="flex gap-2 mt-2">
                                                            <input
                                                                type="url"
                                                                value={editNovoUrl}
                                                                onChange={(e) => setEditNovoUrl(e.target.value)}
                                                                placeholder="Adicionar URL..."
                                                                className="flex-1 p-3 rounded-xl bg-white dark:bg-slate-800 text-xs font-bold outline-none border border-transparent focus:border-cyan-500"
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={addAnexoUrlEdicao}
                                                                className="px-4 rounded-xl bg-cyan-600 text-white text-[10px] font-black uppercase hover:bg-cyan-700"
                                                            >
                                                                Add
                                                            </button>
                                                        </div>

                                                        {/* Uploads edição */}
                                                        <div className="mt-2 space-y-2">
                                                            <label className="flex items-center gap-3 p-3 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 border-2 border-dashed border-indigo-200 dark:border-indigo-800 cursor-pointer">
                                                                <UploadCloud size={18} className="text-indigo-600" />
                                                                <span className="text-xs font-bold text-indigo-600 truncate">
                                                                    {editNovosArquivos.length
                                                                        ? `${editNovosArquivos.length} arquivo(s) na fila`
                                                                        : "Adicionar Upload(s)"}
                                                                </span>
                                                                <input
                                                                    type="file"
                                                                    multiple
                                                                    className="hidden"
                                                                    onChange={(e) => onSelecionarArquivosEdicao(e.target.files)}
                                                                />
                                                            </label>

                                                            {editNovosArquivos.length > 0 && (
                                                                <div className="flex flex-wrap gap-2">
                                                                    {editNovosArquivos.map((f, idx) => (
                                                                        <div
                                                                            key={`${f.name}-${idx}`}
                                                                            className="flex items-center gap-2 bg-white dark:bg-slate-800 px-3 py-1 rounded-full text-[10px] font-bold border dark:border-slate-700"
                                                                        >
                                                                            <FileText size={12} className="text-indigo-500" />
                                                                            <span className="max-w-[160px] truncate">{f.name}</span>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => removerArquivoEdicaoFila(idx)}
                                                                                className="text-rose-400 hover:text-rose-600"
                                                                                title="Remover da fila"
                                                                            >
                                                                                <X size={14} />
                                                                            </button>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}

                                                            <button
                                                                type="button"
                                                                onClick={addUploadsEdicao}
                                                                disabled={!editNovosArquivos.length}
                                                                className={`w-full p-3 rounded-xl text-[10px] font-black uppercase transition-all ${editNovosArquivos.length
                                                                        ? "bg-indigo-600 text-white hover:bg-indigo-700"
                                                                        : "bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed"
                                                                    }`}
                                                            >
                                                                Adicionar uploads na tarefa
                                                            </button>
                                                        </div>
                                                    </div>

                                                    <textarea
                                                        value={editandoCampos.notas || ""}
                                                        onChange={(e) =>
                                                            setEditandoCampos({ ...editandoCampos, notas: e.target.value })
                                                        }
                                                        className="w-full p-4 bg-white dark:bg-slate-800 rounded-2xl text-xs font-bold outline-none"
                                                        placeholder="Notas..."
                                                    />

                                                    <div className="flex justify-end gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => setEditandoId(null)}
                                                            className="text-[10px] font-black uppercase text-slate-400 p-2"
                                                        >
                                                            Sair
                                                        </button>

                                                        <button
                                                            type="button"
                                                            onClick={() => salvarEdicao(t.id)}
                                                            className="bg-indigo-600 text-white px-6 py-3 rounded-2xl text-xs font-black uppercase hover:bg-indigo-700"
                                                        >
                                                            Salvar alterações
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                /* ======= VIEW MODE ======= */
                                                <div
                                                    onClick={() => setExpandida(expandida === t.id ? null : t.id)}
                                                    className="cursor-pointer"
                                                >
                                                    <div className="flex items-start justify-between gap-3">
                                                        <h3
                                                            className={`text-xl font-black truncate dark:text-white ${t.concluida ? "line-through opacity-40" : ""
                                                                }`}
                                                        >
                                                            {t.texto}
                                                        </h3>
                                                    </div>

                                                    <div className="flex gap-4 mt-2 items-center flex-wrap">
                                                        <Badge>{t.categoria}</Badge>

                                                        <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                                                            <Calendar size={12} />{" "}
                                                            {new Date(t.data_vencimento).toLocaleDateString()}
                                                        </span>

                                                        {t.anexos?.length > 0 && (
                                                            <span className="text-[10px] font-bold text-indigo-500 flex items-center gap-1">
                                                                <Paperclip size={12} /> {t.anexos.length} anexo(s)
                                                            </span>
                                                        )}

                                                        {(t.lembrete || t.recorrente) && (
                                                            <span className="text-[10px] font-bold text-slate-500 flex items-center gap-2">
                                                                {t.recorrente && (
                                                                    <span className="px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-300 font-black">
                                                                        🔁 recorrente
                                                                    </span>
                                                                )}
                                                                {t.lembrete && (
                                                                    <span className="px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-900/10 text-amber-600 dark:text-amber-300 font-black">
                                                                        🔔 {t.lembrete_hora || "—"}
                                                                    </span>
                                                                )}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Preview subtarefas */}
                                            {expandida !== t.id && editandoId !== t.id && temSubs && (
                                                <div
                                                    className="mt-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 p-3"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                                                        Subtarefas
                                                    </p>

                                                    <div className="max-h-[96px] overflow-y-auto pr-2 space-y-2">
                                                        {(t.subtarefas || []).map((sub) => (
                                                            <div key={sub.id} className="flex items-center gap-2">
                                                                <span className="shrink-0">
                                                                    {sub.concluida ? (
                                                                        <CheckCircle size={16} className="text-emerald-500" />
                                                                    ) : (
                                                                        <Circle size={16} className="text-slate-300" />
                                                                    )}
                                                                </span>

                                                                <span
                                                                    className={`text-xs font-bold truncate ${sub.concluida
                                                                            ? "line-through text-slate-400"
                                                                            : "text-slate-700 dark:text-slate-200"
                                                                        }`}
                                                                >
                                                                    {sub.texto}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Botões direita */}
                                        {editandoId !== t.id && (
                                            <div className="flex items-center gap-2 mt-1">
                                                {/* ✅ BOTÃO SUBTAREFA (ABRE A CAIXA DE BAIXO) */}
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setAddSubAbertoId(addSubAbertoId === t.id ? null : t.id);
                                                        setAddSubTexto("");
                                                    }}
                                                    className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                                                    title="Adicionar subtarefa"
                                                >
                                                    <ListTree size={20} />
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={() => iniciarEdicao(t)}
                                                    className="p-2 text-slate-300 hover:text-amber-500 transition-colors"
                                                    title="Editar"
                                                >
                                                    <Edit3 size={20} />
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={() => deletarTarefa(t.id)}
                                                    className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                                                    title="Apagar"
                                                >
                                                    <Trash2 size={20} />
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Expansão de Detalhes */}
                                    {expandida === t.id && editandoId !== t.id && (
                                        <div className="px-7 pb-8 pt-2 space-y-6 animate-in slide-in-from-top-2 duration-300">
                                            {/* Anexos */}
                                            {t.anexos?.length > 0 && (
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                    {t.anexos.map((anexo, idx) => (
                                                        <div
                                                            key={`${anexo.url}-${idx}`}
                                                            className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border dark:border-slate-800"
                                                        >
                                                            <div className="flex items-center gap-3 min-w-0">
                                                                {anexo.tipo === "upload" ? (
                                                                    <FileText className="text-indigo-500 shrink-0" size={20} />
                                                                ) : (
                                                                    <LinkIcon className="text-cyan-500 shrink-0" size={20} />
                                                                )}
                                                                <div className="truncate">
                                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">
                                                                        {anexo.tipo === "upload" ? "Arquivo" : "URL Externa"}
                                                                    </p>
                                                                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">
                                                                        {anexo.tipo === "upload" ? anexo.nome : anexo.url}
                                                                    </p>
                                                                </div>
                                                            </div>

                                                            {anexo.tipo === "url" ? (
                                                                <a
                                                                    href={anexo.url}
                                                                    target="_blank"
                                                                    rel="noreferrer"
                                                                    className="p-2 bg-white dark:bg-slate-700 rounded-xl shadow-sm hover:scale-110 transition-transform"
                                                                    title="Abrir Link"
                                                                >
                                                                    <ExternalLink size={16} className="text-cyan-600" />
                                                                </a>
                                                            ) : (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => baixarUpload(anexo)}
                                                                    className="p-2 bg-white dark:bg-slate-700 rounded-xl shadow-sm hover:scale-110 transition-transform"
                                                                    title="Baixar arquivo"
                                                                >
                                                                    <Download size={16} className="text-indigo-600" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Notas */}
                                            {t.notas && (
                                                <div className="p-4 bg-amber-50 dark:bg-amber-900/10 border-l-4 border-amber-400 text-sm italic text-slate-600 dark:text-slate-300 rounded-r-2xl">
                                                    "{t.notas}"
                                                </div>
                                            )}

                                            {/* Subtarefas */}
                                            {temSubs && (
                                                <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 p-4 space-y-3">
                                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                                        Subtarefas
                                                    </p>

                                                    <div className="space-y-2">
                                                        {(t.subtarefas || []).map((sub) => (
                                                            <div key={sub.id} className="flex items-center justify-between">
                                                                <div className="flex items-center gap-3">
                                                                    <button type="button" onClick={() => toggleSubtarefa(t, sub.id)}>
                                                                        {sub.concluida ? (
                                                                            <CheckCircle size={18} className="text-emerald-500" />
                                                                        ) : (
                                                                            <Circle size={18} className="text-slate-300" />
                                                                        )}
                                                                    </button>

                                                                    <span
                                                                        className={`text-sm font-bold ${sub.concluida
                                                                                ? "line-through text-slate-400"
                                                                                : "text-slate-700 dark:text-slate-200"
                                                                            }`}
                                                                    >
                                                                        {sub.texto}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>

                                                    <p className="text-[10px] font-bold text-slate-400">
                                                        * Para apagar subtarefas, clique em{" "}
                                                        <span className="font-black text-indigo-500">Editar</span>.
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* ✅ Campo de adicionar subtarefa embaixo de TUDO */}
                                    {addSubAbertoId === t.id && editandoId !== t.id && (
                                        <div className="px-7 pb-6" onClick={(e) => e.stopPropagation()}>
                                            <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 p-4 space-y-3">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                                    Adicionar subtarefa
                                                </p>

                                                <div className="flex gap-2">
                                                    <input
                                                        value={addSubTexto}
                                                        onChange={(e) => setAddSubTexto(e.target.value)}
                                                        placeholder="Digite a subtarefa..."
                                                        className="flex-1 p-3 rounded-xl bg-white dark:bg-slate-900 text-xs font-bold outline-none border border-transparent focus:border-indigo-500"
                                                    />

                                                    <button
                                                        type="button"
                                                        onClick={() => adicionarSubtarefaRapida(t)}
                                                        className="px-4 rounded-xl bg-indigo-600 text-white text-[10px] font-black uppercase hover:bg-indigo-700"
                                                    >
                                                        Add
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setAddSubAbertoId(null);
                                                            setAddSubTexto("");
                                                        }}
                                                        className="px-4 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-200 text-[10px] font-black uppercase hover:opacity-80"
                                                    >
                                                        Fechar
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {tarefasFiltradas.length === 0 && (
                            <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm p-10 text-center">
                                <p className="text-sm font-black uppercase tracking-widest text-slate-400">
                                    Nenhuma tarefa encontrada
                                </p>
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* ABA STATS */}
            {aba === "stats" && (
                <div className="space-y-5">
                    {/* Seletor de período */}
                    <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm p-5 space-y-3">
                        <div className="flex items-center justify-between flex-wrap gap-3">
                            <div className="flex items-center gap-2">
                                <BarChart3 size={18} className="text-indigo-500" />
                                <p className="font-black uppercase tracking-widest text-xs text-slate-500">
                                    Estatísticas reais
                                </p>
                            </div>

                            <div className="flex flex-wrap gap-2 items-center">
                                <select
                                    value={periodoStats}
                                    onChange={(e) => setPeriodoStats(e.target.value)}
                                    className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 font-bold text-sm"
                                >
                                    <option value="7d">Últimos 7 dias</option>
                                    <option value="30d">Últimos 30 dias</option>
                                    <option value="90d">Últimos 90 dias</option>
                                    <option value="1y">Último ano</option>
                                    <option value="tudo">Tudo</option>
                                    <option value="custom">Personalizado</option>
                                </select>

                                {periodoStats === "custom" && (
                                    <div className="flex gap-2">
                                        <input
                                            type="date"
                                            value={statsInicio}
                                            onChange={(e) => setStatsInicio(e.target.value)}
                                            className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 font-bold text-sm"
                                        />
                                        <input
                                            type="date"
                                            value={statsFim}
                                            onChange={(e) => setStatsFim(e.target.value)}
                                            className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 font-bold text-sm"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        <p className="text-xs font-bold text-slate-500 dark:text-slate-300">
                            Concluídas no período (por data de conclusão):{" "}
                            <span className="text-indigo-600 font-black">{concluidasNoPeriodo.length}</span>
                        </p>
                    </div>

                    {/* Cards: Concluídas / Pendentes */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm p-8">
                            <p className="text-sm font-black text-slate-500 dark:text-slate-300">
                                Tarefas Concluídas (total)
                            </p>
                            <p className="text-5xl font-black text-slate-900 dark:text-white mt-4">
                                {tarefas.filter((t) => t.concluida).length}
                            </p>
                        </div>

                        <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm p-8">
                            <p className="text-sm font-black text-slate-500 dark:text-slate-300">
                                Tarefas Pendentes (total)
                            </p>
                            <p className="text-5xl font-black text-slate-900 dark:text-white mt-4">
                                {pendentesAgora.length}
                            </p>
                        </div>
                    </div>

                    {/* Gráfico conclusão diária */}
                    <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm p-6">
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-sm font-black text-slate-500 dark:text-slate-300">
                                Conclusão de tarefa diária (últimos 7 dias)
                            </p>
                        </div>

                        <div className="h-44 flex items-end gap-3 px-2">
                            {diarioSeries.values.every((v) => v === 0) ? (
                                <div className="w-full h-full flex items-center justify-center text-slate-400 font-bold">
                                    Sem dados de conclusão
                                </div>
                            ) : (
                                diarioSeries.values.map((v, idx) => (
                                    <div key={idx} className="flex-1 flex flex-col items-center gap-2">
                                        <div
                                            className="w-full rounded-xl bg-indigo-500/80"
                                            style={{ height: `${Math.max(8, v * 18)}px` }}
                                            title={`${v} concluída(s)`}
                                        />
                                        <span className="text-[10px] font-black text-slate-400">
                                            {new Date(diarioSeries.labels[idx]).toLocaleDateString("pt-BR", {
                                                weekday: "short",
                                            })}
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Próximos 7 dias */}
                    <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm p-6">
                        <p className="text-sm font-black text-slate-500 dark:text-slate-300 mb-3">
                            Tarefas nos próximos 7 dias
                        </p>

                        {tarefasProx7Dias.length === 0 ? (
                            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                                <p className="text-sm font-bold text-slate-400">Nenhuma tarefa prevista 🎉</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {tarefasProx7Dias.map((t) => (
                                    <div
                                        key={t.id}
                                        className="flex items-center justify-between gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700"
                                    >
                                        <div className="min-w-0">
                                            <p className="text-sm font-black truncate text-slate-800 dark:text-white">
                                                {t.texto}
                                            </p>

                                            <div className="flex items-center gap-3 mt-1">
                                                <span className="text-[10px] font-black px-2 py-0.5 bg-slate-200/70 dark:bg-slate-700 rounded uppercase tracking-widest text-slate-600 dark:text-slate-200">
                                                    {t.categoria}
                                                </span>

                                                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-300 flex items-center gap-1">
                                                    <Calendar size={12} />
                                                    {new Date(t.data_vencimento).toLocaleDateString()}
                                                </span>

                                                {!!t.anexos?.length && (
                                                    <span className="text-[10px] font-bold text-indigo-500 flex items-center gap-1">
                                                        <Paperclip size={12} />
                                                        {t.anexos.length}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Resumo período */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm p-6">
                            <p className="text-xs font-black uppercase tracking-widest text-slate-400">
                                Concluídas no período
                            </p>
                            <p className="text-4xl font-black mt-2 text-emerald-500">{concluidasPeriodo}</p>
                            <p className="text-xs font-bold text-slate-400 mt-1">tarefas finalizadas</p>
                        </div>

                        <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm p-6">
                            <p className="text-xs font-black uppercase tracking-widest text-slate-400">
                                Pendentes no período
                            </p>
                            <p className="text-4xl font-black mt-2 text-indigo-600">{pendentesPeriodo}</p>
                            <p className="text-xs font-bold text-slate-400 mt-1">tarefas abertas</p>
                        </div>
                    </div>

                    {/* Taxa conclusão */}
                    <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm p-6">
                        <div className="flex items-center justify-between mb-4">
                            <p className="text-sm font-black text-slate-500 dark:text-slate-300">
                                Taxa de conclusão no período
                            </p>
                            <span className="text-xl font-black text-indigo-600">{taxaConclusaoPeriodo}%</span>
                        </div>

                        <div className="flex items-center gap-6">
                            <div
                                className="w-20 h-20 rounded-full"
                                style={{
                                    background: `conic-gradient(#6366F1 ${taxaConclusaoPeriodo}%, #E5E7EB 0)`,
                                }}
                            />

                            <div className="flex-1 space-y-2">
                                <div className="flex items-center justify-between text-xs font-bold">
                                    <span className="text-slate-400">Concluídas</span>
                                    <span className="text-emerald-500">{concluidasPeriodo}</span>
                                </div>
                                <div className="flex items-center justify-between text-xs font-bold">
                                    <span className="text-slate-400">Total no período</span>
                                    <span className="text-slate-700 dark:text-slate-200">{totalPeriodo}</span>
                                </div>

                                <div className="h-3 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mt-2">
                                    <div
                                        className="h-full bg-indigo-500 transition-all"
                                        style={{ width: `${taxaConclusaoPeriodo}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Distribuição por prioridade */}
                    <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm p-6">
                        <p className="text-sm font-black text-slate-500 dark:text-slate-300 mb-4">
                            Distribuição por prioridade
                        </p>

                        <div className="space-y-3">
                            <div className="space-y-1">
                                <div className="flex items-center justify-between text-xs font-black">
                                    <span className="text-emerald-600">Prioridade 1</span>
                                    <span className="text-slate-500 dark:text-slate-300">{prioridadeCounts.baixa}</span>
                                </div>
                                <div className="h-3 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-emerald-500 transition-all"
                                        style={{ width: `${prioridadePercents.baixa}%` }}
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <div className="flex items-center justify-between text-xs font-black">
                                    <span className="text-amber-600">Prioridade 2</span>
                                    <span className="text-slate-500 dark:text-slate-300">{prioridadeCounts.media}</span>
                                </div>
                                <div className="h-3 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-amber-500 transition-all"
                                        style={{ width: `${prioridadePercents.media}%` }}
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <div className="flex items-center justify-between text-xs font-black">
                                    <span className="text-rose-600">Prioridade 3</span>
                                    <span className="text-slate-500 dark:text-slate-300">{prioridadeCounts.alta}</span>
                                </div>
                                <div className="h-3 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-rose-500 transition-all"
                                        style={{ width: `${prioridadePercents.alta}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Categorias */}
                    <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm p-6">
                        <p className="text-sm font-black text-slate-500 dark:text-slate-300 mb-4">
                            Contextos mais usados
                        </p>

                        {Object.keys(categoriaCounts).length === 0 ? (
                            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                                <p className="text-sm font-bold text-slate-400">Ainda sem dados suficientes 😄</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {Object.entries(categoriaCounts).map(([cat, qtd]) => (
                                    <div
                                        key={cat}
                                        className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700"
                                    >
                                        <span className="text-xs font-black text-slate-700 dark:text-slate-200 truncate">
                                            {cat}
                                        </span>
                                        <span className="text-xs font-black text-indigo-600">{qtd}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default GerenciadorTarefas;
