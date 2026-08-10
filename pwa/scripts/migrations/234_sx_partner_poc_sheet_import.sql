-- 234: PoC候補先スプレッドシート (2026-08-05 17:52 JST 版) を p21 関係先台帳へ取り込む
--
-- 取り込み元: 「SX PoC候補先 進捗サマリー」スプシ (候補26社 / 履歴H-0001〜H-0040 / サンプルS-001〜S-021)
-- 方針 (まさ確定 2026-08-05):
--   - 段階チップ導入 / 試料台帳は軽量版 / やり取り履歴は全件保存
--   - 未確認は未確認のまま入れる (推測で埋めない)。確度: 確認済み→high, 要確認→low
--   - 要確認内容は表示項目でなく保有事項 (work_item, question) に変換し、担当不明は管制へ浮上させる
--   - H-0038/39/40 は特定関係先に紐付かない全体メモのため取り込み対象外 (チャット報告で明示)
-- 冪等性: insert は source_ref='PoC候補先進捗サマリー 2026-08-05' + 内容一致の NOT EXISTS ガード付き

BEGIN;

-- ============================================================
-- 0) 旧リスト由来の PoC 系 roleLabel へ blanket で候補区分を付与
--    (この後の個別 update が試料提供元などへ上書きする)
-- ============================================================
UPDATE project_management_partners
SET poc_category = 'poc_candidate', updated_at = now()
WHERE project_id = 'p21' AND deleted_at IS NULL AND poc_category IS NULL
  AND (role_label LIKE 'PoC候補先%' OR role_label LIKE 'PoC接触先%');

-- ============================================================
-- 1) 新規関係先 (スプシにあり台帳に無い先)
-- ============================================================
INSERT INTO project_management_partners
  (project_id, slug, name, role_label, primary_track, relationship_stage, activity_state, poc_category,
   agreement_state, agreed_scope, unagreed_scope, last_contact_date, next_commitment, due_date, due_date_precision,
   owner_label, current_ball_side, current_ball_owner, introducer_label,
   last_verified_at, confidence, source_kind, source_ref)
