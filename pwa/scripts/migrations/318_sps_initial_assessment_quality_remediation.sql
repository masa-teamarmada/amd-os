-- 318: 初回SPS評価の「意味づけ空」行を、同じ版タプルのまま追記で是正できるようにする。
--
-- 背景:
--   301 の validate_sps_initial_assessment_candidate_insert() は q_evidence の各因子について
--   evidence を 1〜500 文字で必須にする一方、assessment は上限 240 文字しか見ておらず空を許した。
--   その結果 2026-08-21 13時〜2026-08-22 05時 のバッチが 11 因子すべて assessment 空の帯を
--   372 件投入し、q の数値とその根拠が接続しない行が台帳に残った。
--   seed_screening_bands は 312 の guard_frozen_seed_screening_band() が frozen 行の UPDATE /
--   DELETE を拒む追記型台帳のため、その場の書き換えはできない。一方 301 は「同じ版タプルの帯が
--   既にある seed」の初回候補を拒み、292 の再評価フローは source event を必須にするので、
--   「元データは同じだが評価が雑だった」是正はどの入口からも通らなかった。
--
-- この migration がすること:
--   1. 再発防止 — 新規候補の q_evidence は assessment が 11 因子とも空なのを禁止する。
--      因子単位の必須化はしない (その因子が q を動かさない場合の null は正当な運用)。
--   2. 是正経路 — sps_initial_assessment_candidates.supersedes_assessment_id を足す。
--      非 NULL のときだけ「既に帯がある」拒否を外し、代わりに
--        - 対象帯が同じ seed / 同じ版タプル / frozen = true であること
--        - 対象帯がその seed の最新帯 (assessed_at DESC, id DESC の先頭) であること
--        - 対象帯の q_evidence が 11 因子すべて assessment 空 = 是正対象であること
--        - 是正候補の側は 11 因子すべてに assessment があること
--      を検証する。表示側 (src/lib/seed-screening-bands.ts) は最新帯を採るため、追記だけで
--      是正が反映される。古い帯は履歴として凍結されたまま残る。
--
-- 版タプルは一切変えない ('sps-ind-tier0-v1' / 'sps-ind-v1' / 'q-eval-v2' / 'rubric-v1.1' /
-- 'p-ind-v1' / 'rubric-v1.1+ind-v1')。q/P のモデルも rubric も変えていないため。

BEGIN;

ALTER TABLE public.sps_initial_assessment_candidates
  ADD COLUMN IF NOT EXISTS supersedes_assessment_id uuid REFERENCES public.seed_screening_bands(id);

COMMENT ON COLUMN public.sps_initial_assessment_candidates.supersedes_assessment_id IS
  '品質是正のとき、置き換え対象の seed_screening_bands.id。NULL なら通常の初回評価。';

-- 同じ帯を二重に是正しない (pending / applied のあいだだけ効かせる)。
CREATE UNIQUE INDEX IF NOT EXISTS sps_initial_candidate_supersedes_idx
  ON public.sps_initial_assessment_candidates(supersedes_assessment_id)
  WHERE supersedes_assessment_id IS NOT NULL AND status IN ('pending', 'applied');

