-- 274_ehm_ishihara_management_seed.sql
--
-- p30 (EHM = 愛媛大エコシステム構築PJ) を、石原先生の産連業務ポートフォリオの
-- 経営管理面として立ち上げる。まさ確定 2026-08-13:
-- 「SXワークスペースと同じコンテンツを石原先生用に作る方がよくない?」
--
-- migration 271 で workspace_work_cases へ入れた29業務を、SX面と同じ
-- objective → outcome → milestone の構造へ移す。これにより p30 は
-- /project/p30/workspace で p21 (SX) と同じ判定バー・統合タイムライン・
-- 論点/仮説・管理台帳を持つ。柱は migration 273 の p30 6領域。
--
-- 出典: 石原_業務一覧_研究開発OS用_1.xlsx (2026-06末版スナップショット)。
-- 全件 date_certainty='provisional' / confidence='unknown' / status='unassessed'。
-- 本人の現況確認が済むまで、期日も進捗も確定扱いにしない。
--
-- 1業務 = 1マイルストーン。複数工程を持つ業務 (Y-02 アイデアピッチ、E-02 LEADING EDGE) は
-- 全体期間を planned_start/end に置き、工程の内訳を completion_criteria へ文字で残す。
-- 工程単位への分解は、現況確認で日程が確定してから sub_items で行う。
--
-- 冪等性: ON CONFLICT (project_id, slug) DO NOTHING。HITL更新済みの行を再実行で戻さない。

DO $$
BEGIN
  IF (SELECT count(*) FROM project_management_tracks WHERE project_id = 'p30') <> 6 THEN
    RAISE EXCEPTION 'p30 の柱6本が未登録 (migration 273 未適用?)';
  END IF;
END $$;

-- =====================================================================
-- 1. objective
-- =====================================================================
INSERT INTO project_management_objectives (
  project_id, slug, title, definition_of_done, target_date, date_certainty,
  status, last_verified_at, confidence, source_kind, source_ref
)
VALUES (
  'p30', 'ehime-ecosystem-fy2026',
  '2026年度 愛媛大の産学連携・地域イノベーションエコシステム構築',
  'YURUGAS運営、企業連携、教育プログラム、研究成果発信、資金・申請、組織インフラの6領域が、担当者の記憶に依存せず期限とボールの所在で管理されている状態。',
  DATE '2027-03-31', 'provisional',
  'unassessed', DATE '2026-06-30', 'unknown', 'imported', 'ishihara_worklist_20260630'
)
ON CONFLICT (project_id, slug) DO NOTHING;

-- =====================================================================
-- 2. outcome (6領域 = 柱と1対1)
-- =====================================================================
INSERT INTO project_management_outcomes (
  project_id, objective_id, slug, track, title, definition_of_done,
  owner_label, status, last_verified_at, confidence, source_kind, source_ref
)
SELECT 'p30', o.id, v.slug, v.track, v.title, v.dod, '石原先生',
       'unassessed', DATE '2026-06-30', 'unknown', 'imported', 'ishihara_worklist_20260630'
FROM project_management_objectives o,
(VALUES
  ('yurugas-program',     'yurugas_program',     'YURUGAS運営・基盤が非属人で回る',       '起業塾・アイデアピッチ・SA制度・年間WBS・対外発信が、年間工程と担当で管理されている'),
  ('corporate-alliance',  'corporate_alliance',  '企業連携・共創PJの型が確立する',         'パートナーティア、料金・契約区分、個別共創PJの進行が一元管理されている'),
  ('education-program',   'education_program',   '外部教育プログラムとの連携が続く',       'Setouchi Global Bootcamp、LEADING EDGE四国、EDGE-PRIMEの役割と工程が管理されている'),
  ('research-paper',      'research_paper',      '研究成果の発信が滞らない',               '投稿中・採択済の論文と科研費の締切・共著者調整が期限管理されている'),
  ('funding-application', 'funding_application', '資金・申請の締切を落とさない',           '申請の締切、提出状況、整合確認が追跡されている'),
  ('org-infrastructure',  'org_infrastructure',  '組織・運営インフラが体制移行に耐える',   '本務OI/SUとUA室兼務の役割境界、Notion/M365基盤、学チャレ関係が整理されている')
) AS v(slug, track, title, dod)
WHERE o.project_id = 'p30' AND o.slug = 'ehime-ecosystem-fy2026'
ON CONFLICT (project_id, slug) DO NOTHING;

