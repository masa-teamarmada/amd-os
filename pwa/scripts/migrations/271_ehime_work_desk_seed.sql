-- 271_ehime_work_desk_seed.sql
--
-- ehime ワークスペースの業務デスクへ、石原先生の業務一覧 29件を初期投入する。
-- 出典: 石原_業務一覧_研究開発OS用_1.xlsx (共有ドライブ ARMADA/p21_sx/260629_MTG_石原先生_AMD_OS仕様について_prep/)
--       = 2026-06末時点のスナップショット。本人の現況確認は未実施のため全行 data_status='unconfirmed'。
--       締切も経過/完了が未確認のため全行 status='unconfirmed' (現況更新ヒアリングで確定する)。
--
-- 冪等性: ケースは ON CONFLICT DO NOTHING (HITL更新済みの行を再実行で上書きしない)。
--         締切は (case_id, label) の NOT EXISTS ガード。
-- priority_wave: 1=締切駆動(第1波) / 2=定常運営(第2波) / 3=UA室横断(第3波)。

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM institution_workspaces WHERE slug = 'ehime') THEN
    RAISE EXCEPTION 'institution_workspaces に slug=ehime が存在しない (migration 212 未適用?)';
  END IF;
END $$;

WITH ws AS (
  SELECT id FROM institution_workspaces WHERE slug = 'ehime'
)
INSERT INTO workspace_work_cases (
  workspace_id, case_code, title, domain, case_kind, status_label,
  frequency_deadline_note, stakeholders, next_action, notes,
  data_status, source_note, priority_wave, sort_order
)
SELECT ws.id, v.case_code, v.title, v.domain, v.case_kind, v.status_label,
       v.freq_note, v.stakeholders, v.next_action, v.notes,
       'unconfirmed', '石原_業務一覧_研究開発OS用_1.xlsx (2026-06末版スナップショット)', v.wave, v.sort_order
