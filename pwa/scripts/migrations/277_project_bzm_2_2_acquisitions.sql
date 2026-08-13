-- 277_project_bzm_2_2_acquisitions.sql
--
-- BZM 2.2「これまでのPJ活動のなかで得てきたもの」台帳 (獲得台帳) の第1段。
-- まさ確定 2026-08-13:
--   「各PJのコックピットのスコア詳細タブ内に『これまでのPJ活動のなかで得てきたもの』を
--     リストとして書いておくべき。それは推進力や戦略余力の計算根拠にもなる。」
--   「そのまま数えることはしないけど、並べて、2.2モデルに従って定量的に数式に入れていかないといけない。」
--   「最初はまだ数値を入れない、第二段階で数値を入れていくならOK。」
--
-- 設計の要点 (正本: pwa/bzm/bzm-2-2-strategic-slack-and-propulsion.md):
--   §3 正規化イベント : 1行 = 1つの正規化事象。同じ事象を支える契約書・議事録・銀行明細は
--                        複数の証拠であって複数の事象ではない → evidence_refs へまとめる。
--                        audit_tags は排他分類ではなく多重付与できる監査用タグ。
--   §4 状態8層       : 効果は x/r/c/k/n/l/e/b のどの層に効いたかで記録する。
--                        異なる単位を足して一つの点数にしない → 合計列を持たない。
--   §5 行動別制約     : 「何が不明・違反から充足へ動いたか」を closed_constraints に持つ。
--                        これが第2段で σ_j へ写像され、Γ_exec^reg を動かす唯一の経路。
--   §6 推進力         : 消費 (現金・時間・注意・不可逆に使った権利) を consumed に分けて持つ。
--                        得たものだけ並べると §8 の危機判定 (消費に対して改善していない) が作れない。
--   §10 証拠段階      : observed / calculated / estimated / conditional / missing / not_applicable。
--                        missing を 0 に読み替えず、不明のまま保持する。
--
-- 第1段の安全弁: numeric_binding は 'display_only' 固定で入る。
--   'bound' へ上げるのは第2段 (σ_j / P^0 への写像を spec へ登録してから)。
--   J / P / Q / S・SPS・戦略余力のどの計算にもこのテーブルはまだ入らない。
--
-- 冪等性: CREATE TABLE IF NOT EXISTS / DROP POLICY IF EXISTS / CREATE OR REPLACE。

CREATE TABLE IF NOT EXISTS public.project_bzm_2_2_acquisitions (
  acquisition_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text NOT NULL,

  -- §3 正規化イベント: PJ内で一意な事象キー。同じ事象を二重登録しないための鍵。
  canonical_event_key text NOT NULL,
  occurred_on date NOT NULL,
  title text NOT NULL,
  summary text NOT NULL DEFAULT '',

  -- §3 監査用タグ (非MECE / 多重付与可)。
  -- financial / human-attention / organization-governance / technical-information /
  -- physical-operations / legal-regulatory / relational / legitimacy
  audit_tags jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- §10 証拠段階。missing を 0 と読み替えない。
  evidence_stage text NOT NULL DEFAULT 'missing',

  -- 証拠への参照。[{ source, source_ref, important_evidence_id, note }]
  -- 複数証拠 → 1事象。project_important_evidence.important_evidence_id を指す想定。
  evidence_refs jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- §4 状態8層への効果。[{ layer: 'x'|'r'|'c'|'k'|'n'|'l'|'e'|'b', effect, note }]
  state_effects jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- §5 制約の移動。[{ constraint_key, constraint_type, action_key, before, after, note }]
  -- before/after は 'unknown' | 'violated' | 'met'。第2段で σ_j へ写像する対象。
  closed_constraints jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- §6 消費。[{ resource_kind, amount, unit, irreversible, note }]
  -- amount は null 可 (未計測)。null を 0 と読み替えない。
  consumed jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- §6 行動集合の変化。[{ action_key, direction: 'opened'|'lost', note }]
  action_delta jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- 第1段の安全弁。'display_only' = どの数式にも入っていない。
  numeric_binding text NOT NULL DEFAULT 'display_only',
  -- 第2段で 'bound' にしたとき、どこへ写像したかを人が読める形で残す。
  bound_target text NOT NULL DEFAULT '',

  information_cutoff date,
  model_version text NOT NULL DEFAULT 'bzm2.2-acquisition/v1',
  -- 'manual' = 人が登録、'extraction' = 重要書類抽出パイプライン由来。
  source_origin text NOT NULL DEFAULT 'manual',
  status text NOT NULL DEFAULT 'active',

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (project_id, canonical_event_key)
);

