-- 294: source更新とcandidate applyを同じseed lockで直列化し、stale apply競合を防ぐ。
BEGIN;

CREATE OR REPLACE FUNCTION public.lock_sps_reassessment_source_seed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.seed_id IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(NEW.seed_id::text, 292));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sps_reassessment_source_seed_lock
  ON public.sps_reassessment_source_events;
CREATE TRIGGER sps_reassessment_source_seed_lock
  BEFORE INSERT ON public.sps_reassessment_source_events
  FOR EACH ROW EXECUTE FUNCTION public.lock_sps_reassessment_source_seed();

-- 292の本体を内部関数へ移し、外側で seed advisory lock を先に取る。
-- 内部本体が同じadvisory lockを再取得してもtransaction lockなので安全。
ALTER FUNCTION public.apply_sps_reassessment_candidate(uuid, text)
  RENAME TO apply_sps_reassessment_candidate_locked_body;

CREATE FUNCTION public.apply_sps_reassessment_candidate(
  p_candidate_id uuid,
  p_actor text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_seed_id uuid;
BEGIN
  SELECT candidate.seed_id INTO v_seed_id
  FROM public.sps_reassessment_candidates AS candidate
  WHERE candidate.id = p_candidate_id;

  IF v_seed_id IS NULL THEN
    RAISE EXCEPTION 'SPS reassessment candidate not found';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_seed_id::text, 292));

  RETURN public.apply_sps_reassessment_candidate_locked_body(p_candidate_id, p_actor);
END;
$$;

REVOKE ALL ON FUNCTION public.apply_sps_reassessment_candidate_locked_body(uuid, text)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.apply_sps_reassessment_candidate(uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_sps_reassessment_candidate(uuid, text)
  TO service_role;

COMMENT ON FUNCTION public.lock_sps_reassessment_source_seed() IS
  'source event INSERT前にseed単位lockを取り、candidate applyとの順序を直列化する。';
COMMENT ON FUNCTION public.apply_sps_reassessment_candidate(uuid, text) IS
  'seed lockをcandidate row lockより先に取得し、freshness CAS後だけappend-only publishする公開RPC。';
COMMENT ON FUNCTION public.apply_sps_reassessment_candidate_locked_body(uuid, text) IS
  'apply RPCの内部本体。外部実行権限なし。公開wrapperがseed lock取得後にだけ呼ぶ。';

COMMIT;
