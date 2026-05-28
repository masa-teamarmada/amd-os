-- 106_members_contractor_name.sql
-- 支払通知書 / 契約書に出す契約者名。
-- 個人契約は member_name を既定値にし、法人契約のメンバーだけ admin/members で上書きする。

BEGIN;

ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS contractor_name TEXT;

COMMENT ON COLUMN public.members.contractor_name IS
  '支払通知書 / 契約書に出す契約者名。個人契約は members.member_name を既定値にし、法人契約時だけ法人名へ手入力する。';

CREATE OR REPLACE FUNCTION public.members_fill_contractor_name()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.contractor_name IS NULL OR btrim(NEW.contractor_name) = '' THEN
    NEW.contractor_name := COALESCE(
      NULLIF(btrim(NEW.member_name), ''),
      NULLIF(btrim(NEW.code_name), ''),
      NEW.member_id
    );
  ELSE
    NEW.contractor_name := btrim(NEW.contractor_name);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS members_fill_contractor_name_biu ON public.members;

CREATE TRIGGER members_fill_contractor_name_biu
BEFORE INSERT OR UPDATE OF member_name, code_name, contractor_name ON public.members
FOR EACH ROW
EXECUTE FUNCTION public.members_fill_contractor_name();

UPDATE public.members
SET contractor_name = COALESCE(
      NULLIF(btrim(contractor_name), ''),
      NULLIF(btrim(member_name), ''),
      NULLIF(btrim(code_name), ''),
      member_id
    ),
    updated_at = NOW()
WHERE contractor_name IS NULL OR btrim(contractor_name) = '';

CREATE INDEX IF NOT EXISTS idx_members_contractor_name
  ON public.members(contractor_name);

COMMIT;
