-- Compatibilidade adicional para rotinas legadas que usam nomes antigos em study_streaks.

ALTER TABLE IF EXISTS public.study_streaks
  ADD COLUMN IF NOT EXISTS current_streak integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS best_streak integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_study_date date;

-- Backfill inicial a partir das colunas já existentes.
DO $$
BEGIN
  IF to_regclass('public.study_streaks') IS NOT NULL THEN
    UPDATE public.study_streaks
    SET
      current_streak = COALESCE(streak, 0),
      best_streak = COALESCE(best, 0),
      last_study_date = last_visit
    WHERE
      current_streak IS DISTINCT FROM COALESCE(streak, 0)
      OR best_streak IS DISTINCT FROM COALESCE(best, 0)
      OR last_study_date IS DISTINCT FROM last_visit;
  END IF;
END
$$;
