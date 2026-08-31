-- KUTE (p25): replace the six vague roadmap rows with the reviewed FY2026 work ledger.
-- The old rows are preserved by soft deletion. This migration aborts if they were edited
-- or connected after the 2026-08-31 import, so a later user change is never overwritten.
BEGIN;

DO $$
DECLARE
  v_old_tasks integer;
  v_changed_tasks integer;
  v_schedule_links integer;
  v_milestone_links integer;
BEGIN
  SELECT count(*) INTO v_old_tasks
  FROM public.project_management_tasks
  WHERE project_id = 'p25'
    AND id IN (
      '25000000-2026-4000-8000-000000000301'::uuid,
      '25000000-2026-4000-8000-000000000302'::uuid,
      '25000000-2026-4000-8000-000000000303'::uuid,
      '25000000-2026-4000-8000-000000000304'::uuid,
      '25000000-2026-4000-8000-000000000305'::uuid,
      '25000000-2026-4000-8000-000000000306'::uuid
    )
    AND deleted_at IS NULL;

  SELECT count(*) INTO v_changed_tasks
  FROM public.project_management_tasks
  WHERE project_id = 'p25'
    AND id IN (
      '25000000-2026-4000-8000-000000000301'::uuid,
      '25000000-2026-4000-8000-000000000302'::uuid,
      '25000000-2026-4000-8000-000000000303'::uuid,
      '25000000-2026-4000-8000-000000000304'::uuid,
      '25000000-2026-4000-8000-000000000305'::uuid,
      '25000000-2026-4000-8000-000000000306'::uuid
    )
    AND (
      deleted_at IS NOT NULL
      OR version <> 1
      OR source_kind <> 'imported'
      OR source_ref NOT LIKE 'KUTE年度内ロードマップ /%'
    );

  SELECT count(*) INTO v_schedule_links
  FROM public.project_management_schedule_dependencies
  WHERE project_id = 'p25'
    AND deleted_at IS NULL
    AND (
      predecessor_task_id IN (
        '25000000-2026-4000-8000-000000000301'::uuid,
        '25000000-2026-4000-8000-000000000302'::uuid,
        '25000000-2026-4000-8000-000000000303'::uuid,
        '25000000-2026-4000-8000-000000000304'::uuid,
        '25000000-2026-4000-8000-000000000305'::uuid,
        '25000000-2026-4000-8000-000000000306'::uuid
      )
      OR successor_task_id IN (
        '25000000-2026-4000-8000-000000000301'::uuid,
        '25000000-2026-4000-8000-000000000302'::uuid,
        '25000000-2026-4000-8000-000000000303'::uuid,
        '25000000-2026-4000-8000-000000000304'::uuid,
        '25000000-2026-4000-8000-000000000305'::uuid,
        '25000000-2026-4000-8000-000000000306'::uuid
      )
    );

  SELECT count(*) INTO v_milestone_links
  FROM public.project_management_milestone_dependencies
  WHERE project_id = 'p25';

  IF v_old_tasks <> 6 OR v_changed_tasks <> 0 THEN
    RAISE EXCEPTION 'KUTE old task preflight failed: active=%, changed=%', v_old_tasks, v_changed_tasks;
  END IF;
  IF v_schedule_links <> 0 OR v_milestone_links <> 0 THEN
    RAISE EXCEPTION 'KUTE old roadmap has dependencies: task=%, milestone=%', v_schedule_links, v_milestone_links;
  END IF;
  IF (SELECT count(*) FROM public.project_management_tasks WHERE project_id = 'p25' AND deleted_at IS NULL) <> 6 THEN
    RAISE EXCEPTION 'KUTE has active tasks outside the reviewed six-row import';
  END IF;
  IF (SELECT count(*) FROM public.project_management_tracks WHERE project_id = 'p25') <> 2 THEN
    RAISE EXCEPTION 'KUTE track set changed after review';
  END IF;
END $$;

-- Keep the two existing stable track keys. Renaming a key would make the parent-integrity
-- trigger observe a half-cascaded outcome/milestone pair, so only the user-facing labels change.
UPDATE public.project_management_tracks
SET label = '認定制度', short_label = '認定', accent = '#315f7d', sort_order = 1
WHERE id = '25000000-2026-4000-8000-000000000011'::uuid
  AND project_id = 'p25' AND track_key = 'regulation';

UPDATE public.project_management_tracks
SET label = 'シーズ発掘', short_label = '発掘', accent = '#38745d', sort_order = 3
WHERE id = '25000000-2026-4000-8000-000000000012'::uuid
  AND project_id = 'p25' AND track_key = 'seed';