SELECT * FROM (VALUES
  ('p21', 'ishigaki', '株式会社石垣', '技術協力先（ろ過・分離装置）', 'business_development',
   'technical_review', 'active', 'tech_partner',
   'unagreed', '工場見学・ろ過装置開発部門との意見交換を調整中', '訪問日、訪問順序、PoC範囲、排液・サンプル条件',
   DATE '2026-08-04', '山地が9月第1週を目安に石垣・住友金属鉱山等の訪問ルートを確定', DATE '2026-09-01', 'month',
   '山地／石原先生／杉浦先生／中島先生', 'sx', '山地', 'その他・個別接点',
   DATE '2026-08-05', 'high', 'imported', 'Gmail／SX定例議事録'),
  ('p21', 'aichi-tokei', '愛知時計電機株式会社', '技術協力先（流量計・計測）', 'business_development',
   'technical_review', 'waiting_partner', 'tech_partner',
   'unagreed', '工場排水向け流量計を軸に共同研究の可能性', '共同研究テーマ、参画可否、役割、測定仕様',
   DATE '2026-08-04', 'PoCで必要な測定仕様と共同研究案を整理し、参画可否を確認', NULL, 'unknown',
   '山地／杉浦先生（引継ぎ中）', 'partner', '先方判断待ち', '直接／AMD',
   DATE '2026-08-05', 'high', 'imported', 'Gmail／SX定例議事録'),
  ('p21', 'ryukyu-lab-route', '琉球ラボラトリー経由・排出元未特定', '試料提供ルート（重金属含有排液）', 'business_development',
   'sample_acquisition', 'stalled', 'sample_route',
   'unagreed', '重金属を含む約1Lのサンプルを依頼。守秘契約案は内容合意に近い', '契約締結、排出元、発送・受領実績、5種サンプルとの関係',
   DATE '2026-06-08', '守秘契約を確定し、排出元とサンプル台帳をひも付ける', NULL, 'unknown',
   '石原先生／杉浦先生', 'sx', '石原先生', '琉球ラボラトリー経由',
   DATE '2026-08-05', 'low', 'imported', 'Gmail'),
  ('p21', 've-tri', 'VE-TRI（インド）', 'PoC候補先（相談中）', 'business_development',
   'first_contact', 'waiting_internal', 'poc_candidate',
   'unagreed', '直接／AMDルートで相談中と整理されている', '窓口、相談内容、直近接触日、担当',
   NULL, '担当と接触履歴を確認し、相談内容と次回予定を登録', NULL, 'unknown',
   '担当未確認', 'unknown', NULL, '直接／AMD',
   DATE '2026-08-05', 'low', 'imported', '事業進捗資料'),
  ('p21', 'kobe-material-testing', '神戸工業試験場', '試料提供元', 'business_development',
   'sample_acquisition', 'active', 'sample_provider',
   'unagreed', '対象試料を調達済みと会議で共有', '試料種、量、試料ID、受領日、保管場所、分析状態、担当分担',
   NULL, '現物台帳と照合し、試料仕様・受領・保管・分析情報を登録', NULL, 'unknown',
   '山地／杉浦先生・分担要確認', 'sx', NULL, '直接／AMD',
   DATE '2026-08-05', 'low', 'imported', 'SX定例議事録'),
  ('p21', 'kishimoto-kogyo', '岸本工業所', '試料提供元（切削液）', 'business_development',
   'sample_acquisition', 'active', 'sample_provider',
   'unagreed', '切削液を調達済みと整理されている', '正式法人名、油分・金属種、量、試料ID、受領・分析状態',
   NULL, '現物台帳と照合し、試料仕様と受領・分析情報を登録', NULL, 'unknown',
   '担当未確認', 'unknown', NULL, 'せとのわ',
   DATE '2026-08-05', 'low', 'imported', '事業進捗資料'),
  ('p21', 'okayama-giken', '岡山技研工業', '試料提供元（切削液・コンプレッサー関連）', 'business_development',
   'sample_acquisition', 'active', 'sample_provider',
   'unagreed', '切削液・コンプレッサー関連試料を調達済みと整理されている', '正式法人名、試料数、組成、量、試料ID、受領・分析状態',
   NULL, '試料単位に分割し、組成・量・現物IDを確認', NULL, 'unknown',
   '担当未確認', 'unknown', NULL, 'せとのわ',
   DATE '2026-08-05', 'low', 'imported', '事業進捗資料'),
  ('p21', 'shiga-shoten', '志賀商店', '試料提供元（食品系）', 'business_development',
   'sample_acquisition', 'active', 'sample_provider',
   'unagreed', '食品系試料を調達済みと整理されている', '正式法人名、排液種、量、試料ID、受領・分析状態',
   NULL, '現物台帳と照合し、排液種・量・受領情報を登録', NULL, 'unknown',
   '担当未確認', 'unknown', NULL, 'せとのわ',
   DATE '2026-08-05', 'low', 'imported', '事業進捗資料'),
  ('p21', 'rail-mfr-unidentified', '輸送機械製造（企業名未特定）', '試料提供元（電車車両関連）', 'business_development',
   'sample_acquisition', 'active', 'sample_provider',
   'unagreed', 'ダイキアクシス経由で電車車両関連の試料を調達済みと整理', '正式組織名、試料種、量、試料ID、受領・保管・分析状態',
   NULL, '正式組織名と現物台帳を照合', NULL, 'unknown',
   '担当未確認', 'unknown', NULL, 'ダイキアクシス経由',
   DATE '2026-08-05', 'low', 'imported', '事業進捗資料')
) AS v(project_id, slug, name, role_label, primary_track, relationship_stage, activity_state, poc_category,
       agreement_state, agreed_scope, unagreed_scope, last_contact_date, next_commitment, due_date, due_date_precision,
       owner_label, current_ball_side, current_ball_owner, introducer_label,
       last_verified_at, confidence, source_kind, source_ref)
WHERE NOT EXISTS (
  SELECT 1 FROM project_management_partners p
  WHERE p.project_id = 'p21' AND p.slug = v.slug
);

-- ============================================================
-- 2) 既存関係先の更新 (スプシ26社との突合分)
-- ============================================================
-- P-002 日本食研
UPDATE project_management_partners SET
  relationship_stage='meeting_coordination', activity_state='active', poc_category='poc_candidate', confidence='high',
  last_contact_date=DATE '2026-08-05', introducer_label='伊予銀行',
  next_commitment='訪問時に排液源、量、成分、現行処理、費用、受渡方法を確認',
  due_date=DATE '2026-08-25', due_date_precision='day',
  owner_label='山地／石原先生（引継ぎ中）', current_ball_side='sx', current_ball_owner='山地',
  last_verified_at=DATE '2026-08-05', source_kind='imported', source_ref='Gmail／Slack／SX定例議事録', updated_at=now()
WHERE project_id='p21' AND slug='poc-talk-11-x';

-- P-003 ユナイテッドシルク
UPDATE project_management_partners SET
  relationship_stage='meeting_coordination', activity_state='waiting_partner', poc_category='poc_candidate', confidence='high',
  last_contact_date=DATE '2026-08-05', introducer_label='伊予銀行',
  next_commitment='先方回答を受けて8/25の時刻を確定し、必要量・成分情報・受渡方法を送る',
  due_date=DATE '2026-08-25', due_date_precision='day',
  owner_label='山地／石原先生（引継ぎ中）', current_ball_side='partner', current_ball_owner='先方回答待ち',
  last_verified_at=DATE '2026-08-05', source_kind='imported', source_ref='Gmail／Slack／SX定例議事録', updated_at=now()
