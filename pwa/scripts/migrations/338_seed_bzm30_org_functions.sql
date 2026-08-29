-- BZM 3.0 の案件ごとの入力に、八機能の充足 f2〜f7 を足す（APPROVALS #2026-08-29-2）。
--
-- まさ 2026-08-29「おけ、そしたらその２つは採用で」（八機能の充足＋案件ごとのバーンレート）。
--
-- 機能1（エバンジェリスト）は既存の evangelist_e が別名なので列を持たない。
-- 機能2（技術の核）は「失われた観測がある案件だけ空席を指定できる」条件つき規約（§6.I-3-1）。
--   指定した案件では恒久喪失率 λ^core を重ねない。
-- 機能3〜7 は「評価日に確率 f で充足済み、残りが供給過程で埋まる」。省略した機能は既定の扱い。
-- 第一便の埋め方: 明確な観測（《組織》project_org_observations・登録簿相当）がある案件・機能だけ
--   指定し、根拠を1件ずつ書く。残りは既定（モデルページ §6.I-9-1）。
-- バーンレートの列（burn_rate_yen_month / burn_rate_reason）は migration 332 で作成済みで、
--   #2026-08-29-2 から参照実装が受け取るようになった（列の追加は不要）。

ALTER TABLE seed_bzm30_inputs
  ADD COLUMN IF NOT EXISTS funcs_f2 NUMERIC,
  ADD COLUMN IF NOT EXISTS funcs_f2_reason TEXT,
  ADD COLUMN IF NOT EXISTS funcs_f3 NUMERIC,
  ADD COLUMN IF NOT EXISTS funcs_f3_reason TEXT,
  ADD COLUMN IF NOT EXISTS funcs_f4 NUMERIC,
  ADD COLUMN IF NOT EXISTS funcs_f4_reason TEXT,
  ADD COLUMN IF NOT EXISTS funcs_f5 NUMERIC,
  ADD COLUMN IF NOT EXISTS funcs_f5_reason TEXT,
  ADD COLUMN IF NOT EXISTS funcs_f6 NUMERIC,
  ADD COLUMN IF NOT EXISTS funcs_f6_reason TEXT,
  ADD COLUMN IF NOT EXISTS funcs_f7 NUMERIC,
  ADD COLUMN IF NOT EXISTS funcs_f7_reason TEXT;

COMMENT ON COLUMN seed_bzm30_inputs.funcs_f2 IS '機能2（技術の核）の評価日の充足 0〜1（#2026-08-29-2。失われた観測がある案件だけ指定。指定時は λ^core を外し、空席は供給過程で埋まらない）';
COMMENT ON COLUMN seed_bzm30_inputs.funcs_f3 IS '機能3（用途と需要家）の評価日の充足 0〜1（#2026-08-29-2。省略は既定＝供給過程）';
COMMENT ON COLUMN seed_bzm30_inputs.funcs_f4 IS '機能4（意思決定）の評価日の充足 0〜1（#2026-08-29-2。省略は既定＝供給過程）';
COMMENT ON COLUMN seed_bzm30_inputs.funcs_f5 IS '機能5（資金調達）の評価日の充足 0〜1（#2026-08-29-2。省略は既定＝供給過程）';
COMMENT ON COLUMN seed_bzm30_inputs.funcs_f6 IS '機能6（対外交渉）の評価日の充足 0〜1（#2026-08-29-2。省略は既定＝供給過程）';
COMMENT ON COLUMN seed_bzm30_inputs.funcs_f7 IS '機能7（組織）の評価日の充足 0〜1（#2026-08-29-2。省略は既定＝供給過程）';