INSERT INTO public.project_management_tracks
  (id, project_id, track_key, label, short_label, accent, sort_order)
VALUES
  ('25000000-2026-4000-8000-000000000013', 'p25', 'regulations', '関連6規程', '6規程', '#4c6a8f', 2),
  ('25000000-2026-4000-8000-000000000014', 'p25', 'koori', '桑折先生', '桑折', '#76637b', 4),
  ('25000000-2026-4000-8000-000000000015', 'p25', 'self_sustain', '自走化・連携', '自走化', '#bf7b2c', 5),
  ('25000000-2026-4000-8000-000000000016', 'p25', 'reporting', '年度報告', '報告', '#6b6f76', 6)
ON CONFLICT (project_id, track_key) DO NOTHING;

UPDATE public.project_management_objectives
SET title = 'KUTE今期3領域の成果を残し、次年度へ引き継げる状態にする',
    definition_of_done = '認定制度と関連規程、シーズ発掘と桑折先生の事業化検証、自走化と連携方式について、今期の成果・未達・次の担当が追跡でき、契約上の成果報告を提出できる。',
    status = 'active', last_verified_at = '2026-09-01', confidence = 'high',
    source_kind = 'manual',
    source_ref = 'KUTE FY2026 task review / 2026-09-01 adopted task ledger'
WHERE id = '25000000-2026-4000-8000-000000000001'::uuid AND project_id = 'p25';

UPDATE public.project_management_outcomes
SET slug = 'kute-fy2026-certification', title = '認定制度を運用可能にする',
    definition_of_done = '規程案の作成と大学の決裁・施行を分けて確認し、申請から通知までの運用と第1号案件の準備を追跡できる。',
    owner_label = 'AMD・大学', status = 'active', last_verified_at = '2026-09-01',
    confidence = 'medium', source_kind = 'manual', source_ref = 'KUTE FY2026 task review / 認定制度'
WHERE id = '25000000-2026-4000-8000-000000000101'::uuid AND project_id = 'p25';

UPDATE public.project_management_outcomes
SET slug = 'kute-fy2026-seed-discovery', title = 'シーズ発掘の運用を決める',
    definition_of_done = '公開情報の候補整理から大学承認、研究者ヒアリング、事業仮説検証、引渡しまでの手順と記録を揃える。',
    owner_label = 'AMD・大学', status = 'active', last_verified_at = '2026-09-01',
    confidence = 'medium', source_kind = 'manual', source_ref = 'KUTE FY2026 task review / シーズ発掘'
WHERE id = '25000000-2026-4000-8000-000000000102'::uuid AND project_id = 'p25';

INSERT INTO public.project_management_outcomes
  (id, project_id, objective_id, slug, track, title, definition_of_done, owner_label,
   status, last_verified_at, confidence, source_kind, source_ref)
VALUES
  ('25000000-2026-4000-8000-000000000103', 'p25', '25000000-2026-4000-8000-000000000001', 'kute-fy2026-regulations', 'regulations', '関連6規程を個別に原案化する', '原典回収、個別原案、学内意見反映、決裁版、施行版と様式を規程ごとに追跡できる。', 'AMD・大学', 'active', '2026-09-01', 'medium', 'manual', 'KUTE FY2026 task review / 関連6規程'),
  ('25000000-2026-4000-8000-000000000104', 'p25', '25000000-2026-4000-8000-000000000001', 'kute-fy2026-koori', 'koori', '桑折先生の事業化条件を検証する', '実証先、試作条件、顧客根拠、資金計画を更新し、次の申請や事業化判断に必要な情報を揃える。', 'AMD・桑折先生・大学', 'active', '2026-09-01', 'medium', 'manual', 'KUTE FY2026 task review / 桑折先生'),
  ('25000000-2026-4000-8000-000000000105', 'p25', '25000000-2026-4000-8000-000000000001', 'kute-fy2026-self-sustain', 'self_sustain', '自走化と連携の方式を比較する', '支援運営費、収入源、連携候補、資金循環の方式、大学の役割を比較し、次年度方針をまとめる。', 'AMD・大学', 'active', '2026-09-01', 'low', 'manual', 'KUTE FY2026 task review / 自走化・連携'),
  ('25000000-2026-4000-8000-000000000106', 'p25', '25000000-2026-4000-8000-000000000001', 'kute-fy2026-reporting', 'reporting', '今期の成果を報告する', '契約3領域の成果、未達、次年度への引継ぎを成果報告書1通にまとめて提出する。', 'AMD', 'unassessed', '2026-09-01', 'medium', 'manual', 'KUTE FY2026 task review / 年度報告')
ON CONFLICT DO NOTHING;

