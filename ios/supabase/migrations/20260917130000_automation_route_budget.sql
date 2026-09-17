-- H-1などのローカル自動化がPWAへ集中アクセスしても、日次・1runの上限を
-- DB transactionで越えられないようにする。人が画面から使う経路は対象外。
CREATE TABLE IF NOT EXISTS public.automation_route_budget_usage (
  scope_kind text NOT NULL CHECK (scope_kind IN ('day', 'run')),
  scope_key text NOT NULL,
  route_key text NOT NULL,
  request_count integer NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  body_bytes bigint NOT NULL DEFAULT 0 CHECK (body_bytes >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (scope_kind, scope_key, route_key)
);

ALTER TABLE public.automation_route_budget_usage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.automation_route_budget_usage FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.claim_automation_route_budget(
  p_route_key text,
  p_run_key text,
  p_body_bytes bigint,
  p_daily_request_limit integer,
  p_daily_body_limit bigint,
  p_run_request_limit integer,
  p_run_body_limit bigint
) RETURNS TABLE (
  allowed boolean,
  reason text,
  daily_requests integer,
  daily_body_bytes bigint,
  run_requests integer,
  run_body_bytes bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_day_key text := ((clock_timestamp() AT TIME ZONE 'Asia/Tokyo')::date)::text;
  v_daily_requests integer := 0;
  v_daily_bytes bigint := 0;
  v_run_requests integer := 0;
  v_run_bytes bigint := 0;
BEGIN
  IF p_route_key IS NULL OR p_route_key !~ '^[a-z0-9][a-z0-9._/-]{1,119}$' THEN
    RAISE EXCEPTION 'invalid route key';
  END IF;
  IF p_run_key IS NULL OR p_run_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,159}$' THEN
    RAISE EXCEPTION 'invalid run key';
  END IF;
  IF p_body_bytes < 0 OR p_daily_request_limit < 1 OR p_daily_body_limit < 1
    OR p_run_request_limit < 1 OR p_run_body_limit < 1 THEN
    RAISE EXCEPTION 'invalid automation budget';
  END IF;

  -- 低頻度の自動化だけが使う。1本のlockで日次とrunの判定を同一transactionにする。
  PERFORM pg_advisory_xact_lock(hashtextextended('automation-route-budget', 0));

  SELECT request_count, body_bytes INTO v_daily_requests, v_daily_bytes
  FROM public.automation_route_budget_usage
  WHERE scope_kind = 'day' AND scope_key = v_day_key AND route_key = p_route_key;
  v_daily_requests := COALESCE(v_daily_requests, 0);
  v_daily_bytes := COALESCE(v_daily_bytes, 0);

  SELECT request_count, body_bytes INTO v_run_requests, v_run_bytes
  FROM public.automation_route_budget_usage
  WHERE scope_kind = 'run' AND scope_key = p_run_key AND route_key = '*';
  v_run_requests := COALESCE(v_run_requests, 0);
  v_run_bytes := COALESCE(v_run_bytes, 0);

  IF v_daily_requests + 1 > p_daily_request_limit OR v_daily_bytes + p_body_bytes > p_daily_body_limit THEN
    RETURN QUERY SELECT false, 'daily_budget_exceeded', v_daily_requests, v_daily_bytes, v_run_requests, v_run_bytes;
    RETURN;
  END IF;
  IF v_run_requests + 1 > p_run_request_limit OR v_run_bytes + p_body_bytes > p_run_body_limit THEN
    RETURN QUERY SELECT false, 'run_budget_exceeded', v_daily_requests, v_daily_bytes, v_run_requests, v_run_bytes;
    RETURN;
  END IF;

  INSERT INTO public.automation_route_budget_usage(scope_kind, scope_key, route_key, request_count, body_bytes)
  VALUES ('day', v_day_key, p_route_key, 1, p_body_bytes)
  ON CONFLICT (scope_kind, scope_key, route_key) DO UPDATE
  SET request_count = public.automation_route_budget_usage.request_count + 1,
      body_bytes = public.automation_route_budget_usage.body_bytes + EXCLUDED.body_bytes,
      updated_at = now()
  RETURNING request_count, body_bytes INTO v_daily_requests, v_daily_bytes;

  INSERT INTO public.automation_route_budget_usage(scope_kind, scope_key, route_key, request_count, body_bytes)
  VALUES ('run', p_run_key, '*', 1, p_body_bytes)
  ON CONFLICT (scope_kind, scope_key, route_key) DO UPDATE
  SET request_count = public.automation_route_budget_usage.request_count + 1,
      body_bytes = public.automation_route_budget_usage.body_bytes + EXCLUDED.body_bytes,
      updated_at = now()
  RETURNING request_count, body_bytes INTO v_run_requests, v_run_bytes;

  RETURN QUERY SELECT true, 'claimed', v_daily_requests, v_daily_bytes, v_run_requests, v_run_bytes;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_automation_route_budget(text, text, bigint, integer, bigint, integer, bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_automation_route_budget(text, text, bigint, integer, bigint, integer, bigint) TO service_role;

COMMENT ON TABLE public.automation_route_budget_usage IS
  'PWAを呼ぶローカル自動化の日次route別・run全体の原子的な利用量。本文は保存しない。';
