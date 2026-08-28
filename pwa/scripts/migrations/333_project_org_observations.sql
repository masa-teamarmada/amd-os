-- 人・組織の観測ログ。PJコックピット「スコア詳細」タブの《組織》セクションの正本。
--
-- まさ 2026-08-28「SXの経営ハイライトに、杉浦先生の対人の壁の話が書かれちゃってる。
-- これどうみても経営ハイライトじゃなくない？ こういうのを経営ハイライトに書かないでほしい。
-- 一方で、こういう情報はSPSのスコアリングに必須なので、スコア詳細タブの中に『組織』の
-- コーナーを作って、そこにこういう情報を入れておこうよ。メンバーリスト（SU設立後なら組織図）とあわせて。」
--
-- 経営ハイライト（project_strategy_signals）は「進んだこと・起きたこと」＝日付を持つ事象の棚。
-- 人の恒常的な性質・経営チームの構成・担い手の質は事象ではないので、そちらへ入れない。
-- 行き場が無かったために経営ハイライトへ流れていたものを、ここへ移す。
--
-- 様式はモデル正本 model/MODEL_VERSION_LEDGER.md §6.C-1（観測→状態の登録簿。事象1件が1行）に合わせ、
-- 種類は §6.C-2 の24種のうち「人・組織」の3種（15・16・17）だけを受ける。
-- 残り21種は資金・権利・検証など別の棚の担当なので、ここでは扱わない。
--
-- 効き先: 機能の充足（§6.B-2）と、空席の機能への実働だけが案件パラメータ（$e$ など）へ。
-- 充足の判定そのものはこのテーブルの行から機械的に導出する（§6.B-2 の直近性・複数時点・証拠の下限）。
-- 「誰が何の役職か」を人が宣言して充足にしない——正本が肩書・名義・意思表明を根拠から外しているため。

CREATE TABLE IF NOT EXISTS project_org_observations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,

  -- 出来事の日付。記録した日ではない（§6.C-1）。
  observed_on DATE NOT NULL,

  -- 種類。モデル §6.C-2 の「人・組織」3種。
  --   staffing  = 種類15 人の着任・退任・実働の記録
  --   departure = 種類16 人の異動・定年・卒業の判明
  --   structure = 種類17 研究室・組織の体制変化
  kind TEXT NOT NULL CHECK (kind IN ('staffing', 'departure', 'structure')),

  -- 誰の話か。組織全体・体制の話なら NULL。
  person_name TEXT,

  -- 経営チームの八機能（モデル §6.B-1 の $\mathcal F$）のどれに効くか。1〜8。
  -- 機能に紐づかない体制の話は NULL。機能の一覧そのものは正本から読むので、ここには番号だけ置く。
  function_no SMALLINT CHECK (function_no BETWEEN 1 AND 8),

  -- 一覧に出す1〜2文の要旨（§6.C-1「固有名詞を含む事実」）。
  headline TEXT NOT NULL,
  -- 背景・経緯。読まなくても一覧が成立する分量に留める。
  detail TEXT,

  -- 出所タグ（§6.C-1）。masa = まさの口頭の観察（第三者記録ではないので確信度は下げて扱う）。
  source_tag TEXT NOT NULL CHECK (source_tag IN ('document', 'interview', 'third_party', 'public', 'masa')),
  source_ref TEXT,

  -- 効き先（§6.C-1「効き先の型」）。どのスコアの入力を動かす観測なのかを日本語で書く。
  effect TEXT,

  -- 観測の向き。**モデル正本にはまだ無い拡張**。
  -- 正本の充足判定は「実働の記録があるか」だけを見て質を見ないので、
  -- 「対外説明の主体として動いたが相手の判断を悪い方へ動かした」のような負の観測を表現できない。
  -- 負の観測を機能の充足判定へ効かせる規則は別途モデル側で検討中のため、
  -- ここでは記録して画面に出すだけにし、充足の判定には使わない（negative の行は充足へ数えない）。
  direction TEXT NOT NULL DEFAULT 'neutral' CHECK (direction IN ('positive', 'negative', 'neutral')),

  -- どのモデル版の機能番号として書いたか。§6.B-1 は粒度が変われば係数の再較正を伴う版更新になるので、
  -- 版が変わったときに番号の読み替えが要る行を特定できるようにする。
  model_version TEXT NOT NULL DEFAULT 'bzm-3.0',

  recorded_by TEXT NOT NULL DEFAULT 'amie',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_org_observations_project_date
  ON project_org_observations(project_id, observed_on DESC);
CREATE INDEX IF NOT EXISTS idx_project_org_observations_function
  ON project_org_observations(project_id, function_no, observed_on DESC);

-- 個人の評価を含むので、外部ワークスペースへは出さない（まさ 2026-08-28「外部には見せないよ、
-- スコア詳細タブの中にあるし」）。anon の SELECT を作らず、member 以上に限る。
ALTER TABLE project_org_observations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS project_org_observations_member_read ON project_org_observations;
CREATE POLICY project_org_observations_member_read ON project_org_observations
  FOR SELECT TO authenticated USING (amd_os_is_member());
DROP POLICY IF EXISTS project_org_observations_admin_all ON project_org_observations;
CREATE POLICY project_org_observations_admin_all ON project_org_observations
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS project_org_observations_service_role ON project_org_observations;
CREATE POLICY project_org_observations_service_role ON project_org_observations
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