CREATE OR REPLACE FUNCTION public.validate_sps_initial_assessment_candidate_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp AS $$
DECLARE v_model public.sps_model_versions%ROWTYPE; v_ids text[]; v_count integer; v_base public.seed_screening_bands%ROWTYPE; v_latest_id uuid; v_filled integer;
BEGIN
  SELECT * INTO STRICT v_model FROM public.sps_model_versions WHERE is_current = true;
  IF (v_model.model_version, v_model.measure_version, v_model.q_model_version, v_model.q_ruleset_version, v_model.p_model_version, v_model.assessment_ruleset_version)
     IS DISTINCT FROM ('sps-ind-tier0-v1','sps-ind-v1','q-eval-v2','rubric-v1.1','p-ind-v1','rubric-v1.1+ind-v1') THEN RAISE EXCEPTION 'current SPS tuple is unsupported'; END IF;
  IF (NEW.model_version, NEW.measure_version, NEW.q_model_version, NEW.q_ruleset_version, NEW.p_model_version, NEW.assessment_ruleset_version)
     IS DISTINCT FROM (v_model.model_version, v_model.measure_version, v_model.q_model_version, v_model.q_ruleset_version, v_model.p_model_version, v_model.assessment_ruleset_version) THEN RAISE EXCEPTION 'initial candidate tuple is not current'; END IF;

  IF NEW.supersedes_assessment_id IS NULL THEN
    -- 通常の初回評価: 同じ版タプルの帯が既にあれば拒否 (301 と同じ防波堤)。
    IF EXISTS (SELECT 1 FROM public.seed_screening_bands b WHERE b.seed_id = NEW.seed_id AND b.frozen = true AND b.model_version = v_model.model_version AND b.measure_version = v_model.measure_version AND b.q_model_version = v_model.q_model_version AND b.q_ruleset_version = v_model.q_ruleset_version AND b.p_model_version = v_model.p_model_version AND b.ruleset_version = v_model.assessment_ruleset_version) THEN RAISE EXCEPTION 'seed already has a complete current SPS tuple; use reassessment flow'; END IF;
  ELSE
    -- 品質是正: 置き換え対象が「同じ seed の最新帯」かつ「11 因子すべて assessment 空」であること。
    SELECT * INTO v_base FROM public.seed_screening_bands WHERE id = NEW.supersedes_assessment_id;
    IF v_base.id IS NULL OR v_base.seed_id IS DISTINCT FROM NEW.seed_id THEN RAISE EXCEPTION 'superseded assessment is missing or belongs to another seed'; END IF;
    IF v_base.frozen IS DISTINCT FROM true OR (v_base.model_version, v_base.measure_version, v_base.q_model_version, v_base.q_ruleset_version, v_base.p_model_version, v_base.ruleset_version)
       IS DISTINCT FROM (v_model.model_version, v_model.measure_version, v_model.q_model_version, v_model.q_ruleset_version, v_model.p_model_version, v_model.assessment_ruleset_version) THEN RAISE EXCEPTION 'superseded assessment is not a frozen current-tuple band'; END IF;
    SELECT b.id INTO v_latest_id FROM public.seed_screening_bands b WHERE b.seed_id = NEW.seed_id AND b.frozen = true AND b.model_version = v_model.model_version AND b.measure_version = v_model.measure_version AND b.q_model_version = v_model.q_model_version AND b.q_ruleset_version = v_model.q_ruleset_version AND b.p_model_version = v_model.p_model_version AND b.ruleset_version = v_model.assessment_ruleset_version ORDER BY b.assessed_at DESC, b.id DESC LIMIT 1;
    IF v_latest_id IS DISTINCT FROM NEW.supersedes_assessment_id THEN RAISE EXCEPTION 'superseded assessment is not the latest band for this seed'; END IF;
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_base.q_evidence) item WHERE coalesce(length(trim(item->>'assessment')), 0) > 0) THEN RAISE EXCEPTION 'superseded assessment already carries assessments; quality remediation does not apply'; END IF;
  END IF;

  IF NEW.stage_lower > NEW.stage_upper THEN RAISE EXCEPTION 'stage_lower must not exceed stage_upper'; END IF;
  IF NEW.prompt_hash IS DISTINCT FROM encode(extensions.digest(convert_to(to_jsonb(NEW.prompt_body)::text,'UTF8'),'sha256'),'hex') THEN RAISE EXCEPTION 'candidate prompt hash does not match frozen body'; END IF;
  IF NEW.prompt_hash IS DISTINCT FROM (SELECT encode(extensions.digest(convert_to(to_jsonb(body)::text,'UTF8'),'sha256'),'hex') FROM public.llm_prompts WHERE prompt_key='sps.initial-assessment.candidate.v1' AND is_active=true) THEN RAISE EXCEPTION 'candidate prompt is not current'; END IF;
  IF NEW.model_hash IS DISTINCT FROM encode(extensions.digest(convert_to('{"assessment_ruleset_version":"rubric-v1.1+ind-v1","measure_version":"sps-ind-v1","model_version":"sps-ind-tier0-v1","p_model_version":"p-ind-v1","q_model_version":"q-eval-v2","q_ruleset_version":"rubric-v1.1"}','UTF8'),'sha256'),'hex') THEN RAISE EXCEPTION 'candidate model hash is not current'; END IF;
  IF NEW.information_cutoff > now() THEN RAISE EXCEPTION 'information_cutoff cannot be in the future'; END IF;
  IF (SELECT source->>'fingerprint' FROM public.sps_initial_assessment_source_snapshot(NEW.seed_id,NEW.information_cutoff) source) IS DISTINCT FROM NEW.source_fingerprint OR (SELECT source->'facts' FROM public.sps_initial_assessment_source_snapshot(NEW.seed_id,NEW.information_cutoff) source) IS DISTINCT FROM NEW.source_facts THEN RAISE EXCEPTION 'candidate source fingerprint is stale or forged'; END IF;
  IF jsonb_typeof(NEW.q_evidence) <> 'array' OR jsonb_array_length(NEW.q_evidence) <> 11 THEN RAISE EXCEPTION 'q_evidence must contain exactly 11 factors'; END IF;
  SELECT array_agg(item->>'id' ORDER BY item->>'id'), count(*) INTO v_ids, v_count FROM jsonb_array_elements(NEW.q_evidence) item;
  IF v_count <> 11 OR v_ids IS DISTINCT FROM ARRAY['alternative_advantage','capital_intensity','customer_validation_cost','microtrend_fit','patent_position','payer_budget','regulatory_gate','reproducibility','scale_constraint','social_acceptance','unit_economics'] THEN RAISE EXCEPTION 'q_evidence must contain every rubric factor exactly once'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(NEW.q_evidence) item WHERE jsonb_typeof(item) <> 'object' OR coalesce(length(trim(item->>'name')),0) NOT BETWEEN 1 AND 80 OR item->>'direction' NOT IN ('down','up','widen','neutral') OR coalesce(length(trim(item->>'evidence')),0) NOT BETWEEN 1 AND 500 OR coalesce(length(trim(item->>'assessment')),0) > 240 OR item::text ~* '(https?|ftp)://|www\.|mailto:|[A-Z0-9.-]+\.(com|jp|org|net|io|edu|gov|ai|dev|app)|password|passcode|secret|bearer[[:space:]]+|api[_ -]?key|パスワード|パスコード|暗証番号' OR item::text ~* '[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}') THEN RAISE EXCEPTION 'q_evidence has invalid, URL, email, or secret content'; END IF;

  -- assessment (その事実が q をどちらへどれだけ動かすかの意味づけ) の充足。
  SELECT count(*) INTO v_filled FROM jsonb_array_elements(NEW.q_evidence) item WHERE coalesce(length(trim(item->>'assessment')), 0) > 0;
  IF NEW.supersedes_assessment_id IS NULL THEN
    IF v_filled = 0 THEN RAISE EXCEPTION 'q_evidence must carry at least one non-empty assessment'; END IF;
  ELSE
    IF v_filled <> 11 THEN RAISE EXCEPTION 'quality remediation requires a non-empty assessment on all 11 factors'; END IF;
  END IF;

  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.apply_sps_initial_assessment_candidate(p_candidate_id uuid, p_actor text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp AS $$
DECLARE c public.sps_initial_assessment_candidates%ROWTYPE; v_model public.sps_model_versions%ROWTYPE; v_assessment_id uuid; v_prompt_hash text; v_model_hash text; v_latest_id uuid;
BEGIN
  IF nullif(trim(p_actor),'') IS NULL OR length(p_actor) > 200 THEN RAISE EXCEPTION 'actor is required'; END IF;
  SELECT seed_id INTO c.seed_id FROM public.sps_initial_assessment_candidates WHERE id = p_candidate_id;
  IF c.seed_id IS NULL THEN RAISE EXCEPTION 'initial SPS candidate is missing'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(c.seed_id::text, 292));
  SELECT * INTO c FROM public.sps_initial_assessment_candidates WHERE id = p_candidate_id FOR UPDATE;
  IF c.id IS NULL OR c.status <> 'pending' THEN RAISE EXCEPTION 'initial SPS candidate is missing or not pending'; END IF;
  SELECT * INTO STRICT v_model FROM public.sps_model_versions WHERE is_current = true FOR SHARE;
  SELECT encode(extensions.digest(convert_to(to_jsonb(body)::text,'UTF8'),'sha256'),'hex') INTO STRICT v_prompt_hash FROM public.llm_prompts WHERE prompt_key='sps.initial-assessment.candidate.v1' AND is_active=true;
  v_model_hash := encode(extensions.digest(convert_to('{"assessment_ruleset_version":"rubric-v1.1+ind-v1","measure_version":"sps-ind-v1","model_version":"sps-ind-tier0-v1","p_model_version":"p-ind-v1","q_model_version":"q-eval-v2","q_ruleset_version":"rubric-v1.1"}','UTF8'),'sha256'),'hex');
  IF c.prompt_hash IS DISTINCT FROM v_prompt_hash OR c.model_hash IS DISTINCT FROM v_model_hash THEN RAISE EXCEPTION 'candidate prompt or model is stale'; END IF;
  IF (c.model_version,c.measure_version,c.q_model_version,c.q_ruleset_version,c.p_model_version,c.assessment_ruleset_version) IS DISTINCT FROM (v_model.model_version,v_model.measure_version,v_model.q_model_version,v_model.q_ruleset_version,v_model.p_model_version,v_model.assessment_ruleset_version) THEN RAISE EXCEPTION 'candidate tuple is stale'; END IF;

  SELECT b.id INTO v_latest_id FROM public.seed_screening_bands b WHERE b.seed_id=c.seed_id AND b.frozen=true AND b.model_version=v_model.model_version AND b.measure_version=v_model.measure_version AND b.q_model_version=v_model.q_model_version AND b.q_ruleset_version=v_model.q_ruleset_version AND b.p_model_version=v_model.p_model_version AND b.ruleset_version=v_model.assessment_ruleset_version ORDER BY b.assessed_at DESC, b.id DESC LIMIT 1;
  IF c.supersedes_assessment_id IS NULL THEN
    IF v_latest_id IS NOT NULL THEN RAISE EXCEPTION 'seed gained a current tuple; initial candidate cannot publish'; END IF;
  ELSE
    -- 是正候補を作ってから apply までのあいだに別の帯が積まれていないこと。
    IF v_latest_id IS DISTINCT FROM c.supersedes_assessment_id THEN RAISE EXCEPTION 'a newer band was appended after this remediation candidate; prepare a new one'; END IF;
  END IF;

  IF (SELECT source->>'fingerprint' FROM public.sps_initial_assessment_source_snapshot(c.seed_id,c.information_cutoff) source) IS DISTINCT FROM c.source_fingerprint OR (SELECT source->'facts' FROM public.sps_initial_assessment_source_snapshot(c.seed_id,c.information_cutoff) source) IS DISTINCT FROM c.source_facts THEN RAISE EXCEPTION 'candidate source fingerprint is stale; prepare a new initial assessment'; END IF;
  INSERT INTO public.seed_screening_bands (seed_id,ruleset_version,evaluator,assessed_at,stage_lower,stage_upper,stage_tag,q_lower_pct,q_upper_pct,q_main_factor,q_evidence,p_class,p_lower_yen,p_upper_yen,sps_lower_yen,sps_upper_yen,frozen,notes,measure_version,model_version,q_model_version,q_ruleset_version,p_model_version,information_cutoff,source_initial_candidate_id)
  VALUES (c.seed_id,c.assessment_ruleset_version,trim(p_actor),now(),c.stage_lower,c.stage_upper,c.stage_tag,c.q_lower_pct,c.q_upper_pct,c.q_main_factor,c.q_evidence,c.p_class,c.p_lower_yen,c.p_upper_yen,c.sps_lower_yen,c.sps_upper_yen,true,c.notes,c.measure_version,c.model_version,c.q_model_version,c.q_ruleset_version,c.p_model_version,c.information_cutoff,c.id) RETURNING id INTO v_assessment_id;
  PERFORM set_config('app.sps_initial_transition','rpc',true);
  UPDATE public.sps_initial_assessment_candidates SET status='applied', applied_assessment_id=v_assessment_id, applied_at=now(), applied_by=trim(p_actor) WHERE id=c.id AND status='pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'candidate changed before apply'; END IF;
  RETURN jsonb_build_object('applied',true,'candidate_id',c.id,'assessment_id',v_assessment_id,'superseded_assessment_id',c.supersedes_assessment_id);
