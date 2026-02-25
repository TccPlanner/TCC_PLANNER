import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function getUserFromAuthHeader(
  req: Request,
  supabaseUrl: string,
  anonKey: string
) {
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace("Bearer ", "").trim();

  if (!token) {
    return { user: null, error: "Missing Bearer token" };
  }

  const authClient = createClient(supabaseUrl, anonKey);
  const {
    data: { user },
    error,
  } = await authClient.auth.getUser(token);

  if (error || !user) {
    return { user: null, error: error?.message || "Invalid user token" };
  }

  return { user, error: null };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get(
      "SUPABASE_SERVICE_ROLE_KEY"
    );

    if (!SUPABASE_URL) throw new Error("Missing SUPABASE_URL");
    if (!SUPABASE_ANON_KEY) throw new Error("Missing SUPABASE_ANON_KEY");
    if (!SUPABASE_SERVICE_ROLE_KEY)
      throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");

    const { user, error: authError } = await getUserFromAuthHeader(
      req,
      SUPABASE_URL,
      SUPABASE_ANON_KEY
    );

    if (authError || !user)
      return json(401, { ok: false, error: authError });

    const rawBody = await req.text();
    let body: Record<string, unknown> = {};

    try {
      body = rawBody ? JSON.parse(rawBody) : {};
    } catch {
      return json(400, { ok: false, error: "Body inválido." });
    }

    const action = String(body.action || "");
    const nome = String(body.nome || "").trim();

    const supabaseAdmin = createClient(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY
    );

    // =========================
    // CREATE COURSE
    // =========================
    if (action === "create_course") {
      if (!nome)
        return json(400, { ok: false, error: "Nome é obrigatório." });

      const { data, error } = await supabaseAdmin
        .from("flash_courses")
        .insert({ user_id: user.id, nome })
        .select("id")
        .single();

      if (error) throw error;

      return json(200, { ok: true, data });
    }

    // =========================
    // CREATE DISCIPLINE
    // =========================
    if (action === "create_discipline") {
      const course_id = String(body.course_id || "");
      if (!course_id)
        return json(400, { ok: false, error: "course_id é obrigatório." });

      const { data: course } = await supabaseAdmin
        .from("flash_courses")
        .select("id")
        .eq("id", course_id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (!course)
        return json(403, {
          ok: false,
          error: "Curso inválido para este usuário.",
        });

      const { data, error } = await supabaseAdmin
        .from("flash_disciplines")
        .insert({ user_id: user.id, course_id, nome })
        .select("id")
        .single();

      if (error) throw error;

      return json(200, { ok: true, data });
    }

    // =========================
    // CREATE TOPIC
    // =========================
    if (action === "create_subject") {
      const discipline_id = String(body.discipline_id || "");
      if (!discipline_id)
        return json(400, { ok: false, error: "discipline_id é obrigatório." });

      const { data: discipline } = await supabaseAdmin
        .from("flash_disciplines")
        .select("id")
        .eq("id", discipline_id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (!discipline)
        return json(403, {
          ok: false,
          error: "Disciplina inválida para este usuário.",
        });

      const { data, error } = await supabaseAdmin
        .from("flash_subjects")
        .insert({ user_id: user.id, discipline_id, nome })
        .select("id")
        .single();

      if (error) throw error;

      return json(200, { ok: true, data });
    }

    // =========================
    // CREATE DECK
    // =========================
    if (action === "create_deck") {
      const subject_id = String(body.subject_id || "");
      if (!subject_id)
        return json(400, { ok: false, error: "subject_id é obrigatório." });

      const { data: topic } = await supabaseAdmin
        .from("flash_subjects")
        .select("id")
        .eq("id", subject_id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (!topic)
        return json(403, {
          ok: false,
          error: "Assunto inválido para este usuário.",
        });

      const { data, error } = await supabaseAdmin
        .from("flash_decks")
        .insert({ user_id: user.id, subject_id, nome })
        .select("id")
        .single();

      if (error) throw error;

      return json(200, { ok: true, data });
    }

    // =========================
    // CREATE CARD
    // =========================
    if (action === "create_card") {
      const deck_id = String(body.deck_id || "");
      if (!deck_id)
        return json(400, { ok: false, error: "deck_id é obrigatório." });

      const tipo = body.tipo === "cloze" ? "cloze" : "normal";

      const pergunta =
        tipo === "cloze"
          ? String(body.cloze_text || "").trim()
          : String(body.pergunta || "").trim();

      const resposta =
        tipo === "cloze"
          ? String(body.cloze_answer || "").trim()
          : String(body.resposta || "").trim();

      if (!pergunta || !resposta)
        return json(400, {
          ok: false,
          error: "pergunta/resposta são obrigatórias.",
        });

      const payload = {
        user_id: user.id,
        deck_id,
        tipo,
        pergunta,
        resposta,
        cloze_text: tipo === "cloze" ? pergunta : null,
        cloze_answer: tipo === "cloze" ? resposta : null,
        tags: Array.isArray(body.tags)
          ? body.tags.map((t) => String(t))
          : [],
        favoritos: false,
      };

      const { error } = await supabaseAdmin
        .from("flash_cards")
        .insert(payload);

      if (error) throw error;

      return json(200, { ok: true });
    }

    return json(400, { ok: false, error: "action inválida." });
  } catch (e) {
    return json(400, {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    });
  }
});
