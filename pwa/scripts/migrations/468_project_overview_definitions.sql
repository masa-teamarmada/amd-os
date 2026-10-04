-- 468_project_overview_definitions.sql
--
-- PJ概要タブ（PJ管理）を「PJの定義」と「今の状態」の9項目に作り直し、事業の一言を会社概要へ移す。
-- まさ確定 2026-10-04「1で進めて」（PJ概要に載せる項目の案: PJの定義5項目・今の状態4項目）。
-- 前段の指摘: 2026-10-03「PJの概要にそもそも出資とかテンポラリーな情報が入ってるのがおかしい」
--             2026-10-04「そもそも概要って、PJ作ったときに作ったら、それ以降書き換えることはないのでは？」
--             2026-10-04「これは会社の概要じゃなくてPJの概要なわけだから、もっとPJとしての情報が必要なのでは？」
--
-- 1. project_definitions … PJの定義のうち、ほかに持ち場が無いもの（AMDの関わり方の補足・AMDの稼ぎ方・先方の窓口）。
--    PJを作るときに決める。書けるのは管理者だけ（RLS）。画面は PJ管理 > PJ概要（spec 3-23 §9）。
-- 2. project_business_summaries … 事業の一言と詳しい説明。会社情報 > 会社概要「事業の概要」に出す。全PJで持てる正本。
--    書けるのは管理者だけ（RLS）。Venture Map・沿革・XRL判定などが読む project_ventures.short_description /
--    long_description は、この表から写す控え（トリガー project_business_summaries_sync_venture）。
-- 3. project_ventures の2列を直に書き換えるのを止める（トリガー project_ventures_business_summary_guard）。
--    事業の一言の入口は会社概要の1つだけにする。つくよみの「追記をマージ」と、チャットから概要を書き換える道具も外す（コード側）。
-- 4. 今の事業の一言を写したうえで、12PJの文から出資・調達・採択・予定・進み具合を外す（2026-10-03 まさに出した文面）。
-- 5. CX の沿革から、Build VC の出資想定と設立予定（未来の項目）を外す。
-- 6. つくよみの指示文（llm_prompts: tsukuyomi.system）から、事業概要を書き直す道具の行を外す。
-- 変更前の値は amd_os_data_change_history（トリガー）と llm_prompt_revisions に残る。
-- destructive DDL は行わない。

BEGIN;

