-- Restaura estruturas usadas por Estudar Agora + Amigos após limpeza do banco.

-- 1) Colunas esperadas em user_progress
ALTER TABLE IF EXISTS public.user_progress
  ADD COLUMN IF NOT EXISTS xp_to_next integer NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS title text NOT NULL DEFAULT 'Iniciante';

-- 2) Constraint para UPSERT de conteúdos (onConflict: materia_id,titulo)
DO $$
BEGIN
  IF to_regclass('public.materia_conteudos') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM pg_constraint
       WHERE conname = 'materia_conteudos_materia_id_titulo_key'
         AND conrelid = 'public.materia_conteudos'::regclass
     ) THEN
    ALTER TABLE public.materia_conteudos
      ADD CONSTRAINT materia_conteudos_materia_id_titulo_key UNIQUE (materia_id, titulo);
  END IF;
END
$$;

-- 3) RPC usada para adicionar amizades por código
CREATE OR REPLACE FUNCTION public.resolve_invite_code(code text)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id
  FROM public.perfis p
  WHERE upper(regexp_replace(coalesce(p.invite_code, ''), '\\s+', '', 'g')) = upper(regexp_replace(coalesce(code, ''), '\\s+', '', 'g'))
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_invite_code(text) TO authenticated;

-- 4) Views usadas na tela de amizades/ranking
CREATE OR REPLACE VIEW public.v_incoming_friend_requests
WITH (security_invoker = on)
AS
SELECT
  f.id,
  f.requester_id,
  coalesce(pr.nome, 'Usuário') AS requester_nome,
  f.status,
  f.created_at
FROM public.friendships f
LEFT JOIN public.perfis pr ON pr.id = f.requester_id
WHERE f.addressee_id = auth.uid()
  AND f.status = 'pending';

CREATE OR REPLACE VIEW public.v_friend_ranking
WITH (security_invoker = on)
AS
WITH me_and_friends AS (
  SELECT auth.uid() AS user_id
  UNION
  SELECT CASE
           WHEN f.requester_id = auth.uid() THEN f.addressee_id
           ELSE f.requester_id
         END AS user_id
  FROM public.friendships f
  WHERE f.status = 'accepted'
    AND (f.requester_id = auth.uid() OR f.addressee_id = auth.uid())
)
SELECT
  m.user_id,
  coalesce(p.nome, 'Usuário') AS nome,
  coalesce(up.level, 1) AS level,
  coalesce(up.title,
    CASE
      WHEN coalesce(up.level, 1) >= 25 THEN 'Lendário'
      WHEN coalesce(up.level, 1) >= 15 THEN 'Avançado'
      WHEN coalesce(up.level, 1) >= 8 THEN 'Intermediário'
      ELSE 'Iniciante'
    END
  ) AS title,
  coalesce(up.xp_total, up.xp, 0) AS xp_total
FROM me_and_friends m
LEFT JOIN public.perfis p ON p.id = m.user_id
LEFT JOIN public.user_progress up ON up.user_id = m.user_id;

GRANT SELECT ON public.v_incoming_friend_requests TO authenticated;
GRANT SELECT ON public.v_friend_ranking TO authenticated;

-- 5) RLS nas tabelas do app principal
ALTER TABLE IF EXISTS public.user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.workspace_layouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.materias ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.materia_conteudos ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.revisoes_agendadas ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.sessoes_estudo ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.tarefas ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.study_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.study_cycle_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.study_cycle_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.perfis ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF to_regclass('public.user_progress') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_progress' AND policyname = 'user_progress_owner_all') THEN
      CREATE POLICY user_progress_owner_all ON public.user_progress
        FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
    END IF;
  END IF;

  IF to_regclass('public.user_streaks') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_streaks' AND policyname = 'user_streaks_owner_all') THEN
      CREATE POLICY user_streaks_owner_all ON public.user_streaks
        FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
    END IF;
  END IF;

  IF to_regclass('public.workspace_layouts') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'workspace_layouts' AND policyname = 'workspace_layouts_owner_all') THEN
      CREATE POLICY workspace_layouts_owner_all ON public.workspace_layouts
        FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
    END IF;
  END IF;

  IF to_regclass('public.materias') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'materias' AND policyname = 'materias_owner_all') THEN
      CREATE POLICY materias_owner_all ON public.materias
        FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
    END IF;
  END IF;

  IF to_regclass('public.materia_conteudos') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'materia_conteudos' AND policyname = 'materia_conteudos_owner_all') THEN
      CREATE POLICY materia_conteudos_owner_all ON public.materia_conteudos
        FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
    END IF;
  END IF;

  IF to_regclass('public.revisoes_agendadas') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'revisoes_agendadas' AND policyname = 'revisoes_agendadas_owner_all') THEN
      CREATE POLICY revisoes_agendadas_owner_all ON public.revisoes_agendadas
        FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
    END IF;
  END IF;

  IF to_regclass('public.sessoes_estudo') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'sessoes_estudo' AND policyname = 'sessoes_estudo_owner_all') THEN
      CREATE POLICY sessoes_estudo_owner_all ON public.sessoes_estudo
        FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
    END IF;
  END IF;

  IF to_regclass('public.tarefas') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'tarefas' AND policyname = 'tarefas_owner_all') THEN
      CREATE POLICY tarefas_owner_all ON public.tarefas
        FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
    END IF;
  END IF;

  IF to_regclass('public.study_cycles') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'study_cycles' AND policyname = 'study_cycles_owner_all') THEN
      CREATE POLICY study_cycles_owner_all ON public.study_cycles
        FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
    END IF;
  END IF;

  IF to_regclass('public.study_cycle_subjects') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'study_cycle_subjects' AND policyname = 'study_cycle_subjects_owner_all') THEN
      CREATE POLICY study_cycle_subjects_owner_all ON public.study_cycle_subjects
        FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
    END IF;
  END IF;

  IF to_regclass('public.study_cycle_sessions') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'study_cycle_sessions' AND policyname = 'study_cycle_sessions_owner_all') THEN
      CREATE POLICY study_cycle_sessions_owner_all ON public.study_cycle_sessions
        FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
    END IF;
  END IF;

  IF to_regclass('public.perfis') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'perfis' AND policyname = 'perfis_owner_select_update') THEN
      CREATE POLICY perfis_owner_select_update ON public.perfis
        FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
    END IF;
  END IF;

  IF to_regclass('public.friendships') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'friendships' AND policyname = 'friendships_participants_select') THEN
      CREATE POLICY friendships_participants_select ON public.friendships
        FOR SELECT USING (auth.uid() = requester_id OR auth.uid() = addressee_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'friendships' AND policyname = 'friendships_requester_insert') THEN
      CREATE POLICY friendships_requester_insert ON public.friendships
        FOR INSERT WITH CHECK (auth.uid() = requester_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'friendships' AND policyname = 'friendships_addressee_update') THEN
      CREATE POLICY friendships_addressee_update ON public.friendships
        FOR UPDATE USING (auth.uid() = addressee_id)
        WITH CHECK (auth.uid() = addressee_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'friendships' AND policyname = 'friendships_participants_delete') THEN
      CREATE POLICY friendships_participants_delete ON public.friendships
        FOR DELETE USING (auth.uid() = requester_id OR auth.uid() = addressee_id);
    END IF;
  END IF;
END
$$;
