import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import OpenAI from "npm:openai";
import { createClient } from "jsr:@supabase/supabase-js@2";

type ReqBody = {
  hint: string;
  course_id: string;

  max_disciplines?: number;
  max_topics_per_discipline?: number;
  max_decks_per_topic?: number;

  // ✅ modo teste
  dry_run?: boolean;
  // ✅ controla escrita no banco
  save?: boolean;
};

type Structure = {
  disciplines: Array<{
    name: string;
    topics: Array<{
      name: string;
      decks: string[];
    }>;
  }>;
};

function json(res: unknown, status = 200) {
  return new Response(JSON.stringify(res), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function buildDryRunStructure(hint: string, maxDisc: number, maxTopics: number, maxDecks: number): Structure {
  const base = [
    {
      name: "Fundamentos",
      topics: [
        { name: "Conceitos-chave", decks: ["Definições", "Termos essenciais", "Resumo rápido"] },
        { name: "Erros comuns", decks: ["Pegadinhas", "Exceções", "Confusões frequentes"] },
      ],
    },
    {
      name: "Aplicação",
      topics: [
        { name: "Questões", decks: ["V/F", "Múltipla escolha", "Dissertativas curtas"] },
        { name: "Revisão", decks: ["Revisão 24h", "Revisão 7 dias", "Revisão 30 dias"] },
      ],
    },
    {
      name: "Aprofundamento",
      topics: [
        { name: "Detalhes", decks: ["Casos específicos", "Comparações", "Exemplos"] },
        { name: "Mapa mental", decks: ["Conexões", "Causa e efeito", "Linha do tempo"] },
      ],
    },
  ];

  const disciplines = base.slice(0, maxDisc).map((d) => ({
    name: d.name,
    topics: d.topics.slice(0, maxTopics).map((t) => ({
      name: t.name,
      decks: t.decks.slice(0, maxDecks).map((x) => `${x} — ${hint.slice(0, 24)}`),
    })),
  }));

  return { disciplines };
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") return json({ message: "Method not allowed" }, 405);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: req.headers.get("Authorization")! } },
    });

    const { data: authData, error: authErr } = await supabase.auth.getUser();
    if (authErr || !authData?.user) return json({ message: "Unauthorized" }, 401);
    const userId = authData.user.id;

    const body = (await req.json()) as ReqBody;

    const hint = (body.hint || "").trim();
    const courseId = (body.course_id || "").trim();
    if (!courseId) return json({ message: "course_id é obrigatório" }, 400);
    if (hint.length < 8) return json({ message: "hint muito curto" }, 400);

    const maxDisc = clamp(Number(body.max_disciplines ?? 8), 1, 12);
    const maxTopics = clamp(Number(body.max_topics_per_discipline ?? 12), 1, 20);
    const maxDecks = clamp(Number(body.max_decks_per_topic ?? 10), 1, 20);

    const dryRun = Boolean(body.dry_run);
    const save = body.save ?? !dryRun;

    // ✅ curso fica em flash_courses no seu banco
    const { data: course, error: cErr } = await supabase
      .from("flash_courses")
      .select("id, name")
      .eq("id", courseId)
      .eq("user_id", userId)
      .single();

    if (cErr || !course) {
      return json({ message: "Curso não encontrado ou não pertence ao usuário" }, 404);
    }

    // ✅ DRY RUN (sem IA, sem banco)
    if (dryRun) {
      const structure_preview = buildDryRunStructure(hint, maxDisc, maxTopics, maxDecks);
      return json({
        ok: true,
        dry_run: true,
        save: false,
        course_id: courseId,
        created: { disciplines: 0, topics: 0, decks: 0 },
        structure_preview,
      });
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) return json({ message: "Missing OPENAI_API_KEY secret" }, 500);

    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

    const system = `
Você é um gerador de estrutura de estudos para flashcards.
Retorne APENAS JSON válido, sem texto extra.
Regras:
- disciplines: até ${maxDisc}
- cada discipline.topics: até ${maxTopics}
- cada topic.decks: até ${maxDecks}
- Não repetir nomes.
Formato:
{
  "disciplines": [
    { "name": "…", "topics": [ { "name": "…", "decks": ["…","…"] } ] }
  ]
}
`.trim();

    const userPrompt = `
Curso atual: "${course.name}"
Objetivo do usuário: ${hint}

Gere disciplinas, assuntos e decks (não crie "curso").
`.trim();

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.4,
      messages: [
        { role: "system", content: system },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
    });

    const raw = completion.choices?.[0]?.message?.content || "{}";

    let structure: Structure;
    try {
      structure = JSON.parse(raw) as Structure;
    } catch {
      return json({ message: "IA retornou JSON inválido", raw }, 500);
    }

    if (!structure?.disciplines?.length) {
      return json({ message: "Estrutura vazia", raw }, 500);
    }

    // ✅ preview sem gravar (vai gastar IA, mas não grava)
    if (!save) {
      return json({
        ok: true,
        dry_run: false,
        save: false,
        course_id: courseId,
        created: { disciplines: 0, topics: 0, decks: 0 },
        structure_preview: structure,
      });
    }

    // ✅ grava no banco: fc_disciplines / fc_topics / fc_decks
    const created = { disciplines: 0, topics: 0, decks: 0 };

    // 1) disciplinas
    const disciplinesPayload = structure.disciplines.slice(0, maxDisc).map((d) => ({
      user_id: userId,
      course_id: courseId,
      name: String(d.name).slice(0, 120),
    }));

    const { data: insertedDisc, error: insDiscErr } = await supabase
      .from("fc_disciplines")
      .insert(disciplinesPayload)
      .select("id, name");

    if (insDiscErr) return json({ message: "Erro ao inserir disciplinas", insDiscErr }, 500);
    created.disciplines = insertedDisc?.length ?? 0;

    const discNameToId = new Map<string, string>();
    for (const d of insertedDisc || []) discNameToId.set(d.name, d.id);

    // 2) assuntos
    const topicsPayload: Array<{ user_id: string; discipline_id: string; name: string }> = [];
    for (const d of structure.disciplines.slice(0, maxDisc)) {
      const discId = discNameToId.get(String(d.name).slice(0, 120));
      if (!discId) continue;

      for (const t of (d.topics || []).slice(0, maxTopics)) {
        topicsPayload.push({
          user_id: userId,
          discipline_id: discId,
          name: String(t.name).slice(0, 120),
        });
      }
    }

    const { data: insertedTopics, error: insTopicsErr } = await supabase
      .from("fc_topics")
      .insert(topicsPayload)
      .select("id, name, discipline_id");

    if (insTopicsErr) return json({ message: "Erro ao inserir assuntos", insTopicsErr }, 500);
    created.topics = insertedTopics?.length ?? 0;

    const topicKeyToId = new Map<string, string>();
    for (const t of insertedTopics || []) {
      topicKeyToId.set(`${t.discipline_id}::${t.name}`, t.id);
    }

    // 3) decks
    const decksPayload: Array<{ user_id: string; topic_id: string; name: string }> = [];
    for (const d of structure.disciplines.slice(0, maxDisc)) {
      const discId = discNameToId.get(String(d.name).slice(0, 120));
      if (!discId) continue;

      for (const t of (d.topics || []).slice(0, maxTopics)) {
        const topicName = String(t.name).slice(0, 120);
        const topicId = topicKeyToId.get(`${discId}::${topicName}`);
        if (!topicId) continue;

        for (const dk of (t.decks || []).slice(0, maxDecks)) {
          decksPayload.push({
            user_id: userId,
            topic_id: topicId,
            name: String(dk).slice(0, 120),
          });
        }
      }
    }

    const { data: insertedDecks, error: insDecksErr } = await supabase
      .from("fc_decks")
      .insert(decksPayload)
      .select("id");

    if (insDecksErr) return json({ message: "Erro ao inserir decks", insDecksErr }, 500);
    created.decks = insertedDecks?.length ?? 0;

    return json({
      ok: true,
      dry_run: false,
      save: true,
      course_id: courseId,
      created,
      structure_preview: structure,
    });
  } catch (e) {
    console.error(e);
    return json({ message: "Unhandled error", error: String((e as any)?.message || e) }, 500);
  }
});
