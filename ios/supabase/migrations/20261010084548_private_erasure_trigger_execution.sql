-- Private invariant triggers need lookup rights; callers receive no table privileges.
-- Functions are trigger-only in a non-exposed schema, with empty search_path and
-- fully qualified names. They neither return private rows nor bypass table RLS.
ALTER FUNCTION private.amie_prevent_erased_record_restore() SECURITY DEFINER;
ALTER FUNCTION private.amie_prevent_erased_field_restore() SECURITY DEFINER;
ALTER FUNCTION private.amie_guard_slack_archive() SECURITY DEFINER;
REVOKE ALL ON FUNCTION private.amie_prevent_erased_record_restore(),private.amie_prevent_erased_field_restore(),private.amie_guard_slack_archive() FROM PUBLIC,anon,authenticated;
