BEGIN;
ALTER TABLE public.project_tech_topics ADD COLUMN disclosure jsonb NOT NULL DEFAULT '{"version":1,"level":"restricted","reason":"未仕分け","dd":null}'::jsonb;
ALTER TABLE public.project_tech_entries ADD COLUMN disclosure jsonb NOT NULL DEFAULT '{"version":1,"level":"restricted","reason":"未仕分け","dd":null}'::jsonb;
ALTER TABLE public.project_tech_topics ADD CONSTRAINT amie_topic_disclosure_valid CHECK
  (coalesce(jsonb_typeof(disclosure)='object' AND disclosure->>'version'='1' AND disclosure->>'level' IN ('public','dd_summary','restricted','core') AND jsonb_typeof(disclosure->'reason')='string' AND disclosure ? 'dd'
   AND (disclosure->'dd'='null'::jsonb OR (jsonb_typeof(disclosure->'dd')='object' AND disclosure->>'reviewed_hash' ~ '^[a-f0-9]{64}$' AND (disclosure->>'level' IN ('public','dd_summary') OR coalesce(disclosure->'dd'->>'body_md','')=''))), false));
ALTER TABLE public.project_tech_entries ADD CONSTRAINT amie_entry_disclosure_valid CHECK
  (coalesce(jsonb_typeof(disclosure)='object' AND disclosure->>'version'='1' AND disclosure->>'level' IN ('public','dd_summary','restricted','core') AND jsonb_typeof(disclosure->'reason')='string' AND disclosure ? 'dd'
   AND (disclosure->'dd'='null'::jsonb OR (jsonb_typeof(disclosure->'dd')='object' AND disclosure->>'level' IN ('public','dd_summary') AND disclosure->>'reviewed_hash' ~ '^[a-f0-9]{64}$')), false));
COMMENT ON COLUMN public.project_tech_topics.disclosure IS '本文の4段階秘密区分・仕分け理由・通常DDへ掲載する明示原稿・元内容の確認hash。未仕分けはDD除外。';
COMMENT ON COLUMN public.project_tech_entries.disclosure IS '行の4段階秘密区分・仕分け理由・DD用の見出し/説明（数値・単位は正本）・確認hash。元内容更新時は再レビューまでDD除外。';
COMMIT;