FROM ws,
(VALUES
  ('Y-01', 'えひめ学生起業塾2026 設計・運営', '1 YURUGAS運営・基盤', '定常(年間)', '運営中', '通年', '石原研究室／SA', NULL, '実践コース・起業コースの二トラック', 2, 10),
  ('Y-02', 'YURUGAS アイデアピッチ2026 の運営（実施要項・募集案内）', '1 YURUGAS運営・基盤', 'プロジェクト', '公開準備(v4)', '告知6月下旬〜／募集7/15-9/3正午／二次審査9/12-13／最終審査会10/10／検証11月-1月／Demo Day令和9年2-3月', '研究イノベーション推進本部SU／学チャレ／えひめベンチャー支援機構', NULL, '賞金なし・実装資源で支援。ビジフェスEHIME→アイデアプランコンテストへ転換。最終審査員候補:野口氏・中矢社長・粟生氏', 1, 20),
  ('Y-03', 'SAニアピア・メンターシップ制度 設計・運営', '1 YURUGAS運営・基盤', '定常', '運営中', '通年', '正課生SA', NULL, '非属人化のエンジン(朝礼-伴走-夕方デブリーフ)', 2, 30),
  ('Y-04', '年間プログラムWBS 維持・更新', '1 YURUGAS運営・基盤', '定常', '運用中', '随時', '石原研究室', NULL, 'Excel全体ガント(全プログラム横断)', 2, 40),
  ('Y-05', 'YURUGAS 対外SNS発信戦略', '1 YURUGAS運営・基盤', '定常', '運用中', '随時', NULL, NULL, NULL, 2, 50),
  ('Y-06', 'アイデアピッチ 協賛・伴走パートナーの募集・マッチング', '1 YURUGAS運営・基盤', 'プロジェクト', '募集中', '10月下旬〜伴走マッチング', '地域企業・経営者・支援機関', NULL, '伴走/実証フィールド/物資/体験/広報の5類型。伴走者には事前講座受講を依頼', 1, 60),
  ('P-01', '包括／戦略パートナー ティア構造設計', '2 企業連携・共創PJ', 'プロジェクト', '設計済', NULL, NULL, NULL, '包括3階層＋戦略パートナー、個別PJは難易度課金', 2, 110),
  ('P-02', '共創PJ 企業パートナーピッチ資料', '2 企業連携・共創PJ', 'プロジェクト', 'ソース文書完成', NULL, NULL, NULL, 'NotebookLMでスライド生成(生成プロンプト作成済)', 2, 120),
  ('P-03', '水咲(株)中村結菜氏との共創PJキックオフ', '2 企業連携・共創PJ', 'プロジェクト', '調整中', '説明会・キックオフ直近', '中村結菜／大久保先生', NULL, NULL, 1, 130),
  ('P-04', '企業パートナー料金・契約構造 運用', '2 企業連携・共創PJ', '定常', '運用中', '随時', '学チャレ', NULL, '学チャレ会費 vs 大学直接の共同研究契約の区分管理', 2, 140),
  ('E-01', 'Setouchi Global Bootcamp 2026 設計・運営', '3 教育プログラム(連携・伴走)', 'プロジェクト', '設計中', '8月開催', 'Rajesh／SA／小島くん', NULL, 'Zero2Maker形式、事前SA研修(90分)', 1, 210),
  ('E-02', 'LEADING EDGE 四国 への関与', '3 教育プログラム(連携・伴走)', 'プロジェクト', '進行中', 'Early6/30・Regular8/10／合宿8/28-30／最終1/30', '伊予銀行／Anc & Partners／PM5名', NULL, 'AKATSUKIプロジェクト(経産省補助)コンソーシアム', 1, 220),
  ('E-03', 'EDGE-PRIME との連携', '3 教育プログラム(連携・伴走)', '連携', '連携中', '随時', '国広アキム氏', NULL, '高校生向け、PSI/JST START。パートナープログラム', 2, 230),
  ('R-01', 'ISAM 2026 フルペーパー', '4 研究・論文', 'プロジェクト(締切)', '執筆中(5ページ)', 'ISAM2026', '富田先生／Rajesh', NULL, '三層地域メイカーエコシステム×IM-ZPD', 1, 310),
  ('R-02', '地域活性学会 第18回 拡張要旨', '4 研究・論文', 'プロジェクト(締切)', '修正待ち', '7/6 締切', NULL, NULL, 'A4 4ページ予稿、執筆要領待ち', 1, 320),
  ('R-03', 'JSSE 2026 加藤先生共著論文', '4 研究・論文', 'プロジェクト(締切)', '最終稿確認', '直近', '加藤先生', NULL, '著者順・Z2E用語の整理', 1, 330),
  ('R-04', 'JICSB論文(Taylor & Francis採択)', '4 研究・論文', 'フォローアップ', '採択済', NULL, 'Marui／Koyama', NULL, '『Generative AI and Mindset Shifts…』', 2, 340),
  ('R-05', '科研費 JP25K06569', '4 研究・論文', '定常', '遂行中', '2028年3月まで', NULL, NULL, NULL, 2, 350),
  ('F-01', 'JST 目利き人材育成プログラム', '5 資金・申請', '申請(締切)', '要確認', '6/17締切(経過)', '杉浦先生', '提出済か要フォロー', 'GAP Fund STEP2支援。SX/杉浦先生関連', 1, 410),
  ('F-02', 'スタエコ形成支援(NEXTグローバル拠点 追加支援)', '5 資金・申請', '申請', '整合管理中', NULL, NULL, NULL, '申請書・予算計画と公開文書の整合', 1, 420),
  ('O-01', '地域価値創造研究室 PI運営', '7 組織・運営インフラ', '定常', '運営中', '通年', '大久保先生', NULL, '石原研究室／大久保研究室', 2, 510),
  ('O-02', '研究イノベーション推進本部 OI/SUユニット（本務所属）', '7 組織・運営インフラ', '定常', '継続', '7/1再編→8月以降も本務継続', NULL, NULL, '産学連携推進本部から再編。本務はここを継続。8月〜は経営戦略本部UA室を兼務(O-07)', 2, 520),
  ('O-03', 'Notion 3DB「石原裕香OS」運用', '7 組織・運営インフラ', '定常', '運用中', '随時', NULL, NULL, '契約・人脈・議事録の3データベース', 2, 530),
  ('O-04', 'Notion–Slack連携アーキテクチャ', '7 組織・運営インフラ', '定常', '運用中', '随時', NULL, NULL, 'ストック&フロー型', 2, 540),
  ('O-05', 'Microsoft 365 データ管理基盤 運用', '7 組織・運営インフラ', '定常', '運用中', '随時', NULL, NULL, NULL, 2, 550),
  ('O-06', '学チャレ合同会社 関係管理', '7 組織・運営インフラ', '定常', '運用中', '随時', '学チャレ', NULL, '共創PJ PMO・共同研究パートナー(石原は役員ではない)', 2, 560),
  ('O-07', '経営戦略本部 UA室 での横断支援機能（兼務・社会実装支援領域）', '7 組織・運営インフラ', '定常', '体制移行', '8月〜 新体制（OI/SU本務と兼務）', '経営戦略本部', NULL, 'OI/SU本務(O-02)と兼務・横断。企画立案／情報収集・分析／企画書・申請書作成／接続・調整／PJ推進／可視化・案件化。教育・研究・地域・国際を横断し社会実装へ接続。特定事業の単独運営はしない', 3, 570),
  ('O-08', 'UA職名称付与の応募（抱負書の提出）', '7 組織・運営インフラ', '申請', '提出・審査', '8月新体制に向け', '経営戦略本部', NULL, '希望:社会実装支援領域(研究/教育/国際/地域/その他)。名称付与期間の5目標を設定', 1, 580),
  ('O-09', '研究開発OS（ローカルAI）の開発・実証', '7 組織・運営インフラ', 'プロジェクト', '構想・着手', 'PSI(STEP2)と並走し段階開発', '山地さん', NULL, '非属人化の運営基盤。本一覧もその入力素材。現場の価値を大学戦略へ翻訳する仕組み', 1, 590)
) AS v(case_code, title, domain, case_kind, status_label, freq_note, stakeholders, next_action, notes, wave, sort_order)
ON CONFLICT (workspace_id, case_code) DO NOTHING;

