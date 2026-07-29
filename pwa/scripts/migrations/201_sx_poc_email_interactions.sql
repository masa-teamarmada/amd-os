-- 201_sx_poc_email_interactions.sql
-- Reflect the verified PoC-candidate email exchanges visible in the shared
-- Gmail mailbox into the SX partner ledger without storing message bodies,
-- addresses, URLs, or personal contact details.
--
-- Evidence window: Gmail threads reviewed on 2026-07-29 JST.
-- The stored interaction rows are short operational summaries only. A past
-- scheduled meeting/visit is not treated as completed when no result email is
-- present; the partner remains unknown-ball and its next action says to verify
-- the outcome. Repeatable and additive.

BEGIN;

-- Three contacted PoC candidates were visible in Gmail but absent from the
-- p21 partner source of truth. Add them as contacted candidates, not as agreed
-- providers. Fixed UUIDs keep the migration repeatable.
INSERT INTO public.project_management_partners (
  id, project_id, slug, name, role_label, primary_track, relationship_stage,
  agreement_state, agreed_scope, unagreed_scope, last_contact_date,
  next_commitment, due_date, owner_label, last_verified_at, confidence,
  source_kind, source_ref, sort_order, current_ball_side, current_ball_owner,
  next_ball_owner, target_state, due_date_precision
)
VALUES
  (
    'a112c92e-149d-4fd3-a91b-31fd50c4ce01', 'p21', 'poc-contact-marutomo', 'マルトモ',
    'PoC接触先（排液提供）', 'business_development', 'information_exchange',
    'unagreed', '伊予銀行紹介でPoC相談の初回メール送付を確認',
    '排液提供の可否・条件・量・時期は未合意', DATE '2026-07-27',
    'マルトモからPoC相談への返答を待つ', NULL, '石原先生', DATE '2026-07-29',
    'high', 'imported', 'gmail-thread:19fa1ac2cd448ecc', 140,
    'partner', 'マルトモ（担当者）', NULL, 'PoC条件の初回確認', 'unknown'
  ),
  (
    'b223da3f-250e-4ae4-b02c-42ae61d5df02', 'p21', 'poc-contact-okabe', 'オカベ',
    'PoC接触先（排液提供）', 'business_development', 'meeting_coordination',
    'unagreed', '伊予銀行紹介でPoC相談と訪問日程の調整を確認',
    '排液提供の可否・条件・量・時期は未合意', DATE '2026-07-14',
    '7月24日訪問の結果と次の約束を確認する', NULL, '石原先生', DATE '2026-07-29',
    'high', 'imported', 'gmail-thread:19f5ba70e461d775', 141,
    'unknown', NULL, NULL, '訪問結果とPoC条件の確認', 'unknown'
  ),
  (
    'c334eb40-361f-4bf5-c13d-53bf72e6e003', 'p21', 'poc-contact-yamaki', 'ヤマキ',
    'PoC接触先（排液提供）', 'business_development', 'meeting_coordination',
    'unagreed', '伊予銀行紹介でPoC相談と訪問日程の調整を確認',
    '排液提供の可否・条件・量・時期は未合意', DATE '2026-07-14',
    '7月24日訪問の結果と次の約束を確認する', NULL, '石原先生', DATE '2026-07-29',
    'high', 'imported', 'gmail-thread:19f463d156d0f0ed', 142,
    'unknown', NULL, NULL, '訪問結果とPoC条件の確認', 'unknown'
  )
ON CONFLICT (id) DO NOTHING;

-- Update only fields directly confirmed by the latest email evidence. Existing
-- agreement/stage claims from the PoC source material are deliberately kept.
UPDATE public.project_management_partners
SET last_contact_date = DATE '2026-07-29',
    next_commitment = '日本食研から代替日程の連絡を待つ',
    current_ball_side = 'partner',
    current_ball_owner = '日本食研（担当者）',
    last_verified_at = DATE '2026-07-29',
    source_kind = 'imported',
    source_ref = 'gmail-thread:19f4569cec6cf572'
WHERE project_id = 'p21' AND slug = 'poc-talk-11-x' AND deleted_at IS NULL;

UPDATE public.project_management_partners
SET last_contact_date = DATE '2026-07-29',
    next_commitment = 'ユナイテッドシルクから盆明け候補日の返答を待つ',
    current_ball_side = 'partner',
    current_ball_owner = 'ユナイテッドシルク（担当者）',
    last_verified_at = DATE '2026-07-29',
    source_kind = 'imported',
    source_ref = 'gmail-thread:19f461415ad9a6e8'
WHERE project_id = 'p21' AND slug = 'poc-talk-12-x' AND deleted_at IS NULL;

