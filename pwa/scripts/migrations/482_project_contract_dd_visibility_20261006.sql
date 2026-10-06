-- 2026-10-06 まさ指定: 各PJの契約リストと契約ごとのDD表示選択。
BEGIN;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS dd_visible boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.contracts.dd_visible IS '当該PJの契約リストでDDに表示する選択。初期値false。契約当事者と関連PJは独立。';
-- ユーザー指示と2026-10-02送信メールに基づくNDA。契約条項・締結日・期間は未確定。
INSERT INTO public.contracts (
 contract_id, project_id, contract_title, canonical_title, counterparty_name, contract_type,
 status, registry_status, relationship_scope, amd_entity_name, amd_party_role,
 party_confirmation_note, party_confirmed_at, party_confirmed_by,
 review_required, review_status, source_summary, source_refs_json, dd_visible,
 created_by, updated_by
)
SELECT 'b5e39c23-6039-428d-bddf-5f90bb6f862a'::uuid, 'p21',
 'いよぎんキャピタルとの秘密保持契約（SOL）', 'いよぎんキャピタルとの秘密保持契約（SOL）',
 'いよぎんキャピタル株式会社', 'nda', 'under_review', 'accepted', 'amd_contract',
 '株式会社チームアルマダ', '契約当事者',
 '2026-10-06 まさ指示。契約当事者はチームアルマダ、SOLのDDに関する関連契約として登録。', now(), 'masa',
 true, 'pending',
 '2026-10-02にチームアルマダを当事者とする変更履歴付き修正案を送付。締結予定。締結日・契約期間・最終条項は未確認。',
 '[{"kind":"user_instruction","date":"2026-10-06","note":"SOL関連NDAとして契約リストへ登録"},{"kind":"gmail","message_id":"1a0fd1d93f136b85","date":"2026-10-02","title":"Re: PSI-GAP fundの申請書","attachment_name":"いよぎんキャピタル_NDA_チームアルマダ修正案_変更履歴付き_20261002.docx"}]'::jsonb,
 true, 'masa', 'masa'
WHERE NOT EXISTS (
 SELECT 1 FROM public.contracts WHERE project_id='p21' AND registry_status='accepted'
 AND contract_type='nda' AND counterparty_name='いよぎんキャピタル株式会社'
);
COMMIT;
