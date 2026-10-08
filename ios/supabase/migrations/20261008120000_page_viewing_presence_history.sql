-- Page presence and durable visits. Only the authorized PWA server may read/write.
BEGIN;
CREATE TABLE public.os_page_viewer_sessions (
  session_id uuid PRIMARY KEY,
  actor_key text NOT NULL,
  resource_key text NOT NULL,
  actor_label text NOT NULL,
  visit_id uuid NOT NULL,
  revision bigint NOT NULL CHECK (revision >= 0),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  active boolean NOT NULL DEFAULT true
);
CREATE INDEX os_page_viewer_sessions_resource_idx ON public.os_page_viewer_sessions(resource_key, last_seen_at DESC) WHERE active;
CREATE TABLE public.os_page_viewing_visits (
  visit_id uuid PRIMARY KEY,
  actor_key text NOT NULL,
  actor_label text NOT NULL,
  resource_key text NOT NULL,
  page_title text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX os_page_viewing_visits_resource_idx ON public.os_page_viewing_visits(resource_key, started_at DESC);
ALTER TABLE public.os_page_viewer_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.os_page_viewing_visits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.os_page_viewer_sessions, public.os_page_viewing_visits FROM anon, authenticated;
GRANT ALL ON public.os_page_viewer_sessions, public.os_page_viewing_visits TO service_role;
COMMENT ON TABLE public.os_page_viewing_visits IS 'Authorized foreground page openings since 2026-10-08. No raw URLs, query strings, emails, content or inferred reading duration. External users can read only their own visits through the PWA server.';

CREATE FUNCTION public.amie_update_page_viewer(
  p_session_id uuid, p_visit_id uuid, p_revision bigint, p_actor_key text,
  p_actor_label text, p_resource_key text, p_page_title text, p_active boolean
) RETURNS boolean LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_session uuid;
BEGIN
  INSERT INTO os_page_viewer_sessions(session_id, actor_key, actor_label, resource_key, visit_id, revision, active)
  VALUES(p_session_id, p_actor_key, p_actor_label, p_resource_key, p_visit_id, p_revision, p_active)
  ON CONFLICT(session_id) DO UPDATE SET
    actor_label=EXCLUDED.actor_label, resource_key=EXCLUDED.resource_key, visit_id=EXCLUDED.visit_id,
    revision=EXCLUDED.revision, active=EXCLUDED.active, last_seen_at=now()
  WHERE os_page_viewer_sessions.actor_key=EXCLUDED.actor_key AND os_page_viewer_sessions.revision < EXCLUDED.revision
  RETURNING session_id INTO v_session;
  IF v_session IS NULL THEN RETURN false; END IF;
  IF p_active THEN
    INSERT INTO os_page_viewing_visits(visit_id, actor_key, actor_label, resource_key, page_title)
    VALUES(p_visit_id, p_actor_key, p_actor_label, p_resource_key, p_page_title)
    ON CONFLICT(visit_id) DO UPDATE SET last_seen_at=now()
      WHERE os_page_viewing_visits.actor_key=EXCLUDED.actor_key AND os_page_viewing_visits.resource_key=EXCLUDED.resource_key;
  END IF;
  -- Presence is temporary; visits remain durable. No scheduled job is required.
  DELETE FROM os_page_viewer_sessions WHERE last_seen_at < now() - interval '1 day';
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.amie_update_page_viewer(uuid,uuid,bigint,text,text,text,text,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.amie_update_page_viewer(uuid,uuid,bigint,text,text,text,text,boolean) TO service_role;
COMMIT;
