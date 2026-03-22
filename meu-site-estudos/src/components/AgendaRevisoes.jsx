import React, { useEffect, useState, useMemo } from "react";
import { supabase } from "../supabaseClient";
import {
    Plus,
    Trash2,
    Target,
    BookOpen,
    BarChart3,
    Eraser,
    ChevronDown,
    ChevronUp,
    CheckCircle,
    Clock,
    Repeat,
} from "lucide-react";

const AgendaRevisoes = ({ user }) => {
    const [abaInterna, setAbaInterna] = useState("revisoes");
    const [view, setView] = useState("semana");
    const [revisoes, setRevisoes] = useState([]);
    const [loading, setLoading] = useState(true);

    const [formAberto, setFormAberto] = useState(false);

    const [dataInicio, setDataInicio] = useState("");
    const [dataFim, setDataFim] = useState("");

    const [filtroStatus, setFiltroStatus] = useState("pendentes");

    const [revisaoParaFinalizar, setRevisaoParaFinalizar] = useState(null);
    const [modalApagarOpen, setModalApagarOpen] = useState(false);

    const [res, setRes] = useState({ feitas: "", acertos: "", erros: "" });

    const [form, setForm] = useState({
        materia: "",
        conteudo: "",
        data: new Date().toISOString().split("T")[0],
        tipo: "Teoria",
        meta: 0,
    });

    useEffect(() => {
        if (user?.id) buscarRevisoes();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id]);

    const buscarRevisoes = async () => {
        setLoading(true);

        const { data, error } = await supabase
            .from("revisoes_agendadas")
            .select("*")
            .eq("user_id", user.id)
            .order("data_revisao", { ascending: true });

        if (!error && data) setRevisoes(data);

        setLoading(false);
    };

    useEffect(() => {
        if (!user?.id) return;

        const ch = supabase
            .channel("revisoes_agendadas_realtime")
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "revisoes_agendadas",
                    filter: `user_id=eq.${user.id}`,
                },
                () => buscarRevisoes()
            )
            .subscribe();

        return () => {
            supabase.removeChannel(ch);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id]);

    const revisoesFiltradas = useMemo(() => {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);

        return revisoes.filter((rev) => {
            const dataRev = new Date(rev.data_revisao + "T12:00:00");

            if (view === "semana") {
                const fim = new Date(hoje);
                fim.setDate(hoje.getDate() + 6);
                return dataRev >= hoje && dataRev <= fim;
            }

            if (view === "mes") {
                return (
                    dataRev.getMonth() === hoje.getMonth() &&
                    dataRev.getFullYear() === hoje.getFullYear()
                );
            }

            if (view === "ano") {
                return dataRev.getFullYear() === hoje.getFullYear();
            }

            if (view === "personalizado") {
                if (!dataInicio || !dataFim) return true;

                const ini = new Date(dataInicio + "T00:00:00");
                const fim = new Date(dataFim + "T23:59:59");
                return dataRev >= ini && dataRev <= fim;
            }

            return true;
        });
    }, [revisoes, view, dataInicio, dataFim]);

    const revisoesFiltradasPorStatus = useMemo(() => {
        return revisoesFiltradas.filter((r) =>
            filtroStatus === "pendentes" ? !r.executada : !!r.executada
        );
    }, [revisoesFiltradas, filtroStatus]);

    const handleSalvarManual = async () => {
        if (!form.materia.trim()) return;

        const { error } = await supabase.from("revisoes_agendadas").insert([
            {
                user_id: user.id,
                titulo: form.materia,
                conteudo: form.conteudo,
                data_revisao: form.data,
                tipo_revisao: form.tipo,
                meta_questoes: Number(form.meta) || 0,
                origem: "Manual",
                executada: false,
            },
        ]);

        if (!error) {
            setForm({
                materia: "",
                conteudo: "",
                data: new Date().toISOString().split("T")[0],
                tipo: "Teoria",
                meta: 0,
            });
            setFormAberto(false);
            buscarRevisoes();
            setFiltroStatus("pendentes");
        }
    };

    const limparTudo = () => {
        setModalApagarOpen(true);
    };

    const executarApagarRevisoes = async (modo) => {
        try {
            if (!user?.id) return;

            let query = supabase
                .from("revisoes_agendadas")
                .delete()
                .eq("user_id", user.id);

            if (modo === "pendentes") query = query.eq("executada", false);
            if (modo === "concluidas") query = query.eq("executada", true);

            const { error } = await query;

            if (error) {
                alert("Erro ao apagar revisões: " + error.message);
                return;
            }

            setModalApagarOpen(false);
            buscarRevisoes();
        } catch (err) {
            alert("Erro inesperado ao apagar revisões.");
            console.error(err);
        }
    };

    const deletarRevisao = async (id) => {
        await supabase.from("revisoes_agendadas").delete().eq("id", id);
        buscarRevisoes();
    };

    const handleFinalizar = async () => {
        if (!revisaoParaFinalizar?.id) return;

        const payload = {
            executada: true,
            qtd_feitas: Number(res.feitas) || 0,
            qtd_acertos: Number(res.acertos) || 0,
            qtd_erros: Number(res.erros) || 0,
        };

        const { data, error } = await supabase
            .from("revisoes_agendadas")
            .update(payload)
            .eq("id", revisaoParaFinalizar.id)
            .select("*")
            .single();

        if (error) {
            console.log("ERRO AO FINALIZAR:", error.message);
            alert("Não consegui marcar como concluída. Veja o console (F12).");
            return;
        }

        setRevisoes((prev) =>
            prev.map((r) => (r.id === data.id ? data : r))
        );

        setRevisaoParaFinalizar(null);
        setRes({ feitas: "", acertos: "", erros: "" });

        setFiltroStatus("concluidas");

        buscarRevisoes();
    };

    const stats = useMemo(() => {
        const total = revisoes.length;
        const concluidas = revisoes.filter((r) => r.executada).length;
        const pendentes = total - concluidas;

        const feitas = revisoes.reduce((acc, r) => acc + (Number(r.qtd_feitas) || 0), 0);
        const acertos = revisoes.reduce(
            (acc, r) => acc + (Number(r.qtd_acertos) || 0),
            0
        );
        const erros = revisoes.reduce((acc, r) => acc + (Number(r.qtd_erros) || 0), 0);

        const precisao = feitas > 0 ? Math.round((acertos / feitas) * 100) : 0;
        const cumprimento = total > 0 ? Math.round((concluidas / total) * 100) : 0;

        const porTipo = {
            Teoria: revisoes.filter((r) => r.tipo_revisao === "Teoria").length,
            Questões: revisoes.filter((r) => r.tipo_revisao === "Questões").length,
            Simulado: revisoes.filter((r) => r.tipo_revisao === "Simulado").length,
        };

        const diasConcluidos = Array.from(
            new Set(
                revisoes
                    .filter((r) => r.executada)
                    .map((r) => r.data_revisao)
                    .sort()
            )
        );

        let streak = 0;
        if (diasConcluidos.length > 0) {
            const hoje = new Date();
            hoje.setHours(0, 0, 0, 0);

            const diasSet = new Set(diasConcluidos);

            for (let i = 0; i < 365; i++) {
                const d = new Date(hoje);
                d.setDate(hoje.getDate() - i);
                const key = d.toISOString().split("T")[0];
                if (diasSet.has(key)) streak++;
                else break;
            }
        }

        return {
            total,
            concluidas,
            pendentes,
            feitas,
            acertos,
            erros,
            precisao,
            cumprimento,
            porTipo,
            streak,
        };
    }, [revisoes]);

    const revisoesAgrupadas = useMemo(() => {
        return Object.entries(
            revisoesFiltradasPorStatus.reduce((acc, r) => {
                const d = r.data_revisao;
                if (!acc[d]) acc[d] = [];
                acc[d].push(r);
                return acc;
            }, {})
        );
    }, [revisoesFiltradasPorStatus]);

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            {/* Header padronizado */}
            <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-600 text-white shadow-sm shadow-cyan-900/20">
                    <Repeat className="h-6 w-6" />
                </div>

                <div>
                    <p className="text-2xl font-black text-white leading-tight">
                        Revisões
                    </p>
                    <p className="text-sm text-cyan-100">
                        Agende, acompanhe e registre seu desempenho nas revisões
                    </p>
                </div>
            </div>

            {/* TABS PRINCIPAIS */}
            <div className="flex bg-slate-200 dark:bg-slate-800 p-1 rounded-2xl shadow-inner">
                <button
                    onClick={() => setAbaInterna("revisoes")}
                    className={`flex-1 py-3 rounded-xl font-black transition-all ${abaInterna === "revisoes"
                            ? "bg-indigo-600 text-white shadow-md"
                            : "text-slate-600"
                        }`}
                >
                    Revisões
                </button>
                <button
                    onClick={() => setAbaInterna("estatisticas")}
                    className={`flex-1 py-3 rounded-xl font-black transition-all ${abaInterna === "estatisticas"
                            ? "bg-indigo-600 text-white shadow-md"
                            : "text-slate-600"
                        }`}
                >
                    Estatísticas
                </button>
            </div>

            {abaInterna === "revisoes" ? (
                <div className="space-y-6">
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex gap-1.5">
                                {["semana", "mes", "ano", "personalizado"].map((f) => (
                                    <button
                                        key={f}
                                        onClick={() => setView(f)}
                                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${view === f
                                                ? "bg-indigo-600 text-white"
                                                : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                                            }`}
                                    >
                                        {f}
                                    </button>
                                ))}
                            </div>

                            <button
                                onClick={limparTudo}
                                className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                            >
                                <Eraser size={18} />
                            </button>
                        </div>

                        {view === "personalizado" && (
                            <div className="grid grid-cols-2 gap-3 pt-2">
                                <input
                                    type="date"
                                    value={dataInicio}
                                    onChange={(e) => setDataInicio(e.target.value)}
                                    className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold dark:text-white outline-none"
                                />
                                <input
                                    type="date"
                                    value={dataFim}
                                    onChange={(e) => setDataFim(e.target.value)}
                                    className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold dark:text-white outline-none"
                                />
                            </div>
                        )}

                        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl">
                            <button
                                onClick={() => setFiltroStatus("pendentes")}
                                className={`flex-1 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${filtroStatus === "pendentes"
                                        ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                                        : "text-slate-500"
                                    }`}
                            >
                                Pendentes
                            </button>
                            <button
                                onClick={() => setFiltroStatus("concluidas")}
                                className={`flex-1 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${filtroStatus === "concluidas"
                                        ? "bg-emerald-600 text-white"
                                        : "text-slate-500"
                                    }`}
                            >
                                Concluídas
                            </button>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 rounded-[28px] border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden transition-all duration-300">
                        <button
                            onClick={() => setFormAberto(!formAberto)}
                            className={`w-full py-4 px-6 flex items-center justify-between font-black transition-all duration-300 active:scale-[0.99]
                ${formAberto
                                    ? "bg-slate-100 dark:bg-slate-800 text-slate-500"
                                    : "bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 text-white shadow-[0_8px_20px_-6px_rgba(79,70,229,0.5)]"
                                }`}
                        >
                            <div className="flex items-center gap-3 uppercase tracking-widest text-[11px]">
                                <div
                                    className={`p-1.5 rounded-lg ${formAberto
                                            ? "bg-slate-200 dark:bg-slate-700"
                                            : "bg-white/20"
                                        }`}
                                >
                                    <Plus
                                        size={18}
                                        className={`transition-transform duration-500 ${formAberto
                                                ? "rotate-45 text-slate-500"
                                                : "text-white"
                                            }`}
                                    />
                                </div>
                                <span>{formAberto ? "Fechar Cadastro" : "Nova Revisão Manual"}</span>
                            </div>

                            <div className="flex items-center gap-2">
                                {formAberto ? (
                                    <ChevronUp size={16} className="opacity-50" />
                                ) : (
                                    <ChevronDown size={16} className="opacity-70 animate-bounce" />
                                )}
                            </div>
                        </button>

                        {formAberto && (
                            <div className="p-6 pt-5 space-y-5 animate-in slide-in-from-top duration-500">
                                <div className="h-px bg-slate-100 dark:bg-slate-800 mx-2"></div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black ml-2 text-slate-400 uppercase tracking-tighter">
                                            Matéria
                                        </label>
                                        <input
                                            placeholder="Matéria..."
                                            value={form.materia}
                                            onChange={(e) =>
                                                setForm({ ...form, materia: e.target.value })
                                            }
                                            className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold outline-none dark:text-white focus:border-indigo-500 transition-all"
                                        />
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black ml-2 text-slate-400 uppercase tracking-tighter">
                                            Conteúdo
                                        </label>
                                        <input
                                            placeholder="Assunto..."
                                            value={form.conteudo}
                                            onChange={(e) =>
                                                setForm({ ...form, conteudo: e.target.value })
                                            }
                                            className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold outline-none dark:text-white focus:border-indigo-500 transition-all"
                                        />
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black ml-2 text-slate-400 uppercase tracking-tighter">
                                            Data
                                        </label>
                                        <input
                                            type="date"
                                            value={form.data}
                                            onChange={(e) => setForm({ ...form, data: e.target.value })}
                                            className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold outline-none dark:text-white cursor-pointer"
                                        />
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black ml-2 text-slate-400 uppercase tracking-tighter">
                                            Tipo de Estudo
                                        </label>
                                        <select
                                            value={form.tipo}
                                            onChange={(e) => setForm({ ...form, tipo: e.target.value })}
                                            className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-black outline-none dark:text-white cursor-pointer"
                                        >
                                            <option value="Teoria">📖 Teoria</option>
                                            <option value="Questões">📝 Exercícios</option>
                                            <option value="Simulado">📊 Simulado</option>
                                        </select>
                                    </div>
                                </div>

                                {(form.tipo === "Questões" || form.tipo === "Simulado") && (
                                    <div className="animate-in zoom-in duration-300">
                                        <label className="text-[9px] font-black ml-2 text-indigo-500 uppercase">
                                            Meta de Questões
                                        </label>
                                        <input
                                            type="number"
                                            placeholder="0"
                                            value={form.meta}
                                            onChange={(e) => setForm({ ...form, meta: e.target.value })}
                                            className="w-full p-3 bg-indigo-50/30 dark:bg-indigo-900/10 rounded-xl border border-indigo-100 dark:border-indigo-900/20 text-xs font-bold outline-none dark:text-white"
                                        />
                                    </div>
                                )}

                                <button
                                    onClick={handleSalvarManual}
                                    className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-2xl shadow-lg transition-all active:scale-[0.98] uppercase text-[11px] tracking-widest"
                                >
                                    Salvar Agendamento
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="space-y-6">
                        {loading ? (
                            <div className="text-center py-10 text-slate-400 font-bold uppercase text-[10px] tracking-widest">
                                Carregando...
                            </div>
                        ) : revisoesFiltradasPorStatus.length === 0 ? (
                            <div className="text-center py-10 text-slate-400 font-bold uppercase text-[10px] tracking-widest">
                                Nenhuma revisão para este período
                            </div>
                        ) : (
                            revisoesAgrupadas.map(([data, itens]) => (
                                <div key={data} className="space-y-4">
                                    <div className="flex items-center gap-3">
                                        <div className="h-[2px] flex-1 bg-slate-100 dark:bg-slate-800/50"></div>
                                        <span className="text-[10px] font-black text-indigo-500 uppercase bg-indigo-50 dark:bg-indigo-950/40 px-3 py-1 rounded-full border border-indigo-100 dark:border-indigo-900/30">
                                            {new Date(data + "T12:00:00").toLocaleDateString("pt-BR", {
                                                weekday: "long",
                                                day: "2-digit",
                                                month: "short",
                                            })}
                                        </span>
                                        <div className="h-[2px] flex-1 bg-slate-100 dark:bg-slate-800/50"></div>
                                    </div>

                                    {itens.map((rev) => (
                                        <div
                                            key={rev.id}
                                            className={`p-4 rounded-3xl border-2 flex items-center justify-between transition-all ${rev.executada
                                                    ? "bg-emerald-50/20 border-emerald-100"
                                                    : "bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 shadow-sm"
                                                }`}
                                        >
                                            <div className="flex items-center gap-4 text-left">
                                                <div
                                                    className={`w-10 h-10 rounded-2xl flex items-center justify-center ${rev.executada
                                                            ? "bg-emerald-500 text-white"
                                                            : "bg-slate-100 dark:bg-slate-800 text-indigo-600"
                                                        }`}
                                                >
                                                    {rev.tipo_revisao?.includes("Quest") ||
                                                        rev.tipo_revisao?.includes("Simulado") ? (
                                                        <Target size={18} />
                                                    ) : (
                                                        <BookOpen size={18} />
                                                    )}
                                                </div>

                                                <div>
                                                    <h4 className="font-black text-xs uppercase dark:text-white leading-tight">
                                                        {rev.titulo}
                                                    </h4>

                                                    <p className="text-[9px] font-bold text-slate-500 uppercase">
                                                        {rev.conteudo} • {rev.tipo_revisao}
                                                    </p>

                                                    {rev.executada && (
                                                        <div className="mt-1 inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full border border-emerald-100">
                                                            <CheckCircle size={12} />
                                                            Concluída
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                {!rev.executada && (
                                                    <button
                                                        onClick={() => setRevisaoParaFinalizar(rev)}
                                                        className="bg-slate-900 dark:bg-white dark:text-slate-900 text-white px-4 py-2 rounded-xl font-black text-[10px] active:scale-95 transition-all"
                                                    >
                                                        REVISEI
                                                    </button>
                                                )}

                                                <button
                                                    onClick={() => {
                                                        if (confirm("Excluir?")) deletarRevisao(rev.id);
                                                    }}
                                                    className="text-slate-300 hover:text-rose-500 p-1"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <CardStat label="TOTAL" value={stats.total} icon={<BarChart3 size={16} />} />
                        <CardStat
                            label="CUMPRIMENTO"
                            value={`${stats.cumprimento}%`}
                            icon={<CheckCircle size={16} />}
                        />
                        <CardStat
                            label="CONCLUÍDAS"
                            value={stats.concluidas}
                            icon={<CheckCircle size={16} />}
                        />
                        <CardStat label="PENDENTES" value={stats.pendentes} icon={<Clock size={16} />} />
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                        <CardStat label="QUESTÕES FEITAS" value={stats.feitas} />
                        <CardStat label="ACERTOS" value={stats.acertos} />
                        <CardStat label="ERROS" value={stats.erros} />
                    </div>

                    <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">
                                Precisão Geral
                            </h3>
                            <span className="text-lg font-black text-emerald-500">
                                {stats.precisao}%
                            </span>
                        </div>

                        <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div
                                className="h-2 bg-emerald-500 rounded-full transition-all"
                                style={{ width: `${stats.precisao}%` }}
                            />
                        </div>

                        <div className="grid grid-cols-3 gap-2 pt-2">
                            <MiniPill label="📖 Teoria" value={stats.porTipo.Teoria} />
                            <MiniPill label="📝 Questões" value={stats.porTipo.Questões} />
                            <MiniPill label="📊 Simulado" value={stats.porTipo.Simulado} />
                        </div>

                        <div className="pt-2">
                            <div className="flex items-center justify-between">
                                <p className="text-[10px] uppercase tracking-widest font-black text-slate-400">
                                    Streak (dias seguidos revisando)
                                </p>
                                <p className="text-xl font-black text-indigo-600">
                                    {stats.streak}
                                </p>
                            </div>
                            <p className="text-[10px] text-slate-500 font-bold mt-1">
                                (Conta apenas dias com revisão concluída ✅)
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {modalApagarOpen && (
                <div className="fixed inset-0 z-[99998] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200/60 dark:border-slate-700/60 p-5">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                                    Apagar revisões
                                </h3>
                                <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                                    Você deseja apagar quais revisões?
                                </p>
                            </div>

                            <button
                                onClick={() => setModalApagarOpen(false)}
                                className="px-2 py-1 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="mt-4 flex flex-col gap-2">
                            <button
                                onClick={() => executarApagarRevisoes("pendentes")}
                                className="w-full rounded-xl px-4 py-3 text-left bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 transition"
                            >
                                <div className="font-medium text-slate-900 dark:text-slate-100">
                                    🟡 Apenas pendentes
                                </div>
                                <div className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                                    Apaga somente as que ainda não foram revisadas.
                                </div>
                            </button>

                            <button
                                onClick={() => executarApagarRevisoes("concluidas")}
                                className="w-full rounded-xl px-4 py-3 text-left bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 transition"
                            >
                                <div className="font-medium text-slate-900 dark:text-slate-100">
                                    ✅ Apenas concluídas
                                </div>
                                <div className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                                    Apaga somente as que já foram marcadas como revisadas.
                                </div>
                            </button>

                            <button
                                onClick={() => executarApagarRevisoes("todas")}
                                className="w-full rounded-xl px-4 py-3 text-left bg-rose-50 hover:bg-rose-100 dark:bg-rose-900/30 dark:hover:bg-rose-900/40 transition"
                            >
                                <div className="font-medium text-rose-700 dark:text-rose-200">
                                    🔥 Todas
                                </div>
                                <div className="text-xs text-rose-700/80 dark:text-rose-200/80 mt-0.5">
                                    Remove pendentes + concluídas.
                                </div>
                            </button>
                        </div>

                        <div className="mt-4 flex justify-end gap-2">
                            <button
                                onClick={() => setModalApagarOpen(false)}
                                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {revisaoParaFinalizar && (
                <div className="fixed inset-0 z-[99999] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[40px] p-8 shadow-2xl border border-slate-200 dark:border-slate-800">
                        <h3 className="text-xl font-black mb-6 uppercase text-center dark:text-white">
                            Registrar Desempenho
                        </h3>

                        <div className="space-y-4">
                            {revisaoParaFinalizar.tipo_revisao?.includes("Quest") ||
                                revisaoParaFinalizar.tipo_revisao?.includes("Simulado") ? (
                                <>
                                    <input
                                        type="number"
                                        placeholder="Questões feitas"
                                        value={res.feitas}
                                        onChange={(e) => setRes({ ...res, feitas: e.target.value })}
                                        className="w-full p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl outline-none font-bold border border-slate-200 dark:border-slate-700 dark:text-white"
                                    />

                                    <div className="grid grid-cols-2 gap-3">
                                        <input
                                            type="number"
                                            placeholder="Acertos"
                                            value={res.acertos}
                                            onChange={(e) => setRes({ ...res, acertos: e.target.value })}
                                            className="p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-2xl outline-none font-bold text-emerald-600 border border-emerald-100"
                                        />
                                        <input
                                            type="number"
                                            placeholder="Erros"
                                            value={res.erros}
                                            onChange={(e) => setRes({ ...res, erros: e.target.value })}
                                            className="p-4 bg-rose-50 dark:bg-rose-900/10 rounded-2xl outline-none font-bold text-rose-500 border border-rose-100"
                                        />
                                    </div>
                                </>
                            ) : (
                                <p className="text-center font-bold text-slate-500 py-4 uppercase text-xs tracking-widest">
                                    Confirmar leitura concluída?
                                </p>
                            )}

                            <button
                                onClick={handleFinalizar}
                                className="w-full bg-indigo-600 text-white py-5 rounded-3xl font-black shadow-lg"
                            >
                                CONCLUIR E SALVAR
                            </button>

                            <button
                                onClick={() => setRevisaoParaFinalizar(null)}
                                className="w-full text-slate-400 font-bold text-[10px] uppercase tracking-widest mt-2"
                            >
                                Sair
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const CardStat = ({ label, value, icon }) => (
    <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 text-center shadow-xl">
        <div className="flex items-center justify-center gap-2 mb-1 text-slate-400">
            {icon}
            <p className="text-[9px] font-black uppercase tracking-tighter">{label}</p>
        </div>
        <p className="text-xl font-black dark:text-white">{value}</p>
    </div>
);

const MiniPill = ({ label, value }) => (
    <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-3 border border-slate-100 dark:border-slate-700 text-center">
        <p className="text-[10px] font-black">{label}</p>
        <p className="text-lg font-black text-indigo-600">{value}</p>
    </div>
);

export default AgendaRevisoes;