UPDATE public.project_management_partners
SET last_contact_date = DATE '2026-07-15',
    next_commitment = '7月17日オンライン面談の結果と次の約束を確認する',
    current_ball_side = 'unknown',
    current_ball_owner = NULL,
    last_verified_at = DATE '2026-07-29',
    source_kind = 'imported',
    source_ref = 'gmail-thread:19f65c9d754ff147'
WHERE project_id = 'p21' AND slug = 'poc-talk-07-x' AND deleted_at IS NULL;

-- The six PoC contact partners share one explicit operational classification:
-- potential discharge provider, relationship in progress. "other" avoids
-- incorrectly calling the provider a customer or joint-development partner.
WITH role_seed(id, partner_slug) AS (
  VALUES
    ('d441fc51-4720-4ca6-d24e-64c083f7f101'::uuid, 'poc-talk-11-x'),
    ('d441fc51-4720-4ca6-d24e-64c083f7f102'::uuid, 'poc-talk-12-x'),
    ('d441fc51-4720-4ca6-d24e-64c083f7f103'::uuid, 'poc-talk-07-x'),
    ('d441fc51-4720-4ca6-d24e-64c083f7f104'::uuid, 'poc-contact-marutomo'),
    ('d441fc51-4720-4ca6-d24e-64c083f7f105'::uuid, 'poc-contact-okabe'),
    ('d441fc51-4720-4ca6-d24e-64c083f7f106'::uuid, 'poc-contact-yamaki')
)
INSERT INTO public.project_management_partner_roles (
  id, project_id, partner_id, role_kind, relationship_state, role_label,
  is_primary, sort_order, source_kind, source_ref
)
SELECT seed.id, p.project_id, p.id, 'other', 'in_progress',
       'PoC候補先（排液提供）', true, 0, 'imported',
       'gmail-review:2026-07-29'
FROM role_seed seed
JOIN public.project_management_partners p
  ON p.project_id = 'p21' AND p.slug = seed.partner_slug AND p.deleted_at IS NULL
WHERE NOT EXISTS (
  SELECT 1 FROM public.project_management_partner_roles r
  WHERE r.partner_id = p.id AND r.is_primary AND r.deleted_at IS NULL
);

