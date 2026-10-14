BEGIN;
-- 秘密度と掲載指定の独立。既存version=1/旧クライアントとの互換性を保持。
ALTER TABLE public.project_tech_topics DROP CONSTRAINT amie_topic_disclosure_valid;
ALTER TABLE public.project_tech_topics ADD CONSTRAINT amie_topic_disclosure_valid CHECK (coalesce((jsonb_typeof(disclosure)='object'
 AND disclosure->>'version'='1'
 AND disclosure->>'level' IN ('public','dd_summary','restricted','core')
 AND jsonb_typeof(disclosure->'reason')='string' AND disclosure ? 'dd'
 AND (NOT disclosure ? 'field_levels' OR (
  jsonb_typeof(disclosure->'field_levels')='object'
  AND NOT jsonb_path_exists(disclosure->'field_levels', '$.* ? (!(@ == "public" || @ == "dd_summary" || @ == "restricted" || @ == "core"))')
  AND jsonb_typeof(disclosure->'field_reasons')='object'
 ))
 AND (disclosure->'dd'='null'::jsonb OR (jsonb_typeof(disclosure->'dd')='object' AND disclosure->>'reviewed_hash' ~ '^[a-f0-9]{64}$'
 AND ((NOT disclosure ? 'field_levels' AND (disclosure->>'level' IN ('public','dd_summary') OR coalesce(disclosure->'dd'->>'body_md','')='')) OR (disclosure ? 'field_levels' AND (coalesce(disclosure->'dd'->>'title','')='' OR coalesce(disclosure->'field_levels'->>'title',disclosure->>'level') IN ('public','dd_summary') OR btrim(disclosure->'dd'->>'title') IS DISTINCT FROM btrim(title)) AND (coalesce(disclosure->'dd'->>'summary','')='' OR coalesce(disclosure->'field_levels'->>'summary',disclosure->>'level') IN ('public','dd_summary') OR btrim(disclosure->'dd'->>'summary') IS DISTINCT FROM btrim(summary)) AND (coalesce(disclosure->'dd'->>'body_md','')='' OR coalesce(disclosure->'field_levels'->>'body_md',disclosure->>'level') IN ('public','dd_summary') OR btrim(disclosure->'dd'->>'body_md') IS DISTINCT FROM btrim(body_md)) AND (coalesce(disclosure->'dd'->>'source_label','')='' OR coalesce(disclosure->'field_levels'->>'source_ref',disclosure->>'level') IN ('public','dd_summary') OR btrim(disclosure->'dd'->>'source_label') IS DISTINCT FROM btrim(source_ref)) AND (coalesce(disclosure->'dd'->>'check_reason','')='' OR coalesce(disclosure->'field_levels'->>'check_reason',disclosure->>'level') IN ('public','dd_summary') OR btrim(disclosure->'dd'->>'check_reason') IS DISTINCT FROM btrim(check_reason))))
 ))),false));
COMMENT ON COLUMN public.project_tech_topics.disclosure IS '原本の秘密度・理由とDD掲載原稿を独立管理。field_levels/field_reasonsは欄ごとの秘密度と根拠。一般情報は公開済みを意味しない。';
ALTER TABLE public.project_tech_entries DROP CONSTRAINT amie_entry_disclosure_valid;
ALTER TABLE public.project_tech_entries ADD CONSTRAINT amie_entry_disclosure_valid CHECK (coalesce((jsonb_typeof(disclosure)='object'
 AND disclosure->>'version'='1'
 AND disclosure->>'level' IN ('public','dd_summary','restricted','core')
 AND jsonb_typeof(disclosure->'reason')='string' AND disclosure ? 'dd'
 AND (NOT disclosure ? 'field_levels' OR (
  jsonb_typeof(disclosure->'field_levels')='object'
  AND NOT jsonb_path_exists(disclosure->'field_levels', '$.* ? (!(@ == "public" || @ == "dd_summary" || @ == "restricted" || @ == "core"))')
  AND jsonb_typeof(disclosure->'field_reasons')='object'
 ))
 AND (disclosure->'dd'='null'::jsonb OR (jsonb_typeof(disclosure->'dd')='object' AND disclosure->>'reviewed_hash' ~ '^[a-f0-9]{64}$'
 AND ((NOT disclosure ? 'field_levels' AND (disclosure->>'level' IN ('public','dd_summary'))) OR (disclosure ? 'field_levels' AND (disclosure->'dd'->>'value_mode'='text_only' OR value_min IS NULL OR coalesce(disclosure->'field_levels'->>'value_min',disclosure->>'level') IN ('public','dd_summary')) AND (disclosure->'dd'->>'value_mode'='text_only' OR value_max IS NULL OR coalesce(disclosure->'field_levels'->>'value_max',disclosure->>'level') IN ('public','dd_summary')) AND (disclosure->'dd'->>'value_mode'='text_only' OR unit IS NULL OR coalesce(disclosure->'field_levels'->>'unit',disclosure->>'level') IN ('public','dd_summary')) AND (coalesce(disclosure->'dd'->>'row_label','')='' OR coalesce(disclosure->'field_levels'->>'row_label',disclosure->>'level') IN ('public','dd_summary') OR btrim(disclosure->'dd'->>'row_label') IS DISTINCT FROM btrim(row_label)) AND (coalesce(disclosure->'dd'->>'col_label','')='' OR coalesce(disclosure->'field_levels'->>'col_label',disclosure->>'level') IN ('public','dd_summary') OR btrim(disclosure->'dd'->>'col_label') IS DISTINCT FROM btrim(col_label)) AND (coalesce(disclosure->'dd'->>'value_text','')='' OR coalesce(disclosure->'field_levels'->>'value_text',disclosure->>'level') IN ('public','dd_summary') OR btrim(disclosure->'dd'->>'value_text') IS DISTINCT FROM btrim(value_text)) AND (coalesce(disclosure->'dd'->>'condition_text','')='' OR coalesce(disclosure->'field_levels'->>'condition_text',disclosure->>'level') IN ('public','dd_summary') OR btrim(disclosure->'dd'->>'condition_text') IS DISTINCT FROM btrim(condition_text)) AND (coalesce(disclosure->'dd'->>'note','')='' OR coalesce(disclosure->'field_levels'->>'note',disclosure->>'level') IN ('public','dd_summary') OR btrim(disclosure->'dd'->>'note') IS DISTINCT FROM btrim(note)) AND (coalesce(disclosure->'dd'->>'source_label','')='' OR coalesce(disclosure->'field_levels'->>'source_ref',disclosure->>'level') IN ('public','dd_summary') OR btrim(disclosure->'dd'->>'source_label') IS DISTINCT FROM btrim(source_ref)) AND (coalesce(disclosure->'dd'->>'check_reason','')='' OR coalesce(disclosure->'field_levels'->>'check_reason',disclosure->>'level') IN ('public','dd_summary') OR btrim(disclosure->'dd'->>'check_reason') IS DISTINCT FROM btrim(check_reason))))
 ))),false));
COMMENT ON COLUMN public.project_tech_entries.disclosure IS '原本の秘密度・理由とDD掲載原稿を独立管理。field_levels/field_reasonsは欄ごとの秘密度と根拠。一般情報は公開済みを意味しない。';
COMMIT;
