-- Fecha lacunas de schema ainda usadas pelo app após limpeza parcial do banco.

-- 1) study_streaks: compatibilidade com nomes legados adicionais
ALTER TABLE IF EXISTS public.study_streaks
  ADD COLUMN IF NOT EXISTS last_checkin_date date;

DO $$
BEGIN
  IF to_regclass('public.study_streaks') IS NOT NULL THEN
    UPDATE public.study_streaks
    SET last_checkin_date = COALESCE(last_checkin_date, last_study_date, last_visit)
    WHERE last_checkin_date IS DISTINCT FROM COALESCE(last_study_date, last_visit);
  END IF;
END
$$;

-- 2) Tabela usada no dashboard para estatísticas de revisões de flashcards
CREATE TABLE IF NOT EXISTS public.flash_card_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  deck_id uuid NOT NULL REFERENCES public.flash_decks(id) ON DELETE CASCADE,
  card_id uuid NOT NULL REFERENCES public.flash_cards(id) ON DELETE CASCADE,
  resultado text NOT NULL CHECK (resultado IN ('acertou', 'errou', 'duvida')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS flash_card_reviews_user_deck_idx
  ON public.flash_card_reviews (user_id, deck_id);

CREATE INDEX IF NOT EXISTS flash_card_reviews_card_idx
  ON public.flash_card_reviews (card_id);

-- 3) RLS para favoritos/reviews (usados no dashboard)
ALTER TABLE IF EXISTS public.flash_card_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.flash_card_favorites ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF to_regclass('public.flash_card_reviews') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'flash_card_reviews'
        AND policyname = 'flash_card_reviews_owner_all'
    ) THEN
      CREATE POLICY flash_card_reviews_owner_all
        ON public.flash_card_reviews
        FOR ALL
        USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id);
    END IF;
  END IF;

  IF to_regclass('public.flash_card_favorites') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'flash_card_favorites'
        AND policyname = 'flash_card_favorites_owner_all'
    ) THEN
      CREATE POLICY flash_card_favorites_owner_all
        ON public.flash_card_favorites
        FOR ALL
        USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id);
    END IF;
  END IF;
END
$$;