COMMENT ON TABLE public.project_bzm_2_2_acquisitions IS
  'BZM 2.2 獲得台帳。1行=1正規化事象。閉じた条件 / 消費 / 開いた行動の三点セットを、状態8層と証拠段階つきで保持する。第1段は numeric_binding=display_only で、J/P/Q/S・SPS・戦略余力のどの計算にも入らない。';

-- CHECK: 値域を DB 側で縛る (spec と実データの乖離を防ぐ)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'project_bzm_2_2_acquisitions_evidence_stage_check') THEN
    ALTER TABLE public.project_bzm_2_2_acquisitions
      ADD CONSTRAINT project_bzm_2_2_acquisitions_evidence_stage_check
      CHECK (evidence_stage IN ('observed','calculated','estimated','conditional','missing','not_applicable'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'project_bzm_2_2_acquisitions_numeric_binding_check') THEN
    ALTER TABLE public.project_bzm_2_2_acquisitions
      ADD CONSTRAINT project_bzm_2_2_acquisitions_numeric_binding_check
      CHECK (numeric_binding IN ('display_only','bound'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'project_bzm_2_2_acquisitions_source_origin_check') THEN
    ALTER TABLE public.project_bzm_2_2_acquisitions
      ADD CONSTRAINT project_bzm_2_2_acquisitions_source_origin_check
      CHECK (source_origin IN ('manual','extraction'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'project_bzm_2_2_acquisitions_status_check') THEN
    ALTER TABLE public.project_bzm_2_2_acquisitions
      ADD CONSTRAINT project_bzm_2_2_acquisitions_status_check
      CHECK (status IN ('active','superseded','rejected'));
  END IF;

  -- 'bound' にするなら写像先を必ず書かせる (第2段の空バインド防止)
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'project_bzm_2_2_acquisitions_bound_target_check') THEN
    ALTER TABLE public.project_bzm_2_2_acquisitions
      ADD CONSTRAINT project_bzm_2_2_acquisitions_bound_target_check
      CHECK (numeric_binding = 'display_only' OR length(btrim(bound_target)) > 0);
  END IF;

  -- jsonb は配列だけ許す (オブジェクト直入れによる集計事故を防ぐ)
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'project_bzm_2_2_acquisitions_json_arrays_check') THEN
    ALTER TABLE public.project_bzm_2_2_acquisitions
      ADD CONSTRAINT project_bzm_2_2_acquisitions_json_arrays_check
      CHECK (
        jsonb_typeof(audit_tags) = 'array'
        AND jsonb_typeof(evidence_refs) = 'array'
        AND jsonb_typeof(state_effects) = 'array'
        AND jsonb_typeof(closed_constraints) = 'array'
        AND jsonb_typeof(consumed) = 'array'
        AND jsonb_typeof(action_delta) = 'array'
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS project_bzm_2_2_acquisitions_project_date_idx
  ON public.project_bzm_2_2_acquisitions (project_id, occurred_on DESC);

CREATE OR REPLACE FUNCTION public.touch_project_bzm_2_2_acquisitions_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS touch_updated_at ON public.project_bzm_2_2_acquisitions;
CREATE TRIGGER touch_updated_at BEFORE UPDATE ON public.project_bzm_2_2_acquisitions
  FOR EACH ROW EXECUTE FUNCTION public.touch_project_bzm_2_2_acquisitions_updated_at();

ALTER TABLE public.project_bzm_2_2_acquisitions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS project_bzm_2_2_acquisitions_read ON public.project_bzm_2_2_acquisitions;
CREATE POLICY project_bzm_2_2_acquisitions_read ON public.project_bzm_2_2_acquisitions
  FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS project_bzm_2_2_acquisitions_admin_write ON public.project_bzm_2_2_acquisitions;
CREATE POLICY project_bzm_2_2_acquisitions_admin_write ON public.project_bzm_2_2_acquisitions
  FOR ALL TO public USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS project_bzm_2_2_acquisitions_service_role ON public.project_bzm_2_2_acquisitions;
CREATE POLICY project_bzm_2_2_acquisitions_service_role ON public.project_bzm_2_2_acquisitions
  FOR ALL TO public USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- 事後assert
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'project_bzm_2_2_acquisitions'
  ) THEN
    RAISE EXCEPTION 'project_bzm_2_2_acquisitions が作成されていない';
  END IF;
END $$;
