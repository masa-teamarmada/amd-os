-- 471_cx_project_definition_compensation_form.sql
--
-- 1. PJ概要の「AMDの稼ぎ方」を「AMDの報酬形態」と呼ぶ。DB の説明文もそろえる。
--    まさ確定 2026-10-04「稼ぎ方っていう言い方は下品なので、報酬形態、みたいな言い方に変えて。」
-- 2. CX（p20）のPJの定義を入れる（PJ管理 > PJ概要、spec 3-23 §9）。
--    まさ確定 2026-10-04「株式も入れて問題なし。」（2026-10-04 に出した案: 関わり方の補足・報酬形態・先方の窓口）
--    報酬形態の中身に金額と時期は書かない（契約・収支・資本政策表から出る）。
-- 変更前の値は amd_os_data_change_history（トリガー）に残る。destructive DDL は行わない。

BEGIN;

COMMENT ON COLUMN public.project_definitions.revenue_streams IS 'AMDの報酬形態。[{kind, note}]。kind は AMD_REVENUE_KINDS（src/lib/project-formats.ts）。金額・時期は契約・収支・資本政策表から出すので書かない';

INSERT INTO public.project_definitions (project_id, involvement_note, revenue_streams, counterpart_contacts, created_by_email, updated_by_email)
VALUES (
  'p20',
  $m$NIMSの磁気冷凍技術で、創業者と一緒に会社を創る$m$,
  $j$[
    {"kind": "contract_fee", "note": "NIMSからの事業化支援の受託"},
    {"kind": "contract_fee", "note": "設立後の経営企画の受託"},
    {"kind": "equity", "note": "設立する会社（CryoX）の株式"}
  ]$j$::jsonb,
  $m$神谷宏治さん（NIMS・研究者、創業者）$m$,
  'migration-471',
  'migration-471'
);

DO $v$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.project_definitions
     WHERE project_id = 'p20'
       AND jsonb_array_length(revenue_streams) = 3
       AND revenue_streams @> '[{"kind": "equity"}]'::jsonb
       AND counterpart_contacts IS NOT NULL
       AND involvement_note IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'CX project definition was not written as expected';
  END IF;
  IF position('稼ぎ方' in coalesce(col_description('public.project_definitions'::regclass,
       (SELECT attnum FROM pg_attribute WHERE attrelid = 'public.project_definitions'::regclass AND attname = 'revenue_streams')), '')) > 0 THEN
    RAISE EXCEPTION 'revenue_streams comment still uses the old wording';
  END IF;
END $v$;

COMMIT;
