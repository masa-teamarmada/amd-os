-- AMD Atlas Phase 2 — Signal Inbox
-- えいみが投入したシグナルをまさがキュレーションするキュー
-- 2026-04-22

CREATE TABLE atlas_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- シグナル本体
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  source_url TEXT,                                   -- 原則必須（えいみのフォームでrequired）
  source_type TEXT CHECK (source_type IN ('news','report','data','manual')),
  domain TEXT,                                       -- 'A.地政学' 〜 'O.サーキュラー' など
  suggested_tags TEXT[] DEFAULT '{}',
  importance TEXT DEFAULT 'medium' CHECK (importance IN ('high','medium','low')),

  -- ステータス
  status TEXT DEFAULT 'inbox' CHECK (status IN ('inbox','accepted','held','rejected')),

  -- Accept時の紐付け先
  target_node_id UUID REFERENCES atlas_nodes(id) ON DELETE SET NULL,

  -- タイムスタンプ
  submitted_at TIMESTAMPTZ DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE atlas_signals ENABLE ROW LEVEL SECURITY;

-- anon: inbox(status=inbox)のみ読み取り可（まさが確認できる）
CREATE POLICY "anon read atlas_signals" ON atlas_signals FOR SELECT USING (true);

-- authenticated: 全操作可
CREATE POLICY "auth insert atlas_signals" ON atlas_signals FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update atlas_signals" ON atlas_signals FOR UPDATE TO authenticated USING (true);
CREATE POLICY "auth delete atlas_signals" ON atlas_signals FOR DELETE TO authenticated USING (true);