WHERE project_id='p21' AND slug='poc-talk-12-x';

-- P-004 ヤマキ
UPDATE project_management_partners SET
  relationship_stage='hearing', activity_state='waiting_internal', poc_category='poc_candidate', confidence='low',
  last_contact_date=DATE '2026-07-14', introducer_label='伊予銀行',
  next_commitment='7/24訪問の実施有無を確認し、結果登録。未実施なら再調整',
  due_date=DATE '2026-07-24', due_date_precision='day',
  owner_label='石原先生',
  last_verified_at=DATE '2026-08-05', source_kind='imported', source_ref='Gmail／Slack', updated_at=now()
WHERE project_id='p21' AND slug='poc-contact-yamaki';

-- P-005 オカベ
UPDATE project_management_partners SET
  relationship_stage='sample_acquisition', activity_state='active', poc_category='poc_candidate', confidence='low',
  last_contact_date=DATE '2026-07-14', introducer_label='伊予銀行',
  next_commitment='現物台帳と照合し、訪問結果とサンプルの受領・保管・分析情報を登録',
  due_date=NULL, due_date_precision='unknown',
  owner_label='山地／石原先生（引継ぎ中）',
  last_verified_at=DATE '2026-08-05', source_kind='imported', source_ref='Gmail／Slack／SX定例議事録', updated_at=now()
WHERE project_id='p21' AND slug='poc-contact-okabe';

-- P-006 ハタダ
UPDATE project_management_partners SET
  relationship_stage='condition_alignment', activity_state='active', poc_category='poc_candidate', confidence='high',
  last_contact_date=DATE '2026-07-17', introducer_label='伊予銀行',
  next_commitment='現場見学・採取日を決め、最新分析データを受領し、試験計画案を作る',
  agreement_state='partial', agreed_scope='現場見学と三次処理水（500mL〜1L、窒素・リン対象）の提供に合意',
  unagreed_scope='採取日、段階別最新水質データ、試験区画、停止基準、「廃液」の定義',
  owner_label='石原先生／杉浦先生',
  last_verified_at=DATE '2026-08-05', source_kind='imported', source_ref='会議議事録／事業進捗資料', updated_at=now()
WHERE project_id='p21' AND slug='poc-talk-07-x';

-- P-007 ハピックいづつ (旧名: ハピック)
UPDATE project_management_partners SET
  name='株式会社ハピックいづつ',
  relationship_stage='first_contact', activity_state='waiting_internal', poc_category='poc_candidate', confidence='low',
  introducer_label='伊予銀行',
  next_commitment='ハタダの進展を踏まえ、直接連絡して訪問とサンプル条件を調整',
  owner_label='石原先生',
  last_verified_at=DATE '2026-08-05', source_kind='imported', source_ref='Slack／事業進捗資料', updated_at=now()
WHERE project_id='p21' AND slug='poc-talk-08-x';

-- P-008 マルトモ
UPDATE project_management_partners SET
  relationship_stage='agreement_confirmation', activity_state='active', poc_category='poc_candidate', confidence='low',
  last_contact_date=DATE '2026-07-27', introducer_label='伊予銀行',
  next_commitment='合意内容を直接証跡で確認し、ヒアリングまたはサンプル調達日程を決める',
  owner_label='山地／石原先生（引継ぎ中）',
  last_verified_at=DATE '2026-08-05', source_kind='imported', source_ref='Gmail／SX定例議事録', updated_at=now()
WHERE project_id='p21' AND slug='poc-contact-marutomo';

-- P-009 三浦工業
UPDATE project_management_partners SET
  relationship_stage='hearing', activity_state='waiting_internal', poc_category='tech_partner', confidence='low',
  last_contact_date=DATE '2026-06-12', introducer_label='直接／AMD',
  next_commitment='6/26面談の結果と7/22時点の相談内容を回収し、役割と次回を確定',
  owner_label='石原先生',
  last_verified_at=DATE '2026-08-05', source_kind='imported', source_ref='Gmail／Slack／事業進捗資料', updated_at=now()
WHERE project_id='p21' AND slug='poc-talk-01-x';

-- P-010 クボタ 水環境カンパニー
UPDATE project_management_partners SET
  relationship_stage='first_contact', activity_state='waiting_partner', poc_category='tech_partner', confidence='high',
  last_contact_date=DATE '2026-08-04', introducer_label='紹介者経由',
  next_commitment='紹介結果を待ち、接続後に8/21以降の日程を提示',
  owner_label='杉浦先生／石原先生', current_ball_side='partner', current_ball_owner='紹介接続待ち',
  last_verified_at=DATE '2026-08-05', source_kind='imported', source_ref='Gmail', updated_at=now()