UPDATE public.project_management_milestones
SET slug = 'kute-fy2026-certification-phase', title = '認定制度',
    gate = '作成済みの案と大学の決裁・施行を区別して確認する',
    planned_start = '2026-05-01', planned_end = '2027-03-31',
    next_deliverable = '決裁結果 / 運用フロー / 第1号案件の点検',
    max_issue = '規程と内規の決裁記録に不一致がある',
    completion_criteria = '大学の採用版、施行日、運用手順、第1号案件の不足事項を追跡できる',
    baseline_plan_version = 'kute-fy2026-task-review-20260901', last_verified_at = '2026-09-01',
    confidence = 'medium', source_kind = 'manual', source_ref = 'KUTE FY2026 task review / 認定制度', sort_order = 1
WHERE id = '25000000-2026-4000-8000-000000000201'::uuid AND project_id = 'p25';

UPDATE public.project_management_milestones
SET slug = 'kute-fy2026-seed-discovery-phase', title = 'シーズ発掘',
    gate = '候補調査と大学承認後の接触・検証を分ける',
    planned_start = '2026-08-25', planned_end = '2027-03-31',
    next_deliverable = '評価項目 / 選定手順 / 接触承認手順',
    max_issue = '研究者接触と情報共有の承認手順が未確定',
    completion_criteria = '候補選定から研究者ヒアリング、仮説検証、引渡しまでの記録方法を合意する',
    baseline_plan_version = 'kute-fy2026-task-review-20260901', last_verified_at = '2026-09-01',
    confidence = 'medium', source_kind = 'manual', source_ref = 'KUTE FY2026 task review / シーズ発掘', sort_order = 3
WHERE id = '25000000-2026-4000-8000-000000000202'::uuid AND project_id = 'p25';

UPDATE public.project_management_milestones
SET deleted_at = now(), deleted_by = 'kute-fy2026-task-rebuild'
WHERE project_id = 'p25'
  AND id IN ('25000000-2026-4000-8000-000000000203'::uuid, '25000000-2026-4000-8000-000000000204'::uuid)
  AND deleted_at IS NULL;

INSERT INTO public.project_management_milestones
  (id, project_id, objective_id, outcome_id, slug, track, title, gate, timeline_kind,
   planned_start, planned_end, date_certainty, status, progress_pct, owner_label,
   next_deliverable, max_issue, completion_criteria, criticality, baseline_plan_version,
   status_source, last_verified_at, confidence, source_kind, source_ref, sort_order)
VALUES
  ('25000000-2026-4000-8000-000000000205', 'p25', '25000000-2026-4000-8000-000000000001', '25000000-2026-4000-8000-000000000103', 'kute-fy2026-regulations-phase', 'regulations', '関連6規程', '6規程を一括の進捗率にせず個別に追う', 'phase', '2026-08-01', '2027-03-31', 'provisional', 'unassessed', 0, 'AMD・大学', '原典回収 / 6規程の個別原案', '大学保有の原典と決裁日程が未確定', '規程ごとに原典、原案、学内意見、決裁版、施行版を追跡できる', 'high', 'kute-fy2026-task-review-20260901', 'derived', '2026-09-01', 'medium', 'manual', 'KUTE FY2026 task review / 関連6規程', 2),
  ('25000000-2026-4000-8000-000000000206', 'p25', '25000000-2026-4000-8000-000000000001', '25000000-2026-4000-8000-000000000104', 'kute-fy2026-koori-phase', 'koori', '桑折先生', '調査完了と実証受注・事業化成功を混同しない', 'phase', '2026-06-24', '2027-03-31', 'provisional', 'on_track', 0, 'AMD・桑折先生・大学', '実証先 / 試作条件 / 費用確認', '有償実証の受入先と資金が未確定', '検証結果を事業計画と資金計画へ反映し、次の判断条件を記録する', 'high', 'kute-fy2026-task-review-20260901', 'derived', '2026-09-01', 'medium', 'manual', 'KUTE FY2026 task review / 桑折先生', 4),
  ('25000000-2026-4000-8000-000000000207', 'p25', '25000000-2026-4000-8000-000000000001', '25000000-2026-4000-8000-000000000105', 'kute-fy2026-self-sustain-phase', 'self_sustain', '自走化・連携', 'ファンド設立や調達額を今期の確約に読み替えない', 'phase', '2026-09-01', '2027-03-31', 'provisional', 'unassessed', 0, 'AMD・大学', '支援運営費 / 収入源 / 連携候補', '具体検討はこれから', '方式ごとの負担、運営者、資金使途と大学の役割を比較する', 'medium', 'kute-fy2026-task-review-20260901', 'derived', '2026-09-01', 'low', 'manual', 'KUTE FY2026 task review / 自走化・連携', 5),
  ('25000000-2026-4000-8000-000000000208', 'p25', '25000000-2026-4000-8000-000000000001', '25000000-2026-4000-8000-000000000106', 'kute-fy2026-reporting-phase', 'reporting', '年度報告', '期間満了後1か月以内に成果報告書を提出する', 'phase', '2027-04-01', '2027-04-30', 'provisional', 'unassessed', 0, 'AMD', '成果報告書1通', '契約終了日が変わる場合は期限も連動する', '契約3領域の成果、未達、次年度への引継ぎをまとめて提出する', 'high', 'kute-fy2026-task-review-20260901', 'derived', '2026-09-01', 'medium', 'manual', 'KUTE FY2026 task review / 年度報告', 6)
