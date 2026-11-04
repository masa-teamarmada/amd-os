CREATE INDEX IF NOT EXISTS os_page_viewing_visits_actor_resource_idx
  ON public.os_page_viewing_visits(actor_key, resource_key);

CREATE FUNCTION public.amie_admin_page_visit_counts(p_actor_key text, p_paths text[])
RETURNS TABLE(pathname text, visit_count bigint, last_visited_at timestamptz)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT v.resource_key::jsonb ->> 0 AS pathname, count(*) AS visit_count,
         max(v.started_at) AS last_visited_at
  FROM public.os_page_viewing_visits v
  WHERE v.actor_key = p_actor_key
    AND EXISTS (
      SELECT 1 FROM unnest(p_paths) AS allowed(path)
      WHERE v.resource_key::jsonb ->> 0 = allowed.path
         OR starts_with(v.resource_key::jsonb ->> 0, allowed.path || '/')
    )
  GROUP BY v.resource_key::jsonb ->> 0;
$$;
REVOKE ALL ON FUNCTION public.amie_admin_page_visit_counts(text, text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.amie_admin_page_visit_counts(text, text[]) TO service_role;
COMMENT ON FUNCTION public.amie_admin_page_visit_counts(text, text[]) IS
  'Admin navigation frequency from existing visits. Server derives the current member actor and supplies the navigation allowlist; no heartbeat counting or new tracking.';