-- ============================================================
-- 1. PJの定義
-- revenue_streams は [{ "kind": "<AMD_REVENUE_KINDS の key>", "note": "<中身>" }]。
-- kind の一覧は src/lib/project-formats.ts の AMD_REVENUE_KINDS（鍵付き）と同じ並び（npm run test:project-overview で照合）。
-- ============================================================
CREATE OR REPLACE FUNCTION public.project_revenue_streams_valid(streams jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $fn$
  SELECT jsonb_typeof(streams) = 'array'
     AND NOT EXISTS (
       SELECT 1
       FROM jsonb_array_elements(streams) AS e(item)
       WHERE jsonb_typeof(e.item) <> 'object'
          OR NOT ((e.item ->> 'kind') = ANY (ARRAY['contract_fee', 'advisory_fee', 'success_fee', 'os_fee', 'equity', 'other']))
          OR jsonb_typeof(coalesce(e.item -> 'note', '""'::jsonb)) <> 'string'
     );
$fn$;

CREATE TABLE IF NOT EXISTS public.project_definitions (
  project_id            text PRIMARY KEY REFERENCES public.projects(project_id) ON DELETE CASCADE,
  involvement_note      text,
  revenue_streams       jsonb NOT NULL DEFAULT '[]'::jsonb,
  counterpart_contacts  text,
  created_by_email      text,
  updated_by_email      text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_definitions_revenue_streams_valid CHECK (public.project_revenue_streams_valid(revenue_streams))
);

COMMENT ON TABLE public.project_definitions IS 'PJの定義のうち、ほかに持ち場が無いもの。PJを作るときに決め、書けるのは管理者だけ。画面は PJ管理 > PJ概要（spec 3-23 §9）。migration 468（2026-10-04 まさ確定）';
COMMENT ON COLUMN public.project_definitions.involvement_note IS 'AMDの関わり方の補足（例: NIMSの技術で、AMDが会社を創る）。金額・時期・進み具合は書かない';
COMMENT ON COLUMN public.project_definitions.revenue_streams IS 'AMDの稼ぎ方。[{kind, note}]。kind は AMD_REVENUE_KINDS（src/lib/project-formats.ts）。金額・時期は契約・収支・資本政策から出すので書かない';
COMMENT ON COLUMN public.project_definitions.counterpart_contacts IS '先方の窓口（誰が、どの立場で）';

ALTER TABLE public.project_definitions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "project_definitions_members_read" ON public.project_definitions;
CREATE POLICY "project_definitions_members_read" ON public.project_definitions
  FOR SELECT TO authenticated USING (public.amd_os_is_member());
DROP POLICY IF EXISTS "project_definitions_admin_write" ON public.project_definitions;
CREATE POLICY "project_definitions_admin_write" ON public.project_definitions
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "project_definitions_service" ON public.project_definitions;
CREATE POLICY "project_definitions_service" ON public.project_definitions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS amd_os_data_change_history_trigger ON public.project_definitions;
CREATE TRIGGER amd_os_data_change_history_trigger
  AFTER INSERT OR DELETE OR UPDATE ON public.project_definitions
  FOR EACH ROW EXECUTE FUNCTION public.amd_os_record_data_change('project_id');

-- ============================================================
-- 2. 事業の概要（事業の一言と詳しい説明）
-- ============================================================
CREATE TABLE IF NOT EXISTS public.project_business_summaries (
  project_id        text PRIMARY KEY REFERENCES public.projects(project_id) ON DELETE CASCADE,
  summary           text,
  detail            text,
  created_by_email  text,
  updated_by_email  text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.project_business_summaries IS '事業の概要（何をする事業か）。会社情報 > 会社概要に出す正本で、書けるのは管理者だけ。project_ventures.short_description / long_description はここから写す控え。migration 468（2026-10-04 まさ確定）';
COMMENT ON COLUMN public.project_business_summaries.summary IS '事業の一言。技術・製品・用途・顧客・出自だけを書く。出資・調達・採択・予定・進み具合は書かない（置き場は資本政策表・重要な動き・ゴールツリー）';
COMMENT ON COLUMN public.project_business_summaries.detail IS '事業の詳しい説明。決まりは summary と同じ';

ALTER TABLE public.project_business_summaries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "project_business_summaries_members_read" ON public.project_business_summaries;
CREATE POLICY "project_business_summaries_members_read" ON public.project_business_summaries
  FOR SELECT TO authenticated USING (public.amd_os_is_member());
DROP POLICY IF EXISTS "project_business_summaries_admin_write" ON public.project_business_summaries;
CREATE POLICY "project_business_summaries_admin_write" ON public.project_business_summaries
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "project_business_summaries_service" ON public.project_business_summaries;
CREATE POLICY "project_business_summaries_service" ON public.project_business_summaries
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS amd_os_data_change_history_trigger ON public.project_business_summaries;
CREATE TRIGGER amd_os_data_change_history_trigger
  AFTER INSERT OR DELETE OR UPDATE ON public.project_business_summaries
  FOR EACH ROW EXECUTE FUNCTION public.amd_os_record_data_change('project_id');

-- 正本 → 控え（project_ventures の2列）へ写す。写すときだけ amd.business_summary_sync を立てて、下の止めを通す。
CREATE OR REPLACE FUNCTION public.project_business_summaries_sync_venture()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
BEGIN
  PERFORM set_config('amd.business_summary_sync', 'on', true);
  IF TG_OP = 'DELETE' THEN
    UPDATE public.project_ventures
       SET short_description = NULL, long_description = NULL, updated_at = now()
     WHERE project_id = OLD.project_id
       AND (short_description IS NOT NULL OR long_description IS NOT NULL);
  ELSE
    UPDATE public.project_ventures
       SET short_description = NEW.summary, long_description = NEW.detail, updated_at = now()
     WHERE project_id = NEW.project_id
       AND (short_description IS DISTINCT FROM NEW.summary OR long_description IS DISTINCT FROM NEW.detail);
  END IF;
  PERFORM set_config('amd.business_summary_sync', '', true);
  RETURN NULL;
END;
$fn$;

DROP TRIGGER IF EXISTS project_business_summaries_sync_venture ON public.project_business_summaries;
CREATE TRIGGER project_business_summaries_sync_venture
  AFTER INSERT OR UPDATE OR DELETE ON public.project_business_summaries
  FOR EACH ROW EXECUTE FUNCTION public.project_business_summaries_sync_venture();

-- ============================================================
-- 3. project_ventures の2列を直に書き換えるのを止める（入口は会社概要の1つだけ）
-- ============================================================
CREATE OR REPLACE FUNCTION public.project_ventures_business_summary_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  rule constant text := '事業の一言と詳しい説明は、会社情報 > 会社概要の「事業の概要」（project_business_summaries）から直す。project_ventures.short_description / long_description はそこから写す控え（2026-10-04 まさ確定、migration 468）';
BEGIN
  IF coalesce(current_setting('amd.business_summary_sync', true), '') = 'on' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.short_description IS NOT NULL OR NEW.long_description IS NOT NULL THEN
      RAISE EXCEPTION USING ERRCODE = 'check_violation', MESSAGE = rule;
    END IF;
    SELECT s.summary, s.detail INTO NEW.short_description, NEW.long_description
      FROM public.project_business_summaries s
     WHERE s.project_id = NEW.project_id;
    RETURN NEW;
  END IF;
  IF NEW.short_description IS DISTINCT FROM OLD.short_description
     OR NEW.long_description IS DISTINCT FROM OLD.long_description THEN
    RAISE EXCEPTION USING ERRCODE = 'check_violation', MESSAGE = rule;
  END IF;
  RETURN NEW;
END;
$fn$;

-- ============================================================
-- 4. 今の事業の一言を写し、12PJの文から一時的な情報を外す
-- （止めのトリガーを付ける前に写す。写したあとは正本を直し、控えはトリガーが追う）
-- ============================================================
INSERT INTO public.project_business_summaries (project_id, summary, detail, created_by_email, updated_by_email)
SELECT v.project_id, nullif(btrim(v.short_description), ''), nullif(btrim(v.long_description), ''), 'migration-468', 'migration-468'
  FROM public.project_ventures v
 WHERE coalesce(btrim(v.short_description), '') <> '' OR coalesce(btrim(v.long_description), '') <> ''
ON CONFLICT (project_id) DO NOTHING;

DROP TRIGGER IF EXISTS project_ventures_business_summary_guard ON public.project_ventures;
CREATE TRIGGER project_ventures_business_summary_guard
  BEFORE INSERT OR UPDATE OF short_description, long_description ON public.project_ventures
  FOR EACH ROW EXECUTE FUNCTION public.project_ventures_business_summary_guard();

UPDATE public.project_business_summaries SET detail = $m$2012年に設立された京都大学発のディープテックベンチャー。超軽量透明断熱材「SUFA（Super Functional Air）」の研究開発・製造販売を手がける。

SUFAは京都大学との共同研究により開発したシリカエアロゲルで、体積の90％以上が空気という多孔質構造を持つ。最大の特徴は、世界最高レベルの断熱性能（熱伝導率0.012～0.014W/m・K）と高い透明性（可視光透過率90％以上）を両立している点。

従来エアロゲルの製造には超臨界乾燥装置という高価な装置が必須で、量産コストの高さから宇宙開発など限られた分野でしか使われてこなかった。ティエムファクトリは独自のレシピを開発し、常圧で板状エアロゲルの大判化に成功。製造コストを大幅に抑え、建築・自動車・物流といった幅広い市場への実装を目指している。

製品形態はモノリス（板状）タイプ、パウダー（粉状）タイプ、ブランケット（布状）タイプの3種類。茨城県に研究開発拠点「茨城エアロゲルテクノロジーセンター」を持ち、粉状SUFAを搭載した多機能フィルム「HERA BARRIER（ヘラバリア）」を窓用の省エネフィルムとして販売している。本社は茨城県茨城町、代表取締役社長は倉田真弥氏。$m$, updated_by_email = 'migration-468', updated_at = now() WHERE project_id = 'p03';
UPDATE public.project_business_summaries SET summary = $m$東北大発の農業用自律走行ロボット「Adam」と農場管理DX基盤「Newton」$m$, detail = $m$東北大発の農業用自律走行ロボット「Adam」と農場管理DX基盤「Newton」を開発。草刈り・運搬などのマルチアタッチメントに対応する。$m$, updated_by_email = 'migration-468', updated_at = now() WHERE project_id = 'p04';
UPDATE public.project_business_summaries SET summary = $m$筑波大発の虚血性脳卒中治療薬 CTB211$m$, updated_by_email = 'migration-468', updated_at = now() WHERE project_id = 'p06';
UPDATE public.project_business_summaries SET summary = $m$量研（QST）発のリチウム回収$m$, updated_by_email = 'migration-468', updated_at = now() WHERE project_id = 'p07';
UPDATE public.project_business_summaries SET summary = $m$廃棄物の熱分解リサイクル（熱分解装置の遠隔管理と、流動層熱分解）$m$, updated_by_email = 'migration-468', updated_at = now() WHERE project_id = 'p09';
UPDATE public.project_business_summaries SET summary = $m$山口大学発の塩分濃度差発電（逆電気透析）$m$, updated_by_email = 'migration-468', updated_at = now() WHERE project_id = 'p11';
UPDATE public.project_business_summaries SET summary = $m$波力発電$m$, updated_by_email = 'migration-468', updated_at = now() WHERE project_id = 'p18';
UPDATE public.project_business_summaries SET summary = $m$NIMS発の磁気冷凍（断熱消磁）方式の極低温冷凍機を開発・製造・販売する。主な製品は、X線計測や量子計測に使う超伝導転移端センサー（TES）向けの研究機関用冷凍機。$m$, updated_by_email = 'migration-468', updated_at = now() WHERE project_id = 'p20';
UPDATE public.project_business_summaries SET summary = $m$愛媛大学発のシアノバクテリアによる排水処理（重金属の回収・着色排水の浄化）と、菌体のバイオ燃料への利用$m$, updated_by_email = 'migration-468', updated_at = now() WHERE project_id = 'p21';
UPDATE public.project_business_summaries SET summary = $m$東京大学 古澤・遠藤研発の光量子コンピュータ。冷却が要らない常温常圧動作と時間多重による大規模化が特徴。$m$, detail = $m$光方式の量子コンピュータを開発する東京大学発スタートアップ。超伝導やイオントラップと違い冷却装置を必要とせず、常温常圧で動く。時間多重によって1万量子モード級の大規模化を狙う点が他方式にない特性。商用機「MoQuren」を持つ。$m$, updated_by_email = 'migration-468', updated_at = now() WHERE project_id = 'p22';
UPDATE public.project_business_summaries SET summary = $m$マグナス式垂直軸風力発電 (プロペラ無し)。台風・乱風下でも発電可能。$m$, updated_by_email = 'migration-468', updated_at = now() WHERE project_id = 'p24';
UPDATE public.project_business_summaries SET summary = $m$KENQとの協業レーン。SiC/SiC系CMC耐熱材料と、AIヒアリング・組織成長プラットフォームをつなぐ。$m$, detail = $m$KENQの研究事業化プロセスDB・AIヒアリング構想と、SiC/SiC CMC耐熱材料スタートアップの事業化（宇宙機の再突入時の熱防護と、宇宙以外の用途）を扱う協業。$m$, updated_by_email = 'migration-468', updated_at = now() WHERE project_id = 'p29';

-- ============================================================
-- 5. CX の沿革から、Build VC の出資想定と設立予定（未来の項目）を外す
-- ============================================================
UPDATE public.project_ventures SET narrative_text = $m$[{"date":"2025-11-01","title":"AMDによるディープテックPJ「CryoX」創業者支援を開始","detail":"NIMS発の磁気冷凍技術を事業化するディープテックPJ「CryoX」に対して、株式会社チームアルマダ（AMD）による創業者支援が開始されました。これにより、PJの技術開発と事業構想の推進が加速します。"},{"date":"2026-04-01","title":"磁気冷凍素子がTRL3に到達","detail":"PJ「CryoX」の基盤技術である磁気冷凍素子が技術成熟度レベル3（TRL3）に到達しました。"}]$m$, updated_at = now()
 WHERE project_id = 'p20' AND narrative_text LIKE '%Build VC%';

-- ============================================================
-- 6. つくよみの指示文から、事業概要を書き直す道具の行を外す
-- ============================================================
INSERT INTO public.llm_prompt_revisions (prompt_key, body_before, body_after, updated_by, updated_at)
SELECT prompt_key,
       body,
       replace(body,
         '- update_short_long_description(short?, long?): 事業概要 (short=1 行 / long=詳細) を書き直す',
         '- 事業の概要（会社概要）とPJの定義（PJ概要）は書き換えない。直すのは管理者が画面から（2026-10-04 まさ確定）'),
       'migration-468',
       now()
  FROM public.llm_prompts
 WHERE prompt_key = 'tsukuyomi.system'
   AND position('update_short_long_description' in body) > 0;

UPDATE public.llm_prompts
   SET body = replace(body,
         '- update_short_long_description(short?, long?): 事業概要 (short=1 行 / long=詳細) を書き直す',
         '- 事業の概要（会社概要）とPJの定義（PJ概要）は書き換えない。直すのは管理者が画面から（2026-10-04 まさ確定）'),
       notes = coalesce(notes || E'\n', '') || '2026-10-04 migration 468: 事業概要を書き直す道具を外した（入口は会社概要の1つだけ）',
       updated_by = 'migration-468',
       updated_at = now()
 WHERE prompt_key = 'tsukuyomi.system'
   AND position('update_short_long_description' in body) > 0;

-- ============================================================
-- 検証: そろっていなければ全体を巻き戻す
-- ============================================================
DO $v$
DECLARE
  mismatched text;
  blocked boolean := false;
  before_short text;
  after_short text;
BEGIN
  -- 控えが正本と一致している
  SELECT string_agg(v.project_id, ', ') INTO mismatched
    FROM public.project_ventures v
    LEFT JOIN public.project_business_summaries s ON s.project_id = v.project_id
   WHERE v.short_description IS DISTINCT FROM s.summary
      OR v.long_description IS DISTINCT FROM s.detail;
  IF mismatched IS NOT NULL THEN RAISE EXCEPTION 'venture copies differ from business summaries: %', mismatched; END IF;

  -- 12PJの文に一時的な情報が残っていない
  SELECT string_agg(project_id, ', ') INTO mismatched
    FROM public.project_business_summaries
   WHERE project_id IN ('p03','p04','p06','p07','p09','p11','p18','p20','p21','p22','p24','p29')
     AND (coalesce(summary, '') || coalesce(detail, '')) ~ '(出資|調達|採択|予定|想定|TRL ?[0-9]|Step ?[0-9]|PoC|20[0-9]{2}-[0-9]{2}|AMD ?関与|AMDの関与|AMDは)';
  IF mismatched IS NOT NULL THEN RAISE EXCEPTION 'temporary info remains in business summaries: %', mismatched; END IF;
  IF (SELECT count(*) FROM public.project_business_summaries
       WHERE project_id IN ('p03','p04','p06','p07','p09','p11','p18','p20','p21','p22','p24','p29')) <> 12 THEN
    RAISE EXCEPTION 'expected 12 cleaned business summaries';
  END IF;

  -- 控えを直に書き換えると止まる
  SELECT short_description INTO before_short FROM public.project_ventures WHERE project_id = 'p20';
  BEGIN
    UPDATE public.project_ventures SET short_description = 'guard test' WHERE project_id = 'p20';
  EXCEPTION WHEN check_violation THEN
    blocked := true;
  END;
  SELECT short_description INTO after_short FROM public.project_ventures WHERE project_id = 'p20';
  IF NOT blocked OR after_short IS DISTINCT FROM before_short THEN
    RAISE EXCEPTION 'direct write to project_ventures.short_description was not blocked';
  END IF;

  -- CX の沿革に出資想定と未来の項目が無い
  IF EXISTS (SELECT 1 FROM public.project_ventures WHERE project_id = 'p20' AND (narrative_text LIKE '%Build VC%' OR narrative_text LIKE '%予定%')) THEN
    RAISE EXCEPTION 'CX narrative still has temporary items';
  END IF;

  -- つくよみが概要を書き直す道具の行が無い
  IF EXISTS (SELECT 1 FROM public.llm_prompts WHERE prompt_key = 'tsukuyomi.system' AND position('update_short_long_description' in body) > 0) THEN
    RAISE EXCEPTION 'tsukuyomi.system still lists update_short_long_description';
  END IF;
END $v$;

COMMIT;
