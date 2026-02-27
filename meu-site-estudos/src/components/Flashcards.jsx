import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import {
  Brain,
  Sparkles,
  Plus,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Pencil,
  Wand2,
  FolderTree,
} from "lucide-react";

const EMPTY_TREE = {
  courses: [],
  disciplines: [],
  subjects: [],
  topics: [],
  decks: [],
  cards: [],
};

const INITIAL_CREATE = {
  course: "",
  discipline: "",
  subject: "",
  topic: "",
  deck: "",
  pergunta: "",
  resposta: "",
  tags: "",
};

const INITIAL_AI = { text: "", qtd: 10, aggressiveness: "medio" };

const toTags = (value) =>
  String(value || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 10);

async function resolveFunctionError(error, data) {
  if (data?.error) return String(data.error);
  if (error?.context) {
    try {
      const parsed = await error.context.json();
      if (parsed?.error) return String(parsed.error);
    } catch {
      // noop
    }
  }
  return error?.message || "Falha na edge function.";
}

export default function Flashcards({ user }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [createMode, setCreateMode] = useState(false);
  const [showCreatePanel, setShowCreatePanel] = useState(false);

  const [tree, setTree] = useState(EMPTY_TREE);
  const [form, setForm] = useState(INITIAL_CREATE);
  const [aiForm, setAiForm] = useState(INITIAL_AI);

  const [courseId, setCourseId] = useState("");
  const [disciplineId, setDisciplineId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [topicId, setTopicId] = useState("");
  const [deckId, setDeckId] = useState("");

  const selectedDeck = useMemo(() => tree.decks.find((d) => d.id === deckId), [tree.decks, deckId]);

  useEffect(() => {
    if (!user?.id) return;
    loadCourses();
  }, [user?.id]);

  useEffect(() => {
    if (!courseId) {
      setTree((prev) => ({ ...prev, disciplines: [], subjects: [], topics: [], decks: [], cards: [] }));
      return;
    }
    setDisciplineId("");
    setSubjectId("");
    setTopicId("");
    setDeckId("");
    loadDisciplines(courseId);
  }, [courseId]);

  useEffect(() => {
    if (!disciplineId) return;
    setSubjectId("");
    setTopicId("");
    setDeckId("");
    loadSubjects(disciplineId);
  }, [disciplineId]);

  useEffect(() => {
    if (!subjectId) return;
    setTopicId("");
    setDeckId("");
    loadTopics(subjectId);
  }, [subjectId]);

  useEffect(() => {
    if (!topicId) return;
    setDeckId("");
    loadDecks(topicId);
  }, [topicId]);

  useEffect(() => {
    if (!deckId) {
      setTree((prev) => ({ ...prev, cards: [] }));
      return;
    }
    loadCards(deckId);
  }, [deckId]);

  async function selectWithFallback(table, modern, legacy, filters = {}) {
    let query = supabase.from(table).select(modern).eq("user_id", user.id);
    Object.entries(filters).forEach(([k, v]) => {
      query = query.eq(k, v);
    });
    const res = await query.order("created_at", { ascending: false });
    if (!res.error) return res.data || [];

    let legacyQuery = supabase.from(table).select(legacy).eq("user_id", user.id);
    Object.entries(filters).forEach(([k, v]) => {
      legacyQuery = legacyQuery.eq(k, v);
    });
    const legacyRes = await legacyQuery.order("created_at", { ascending: false });
    if (legacyRes.error) throw res.error;
    return legacyRes.data || [];
  }

  async function loadCourses() {
    setLoading(true);
    try {
      const rows = await selectWithFallback("flash_courses", "id,nome", "id,name");
      setTree((prev) => ({
        ...prev,
        courses: rows.map((row) => ({ id: row.id, nome: row.nome || row.name || "" })),
      }));
    } finally {
      setLoading(false);
    }
  }

  async function loadDisciplines(course_id) {
    const rows = await selectWithFallback("flash_disciplines", "id,nome,course_id", "id,name,course_id", {
      course_id,
    });
    setTree((prev) => ({
      ...prev,
      disciplines: rows.map((row) => ({ ...row, nome: row.nome || row.name || "" })),
    }));
  }

  async function loadSubjects(discipline_id) {
    const rows = await supabase
      .from("flash_subjects")
      .select("id,nome,discipline_id")
      .eq("user_id", user.id)
      .eq("discipline_id", discipline_id)
      .order("created_at", { ascending: false });

    if (!rows.error) {
      setTree((prev) => ({ ...prev, subjects: rows.data || [] }));
      return;
    }

    const legacy = await supabase
      .from("flash_topics")
      .select("id,name,discipline_id")
      .eq("user_id", user.id)
      .eq("discipline_id", discipline_id)
      .order("created_at", { ascending: false });

    if (legacy.error) throw rows.error;
    setTree((prev) => ({ ...prev, subjects: (legacy.data || []).map((row) => ({ ...row, nome: row.name })) }));
  }

  async function loadTopics(subject_id) {
    const rows = await supabase
      .from("flash_topics")
      .select("id,name,subject_id")
      .eq("user_id", user.id)
      .eq("subject_id", subject_id)
      .order("created_at", { ascending: false });

    if (rows.error) {
      setTree((prev) => ({ ...prev, topics: [] }));
      return;
    }

    setTree((prev) => ({
      ...prev,
      topics: (rows.data || []).map((row) => ({ id: row.id, nome: row.name })),
    }));
  }

  async function loadDecks(topic_id) {
    const modern = await supabase
      .from("flash_decks")
      .select("id,nome,topic_id,subject_id")
      .eq("user_id", user.id)
      .or(`topic_id.eq.${topic_id},subject_id.eq.${topic_id}`)
      .order("created_at", { ascending: false });

    if (!modern.error) {
      setTree((prev) => ({ ...prev, decks: modern.data || [] }));
      return;
    }

    const legacy = await supabase
      .from("flash_decks")
      .select("id,name,topic_id")
      .eq("user_id", user.id)
      .eq("topic_id", topic_id)
      .order("created_at", { ascending: false });

    if (legacy.error) throw modern.error;
    setTree((prev) => ({ ...prev, decks: (legacy.data || []).map((row) => ({ ...row, nome: row.name })) }));
  }

  async function loadCards(deck_id) {
    const { data } = await supabase
      .from("flash_cards")
      .select("id,pergunta,resposta,tags")
      .eq("user_id", user.id)
      .eq("deck_id", deck_id)
      .order("created_at", { ascending: false });

    setTree((prev) => ({ ...prev, cards: data || [] }));
  }

  async function invokeWrite(action, payload) {
    const { data: auth } = await supabase.auth.getSession();
    const token = auth?.session?.access_token;
    if (!token) throw new Error("Sessão inválida. Faça login novamente.");

    const { data, error } = await supabase.functions.invoke("flashcards-write", {
      body: { action, ...payload },
      headers: { Authorization: `Bearer ${token}` },
    });

    if (error || !data?.ok) {
      const message = await resolveFunctionError(error, data);
      throw new Error(message);
    }

    return data?.data?.id;
  }

  async function createNode(level) {
    const nodeName = form[level].trim();
    if (!nodeName) return alert("Digite um nome válido.");

    const map = {
      course: ["create_course", { nome: nodeName }, loadCourses],
      discipline: ["create_discipline", { nome: nodeName, course_id: courseId }, () => loadDisciplines(courseId)],
      subject: ["create_subject", { nome: nodeName, discipline_id: disciplineId }, () => loadSubjects(disciplineId)],
      topic: ["create_topic", { nome: nodeName, subject_id: subjectId }, () => loadTopics(subjectId)],
      deck: ["create_deck", { nome: nodeName, topic_id: topicId, subject_id: topicId }, () => loadDecks(topicId)],
    };

    const [action, payload, refresh] = map[level] || [];
    if (!action) return;

    setSaving(true);
    try {
      await invokeWrite(action, payload);
      setForm((prev) => ({ ...prev, [level]: "" }));
      await refresh();
    } catch (e) {
      alert(e.message || "Erro ao criar.");
    } finally {
      setSaving(false);
    }
  }

  async function createManualCard() {
    if (!deckId) return alert("Selecione um deck.");
    if (!form.pergunta.trim() || !form.resposta.trim()) {
      return alert("Preencha pergunta e resposta.");
    }

    setSaving(true);
    try {
      await invokeWrite("create_card", {
        deck_id: deckId,
        pergunta: form.pergunta,
        resposta: form.resposta,
        tags: toTags(form.tags),
      });

      setForm((prev) => ({ ...prev, pergunta: "", resposta: "", tags: "" }));
      await loadCards(deckId);
    } catch (e) {
      alert(e.message || "Erro ao criar card.");
    } finally {
      setSaving(false);
    }
  }

  async function createFromErrors() {
    if (!deckId) return;

    const { data: reviews, error } = await supabase
      .from("flash_card_reviews")
      .select("card_id")
      .eq("user_id", user.id)
      .eq("deck_id", deckId)
      .eq("resultado", "errou")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw new Error(error.message);

    const uniqueIds = [...new Set((reviews || []).map((item) => item.card_id).filter(Boolean))];
    if (!uniqueIds.length) throw new Error("Você não tem erros registrados neste deck ainda.");

    const { data: sourceCards, error: sourceError } = await supabase
      .from("flash_cards")
      .select("pergunta,resposta,tags")
      .eq("user_id", user.id)
      .in("id", uniqueIds);

    if (sourceError) throw new Error(sourceError.message);

    let created = 0;
    for (const card of sourceCards || []) {
      const pergunta = String(card.pergunta || "").trim();
      const resposta = String(card.resposta || "").trim();
      if (!pergunta || !resposta) continue;

      await invokeWrite("create_card", {
        deck_id: deckId,
        pergunta: `Revisão de erro: ${pergunta}`,
        resposta,
        tags: [...(card.tags || []), "revisao_erro"],
      });
      created += 1;
    }

    await loadCards(deckId);
    alert(`${created} card(s) de revisão criados.`);
  }

  async function openCreateCards() {
    if (!deckId) return alert("Selecione um deck para criar cards.");
    setShowCreatePanel(true);

    const confirmCreateFromErrors = window.confirm(
      "Você quer criar cards de revisão com base nas questões que você errou?"
    );

    if (!confirmCreateFromErrors) return;

    try {
      setSaving(true);
      await createFromErrors();
    } catch (e) {
      alert(e.message || "Não foi possível criar cards pelos erros.");
    } finally {
      setSaving(false);
    }
  }

  async function generateWithAI() {
    if (!deckId) return alert("Selecione um deck antes de gerar por IA.");
    if (!aiForm.text.trim()) return alert("Cole um texto base para gerar.");

    setAiLoading(true);
    try {
      const { data: auth } = await supabase.auth.getSession();
      const token = auth?.session?.access_token;

      const { data, error } = await supabase.functions.invoke("generate-flashcards", {
        body: {
          text: aiForm.text,
          qtd: Number(aiForm.qtd),
          aggressiveness: aiForm.aggressiveness,
        },
        headers: { Authorization: `Bearer ${token}` },
      });

      if (error || !data?.ok) {
        const message = await resolveFunctionError(error, data);
        throw new Error(message);
      }

      const cards = Array.isArray(data.cards) ? data.cards : [];
      for (const card of cards) {
        const pergunta = String(card?.pergunta || "").trim();
        const resposta = String(card?.resposta || "").trim();
        if (!pergunta || !resposta) continue;

        await invokeWrite("create_card", {
          deck_id: deckId,
          pergunta,
          resposta,
          tags: Array.isArray(card.tags) ? card.tags : [],
        });
      }

      await loadCards(deckId);
      alert("Cards gerados com IA e salvos no deck.");
    } catch (e) {
      alert(e.message || "Erro ao gerar com IA.");
    } finally {
      setAiLoading(false);
    }
  }

  async function registerReview(cardId, resultado) {
    const { error } = await supabase.from("flash_card_reviews").insert({
      user_id: user.id,
      deck_id: deckId,
      card_id: cardId,
      resultado,
    });

    if (error) {
      alert(`Erro ao registrar resultado: ${error.message}`);
      return;
    }

    alert(resultado === "acertou" ? "Boa! Resultado salvo como acerto." : "Registrado como erro para revisão.");
  }

  const resetStepFlow = () => {
    setCourseId("");
    setDisciplineId("");
    setSubjectId("");
    setTopicId("");
    setDeckId("");
    setTree((prev) => ({ ...prev, disciplines: [], subjects: [], topics: [], decks: [], cards: [] }));
  };

  const StepSelect = ({ title, value, setValue, items }) => (
    <div className="space-y-1">
      <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{title}</p>
      <select
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-950"
      >
        <option value="">Selecione</option>
        {items.map((item) => (
          <option key={item.id} value={item.id}>
            {item.nome}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-white dark:bg-slate-900 p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-bold text-lg flex items-center gap-2">
            <FolderTree size={18} className="text-cyan-600" /> Flashcards
          </h2>
          <p className="text-sm text-slate-500">Fluxo simples: Curso → Disciplina → Assunto → Tópico → Deck.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setCreateMode((prev) => !prev)}
            className="px-3 py-2 rounded-lg bg-cyan-600 text-white text-sm flex items-center gap-2"
          >
            <Pencil size={14} /> {createMode ? "Fechar modo criação" : "Modo criação"}
          </button>
          <button onClick={openCreateCards} className="px-3 py-2 rounded-lg border text-sm flex items-center gap-2">
            <Plus size={14} /> Criar cards
          </button>
          <button onClick={resetStepFlow} className="px-3 py-2 rounded-lg border text-sm flex items-center gap-2">
            <RotateCcw size={14} /> Reiniciar
          </button>
        </div>
      </div>

      <div className="rounded-xl border bg-white dark:bg-slate-900 p-4 space-y-3">
        {!courseId && <StepSelect title="1) Cursos" value={courseId} setValue={setCourseId} items={tree.courses} />}
        {courseId && !disciplineId && (
          <StepSelect title="2) Disciplinas" value={disciplineId} setValue={setDisciplineId} items={tree.disciplines} />
        )}
        {disciplineId && !subjectId && (
          <StepSelect title="3) Assuntos" value={subjectId} setValue={setSubjectId} items={tree.subjects} />
        )}
        {subjectId && !topicId && <StepSelect title="4) Tópicos" value={topicId} setValue={setTopicId} items={tree.topics} />}
        {topicId && (
          <StepSelect
            title="5) Decks"
            value={deckId}
            setValue={setDeckId}
            items={tree.decks.map((deck) => ({ ...deck, nome: deck.nome || deck.name || "" }))}
          />
        )}
        {loading && <p className="text-sm text-slate-500">Carregando estrutura...</p>}
      </div>

      {createMode && (
        <div className="rounded-xl border bg-amber-50 dark:bg-amber-950/20 p-4 space-y-2">
          <p className="text-sm font-medium">Criar estrutura (em ordem)</p>
          {[
            ["course", "Novo curso"],
            ["discipline", "Nova disciplina"],
            ["subject", "Novo assunto"],
            ["topic", "Novo tópico"],
            ["deck", "Novo deck"],
          ].map(([key, label]) => (
            <div key={key} className="flex gap-2">
              <input
                value={form[key]}
                onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
                className="flex-1 px-3 py-2 rounded-lg border"
                placeholder={label}
              />
              <button disabled={saving} onClick={() => createNode(key)} className="px-3 py-2 rounded-lg border">
                Criar
              </button>
            </div>
          ))}
        </div>
      )}

      {showCreatePanel && deckId && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-xl border bg-white dark:bg-slate-900 p-4 space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <Brain size={16} /> Criar card manual
            </h3>
            <input
              value={form.pergunta}
              onChange={(e) => setForm((prev) => ({ ...prev, pergunta: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border"
              placeholder="Pergunta"
            />
            <textarea
              value={form.resposta}
              onChange={(e) => setForm((prev) => ({ ...prev, resposta: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border"
              placeholder="Resposta"
            />
            <input
              value={form.tags}
              onChange={(e) => setForm((prev) => ({ ...prev, tags: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border"
              placeholder="Tags separadas por vírgula"
            />
            <button disabled={saving} onClick={createManualCard} className="px-4 py-2 rounded-lg bg-slate-900 text-white">
              {saving ? "Salvando..." : "Salvar card"}
            </button>
          </div>

          <div className="rounded-xl border bg-cyan-50/60 dark:bg-cyan-950/20 p-4 space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <Wand2 size={16} /> Gerar cards com IA
            </h3>
            <textarea
              value={aiForm.text}
              onChange={(e) => setAiForm((prev) => ({ ...prev, text: e.target.value }))}
              className="w-full min-h-[120px] px-3 py-2 rounded-lg border"
              placeholder="Cole o conteúdo base para a IA"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                min="3"
                max="30"
                value={aiForm.qtd}
                onChange={(e) => setAiForm((prev) => ({ ...prev, qtd: e.target.value }))}
                className="px-3 py-2 rounded-lg border"
              />
              <select
                value={aiForm.aggressiveness}
                onChange={(e) => setAiForm((prev) => ({ ...prev, aggressiveness: e.target.value }))}
                className="px-3 py-2 rounded-lg border"
              >
                <option value="prova">Prova</option>
                <option value="medio">Médio</option>
                <option value="longo">Longo prazo</option>
              </select>
            </div>
            <button
              disabled={aiLoading}
              onClick={generateWithAI}
              className="px-4 py-2 rounded-lg bg-cyan-600 text-white flex items-center gap-2 disabled:opacity-60"
            >
              <Sparkles size={14} /> {aiLoading ? "Gerando..." : "Gerar com IA"}
            </button>
          </div>
        </div>
      )}

      <div className="rounded-xl border bg-white dark:bg-slate-900 p-4">
        <h3 className="font-semibold mb-2">Deck selecionado: {selectedDeck?.nome || selectedDeck?.name || "-"}</h3>
        {!tree.cards.length ? (
          <p className="text-sm text-slate-500">Nenhum card neste deck.</p>
        ) : (
          <ul className="space-y-2 max-h-[400px] overflow-y-auto">
            {tree.cards.map((card) => (
              <li key={card.id} className="rounded-lg border p-3 bg-slate-50 dark:bg-slate-950">
                <p className="font-medium">{card.pergunta}</p>
                <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">{card.resposta}</p>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => registerReview(card.id, "acertou")}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-sm flex items-center gap-1"
                  >
                    <CheckCircle2 size={14} /> Acertei
                  </button>
                  <button
                    onClick={() => registerReview(card.id, "errou")}
                    className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-sm flex items-center gap-1"
                  >
                    <XCircle size={14} /> Errei
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
