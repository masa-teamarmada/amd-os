-- 275_ehm_ishihara_issues.sql
--
-- p30 (石原先生の産連業務ポートフォリオ) の論点・仮説台帳を立てる。
-- 出典は 石原_業務一覧_研究開発OS用_1.xlsx (2026-06末版) から読み取れる未決事項のみ。
-- 先生本人の発言として確認できていないものは 'hypothesis' (仮説) とし、'fact' にはしない。
--
-- knowledge_type: fact / hypothesis / decision_needed / decision
-- status: open / validating / closed / on_hold
--
-- 冪等性: ON CONFLICT (project_id, slug) DO NOTHING。

INSERT INTO project_management_issues (
  project_id, outcome_id, slug, track, title, knowledge_type, status,
  owner_label, due_date, last_verified_at, confidence, source_kind, source_ref, sort_order, background
)
SELECT 'p30', oc.id, v.slug, v.track, v.title, v.ktype, 'open',
       v.owner, v.due_date, DATE '2026-06-30', 'unknown', 'imported', 'ishihara_worklist_20260630', v.sort_order, v.background
FROM project_management_outcomes oc
JOIN (VALUES
  ('role-boundary-ua-room', 'org_infrastructure', 'org-infrastructure',
   '本務(OI/SUユニット)とUA室兼務の役割境界をどう引くか',
   'decision_needed', '石原先生 / 経営戦略本部', DATE '2026-09-30', 1,
   '2026-08から経営戦略本部UA室での横断支援機能を兼務する(O-07)。UA室は企画立案・情報収集分析・企画書申請書作成・接続調整・PJ推進・可視化案件化を教育/研究/地域/国際で横断し、特定事業の単独運営はしない建て付け。本務(O-02)との時間配分と、どちらで受ける仕事かの判定基準が未確定。石原先生の相談事項「業務がさらに増えようとしている」の主因はここ。'),
  ('notion-os-double-management', 'org_infrastructure', 'org-infrastructure',
   'Notion 3DBとEHM OSの二重管理をどう解消するか',
   'decision_needed', '石原先生 / AMD', NULL, 2,
   'O-03「石原裕香OS」は契約・人脈・議事録の3データベースで運用中。EHM OS側にも関係先・資料・議事録の器がある。どちらを正本にし、どちらを出典参照に留めるかを決めないと、先生の入力が二重になり設計憲法第1条(入力負担の純増ゼロ)に反する。'),
  ('wbs-excel-vs-os', 'yurugas_program', 'yurugas-program',
   '年間プログラムWBS(Excelガント)をOSへ移すか、出典として残すか',
   'decision_needed', '石原先生 / AMD', NULL, 3,
   'Y-04で全プログラム横断のExcel全体ガントを先生自身が維持している。EHM OSの統合タイムラインと同じ役割なので、放置すると二重管理になる。既存入力の移管(設計憲法第2条の例外)として一本化できれば、先生の総入力量は減る。'),
  ('m365-read-path', 'org_infrastructure', 'org-infrastructure',
   'M365(予定・メール)からの読み取り経路をどれにするか',
   'decision_needed', 'AMD / 石原先生 / 愛媛大情報部門', DATE '2026-09-30', 4,
   'O-05のM365基盤から進捗データを取りたいが、大学テナントのユーザー同意設定次第で委任同意が管理者承認待ちになる。候補は (1)委任同意でCalendars.Read (2)先生端末のローカルコネクタ (3)手動エクスポート (4)現行の共有Excel。計画は EHM_OS_M365_CONNECTION_PLAN_20260813.md。まさが先生のアカウントでログインする方式は取らない。'),
  ('worklist-freshness', 'org_infrastructure', 'org-infrastructure',
   '業務一覧29件の現況が2026-06末版のままである',
   'fact', 'AMD', DATE '2026-08-31', 5,
   'OSへ投入した29業務とその期日は 石原_業務一覧_研究開発OS用_1.xlsx の2026-06末版スナップショット。F-01(JST目利き 6/17)とR-02(地域活性学会 7/6)は締切が経過しているが提出済みかどうか未確認。現況更新ヒアリング(30-60分)が済むまで、この面の進捗表示を確定値として扱わない。'),
  ('contract-scope-fy2026', 'org_infrastructure', 'org-infrastructure',
   'EHM OSの契約スコープと課金単位をどう置くか',
   'decision_needed', 'まさ / 石原先生', DATE '2026-09-30', 6,
   'O-09で先生は研究開発OSの開発・実証を自分の業務として持っており(PSI STEP2と並走、担当=山地さん)、予算も一部確保している。年度業務委託を器に「EHM OS利用料 + データ整備・運用支援」を内訳で立てる案が設計たたき台の論点5-C。テーマ(SX/ゼオライト)追加が増額の自然な単位になる。')
) AS v(slug, track, outcome_slug, title, ktype, owner, due_date, sort_order, background)
  ON oc.slug = v.outcome_slug
WHERE oc.project_id = 'p30'
ON CONFLICT (project_id, slug) DO NOTHING;

DO $$
DECLARE v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM project_management_issues WHERE project_id = 'p30';
  IF v_count <> 6 THEN RAISE EXCEPTION 'p30 の論点が % 件 (想定=6)', v_count; END IF;
END $$;
