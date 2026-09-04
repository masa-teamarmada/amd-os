-- 365_sx_partners_260902_report.sql
-- 「SX 定例報告会_260902」の訪問日程・排液の入手状況を、進捗管理の関係先 (project_management_partners) へ入れる。
-- まさ確定 (2026-09-04):「日程とかは技術と無関係なので技術タブには入れないで、進捗タブ側に入れて」
--
-- 境界:
--   - 排液の性状 (成分・pH・試験結果) は技術タブ ptt_sx_effluent_sources にも置いてある。
--     ここは「誰と、いつ、次に何をするか」の側。日程の正本はこちら。
--   - 訪問日は資料に日付だけがあり時刻は無いので next_meeting_time は入れない。

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '45s';
SELECT pg_advisory_xact_lock(hashtext('sx_partners_260902_report'));

-- メイト — 9/8訪問。原液に近い廃液の提供は了承済み
UPDATE public.project_management_partners SET
  relationship_stage = 'sample_acquisition',
  activity_state = 'active',
  next_meeting_on = '2026-09-08',
  next_meeting_mode = 'onsite',
  next_meeting_goal = '原液に近い廃液の提供条件を決め、実証試験の可否まで相談する',
  next_commitment = '9/8に訪問し、原液に近い廃液の提供条件と実証試験の可否を相談する',
  due_date = '2026-09-08',
  due_date_precision = 'day',
  current_ball_side = 'sx',
  introducer_label = 'せとのわ 太田社長',
  effluent_note = '前回受領分は1次処理後と2次処理後の液で、原液ではなかった。原液に近い廃液の提供は先方了承済み (せとのわ 太田社長が工場長・総務部長へ説明)。先方もレアアース回収を計画中で、環境負荷の低い方法を探していた。',
  last_verified_at = '2026-09-02',
  confidence = 'high',
  source_ref = 'SX 定例報告会_260902 (杉浦先生 配布資料)',
  updated_at = now()
WHERE project_id = 'p21' AND slug = 'poc-talk-05-x' AND deleted_at IS NULL;

-- 日本食研 — 8/25訪問で調達済み。培養試験中
UPDATE public.project_management_partners SET
  activity_state = 'active',
  current_ball_side = 'sx',
  next_meeting_on = NULL,
  next_commitment = '培養試験を続け、必要に応じてCOD値を測定する。あわせて成分表を入手する',
  effluent_procured = true,
  effluent_note = '8/25の訪問で工場の廃液処理装置を見学し、廃液を調達。成分は不明 (油分を含む)、pH 4.3。油水分離後から調整槽流入部付近の排液を対象にしている。',
  effluent_test_result = '9/1の週から培養試験中。3日目の時点ではオカベ排液のようには増えていない。',
  last_contact_date = '2026-08-25',
  last_verified_at = '2026-09-02',
  confidence = 'high',
  source_ref = 'SX 定例報告会_260902 (杉浦先生 配布資料)',
  updated_at = now()
WHERE project_id = 'p21' AND slug = 'poc-talk-11-x' AND deleted_at IS NULL;

-- ユナイテッドシルク — 8/25訪問。製造停止中だったため後日郵送
UPDATE public.project_management_partners SET
  activity_state = 'waiting_partner',
  current_ball_side = 'partner',
  next_commitment = 'ユナイテッドシルクが後日、廃液サンプルを郵送で提供する。SXは受領後、評価対象と試験条件を確定する。',
  effluent_procured = false,
  effluent_note = '繭を脆化した際に出る細かい繊維の処理。訪問時は製造が止まっていたため、後日郵送で受け取ることになった。タンパク質由来の低分子有機物がBOD源の可能性。詳細成分・濃度は未確認。',
  effluent_test_result = '先方の現行処理は「酸処理 → 中和 → 排水」で、BOD・CODは基準を満たしている。具体値・検査条件は未取得。',
  last_contact_date = '2026-08-25',
  last_verified_at = '2026-09-02',
  confidence = 'high',
  source_ref = 'SX 定例報告会_260902 (杉浦先生 配布資料)',
  updated_at = now()
WHERE project_id = 'p21' AND slug = 'poc-talk-12-x' AND deleted_at IS NULL;

