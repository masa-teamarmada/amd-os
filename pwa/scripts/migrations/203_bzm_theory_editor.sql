-- 203_bzm_theory_editor.sql
--
-- BZM theory graph editor: persistent store for the theory nodes and
-- relations currently authored as Markdown under pwa/bzm/theory-graph/*.md.
-- CHECK allowlists below are drawn exactly from the kind/layer/status/relation
-- values used across those 21 files; widen them in a future migration if the
-- graph grows a new value. `origin` distinguishes seeded content from rows
-- created later in the editor so this file can be rerun without clobbering
-- user edits (seed insert uses ON CONFLICT DO NOTHING).

-- -------------------------------------------------------------------------
-- updated_at trigger helper (reuse the shared one if this project already has it)
-- -------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'set_updated_at'
  ) THEN
    CREATE FUNCTION public.set_updated_at()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $fn$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $fn$;
  END IF;
END $$;

-- -------------------------------------------------------------------------
-- Tables
-- -------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.bzm_theory_nodes (
  id text PRIMARY KEY,
  title text NOT NULL,
  kind text NOT NULL CHECK (kind IN (
    'claim', 'concept', 'decision', 'measure', 'question', 'source'
  )),
  layer text NOT NULL CHECK (layer IN (
    'cross-layer', 'evidence', 'diagnosis', 'prediction', 'decision', 'institution', 'portfolio'
  )),
  status text NOT NULL CHECK (status IN (
    'established', 'conditional', 'design-choice', 'hypothesis', 'refuted', 'unknown'
  )),
  summary text NOT NULL,
  body_md text NOT NULL DEFAULT '',
  source_ref text,
  origin text NOT NULL DEFAULT 'editor' CHECK (origin IN ('seed', 'editor')),
  created_by text,
  updated_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.bzm_theory_edges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_node_id text NOT NULL REFERENCES public.bzm_theory_nodes(id) ON DELETE CASCADE,
  to_node_id text NOT NULL REFERENCES public.bzm_theory_nodes(id) ON DELETE CASCADE,
  relation_type text NOT NULL CHECK (relation_type IN (
    'depends_on', 'challenges', 'defines', 'supersedes', 'refutes',
    'operationalizes', 'tests', 'supports', 'raises'
  )),
  note text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (from_node_id, relation_type, to_node_id)
);

-- API validation is the first line of defence; keep the same invariants at
-- the database boundary so an authenticated admin client cannot bypass them.
ALTER TABLE public.bzm_theory_nodes
  DROP CONSTRAINT IF EXISTS bzm_theory_nodes_text_limits;
ALTER TABLE public.bzm_theory_nodes
  ADD CONSTRAINT bzm_theory_nodes_text_limits CHECK (
    char_length(id) BETWEEN 1 AND 160
    AND char_length(btrim(title)) BETWEEN 1 AND 220
    AND char_length(btrim(summary)) BETWEEN 1 AND 2000
    AND char_length(body_md) <= 30000
    AND (source_ref IS NULL OR char_length(source_ref) <= 1000)
  );

ALTER TABLE public.bzm_theory_edges
  DROP CONSTRAINT IF EXISTS bzm_theory_edges_value_limits;
ALTER TABLE public.bzm_theory_edges
  ADD CONSTRAINT bzm_theory_edges_value_limits CHECK (
    from_node_id <> to_node_id
    AND (note IS NULL OR char_length(note) <= 2000)
  );

CREATE OR REPLACE FUNCTION public.validate_bzm_theory_edge()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.relation_type = 'raises' AND NOT EXISTS (
    SELECT 1
    FROM public.bzm_theory_nodes AS target
    WHERE target.id = NEW.to_node_id
      AND target.kind = 'question'
      AND target.archived_at IS NULL
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'raises edge target must be an active question node';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bzm_theory_edges_validate ON public.bzm_theory_edges;
CREATE TRIGGER bzm_theory_edges_validate
  BEFORE INSERT OR UPDATE OF to_node_id, relation_type ON public.bzm_theory_edges
  FOR EACH ROW EXECUTE FUNCTION public.validate_bzm_theory_edge();

CREATE OR REPLACE FUNCTION public.validate_bzm_theory_node_kind()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.kind <> 'question' AND EXISTS (
    SELECT 1
    FROM public.bzm_theory_edges AS edge
    WHERE edge.to_node_id = NEW.id
      AND edge.relation_type = 'raises'
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'a raises target must remain a question node';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bzm_theory_nodes_validate_kind ON public.bzm_theory_nodes;
CREATE TRIGGER bzm_theory_nodes_validate_kind
  BEFORE UPDATE OF kind ON public.bzm_theory_nodes
  FOR EACH ROW EXECUTE FUNCTION public.validate_bzm_theory_node_kind();

DROP TRIGGER IF EXISTS bzm_theory_nodes_set_updated_at ON public.bzm_theory_nodes;
CREATE TRIGGER bzm_theory_nodes_set_updated_at
  BEFORE UPDATE ON public.bzm_theory_nodes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -------------------------------------------------------------------------
-- Indexes
-- -------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_bzm_theory_nodes_kind ON public.bzm_theory_nodes(kind);
CREATE INDEX IF NOT EXISTS idx_bzm_theory_nodes_layer ON public.bzm_theory_nodes(layer);
CREATE INDEX IF NOT EXISTS idx_bzm_theory_nodes_status ON public.bzm_theory_nodes(status);
CREATE INDEX IF NOT EXISTS idx_bzm_theory_nodes_archived_at ON public.bzm_theory_nodes(archived_at);

CREATE INDEX IF NOT EXISTS idx_bzm_theory_edges_from_node_id ON public.bzm_theory_edges(from_node_id);
CREATE INDEX IF NOT EXISTS idx_bzm_theory_edges_to_node_id ON public.bzm_theory_edges(to_node_id);
CREATE INDEX IF NOT EXISTS idx_bzm_theory_edges_relation_type ON public.bzm_theory_edges(relation_type);

-- -------------------------------------------------------------------------
-- RLS
-- -------------------------------------------------------------------------

ALTER TABLE public.bzm_theory_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bzm_theory_edges ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bzm_theory_nodes TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bzm_theory_edges TO authenticated, service_role;

DROP POLICY IF EXISTS bzm_theory_nodes_select_active ON public.bzm_theory_nodes;
CREATE POLICY bzm_theory_nodes_select_active
  ON public.bzm_theory_nodes
  FOR SELECT
  TO authenticated
  USING (archived_at IS NULL);

DROP POLICY IF EXISTS bzm_theory_nodes_admin_write ON public.bzm_theory_nodes;
CREATE POLICY bzm_theory_nodes_admin_write
  ON public.bzm_theory_nodes
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS bzm_theory_nodes_service ON public.bzm_theory_nodes;
CREATE POLICY bzm_theory_nodes_service
  ON public.bzm_theory_nodes
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS bzm_theory_edges_select_all ON public.bzm_theory_edges;
CREATE POLICY bzm_theory_edges_select_all
  ON public.bzm_theory_edges
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.bzm_theory_nodes AS from_node
      WHERE from_node.id = from_node_id
        AND from_node.archived_at IS NULL
    )
    AND EXISTS (
      SELECT 1
      FROM public.bzm_theory_nodes AS to_node
      WHERE to_node.id = to_node_id
        AND to_node.archived_at IS NULL
    )
  );

DROP POLICY IF EXISTS bzm_theory_edges_admin_write ON public.bzm_theory_edges;
CREATE POLICY bzm_theory_edges_admin_write
  ON public.bzm_theory_edges
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS bzm_theory_edges_service ON public.bzm_theory_edges;
CREATE POLICY bzm_theory_edges_service
  ON public.bzm_theory_edges
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- -------------------------------------------------------------------------
-- Seed: 21 nodes from pwa/bzm/theory-graph/*.md
-- -------------------------------------------------------------------------

INSERT INTO public.bzm_theory_nodes (
  id, title, kind, layer, status, summary, body_md, source_ref, origin, created_by, updated_by
) VALUES
(
  'claim-action-value-formula',
  '行動優先度をSPS感度から分離するActionValue式',
  'claim', 'decision', 'design-choice',
  '現行のα_i/(X_i+1)は現在の式と符号化におけるスコア感度に過ぎず、費用・所要時間・成功確率・依存関係・統制権の喪失を含まない。BZM 2.0の行動候補はActionValue(a)=p_aΔO_a+I_a+V_option,a−C_cash,a−C_time,a−C_control,a−C_opportunity,aを別表で持ち、小標本ではレンジと根拠を並べる。',
  $body$## 内容

現行の$\alpha_i/(X_i+1)$は、現在の式と符号化におけるスコア感度を示す。この値は、軸を動かす費用、所要時間、成功確率、依存関係、統制権の喪失を含まない。

BZM 2.0の行動候補は、少なくとも次の要素を別表で持つ。

$$\mathrm{ActionValue}(a)=p_a\Delta O_a+I_a+V_{option,a}-C_{cash,a}-C_{time,a}-C_{control,a}-C_{opportunity,a}$$

各記号は、次の意味を持つ。

- $p_a$:行動が意図した変化を起こす確率。
- $\Delta O_a$:観測したい外部成果の変化。
- $I_a$:意思決定に必要な情報を得る価値。
- $V_{option,a}$:新たに得る選択肢または失わずに済む選択肢の価値。
- $C$:現金、時間、統制権、他の機会を失う費用。

小標本では各項を一つの精密な金額へ合成せず、レンジと根拠を並べる。この主張は、SPS感度をそのまま行動優先度として使う運用を明示的に否定する。$body$,
  'BZM_2_0_REVISION_REQUIREMENTS.md#43-行動優先度をsps感度から分離する',
  'seed', 'seed', 'seed'
),
(
  'claim-old-two-layer-noncommutativity-theorem',
  '旧・二層非可換性定理(Book A版)',
  'claim', 'cross-layer', 'refuted',
  'Book A第11章の旧証明は、境界で機関感応度がゼロ、内部で正になる単調な合成関数は存在しないと主張していたが、Φ(g,h)=ghが反例となるため、現行の公理と証明から不可能性は導けない。2026-07-29付でBOOK_DECISIONS.md D-062により撤回された。',
  $body$## 内容

旧版は、案件側の総合点$g$が消える境界では機関側の総合点$h$への感応がゼロとなり、案件が生きている内部では正となる増加関数は存在しないとした(公理A1〜A4による証明)。

しかし$\Phi(g,h)=gh$は、$g=0$の境界で機関感応度$\partial\Phi/\partial h = g$がゼロとなり、$g>0$の内部で正となるため反例になる。したがって、境界と内部で感応が変わるという事実だけから合成関数の不存在は導けない。

BOOK_DECISIONS.md D-062は、Book A版の旧「二層非可換性定理」と公理A1〜A4による証明を撤回し、D-004の中核命題一括指定・P-008e・P-010・D-007(Theorem 3先行の書き順)を上書きした。撤回後もBook A第11章は測定分離原則の章として維持される。$body$,
  'BOOK_DECISIONS.md#d-062; book-a-ch-12.md#113-機関は案件を救えるか',
  'seed', 'seed', 'seed'
),
(
  'claim-p1-conditional-theorem',
  'P1論文草稿の条件付き定理(Book A版とは別定理)',
  'claim', 'cross-layer', 'conditional',
  'P1論文草稿はBook A版の証明に加え、案件段階による機関比較の反転と残り道程による案件比較の反転を条件に置く。Φ(g,h)=ghはBook A版への反例であり、この追加条件を持つP1版を単独で反証するものではないが、P1版は仮定・関数クラス・証明・適用領域を独立に再検証するまで投稿根拠に用いない。',
  $body$## 内容

P1論文草稿は、Book A版に加えて案件段階による機関比較の反転と残り道程による案件比較の反転を条件に置く。$\Phi(g,h)=gh$はBook A版への反例であり、この追加条件を持つP1版を単独で反証するものではない。

ただし、P1版はBook A版と別の定理として、仮定の観測可能性、関数クラス、証明、適用領域を独立に再検証するまで投稿根拠に用いない。BOOK_DECISIONS.md D-062も同じ立場を採る:「P1旧稿は投稿可能稿として扱わない。P1固有の追加条件を持つ定理は、この反例だけで偽とは断定せず、Book A版と別の定理として仮定、証明、適用領域を独立に再検証する」。論文全体は測定論と前向き検証を中核に再設計する。$body$,
  'BZM_2_0_REVISION_REQUIREMENTS.md#41-二層非可換性定理を撤回する; BOOK_DECISIONS.md#d-062',
  'seed', 'seed', 'seed'
),
(
  'concept-ecr-three-layers',
  'ECRを三つの測定層(自前ストック・実効サービス・流量成果)へ分ける',
  'concept', 'institution', 'design-choice',
  '現行ECRは機関が自前で保有する制度と装置の診断として残しつつ、機関能力を自前ストック・実効サービス・流量成果の三層に分けて表示する。ECR表示にはcoverage、confidence、evidence freshness、評価者間一致を付け、機関間の単一順位は作らない。',
  $body$## 内容

現行ECRは、機関が自前で保有する制度と装置の診断として残す。機関能力は、次の三層を別々に表示する。

1. 自前ストック:規程、人員、予算、雛形、ファンド。
2. 実効サービス:外部連携を含む利用可能性、権限、費用、応答期限、継続条件。
3. 流量成果:処理時間、完了率、滞留、差戻し、事故、研究者負荷。

ECR表示には、値だけでなくcoverage、confidence、evidence freshness、評価者間一致を付ける。機関間の単一順位は作らない。

大学技術移転のパネル研究(Sallan & Lordan)は、TTO資源の保有だけでなく経験学習と開示経験を分けて調べており、自前ストックと運用成果を同一視しない考え方の参考になる。ただし、この研究はBZMの三層区分や各軸を直接検証したものではない。ECRは3機関・7スナップショットを持つが、同一時点の独立した複数評価者による採点はまだなく、成果妥当性は現時点で確認できていない。$body$,
  'BZM_2_0_REVISION_REQUIREMENTS.md#51-ecrを三つの測定層へ分ける',
  'seed', 'seed', 'seed'
),
(
  'concept-measurement-separation-principle',
  '測定分離原則',
  'concept', 'cross-layer', 'design-choice',
  '案件順位と機関順位を一つの総合順位へ単純合成しない。案件の現在状態と、機関が次期状態へ与える効果を分けて記録し、機関条件が案件の将来到達へ与える効果は遷移モデルの交互作用として検証する。旧・二層非可換性定理を測定分離原則へ置き換える。',
  $body$## 内容

BZM 2.0では、「二層非可換性定理」を測定分離原則へ変更する。測定分離原則は、次の運用規律を定める。

- 案件順位と機関順位を一つの総合順位へ単純合成しない。
- 機関条件が案件の将来到達へ与える効果は、遷移モデルの交互作用として検証する。
- 数学的な禁止を主張する場合は、対象とする関数クラスと成立条件を明記する。

この原則を支える理由は不可能性定理ではなく測定目的の違いにある。案件診断は特定案件の証拠・弱い条件・次の検証を扱い、機関診断は複数案件へ反復して提供できる制度・サービス・処理能力を扱う。二つを合成すると、案件構成の差を機関能力として読んだり、機関の過去の貢献を案件側と機関側で二重に数えたりする危険がある。

機関条件$A_t$が案件状態$x_t$の次期遷移へどう効くかは、現在のSPSへECRを掛けて決める問題ではなく、時点を固定した前向きデータで、遷移速度・完了率・事故・研究者負荷への効果として確かめる問題である。

$$x_{t+1}=T(x_t,A_t,u_t,\varepsilon_t)$$

Simpson反転の数値例(架空データ)は、集計の向きを変えただけで機関間の優劣が入れ替わりうることを示し、合成スコアを機関の力の証拠として使えない根拠になる。$body$,
  'BZM_2_0_REVISION_REQUIREMENTS.md#41-二層非可換性定理を撤回する; book-a-ch-12.md#113-機関は案件を救えるか',
  'seed', 'seed', 'seed'
),
(
  'concept-phi-gh-counterexample',
  '反例関数 Φ(g,h)=gh',
  'concept', 'cross-layer', 'established',
  'Φ(g,h)=ghは∂Φ/∂h=gを持ち、g=0の境界で機関感応度がゼロ、g>0の内部で正となる。これは旧・二層非可換性定理(Book A版)の公理A1〜A4を同時に満たす単調関数であり、旧定理の反例になる。',
  $body$## 内容

$$\Phi(g,h)=gh$$

$$\frac{\partial\Phi}{\partial h}=g$$

この関数では、$g=0$の境界で機関感応度がゼロとなり、$g>0$の内部で正となる。したがって、現行の公理と証明から不可能性は導けない。

ただし、$\Phi(g,h)=gh$はBook A版への反例であり、P1論文草稿が置く追加条件(案件段階による機関比較の反転、残り道程による案件比較の反転)を持つP1版を単独で反証するものではない。この区別により、旧定理の撤回とP1版の再検証要求は別の帰結として扱う。$body$,
  'BZM_2_0_REVISION_REQUIREMENTS.md#41-二層非可換性定理を撤回する; book-a-ch-12.md#113-機関は案件を救えるか',
  'seed', 'seed', 'seed'
),
(
  'concept-prospective-case-registration',
  '前向き検証(全案件の連続登録と事前固定)',
  'concept', 'evidence', 'design-choice',
  '全スクリーニング案件を連続登録し、採択・不採択・記録不足・WAIT・NO_GOを分母から落とさない。モデル版、採点規約、重み、欠測処理、アウトカム、観測期間を事前に固定し、結果を知らない独立した二名以上が判定時点までの資料だけで採点する。',
  $body$## 内容

全スクリーニング案件を連続登録する。採択、不採択、記録不足、WAIT、NO_GOを分母から落とさない。モデル版、採点規約、重み、欠測処理、アウトカム、観測期間を事前に固定する。

結果を知らない独立した二名以上が、判定時点までの資料だけで採点する。軸ごとの一致率を報告し、協議後の点数だけを残さない。

現行SPSは、基礎発生率、TRL単独、専門家判断、単純加法、readinessの最小値と比較し、校正曲線、基礎発生率に対するBrier Skill Score、log-loss、順位安定性、意思決定純便益を分けて報告する。理論と証拠を結び付ける起業家教育の無作為化比較試験(Camuffo et al.)は、理論を捨てるのではなく検証可能な仮説と観察へ接続する方向を支持しており、この前向き検証設計を支える先行研究になる。

90日の実行順では、独立再採点の実施、前向き案件登録の開始、AMD介入ログの開始が挙げられている。データ蓄積後、競合リスク・因果推論・状態空間・ポートフォリオ最適化は必要な事象数と独立評価が得られてから導入する。$body$,
  'BZM_2_0_REVISION_REQUIREMENTS.md#81-登録と時点固定; BZM_2_0_REVISION_REQUIREMENTS.md#82-採点信頼性',
  'seed', 'seed', 'seed'
),
(
  'concept-six-layer-structure',
  'BZM 2.0の六層構造(証拠台帳・案件診断・予測・判断と介入・機関と支援者・ポートフォリオ)',
  'concept', 'cross-layer', 'design-choice',
  'BZM 2.0は出力を証拠台帳、案件診断、予測、判断と介入、機関と支援者、ポートフォリオの六層へ分離する。各層は別の出力と役割を持ち、単一の総合順位へ合成しない。',
  $body$## 内容

現行文書には、観測モデル、診断指数、予測モデル、意思決定則、介入仮説が同じ「モデル」として記述されている箇所があり、この混同がSPSを期待価値、式上の感度を行動優先度、GO後の介入効果を予測精度として読ませる危険を生んでいた。

BZM 2.0はこれを次の六層へ分ける。

| 層 | 出力 | 役割 |
|---|---|---|
| 証拠台帳 | 値、範囲、出典、時点、評価者、鮮度、機密性 | 観測事実と欠測状態を残す |
| 案件診断 | M、P、R、資金、権利、人、選択肢のプロファイル | 弱い条件と不確実性を見つける |
| 予測 | 事象と期間ごとの確率または範囲 | 有償証拠、技術統合、資金接続、出口を予測する |
| 判断と介入 | GO条件、WAIT復帰条件、行動価値、権限と合意 | 何をいつ誰が行うか決める |
| 機関と支援者 | ECR三層、AMDの支援者権限・容量台帳 | 支援の供給条件と利益相反を管理する |
| ポートフォリオ | 予算、人月、相関、共通資産、撤退価値、公的目的 | 複数案件への資源配分を決める |

Pは事業天井の分布と、その推定を支える証拠の確信度へ分け、予測は一つの総合確率を作らず有償証拠・技術統合・資金接続・統制権を保った生存・各出口への遷移を分ける。判断規則は予測モデルと別に版管理する。$body$,
  'BZM_2_0_REVISION_REQUIREMENTS.md#6-bzm-20の六層構造',
  'seed', 'seed', 'seed'
),
(
  'concept-sps-ordinal-scale',
  'SPS 9軸は順序尺度であり積・比・微分に量的意味を持たせない',
  'concept', 'evidence', 'established',
  '0から9までのSPS各軸は順序尺度として扱う。順序尺度に対する積、比、微分には符号化方法から独立した量的意味がなく、『弾力性』『限界収益』『期待価値』『成功確率』という語をSPSに用いない。',
  $body$## 内容

現行実装では、9軸式と`M×P×R×S`式は代数的に同一である。`M=C_σ`、`P=C_P`、`R=C_TRL C_BRL C_GRL C_SRL C_HRL`、`S=C_FRL C_Rnet`という括弧分けであり、`1+1+5+2=9`軸を別の順序で表しているだけである。

ただし、代数的に同一であることと測定上の妥当性は別である。M、P、R、Sが現実の追い風、天井、到達、自走を正しく表すこと、異なる測定方法で得た0から9の値が通約可能であること、乗法集約が因果的な成功構造を表すことは未検証である。

0から9までの各軸は現時点では順序尺度として扱う。順序尺度に対する積、比、微分には、符号化方法から独立した量的意味がない。現行の指数は運用上維持できるが、「弾力性」「限界収益」「期待価値」「成功確率」という語を用いない。

2026-07-29時点の現行SPSについて、企業価値または期待事業価値を表す・商業化や生存や資金調達の確率を表す・案件間の点数差や点数比に経済的な間隔の意味がある・SPS順位に従う資源配分が他の配分方法より高い成果を生む・式上の感度が行動優先度と一致する、という主張はいずれも未検証である。$body$,
  'BZM_2_0_REVISION_REQUIREMENTS.md#42-spsの役割を診断へ限定する',
  'seed', 'seed', 'seed'
),
(
  'concept-survival-state-vector',
  '生存を状態ベクトルとして扱う',
  'concept', 'prediction', 'design-choice',
  '現金、moat、信用、選択肢、集中力は完全代替ではなく、月換算して単純加算した値は支払能力や存続期間を直接表さない。BZM 2.0では月次現金残高、資金トランシェ、利用可能時間、技術証拠の鮮度、顧客コミットメント期限、知財・規制の状態、残された選択肢を分離した状態として扱う。',
  $body$## 内容

現金、moat、信用、選択肢、集中力は完全代替ではない。これらを月換算して単純加算した値は、支払能力または存続期間を直接表さない。BZM 2.0では、次の状態を分離する。

- 月次現金残高と確定支払。
- 資金トランシェ、コベナンツ、希薄化。
- 研究者と経営者の利用可能時間。
- 技術証拠の鮮度と再現性。
- 顧客コミットメントの有効期限。
- 知財と規制の状態。
- 残された選択肢。

生存確率を推定する場合は、対象事象、期間、支援方針を明記する。

$$S^{\pi}(t)=\Pr(\text{対象到達が資金枯渇または撤退より先}\mid \text{時点固定状態},\pi)$$

ここで$\pi$は支援方針であり、Sを案件固有の不変値とはみなさない。$body$,
  'BZM_2_0_REVISION_REQUIREMENTS.md#46-生存を状態ベクトルとして扱う',
  'seed', 'seed', 'seed'
),
(
  'concept-time-fixed-validation-record',
  '検証用履歴を時点固定する',
  'concept', 'evidence', 'design-choice',
  '予測時点より後に確認されたPまたはR_netを過去の予測入力へ補完しない。運用画面の便宜的な補完と、検証用の時点固定データを分離する。検証用記録は判定時点・利用可能だった証拠・モデル版・採点者・判断・介入・観測期間を変更不能な一組として保存する。',
  $body$## 内容

予測時点より後に確認されたPまたはR_netを、過去の予測入力へ補完しない。運用画面の便宜的な補完と、検証用の時点固定データを分離する。

検証用記録は、次の項目を変更不能な一組として保存する。

- 判定時点。
- 利用可能だった証拠。
- モデル版、重み、欠測規則。
- 採点者と採点前の独立性。
- GO、WAIT、NO_GO、HOLDの判断。
- 判断後の介入、担当、工数、費用。
- 観測期間と結果。

2026-07-28の読み取り専用確認では、AMD Score入力107行のうちPとR_netまで揃う行は13行、92行は後日の値補完を含み将来日付の評価行も存在した。この不足は時点固定の欠如がもたらす検証不能の具体例である。$body$,
  'BZM_2_0_REVISION_REQUIREMENTS.md#47-検証用履歴を時点固定する',
  'seed', 'seed', 'seed'
),
(
  'decision-amd-stakeholder-capacity-ledger',
  'AMDを第三の主体として記録する(支援者権限・容量台帳)',
  'decision', 'institution', 'design-choice',
  '案件と機関の二層だけでは評価と介入を行うAMDの権限・利害・供給能力が消える。AMDについて総合スコアではなく支援者権限・容量台帳を置き、契約上の役割と決定権、利益相反と忌避、案件別投入工数と最大同時保有数、権限返却・移管・終了条件などを記録する。',
  $body$## 内容

案件と機関の二層だけでは、評価と介入を行うAMDの権限、利害、供給能力が消える。AMDについて、総合スコアではなく支援者権限・容量台帳を置く。

- 契約上の役割と決定権。
- 評価、営業、経営介入の利益相反と忌避。
- 案件別投入工数と最大同時保有数。
- データ、知財、ネットワークの利用権。
- 報酬、成功報酬、エクイティ。
- 権限返却、移管、終了条件。
- AMDが不在でも回る状態。

90日の実行順では、支援者権限・容量台帳の試作が挙げられている。この台帳はECR三層の実効サービス層と重なる部分を持つが、機関そのものではなく評価・介入主体であるAMD固有の利益相反と容量を分離して記録する点で異なる。$body$,
  'BZM_2_0_REVISION_REQUIREMENTS.md#52-amdを第三の主体として記録する',
  'seed', 'seed', 'seed'
),
(
  'decision-purpose-specific-go-gates',
  'GOを目的別ゲートへ変更する',
  'decision', 'decision', 'design-choice',
  '現行のマクロ追い風と有効TRLだけでは会社化または資源投入の十分条件にならない。GOは用途ごとに必要な条件(再現性・有償需要・知財・利益相反・決定権・経営機能・資金経路・選択肢の得失)を明示するゲートへ変更する。閾値を校正できていない間は二値のGOではなく条件付きGOとWAITを使う。',
  $body$## 内容

現行のマクロ追い風と有効TRLだけでは、会社化または資源投入の十分条件にならない。GOは、用途ごとに必要な条件を明示する。最低限のゲート候補は次のとおりである。

1. 技術再現性と統合可能性。
2. 有償需要または予算保有者の拘束力ある行動。
3. 知財帰属、ライセンス見通し、FTO、秘密情報管理。
4. 兼業、利益相反、規制、輸出管理。
5. 提案権、同意権、拒否権、署名権。
6. 経営機能の責任者と研究者時間。
7. 月別の資金経路と次の資金条件。
8. 会社化によって得る選択肢と失う選択肢。

閾値を校正できていない間は、二値のGOではなく`条件付きGO`とWAITを使う。NISTのTRL検討報告が指摘するとおり、TRLは主観性を持ち適用先と評価者によって変わるため、TRL単独をGOの十分条件にしない。$body$,
  'BZM_2_0_REVISION_REQUIREMENTS.md#44-goを目的別ゲートへ変更する',
  'seed', 'seed', 'seed'
),
(
  'decision-rt-staged-deal-formation',
  'RTを段階的ディール組成へ変更する',
  'decision', 'institution', 'design-choice',
  'RTは単一のネットワーク強度ではなく、法人化前後をつなぐ段階的な合意形成と契約組成として扱う。法的スポンサーと契約主体、参加者ごとの便益・負担・権限・利益相反、背景IPと成果IP、有償の実現可能性確認、会社化後の更改・移転・終了の順に証拠を記録する。二需要家・自発参加・take-or-payは全案件共通の必要条件にしない。',
  $body$## 内容

RTは、単一のネットワーク強度ではなく、法人化前後をつなぐ段階的な合意形成と契約組成として扱う。次の順に証拠を記録する。

1. 法的スポンサーと契約主体。
2. 参加者ごとの便益、負担、権限、利益相反。
3. 背景IP、成果IP、情報隔壁、公表権。
4. 有償の実現可能性確認、オプション、条件付き発注。
5. 会社化後の更改、移転、終了。

二需要家、自発参加、take-or-payは全案件共通の必要条件にしない。案件類型ごとに成立条件を定める。この設計により、RTは単一のスコアではなく段階ごとの証拠系列として扱われ、他の総合スコアと同様に一つの数へ潰さない測定分離原則の対象になる。$body$,
  'BZM_2_0_REVISION_REQUIREMENTS.md#53-rtを段階的ディール組成へ変更する',
  'seed', 'seed', 'seed'
),
(
  'decision-wait-return-conditions',
  'WAITに復帰条件・再判定日・責任者・待機中作業を持たせる',
  'decision', 'decision', 'design-choice',
  'GO・WAIT・NO_GO・HOLDを分け、WAITには復帰条件、再判定日、責任者、待機中作業を持たせる。これはBZM 1.xから2.0へ継承する維持要素であり、閾値が校正できていない目的別GOゲートの受け皿になる。',
  $body$## 内容

BZM 1.xから2.0へ継承する維持要素のうち、次の2点が本決定の根拠になる。

- `GO`、`WAIT`、`NO_GO`、`HOLD`を分ける。
- WAITに復帰条件、再判定日、責任者、待機中作業を持たせる。

閾値を校正できていない間は、二値のGOではなく`条件付きGO`とWAITを使う。WAITは単なる保留ではなく、復帰条件・再判定日・責任者・待機中作業という4要素を持つことで、判断を介入政策として運用可能にする。判断後の介入・担当・工数・費用・観測期間は、検証用履歴として時点固定で記録する。$body$,
  'BZM_2_0_REVISION_REQUIREMENTS.md#3-維持する理論要素; BZM_2_0_REVISION_REQUIREMENTS.md#44-goを目的別ゲートへ変更する',
  'seed', 'seed', 'seed'
),
(
  'measure-sps-diagnostic-index',
  'SPSは案件の診断指数であり、それ単独でGO/NO_GO/投資額/人月を決めない',
  'measure', 'evidence', 'established',
  '現行SPSは9軸の観察値を現行の符号化・重み・乗法集約規則によって束ねた診断指数である。SPS単独でGO、NO_GO、投資額、投入人月は決めない。ECRも機関成果の予測値や機関間ランキングとしては扱わない。',
  $body$## 内容

2026-07-29時点の現行SPSは、9軸の観察値を現行の符号化、重み、乗法集約規則によって束ねた診断指数である。したがってSPSは単独でGO、NO_GO、投資額、投入人月は決めない。現行ECRも、機関成果の予測値または機関間ランキングとしては扱わない。

$$\mathrm{SPS} = K \cdot \prod_{i=1}^{9} (X_i+1)^{\alpha_i}$$

乗法集約は、技術・顧客・制度・人のどれか一つが弱ければ全体を抑える律速構造を表すために採用された設計上の仮定である。ECRの加重和とは異なる演算だが、その違いが対象の現実的な性質を正確に写像していることや、乗法が他の集約規則より高い予測・判断性能を持つことは未検証である。$body$,
  'BZM_2_0_REVISION_REQUIREMENTS.md#2-現行bzmの主張境界',
  'seed', 'seed', 'seed'
),
(
  'question-portfolio-allocation-method-unknown',
  'ポートフォリオ資源配分方式は未確定(unknown)',
  'question', 'portfolio', 'unknown',
  'SPS順位に従う資源配分が他の配分方法より高い成果を生むかは未検証であり、競合リスク・因果推論・状態空間・ポートフォリオ最適化を含む配分方式はデータ基盤(必要な事象数と独立評価)が整うまで導入しない。ポートフォリオ層の出力(予算・人月・相関・共通資産・撤退価値・公的目的)自体は六層構造に定義済みだが、配分アルゴリズムはunknownの状態にある。',
  $body$## 内容

現行SPSについて、「SPS順位に従う資源配分が、他の配分方法より高い成果を生む」という主張はまだ検証されていない。

競合リスク、因果推論、状態空間、ポートフォリオ最適化は、必要な事象数と独立評価が得られた後に導入する。データ基盤より先に数理を複雑化しない。

六層構造のポートフォリオ層は、予算、人月、相関、共通資産、撤退価値、公的目的という出力の形は定義されているが、その配分アルゴリズムや最適化手法は、前向き案件登録とAMD介入ログの蓄積後にはじめて設計対象になる。現時点では`unknown`として扱い、`not_started`(まだ着手していない)と区別する。$body$,
  'BZM_2_0_REVISION_REQUIREMENTS.md#2-現行bzmの主張境界; BZM_2_0_REVISION_REQUIREMENTS.md#データ蓄積後',
  'seed', 'seed', 'seed'
),
(
  'source-camuffo-theory-of-value-rct',
  'Camuffo et al. — Theory-of-Value RCT(タンザニア起業家)',
  'source', 'evidence', 'established',
  '理論と証拠を結び付ける起業家教育の無作為化比較試験は、理論を捨てるのではなく、検証可能な仮説と観察へ接続する方向を支持している。BZM 2.0の前向き検証設計を支える外部的根拠になる。',
  $body$## 内容

Camuffo, A. et al., *Does a Theory-of-Value Add Value? Evidence from a Randomized Control Trial with Tanzanian Entrepreneurs*, Organization Science, https://doi.org/10.1287/orsc.2023.17590 。

理論と証拠を結び付ける起業家教育の無作為化比較試験は、理論を捨てるのではなく、検証可能な仮説と観察へ接続する方向を支持する。

BZM 2.0が採用する前向き案件登録・時点固定・事前コミット・独立採点という検証計画は、この研究が示す「理論仮説を無作為化試験で検証可能な形に落とす」という方針の延長線上にある。$body$,
  'BZM_2_0_REVISION_REQUIREMENTS.md#12-参考資料 [^tov]',
  'seed', 'seed', 'seed'
),
(
  'source-jrc-composite-indicator-sensitivity',
  'JRC複合指標ハンドブック — 感度分析(Step 8)',
  'source', 'evidence', 'established',
  'European Commission Joint Research Centreは、正規化・欠測・重み・集約方式が複合指標の結論を大きく左右し得るため、不確実性分析と感度分析を併用するよう示している。これはSPS自体を検証する文献ではなく、集約結果を仮定に依存しない確定値として扱うことへの警告になる。',
  $body$## 内容

European Commission Joint Research Centre, *Step 8: Sensitivity analysis* (2020年更新)。

JRCは、正規化、欠測、重み、集約方式が複合指標の結論を大きく左右し得るため、不確実性分析と感度分析を併用するよう示している。順位は一点ではなく、仮定を変えたときの範囲として表示する、というBZM 2.0の運用規律の外部的根拠になる。

OECD & JRC (2008) *Handbook on Constructing Composite Indicators: Methodology and User Guide*は複合指標の作り方の実務標準であり、集約の危うさへの警告も同書自身に書かれている。作る技術は実務として完成している一方、指標が何を失い、どの仮定に依存するかは配分の会議室で省略されやすいという非対称性を、本書は指摘の起点にしている。$body$,
  'BZM_2_0_REVISION_REQUIREMENTS.md#85-感度分析 [^jrc]; book-a-ch-12.md#111-一つの数への誘惑',
  'seed', 'seed', 'seed'
),
(
  'source-nist-trl-limitations',
  'NIST TRL検討報告 — TRLの限界',
  'source', 'evidence', 'established',
  'NISTのTRL検討報告は、TRLが主観性を持ち、適用先と評価者によって変わり、段階間の費用と時間が比例せず、市場需要や利益率を扱わないと整理している。TRL単独をGOの十分条件にしないBZM 2.0の目的別ゲート設計の外部的根拠になる。',
  $body$## 内容

Marvel, J. et al., *Technology Readiness Levels for Randomized Bin Picking*, NISTIR 7876, 2012。

NISTのTRL検討報告は、TRLが主観性を持ち、適用先と評価者によって変わり、段階間の費用と時間が比例せず、市場需要や利益率を扱わないと整理している。

BZM 2.0が「現行のマクロ追い風と有効TRLだけでは、会社化または資源投入の十分条件にならない」としてGOを目的別ゲートへ変更する判断は、このTRL限界の指摘と整合する。$body$,
  'BZM_2_0_REVISION_REQUIREMENTS.md#12-参考資料 [^nist]',
  'seed', 'seed', 'seed'
),
(
  'source-tto-panel-experiential-learning',
  'Sallan & Lordan — 大学TTOパネル研究(経験学習と開示経験)',
  'source', 'institution', 'established',
  '大学技術移転のパネル研究は、TTO資源の保有だけでなく経験学習と開示経験を分けて調べている。自前ストックと運用成果を同一視しない考え方の参考になるが、BZMの三層区分や各軸を直接検証した文献ではない。',
  $body$## 内容

Sallan, J. M. and Lordan, O., *University technology transfer: leveraging experiential learning and TTO's resources*, Small Business Economics, 2024, https://doi.org/10.1007/s11187-024-00899-y 。

大学技術移転のパネル研究は、TTO資源の保有だけでなく、経験学習と開示経験を分けて調べている。

これは、機関の「自前ストック」(規程・人員・予算・ファンドの保有)と「流量成果」(処理時間・完了率・研究者負荷などの実際の運用実績)を同一視しない考え方の参考になる。保有量だけを見るスコアは経験学習という別の変数を見落とし得るが、この研究からBZM固有の三層区分の妥当性や因果効果までは導けない。$body$,
  'BZM_2_0_REVISION_REQUIREMENTS.md#12-参考資料 [^tto]',
  'seed', 'seed', 'seed'
)
ON CONFLICT (id) DO NOTHING;

-- -------------------------------------------------------------------------
-- Seed: 34 relations from pwa/bzm/theory-graph/*.md front matter
-- -------------------------------------------------------------------------

INSERT INTO public.bzm_theory_edges (from_node_id, relation_type, to_node_id, created_by)
VALUES
  ('claim-action-value-formula', 'depends_on', 'concept-sps-ordinal-scale', 'seed'),
  ('claim-action-value-formula', 'challenges', 'measure-sps-diagnostic-index', 'seed'),
  ('claim-old-two-layer-noncommutativity-theorem', 'depends_on', 'measure-sps-diagnostic-index', 'seed'),
  ('claim-old-two-layer-noncommutativity-theorem', 'depends_on', 'concept-ecr-three-layers', 'seed'),
  ('claim-p1-conditional-theorem', 'depends_on', 'concept-phi-gh-counterexample', 'seed'),
  ('claim-p1-conditional-theorem', 'depends_on', 'claim-old-two-layer-noncommutativity-theorem', 'seed'),
  ('concept-ecr-three-layers', 'defines', 'decision-amd-stakeholder-capacity-ledger', 'seed'),
  ('concept-measurement-separation-principle', 'supersedes', 'claim-old-two-layer-noncommutativity-theorem', 'seed'),
  ('concept-measurement-separation-principle', 'defines', 'decision-purpose-specific-go-gates', 'seed'),
  ('concept-phi-gh-counterexample', 'refutes', 'claim-old-two-layer-noncommutativity-theorem', 'seed'),
  ('concept-prospective-case-registration', 'operationalizes', 'concept-time-fixed-validation-record', 'seed'),
  ('concept-prospective-case-registration', 'tests', 'decision-purpose-specific-go-gates', 'seed'),
  ('concept-six-layer-structure', 'defines', 'concept-measurement-separation-principle', 'seed'),
  ('concept-six-layer-structure', 'defines', 'concept-ecr-three-layers', 'seed'),
  ('concept-sps-ordinal-scale', 'defines', 'measure-sps-diagnostic-index', 'seed'),
  ('concept-survival-state-vector', 'supports', 'decision-wait-return-conditions', 'seed'),
  ('concept-survival-state-vector', 'depends_on', 'concept-time-fixed-validation-record', 'seed'),
  ('concept-time-fixed-validation-record', 'supports', 'concept-prospective-case-registration', 'seed'),
  ('concept-time-fixed-validation-record', 'tests', 'measure-sps-diagnostic-index', 'seed'),
  ('decision-amd-stakeholder-capacity-ledger', 'depends_on', 'concept-ecr-three-layers', 'seed'),
  ('decision-amd-stakeholder-capacity-ledger', 'supports', 'decision-rt-staged-deal-formation', 'seed'),
  ('decision-purpose-specific-go-gates', 'operationalizes', 'concept-measurement-separation-principle', 'seed'),
  ('decision-purpose-specific-go-gates', 'depends_on', 'decision-wait-return-conditions', 'seed'),
  ('decision-rt-staged-deal-formation', 'depends_on', 'decision-amd-stakeholder-capacity-ledger', 'seed'),
  ('decision-rt-staged-deal-formation', 'operationalizes', 'concept-measurement-separation-principle', 'seed'),
  ('decision-wait-return-conditions', 'supports', 'decision-purpose-specific-go-gates', 'seed'),
  ('decision-wait-return-conditions', 'depends_on', 'concept-time-fixed-validation-record', 'seed'),
  ('measure-sps-diagnostic-index', 'depends_on', 'concept-sps-ordinal-scale', 'seed'),
  ('question-portfolio-allocation-method-unknown', 'depends_on', 'concept-ecr-three-layers', 'seed'),
  ('question-portfolio-allocation-method-unknown', 'depends_on', 'concept-prospective-case-registration', 'seed'),
  ('source-camuffo-theory-of-value-rct', 'supports', 'concept-prospective-case-registration', 'seed'),
  ('source-jrc-composite-indicator-sensitivity', 'challenges', 'measure-sps-diagnostic-index', 'seed'),
  ('source-nist-trl-limitations', 'supports', 'decision-purpose-specific-go-gates', 'seed'),
  ('source-tto-panel-experiential-learning', 'supports', 'concept-ecr-three-layers', 'seed')
ON CONFLICT (from_node_id, relation_type, to_node_id) DO NOTHING;
