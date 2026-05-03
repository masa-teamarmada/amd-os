-- AMD Atlas — マクロ判断ナレッジベース Schema
-- 2026-04-22

-- ============================================================
-- atlas_nodes: topic/signal/decision等のグラフノード
-- ============================================================
CREATE TABLE atlas_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('topic','signal','decision','project','technology','material','market')),
  title TEXT NOT NULL,
  summary TEXT,
  metadata JSONB DEFAULT '{}',
  importance TEXT DEFAULT 'medium' CHECK (importance IN ('high','medium','low')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active','archived','spawned')),
  tags TEXT[] DEFAULT '{}',
  last_updated TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- atlas_edges: ノード間のリレーション
-- ============================================================
CREATE TABLE atlas_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_node UUID REFERENCES atlas_nodes(id) ON DELETE CASCADE,
  to_node UUID REFERENCES atlas_nodes(id) ON DELETE CASCADE,
  relation_type TEXT NOT NULL CHECK (relation_type IN ('affects','derived_from','triggered','related_to','depends_on','competes_with')),
  strength NUMERIC DEFAULT 0.5 CHECK (strength >= 0 AND strength <= 1),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- atlas_observations: signal/topicへの観測（append-only）
-- ============================================================
CREATE TABLE atlas_observations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id UUID REFERENCES atlas_nodes(id) ON DELETE CASCADE,
  observed_at TIMESTAMPTZ DEFAULT now(),
  content TEXT NOT NULL,
  source_url TEXT,
  source_type TEXT CHECK (source_type IN ('news','report','data','manual'))
);

-- ============================================================
-- atlas_decisions: AMDの判断ログ
-- ============================================================
CREATE TABLE atlas_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID REFERENCES atlas_nodes(id) ON DELETE SET NULL,
  decided_at TIMESTAMPTZ DEFAULT now(),
  action TEXT CHECK (action IN ('起業','スタジオ','支援','スルー','保留')),
  rationale TEXT,
  outcome_eval_at TIMESTAMPTZ,
  outcome TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE atlas_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE atlas_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE atlas_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE atlas_decisions ENABLE ROW LEVEL SECURITY;

-- anon: read-only
CREATE POLICY "anon read atlas_nodes" ON atlas_nodes FOR SELECT USING (true);
CREATE POLICY "anon read atlas_edges" ON atlas_edges FOR SELECT USING (true);
CREATE POLICY "anon read atlas_observations" ON atlas_observations FOR SELECT USING (true);
CREATE POLICY "anon read atlas_decisions" ON atlas_decisions FOR SELECT USING (true);

-- authenticated: insert/update可能（えいみ・まさが書き込む）
CREATE POLICY "auth insert atlas_nodes" ON atlas_nodes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update atlas_nodes" ON atlas_nodes FOR UPDATE TO authenticated USING (true);
CREATE POLICY "auth insert atlas_observations" ON atlas_observations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update atlas_observations" ON atlas_observations FOR UPDATE TO authenticated USING (true);
CREATE POLICY "auth insert atlas_decisions" ON atlas_decisions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update atlas_decisions" ON atlas_decisions FOR UPDATE TO authenticated USING (true);

-- ============================================================
-- サンプルデータ（helium_coolingトピック）
-- ============================================================
INSERT INTO atlas_nodes (type, title, summary, importance, status, tags, metadata) VALUES
(
  'topic',
  '脱ヘリウム冷却技術',
  '中東情勢の悪化と半導体需要増によりヘリウム価格が高騰。産業冷却分野で脱ヘリウム（ドライ冷凍機・磁気冷凍）の動きが加速。CXの事業環境に直接影響。',
  'high',
  'active',
  ARRAY['冷却','素材','エネルギー','CX','半導体'],
  '{"domain": "C.素材", "related_pj": "CX", "watchlist_var": "C-1"}'::jsonb
),
(
  'topic',
  'リチウム価格動向とリサイクル',
  'EV普及減速とリチウム供給増により2024年に急落。2025年以降は再上昇見込み。リサイクル技術の競争が激化。LSTの事業機会に直接関連。',
  'high',
  'active',
  ARRAY['素材','EV','リサイクル','LST'],
  '{"domain": "C.素材", "related_pj": "LST", "watchlist_var": "C-2"}'::jsonb
),
(
  'topic',
  'マイクロ波ワイヤレス給電の実用化',
  '宇宙太陽光発電（SSPS）や産業IoTでワイヤレス給電の需要が急拡大。SEが主要プレーヤー。規制整備と効率向上が鍵。',
  'high',
  'active',
  ARRAY['エネルギー','ワイヤレス給電','SE','宇宙'],
  '{"domain": "D.エネルギー", "related_pj": "SE", "watchlist_var": "D-7"}'::jsonb
);
