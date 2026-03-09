-- Hardening: remove quaisquer triggers legados em user_streaks/study_streaks
-- e recria apenas triggers de compatibilidade seguros, evitando erros de
-- "column reference \"best\" is ambiguous" ao salvar sessões.

DO $$
DECLARE
  target_table regclass;
  trig record;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    to_regclass('public.user_streaks'),
    to_regclass('public.study_streaks')
  ]
  LOOP
    IF target_table IS NULL THEN
      CONTINUE;
    END IF;

    FOR trig IN
      SELECT tgname
      FROM pg_trigger
      WHERE tgrelid = target_table
        AND NOT tgisinternal
    LOOP
      IF trig.tgname NOT IN (
        'user_streaks_compat_before_write_trg',
        'study_streaks_compat_before_write_trg'
      ) THEN
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON %s', trig.tgname, target_table);
      END IF;
    END LOOP;
  END LOOP;
END
$$;

-- user_streaks
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

DO $$
BEGIN
  IF to_regclass('public.user_streaks') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS user_streaks_compat_before_write_trg ON public.user_streaks;
    CREATE TRIGGER user_streaks_compat_before_write_trg
    BEFORE INSERT OR UPDATE ON public.user_streaks
    FOR EACH ROW
    EXECUTE FUNCTION public.user_streaks_compat_before_write();
  END IF;
END
$$;

-- study_streaks
CREATE OR REPLACE FUNCTION public.study_streaks_compat_before_write()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.streak := COALESCE(NEW.streak, 0);
  NEW.best := GREATEST(COALESCE(NEW.best, 0), COALESCE(NEW.streak, 0));
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.study_streaks') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS study_streaks_compat_before_write_trg ON public.study_streaks;
    CREATE TRIGGER study_streaks_compat_before_write_trg
    BEFORE INSERT OR UPDATE ON public.study_streaks
    FOR EACH ROW
    EXECUTE FUNCTION public.study_streaks_compat_before_write();
  END IF;
END
$$;