END; $$;

-- submit RPC は supersedes_assessment_id を運ばないと候補へ入らないので、そこだけ足す。
CREATE OR REPLACE FUNCTION public.submit_sps_initial_assessment_candidates(p_candidates jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp AS $$
DECLARE item jsonb; candidate_id uuid; ids uuid[] := '{}';
BEGIN
  IF jsonb_typeof(p_candidates)<>'array' OR jsonb_array_length(p_candidates)>100 THEN RAISE EXCEPTION 'candidate array is invalid'; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(p_candidates) ORDER BY value->>'seed_id' LOOP
    BEGIN
      INSERT INTO public.sps_initial_assessment_candidates(seed_id,model_version,measure_version,q_model_version,q_ruleset_version,p_model_version,assessment_ruleset_version,prompt_body,prompt_hash,model_hash,prepared_hash,source_fingerprint,source_facts,semantic_fingerprint,information_cutoff,stage_lower,stage_upper,stage_tag,q_lower_pct,q_upper_pct,q_main_factor,q_evidence,p_class,p_lower_yen,p_upper_yen,sps_lower_yen,sps_upper_yen,notes,proposal_summary,created_by,supersedes_assessment_id)
      VALUES ((item->>'seed_id')::uuid,item->>'model_version',item->>'measure_version',item->>'q_model_version',item->>'q_ruleset_version',item->>'p_model_version',item->>'assessment_ruleset_version',item->>'prompt_body',item->>'prompt_hash',item->>'model_hash',item->>'prepared_hash',item->>'source_fingerprint',item->'source_facts',item->>'semantic_fingerprint',(item->>'information_cutoff')::timestamptz,item->>'stage_lower',item->>'stage_upper',item->>'stage_tag',(item->>'q_lower_pct')::numeric,(item->>'q_upper_pct')::numeric,item->>'q_main_factor',item->'q_evidence',item->>'p_class',(item->>'p_lower_yen')::bigint,(item->>'p_upper_yen')::bigint,(item->>'sps_lower_yen')::bigint,(item->>'sps_upper_yen')::bigint,item->>'notes',item->>'proposal_summary','codex-sps-initial-assessment',nullif(item->>'supersedes_assessment_id','')::uuid) RETURNING id INTO candidate_id;
    EXCEPTION WHEN unique_violation THEN
      SELECT id INTO candidate_id FROM public.sps_initial_assessment_candidates WHERE seed_id=(item->>'seed_id')::uuid AND semantic_fingerprint=item->>'semantic_fingerprint' AND status IN ('pending','applied') AND prompt_hash=item->>'prompt_hash' AND model_hash=item->>'model_hash' AND prepared_hash=item->>'prepared_hash' AND source_fingerprint=item->>'source_fingerprint' AND source_facts=item->'source_facts' AND information_cutoff=(item->>'information_cutoff')::timestamptz AND stage_lower=item->>'stage_lower' AND stage_upper=item->>'stage_upper' AND stage_tag=item->>'stage_tag' AND q_lower_pct=(item->>'q_lower_pct')::numeric AND q_upper_pct=(item->>'q_upper_pct')::numeric AND q_main_factor=item->>'q_main_factor' AND q_evidence=item->'q_evidence' AND p_class=item->>'p_class' AND p_lower_yen=(item->>'p_lower_yen')::bigint AND p_upper_yen=(item->>'p_upper_yen')::bigint AND sps_lower_yen=(item->>'sps_lower_yen')::bigint AND sps_upper_yen=(item->>'sps_upper_yen')::bigint AND notes=item->>'notes' AND proposal_summary=item->>'proposal_summary' AND supersedes_assessment_id IS NOT DISTINCT FROM nullif(item->>'supersedes_assessment_id','')::uuid;
      IF candidate_id IS NULL THEN RAISE; END IF;
    END;
    ids := array_append(ids,candidate_id);
  END LOOP;
  RETURN jsonb_build_object('ok',true,'candidates',cardinality(ids),'candidate_ids',to_jsonb(ids));
END; $$;

-- 是正対象 (最新帯が「11 因子すべて assessment 空」の seed) を列挙する読み取り専用関数。
-- prepare がこれを引いて対象を決める。古い順に返し、投入順を安定させる。
CREATE OR REPLACE FUNCTION public.sps_initial_assessment_remediation_targets()
RETURNS TABLE (seed_id uuid, assessment_id uuid, assessed_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, extensions, pg_temp AS $fn$
  WITH cur AS (SELECT * FROM public.sps_model_versions WHERE is_current = true),
  latest AS (
    SELECT DISTINCT ON (b.seed_id) b.id, b.seed_id, b.assessed_at, b.q_evidence
    FROM public.seed_screening_bands b, cur c
    WHERE b.frozen = true AND b.model_version = c.model_version AND b.measure_version = c.measure_version
      AND b.q_model_version = c.q_model_version AND b.q_ruleset_version = c.q_ruleset_version
      AND b.p_model_version = c.p_model_version AND b.ruleset_version = c.assessment_ruleset_version
    ORDER BY b.seed_id, b.assessed_at DESC, b.id DESC
  )
  SELECT l.seed_id, l.id, l.assessed_at FROM latest l
  WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(l.q_evidence) it WHERE coalesce(length(trim(it->>'assessment')), 0) > 0)
  ORDER BY l.assessed_at, l.id;
$fn$;

REVOKE ALL ON FUNCTION public.sps_initial_assessment_remediation_targets() FROM public, anon, authenticated;

COMMIT;
