-- Alinha nomes de tabelas/colunas do banco com o que o frontend usa.

-- 1) flash_topics -> flash_subjects
DO $$
BEGIN
  IF to_regclass('public.flash_topics') IS NOT NULL
     AND to_regclass('public.flash_subjects') IS NULL THEN
    ALTER TABLE public.flash_topics RENAME TO flash_subjects;
  END IF;
END
$$;

-- 2) Colunas "name" -> "nome" em entidades de flashcards
DO $$
BEGIN
  IF to_regclass('public.flash_courses') IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'flash_courses' AND column_name = 'name'
     )
     AND NOT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'flash_courses' AND column_name = 'nome'
     ) THEN
    ALTER TABLE public.flash_courses RENAME COLUMN name TO nome;
  END IF;

  IF to_regclass('public.flash_disciplines') IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'flash_disciplines' AND column_name = 'name'
     )
     AND NOT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'flash_disciplines' AND column_name = 'nome'
     ) THEN
    ALTER TABLE public.flash_disciplines RENAME COLUMN name TO nome;
  END IF;

  IF to_regclass('public.flash_subjects') IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'flash_subjects' AND column_name = 'name'
     )
     AND NOT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'flash_subjects' AND column_name = 'nome'
     ) THEN
    ALTER TABLE public.flash_subjects RENAME COLUMN name TO nome;
  END IF;

  IF to_regclass('public.flash_decks') IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'flash_decks' AND column_name = 'name'
     )
     AND NOT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'flash_decks' AND column_name = 'nome'
     ) THEN
    ALTER TABLE public.flash_decks RENAME COLUMN name TO nome;
  END IF;
END
$$;

-- 3) flash_decks.topic_id -> subject_id
DO $$
BEGIN
  IF to_regclass('public.flash_decks') IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'flash_decks' AND column_name = 'topic_id'
     )
     AND NOT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'flash_decks' AND column_name = 'subject_id'
     ) THEN
    ALTER TABLE public.flash_decks RENAME COLUMN topic_id TO subject_id;
  END IF;
END
$$;

-- 4) flash_cards.is_favorite -> favoritos
DO $$
BEGIN
  IF to_regclass('public.flash_cards') IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'flash_cards' AND column_name = 'is_favorite'
     )
     AND NOT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'flash_cards' AND column_name = 'favoritos'
     ) THEN
    ALTER TABLE public.flash_cards RENAME COLUMN is_favorite TO favoritos;
  END IF;

  IF to_regclass('public.flash_cards') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'flash_cards' AND column_name = 'favoritos'
     ) THEN
    ALTER TABLE public.flash_cards ADD COLUMN favoritos boolean NOT NULL DEFAULT false;
  END IF;
END
$$;

-- 5) Cria tabela de revisões usada no app: flash_card_reviews
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