-- One row is one operationally meaningful step in the exchange. The
-- summaries intentionally omit bodies, addresses, locations, URLs and health
-- details. source_ref retains only an internal Gmail thread pointer.
WITH interaction_seed(
  id, partner_slug, occurred_on, summary, outcome_summary, ball_side_after,
  ball_owner_after, actor_side, actor_label, source_ref, created_at
) AS (
  VALUES
    ('e5520d62-5831-4db7-e35f-75d19408a201'::uuid, 'poc-talk-11-x', DATE '2026-07-09',
     '日本食研から面談候補日の提示あり', '7月30日10時の面談を調整', 'sx', '石原先生',
     'partner', '日本食研', 'gmail-thread:19f4569cec6cf572', TIMESTAMPTZ '2026-07-09 05:46:04+00'),
    ('e5520d62-5831-4db7-e35f-75d19408a202'::uuid, 'poc-talk-11-x', DATE '2026-07-09',
     '日本食研との面談日時を双方で確認', '先方の参加者と訪問予定を確認', 'shared', NULL,
     'shared', '双方', 'gmail-thread:19f4569cec6cf572', TIMESTAMPTZ '2026-07-09 10:25:34+00'),
    ('e5520d62-5831-4db7-e35f-75d19408a203'::uuid, 'poc-talk-11-x', DATE '2026-07-29',
     '日本食研が7月30日の面談延期を了承', '先方が代替日程を確認して再連絡する', 'partner', '日本食研（担当者）',
     'partner', '日本食研', 'gmail-thread:19f4569cec6cf572', TIMESTAMPTZ '2026-07-29 08:55:07+00'),

    ('e5520d62-5831-4db7-e35f-75d19408a204'::uuid, 'poc-talk-12-x', DATE '2026-07-16',
     '石原先生からユナイテッドシルクへPoC相談を送信', '訪問による意見交換を打診', 'partner', 'ユナイテッドシルク（担当者）',
     'sx', '石原先生', 'gmail-thread:19f461415ad9a6e8', TIMESTAMPTZ '2026-07-16 05:54:45+00'),
    ('e5520d62-5831-4db7-e35f-75d19408a205'::uuid, 'poc-talk-12-x', DATE '2026-07-17',
     'ユナイテッドシルクがPoC相談への関心を表明', '7月30日14時の訪問を双方で確認', 'shared', NULL,
     'partner', 'ユナイテッドシルク', 'gmail-thread:19f461415ad9a6e8', TIMESTAMPTZ '2026-07-17 03:43:01+00'),
    ('e5520d62-5831-4db7-e35f-75d19408a206'::uuid, 'poc-talk-12-x', DATE '2026-07-29',
     'ユナイテッドシルクが7月30日の訪問延期を了承', '盆明けの候補日を先方が確認する', 'partner', 'ユナイテッドシルク（担当者）',
     'partner', 'ユナイテッドシルク', 'gmail-thread:19f461415ad9a6e8', TIMESTAMPTZ '2026-07-29 08:43:50+00'),

    ('e5520d62-5831-4db7-e35f-75d19408a207'::uuid, 'poc-contact-marutomo', DATE '2026-07-27',
     '石原先生からマルトモへPoC相談を送信', '排水処理の現状とPoC可能性について初回相談', 'partner', 'マルトモ（担当者）',
     'sx', '石原先生', 'gmail-thread:19fa1ac2cd448ecc', TIMESTAMPTZ '2026-07-27 03:43:57+00'),
    ('e5520d62-5831-4db7-e35f-75d19408a208'::uuid, 'poc-talk-07-x', DATE '2026-07-15',
     '石原先生からハタダへオンライン面談案内を送信', '7月17日9時30分の面談予定。結果と次の約束は未確認', 'shared', NULL,
     'sx', '石原先生', 'gmail-thread:19f65c9d754ff147', TIMESTAMPTZ '2026-07-15 12:39:01+00'),
    ('e5520d62-5831-4db7-e35f-75d19408a209'::uuid, 'poc-contact-okabe', DATE '2026-07-14',
     'オカベとの訪問日時を双方で確認', '7月24日9時30分の訪問予定。結果と次の約束は未確認', 'shared', NULL,
     'shared', '双方', 'gmail-thread:19f5ba70e461d775', TIMESTAMPTZ '2026-07-14 07:24:58+00'),
    ('e5520d62-5831-4db7-e35f-75d19408a210'::uuid, 'poc-contact-yamaki', DATE '2026-07-10',
     'ヤマキが社内で前向きに検討すると返信', '担当組織へ引き継ぎ、訪問日程の調整へ進んだ', 'sx', '石原先生',
     'partner', 'ヤマキ', 'gmail-thread:19f463d156d0f0ed', TIMESTAMPTZ '2026-07-10 02:40:40+00'),
    ('e5520d62-5831-4db7-e35f-75d19408a211'::uuid, 'poc-contact-yamaki', DATE '2026-07-14',
     'ヤマキとの訪問日時を双方で確認', '7月24日11時の訪問予定。結果と次の約束は未確認', 'shared', NULL,
     'shared', '双方', 'gmail-thread:19f463d156d0f0ed', TIMESTAMPTZ '2026-07-14 06:11:44+00')
)
INSERT INTO public.project_management_partner_interactions (
  id, project_id, partner_id, interaction_kind, occurred_on,
  occurred_on_precision, summary, outcome_summary, ball_side_after,
  ball_owner_after, actor_side, actor_label, confidence, source_kind,
  source_ref, created_at
)
SELECT seed.id, p.project_id, p.id, 'email', seed.occurred_on, 'day',
       seed.summary, seed.outcome_summary, seed.ball_side_after,
       seed.ball_owner_after, seed.actor_side, seed.actor_label,
       'high', 'imported', seed.source_ref, seed.created_at
FROM interaction_seed seed
JOIN public.project_management_partners p
  ON p.project_id = 'p21' AND p.slug = seed.partner_slug AND p.deleted_at IS NULL
ON CONFLICT (id) DO NOTHING;

DO $$
DECLARE
  email_count integer;
  contacted_count integer;
BEGIN
  SELECT count(*) INTO email_count
  FROM public.project_management_partner_interactions
  WHERE project_id = 'p21' AND interaction_kind = 'email'
    AND source_ref LIKE 'gmail-thread:%' AND deleted_at IS NULL;
  IF email_count < 11 THEN
    RAISE EXCEPTION 'p21 Gmail interaction seed incomplete: expected >= 11, got %', email_count;
  END IF;

  SELECT count(*) INTO contacted_count
  FROM public.project_management_partners
  WHERE project_id = 'p21' AND deleted_at IS NULL
    AND slug IN ('poc-contact-marutomo', 'poc-contact-okabe', 'poc-contact-yamaki');
  IF contacted_count <> 3 THEN
    RAISE EXCEPTION 'p21 Gmail partner seed incomplete: expected 3, got %', contacted_count;
  END IF;
END $$;

COMMIT;
