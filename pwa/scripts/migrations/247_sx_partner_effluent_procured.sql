-- 247: 関係先リストの「排液調達」を、行詳細ではなくチェック操作で明示保存する。
--
-- NULL は移行前データを表す。PWA は NULL のときだけ従来どおり試料台帳の
-- received/analyzed/received_on から表示状態を導出し、最初の操作後は true/false を正本にする。

ALTER TABLE public.project_management_partners
  ADD COLUMN IF NOT EXISTS effluent_procured boolean;

COMMENT ON COLUMN public.project_management_partners.effluent_procured IS
  'Explicit effluent-procurement checkbox. NULL preserves the legacy fallback derived from live partner samples; user interaction writes true or false.';

-- 列名は既存クライアントとの互換のため据え置き、意味だけをPoC顧客限定から汎用化する。
COMMENT ON COLUMN public.project_management_partners.poc_grade IS
  'Generic project priority recorded by a person: s=highest priority, a=promising, b=keep reviewing, x=out of scope for now. Historical column name retained for compatibility; not limited to PoC customers.';
