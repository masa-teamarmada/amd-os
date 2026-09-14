-- p21 の現在略称を SX から SOL へ移す。
-- 内部主キー p21、外部ブランド SolvioraX、過去レコード本文・ID は変更しない。

DO $$
DECLARE
  project_count integer;
  venture_count integer;
BEGIN
  SELECT count(*) INTO project_count
  FROM public.projects
  WHERE project_id = 'p21'
    AND project_name = 'SX'
    AND report_local_alias = 'SX';

  IF project_count <> 1 THEN
    RAISE EXCEPTION 'p21 の現行略称が想定外です (project_name=SX / report_local_alias=SX の件数: %)', project_count;
  END IF;

  SELECT count(*) INTO venture_count
  FROM public.project_ventures
  WHERE project_id = 'p21'
    AND short_label = 'SX'
    AND master_md_slug = 'sx'
    AND master_md_text LIKE '# SX (SolvioraX)%';

  IF venture_count <> 1 THEN
    RAISE EXCEPTION 'p21 のventure略称が想定外です (short_label=SX / master_md_slug=sx / 見出しSX の件数: %)', venture_count;
  END IF;

  UPDATE public.projects
  SET project_name = 'SOL',
      report_local_alias = 'SOL',
      updated_at = now()
  WHERE project_id = 'p21';

  UPDATE public.project_ventures
  SET short_label = 'SOL',
      master_md_slug = 'sol',
      master_md_text = regexp_replace(master_md_text, E'^# SX \\(SolvioraX\\)', '# SOL (SolvioraX)'),
      master_md_updated_at = now(),
      updated_at = now()
  WHERE project_id = 'p21';
END $$;

-- 読戻し用。p21以外や内部IDは動かさない。
SELECT p.project_id, p.project_name, p.report_local_alias, v.short_label, v.master_md_slug,
       split_part(v.master_md_text, E'\n', 1) AS master_heading
FROM public.projects p
JOIN public.project_ventures v ON v.project_id = p.project_id
WHERE p.project_id = 'p21';
