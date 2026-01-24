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

/* ==========================
   ✅ NOVO: cor base pelo texto
========================== */
const corBasePorTexto = (texto) => {
    const str = String(texto || "").trim().toLowerCase();
    if (!str) return `hsl(220 85% 55%)`;

    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }

    const hue = Math.abs(hash) % 360;
    return `hsl(${hue} 85% 55%)`;
};

/* ==========================
   ✅ TIPOS VÁLIDOS (sem "Geral")
========================== */
const TIPOS_VALIDOS = ["Teoria", "Exercícios", "Simulado", "Revisão"];

/* ✅ label mais amigável */
const labelTipoConteudo = (tipo) => {
    const t = String(tipo || "").trim();
    if (!t || !TIPOS_VALIDOS.includes(t)) return "Teoria";
    if (t === "Exercícios") return "Questões";
    return t;
};

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
       ✅ NOVO: múltiplos conteúdos expandidos
    ========================== */
    const [conteudosExpandidos, setConteudosExpandidos] = useState([]); // array de IDs

    const toggleExpandirConteudo = (conteudoId) => {
        setConteudosExpandidos((prev) => {
            const exists = prev.includes(conteudoId);
            if (exists) return prev.filter((id) => id !== conteudoId); // fecha só este
            return [...prev, conteudoId]; // abre este sem fechar os outros
        });
    };

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

        // ✅ reseta os expandidos ao entrar na matéria
        setConteudosExpandidos([]);

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
        setConteudosExpandidos([]);
    };

    /* ==========================
       Salvar edição da matéria
    ========================== */
    const salvarMateria = async () => {
        if (!materiaSelecionada?.id) return;
        const nomeNovo = editNome.trim();
        if (!nomeNovo) return;

        // ✅ Se tentar renomear para uma que já existe
        const jaExiste = materias.find(
            (m) =>
                m.id !== materiaSelecionada.id &&
                (m.nome || "").trim().toLowerCase() === nomeNovo.toLowerCase()
        );

        if (jaExiste) {
            const querTransferir = window.confirm(
                `Já existe uma matéria chamada "${nomeNovo}".\n\nDeseja transferir conteúdos e histórico dessa matéria para a já existente?`
            );

            if (!querTransferir) {
                alert("Já existe uma matéria com esse nome.");
                return;
            }

            await transferirParaMateriaExistente({
                materiaOrigem: materiaSelecionada,
                materiaDestino: jaExiste,
                nomeDestino: nomeNovo,
            });

            voltarLista();
            buscarMaterias();
            return;
        }

        const { error } = await supabase
            .from("materias")
            .update({ nome: nomeNovo, cor_hex: editCor })
            .eq("id", materiaSelecionada.id);

        if (error) {
            alert("Erro ao salvar matéria: " + error.message);
            return;
        }

        if (nomeNovo !== materiaSelecionada.nome) {
            await supabase
                .from("sessoes_estudo")
                .update({ materia: nomeNovo })
                .eq("user_id", user.id)
                .eq("materia", materiaSelecionada.nome);
        }

        await buscarMaterias();

        abrirMateria({
            ...materiaSelecionada,
            nome: nomeNovo,
            cor_hex: editCor,
        });
    };

    const transferirParaMateriaExistente = async ({
        materiaOrigem,
        materiaDestino,
        nomeDestino,
    }) => {
        if (!materiaOrigem?.id || !materiaDestino?.id) return;

        const { data: contsOrigem, error: errCO } = await supabase
            .from("materia_conteudos")
            .select("*")
            .eq("user_id", user.id)
            .eq("materia_id", materiaOrigem.id);

        if (errCO) {
            alert("Erro ao buscar conteúdos da matéria antiga: " + errCO.message);
            return;
        }

        if (contsOrigem?.length) {
            const payload = contsOrigem.map((c) => ({
                user_id: user.id,
                materia_id: materiaDestino.id,
                titulo: c.titulo,
            }));

            const { error: errUp } = await supabase
                .from("materia_conteudos")
                .upsert(payload, { onConflict: "materia_id,titulo" });

            if (errUp) {
                alert("Erro ao transferir conteúdos: " + errUp.message);
                return;
            }
        }

        const { error: errDelOldCont } = await supabase
            .from("materia_conteudos")
            .delete()
            .eq("user_id", user.id)
            .eq("materia_id", materiaOrigem.id);

        if (errDelOldCont) {
            alert("Erro ao limpar conteúdos antigos: " + errDelOldCont.message);
            return;
        }

        const { error: errSess } = await supabase
            .from("sessoes_estudo")
            .update({ materia: nomeDestino })
            .eq("user_id", user.id)
            .eq("materia", materiaOrigem.nome);

        if (errSess) {
            alert("Erro ao transferir histórico: " + errSess.message);
            return;
        }

        const { error: errCor } = await supabase
            .from("materias")
            .update({ cor_hex: editCor })
            .eq("id", materiaDestino.id);

        if (errCor) {
            console.log("Aviso: não foi possível transferir cor:", errCor.message);
        }

        const { error: errDelMat } = await supabase
            .from("materias")
            .delete()
            .eq("id", materiaOrigem.id);

        if (errDelMat) {
            alert("Erro ao apagar matéria antiga: " + errDelMat.message);
            return;
        }

        alert("Transferência concluída ✅");
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
       ✅ Excluir conteúdo
       - Se for o ÚLTIMO conteúdo, confirma e também exclui a matéria
    ========================== */
    const excluirConteudo = async (conteudo) => {
        if (!conteudo?.id) return;

        const vaiApagarMateriaTambem = conteudos.length === 1;

        const ok = window.confirm(
            vaiApagarMateriaTambem
                ? `Este é o ÚLTIMO conteúdo da matéria.\n\nSe você excluir "${conteudo.titulo}", a matéria "${materiaSelecionada?.nome}" também será excluída.\n\nDeseja continuar?`
                : `Excluir o conteúdo "${conteudo.titulo}"?`
        );

        if (!ok) return;

        const { error: errDelConteudo } = await supabase
            .from("materia_conteudos")
            .delete()
            .eq("id", conteudo.id);

        if (errDelConteudo) {
            alert("Erro ao excluir conteúdo: " + errDelConteudo.message);
            return;
        }

        if (vaiApagarMateriaTambem && materiaSelecionada?.id) {
            const { error: errDelMat } = await supabase
                .from("materias")
                .delete()
                .eq("id", materiaSelecionada.id);

            if (errDelMat) {
                alert(
                    "O conteúdo foi excluído, mas deu erro ao excluir a matéria: " +
                    errDelMat.message
                );
                return;
            }

            alert("Conteúdo excluído ✅\nMatéria excluída também (não havia mais conteúdos).");

            voltarLista();
            buscarMaterias();
            return;
        }

        // fecha o painel se o conteúdo estava expandido
        setConteudosExpandidos((prev) => prev.filter((id) => id !== conteudo.id));

        const { data: conts, error: errLoad } = await supabase
            .from("materia_conteudos")
            .select("*")
            .eq("user_id", user.id)
            .eq("materia_id", materiaSelecionada.id)
            .order("created_at", { ascending: true });

        if (!errLoad) {
            setConteudos(conts || []);
        }

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
       tipo mais recente por conteúdo
    ========================== */
    const tipoMaisRecentePorConteudo = useMemo(() => {
        const map = {};
        (historico || []).forEach((h) => {
            const titulo = (h.conteudo || "").trim();
            if (!titulo) return;

            if (!map[titulo]) {
                const tipo = (h.tipo_estudo || "").trim();
                map[titulo] = TIPOS_VALIDOS.includes(tipo) ? tipo : "Teoria";
            }
        });
        return map;
    }, [historico]);

    /* ==========================
       ✅ mapa de cores ÚNICAS dentro da matéria
    ========================== */
    const mapaCoresConteudos = useMemo(() => {
        const used = new Set();
        const map = {};

        const titulos = (conteudos || [])
            .map((c) => String(c.titulo || "").trim())
            .filter(Boolean);

        titulos.forEach((titulo) => {
            let cor = corBasePorTexto(titulo);

            const match = String(cor).match(/hsl\((\d+)\s/i);
            let hue = match ? Number(match[1]) : 220;

            let key = `hsl(${hue})`;

            let tentativas = 0;
            while (used.has(key) && tentativas < 40) {
                hue = (hue + 29) % 360;
                key = `hsl(${hue})`;
                tentativas += 1;
            }

            used.add(key);
            map[titulo] = `hsl(${hue} 85% 55%)`;
        });

        return map;
    }, [conteudos]);

    const getCorDoConteudo = (titulo) => {
        const t = String(titulo || "").trim();
        return mapaCoresConteudos[t] || corBasePorTexto(t);
    };

    /* ==========================
       ✅ stats por conteúdo (mapa)
       - otimiza: calcula 1x e cada painel pega só o que precisa
    ========================== */
    const statsPorConteudoTitulo = useMemo(() => {
        const map = {};

        const historicoOrdenado = [...(historico || [])]; // já vem desc

        historicoOrdenado.forEach((s) => {
            const titulo = (s.conteudo || "").trim();
            if (!titulo) return;

            if (!map[titulo]) {
                map[titulo] = {
                    ultimaData: s.inicio_em
                        ? new Date(s.inicio_em).toLocaleString("pt-BR")
                        : null,
                    tipoRecenteRaw: (s.tipo_estudo || "").trim(),
                    feitas: 0,
                    acertos: 0,
                    erros: 0,
                };
            }

            map[titulo].feitas += Number(s.questoes_feitas) || 0;
            map[titulo].acertos += Number(s.questoes_acertos) || 0;
            map[titulo].erros += Number(s.questoes_erros) || 0;
        });

        // pós-processamento
        Object.keys(map).forEach((titulo) => {
            const item = map[titulo];

            const tipoRaw =
                item.tipoRecenteRaw ||
                tipoMaisRecentePorConteudo[titulo] ||
                "Teoria";

            const tipoRecente = TIPOS_VALIDOS.includes(tipoRaw) ? tipoRaw : "Teoria";
            const tipoLabel = labelTipoConteudo(tipoRecente);

            const temQuestoes =
                item.feitas > 0 || item.acertos > 0 || item.erros > 0;

            const precisao =
                item.feitas > 0 ? Math.round((item.acertos / item.feitas) * 100) : 0;

            const tipoEhQuestoesOuSimulado =
                tipoLabel === "Questões" || tipoLabel === "Simulado";

            map[titulo] = {
                ...item,
                tipoRecente,
                tipoLabel,
                temQuestoes,
                precisao,
                tipoEhQuestoesOuSimulado,
            };
        });

        return map;
    }, [historico, tipoMaisRecentePorConteudo]);

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
    // TELA LISTA
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
    // TELA EDITAR
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
                        <div
                            className="w-20 h-20 rounded-full border-4 border-white dark:border-slate-900 shadow"
                            style={{ backgroundColor: editCor }}
                        />

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
                            placeholder="Ex: Objetivos"
                        />
                    </div>

                    <div className="mt-4 space-y-2">
                        {conteudos.length === 0 ? (
                            <p className="text-sm text-slate-500 dark:text-slate-400 font-bold">
                                Ainda sem conteúdos. Ao salvar no cronômetro, ele também adiciona aqui.
                            </p>
                        ) : (
                            conteudos.map((c) => {
                                const corConteudo = getCorDoConteudo(c.titulo);

                                const tipoRaw = tipoMaisRecentePorConteudo[c.titulo] || "Teoria";
                                const tipoLabel = labelTipoConteudo(tipoRaw);

                                const expanded = conteudosExpandidos.includes(c.id);
                                const stats = statsPorConteudoTitulo[c.titulo?.trim?.() || ""] || null;

                                return (
                                    <div key={c.id} className="space-y-2">
                                        {/* CARD DO CONTEÚDO */}
                                        <button
                                            onClick={() => toggleExpandirConteudo(c.id)}
                                            className={`w-full flex items-center justify-between p-3 rounded-2xl border transition text-left
                                                ${expanded
                                                    ? "border-indigo-400/60 bg-indigo-50/40 dark:bg-indigo-900/10"
                                                    : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-900/40"
                                                }`}
                                        >
                                            <div className="flex items-start gap-3">
                                                <div
                                                    className="w-2 h-10 rounded-full"
                                                    style={{ backgroundColor: corConteudo }}
                                                />

                                                <div>
                                                    <p className="font-black text-sm text-slate-900 dark:text-white">
                                                        {c.titulo}
                                                    </p>

                                                    {/* TAG neutra */}
                                                    <span
                                                        className="inline-flex mt-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest border
                                                        bg-slate-100 text-slate-600 border-slate-200
                                                        dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700"
                                                    >
                                                        {tipoLabel}
                                                    </span>
                                                </div>
                                            </div>

                                            <ChevronRight className="text-slate-400" />
                                        </button>

                                        {/* ✅ EXPANDIDO LOGO ABAIXO DO ITEM */}
                                        {expanded && (
                                            <div className="p-4 rounded-3xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div>
                                                        <p className="font-black text-base text-slate-900 dark:text-white">
                                                            {c.titulo}
                                                        </p>

                                                        <div className="mt-1 flex flex-wrap gap-2 items-center">
                                                            <span
                                                                className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest border
                                                                bg-slate-100 text-slate-600 border-slate-200
                                                                dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700"
                                                            >
                                                                {stats?.tipoLabel || tipoLabel}
                                                            </span>

                                                            {!!stats?.ultimaData && (
                                                                <span className="text-xs text-slate-500 dark:text-slate-300 font-bold">
                                                                    Última sessão: {stats.ultimaData}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <button
                                                        onClick={() => excluirConteudo(c)}
                                                        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-black text-xs transition"
                                                    >
                                                        <Trash2 size={16} /> Excluir
                                                    </button>
                                                </div>

                                                {/* Stats SOMENTE Questões/Simulado */}
                                                {!!stats?.tipoEhQuestoesOuSimulado && (
                                                    <>
                                                        {stats.temQuestoes ? (
                                                            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2">
                                                                <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                                                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                                                        Feitas
                                                                    </p>
                                                                    <p className="font-black text-lg text-slate-900 dark:text-white">
                                                                        {stats.feitas}
                                                                    </p>
                                                                </div>

                                                                <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                                                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                                                        Acertos
                                                                    </p>
                                                                    <p className="font-black text-lg text-slate-900 dark:text-white">
                                                                        {stats.acertos}
                                                                    </p>
                                                                </div>

                                                                <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                                                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                                                        Erros
                                                                    </p>
                                                                    <p className="font-black text-lg text-slate-900 dark:text-white">
                                                                        {stats.erros}
                                                                    </p>
                                                                </div>

                                                                <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                                                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                                                        Precisão
                                                                    </p>
                                                                    <p className="font-black text-lg text-slate-900 dark:text-white">
                                                                        {stats.precisao}%
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <p className="mt-3 text-xs text-slate-500 dark:text-slate-300 font-bold">
                                                                Nenhuma estatística registrada ainda neste conteúdo.
                                                            </p>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })
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

                                    const tipoLabel = labelTipoConteudo(h.tipo_estudo);

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
                                                {data} • {tipoLabel}
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
