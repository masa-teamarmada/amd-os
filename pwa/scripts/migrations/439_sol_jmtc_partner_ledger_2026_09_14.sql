-- SOL（p21）: 2026-09-14 JMTC面談を関係先台帳へ登録する。
-- 資料共有と、正式な投資検討開始・出資判断・条件合意は別状態として扱う。
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '45s';
SELECT pg_advisory_xact_lock(hashtext('sol_jmtc_partner_ledger_2026_09_14'));

INSERT INTO public.project_management_partners (
  id, project_id, slug, name, role_label, primary_track, relationship_stage,
  agreement_state, agreed_scope, unagreed_scope, last_contact_date,
  next_commitment, due_date, owner_label, last_verified_at, confidence,
  source_kind, source_ref, sort_order, current_ball_side, current_ball_owner,
  next_ball_owner, target_state, due_date_precision, connection_context,
  activity_state, classifications
) VALUES (
  '7e2c0b65-f89b-4baa-b7a6-8f50454362f9', 'p21', 'jmtc',
  'JMTC（日本材料技研）',
  '四国化成CVC「SHIKOKUイノベーションファンド」の運営・案件接続',
  'funding', 'information_exchange', 'partial',
  'JMTC側がSolvioraXの事業概要資料を四国化成側へ共有する。金属回収との相性から三菱マテリアルCVCへの展開も検討する',
  '四国化成CVC・三菱マテリアルCVCの正式な投資検討開始、出資判断、投資条件は未確認',
  DATE '2026-09-14',
  'JMTCから、四国化成CVCへの資料共有と三菱マテリアルCVCへの展開状況の連絡を待つ',
  DATE '2026-10-31', '山地', DATE '2026-09-14', 'high', 'manual',
  'MTG JMTC-SolvioraX 2026-09-14（Google Calendar添付の会議メモ）',
  74, 'partner', 'JMTC', '山地',
  'CVCへの案件共有結果が分かり、次の面談や追加資料の要否を判断できる',
  'month',
  '四国化成との事業連携を検討する中で、四国化成CVC「SHIKOKUイノベーションファンド」と、その運営会社（GP）が浦田さんを通じてよく知っているJMTC（日本材料技研）の100%子会社JMTCキャピタルであることが分かり、JMTCへ問い合わせた。JMTCキャピタルは案件発掘、DD、投資判断・投資実行を担い、三菱マテリアルCVCも運営している',
  'waiting_partner', ARRAY['vc']::text[]
)
ON CONFLICT (project_id, slug) DO UPDATE SET
  name=EXCLUDED.name, role_label=EXCLUDED.role_label, primary_track=EXCLUDED.primary_track,
  relationship_stage=EXCLUDED.relationship_stage, agreement_state=EXCLUDED.agreement_state,
  agreed_scope=EXCLUDED.agreed_scope, unagreed_scope=EXCLUDED.unagreed_scope,
  last_contact_date=EXCLUDED.last_contact_date, next_commitment=EXCLUDED.next_commitment,
  due_date=EXCLUDED.due_date, owner_label=EXCLUDED.owner_label,
  last_verified_at=EXCLUDED.last_verified_at, confidence=EXCLUDED.confidence,
  source_kind=EXCLUDED.source_kind, source_ref=EXCLUDED.source_ref,
  current_ball_side=EXCLUDED.current_ball_side, current_ball_owner=EXCLUDED.current_ball_owner,
  next_ball_owner=EXCLUDED.next_ball_owner, target_state=EXCLUDED.target_state,
  due_date_precision=EXCLUDED.due_date_precision, connection_context=EXCLUDED.connection_context,
  activity_state=EXCLUDED.activity_state, classifications=EXCLUDED.classifications,
  deleted_at=NULL, deleted_by=NULL, updated_at=now();

INSERT INTO public.project_management_partner_roles (
  id, project_id, partner_id, role_kind, relationship_state, role_label,
  is_primary, sort_order, source_kind, source_ref
)
SELECT '47f6a170-344c-4abc-b5e3-28aedd863369', 'p21', id,
  'shareholder_investor', 'in_progress', 'CVC運営・投資先候補への案件接続',
  true, 0, 'manual', 'MTG JMTC-SolvioraX 2026-09-14'
FROM public.project_management_partners WHERE project_id='p21' AND slug='jmtc'
ON CONFLICT (id) DO UPDATE SET relationship_state=EXCLUDED.relationship_state,
  role_label=EXCLUDED.role_label, is_primary=EXCLUDED.is_primary,
  source_kind=EXCLUDED.source_kind, source_ref=EXCLUDED.source_ref,
  deleted_at=NULL, deleted_by=NULL, updated_at=now();

