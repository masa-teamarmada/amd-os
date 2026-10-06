-- 2026-10-06 まさ: SOL主体の契約が対象。指定したいよぎん<>AMD NDAのみ関連契約として含める。
BEGIN;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS project_contract_scope text NOT NULL DEFAULT 'unclassified';
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS project_party_name text;
ALTER TABLE public.contracts ADD CONSTRAINT contracts_project_contract_scope_check
 CHECK (project_contract_scope IN ('project_party','project_related','studio_service','unclassified'));
ALTER TABLE public.contracts ADD CONSTRAINT contracts_project_party_name_check
 CHECK (project_contract_scope <> 'project_party' OR nullif(btrim(project_party_name),'') IS NOT NULL);
COMMENT ON COLUMN public.contracts.project_contract_scope IS 'PJ契約リストの掲載区分。project_party=PJ主体、project_related=明示採用した関連契約、studio_service=スタジオ業務契約、unclassified=未分類。関連PJだけでは掲載しない。';
COMMENT ON COLUMN public.contracts.project_party_name IS 'project_partyの契約主体名。AMD側の当事者名と分け、確認済みの主体だけを保存する。';
UPDATE public.contracts SET project_contract_scope='project_related',updated_by='masa',updated_at=now()
 WHERE contract_id='b5e39c23-6039-428d-bddf-5f90bb6f862a' AND project_id='p21';
-- 今回確認した4件だけをSOLのリスト対象外へ。元台帳、採用状態、契約状態は保持。
UPDATE public.contracts SET project_contract_scope='studio_service',dd_visible=false,updated_by='masa',updated_at=now()
 WHERE project_id='p21' AND contract_id IN (
 '0553ea9e-dace-5e81-9b2d-111335cbbdda','9ecc1cff-a3d8-51c9-bf14-2158e47b27b6',
 'a887fa6f-055c-441b-8f5e-40625c19195e','d596fb15-1918-5aae-876b-851b23e96cdc');
COMMIT;
