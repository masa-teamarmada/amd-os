-- 214_bzm_theory_node_memos.sql
--
-- BZM 理論マップ: ノード内メモ台帳。メモはノードの内側へ積む記録であり、
-- ノードやエッジを増やさない (bzm_theory_nodes / bzm_theory_edges は不変)。
-- このmigrationは空テーブルを作るだけで、既存のノード・エッジ・利用者データを
-- 更新・移行・削除しない。
--
-- 正本仕様: pwa/spec/2-6-bzm-theory-map-current-spec.md

CREATE TABLE IF NOT EXISTS public.bzm_theory_node_memos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id text NOT NULL REFERENCES public.bzm_theory_nodes(id) ON DELETE CASCADE,
  memo_type text NOT NULL CHECK (memo_type IN (
    'supports', 'challenges', 'refutes', 'raises', 'tests'
  )),
  body text NOT NULL,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bzm_theory_node_memos
  DROP CONSTRAINT IF EXISTS bzm_theory_node_memos_body_limits;
ALTER TABLE public.bzm_theory_node_memos
  ADD CONSTRAINT bzm_theory_node_memos_body_limits CHECK (
    char_length(btrim(body)) BETWEEN 1 AND 2000
  );

CREATE INDEX IF NOT EXISTS idx_bzm_theory_node_memos_node_id ON public.bzm_theory_node_memos(node_id);
CREATE INDEX IF NOT EXISTS idx_bzm_theory_node_memos_memo_type ON public.bzm_theory_node_memos(memo_type);

-- -------------------------------------------------------------------------
-- RLS
-- -------------------------------------------------------------------------

ALTER TABLE public.bzm_theory_node_memos ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bzm_theory_node_memos TO authenticated, service_role;

DROP POLICY IF EXISTS bzm_theory_node_memos_select_active ON public.bzm_theory_node_memos;
CREATE POLICY bzm_theory_node_memos_select_active
  ON public.bzm_theory_node_memos
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.bzm_theory_nodes AS node
      WHERE node.id = node_id
        AND node.archived_at IS NULL
    )
  );

DROP POLICY IF EXISTS bzm_theory_node_memos_admin_write ON public.bzm_theory_node_memos;
CREATE POLICY bzm_theory_node_memos_admin_write
  ON public.bzm_theory_node_memos
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS bzm_theory_node_memos_service ON public.bzm_theory_node_memos;
CREATE POLICY bzm_theory_node_memos_service
  ON public.bzm_theory_node_memos
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
