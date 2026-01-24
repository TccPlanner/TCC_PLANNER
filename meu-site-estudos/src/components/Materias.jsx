// Materias.jsx
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import {
    Plus,
    ChevronRight,
    ArrowLeft,
    Trash2,
    Save,
    Clock,
    BookOpen,
} from "lucide-react";

/* ==========================
   Helpers
========================== */
const formatarHMS = (segundos) => {
    const s = Math.max(0, Number(segundos || 0));
    const h = String(Math.floor(s / 3600)).padStart(2, "0");
    const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
    const sec = String(s % 60).padStart(2, "0");
    return `${h}h ${m}m ${sec}s`;
};

const coresPreset = [
    "#ef4444", // vermelho
    "#3b82f6", // azul
    "#22c55e", // verde
    "#facc15", // amarelo
    "#a855f7", // roxo
    "#fb923c", // laranja
    "#94a3b8", // cinza
    "#ec4899", // rosa
];

function Materias({ user }) {
    const [loading, setLoading] = useState(true);

    // lista
    const [materias, setMaterias] = useState([]);

    // detalhes
    const [materiaSelecionada, setMateriaSelecionada] = useState(null);
    const [editNome, setEditNome] = useState("");
    const [editCor, setEditCor] = useState("#ec4899");

    // conteudos
    const [conteudos, setConteudos] = useState([]);
    const [novoConteudo, setNovoConteudo] = useState("");

    // historico
    const [historico, setHistorico] = useState([]);
    const [verHistorico, setVerHistorico] = useState(true);

    /* ==========================
       Buscar lista de matérias
    ========================== */
    const buscarMaterias = async () => {
        if (!user?.id) return;
        setLoading(true);

        // matérias
        const { data: mats, error: errM } = await supabase
            .from("materias")
            .select("*")
            .eq("user_id", user.id)
            .order("nome", { ascending: true });

        if (errM) {
            console.log("Erro matérias:", errM.message);
            setLoading(false);
            return;
        }

        // sessões (para somar tempo)
        const { data: sessoes, error: errS } = await supabase
            .from("sessoes_estudo")
            .select("materia, duracao_segundos")
            .eq("user_id", user.id);

        if (errS) console.log("Erro sessões:", errS.message);

        // conteúdos (para contar por matéria)
        const { data: conts, error: errC } = await supabase
            .from("materia_conteudos")
            .select("materia_id")
            .eq("user_id", user.id);

        if (errC) console.log("Erro conteudos:", errC.message);

        const somaTempoPorMateria = {};
        (sessoes || []).forEach((s) => {
            const key = (s.materia || "").trim();
            if (!key) return;
            somaTempoPorMateria[key] =
                (somaTempoPorMateria[key] || 0) + (Number(s.duracao_segundos) || 0);
        });

        const countConteudosPorMateriaId = {};
        (conts || []).forEach((c) => {
            countConteudosPorMateriaId[c.materia_id] =
                (countConteudosPorMateriaId[c.materia_id] || 0) + 1;
        });

        const matsEnriquecidas = (mats || []).map((m) => ({
            ...m,
            totalSegundos: somaTempoPorMateria[m.nome] || 0,
            totalConteudos: countConteudosPorMateriaId[m.id] || 0,
        }));

        setMaterias(matsEnriquecidas);
        setLoading(false);
    };

    useEffect(() => {
        buscarMaterias();
        // eslint-disable-next-line
    }, [user?.id]);

    /* ==========================
       Abrir matéria
    ========================== */
    const abrirMateria = async (mat) => {
        setMateriaSelecionada(mat);
        setEditNome(mat.nome);
        setEditCor(mat.cor_hex || "#ec4899");
        setNovoConteudo("");
        setConteudos([]);
        setHistorico([]);
        setVerHistorico(true);

        // conteúdos
        const { data: conts } = await supabase
            .from("materia_conteudos")
            .select("*")
            .eq("user_id", user.id)
            .eq("materia_id", mat.id)
            .order("created_at", { ascending: true });

        setConteudos(conts || []);

        // histórico (sessões)
        const { data: hist } = await supabase
            .from("sessoes_estudo")
            .select("*")
            .eq("user_id", user.id)
            .eq("materia", mat.nome)
            .order("inicio_em", { ascending: false })
            .limit(100);

        setHistorico(hist || []);
    };

    const voltarLista = () => {
        setMateriaSelecionada(null);
        setEditNome("");
        setEditCor("#ec4899");
        setConteudos([]);
        setHistorico([]);
    };

    /* ==========================
       Salvar edição da matéria
    ========================== */
    const salvarMateria = async () => {
        if (!materiaSelecionada?.id) return;
        const nomeNovo = editNome.trim();
        if (!nomeNovo) return;

        // ✅ atualiza nome/cor
        const { error } = await supabase
            .from("materias")
            .update({ nome: nomeNovo, cor_hex: editCor })
            .eq("id", materiaSelecionada.id);

        if (error) {
            alert("Erro ao salvar matéria: " + error.message);
            return;
        }

        // ✅ se mudou o nome, atualizar sessões antigas (pra manter tudo conectado)
        if (nomeNovo !== materiaSelecionada.nome) {
            await supabase
                .from("sessoes_estudo")
                .update({ materia: nomeNovo })
                .eq("user_id", user.id)
                .eq("materia", materiaSelecionada.nome);
        }

        await buscarMaterias();

        // reabrir já atualizado
        abrirMateria({
            ...materiaSelecionada,
            nome: nomeNovo,
            cor_hex: editCor,
        });
    };

    /* ==========================
       Adicionar conteúdo
    ========================== */
    const adicionarConteudo = async () => {
        if (!materiaSelecionada?.id) return;
        const t = novoConteudo.trim();
        if (!t) return;

        const { error } = await supabase
            .from("materia_conteudos")
            .upsert(
                [
                    {
                        user_id: user.id,
                        materia_id: materiaSelecionada.id,
                        titulo: t,
                    },
                ],
                { onConflict: "materia_id,titulo" }
            );

        if (error) {
            alert("Erro ao adicionar conteúdo: " + error.message);
            return;
        }

        setNovoConteudo("");

        // recarrega conteúdos
        const { data: conts } = await supabase
            .from("materia_conteudos")
            .select("*")
            .eq("user_id", user.id)
            .eq("materia_id", materiaSelecionada.id)
            .order("created_at", { ascending: true });

        setConteudos(conts || []);
        buscarMaterias();
    };

    /* ==========================
       Excluir histórico da matéria
    ========================== */
    const excluirHistorico = async () => {
        if (!materiaSelecionada?.nome) return;

        const ok = window.confirm(
            "Excluir TODO o histórico dessa matéria? (isso apaga as sessões salvas)"
        );
        if (!ok) return;

        const { error } = await supabase
            .from("sessoes_estudo")
            .delete()
            .eq("user_id", user.id)
            .eq("materia", materiaSelecionada.nome);

        if (error) {
            alert("Erro ao excluir histórico: " + error.message);
            return;
        }

        abrirMateria(materiaSelecionada);
        buscarMaterias();
    };

    /* ==========================
       Excluir matéria
    ========================== */
    const excluirMateria = async () => {
        if (!materiaSelecionada?.id) return;

        const ok = window.confirm("Excluir essa matéria e TODOS os conteúdos dela?");
        if (!ok) return;

        const { error } = await supabase
            .from("materias")
            .delete()
            .eq("id", materiaSelecionada.id);

        if (error) {
            alert("Erro ao excluir matéria: " + error.message);
            return;
        }

        voltarLista();
        buscarMaterias();
    };

    const totalTempoSelecionado = useMemo(() => {
        if (!materiaSelecionada) return 0;
        const mat = materias.find((m) => m.id === materiaSelecionada.id);
        return mat?.totalSegundos || 0;
    }, [materiaSelecionada, materias]);

    /* ==========================
       UI
    ========================== */
    if (loading) {
        return (
            <div className="p-10 rounded-[32px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl">
                <p className="text-slate-500 dark:text-slate-400 animate-pulse font-bold">
                    Carregando matérias...
                </p>
            </div>
        );
    }

    // =============================
    // TELA LISTA (igual imagem 1)
    // =============================
    if (!materiaSelecionada) {
        return (
            <div className="w-full max-w-3xl mx-auto">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 dark:text-white">
                            Matérias
                        </h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Tudo que você estudou (tempo total + conteúdos)
                        </p>
                    </div>
                </div>

                {materias.length === 0 ? (
                    <div className="p-10 rounded-[32px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl text-center">
                        <p className="font-black text-slate-700 dark:text-slate-200">
                            Nenhuma matéria ainda.
                        </p>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                            Comece registrando uma sessão em “Estudar Agora”.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {materias.map((m) => (
                            <button
                                key={m.id}
                                onClick={() => abrirMateria(m)}
                                className="w-full flex items-center justify-between p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition"
                            >
                                <div className="flex items-center gap-4 text-left">
                                    <div
                                        className="w-3 h-14 rounded-full"
                                        style={{ backgroundColor: m.cor_hex || "#ec4899" }}
                                    />
                                    <div>
                                        <p className="text-base font-black text-slate-900 dark:text-white">
                                            {m.nome}
                                        </p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 font-bold">
                                            {m.totalConteudos || 0} conteúdos
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 text-right">
                                    <p className="text-sm font-black text-slate-700 dark:text-slate-200">
                                        {formatarHMS(m.totalSegundos)}
                                    </p>
                                    <ChevronRight className="text-slate-400" />
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    // =============================
    // TELA EDITAR (igual imagem 2/3)
    // =============================
    return (
        <div className="w-full max-w-3xl mx-auto">
            {/* top */}
            <div className="flex items-center justify-between mb-6">
                <button
                    onClick={voltarLista}
                    className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition font-black text-xs"
                >
                    <ArrowLeft size={16} /> Voltar
                </button>

                <button
                    onClick={salvarMateria}
                    className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white transition font-black text-xs"
                >
                    <Save size={16} /> Salvar
                </button>
            </div>

            {/* card editar */}
            <div className="p-6 rounded-[32px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl">
                <h3 className="text-xl font-black text-slate-900 dark:text-white">
                    Editar matéria
                </h3>

                {/* nome */}
                <div className="mt-6">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                        Nome
                    </label>
                    <input
                        value={editNome}
                        onChange={(e) => setEditNome(e.target.value)}
                        className="mt-2 w-full px-4 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-bold outline-none"
                        placeholder="Nome da matéria"
                    />
                </div>

                {/* cor */}
                <div className="mt-6">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                        Cor da matéria
                    </label>

                    <div className="mt-3 flex items-center gap-4">
                        {/* preview */}
                        <div
                            className="w-20 h-20 rounded-full border-4 border-white dark:border-slate-900 shadow"
                            style={{ backgroundColor: editCor }}
                        />

                        {/* presets + seletor */}
                        <div className="flex flex-wrap gap-2">
                            {coresPreset.map((c) => (
                                <button
                                    key={c}
                                    onClick={() => setEditCor(c)}
                                    className={`w-9 h-9 rounded-full border-2 transition ${editCor === c
                                            ? "border-white shadow-[0_0_0_4px_rgba(99,102,241,0.35)]"
                                            : "border-slate-200 dark:border-slate-700"
                                        }`}
                                    style={{ backgroundColor: c }}
                                    title={c}
                                />
                            ))}

                            <div className="flex items-center gap-2 ml-2">
                                <input
                                    type="color"
                                    value={editCor}
                                    onChange={(e) => setEditCor(e.target.value)}
                                    className="w-12 h-12 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-transparent"
                                    title="Escolher cor"
                                />
                                <span className="text-xs font-black text-slate-500 dark:text-slate-400">
                                    {editCor.toUpperCase()}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* resumo */}
                <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-200 font-black text-xs uppercase">
                            <Clock size={16} /> Tempo total
                        </div>
                        <p className="mt-2 font-black text-lg text-slate-900 dark:text-white">
                            {formatarHMS(totalTempoSelecionado)}
                        </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-200 font-black text-xs uppercase">
                            <BookOpen size={16} /> Conteúdos
                        </div>
                        <p className="mt-2 font-black text-lg text-slate-900 dark:text-white">
                            {conteudos.length}
                        </p>
                    </div>

                    <button
                        onClick={excluirMateria}
                        className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-900/30 border border-rose-100 dark:border-rose-900/40 hover:opacity-90 transition text-left"
                    >
                        <div className="flex items-center gap-2 text-rose-700 dark:text-rose-200 font-black text-xs uppercase">
                            <Trash2 size={16} /> Excluir matéria
                        </div>
                        <p className="mt-2 text-xs text-rose-700/80 dark:text-rose-200/80 font-bold">
                            Apaga a matéria e os conteúdos.
                        </p>
                    </button>
                </div>

                {/* conteúdos */}
                <div className="mt-8">
                    <div className="flex items-center justify-between">
                        <h4 className="font-black uppercase text-xs tracking-widest text-slate-500 dark:text-slate-400">
                            Conteúdos
                        </h4>

                        <button
                            onClick={adicionarConteudo}
                            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs transition"
                        >
                            <Plus size={16} /> Adicionar
                        </button>
                    </div>

                    <div className="mt-3 flex gap-2">
                        <input
                            value={novoConteudo}
                            onChange={(e) => setNovoConteudo(e.target.value)}
                            className="flex-1 px-4 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-bold outline-none"
                            placeholder="Ex: Objetivos da auditoria"
                        />
                    </div>

                    <div className="mt-4 space-y-2">
                        {conteudos.length === 0 ? (
                            <p className="text-sm text-slate-500 dark:text-slate-400 font-bold">
                                Ainda sem conteúdos. Ao salvar no cronômetro, ele também adiciona aqui.
                            </p>
                        ) : (
                            conteudos.map((c) => (
                                <div
                                    key={c.id}
                                    className="flex items-center justify-between p-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                                >
                                    <div className="flex items-center gap-3">
                                        <div
                                            className="w-2 h-10 rounded-full"
                                            style={{ backgroundColor: editCor }}
                                        />
                                        <p className="font-black text-sm text-slate-900 dark:text-white">
                                            {c.titulo}
                                        </p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* histórico */}
                <div className="mt-8">
                    <div className="flex items-center justify-between">
                        <h4 className="font-black uppercase text-xs tracking-widest text-slate-500 dark:text-slate-400">
                            Histórico
                        </h4>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setVerHistorico((v) => !v)}
                                className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 font-black text-xs transition"
                            >
                                {verHistorico ? "Ocultar" : "Mostrar"}
                            </button>

                            <button
                                onClick={excluirHistorico}
                                className="px-3 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-black text-xs transition"
                            >
                                Excluir histórico
                            </button>
                        </div>
                    </div>

                    {verHistorico && (
                        <div className="mt-4 space-y-2 max-h-[320px] overflow-auto pr-2">
                            {historico.length === 0 ? (
                                <p className="text-sm text-slate-500 dark:text-slate-400 font-bold">
                                    Sem histórico ainda.
                                </p>
                            ) : (
                                historico.map((h) => {
                                    const data = h.inicio_em
                                        ? new Date(h.inicio_em).toLocaleString("pt-BR")
                                        : "Sem data";

                                    return (
                                        <div
                                            key={h.id}
                                            className="p-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                                        >
                                            <div className="flex items-center justify-between">
                                                <p className="font-black text-sm text-slate-900 dark:text-white">
                                                    {h.conteudo || "(sem conteúdo)"}
                                                </p>
                                                <p className="text-xs font-black text-slate-500 dark:text-slate-400">
                                                    {h.duracao_hms || formatarHMS(h.duracao_segundos)}
                                                </p>
                                            </div>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-bold">
                                                {data} • {h.tipo_estudo}
                                            </p>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default Materias;
