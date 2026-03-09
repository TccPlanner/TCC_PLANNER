-- Corrige erros de "column reference best is ambiguous" em rotinas legadas ligadas a study_streaks.
-- Estratégia:
-- 1) Remove triggers não internos da tabela que usam função com padrão ambíguo em "best".
-- 2) Garante um trigger canônico simples para manter consistência dos campos derivados.

DO $$
DECLARE
  rec record;
BEGIN
  IF to_regclass('public.study_streaks') IS NULL THEN
    RETURN;
  END IF;

  FOR rec IN
    SELECT
      t.tgname,
      n.nspname AS func_schema,
      p.proname AS func_name,
      pg_get_functiondef(p.oid) AS func_def
    FROM pg_trigger t
    JOIN pg_proc p ON p.oid = t.tgfoid
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE t.tgrelid = 'public.study_streaks'::regclass
      AND NOT t.tgisinternal
  LOOP
    IF rec.func_def ILIKE '%GREATEST(best%'
       OR rec.func_def ILIKE '%coalesce(best%'
       OR rec.func_def ILIKE '% best := %'
    THEN
      EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.study_streaks', rec.tgname);
    END IF;
  END LOOP;
END
$$;

CREATE OR REPLACE FUNCTION public.study_streaks_compat_before_write()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.streak := COALESCE(NEW.streak, 0);
  NEW.best := GREATEST(COALESCE(NEW.best, 0), COALESCE(NEW.streak, 0));

  IF TG_OP = 'UPDATE' THEN
    NEW.updated_at := now();
  ELSIF NEW.updated_at IS NULL THEN
    NEW.updated_at := now();
  END IF;

  IF TG_OP = 'INSERT' AND NEW.created_at IS NULL THEN
    NEW.created_at := now();
  END IF;

  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS study_streaks_compat_before_write_trg ON public.study_streaks;

CREATE TRIGGER study_streaks_compat_before_write_trg
BEFORE INSERT OR UPDATE ON public.study_streaks
FOR EACH ROW
EXECUTE FUNCTION public.study_streaks_compat_before_write();
