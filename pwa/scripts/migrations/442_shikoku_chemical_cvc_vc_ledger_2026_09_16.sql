-- 四国化成CVC（SHIKOKUイノベーションファンド）を VC マスタと SOL/LST の関係へ反映する。
-- 投資チケットの約5,000万円は、まさからの情報による目安であり、案件別の投資見込み額や投資判断ではない。
-- SOL は JMTC キャピタル経由の資料共有段階、LST は接点ありという指示以外の詳細が未確認。
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '45s';
SELECT pg_advisory_xact_lock(hashtext('shikoku_chemical_cvc_vc_ledger_2026_09_16'));

INSERT INTO public.vcs (
  name, name_en, slug, type, thesis, ticket_min_jpy, ticket_max_jpy, website, notes
) VALUES (
  '四国化成CVC（SHIKOKUイノベーションファンド）',
  'SHIKOKU Innovation Fund',
  'shikoku-innovation-fund',
  'cvc',
  '化学・材料領域を中心に、四国化成との事業連携が見込める投資先',
  50000000,
  50000000,
  'https://www.shikoku.co.jp/business-fields/innovation-fund/',
  'JMTCキャピタルがGP・運営会社。投資チケットは約5,000万円（まさからの情報）だが、適用条件・一次根拠は未確認。案件別の投資見込み額、正式な投資検討、出資判断を意味しない。'
)
ON CONFLICT (name) DO UPDATE SET
  name_en=EXCLUDED.name_en,
  slug=EXCLUDED.slug,
  type=EXCLUDED.type,
  thesis=EXCLUDED.thesis,
  ticket_min_jpy=EXCLUDED.ticket_min_jpy,
  ticket_max_jpy=EXCLUDED.ticket_max_jpy,
  website=EXCLUDED.website,
  notes=EXCLUDED.notes,
  updated_at=now();

WITH cvc AS (
  SELECT id FROM public.vcs
  WHERE name='四国化成CVC（SHIKOKUイノベーションファンド）'
)
INSERT INTO public.project_vc_relations (
  project_id, vc_id, status, first_contact_at, last_touch_at, expected_amount_jpy, notes
)
SELECT
  'p21', cvc.id, 'pitching', DATE '2026-09-14', DATE '2026-09-14', NULL,
  'JMTCキャピタル経由でSolvioraXの資料を四国化成側へ共有する段階。投資チケット目安は約5,000万円だが、案件別の投資見込み額ではない。正式な投資検討、出資判断、条件合意は未確認。'
FROM cvc
ON CONFLICT (project_id, vc_id) DO UPDATE SET
  status=EXCLUDED.status,
  first_contact_at=EXCLUDED.first_contact_at,
  last_touch_at=EXCLUDED.last_touch_at,
  expected_amount_jpy=EXCLUDED.expected_amount_jpy,
  notes=EXCLUDED.notes,
  updated_at=now();

WITH cvc AS (
  SELECT id FROM public.vcs
  WHERE name='四国化成CVC（SHIKOKUイノベーションファンド）'
)
INSERT INTO public.project_vc_relations (
  project_id, vc_id, status, first_contact_at, last_touch_at, expected_amount_jpy, notes
)
SELECT
  'p07', cvc.id, 'pitching', NULL, NULL, NULL,
  'LiSTieとの接点あり（まさの指示）。接点日、投資検討段階、投資判断、案件別の投資額は未確認。投資チケット目安は約5,000万円だが、案件別の投資見込み額ではない。'
FROM cvc
ON CONFLICT (project_id, vc_id) DO UPDATE SET
  status=EXCLUDED.status,
  first_contact_at=EXCLUDED.first_contact_at,
  last_touch_at=EXCLUDED.last_touch_at,
  expected_amount_jpy=EXCLUDED.expected_amount_jpy,
  notes=EXCLUDED.notes,
  updated_at=now();

