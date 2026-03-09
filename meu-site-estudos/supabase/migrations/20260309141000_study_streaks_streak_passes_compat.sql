-- Compatibilidade para rotinas que esperam métricas extras em study_streaks.

ALTER TABLE IF EXISTS public.study_streaks
  ADD COLUMN IF NOT EXISTS streak_passes integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS streak_fails integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_passed_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_failed_at timestamptz;

DO $$
BEGIN
  IF to_regclass('public.study_streaks') IS NOT NULL THEN
    UPDATE public.study_streaks
    SET
      streak_passes = COALESCE(streak_passes, 0),
      streak_fails = COALESCE(streak_fails, 0)
    WHERE
      streak_passes IS NULL
      OR streak_fails IS NULL;
  END IF;
END
$$;
