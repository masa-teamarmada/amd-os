-- 関西大学・小金沢新治先生の橋梁モニタリング技術を、PJ化前のシーズとして登録する。
-- 根拠: 2025年度KSAC申請書、不採択コメント、2026-08-25 松井由樹さんのメールと共有資料。
-- 事実境界: 2025年度KSACは不採択。2026年度は申請準備であり、採択・PJ化・資金調達は登録しない。

DO $$
DECLARE
  v_seed_id uuid;
  v_seed_count integer;
BEGIN
  SELECT count(*)
  INTO v_seed_count
  FROM seeds
  WHERE title = '環境発電による橋梁の状態監視保全モニタリングシステム'
    AND org_name = '関西大学'
    AND researcher_name = '小金沢 新治';

  IF v_seed_count > 1 THEN
    RAISE EXCEPTION '小金沢先生シーズが重複している';
  END IF;

  IF v_seed_count = 1 THEN
    SELECT id
    INTO v_seed_id
    FROM seeds
    WHERE title = '環境発電による橋梁の状態監視保全モニタリングシステム'
      AND org_name = '関西大学'
      AND researcher_name = '小金沢 新治';
  END IF;

  IF v_seed_id IS NULL THEN
    INSERT INTO seeds (
      title,
      summary,
      org_name,
      org_type,
      org_region,
      researcher_name,
      researcher_title,
      lab_name,
      domain_lane,
      industry_target,
      keywords,
      status,
      next_action,
      internal_notes,
      source,
      source_detail,
      discovery_status,
      envisioned_use_case,
      first_customer_candidate,
      next_verification_step,
      is_public,
      created_by,
      updated_by
    ) VALUES (
      '環境発電による橋梁の状態監視保全モニタリングシステム',
      '橋梁の通行振動を電力に変換する自立型センサで、外部電源・配線工事を不要にし、振動計測、構造健全性診断、診断結果の無線送信を行う。既設橋梁を通行止めにせずに状態監視することを想定する。',
      '関西大学',
      'university',
      '大阪府吹田市',
      '小金沢 新治',
      '教授',
      'システム理工学部 機械工学科',
      'gx_energy',
      ARRAY['自治体', '道路・橋梁管理', '鉄道事業者'],
      ARRAY['橋梁', '構造健全性診断', '環境発電', 'エネルギーハーベスティング', '自立型振動センサ', '磁歪', '無線通信', 'インフラ維持管理', 'KSAC'],
      'investigating',
      '2026年度KSAC申請に向け、昨年度の不採択コメントを基に顧客導入プロセス、競合・知財、検証範囲、耐久性の説明を整理する。',
      '2025年度KSAC申請は不採択。申請内容では、橋梁振動を用いた電源不要の状態監視と、自治体・鉄道事業者へのモニタリング情報提供を構想。審査では、導入検討から調査・工事・保守までの業務プロセス、競合比較の定量性、知財の模倣困難性、橋梁全体で扱う保全範囲、センサ耐久性、利用者ニーズの具体化が課題として示された。2026年度の申請準備中であり、採択・PJ化・資金調達は未確定。',
      'manual',
      '2026-08-25に松井由樹さんのメールと関西大学共有資料を確認。',
      'reviewed',
      '外部電源不要の自立型振動センサを既設橋梁へ設置し、振動データから健全性・保全の優先度を判断するためのモニタリング情報を提供する。',
      '自治体の道路橋管理部門、鉄道事業者',
      '通過車両の重量データ、損傷・疲労評価、複数地点計測を保全計画へ結び付ける根拠と、顧客導入プロセス・競合・知財・耐久性の説明を確認する。',
      false,
      'ID001',
      'ID001'
    )
    RETURNING id INTO v_seed_id;
  END IF;

  INSERT INTO seed_funding (
    seed_id,
    program,
    program_short,
    fiscal_year,
    status,
    notes
  )
  SELECT
    v_seed_id,
    'JST 大学発新産業創出基金事業 スタートアップ・エコシステム共創プログラム KSAC GAPファンド',
    'KSAC GAP',
    2025,
    'not_selected',
    '2025年10月31日提出の申請について、2026年3月の審査コメントで不採択を確認。金額は未確認。'
  WHERE NOT EXISTS (
    SELECT 1
    FROM seed_funding
    WHERE seed_id = v_seed_id
      AND program_short = 'KSAC GAP'
      AND fiscal_year = 2025
      AND status = 'not_selected'
  );

  INSERT INTO seed_contact_log (
    seed_id,
    contacted_on,
    method,
    amd_member_id,
    note,
    next_action
  )
  SELECT
    v_seed_id,
    DATE '2026-08-25',
    'email',
    'ID001',
    '松井由樹さんより、前年度の不採択を踏まえ、今年度は通過車両の重量データの蓄積、損傷・疲労評価、複数地点計測による損傷箇所の特定を申請へ盛り込む予定との共有。申請書と不採択コメントを確認。',
    'KSAC申請の修正方針を整理し、顧客導入プロセス、競合・知財、検証範囲、耐久性を確認する。'
  WHERE NOT EXISTS (
    SELECT 1
    FROM seed_contact_log
    WHERE seed_id = v_seed_id
      AND contacted_on = DATE '2026-08-25'
      AND method = 'email'
      AND note LIKE '松井由樹さんより、前年度の不採択を踏まえ%'
  );

  IF (SELECT count(*) FROM seeds WHERE id = v_seed_id) <> 1 THEN
    RAISE EXCEPTION '小金沢先生シーズの登録確認に失敗';
  END IF;

  IF (SELECT count(*) FROM seed_funding WHERE seed_id = v_seed_id AND program_short = 'KSAC GAP' AND fiscal_year = 2025 AND status = 'not_selected') <> 1 THEN
    RAISE EXCEPTION 'KSAC不採択履歴の登録確認に失敗';
  END IF;

  IF (SELECT count(*) FROM seed_contact_log WHERE seed_id = v_seed_id AND contacted_on = DATE '2026-08-25' AND method = 'email') < 1 THEN
    RAISE EXCEPTION '松井さんメールの接触履歴登録確認に失敗';
  END IF;
END $$;
