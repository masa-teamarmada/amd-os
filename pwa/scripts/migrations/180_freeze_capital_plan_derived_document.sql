-- 180_freeze_capital_plan_derived_document.sql
--
-- migration 179 の freeze_capital_plan(4引数) は、plan の document_json を
-- 「保存されている生の値」のまま version テーブルに複製していた。
-- しかし calculationBasis が設定されていても、プレマネー評価額・ポストマネー
-- 評価額・1株あたり価格・調達額・新規発行株式数が実際には未解決（deriveCapitalPlan
-- 未実行）のまま保存されているケースがあり、その場合でも freeze でき、
-- 不完全な財務情報が append-only の履歴に永久に固定されてしまう恐れがあった。
--
-- 対策として、freeze API 側で document_json を deriveCapitalPlan にかけた
-- 結果（derive済みプラン）を p_document_json として明示的に渡すように変更し、
-- この RPC はそれを version へ INSERT すると同時に working plan の
-- document_json もその derive済みドキュメントに更新する。旧4引数シグネチャは
-- 明示的に DROP し、derive を経由しない古い呼び出し経路を残さない。
-- revision / source_revision の意味は変更しない（revision はfreezeでは
-- 進めない。source_revision は freeze 時点の expected revision を記録する）。
--
-- 旧4引数シグネチャの DROP FUNCTION はこのファイルで意図的に行う破壊的操作だが、
-- 対象は関数定義のみで、テーブル・カラム・インデックス・RLSポリシー・既存データは
-- 一切 DROP/ALTER しない（呼び出し元は同時に5引数版へ更新済みのため、旧シグネチャに
-- 依存する現存呼び出し経路は残らない）。
--
-- 追加対応（同ファイル内、初回 apply 前のため破壊的マイグレーションの追加なし）:
-- ネットワーク再試行や二重クリックで同じ (plan_id, source_revision) に対して
-- freeze_capital_plan が2回呼ばれると、旧ロジックは version を2回 INSERT して
-- しまい、append-only 履歴に同一内容の重複バージョンが積まれる恐れがあった。
-- plan_id + source_revision の一意性を保証する UNIQUE INDEX を追加し、RPC 側でも
-- INSERT 前に同じ (plan_id, source_revision) の version が既に存在するかを
-- チェックして、存在すれば新規 INSERT を行わずその version をそのまま返す
-- （exact-once: 同じ revision に対する freeze は常に同じ version に解決される）。
-- 行ロック（`SELECT ... FOR UPDATE` による plan 行の advisory な排他）と、
-- 新規 freeze 時の version insert + working plan document_json 更新の原子性は
-- 変更しない。

DROP FUNCTION IF EXISTS public.freeze_capital_plan(uuid, integer, jsonb, text);

CREATE UNIQUE INDEX IF NOT EXISTS project_capital_plan_versions_plan_source_revision_uniq
  ON public.project_capital_plan_versions(plan_id, source_revision);

CREATE OR REPLACE FUNCTION public.freeze_capital_plan(
  p_plan_id uuid,
  p_expected_revision integer,
  p_validation_summary jsonb,
  p_published_by_email text,
  p_document_json jsonb
) RETURNS TABLE (plan jsonb, version jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan public.project_capital_plans%ROWTYPE;
  v_version public.project_capital_plan_versions%ROWTYPE;
  v_next_version integer;
BEGIN
  SELECT * INTO v_plan
  FROM public.project_capital_plans
  WHERE id = p_plan_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'plan not found: %', p_plan_id USING ERRCODE = 'AMD02';
  END IF;

  IF v_plan.revision <> p_expected_revision THEN
    RAISE EXCEPTION 'revision conflict: expected % current %', p_expected_revision, v_plan.revision
      USING ERRCODE = 'AMD01';
  END IF;

  -- exact-once: この plan_id + source_revision は過去に freeze 済みなら、
  -- 同じ行ロック配下で既存 version を返し、重複 INSERT を行わない。
  SELECT * INTO v_version
  FROM public.project_capital_plan_versions
  WHERE plan_id = v_plan.id AND source_revision = p_expected_revision;

  IF FOUND THEN
    RETURN QUERY SELECT to_jsonb(v_plan), to_jsonb(v_version);
    RETURN;
  END IF;

  v_next_version := COALESCE(v_plan.latest_frozen_version, 0) + 1;

  INSERT INTO public.project_capital_plan_versions (
    plan_id, project_id, version, source_revision, document_json, validation_summary, published_by_email
  ) VALUES (
    v_plan.id, v_plan.project_id, v_next_version, p_expected_revision, p_document_json,
    p_validation_summary, p_published_by_email
  )
  RETURNING * INTO v_version;

  UPDATE public.project_capital_plans
  SET document_json = p_document_json,
      latest_frozen_version = v_next_version,
      updated_by_email = p_published_by_email,
      updated_at = now()
  WHERE id = v_plan.id
  RETURNING * INTO v_plan;

  RETURN QUERY SELECT to_jsonb(v_plan), to_jsonb(v_version);
END;
$$;

REVOKE ALL ON FUNCTION public.freeze_capital_plan(uuid, integer, jsonb, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.freeze_capital_plan(uuid, integer, jsonb, text, jsonb) TO service_role;