WHERE project_id='p21' AND slug='クボタ（水環境カンパニー）';

-- P-012 住友金属鉱山
UPDATE project_management_partners SET
  relationship_stage='meeting_coordination', activity_state='active', poc_category='poc_candidate', confidence='low',
  last_contact_date=DATE '2026-06-24', introducer_label='伊予銀行',
  next_commitment='山地が訪問ルートを組み、石原先生らから紹介を受けて訪問応諾を取る',
  due_date=DATE '2026-09-01', due_date_precision='month',
  owner_label='山地／石原先生（引継ぎ中）', current_ball_side='sx', current_ball_owner='山地',
  last_verified_at=DATE '2026-08-05', source_kind='imported', source_ref='Gmail／Slack／SX定例議事録', updated_at=now()
WHERE project_id='p21' AND slug='poc-talk-10-x';

-- P-014 ガラスリソーシング／ファインケム連携ルート (旧名: ファインケム)
UPDATE project_management_partners SET
  name='ガラスリソーシング／ファインケム連携ルート',
  relationship_stage='sample_acquisition', activity_state='waiting_internal', poc_category='sample_route', confidence='low',
  last_contact_date=DATE '2026-06-19', introducer_label='直接／AMD',
  next_commitment='直接証跡を確認し、実サンプルの採取・受渡日と契約・費用を確定',
  owner_label='杉浦先生／山地／外部連携先',
  last_verified_at=DATE '2026-08-05', source_kind='imported', source_ref='Gmail／事業進捗資料', updated_at=now()
WHERE project_id='p21' AND slug='fc-hokuriku';

-- P-015 日本ゼオン 水島工場
UPDATE project_management_partners SET
  relationship_stage='sample_acquisition', activity_state='active', poc_category='poc_candidate', confidence='low',
  last_contact_date=DATE '2026-06-24', introducer_label='倉敷市',
  next_commitment='現物台帳と照合し、試料仕様・受領・保管・分析情報を登録',
  owner_label='杉浦先生',
  last_verified_at=DATE '2026-08-05', source_kind='imported', source_ref='Gmail／事業進捗資料', updated_at=now()
WHERE project_id='p21' AND slug='poc-talk-06-x';

-- P-019 太陽石油
UPDATE project_management_partners SET
  relationship_stage='sample_acquisition', activity_state='active', poc_category='sample_provider', confidence='low',
  introducer_label='直接／AMD',
  next_commitment='現物台帳と照合し、試料仕様と安全・保管条件を登録',
  owner_label='担当未確認',
  last_verified_at=DATE '2026-08-05', source_kind='imported', source_ref='事業進捗資料', updated_at=now()
WHERE project_id='p21' AND slug='poc-cand-01-x';

-- P-020 新居浜マリーナサービス
UPDATE project_management_partners SET
  name='新居浜マリーナサービス（正式法人名未確認）',
  relationship_stage='sample_acquisition', activity_state='active', poc_category='sample_provider', confidence='low',
  introducer_label='直接／AMD',
  next_commitment='正式名と現物台帳を照合し、組成・量・受領情報を登録',
  owner_label='担当未確認',
  last_verified_at=DATE '2026-08-05', source_kind='imported', source_ref='事業進捗資料', updated_at=now()
WHERE project_id='p21' AND slug='poc-talk-02-x';

-- P-024 セイショク / P-025 クロキ
UPDATE project_management_partners SET
  relationship_stage='sample_acquisition', activity_state='active', poc_category='sample_provider', confidence='low',
  introducer_label='せとのわ',
  next_commitment='現物台帳と照合し、色素・pH・塩分・受領情報を登録',
  owner_label='担当未確認',
  last_verified_at=DATE '2026-08-05', source_kind='imported', source_ref='事業進捗資料', updated_at=now()
WHERE project_id='p21' AND slug IN ('poc-talk-03-x', 'poc-talk-04-x');

-- P-026 メイト
UPDATE project_management_partners SET
  relationship_stage='sample_acquisition', activity_state='active', poc_category='sample_provider', confidence='high',
  last_contact_date=DATE '2026-08-05', introducer_label='せとのわ',
  next_commitment='杉浦先生がメイトへ高濃度レアアース原液を再交渉し、新規サンプル台帳へひも付ける',
  owner_label='杉浦先生／山地', current_ball_side='sx', current_ball_owner='杉浦先生',
  last_verified_at=DATE '2026-08-05', source_kind='imported', source_ref='事業進捗資料／SX定例議事録', updated_at=now()
WHERE project_id='p21' AND slug='poc-talk-05-x';

COMMIT;
