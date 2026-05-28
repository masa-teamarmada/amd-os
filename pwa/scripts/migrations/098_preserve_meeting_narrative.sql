-- 098_preserve_meeting_narrative.sql
-- Keep high-quality MTG minutes from being overwritten by empty or bullet-only
-- backfills. This is intentionally defensive because some maintenance jobs write
-- project_meeting_summaries through service_role REST and bypass the PWA API.

CREATE OR REPLACE FUNCTION public.trg_pms_preserve_rich_narrative()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  old_text text := btrim(coalesce(OLD.narrative_md, ''));
  new_text text := btrim(coalesce(NEW.narrative_md, ''));
  old_len integer := char_length(btrim(coalesce(OLD.narrative_md, '')));
  new_len integer := char_length(btrim(coalesce(NEW.narrative_md, '')));
  bullet_lines integer := 0;
  total_lines integer := 0;
BEGIN
  IF old_len < 300 THEN
    RETURN NEW;
  END IF;

  IF new_len = 0 THEN
    NEW.narrative_md := OLD.narrative_md;
    RETURN NEW;
  END IF;

  SELECT
    count(*) FILTER (WHERE line ~ '^\s*(-|\*|・|•|\d+[\.)])\s+'),
    count(*) FILTER (WHERE btrim(line) <> '')
  INTO bullet_lines, total_lines
  FROM regexp_split_to_table(new_text, E'\n') AS line;

  IF total_lines >= 4
     AND bullet_lines::numeric / greatest(total_lines, 1) >= 0.70
     AND new_len <= old_len THEN
    NEW.narrative_md := OLD.narrative_md;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pms_preserve_rich_narrative ON public.project_meeting_summaries;
CREATE TRIGGER pms_preserve_rich_narrative
BEFORE UPDATE ON public.project_meeting_summaries
FOR EACH ROW
EXECUTE FUNCTION public.trg_pms_preserve_rich_narrative();

COMMENT ON FUNCTION public.trg_pms_preserve_rich_narrative() IS
  'Preserves existing rich project_meeting_summaries.narrative_md when an update tries to replace it with empty or bullet-dominant text.';
