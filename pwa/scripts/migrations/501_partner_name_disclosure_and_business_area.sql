BEGIN;

ALTER TABLE public.project_management_partners
  ADD COLUMN business_area text,
  ADD COLUMN name_disclosure_prohibited boolean NOT NULL DEFAULT false;

ALTER TABLE public.project_management_partners
  ADD CONSTRAINT project_partner_business_area_length CHECK (business_area IS NULL OR char_length(business_area) <= 120),
  ADD CONSTRAINT project_partner_withheld_name_needs_business_area CHECK
    (NOT name_disclosure_prohibited OR nullif(btrim(business_area), '') IS NOT NULL);

COMMENT ON COLUMN public.project_management_partners.business_area IS '確認済みの事業領域。関係先の役割・分類とは別。';
COMMENT ON COLUMN public.project_management_partners.name_disclosure_prohibited IS 'trueの場合、DD・社外共有へ返す会社名を非開示にする。社内正本の実名は保持。';

-- 2026-10-02訪問の採用済み台帳で、食品工場Aとして扱う旨が確認済み。
-- 既存の実名・接点・試料・根拠・合意状態は保持する。
UPDATE public.project_management_partners
SET business_area = '食品製造', name_disclosure_prohibited = true
WHERE project_id = 'p21' AND name = 'ハタダ' AND deleted_at IS NULL;

COMMIT;
