-- Compatibilidade para rotinas que esperam timestamps em study_streaks.

ALTER TABLE IF EXISTS public.study_streaks
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DO $$
BEGIN
  IF to_regclass('public.study_streaks') IS NOT NULL THEN
    UPDATE public.study_streaks
    SET
      created_at = COALESCE(created_at, now()),
      updated_at = COALESCE(updated_at, created_at, now())
    WHERE
      created_at IS NULL
      OR updated_at IS NULL;
  END IF;
END
$$;
