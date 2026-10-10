-- User-directed erasure. Retain only identities, never erased wording.
CREATE TABLE private.amie_erased_records(table_name text NOT NULL,record_pk jsonb NOT NULL,PRIMARY KEY(table_name,record_pk));
REVOKE ALL ON private.amie_erased_records FROM PUBLIC,anon,authenticated;
CREATE FUNCTION private.amie_prevent_erased_record_restore() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM private.amie_erased_records e WHERE e.table_name=TG_TABLE_NAME AND to_jsonb(NEW) @> e.record_pk) THEN
   RAISE EXCEPTION '削除済み情報の再登録はできない';
 END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION private.amie_prevent_erased_record_restore() FROM PUBLIC;
INSERT INTO private.amie_erased_records(table_name,record_pk) VALUES ('project_strategy_signals','{"signal_id": "796e9f4c-f271-4626-b424-d7c32195649d"}'::jsonb),('project_org_observations','{"id": "6088b204-1533-436c-a761-e0c023fb417b"}'::jsonb),('project_knowledge','{"id": "71f110f9-c658-4265-9b0b-43aca2f1094c"}'::jsonb);
CREATE TRIGGER amie_prevent_erased_record_restore BEFORE INSERT OR UPDATE ON public.project_knowledge FOR EACH ROW EXECUTE FUNCTION private.amie_prevent_erased_record_restore();
CREATE TRIGGER amie_prevent_erased_record_restore BEFORE INSERT OR UPDATE ON public.project_org_observations FOR EACH ROW EXECUTE FUNCTION private.amie_prevent_erased_record_restore();
CREATE TRIGGER amie_prevent_erased_record_restore BEFORE INSERT OR UPDATE ON public.project_strategy_signals FOR EACH ROW EXECUTE FUNCTION private.amie_prevent_erased_record_restore();