-- オカベ — 廃液入手済み。培養試験で7月の見立てと逆の結果
UPDATE public.project_management_partners SET
  activity_state = 'active',
  current_ball_side = 'sx',
  next_commitment = '処理前後のCOD値を測り、排液中の成分が減っているかを確認する',
  effluent_procured = true,
  effluent_note = '砂糖・醤油ベースの調味液が中心。2026-09-02時点の情報では COD 2,000、砂糖・みりん・醤油・ブドウ糖を含み pH 5。7月時点では「糖分ばかりで分解対象となる成分がなく色度が課題」と見ていたが、培養試験では逆に糖を「エサ」として増殖した。両方の見立てを残す。',
  effluent_test_result = '50%排液の条件で対照より速く増殖し、43時間でpH5→約8。ICP-MSは炭素が多く使えないため、COD値の測定で評価する予定。',
  last_verified_at = '2026-09-02',
  confidence = 'medium',
  source_ref = 'SX 定例報告会_260902 (杉浦先生 配布資料)',
  updated_at = now()
WHERE project_id = 'p21' AND slug = 'poc-contact-okabe' AND deleted_at IS NULL;

-- 住友金属鉱山 — 10/2 別子事業所を訪問
UPDATE public.project_management_partners SET
  activity_state = 'active',
  relationship_stage = 'meeting_coordination',
  current_ball_side = 'sx',
  next_meeting_on = '2026-10-02',
  next_meeting_mode = 'onsite',
  next_meeting_place = '別子事業所',
  next_commitment = '10/2に別子事業所を訪問する',
  due_date = '2026-10-02',
  due_date_precision = 'day',
  last_verified_at = '2026-09-02',
  confidence = 'high',
  source_ref = 'SX 定例報告会_260902 (杉浦先生 配布資料)',
  updated_at = now()
WHERE project_id = 'p21' AND slug = 'poc-talk-10-x' AND deleted_at IS NULL;

-- ハタダ — 10/2 訪問して廃液を回収
UPDATE public.project_management_partners SET
  activity_state = 'active',
  current_ball_side = 'sx',
  next_meeting_on = '2026-10-02',
  next_meeting_mode = 'onsite',
  next_meeting_goal = '廃液を回収する',
  next_commitment = '10/2に訪問し、廃液を回収する',
  due_date = '2026-10-02',
  due_date_precision = 'day',
  last_verified_at = '2026-09-02',
  confidence = 'high',
  source_ref = 'SX 定例報告会_260902 (杉浦先生 配布資料)',
  updated_at = now()
WHERE project_id = 'p21' AND slug = 'poc-talk-07-x' AND deleted_at IS NULL;

-- 愛知時計電機 — NDA締結済み。訪問調整中
UPDATE public.project_management_partners SET
  activity_state = 'active',
  current_ball_side = 'sx',
  next_commitment = 'NDA締結済み。訪問日程を調整する',
  last_verified_at = '2026-09-02',
  confidence = 'high',
  source_ref = 'SX 定例報告会_260902 (杉浦先生 配布資料)',
  updated_at = now()
WHERE project_id = 'p21' AND slug = 'aichi-tokei' AND deleted_at IS NULL;

-- クボタ — 排水処理をしていないため対象外
UPDATE public.project_management_partners SET
  relationship_stage = 'declined',
  activity_state = 'dropped',
  current_ball_side = 'none',
  next_commitment = '打合せは行わない (排水処理を行っていないため対象外)',
  due_date = NULL,
  due_date_precision = 'unknown',
  last_verified_at = '2026-09-02',
  confidence = 'high',
  source_ref = 'SX 定例報告会_260902 (杉浦先生 配布資料)',
  updated_at = now()
WHERE project_id = 'p21' AND slug = 'クボタ（水環境カンパニー）' AND deleted_at IS NULL;

-- アドバンテック — 資料で初めて出てきた相手。訪問調整中 (石原先生ルート)
INSERT INTO public.project_management_partners (
  project_id, slug, name, role_label, relationship_stage, agreement_state,
  agreed_scope, unagreed_scope, next_commitment, owner_label, last_verified_at,
  confidence, source_kind, source_ref, sort_order,
  current_ball_side, due_date_precision, activity_state, classifications,
  introducer_label
) VALUES (
  'p21', 'advantech', 'アドバンテック', '排液の提供候補', 'meeting_coordination', 'unagreed',
  '未取得', '訪問可否、排液の提供可否、対象工程', '訪問日程を調整する', '山地', '2026-09-02',
  'medium', 'manual', 'SX 定例報告会_260902 (杉浦先生 配布資料)', 144,
  'sx', 'unknown', 'active', ARRAY['sample_provider']::text[],
  '石原先生'
)
ON CONFLICT (project_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  relationship_stage = EXCLUDED.relationship_stage,
  next_commitment = EXCLUDED.next_commitment,
  activity_state = EXCLUDED.activity_state,
  current_ball_side = EXCLUDED.current_ball_side,
  last_verified_at = EXCLUDED.last_verified_at,
  confidence = EXCLUDED.confidence,
  source_ref = EXCLUDED.source_ref,
  updated_at = now();

COMMIT;
