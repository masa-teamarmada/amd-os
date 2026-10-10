-- Trigger execution is private and requires an authenticated caller, a service
-- request, or SQL maintenance role. These functions enforce invariants only.
CREATE OR REPLACE FUNCTION private.amie_prevent_erased_record_restore() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL AND COALESCE(auth.role(),'') <> 'service_role'
    AND COALESCE(current_setting('role',true),'none') IN ('anon','authenticated') THEN
   RAISE EXCEPTION '認証が必要';
 END IF;
 IF EXISTS(SELECT 1 FROM private.amie_erased_records e WHERE e.table_name=TG_TABLE_NAME AND to_jsonb(NEW) @> e.record_pk) THEN
   RAISE EXCEPTION '削除済み情報の再登録はできない';
 END IF;
 RETURN NEW;
END; $$;
CREATE OR REPLACE FUNCTION private.amie_prevent_erased_field_restore() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL AND COALESCE(auth.role(),'') <> 'service_role'
    AND COALESCE(current_setting('role',true),'none') IN ('anon','authenticated') THEN
   RAISE EXCEPTION '認証が必要';
 END IF;
 IF EXISTS(SELECT 1 FROM private.amie_erased_field_hashes e WHERE e.table_name=TG_TABLE_NAME AND to_jsonb(NEW) @> e.record_pk AND md5(to_jsonb(NEW)->>e.field_name)=e.value_hash) THEN
  RAISE EXCEPTION '削除済み本文の再登録はできない';
 END IF;
 RETURN NEW;
END; $$;
CREATE OR REPLACE FUNCTION private.amie_guard_slack_archive() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL AND COALESCE(auth.role(),'') <> 'service_role'
    AND COALESCE(current_setting('role',true),'none') IN ('anon','authenticated') THEN
   RAISE EXCEPTION '認証が必要';
 END IF;
  IF NEW.source='slack' AND NOT EXISTS (
    SELECT 1 FROM public.project_slack_sources s
    WHERE s.project_id=NEW.project_id AND s.archive_enabled
      AND s.workspace_key NOT IN ('armada','teamarmadahq')
      AND s.channel_id=COALESCE(NEW.metadata_json->>'channel_id',split_part(NEW.item_id,':',1))
      AND substring(COALESCE(NEW.metadata_json->>'permalink',NEW.metadata_json->>'source_url','') from '^https://([^/]+)/')=s.workspace_key||'.slack.com'
  ) THEN
    -- Reject persistence even from stale collectors and service-role writers.
    RETURN NULL;
  END IF;
  RETURN NEW;
END; $$;
