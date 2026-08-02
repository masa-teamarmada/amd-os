-- BZM 理論マップの配置は、表示時の自動整列ではなく利用者が決めた座標を正本にする。
-- nullable のまま追加し、既存ノードのデータや配置を migration 時に書き換えない。
ALTER TABLE public.bzm_theory_nodes
  ADD COLUMN IF NOT EXISTS position_x double precision,
  ADD COLUMN IF NOT EXISTS position_y double precision;

COMMENT ON COLUMN public.bzm_theory_nodes.position_x IS
  'BZM theory map user-authored canvas X coordinate; null means deterministic client fallback only.';
COMMENT ON COLUMN public.bzm_theory_nodes.position_y IS
  'BZM theory map user-authored canvas Y coordinate; null means deterministic client fallback only.';