ON CONFLICT DO NOTHING;

-- Preserve the imported six rows as history rather than physically deleting them.
UPDATE public.project_management_tasks
SET deleted_at = now(), deleted_by = 'kute-fy2026-task-rebuild'
WHERE project_id = 'p25'
  AND id IN (
    '25000000-2026-4000-8000-000000000301'::uuid,
    '25000000-2026-4000-8000-000000000302'::uuid,
    '25000000-2026-4000-8000-000000000303'::uuid,
    '25000000-2026-4000-8000-000000000304'::uuid,
    '25000000-2026-4000-8000-000000000305'::uuid,
    '25000000-2026-4000-8000-000000000306'::uuid
  ) AND deleted_at IS NULL;

INSERT INTO public.project_management_tasks
  (id, project_id, milestone_id, track, title, description, goal, next_deliverable,
   completion_criteria, planned_start, planned_end, actual_end, status, progress_pct,
   date_certainty, owner_label, sort_order, last_verified_at, confidence, source_kind, source_ref)
SELECT id::uuid, 'p25', milestone_id::uuid,
  CASE track WHEN 'certification' THEN 'regulation' WHEN 'seed_discovery' THEN 'seed' ELSE track END,
  title, description, goal, deliverable,
  criteria, start_on::date, end_on::date, actual_end::date, status,
  CASE WHEN status = 'completed' THEN 100 ELSE 0 END,
  certainty, owner_label, sort_order, '2026-09-01'::date, confidence, 'manual',
  'KUTE FY2026 task review / ' || code || ' / ' || source_note
