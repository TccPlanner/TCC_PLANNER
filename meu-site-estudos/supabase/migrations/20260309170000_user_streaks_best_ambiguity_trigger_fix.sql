-- Corrige erro "column reference best is ambiguous" em bases que ainda usam public.user_streaks.
-- Também aplica normalização de best/streak para evitar regressões.

DO $$
DECLARE
  rec record;
BEGIN
  IF to_regclass('public.user_streaks') IS NULL THEN
    RETURN;
  END IF;

  -- Remove triggers customizados que chamam funções com padrão ambíguo em "best".
  FOR rec IN
    SELECT t.tgname,
           pg_get_functiondef(p.oid) AS func_def
    FROM pg_trigger t
    JOIN pg_proc p ON p.oid = t.tgfoid
    WHERE t.tgrelid = 'public.user_streaks'::regclass
      AND NOT t.tgisinternal
  LOOP
    IF rec.func_def ILIKE '%GREATEST(best%'
       OR rec.func_def ILIKE '%coalesce(best%'
       OR rec.func_def ILIKE '% best := %'
    THEN
      EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.user_streaks', rec.tgname);
    END IF;
  END LOOP;
END
$$;

CREATE OR REPLACE FUNCTION public.user_streaks_compat_before_write()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.streak := COALESCE(NEW.streak, 0);
  NEW.best := GREATEST(COALESCE(NEW.best, 0), COALESCE(NEW.streak, 0));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_streaks_compat_before_write_trg ON public.user_streaks;

CREATE TRIGGER user_streaks_compat_before_write_trg
BEFORE INSERT OR UPDATE ON public.user_streaks
FOR EACH ROW
EXECUTE FUNCTION public.user_streaks_compat_before_write();