-- =====================================================================
-- 3. milestone (29業務)
--    planned_start/end は元資料から読める範囲。読めないものは年度期間を仮置きし、
--    date_certainty='provisional' で仮であることを示す。
-- =====================================================================
INSERT INTO project_management_milestones (
  project_id, objective_id, outcome_id, slug, track, title, gate, status,
  planned_start, planned_end, progress_pct, date_certainty,
  owner_label, next_deliverable, max_issue, completion_criteria, criticality,
  last_verified_at, confidence, source_kind, source_ref
)
SELECT 'p30', o.id, oc.id, v.slug, v.track, v.title, v.gate, 'unassessed',
       v.p_start, v.p_end, 0, 'provisional',
       v.owner, v.next_deliverable, v.max_issue, v.completion_criteria, v.criticality,
       DATE '2026-06-30', 'unknown', 'imported', 'ishihara_worklist_20260630'
FROM project_management_objectives o
JOIN project_management_outcomes oc ON oc.project_id = 'p30'
JOIN (VALUES
  -- YURUGAS運営・基盤
  ('y-01', 'yurugas_program', 'yurugas-program', 'えひめ学生起業塾2026 設計・運営', '年間設計 → 実施', DATE '2026-04-01', DATE '2027-03-31', '石原先生 / 石原研究室・SA', '通年運営の現況と次回実施回の確認', '2026-06末版のため現況未確認', '実践コース・起業コースの二トラックが年間工程・担当・資料つきで管理されている', 'medium'),
  ('y-02', 'yurugas_program', 'yurugas-program', 'YURUGAS アイデアピッチ2026 の運営', '告知・募集 → 審査 → 検証 → Demo Day', DATE '2026-06-20', DATE '2027-03-31', '石原先生 / 研究イノベーション推進本部SU・学チャレ・えひめベンチャー支援機構', '募集・審査・検証・Demo Dayの各期日の現況確認', '各工程の日程が2026-06末版のまま。経過分の実績が未確認', '工程: 告知6月下旬〜 / 募集7-15〜9-3正午 / 二次審査9-12〜13 / 最終審査会10-10 / 検証11月〜1月 / Demo Day令和9年2〜3月。賞金なし・実装資源で支援。最終審査員候補: 野口氏・中矢社長・粟生氏', 'high'),
  ('y-03', 'yurugas_program', 'yurugas-program', 'SAニアピア・メンターシップ制度 設計・運営', '制度設計 → 通年運用', DATE '2026-04-01', DATE '2027-03-31', '石原先生 / 正課生SA', '運用状況の確認', '2026-06末版のため現況未確認', '非属人化のエンジン(朝礼-伴走-夕方デブリーフ)が回っている', 'medium'),
  ('y-04', 'yurugas_program', 'yurugas-program', '年間プログラムWBS 維持・更新', '随時更新', DATE '2026-04-01', DATE '2027-03-31', '石原先生 / 石原研究室', 'Excel全体ガントの最新版をOSへ接続する', '全プログラム横断のExcelガントとOSの二重管理になりうる', 'Excel全体ガント(全プログラム横断)の内容がOS側の工程管理と一致している', 'high'),
  ('y-05', 'yurugas_program', 'yurugas-program', 'YURUGAS 対外SNS発信戦略', '随時', DATE '2026-04-01', DATE '2027-03-31', '石原先生', '発信テーマ・素材・確認者の運用確認', '2026-06末版のため現況未確認', '発信カレンダー、素材、確認状態が管理されている', 'medium'),
  ('y-06', 'yurugas_program', 'yurugas-program', 'アイデアピッチ 協賛・伴走パートナーの募集・マッチング', '募集 → 伴走マッチング', DATE '2026-07-01', DATE '2026-12-31', '石原先生 / 地域企業・経営者・支援機関', '伴走者候補の接触状況の確認', '10月下旬〜の伴走マッチング日程が月精度', '伴走/実証フィールド/物資/体験/広報の5類型で候補が管理され、伴走者の事前講座受講まで追えている', 'high'),
  -- 企業連携・共創PJ
  ('p-01', 'corporate_alliance', 'corporate-alliance', '包括／戦略パートナー ティア構造設計', '設計 → 運用', DATE '2026-04-01', DATE '2027-03-31', '石原先生', '設計済の内容と運用状況の確認', '2026-06末版で「設計済」。運用移行の状況が未確認', '包括3階層＋戦略パートナー、個別PJの難易度課金が運用に載っている', 'medium'),
  ('p-02', 'corporate_alliance', 'corporate-alliance', '共創PJ 企業パートナーピッチ資料', 'ソース文書 → スライド生成', DATE '2026-04-01', DATE '2027-03-31', '石原先生', 'NotebookLMでのスライド生成の完了確認', '2026-06末版で「ソース文書完成・生成プロンプト作成済」', 'ピッチ資料が企業提案に使える状態で存在する', 'medium'),
  ('p-03', 'corporate_alliance', 'corporate-alliance', '水咲(株)中村結菜氏との共創PJキックオフ', '調整 → 説明会・キックオフ', DATE '2026-06-01', DATE '2026-09-30', '石原先生 / 中村結菜氏・大久保先生', '説明会・キックオフの実施日確認', '「直近」とだけあり期日未確認', '説明会とキックオフが実施され、PJの体制・工程が決まっている', 'high'),
  ('p-04', 'corporate_alliance', 'corporate-alliance', '企業パートナー料金・契約構造 運用', '随時', DATE '2026-04-01', DATE '2027-03-31', '石原先生 / 学チャレ', '契約区分の運用状況の確認', '2026-06末版のため現況未確認', '学チャレ会費と大学直接の共同研究契約の区分が管理されている', 'medium'),
  -- 教育プログラム
  ('e-01', 'education_program', 'education-program', 'Setouchi Global Bootcamp 2026 設計・運営', '設計 → 8月開催', DATE '2026-06-01', DATE '2026-08-31', '石原先生 / Rajesh・SA・小島くん', '開催日の確定と事前SA研修の実施確認', '開催が「8月」の月精度。実施済みかどうかが未確認', 'Zero2Maker形式で開催され、事前SA研修(90分)が実施されている', 'high'),
  ('e-02', 'education_program', 'education-program', 'LEADING EDGE 四国 への関与', '応募 → 合宿 → 最終', DATE '2026-06-01', DATE '2027-01-30', '石原先生 / 伊予銀行・Anc & Partners・PM5名', '各期日の現況確認と石原先生の関与範囲の確定', 'Early6-30とRegular8-10の応募締切が経過。合宿8-28〜30の準備状況が未確認', '工程: Early応募6-30 / Regular応募8-10 / 合宿8-28〜30 / 最終1-30。AKATSUKIプロジェクト(経産省補助)コンソーシアムでの役割が明確', 'high'),
  ('e-03', 'education_program', 'education-program', 'EDGE-PRIME との連携', '随時', DATE '2026-04-01', DATE '2027-03-31', '石原先生 / 国広アキム氏', '連携内容と次の展開の確認', '2026-06末版のため現況未確認', '高校生向け・PSI/JST STARTのパートナープログラムとしての連携内容と次アクションが管理されている', 'medium'),
  -- 研究・論文
  ('r-01', 'research_paper', 'research-paper', 'ISAM 2026 フルペーパー', '執筆 → 提出', DATE '2026-06-01', DATE '2026-12-31', '石原先生 / 富田先生・Rajesh', '提出締切の確認と原稿の現況確認', 'ISAM2026の提出期日が未確認。2026-06末時点で5ページ執筆中', '三層地域メイカーエコシステム×IM-ZPDのフルペーパーが提出されている', 'high'),
  ('r-02', 'research_paper', 'research-paper', '地域活性学会 第18回 拡張要旨', '修正 → 提出', DATE '2026-06-01', DATE '2026-07-06', '石原先生', '提出済みかどうかの確認', '締切2026-07-06が経過。提出状況が未確認', 'A4 4ページ予稿が執筆要領に沿って提出されている', 'high'),
  ('r-03', 'research_paper', 'research-paper', 'JSSE 2026 加藤先生共著論文', '最終稿確認 → 提出', DATE '2026-06-01', DATE '2026-09-30', '石原先生 / 加藤先生', '最終稿の確定と提出状況の確認', '「直近」とだけあり期日未確認。著者順とZ2E用語の整理が残っていた', '著者順とZ2E用語が整理された最終稿が提出されている', 'high'),
  ('r-04', 'research_paper', 'research-paper', 'JICSB論文(Taylor & Francis採択) のフォローアップ', '採択済 → 活用', DATE '2026-04-01', DATE '2027-03-31', '石原先生 / Marui・Koyama', '採択後の展開(公開・共有・発展先)の確認', '2026-06末版のため現況未確認', '『Generative AI and Mindset Shifts…』の採択後アクションが整理されている', 'medium'),
  ('r-05', 'research_paper', 'research-paper', '科研費 JP25K06569', '遂行 → 2028年3月まで', DATE '2026-04-01', DATE '2028-03-31', '石原先生', '年度の執行状況と報告期限の確認', '研究期間の終了は2028年3月(月精度)。年度報告の期限が未確認', '研究費の執行・成果・報告が期限どおり管理されている', 'medium'),
  -- 資金・申請
  ('f-01', 'funding_application', 'funding-application', 'JST 目利き人材育成プログラム', '申請 → 結果', DATE '2026-05-01', DATE '2026-06-17', '石原先生 / 杉浦先生', '提出済みかどうかのフォロー', '締切2026-06-17が経過。提出済みか未確認 (元資料に「要確認」)', 'GAP Fund STEP2支援に接続する申請の提出状況と結果が確認されている。SX/杉浦先生との接点あり', 'high'),
  ('f-02', 'funding_application', 'funding-application', 'スタエコ形成支援(NEXTグローバル拠点 追加支援)', '整合管理 → 申請', DATE '2026-04-01', DATE '2027-03-31', '石原先生', '申請書・予算計画と公開文書の整合確認', '申請の期日が未確認', '申請書・予算計画と公開文書の記載が整合している', 'high'),
  -- 組織・運営インフラ
  ('o-01', 'org_infrastructure', 'org-infrastructure', '地域価値創造研究室 PI運営', '通年', DATE '2026-04-01', DATE '2027-03-31', '石原先生 / 大久保先生', '運営状況の確認', '2026-06末版のため現況未確認', '石原研究室／大久保研究室のPI運営が回っている', 'medium'),
  ('o-02', 'org_infrastructure', 'org-infrastructure', '研究イノベーション推進本部 OI/SUユニット(本務所属)', '再編 → 本務継続', DATE '2026-07-01', DATE '2027-03-31', '石原先生', 'UA室兼務(o-07)との役割境界の確認', '7-1再編後の本務範囲と、8月以降の兼務との配分が未確認', '産学連携推進本部からの再編後、本務としての責任範囲が明確になっている', 'high'),
  ('o-03', 'org_infrastructure', 'org-infrastructure', 'Notion 3DB「石原裕香OS」運用', '随時', DATE '2026-04-01', DATE '2027-03-31', '石原先生', 'OSへの接続方式の確認', '契約・人脈・議事録の3DBとEHM OSの役割分担が未確定', '契約・人脈・議事録の3データベースが、EHM OSと二重管理にならずに使われている', 'high'),
  ('o-04', 'org_infrastructure', 'org-infrastructure', 'Notion–Slack連携アーキテクチャ', '随時', DATE '2026-04-01', DATE '2027-03-31', '石原先生', '運用状況の確認', '2026-06末版のため現況未確認', 'ストック&フロー型の連携が運用されている', 'medium'),
  ('o-05', 'org_infrastructure', 'org-infrastructure', 'Microsoft 365 データ管理基盤 運用', '随時', DATE '2026-04-01', DATE '2027-03-31', '石原先生', 'EHM OSからの読み取り経路(委任同意またはエクスポート)の可否確認', '大学テナントの権限方針が未確認。直接抽出は前提にしない', 'M365上の予定・メール・資料のうち、どれをどの経路でOSへ渡すかが決まっている', 'high'),
  ('o-06', 'org_infrastructure', 'org-infrastructure', '学チャレ合同会社 関係管理', '随時', DATE '2026-04-01', DATE '2027-03-31', '石原先生 / 学チャレ', '関係・役割・利益相反境界の確認', '2026-06末版のため現況未確認', '共創PJ PMO・共同研究パートナーとしての関係と役割境界が管理されている(石原先生は役員ではない)', 'medium'),
  ('o-07', 'org_infrastructure', 'org-infrastructure', '経営戦略本部 UA室 での横断支援機能(兼務)', '8月〜 新体制', DATE '2026-08-01', DATE '2027-03-31', '石原先生 / 経営戦略本部', '新体制での実務範囲と負荷の確認', '8月開始の新体制。OI/SU本務との配分と、増える業務量が未確認', '企画立案／情報収集・分析／企画書・申請書作成／接続・調整／PJ推進／可視化・案件化を、教育・研究・地域・国際を横断して社会実装へ接続する。特定事業の単独運営はしない', 'high'),
  ('o-08', 'org_infrastructure', 'org-infrastructure', 'UA職名称付与の応募(抱負書の提出)', '提出 → 審査', DATE '2026-07-01', DATE '2026-08-31', '石原先生 / 経営戦略本部', '提出状況と審査結果の確認', '「8月新体制に向け」の月精度。審査中', '社会実装支援領域での名称付与が決まり、名称付与期間の5目標が確定している', 'high'),
  ('o-09', 'org_infrastructure', 'org-infrastructure', '研究開発OS(EHM OS)の開発・実証', 'PSI(STEP2)と並走し段階開発', DATE '2026-06-01', DATE '2027-03-31', '石原先生 / 山地さん(AMD)', '現況更新ヒアリングの実施と、業務ポートフォリオの確認済み化', '初期データが2026-06末版のまま。本人確認が未実施', '非属人化の運営基盤として、現場の価値を大学戦略へ翻訳する仕組みが動いている。本業務一覧そのものが入力素材', 'high')
) AS v(slug, track, outcome_slug, title, gate, p_start, p_end, owner, next_deliverable, max_issue, completion_criteria, criticality)
  ON oc.slug = v.outcome_slug
WHERE o.project_id = 'p30' AND o.slug = 'ehime-ecosystem-fy2026'
ON CONFLICT (project_id, slug) DO NOTHING;

-- =====================================================================
-- 事後assert
-- =====================================================================
DO $$
DECLARE v_ms integer; v_oc integer;
BEGIN
  SELECT count(*) INTO v_oc FROM project_management_outcomes WHERE project_id = 'p30';
  SELECT count(*) INTO v_ms FROM project_management_milestones WHERE project_id = 'p30';
  IF v_oc <> 6 THEN RAISE EXCEPTION 'p30 の成果が % 件 (想定=6)', v_oc; END IF;
  IF v_ms <> 29 THEN RAISE EXCEPTION 'p30 のマイルストーンが % 件 (想定=29)', v_ms; END IF;
END $$;
