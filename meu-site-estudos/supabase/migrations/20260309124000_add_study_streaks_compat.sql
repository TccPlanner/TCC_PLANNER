-- Compatibilidade: algumas rotinas ainda referenciam public.study_streaks.

CREATE TABLE IF NOT EXISTS public.study_streaks (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  committed boolean NOT NULL DEFAULT false,
  streak integer NOT NULL DEFAULT 0,
  best integer NOT NULL DEFAULT 0,
  last_visit date
);

-- Se a tabela antiga user_streaks existir, reaproveita os dados nela.
DO $$
BEGIN
  IF to_regclass('public.user_streaks') IS NOT NULL THEN
    INSERT INTO public.study_streaks (user_id, committed, streak, best, last_visit)
    SELECT us.user_id, us.committed, us.streak, us.best, us.last_visit
    FROM public.user_streaks us
    ON CONFLICT (user_id) DO UPDATE
    SET
      committed = EXCLUDED.committed,
      streak = EXCLUDED.streak,
      best = EXCLUDED.best,
      last_visit = EXCLUDED.last_visit;
  END IF;
END
$$;

ALTER TABLE public.study_streaks ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'study_streaks'
      AND policyname = 'study_streaks_owner_all'
  ) THEN
    CREATE POLICY study_streaks_owner_all
      ON public.study_streaks
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END
$$;