FROM (VALUES
  ('25000000-2026-4000-8000-000000000401','25000000-2026-4000-8000-000000000201','certification','R01','認定規程の修正案を作成する','6/24確定版という名称の文書を確認。完了は条文案の作成までで、大学の採用・施行はR04で確認する。','大学の定義と認定要件を反映した条文案を用意する','認定規程の条文案','大学の定義と認定要件を反映した条文案がある','2026-05-01','2026-06-24','2026-06-24','completed','confirmed','AMD',1,'high','6/24規程版'),
  ('25000000-2026-4000-8000-000000000402','25000000-2026-4000-8000-000000000201','certification','R02','認定委員会の内規案を作成する','8/7修正版を確認。完了は内規案の作成までで、施行日は未確認。','委員構成、審査、守秘義務を内規案にする','認定委員会内規案','委員構成、審査、守秘義務を記した内規案がある','2026-06-01','2026-08-07','2026-08-07','completed','confirmed','AMD・大学',2,'high','8/7内規修正版'),
  ('25000000-2026-4000-8000-000000000403','25000000-2026-4000-8000-000000000201','certification','R03','認定審査チェックシートを作成する','7/17版を確認。内規との最終整合はR06で扱う。','委員が審査時に確認する項目を運用資料にする','認定審査チェックシート','委員の確認項目を内規とは別の運用資料に整理する','2026-07-01','2026-07-17','2026-07-17','completed','confirmed','AMD',3,'high','7/17チェックシート'),
  ('25000000-2026-4000-8000-000000000404','25000000-2026-4000-8000-000000000201','certification','R04','認定規程と内規の決裁結果を確認する','6/23議事録、規程台帳、内規の引用で決裁状態が一致していない。大学の記録で確定する。','大学側の採用版と施行状態を確定する','承認日・施行日・採用版の確認記録','規程と内規それぞれの承認日、施行日、採用版を大学の記録で確認する',NULL,NULL,NULL,'attention','provisional','大学決裁・AMD確認',4,'low','決裁記録に不一致'),
  ('25000000-2026-4000-8000-000000000405','25000000-2026-4000-8000-000000000201','certification','R05','支援細則の対象と条文を修正する','6/22案あり。認定と個別支援の区分、他規程との重複を整理する。','支援細則の適用範囲を確定する','大学へ渡す支援細則案','認定と個別支援の区分を確定し、他規程との重複を解消した案を大学へ渡す','2026-09-01','2026-09-30',NULL,'unassessed','provisional','AMD・大学',5,'medium','6/22案・次回確認'),
  ('25000000-2026-4000-8000-000000000406','25000000-2026-4000-8000-000000000201','certification','R06','認定申請から通知までの業務フローと様式を整える','既存フローへ担当課、施設設備確認、チェックシートとの整合を反映する。','申請者から通知までの担当と入出力を通しで確認する','業務フロー・様式一式','申請者、事務局、委員会、関係部署の担当と入出力を通しで確認する','2026-09-01','2026-09-30',NULL,'unassessed','provisional','AMD・大学',6,'medium','9月確認案'),
  ('25000000-2026-4000-8000-000000000407','25000000-2026-4000-8000-000000000201','certification','R07','第1号案件の認定申請一式を点検する','大学の日程と案件情報が揃ってから点検する。認定そのものは大学の判断。','第1号案件の申請不足と対応者を明確にする','不足事項・対応者一覧','必要書類、兼業手続、利益相反確認、登記条件の不足と対応者を一覧化する',NULL,NULL,NULL,'unassessed','provisional','大学主体・AMD支援',7,'low','大学日程に連動'),

  ('25000000-2026-4000-8000-000000000408','25000000-2026-4000-8000-000000000205','regulations','R08','規程改正の対象と進め方案を大学へ共有する','8/28共有を8月報告書で確認。完了は計画共有までで、個別原案の完成ではない。','6規程の改正対象と対応順序を共有する','規程改正計画','規程ごとの改正対象と対応順序を記した計画を共有する','2026-08-01','2026-08-28','2026-08-28','completed','confirmed','AMD',1,'high','8/28改正計画共有'),
  ('25000000-2026-4000-8000-000000000409','25000000-2026-4000-8000-000000000205','regulations','R09','施設設備の利用規程と運用実態を確認する','共有依頼と分担整理まで。大学からの原典と担当課回答を回収する。','施設設備利用の現行ルールと実態を確定する','原典・運用実態・担当課回答','既存規程、利用対象、料金、安全管理、契約区分、担当課の回答を揃える','2026-09-01','2026-09-30',NULL,'unassessed','provisional','大学・AMD',2,'medium','9月確認予定'),
  ('25000000-2026-4000-8000-000000000410','25000000-2026-4000-8000-000000000205','regulations','R10','知財規程とライセンス契約ひな形を回収する','大学が現在採用している原典を版付きで受け取る。','知財利用条件の原案作成に必要な原典を揃える','知財規程・契約ひな形','採用中の本文とひな形を版付きで参照できる',NULL,NULL,NULL,'unassessed','provisional','大学提供・AMD確認',3,'low','原典未回収'),
  ('25000000-2026-4000-8000-000000000411','25000000-2026-4000-8000-000000000205','regulations','R11','共同研究規程と契約ひな形を回収する','大学が現在採用している原典を版付きで受け取る。','共同研究条件の原案作成に必要な原典を揃える','共同研究規程・契約ひな形','採用中の本文とひな形を版付きで参照できる',NULL,NULL,NULL,'unassessed','provisional','大学提供・AMD確認',4,'low','原典未回収'),
  ('25000000-2026-4000-8000-000000000412','25000000-2026-4000-8000-000000000205','regulations','R12','SU兼業の申請条件と承認手順を原案にする','役員等の関与形態、申請様式、承認者、利益相反審査への接続を条文と手順にする。','SU兼業の申請と承認を運用できる原案にする','SU兼業規程の原案','関与形態、申請様式、承認者、利益相反審査への接続を記す','2026-10-01','2027-03-31',NULL,'unassessed','provisional','AMD・大学',5,'low','10月以降の素案計画'),
  ('25000000-2026-4000-8000-000000000413','25000000-2026-4000-8000-000000000205','regulations','R13','SU向け知財利用条件の改正案を作る','R10の原典を基に現行規程との差分と必要な契約ひな形を整理する。','SU向け知財利用条件を原案にする','知財規程改正案・必要ひな形','現行規程との差分、権利許諾と費用の扱い、必要なひな形を揃える','2026-10-01','2027-03-31',NULL,'unassessed','provisional','AMD・大学',6,'low','R10後・10月以降'),
  ('25000000-2026-4000-8000-000000000414','25000000-2026-4000-8000-000000000205','regulations','R14','株式と新株予約権の取得管理ルールを原案にする','取得主体、評価、会計、権利行使、売却、決裁者を規程案にする。','大学が株式等を取得・管理する判断手順を原案にする','株式等取得管理ルール案','取得主体、評価、会計、権利行使、売却、決裁者の案を揃える','2026-10-01','2027-03-31',NULL,'unassessed','provisional','AMD・大学財務等',7,'low','10月以降の素案計画'),
  ('25000000-2026-4000-8000-000000000415','25000000-2026-4000-8000-000000000205','regulations','R15','SUとの共同研究条件の改正案を作る','R11の原典を基に契約、費用、成果と知財、学生関与を整理する。','SUとの共同研究条件を原案にする','共同研究規程改正案','契約、費用、成果と知財、学生関与の扱いを整理する','2026-10-01','2027-03-31',NULL,'unassessed','provisional','AMD・大学',8,'low','R11後・10月以降'),
  ('25000000-2026-4000-8000-000000000416','25000000-2026-4000-8000-000000000205','regulations','R16','SU関与に伴う利益相反の申告と審査手順を改正案にする','現行原典を基にSU対応で追加する申告項目と審査担当を整理する。','SU関与時の利益相反を申告・審査できる案にする','利益相反規程改正案','役員、報酬、株式、研究費、学生指導の申告項目と審査担当を整理する','2026-10-01','2027-03-31',NULL,'unassessed','provisional','AMD・大学',9,'low','10月以降の素案計画'),
  ('25000000-2026-4000-8000-000000000417','25000000-2026-4000-8000-000000000205','regulations','R17','SUの施設設備利用ルールを原案にする','R09の確認結果を基に利用許可、料金、安全、事故責任と様式を整える。','SUが施設設備を利用する手順を原案にする','施設設備利用ルール案・様式','利用許可、料金、安全、事故責任と必要様式を揃える','2026-10-01','2027-03-31',NULL,'unassessed','provisional','AMD・大学',10,'low','R09後・10月以降'),
  ('25000000-2026-4000-8000-000000000418','25000000-2026-4000-8000-000000000205','regulations','R18','各規程の学内意見を反映して決裁版を提出する','原案確認後、実行時は規程ごとに子タスクへ分ける。','6規程を学内決裁へ出せる版にする','規程別の決裁提出版','規程ごとに未解決論点、承認者、採用版が追跡できる',NULL,NULL,NULL,'unassessed','provisional','AMD・大学',11,'low','原案確認後に設定'),
  ('25000000-2026-4000-8000-000000000419','25000000-2026-4000-8000-000000000205','regulations','R19','各規程の施行版と様式を引き渡す','大学決裁後、実行時は規程ごとに子タスクへ分ける。','決裁済み6規程を運用可能な形で引き渡す','施行版・様式・運用担当一覧','規程ごとに決裁結果、施行版、運用担当、必要様式を確認する',NULL,NULL,NULL,'unassessed','provisional','大学決裁・AMD引渡し',12,'low','日程は要再合意'),

  ('25000000-2026-4000-8000-000000000420','25000000-2026-4000-8000-000000000202','seed_discovery','S01','公開情報のシーズ候補を調べて比較一覧に整理する','8/31候補追加と9/1用比較メモを確認。完了は公開情報調査までで、大学確認済みや全学網羅ではない。','候補ごとの用途仮説と不足情報を比較できるようにする','シーズ候補の比較一覧','研究技術、用途仮説、根拠、未確認事項を候補別に記す','2026-08-25','2026-08-31','2026-08-31','completed','confirmed','AMD',1,'high','8/31比較メモ'),
  ('25000000-2026-4000-8000-000000000421','25000000-2026-4000-8000-000000000202','seed_discovery','S02','シーズ評価の項目と候補選定手順を大学と決める','一覧はあるが、評価と選定の運用合意は未確認。','候補を同じ基準で継続・見送り判断できるようにする','評価項目・候補選定手順','評価項目、追加調査条件、見送り理由の記録方法を合意する','2026-09-01','2026-09-30',NULL,'unassessed','provisional','まさ・大学',2,'medium','9月協議予定'),
  ('25000000-2026-4000-8000-000000000422','25000000-2026-4000-8000-000000000202','seed_discovery','S03','研究者への接触と情報共有の承認手順を決める','8/25の方向性合意を個別接触の許可へ拡張しない。','研究者への連絡と情報共有を大学承認の下で行えるようにする','接触・共有の承認手順','誰が誰に何を確認し、どの情報を共有できるか合意する',NULL,NULL,NULL,'attention','provisional','AMD・大学',3,'low','個別接触許可は未確認'),
  ('25000000-2026-4000-8000-000000000423','25000000-2026-4000-8000-000000000202','seed_discovery','S04','優先候補の研究者ヒアリングを実施する','S02とS03の後、承認された対象ごとに実施する。起業意思を必須にしない。','技術条件と研究者の関与範囲を確認する','候補別ヒアリング記録','承認された対象ごとに技術条件、研究者の関与範囲、次の検証を記録する',NULL,NULL,NULL,'unassessed','provisional','AMD・大学',4,'low','S02・S03後'),
  ('25000000-2026-4000-8000-000000000424','25000000-2026-4000-8000-000000000202','seed_discovery','S05','候補ごとの顧客課題と事業仮説を検証する','S04後、候補ごとに分けて実施する。','顧客課題と試験条件を確かめ、継続か見送りか判断する','候補別の検証記録','顧客候補、代替手段、試験条件、継続か見送りかの理由を記録する',NULL,NULL,NULL,'unassessed','provisional','AMD・研究者',5,'low','S04後'),
  ('25000000-2026-4000-8000-000000000425','25000000-2026-4000-8000-000000000202','seed_discovery','S06','継続候補の初期計画と引渡し条件を整理する','S05後、起業家候補への引渡し要否も含めて判断する。','継続候補を次の担当へ渡せる形にする','候補別の初期計画・引継資料','課題、検証結果、事業仮説、必要人材、次の予算を引継資料にする',NULL,NULL,NULL,'unassessed','provisional','AMD・大学',6,'low','S05後'),

  ('25000000-2026-4000-8000-000000000426','25000000-2026-4000-8000-000000000206','koori','K01','技術と研究者の関与希望を初回面談で確認する','6/24開催後議事録を確認。','技術、知財課題、研究者の関与希望を把握する','初回面談記録','技術、知財の課題、研究者の関与希望を記録する','2026-06-24','2026-06-24','2026-06-24','completed','confirmed','まさ・桑折先生・大学',1,'high','6/24開催後議事録'),
  ('25000000-2026-4000-8000-000000000427','25000000-2026-4000-8000-000000000206','koori','K02','事業化シナリオと起業判断の条件をすり合わせる','8/4協議と、有償現地実証1件を起業判断の目安とする整理を確認。','次の検証と起業判断の目安を共有する','シナリオ比較・判断条件','比較資料とロードマップを使い、次の検証と起業判断の目安を確認する','2026-08-04','2026-08-04','2026-08-04','completed','confirmed','AMD・桑折先生・大学',2,'high','8/4協議・8月報告書'),
  ('25000000-2026-4000-8000-000000000428','25000000-2026-4000-8000-000000000206','koori','K03','生産現場のニーズ調査と用途比較を実施する','8名の回答と10用途の比較、8/20検討を確認。','用途ごとの顧客課題と不足根拠を比較する','ニーズ調査・用途比較結果','8名の回答と10用途を比較し、用途ごとの不足根拠を整理する','2026-08-01','2026-08-20','2026-08-20','completed','confirmed','AMD',3,'high','8月調査・8/20検討'),
  ('25000000-2026-4000-8000-000000000429','25000000-2026-4000-8000-000000000206','koori','K04','9月GTIEエントリーの申請要否を決める','8/20に見送り決定。申請そのものを未完タスクとして残さない。','調査結果から9月申請の要否を決める','申請・見送り判断と理由','調査結果に基づき申請か見送りかと理由を記録する','2026-08-20','2026-08-20','2026-08-20','completed','confirmed','AMD・桑折先生・大学',4,'high','8/20見送り決定'),
  ('25000000-2026-4000-8000-000000000430','25000000-2026-4000-8000-000000000206','koori','K05','実証を受け入れる事業会社を探す','候補探索を進める。相手企業の判断を伴う実証受注は別の判定点。','現地実証の受入候補と条件を具体化する','候補会社・接触状況・受入条件','候補会社と接触状況、受入条件、次の協議事項を記録する','2026-09-01','2026-09-30',NULL,'on_track','provisional','AMD・大学',5,'medium','9月予定・継続'),
  ('25000000-2026-4000-8000-000000000431','25000000-2026-4000-8000-000000000206','koori','K06','腐食試験と中温用モジュール試作の条件と費用を確認する','発注済みや試験完了とは扱わず、実施判断に必要な条件を揃える。','試験・試作の実施可否を判断できるようにする','試験条件・委託先・概算費用','試験条件、委託先、概算費用、実施判断を揃える','2026-09-01','2026-09-30',NULL,'on_track','provisional','桑折先生・大学・AMD',6,'medium','9月予定'),
  ('25000000-2026-4000-8000-000000000432','25000000-2026-4000-8000-000000000206','koori','K07','検証結果を反映して事業計画と資金計画を更新する','次の公募締切は別途確認し、確認前に申請予定を確定しない。','検証結果を次の事業化判断と資金手段へつなぐ','更新した事業計画・資金計画','対象用途、顧客根拠、試作実証費、資金源、次の申請判断を記す','2026-09-01','2027-03-31',NULL,'on_track','provisional','AMD・桑折先生',7,'medium','9月以降・継続'),
  ('25000000-2026-4000-8000-000000000433','25000000-2026-4000-8000-000000000206','koori','K08','展示会で確かめる顧客条件と説明資料を用意する','出展日程を確認してから準備する。出展実施は未確認。','展示会で用途仮説と顧客条件を確かめられるようにする','質問項目・説明資料・開示範囲','出展日程を確認し、用途仮説、質問項目、開示範囲を揃える',NULL,NULL,NULL,'unassessed','provisional','AMD・桑折先生・大学',8,'low','日程要確認'),

  ('25000000-2026-4000-8000-000000000434','25000000-2026-4000-8000-000000000207','self_sustain','F01','大学の支援運営費と収入源を整理する','契約対象だが具体検討はこれから。','支援を続けるために必要な費用と収入の差を見えるようにする','運営費・収入源・資金不足の比較','必要な支援業務、人員と費用、収入源、資金不足を比較できる','2026-09-01','2026-10-31',NULL,'unassessed','provisional','AMD・大学',1,'low','9月着手・10月以降具体化'),
  ('25000000-2026-4000-8000-000000000435','25000000-2026-4000-8000-000000000207','self_sustain','F02','自治体と金融機関等の連携候補を整理する','候補の存在と連携合意を混同せず、協議事項まで整理する。','自走化に必要な外部資源と連携先候補を比較する','連携候補・役割・協議事項一覧','候補ごとの役割、期待する資源、協議事項を一覧化する','2026-10-01','2027-03-31',NULL,'unassessed','provisional','AMD・大学',2,'low','10月以降'),
  ('25000000-2026-4000-8000-000000000436','25000000-2026-4000-8000-000000000207','self_sustain','F03','大学と連携先の資金循環の方式を比較する','法務、会計、金融等の専門確認が必要な論点は別に記録する。','採用候補となる資金循環方式を比較する','方式比較・未確認事項','方式ごとの負担、運営者、資金の使途、必要な確認事項を比較する',NULL,NULL,NULL,'unassessed','provisional','AMD・大学',3,'low','F01・F02後'),
  ('25000000-2026-4000-8000-000000000437','25000000-2026-4000-8000-000000000207','self_sustain','F04','自走化の基本方針と次年度計画を大学とまとめる','3月取りまとめ予定。今期中のファンド設立や調達額を完了条件にしない。','比較結果を大学の方針と次年度工程へつなぐ','基本方針・未決事項・次年度工程','採用方針、未決事項、担当、次年度の工程を記録する','2027-03-01','2027-03-31',NULL,'unassessed','provisional','AMD・大学',4,'medium','2027年3月予定'),

  ('25000000-2026-4000-8000-000000000438','25000000-2026-4000-8000-000000000208','reporting','O01','今期3領域の業務成果報告書を提出する','契約終了日が変わらない場合、期間満了後1か月以内を目安にする。','今期の成果、未達、次年度への引継ぎを契約成果として残す','成果報告書1通','契約に従い成果報告書1通を大学へ提出する','2027-04-01','2027-04-30',NULL,'unassessed','provisional','AMD',1,'medium','期間満了後1か月以内')
) AS source(id, milestone_id, track, code, title, description, goal, deliverable, criteria,
            start_on, end_on, actual_end, status, certainty, owner_label, sort_order, confidence, source_note)
ON CONFLICT DO NOTHING;

DO $$
BEGIN
  IF (SELECT count(*) FROM public.project_management_tracks WHERE project_id = 'p25') <> 6 THEN
    RAISE EXCEPTION 'KUTE rebuilt track count is not 6';
  END IF;
  IF (SELECT count(*) FROM public.project_management_tasks WHERE project_id = 'p25' AND deleted_at IS NULL) <> 38 THEN
    RAISE EXCEPTION 'KUTE rebuilt task count is not 38';
  END IF;
  IF (SELECT count(*) FROM public.project_management_tasks WHERE project_id = 'p25' AND deleted_at IS NULL AND status = 'completed') <> 9 THEN
    RAISE EXCEPTION 'KUTE completed task count is not 9';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.project_management_tasks
    WHERE project_id = 'p25' AND deleted_at IS NULL AND status = 'completed'
      AND (progress_pct <> 100 OR actual_end IS NULL)
  ) THEN
    RAISE EXCEPTION 'KUTE completed task is missing 100 percent or actual_end';
  END IF;
END $$;

COMMIT;
