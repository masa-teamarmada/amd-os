-- LiSTie（p07）知財タブの登録（seed_project_ip_p07_lst.py、2026-09-30）に合わせて、技術タブの特許の行とゴールツリーを更新する
--
-- まさの依頼（2026-09-30）「知財タブ（特許を1件ずつ並べる台帳）…うん、やっておいてほしい」。
-- 知財タブの台帳（28件）は scripts/seed_project_ip_p07_lst.py で入れた（Google Patents・J-PlatPat 照会 2026-09-30）。
-- 1. 技術タブ「特許と出願」: 知財タブへの案内、QST特許の件数（24件と5件）の説明、コア特許と小面積電極の特許の番号・状態
-- 2. ゴールツリー（提案）: 出光興産とQSTの共有特許などとの関係（抵触の有無）を問いとして立て、分かったこと4件・やること2件
--    抵触するかどうかは判断していない。弁理士の確認を「やること」に置く

BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM project_tech_entries WHERE tech_entry_id IN ('pte_lst_ip_01','pte_lst_ip_02','pte_lst_ip_03','pte_lst_ip_04','pte_lst_ip_05')
             AND updated_at > TIMESTAMPTZ '2026-09-30 07:08:07+00')
     OR EXISTS (SELECT 1 FROM project_tech_topics WHERE tech_topic_id = 'ptt_lst_patents' AND updated_at > TIMESTAMPTZ '2026-09-30 07:08:07+00') THEN
    RAISE EXCEPTION '457: 技術タブの特許の行が 453 の後に書き換えられている。読み直してから作り直す';
  END IF;
  IF (SELECT count(*) FROM project_ip_assets WHERE project_id = 'p07') <> 28 THEN
    RAISE EXCEPTION '457: 知財タブの台帳が28件ではない（seed_project_ip_p07_lst.py を先に流す）';
  END IF;
END $$;

UPDATE project_tech_topics SET summary = $m$QSTの特許、自社の出願、共同出願、外国出願の方針と費用の目安を、会議で話された時点つきで並べた表。権利1件ごとの番号・状態・期限は知財タブの台帳（2026-09-30 登録、28件）。件数や国名が資料・会議で食い違う項目は要確認。$m$,
  updated_by = 'amie', updated_at = NOW() WHERE tech_topic_id = 'ptt_lst_patents' AND project_id = 'p07';

UPDATE project_tech_entries SET check_reason = check_reason || $m$ 2026-09-30 の照会では、QSTの関連出願は2013・2016・2019（2つ）・2023の5系統で、国ごとに数えると20件を超える。24件は国別、5件は系統の数え方とみられる（知財タブ）。$m$,
  updated_by = 'amie', updated_at = NOW() WHERE tech_entry_id IN ('pte_lst_ip_01', 'pte_lst_ip_02') AND project_id = 'p07';

UPDATE project_tech_entries SET note = $m$円筒型・板状型は会議の聞き取りからの読み。2026-09-30 の照会では、2019年のQSTの2系統（筒状の膜、多孔質の集電体とスペーサー）がオーストラリア・アルゼンチン・チリ・米国・韓国・日本に出ている（ボリビアは確認できず。知財タブ）。$m$,
  updated_by = 'amie', updated_at = NOW() WHERE tech_entry_id = 'pte_lst_ip_03' AND project_id = 'p07';

UPDATE project_tech_entries SET note = $m$J-PlatPat で「特許 有効・年金納付」を確認（2026-09-30）。出願 2016-01-29、満了の見込み 2036-01-29、請求項15。米国・韓国・オーストラリア・チリにも同じ系統がある。LiSTie への許諾の範囲は契約書で確かめる（知財タブ）。$m$,
  updated_by = 'amie', updated_at = NOW() WHERE tech_entry_id = 'pte_lst_ip_04' AND project_id = 'p07';

UPDATE project_tech_entries SET note = $m$PCT=複数国へ一括で出願できる国際出願。装置の中核に寄与する特許と説明。2026-09-30 の照会で、国際出願 PCT/JP2024/035964（WO2025/094613、優先日 2023-10-30）にあたり、膜と集電体の接触面積を膜の5%以下にする内容。中国・オーストラリアへの移行を確認（知財タブ）。$m$,
  updated_by = 'amie', updated_at = NOW() WHERE tech_entry_id = 'pte_lst_ip_05' AND project_id = 'p07';

INSERT INTO project_questions (
  id, project_id, parent_id, contribution, title, background, question_kind, status, answer, answered_on, answered_by,
  confidence, owner_label, due_date, origin_kind, origin_ref, sort_order, last_verified_at, created_by, updated_by,
  client_token, review_state, proposed_parent_id, proposed_contribution, proposal_reason, children_logic
)
VALUES ('07000000-2026-4930-8000-00000000013a'::uuid, 'p07', NULL, NULL,
  $m$出光興産とQSTの共有特許などに抵触せずに、廃電池リサイクルの工程（前処理・高温の運転・水酸化リチウムの晶析）を組めるか$m$,
  $m$2026-09-30 の特許の照会（知財タブ）: QSTが出光興産と共有する登録特許が3件あり、電池リサイクルの抽出液を膜で回収する工程のpH・温度・水酸化リチウムの晶析を押さえている。出光興産の単独の特許も前処理と重なり得る。シリーズAの調査で事業の自由度（抵触しないこと）を問われる点。$m$,
  'open', 'open', NULL, NULL, NULL, 'low', '知財担当・技術開発部', NULL, 'manual', 'ip-ledger:p07:2026-09-30', 7, DATE '2026-09-30', 'amie', 'amie',
  '07000000-2026-4930-8000-00000000013a'::uuid, 'proposed', '07000000-2026-4930-8000-000000000101'::uuid, 'required',
  $m$知財タブを作る照会で見つかった論点。まさの承認待ち。$m$, 'all')
