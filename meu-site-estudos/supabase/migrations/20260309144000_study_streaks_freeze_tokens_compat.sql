-- Compatibilidade para rotinas de streak que usam colunas de congelamento (freeze).

ALTER TABLE IF EXISTS public.study_streaks
  ADD COLUMN IF NOT EXISTS freeze_base_tokens integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS freeze_bonus_tokens integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS freeze_tokens_used integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS freeze_tokens_balance integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_freeze_at timestamptz;

DO $$
BEGIN
  IF to_regclass('public.study_streaks') IS NOT NULL THEN
    UPDATE public.study_streaks
    SET
      freeze_base_tokens = COALESCE(freeze_base_tokens, 0),
      freeze_bonus_tokens = COALESCE(freeze_bonus_tokens, 0),
      freeze_tokens_used = COALESCE(freeze_tokens_used, 0),
      freeze_tokens_balance = COALESCE(freeze_tokens_balance, COALESCE(freeze_base_tokens, 0) + COALESCE(freeze_bonus_tokens, 0) - COALESCE(freeze_tokens_used, 0))
    WHERE
      freeze_base_tokens IS NULL
      OR freeze_bonus_tokens IS NULL
      OR freeze_tokens_used IS NULL
      OR freeze_tokens_balance IS NULL;
  END IF;
END
$$;
