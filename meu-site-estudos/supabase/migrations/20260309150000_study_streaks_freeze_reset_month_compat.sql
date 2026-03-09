-- Compatibilidade para rotinas de streak que resetam congelamentos mensalmente.

ALTER TABLE IF EXISTS public.study_streaks
  ADD COLUMN IF NOT EXISTS last_freeze_reset_month date,
  ADD COLUMN IF NOT EXISTS freeze_tokens integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS freeze_used_this_month integer NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF to_regclass('public.study_streaks') IS NOT NULL THEN
    UPDATE public.study_streaks
    SET
      freeze_tokens = COALESCE(freeze_tokens, freeze_tokens_balance, 0),
      freeze_used_this_month = COALESCE(freeze_used_this_month, freeze_tokens_used, 0),
      last_freeze_reset_month = COALESCE(
        last_freeze_reset_month,
        date_trunc('month', last_freeze_at)::date,
        date_trunc('month', now())::date
      )
    WHERE
      freeze_tokens IS NULL
      OR freeze_used_this_month IS NULL
      OR last_freeze_reset_month IS NULL;
  END IF;
END
$$;
