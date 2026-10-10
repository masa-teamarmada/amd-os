-- Fingerprints only: no deleted text is retained here.
CREATE TABLE IF NOT EXISTS private.amie_erased_field_hashes(table_name text,record_pk jsonb,field_name text,value_hash text,PRIMARY KEY(table_name,record_pk,field_name,value_hash));
REVOKE ALL ON private.amie_erased_field_hashes FROM PUBLIC,anon,authenticated;
CREATE FUNCTION private.amie_prevent_erased_field_restore() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM private.amie_erased_field_hashes e WHERE e.table_name=TG_TABLE_NAME AND to_jsonb(NEW) @> e.record_pk AND md5(to_jsonb(NEW)->>e.field_name)=e.value_hash) THEN
  RAISE EXCEPTION '削除済み本文の再登録はできない';
 END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION private.amie_prevent_erased_field_restore() FROM PUBLIC;
CREATE TRIGGER zz_amie_prevent_erased_field_restore BEFORE INSERT OR UPDATE ON public.project_meeting_summaries FOR EACH ROW EXECUTE FUNCTION private.amie_prevent_erased_field_restore();
CREATE TRIGGER zz_amie_prevent_erased_field_restore BEFORE INSERT OR UPDATE ON public.source_cache FOR EACH ROW EXECUTE FUNCTION private.amie_prevent_erased_field_restore();
CREATE TRIGGER zz_amie_prevent_erased_field_restore BEFORE INSERT OR UPDATE ON public.monthly_reports FOR EACH ROW EXECUTE FUNCTION private.amie_prevent_erased_field_restore();
CREATE TRIGGER zz_amie_prevent_erased_field_restore BEFORE INSERT OR UPDATE ON public.amd_management_score_raw_signals FOR EACH ROW EXECUTE FUNCTION private.amie_prevent_erased_field_restore();