INSERT INTO public.project_management_partner_interactions (
  id, project_id, partner_id, interaction_kind, occurred_on, occurred_on_precision,
  summary, outcome_summary, ball_side_after, ball_owner_after, confidence,
  source_kind, source_ref, actor_side, actor_label, detail_md
)
SELECT '016e1ca9-1a32-4851-93ce-9e375c579577', 'p21', id, 'meeting',
  DATE '2026-09-14', 'day', 'JMTCへSolvioraXの事業概要・技術・競合・コストを説明',
  'JMTC側が資料を四国化成側へ共有し、金属回収との相性から三菱マテリアルCVCへの展開も検討。2026年10月後半を目安に動きがあれば連絡',
  'partner', 'JMTC', 'high', 'manual',
  'MTG JMTC-SolvioraX 2026-09-14（Google Calendar添付の会議メモ）',
  'shared', 'JMTC・SolvioraX',
  '現在地はJMTCからCVC側へ案件を展開してもらう段階。四国化成CVC・三菱マテリアルCVCの正式な投資検討開始、出資判断、条件合意はいずれも未確認。主な確認事項は、色素分解・金属取り込みの仕組み、高温排水での違い、規模、コスト、金属の選択性。'
FROM public.project_management_partners WHERE project_id='p21' AND slug='jmtc'
ON CONFLICT (id) DO UPDATE SET summary=EXCLUDED.summary,
  outcome_summary=EXCLUDED.outcome_summary, ball_side_after=EXCLUDED.ball_side_after,
  ball_owner_after=EXCLUDED.ball_owner_after, detail_md=EXCLUDED.detail_md,
  deleted_at=NULL, deleted_by=NULL, updated_at=now();

INSERT INTO public.project_management_partner_work_items (
  id, project_id, partner_id, side, item_kind, title, detail, owner_label,
  status, due_date, due_date_precision, completion_criteria,
  last_verified_at, confidence, source_kind, source_ref, sort_order
)
SELECT 'e28a21c9-2133-40b1-a1f9-3dc4b32370ee', 'p21', id, 'partner', 'response',
  '四国化成CVC・三菱マテリアルCVCへの案件展開状況を連絡',
  'JMTC側で事業概要資料を四国化成側へ共有し、金属回収との相性を踏まえて三菱マテリアルCVCへの展開も検討する',
  'JMTC', 'waiting', DATE '2026-10-31', 'month',
  'どちらのCVCへ共有したか、先方の反応、次の面談や追加資料の要否が分かる',
  DATE '2026-09-14', 'high', 'manual',
  'MTG JMTC-SolvioraX 2026-09-14（Google Calendar添付の会議メモ）', 0
FROM public.project_management_partners WHERE project_id='p21' AND slug='jmtc'
ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title, detail=EXCLUDED.detail,
  owner_label=EXCLUDED.owner_label, status=EXCLUDED.status, due_date=EXCLUDED.due_date,
  due_date_precision=EXCLUDED.due_date_precision, completion_criteria=EXCLUDED.completion_criteria,
  last_verified_at=EXCLUDED.last_verified_at, deleted_at=NULL, deleted_by=NULL, updated_at=now();

DO $$ DECLARE p_count int; r_count int; i_count int; w_count int;
BEGIN
  SELECT count(*) INTO p_count FROM public.project_management_partners WHERE project_id='p21' AND slug='jmtc' AND deleted_at IS NULL;
  SELECT count(*) INTO r_count FROM public.project_management_partner_roles r JOIN public.project_management_partners p ON p.id=r.partner_id WHERE p.project_id='p21' AND p.slug='jmtc' AND r.role_kind='shareholder_investor' AND r.deleted_at IS NULL;
  SELECT count(*) INTO i_count FROM public.project_management_partner_interactions WHERE id='016e1ca9-1a32-4851-93ce-9e375c579577' AND deleted_at IS NULL;
  SELECT count(*) INTO w_count FROM public.project_management_partner_work_items WHERE id='e28a21c9-2133-40b1-a1f9-3dc4b32370ee' AND deleted_at IS NULL;
  IF p_count<>1 OR r_count<>1 OR i_count<>1 OR w_count<>1 THEN
    RAISE EXCEPTION '439 JMTC ledger incomplete: partner %, role %, interaction %, work item %', p_count,r_count,i_count,w_count;
  END IF;
END $$;
COMMIT;