INSERT INTO public.project_management_partners (
  id, project_id, slug, name, role_label, primary_track, relationship_stage,
  agreement_state, agreed_scope, unagreed_scope, last_contact_date,
  next_commitment, due_date, owner_label, last_verified_at, confidence,
  source_kind, source_ref, sort_order, current_ball_side, current_ball_owner,
  next_ball_owner, target_state, due_date_precision, connection_context,
  activity_state, classifications
) VALUES (
  '67bdfd0d-83f6-440c-b4a2-5363416ae2d5', 'p21', 'shikoku-innovation-fund',
  '四国化成CVC（SHIKOKUイノベーションファンド）',
  'CVC・投資判断主体', 'funding', 'information_exchange',
  'unagreed', '', '正式な投資検討、出資判断、投資条件は未確認',
  DATE '2026-09-14',
  'JMTCキャピタルからの資料共有後、先方の反応と次の面談・追加資料の要否を確認する',
  NULL, 'JMTCキャピタル', DATE '2026-09-16', 'high',
  'manual', 'MTG JMTC-SolvioraX 2026-09-14 / user:2026-09-16#shikoku-cvc',
  75, 'partner', 'JMTCキャピタル', 'JMTCキャピタル',
  '資料共有後の反応と次の面談・追加資料の要否が分かる', 'unknown',
  'JMTCキャピタルがGP・運営会社としてSolvioraXの資料を四国化成側へ共有する段階',
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
SELECT 'e42ca6f0-9541-4a82-936e-67b66ab52f2e', 'p21', id,
  'shareholder_investor', 'in_progress', 'CVC・投資判断主体',
  true, 0, 'manual', 'MTG JMTC-SolvioraX 2026-09-14 / user:2026-09-16#shikoku-cvc'
FROM public.project_management_partners
WHERE project_id='p21' AND slug='shikoku-innovation-fund'
ON CONFLICT (id) DO UPDATE SET
  relationship_state=EXCLUDED.relationship_state, role_label=EXCLUDED.role_label,
  is_primary=EXCLUDED.is_primary, source_kind=EXCLUDED.source_kind,
  source_ref=EXCLUDED.source_ref, deleted_at=NULL, deleted_by=NULL, updated_at=now();

INSERT INTO public.project_management_partner_interactions (
  id, project_id, partner_id, interaction_kind, occurred_on, occurred_on_precision,
  summary, outcome_summary, ball_side_after, ball_owner_after, confidence,
  source_kind, source_ref, actor_side, actor_label, detail_md
)
SELECT 'aec8803b-1c33-47e6-8d37-4a2aedd2b907', 'p21', id, 'handoff',
  DATE '2026-09-14', 'day',
  'JMTCキャピタル経由でSolvioraXの事業概要資料を四国化成側へ共有予定',
  '資料共有後の先方反応と、次の面談・追加資料の要否を確認する。正式な投資検討、出資判断、条件合意は未確認。',
  'partner', 'JMTCキャピタル', 'high', 'manual',
  'MTG JMTC-SolvioraX 2026-09-14 / user:2026-09-16#shikoku-cvc',
  'shared', 'JMTCキャピタル・SolvioraX',
  'この記録はGP経由の案件共有を表す。四国化成CVCがSolvioraXの投資検討を開始したこと、または出資判断をしたことは表さない。'
FROM public.project_management_partners
WHERE project_id='p21' AND slug='shikoku-innovation-fund'
ON CONFLICT (id) DO UPDATE SET
  summary=EXCLUDED.summary, outcome_summary=EXCLUDED.outcome_summary,
  ball_side_after=EXCLUDED.ball_side_after, ball_owner_after=EXCLUDED.ball_owner_after,
  detail_md=EXCLUDED.detail_md, deleted_at=NULL, deleted_by=NULL, updated_at=now();

DO $$
DECLARE
  cvc_count int;
  relation_count int;
  partner_count int;
  role_count int;
  interaction_count int;
BEGIN
  SELECT count(*) INTO cvc_count
  FROM public.vcs
  WHERE name='四国化成CVC（SHIKOKUイノベーションファンド）'
    AND ticket_min_jpy=50000000
    AND ticket_max_jpy=50000000;

  SELECT count(*) INTO relation_count
  FROM public.project_vc_relations relation
  JOIN public.vcs vc ON vc.id=relation.vc_id
  WHERE vc.name='四国化成CVC（SHIKOKUイノベーションファンド）'
    AND relation.project_id IN ('p21', 'p07')
    AND relation.expected_amount_jpy IS NULL;

  SELECT count(*) INTO partner_count
  FROM public.project_management_partners
  WHERE project_id='p21' AND slug='shikoku-innovation-fund' AND deleted_at IS NULL;

  SELECT count(*) INTO role_count
  FROM public.project_management_partner_roles role
  JOIN public.project_management_partners partner ON partner.id=role.partner_id
  WHERE partner.project_id='p21'
    AND partner.slug='shikoku-innovation-fund'
    AND role.role_kind='shareholder_investor'
    AND role.deleted_at IS NULL;

  SELECT count(*) INTO interaction_count
  FROM public.project_management_partner_interactions
  WHERE id='aec8803b-1c33-47e6-8d37-4a2aedd2b907' AND deleted_at IS NULL;

  IF cvc_count <> 1 OR relation_count <> 2 OR partner_count <> 1 OR role_count <> 1 OR interaction_count <> 1 THEN
    RAISE EXCEPTION
      '442 Shikoku CVC ledger incomplete: VC %, relations %, partner %, role %, interaction %',
      cvc_count, relation_count, partner_count, role_count, interaction_count;
  END IF;
END $$;
COMMIT;