-- =====================================================================
-- 締切・節目 (日付が読み取れるものだけ。範囲は終端/開始を label に明示。月精度は月初 + due_precision='month')
-- =====================================================================
WITH ws AS (
  SELECT id FROM institution_workspaces WHERE slug = 'ehime'
),
dl (case_code, label, due_date, due_precision, sort_order) AS (
  VALUES
    ('Y-02', '募集開始',                     DATE '2026-07-15', 'day',   10),
    ('Y-02', '募集締切(9/3正午)',            DATE '2026-09-03', 'day',   20),
    ('Y-02', '二次審査(9/12-13)',            DATE '2026-09-12', 'day',   30),
    ('Y-02', '最終審査会',                   DATE '2026-10-10', 'day',   40),
    ('Y-02', '検証期間(11月-1月)',           DATE '2026-11-01', 'month', 50),
    ('Y-02', 'Demo Day(令和9年2-3月)',       DATE '2027-02-01', 'month', 60),
    ('Y-06', '伴走マッチング開始(10月下旬〜)', DATE '2026-10-01', 'month', 10),
    ('E-01', '開催(8月)',                    DATE '2026-08-01', 'month', 10),
    ('E-02', 'Early応募締切',                DATE '2026-06-30', 'day',   10),
    ('E-02', 'Regular応募締切',              DATE '2026-08-10', 'day',   20),
    ('E-02', '合宿(8/28-30)',                DATE '2026-08-28', 'day',   30),
    ('E-02', '最終(1/30)',                   DATE '2027-01-30', 'day',   40),
    ('R-01', 'フルペーパー提出(ISAM2026・期日未確認)', NULL,    'vague', 10),
    ('R-02', '提出締切',                     DATE '2026-07-06', 'day',   10),
    ('R-03', '最終稿確認(直近・期日未確認)',  NULL,             'vague', 10),
    ('R-05', '研究期間終了(2028年3月)',       DATE '2028-03-01', 'month', 10),
    ('F-01', '申請締切(提出済か要確認)',      DATE '2026-06-17', 'day',   10),
    ('O-08', '抱負書提出(8月新体制に向け)',   DATE '2026-08-01', 'month', 10),
    ('P-03', '説明会・キックオフ(直近・期日未確認)', NULL,      'vague', 10)
)
INSERT INTO workspace_work_case_deadlines (case_id, label, due_date, due_precision, status, sort_order)
SELECT c.id, dl.label, dl.due_date, dl.due_precision, 'unconfirmed', dl.sort_order
FROM dl
JOIN ws ON TRUE
JOIN workspace_work_cases c ON c.workspace_id = ws.id AND c.case_code = dl.case_code
WHERE NOT EXISTS (
  SELECT 1 FROM workspace_work_case_deadlines d
  WHERE d.case_id = c.id AND d.label = dl.label
);

-- =====================================================================
-- 事後 assert: 29ケースが揃っていること
-- =====================================================================
DO $$
DECLARE v_count integer;
BEGIN
  SELECT count(*) INTO v_count
  FROM workspace_work_cases c
  JOIN institution_workspaces w ON w.id = c.workspace_id
  WHERE w.slug = 'ehime';
  IF v_count < 29 THEN
    RAISE EXCEPTION 'ehime 業務デスクのケースが % 件 (想定>=29)', v_count;
  END IF;
END $$;