ON CONFLICT (id) DO NOTHING;

INSERT INTO project_findings (
  id, project_id, summary, finding_kind, observed_on, source_label, source_url, confidence, sort_order,
  last_verified_at, created_by, updated_by, client_token, review_state, proposed_question_id, proposal_reason
)
SELECT v.id::uuid, 'p07', v.summary, v.kind, DATE '2026-09-30', v.source, v.url, v.confidence, v.sort_order,
  DATE '2026-09-30', 'amie', 'amie', v.id::uuid, 'proposed', '07000000-2026-4930-8000-00000000013a'::uuid, '2026-09-30 の特許の照会から。まさの承認待ち。'
FROM (VALUES
  ('07000000-2026-4930-8000-000000000426', 'contradicts',
   $m$QSTと出光興産の共有の特許7270130（電池の処理部材から取った抽出液のpHを12〜14に調節し、膜で回収する装置）は有効で、2038年まで続く。LiSTieは溶出液をアルカリ化してpH14以上で LiSMIC に入れる設計。$m$,
   'J-PlatPat・Google Patents（特許7270130）', 'https://www.j-platpat.inpit.go.jp/c1801/PU/JP-7270130/15/ja', 'medium', 10),
  ('07000000-2026-4930-8000-000000000427', 'contradicts',
   $m$共有の特許7806991（回収液を50℃以上に保って回収し、不活性ガスの中で晶析して水酸化リチウムを作る）は2026年1月に登録された。LiSTieは窒素で覆った箱の中で水酸化リチウムを蒸発・粉砕する計画。$m$,
   'J-PlatPat・Google Patents（特許7806991）', 'https://www.j-platpat.inpit.go.jp/c1801/PU/JP-7806991/15/ja', 'medium', 20),
  ('07000000-2026-4930-8000-000000000428', 'neutral',
   $m$出光興産の単独の特許7705925（2段のpH調整で他の元素を除き、膜で回収して液を戻す）、出光とDOWAエコシステムの特許7479883（リチウム含有物をアルカリ性の水溶液で溶かしてろ過）、共有の特許7792087（抽出液の温度を空間ごと調節）も、前処理や高温の運転と重なり得る。$m$,
   'J-PlatPat・Google Patents（特許7705925・7479883・7792087）', 'https://www.j-platpat.inpit.go.jp/c1801/PU/JP-7705925/15/ja', 'medium', 30),
  ('07000000-2026-4930-8000-000000000429', 'missing',
   $m$共有特許を LiSTie が使うには、QST と出光興産の両方の同意が要り得る。抵触するかどうかの弁理士の確認と、QSTの中核特許の実施許諾の範囲は、まだ確かめていない。$m$,
   '知財タブ（2026-09-30 登録）', NULL, 'medium', 40)
) AS v(id, kind, summary, source, url, confidence, sort_order)
ON CONFLICT (id) DO NOTHING;

INSERT INTO project_actions (
  id, project_id, title, detail, action_kind, status, owner_label, planned_start, planned_end, date_certainty,
  target, origin_kind, origin_ref, sort_order, last_verified_at, created_by, updated_by, client_token,
  review_state, proposed_question_id, proposal_reason
)
SELECT v.id::uuid, 'p07', v.title, v.detail, 'work', 'not_started', v.owner, NULL, NULL, 'provisional',
  NULL, 'manual', 'ip-ledger:p07:2026-09-30', v.sort_order, DATE '2026-09-30', 'amie', 'amie', v.id::uuid,
  'proposed', '07000000-2026-4930-8000-00000000013a'::uuid, '2026-09-30 の特許の照会から。まさの承認待ち。'
FROM (VALUES
  ('07000000-2026-4930-8000-000000000223', '出光興産とQSTの共有特許などとの関係（抵触の有無）を弁理士に調べてもらう',
   $m$対象は知財タブで「障害」「ウォッチ」にした特許（7270130・7792087・7806991・7705925・7479883）。LiSTieの前処理・運転温度・水酸化リチウムの後処理と、自社の出願（高温保持セル・前処理）との関係も見てもらう。$m$, '知財担当', 10),
  ('07000000-2026-4930-8000-000000000224', 'QSTの中核特許などの実施許諾の範囲を契約書で確かめる',
   $m$特許6818334・6233877・7385297 と、2019年・2023年の系統。共有特許に出光興産の同意が要るかも、あわせてQSTに確かめる。$m$, '管理部・知財担当', 20)
) AS v(id, title, detail, owner, sort_order)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF (SELECT count(*) FROM project_questions WHERE project_id = 'p07' AND id::text LIKE '07000000-2026-4930-8000-%') <> 39
     OR (SELECT count(*) FROM project_findings WHERE project_id = 'p07' AND id::text LIKE '07000000-2026-4930-8000-%') <> 55
     OR (SELECT count(*) FROM project_actions WHERE project_id = 'p07' AND id::text LIKE '07000000-2026-4930-8000-%') <> 24 THEN
    RAISE EXCEPTION '457: ゴールツリーの件数が想定と違う';
  END IF;
END $$;

COMMIT;
