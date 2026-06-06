# AMD Score 実装 — Before Zero Theory v3.2

作成: 2026-05-07 (blissful-kepler-9e95b0 セッション)
正本ステータス: 進化中。仕様変更したらここを同じ commit で更新する。

> **manual / spec / bzm 3層分割中**: FRL CES の実装仕様は `/spec/4-1-frl-ces-current-spec.md`、AMD Score 全体契約は `/spec/4-2-amd-score-current-spec.md` へ移行済み。AMD Score の設計議論・履歴は、この `design/amd_score.md` も引き続き残す。理論導出は `/bzm`、画面の読み方は `/manual` に置く。

---

## ⚠️ 既存 UI を勝手に消すな (再掲)

新セッションのえいみ / Claude が一番先に読むべきこと、は `2026-05_pj_status_cockpit.md` 冒頭と同じ:

- 既存ページのリンク・ボタン・セクションを「自分の判断で消す」のは絶対禁止
- 既存 UI が壊れた / 消えたとまさが指摘したら、まず `git log -p -S` で履歴を遡って復元
- 確認できないラベルや飛び先は、まさに聞いてから実装する

---

## 何を解いたか

`/venture-map/amd-score` (一覧) + `/venture-map/amd-score/[projectId]` (個別) を作って、
Before Zero Theory v3.2 の **AMD Score (7 軸 Cobb-Douglas 統合指標)** を AMD OS に実装した。
cockpit の AMD スコアチップ・経時グラフ・breakdown モーダルも新ロジックに置き換え。

理論正本: [`/Users/masa/projects/AMD/before-zero/theory/amd_score.md`](../../../before-zero/theory/amd_score.md)

---

## 数式 (要約)

```
AMD Score = K · Π (X_i + 1)^α_i      X = {σ_SU, TRL, BRL, GRL, SRL, HRL, FRL}
σ_SU      = ((μ_A+1)(μ_I+1)(μ_G+1))^(1/3) - 1     (Triple Helix CD)
K         = 100,000 / 10^Σα                       (全軸 9 で IPO 級 100,000 に校正)
```

Shallow Tech モード (TRL=null) は TRL 軸を計算から除外、6 軸 + K 再校正。

### UI 表示構造 (3 大要素)

理論層は 7 軸 1 つの ∏ だが、UI では「マクロ M × 会社の XRL X × CEO の FRL F」の **3 大要素**で見せる:

```
S = k · M · X · F                 (k = 100,000 / 10^Σα、小文字で定数感)
M = (σ_SU+1)^α_σ                  外部環境 (Triple Helix: 学術 μ_A × 産業 μ_I × 政府 μ_G)
X = ∏_{x ∈ {TRL,BRL,GRL,SRL,HRL}} (x+1)^α_x   会社に帰属する 5 軸 readiness
F = (FRL+1)^α_F                   個人に帰属する CEO リーダーシップ (ALQ ベース)
```

哲学 (まさ言語化): 「マクロトレンドの流れがあって、会社の XRL が整っていて、それを FRL 高い CEO が牽引する」。

**FRL を XRL の積に呑み込まない** (理論層 §5: FRL/σ_SU 合計 α=2.8 が AMD スタジオ哲学の支柱、α_F=1.5 は他 5 XRL とは別格の重み)。

### 律速判定 (Marginal Sensitivity)

```
∂S/∂X_i  =  α_i · S / (X_i + 1)
bottleneck  =  argmax_i  α_i / (X_i + 1)
```

「1 段階上げたとき S が最も大きく増える軸」が律速 = 経営アクションで最初に手当てすべき軸。

旧実装 (~2026-05-09) は `argmin(contribution share)` で「α が小さい軸が常に律速」になる退化バグがあり、α_SRL=0.2 が default 最小なため SRL が常に律速マークされる回帰があった。Cobb & Douglas (1928), AER, 18(1) の偏微分定義に揃えて修正済み。

### Base case alpha (Σα = 6.0, K = 0.1)

| 軸 | α | 根拠 |
|---|---|---|
| FRL | 1.5 | Bernstein 2017 JF (Founder Quality が VC 意思決定の最大因子) |
| σ_SU | 1.3 | まさ判断「マクロに乗ってないと成功確率低い」 |
| HRL | 1.1 | 内閣府 SIP「HRL > TRL/BRL」 |
| TRL | 1.0 | Deeptech 中核だが「他から取り入れていい」 |
| BRL | 0.6 | Lean Startup 系 |
| GRL | 0.3 | Deeptech では遅効的 (5-10 年) |
| SRL | 0.2 | 一般受容、σ_SU と一部重複 |

### フェーズ閾値 (UI では一旦非表示、2026-05-09)

| score | フェーズ |
|---|---|
| 0-30 | seed_watch (シーズ察知) |
| 30-300 | seed_emerging (GAP ファンド検討) |
| 300-1,500 | pre_launch (立ち上げ準備期) |
| 1,500-3,500 | launch_prep (設立準備スタート) |
| 3,500-15,000 | launch_go (設立判定 GO) |
| 15,000-50,000 | scale (シリーズ A/B) |
| 50,000-100,000 | graduation (IPO/卒業) |

**UI 上は非表示**: 現状実証データが少なくスコアレベルとフェーズ判定の精度が不十分なため、コックピット PJ Status / AMD Score 詳細ページ / Score 一覧 / breakdown モーダルの全箇所で **フェーズタブ・色付け・フィルタを非表示**にしている (まさ判断 2026-05-09)。`classifyPhase` / `PHASE_LABEL_JP` / `PHASE_COLOR` 自体は LLM context (Tsukuyomi chat) で内部利用するため残す。検証データが揃ったら復活検討。

---

## 実装

### コード

| ファイル | 内容 |
|---|---|
| [`src/lib/amd-score.ts`](../src/lib/amd-score.ts) | `calculateAmdScore` / `computeSigmaSU` / `computeK` / `classifyPhase` / `ALPHA_DEFAULT` |
| [`src/lib/amd-score-data.ts`](../src/lib/amd-score-data.ts) | `fetchAllAmdScoreInputs` / `fetchAmdScoreInputs(pj)` / `upsertAmdScoreInput` / `fetchActiveAlpha` / `saveNewAlpha` |
| [`src/components/venture-map/AmdScoreView.tsx`](../src/components/venture-map/AmdScoreView.tsx) | 個別 PJ ビュー (hero / radar / 寄与表 / 経時 / 入力編集 / α サイドバー) |
| [`src/components/venture-map/AmdScoreList.tsx`](../src/components/venture-map/AmdScoreList.tsx) | 全 SU PJ 一覧 (score 降順 / phase filter) |
| [`src/app/(app)/venture-map/amd-score/page.tsx`](../src/app/(app)/venture-map/amd-score/page.tsx) | List ページ (server) |
| [`src/app/(app)/venture-map/amd-score/[projectId]/page.tsx`](../src/app/(app)/venture-map/amd-score/[projectId]/page.tsx) | View ページ (server) |

### Cockpit 連携

- `CockpitVentureStatus.tsx` が amd_score_inputs + active alpha を fetch
- AMD スコア経時グラフは log scale (1 → 100,000)
- スコアチップは「AMD: <score>」のみ (フェーズ名・色は非表示、2026-05-09)
- breakdown モーダルは **3 大要素 M × X × F カード**で内訳表示 + 詳細編集ページへの link
- モーダル冒頭に 3 つの式 (M / X / F) と律速の経済学的根拠 (∂S/∂X = α·S/(X+1)) を引用文献つきで掲載
- 「7 軸を編集 →」リンク、未評価時は「AMD: 未評価 →」link
- events ドットは annotation として残し、score 線上の最近点に置く

### Supabase

migration:
- [`pwa/scripts/migrations/013_amd_score.sql`](../scripts/migrations/013_amd_score.sql) (本番適用済 2026-05-06) — 7 軸の生値
- [`pwa/scripts/migrations/015_amd_score_frl_alq.sql`](../scripts/migrations/015_amd_score_frl_alq.sql) (本番適用済 2026-05-07) — FRL ALQ 4 次元 + frl_notes
- [`pwa/scripts/migrations/030_amd_score_axis_notes.sql`](../scripts/migrations/030_amd_score_axis_notes.sql) (本番適用済 2026-05-09) — `mu_notes` (JSONB: a/i/g) と `xrl_notes` (JSONB: trl/brl/grl/srl/hrl) を追加。**各軸の値の根拠**を保存・表示するための拡張
- [`pwa/scripts/migrations/031_amd_score_frl_grit_resilience.sql`](../scripts/migrations/031_amd_score_frl_grit_resilience.sql) (本番適用済 2026-05-09) — FRL を 6 因子 (ALQ 4 + Grit + Resilience) に拡張。`frl_grit` (Duckworth 2007) と `frl_resilience` (Markman 2005) を追加
- `110_amd_score_frl_capability_ces` (本番適用済 2026-05-30) — FRL 2 レイヤー化。`frl_cap` / `frl_cap_amd` / `frl_cap_notes` / `frl_ces_a` / `frl_ces_rho` を追加。詳細仕様は [`pwa/spec/4-1-frl-ces-current-spec.md`](../spec/4-1-frl-ces-current-spec.md)
- [`pwa/scripts/migrations/111_frl_cap_amd_active_projects.sql`](../scripts/migrations/111_frl_cap_amd_active_projects.sql) (本番適用済 2026-05-31) — active/current 4 PJ (CTB/LST/CX/SX) の AMD メンバー紐付けと `frl_cap_amd` first pass backfill

```
amd_score_inputs (project_id FK projects, evaluated_at, mu_A/I/G + 5 XRL + FRL, shallow_tech_mode)
  UNIQUE(project_id, evaluated_at)
  ALQ 4 次元 + frl_notes (FRL 内訳・自由備考)
  frl_cap / frl_cap_amd / frl_cap_notes / frl_ces_a / frl_ces_rho
  mu_notes  JSONB {a, i, g}              -- Triple Helix μ_A/I/G の評価根拠
  xrl_notes JSONB {trl, brl, grl, srl, hrl} -- 5 XRL の評価根拠
amd_score_alpha (alpha jsonb, effective_from / effective_to)
  base case を 1 行 seed
8 PJ の retrofit データを seed (tiem ×2 / bwe / cx / sx / ctb / yd / jc)
  ID mapping (008): tiem→p03, bwe→p11, jc→p09, ctb→p06, cx→p20, sx→p21, yd→p18
```

### 各軸の評価根拠 (notes) — 2026-05-09 追加

まさフィードバック「XRL / μ / FRL の値の根拠が UI で見たい」に対応:

- **入力 (詳細ページ)**: `AmdScoreView.tsx` の `AxisSliderWithNote` で各軸スライダーの直下に textarea で根拠を入力
- **読み取り (詳細ページ)**: `Factor3Breakdown` の 3 要素カード内で各軸ラベル直下に italic で根拠表示 (リアルタイム反映)
- **読み取り (Cockpit モーダル)**: `CockpitAmdScoreBreakdownModal.tsx` の `FactorRow` の `subtitle` で同じく italic で根拠表示
- **Tsukuyomi 統合**: `update_amd_score_input` tool に `mu_notes_a/i/g` `xrl_notes_trl/brl/grl/srl/hrl` パラメータ追加。LLM がスコアを更新するときに**値だけでなく必ず根拠も書く**運用

### 詳細ページのレイアウト (2026-05-09 改修 後期)

最終レイアウト:
```
ヘッダ (← 一覧 / コックピットリンク / α retrofit へのリンク)
案内バー (値の修正は Tsukuyomi 経由)
ScoreHeroCard          (S 値、log バー、律速軸ラベル、K/Σα/σ_SU、lane)
BalanceBar             (3 要素 M/X/F の raw contribution signal。M は理論最大値を置かない)
FormulaPanel           (全体式 + 3 要素式 + 律速の経済学的根拠 + 各式の引用文献)
Factor3Breakdown       (3 要素カード — 各軸クリックで Tsukuyomi 起動)
TimeSeriesChart        (経時 line chart)
FrlAlqPanel            (FRL 6 因子表示 + ALQ radar — 各因子クリックで Tsukuyomi 起動)
```

削除したもの:
- **RadarChart (寄与度シェア)**: α が大きい軸ほど大きく見える構造的偏りで情報量低い (まさフィードバック 2026-05-09)
- **ContributionTable (旧)**: Factor3Breakdown で同等以上の情報を提供
- **InputEditor (スライダー入力 + textarea)**: スライダーぽちぽち入力は使われない、Tsukuyomi 経由に転換 (まさ判断 2026-05-09)
- **AlphaSidebar**: α は重要パラメータで日常 UI に出さない、retrofit 別ページに移設 (まさ判断 2026-05-09)

各式の引用文献を `FormulaPanel` 内に小さく表示:
- 全体式: Cobb &amp; Douglas (1928), American Economic Review
- M (Triple Helix): Etzkowitz &amp; Leydesdorff (2000), Research Policy
- X (5 XRL): Mankins (1995) NASA TRL + 内閣府 SIP 公募要領 (令和 5) + EU H2020 SRL
- F (FRL 6 因子): Bernstein 2017 JF / Walumbwa 2008 JoM / Duckworth 2007 JPSP / Markman 2005 JOB / Hsu 2007 RP

#### M/X/F Dashboard Copy Rule (2026-05-17)

- `/hud/dashboard` の Project Signal Board に出す M/X/F 数値は、AMD Score 詳細ページの `BalanceBar` と同じ「今日以前の最新評価行」からコピーする。
- ダッシュボード側で future / retrofit row を拾わない。詳細ページと同じく `evaluated_at <= today` の最新行を使う。
- M は Macrotrend raw contribution であり、理論最大値を置かない。`10^α_sigma` で割った達成率にしない。
- X/F も表示値は raw contribution。バー幅だけ、画面内で比較しやすい表示スケールにしてよい。
- 例: SX の詳細ページで `M=12.44, X=206, F=18.12` なら、HUD dashboard のPJ rowも同じ数値を表示する。`M=79` や `M=15.71` のような再計算値は出さない。

### Tsukuyomi 連携 (各軸クリックで修正依頼) — 2026-05-09 追加

人が入力するスライダー UI は廃止 (まさ判断「人が入力する UI は使われない」)。値の修正は **Tsukuyomi (右下マスコット) 経由**:

- 詳細ページの `Factor3Breakdown` の各軸 (μ_A/I/G、TRL/BRL/GRL/SRL/HRL、FRL) に `onClick` ハンドラ
- `FrlAlqPanel` の各 6 因子 (ALQ 4 + Grit + Resilience + FRL + 自由備考) も同様
- クリックすると `window.dispatchEvent("tsukuyomi:open", { detail: { message: "..." } })` を発火
- `Mascot` がイベントを受け取って drawer を open + `localStorage["tsukuyomi:pending-prefill"]` に message を保存
- `TsukuyomiChatDrawer` はマウント時にこの localStorage を読んで input box に挿入 + `tsukuyomi:prefill` event の listener も持つ (Drawer が既に開いてる場合用)

prefill template:
```
PJ {ventureName} の {fieldName} = {currentValue} の評価を見直したい。
現在の根拠: {currentNote or "（未入力）"}

（私のコメント: 例「論文 N 件しかないから 5 にして」「もう少し根拠を詳しく」など）
```

まさが「論文 N 件しかないから 5 にして」と返答 → Tsukuyomi が `update_amd_score_input` tool で `mu_A=5, mu_notes_a="..."` を upsert → ページリロードで反映。

### 根拠 fallback (2026-05-09 後期 改修)

各軸の評価根拠 (subtitle) は以下の優先順で fallback:

**XRL 5 軸 (TRL/BRL/GRL/SRL/HRL)**:
1. `amd_score_inputs.xrl_notes.{axis}` (Tsukuyomi 経由で投入)
2. `project_xrl_log.source_note` の JSON `{axis}_reason` を parse して引用 (既存 LLM 評価データ豊富)
3. 「根拠となる情報がないため仮置き」(slate-400 で薄く表示)

**μ_A (学術)**:
1. `amd_score_inputs.mu_notes.a`
2. **`scholar` テーブル** (Crossref ingest cron `/api/cron/scholar-ingest` 経由、status≠'rejected' 最新 N 件、PJ 横断)
3. 「根拠仮置き」

**μ_I (産業) / μ_G (政府)**:
1. `amd_score_inputs.mu_notes.{i|g}`
2. `atlas_signals` (status='accepted', domain で分類済) の最新 5 件
   - μ_G: domain ∈ {A.地政学・マクロ経済, B.規制・政策}
   - μ_I: domain ∈ {C.素材・原料, D.エネルギー, E.製造・プロセス, F.バイオ・医療, G.モビリティ・ロボティクス, H.建築・インフラ, I.ICT・AI, J.宇宙・防衛, K.食・農・水産, N.海洋・水資源, O.サーキュラーエコノミー}
3. 「仮置き」

**FRL**:
1. `amd_score_inputs.frl_notes`
2. 「仮置き」

### 内閣府 SIP 9 段階定義の Tsukuyomi prompt 埋め込み (2026-05-09 後期)

`update_amd_score_input` tool description に各 XRL の 9 段階定義を埋め込み:
- TRL (NASA Mankins 1995): 1=基本原理 / 4=ラボ試作 / 6=実環境近似 / 7=実環境デモ / 9=運用実績
- BRL: 1-3=仮説 / 4-6=検証 / 7-9=拡大
- GRL: 1-3=規制リスク特定 / 4-6=届出/認証 / 7-9=業界/国際標準化
- SRL (EU H2020): 1-3=社会課題認知 / 4-6=メディア/世論 / 7-9=社会実装定着
- HRL: 1-3=創業期 1-3 名 / 4-6=コア機能カバー / 7-9=複数階層・後継 plan

これで Tsukuyomi が値を upsert する時に SIP 段階に整合した値を選ぶことを期待。

### 「最新評価」の選び方 (2026-05-09 後期)

`amd_score_inputs` に未来予想 (retrofit seed で 2028 年まで) が含まれてるため、
**`evaluated_at <= today` でフィルタした上で最新を選ぶ**ことで、
現在観測 (`project_xrl_log`) と整合する評価を表示する。

経時グラフは全期間表示で OK (未来予想 timeline も見えてよい)。

### Triple Helix 観測モデル (μ_A/I/G の根拠) — 2026-05-10 改訂

**μ_A/I/G は Triple Helix の隠れ状態** (state_space_model.md §4.1)。観測量 (P, B, V, R, I_R, N, C) から **C 行列 loading** で生成される。**個別論文の蓄積ではなく、観測量の lane × quarter trend** が μ_A 等の根拠。

#### モデル構造 (詳細ページ M カードで全部表示)

```
M = (σ_SU+1)^α_σ                                          ← 数式 ①
σ_SU = ∛((μ_A+1)(μ_I+1)(μ_G+1)) - 1                       ← 数式 ②
μ_x = Σ_p c_xp · ỹ_p / Σ_p c_xp   p ∈ {P,B,V,R,I_R,N,C}   ← 数式 ③
ỹ_p = 9 · (y_p - min) / (max - min)  (過去 16 quarter)     ← 数式 ④
```

#### C 行列 (`triple_helix_loading` テーブル、bvar_prior §3.2)

| 観測量 | μ_A | μ_I | μ_G | 単位 | データソース |
|---|---|---|---|---|---|
| P (政策密度) | 0.05 | 0.05 | **0.95** | 件/Q | atlas_signals (domain LIKE 'B.%') ✅ |
| B (公募予算) | 0.10 | 0.05 | **0.85** | 億円/Q | atlas_signals (source_type='grant') ❌ Phase 2 |
| V (VC 投資) | 0.10 | **0.85** | 0.10 | 億円/Q | Crunchbase / INITIAL ❌ Phase 2 |
| R (言及・PR) | 0.40 | 0.35 | 0.30 | 件/Q | atlas_signals (status='accepted') ✅ |
| I_R (研究費) | **0.70** | 0.10 | 0.40 | 億円/Q | KAKEN API ❌ Phase 2 |
| N (論文) | **0.90** | 0.05 | 0.05 | 本/Q | OpenAlex (papers_log) ✅ |
| C_compete (競合) | 0.05 | **0.85** | 0.10 | 社 | project_ventures 集計 ❌ Phase 2 |

#### 詳細ページ UI (M カード = `TripleHelixMatrix`)

`pwa/src/components/venture-map/TripleHelixMatrix.tsx` で:
1. **数式 4 段** (Tex 表示)
2. **μ ラダー**: μ_A / μ_I / μ_G のチップ → ↓ → σ_SU → ↓ → M
3. **6×3 マトリクス**: 行 = 観測量、列 = μ_A/I/G + 観測値
   - セル背景色 = loading 強度のヒートマップ
   - セル hover で `c × ỹ = 寄与値` ポップアップ
   - 観測値 bar = ỹ_p の 0-9 正規化
   - 未取得観測量はグレーアウト + 「未取得」明示
4. **被覆率**: `X / 7 (Y%)` でデータ完備率を透明化

#### 実装ファイル

- migration 036_scholar_drop.sql: 旧個別論文 cron を廃止
- migration 037_papers_log_quarterly.sql: papers_log を quarter 単位に再構築 (UNIQUE lane+observed_at)
- migration 038_triple_helix_loading.sql: C 行列 prior を 7 行 seed
- `src/lib/triple-helix-observations.ts`: 観測量 fetcher / 正規化 / μ 計算
- `src/components/venture-map/TripleHelixMatrix.tsx`: M カード本体
- `src/app/api/cron/papers-quarterly-ingest/route.ts`: OpenAlex weekly cron (ASPI 8 domain × 16 Q)
- `src/app/(app)/scholar/page.tsx` + `src/components/scholar/ScholarTrendView.tsx`: lane × quarter trend chart

#### Phase 2 TODO (観測量の網羅)

- KAKEN API ingest (I_R)
- NEDO / SIP / JST 採択リスト scrape (B)
- Crunchbase / INITIAL ingest (V)
- project_ventures 内部集計 (C_compete)
- PJ.lane × atlas_signals.suggested_tags 突合 (P / R を lane 個別に)

#### Phase 3 TODO (隠れ状態推定)

state_space_model.md §4.5 に従い、BVAR Kalman filter で μ_A(t)/μ_I(t)/μ_G(t) を観測量から逆推定。観測モデル C は `triple_helix_loading` を prior、Bayesian update でデータから学習。

### Retrofit ページ (α 重み調整) — 2026-05-09 追加

Path: `/venture-map/amd-score/retrofit` (タブバーには出さない、詳細ページからのリンクのみ)

理由: α は全 PJ のスコアに同時に効く重要パラメータ。スライダーで気軽に変えられる UI を日常画面に置くと事故が起きる (まさフィードバック 2026-05-09)。

画面構成:
- 左 (sticky): α 7 軸 slider (0-2.0、0.05 刻み)、現役 α / default との差分も表示
- 右: 全 PJ × [現役 α score / 新 α score / 差分%] の表 (新 α 順)
- α を動かすたび右の表がリアルタイム更新 → retrofit (過去 PJ の設立タイミング判定が当たるか) を見ながら慎重に決められる
- 「現役 α に戻す」「base case (default) に戻す」「新しい α を保存」ボタン

### PRS primary / legacy comparison (2026-06-06 更新)

PRS (`P x R x S`) を主表示へ切り替え、legacy 7軸 AMD Score は comparison / evidence 層として残した。

実装上の扱い:

- 計算ロジックは `src/lib/amd-score.ts` の `calculatePrsScore()` / `PRS_ALPHA_DEFAULT` を使う。legacy `calculateAmdScore()` は comparison 専用。
- `P` と `R_net` は `amd_score_inputs.prs_potential` / `amd_score_inputs.prs_r_net` に nullable で保存する。
- `P` / `R_net` が無い場合は `status='missing'` とし、scoreを出さない。legacy AMD を primary へ戻さない。
- `R` は TRL/BRL/GRL/SRL/HRL の contribution product、`S` は σ_SU/FRL/R_net の contribution product として表示する。
- detail 画面で P / R_net を保存し、retrofit 画面は ready / missing queue と legacy α 調整に使う。

### FRL 6 因子拡張 (2026-05-09 追加)

`theory/amd_score.md` §3.F.5 で正式化。`pwa/src/components/venture-map/AmdScoreView.tsx` の `deriveFrl` で計算:

```
FRL = 0.6 · ALQ_4_avg + 0.2 · Grit + 0.2 · Resilience
```

- ALQ 4 次元 (Walumbwa 2008) = authenticity 操作化、まさの「裏表がない・分かりやすさ」に対応
- Grit (Duckworth 2007) = 「脇目も振らず長期目標に邁進する集中力」
- Resilience (Markman 2005) = 「VC 拒絶等の失敗からの回復力、タフさ」

`FrlAlqPanel` に Grit / Resilience の slider と引用文献を追加。Tsukuyomi tool にもパラメータ追加。

RLS: `anon_read` (全行 SELECT) + `admin_all` (`is_admin()`) + `service_role_bypass`。

### ナビ

`/venture-map` 右上に Timeline 3D の隣に「AMD Score →」ボタン。

---

## 期待値 vs 計算結果 (検証 2026-05-06)

理論 §8 の期待値と seed μ 値による計算結果:

| PJ | 期待 | 実測 | 差 | フェーズ判定 |
|---|---|---|---|---|
| tiem 2007 | 3 | 2.7 | -10.5% | seed_watch ✓ |
| tiem 2012 | 133 | 114.0 | -14.3% | seed_emerging ✓ |
| bwe 2025  | 3,193 | 2,615.5 | -18.1% | launch_prep ✓ |
| cx 2026   | 2,922 | 2,385.2 | -18.4% | launch_prep |
| sx 2027   | 4,791 | 4,785.4 | **-0.1%** | launch_go ✓ |
| ctb       | 1,658 | 1,855.5 | +11.9% | launch_prep |
| yd 2025   | 368   | 294.8 | -19.9% | seed_emerging |
| jc 2023 (Shallow) | 100-300 | 1,226 | (Shallow K=1.0 校正) | pre_launch |

差の出どころ:
- 数式は **正しい** (sx 2027 は 0.1% 誤差 = 浮動小数点・丸め範囲)
- §8 表と seed の μ_A/μ_I/μ_G が一致しない (例: bwe で σ_SU=7 想定だが seed の μ=(5,5,8) → σ_SU=5.87)
- まさが UI のスライダーで μ 値を調整すれば期待値に揃う

→ 数式の妥当性は OK、初期 seed の μ 値は粗い見積りなので、運用フェーズで **まさが PJ ごとに**実データで再評価する方針。

Shallow Tech (jc) は K = 1.0 (TRL 抜き) で校正されるため数値スケールが「通常 K=0.1」と異なる。
将来 §11.3 の重み再分配 (TRL の 1.0 を BRL/HRL に再分配) を実装すれば期待値 100-300 に近づく余地あり。

---

## FRL の構造化評価 (2026-05-07 追加)

`amd_score_inputs` に Walumbwa et al. (2008) ALQ 由来の 4 次元を追加 (migration 015):
- `alq_self_awareness` (自己認識 0-9)
- `alq_relational_transparency` (関係透明性 0-9)
- `alq_balanced_processing` (均衡的処理 0-9)
- `alq_internalized_moral` (内在化された道徳観 0-9)
- `frl_notes` (自由備考)

UI: AmdScoreView の `FrlAlqPanel` で:
- ALQ 4 軸ミニレーダー + スライダー
- 「ALQ 平均から FRL を自動算出する」チェック (デフォルト ON)
- 自由備考テキストエリア (ALQ で拾えない要素を補う)
- 詳細テーブル「FRL の学術定義から見て、ALQ 4 次元 + 備考だけでは何が足りないか」を展開可能

### FRL 学術定義からの不足要素 (運用上の妥協を明記)

ALQ 4 次元 + 自由備考だけでは厳密には不十分。本来は以下も必要:

1. **外部評価データ (360° feedback)**: ALQ は self-report で self-bias がある。投資家・顧客・取締役・チームメンバーからのフィードバックを取りたい
2. **Founder Quality (Bernstein et al. 2017 JF)**: チーム全体のクオリティ (CEO 単体ではない)、教育背景、過去 SU 経験、業界ネットワーク
3. **Founder Experience (Hsu 2007 RP)**: 過去の起業経験、過去の VC 調達実績、過去の M&A/IPO 実績
4. **Achievement Motivation (Stewart & Roth 2007 JSBM)**: 起業家特有の達成動機・リスク許容度のメタ分析尺度
5. **Psychological Safety への寄与 (Edmondson 1999 ASQ)**: チーム内発言しやすさへの寄与 (HRL とも一部重なる)
6. **動的観測**: 危機対応時の挙動、ピボット時の意思決定スピード、ストレス下での倫理判断 (静的 ALQ では取れない)
7. **Founder Network 効果 (Hsu 2007 RP)**: 魅力的 CEO は他軸 (技術/人材/資金) を引き上げる間接効果。FRL × 他軸の交差項として表現すべき

→ 実用上は ALQ + 自由備考でも「主成分」はカバーできるので、現状仕様で運用しつつ、上記不足項目は備考欄で補う方針。学術論文化する時は 360° + アウトカム指標 (調達額・ピボット成功率) との相関分析が必要。

---

## XRL 次レベル進捗表示 (2026-05-07 追加)

`src/lib/xrl-level-definitions.ts` に内閣府 SIP「サーキュラーエコノミーシステム構築」2023 公募要領 PDF p11-15 互換の 9 段階定義を全 5 軸 (TRL/BRL/GRL/SRL/HRL) で網羅:

```
{ level, label, description, exit_criteria }
```

`getLevelInfo(axis, value)` で:
- current 段階 (`Math.floor(value)`)
- next 段階 (`current+1`)
- progressPct (`(value - floor(value)) * 100`)

CockpitXrlDetailModal に `<NextLevelProgress>` セクションを追加して、現在 Lv. → 次 Lv. の説明、進捗バー (%)、次レベル到達条件 (exit_criteria) を明示。

「細かい進捗だけではレベルを 1 つ上げることはできないが、その蓄積で上がっていく」(まさ要望 2026-05-07) という思想を可視化。

---

## 過去分一括抽出 (2026-05-07 batch)

「過去の生データから一気に AMD Score timeline を抽出して欲しい」というまさ要望に対し、私 (Claude Code) のセッション内で MCP (Notion / Slack / Drive) + WebSearch + Anthropic API + Supabase Management API を組み合わせて 9 PJ 一括処理した。

### 抽出スクリプト
`pwa/scripts/extract_amd_score_from_l2.py` (汎用化、引数: project_id, raw_text_file)
- Anthropic API (Sonnet 4.5) で生データ → JSON timeline 抽出
- Supabase Management API で `amd_score_inputs` に upsert (`UNIQUE(project_id, evaluated_at)`)
- 出力: `/tmp/amd-l2-extract/<projectId>_timeline.json` + `<projectId>_upsert.sql`
- evaluator は `'l2_extract_sonnet'` で記録

### 各 PJ の抽出元 (1 PJ あたり raw text 約 2-5KB)
- Notion: PJ ごとの Project Charter / 経緯 / FY25 事業報告 / キックオフ MTG 等を fetch
- Slack: `slack_search_public` で会社名検索 → 主要メッセージ 20 件
- WebSearch: 「<PJ名> 資金調達 / 設立 / 本店移転」等で過去のニュース・受賞・ピッチ実績を補完
- 既存 `amd_score_inputs` の seed (013 migration) と Before Zero Theory `su_timelines.ts` のメタも raw text に含める

### 抽出結果サマリ (9 PJ × 71 評価点)

| PJ | 評価点 | 期間 | outcome | 主要洞察 |
|---|---|---|---|---|
| p03 ティエムファクトリ | 8 | 2007-2022 | smb | 「TRL ゲート違反」典型例。μ_A=8 だが TRL=0 で設立 → 2022 燃え尽き |
| p04 輝翠TECH | 6 | 2021-2026 | lifted | 月面探査 → 農業転用、AMD 支援卒業後シリーズ A 1.5億 → デット 1.37億 → 量産 |
| p06 CrestecBio | 8 | 2020-2026 | rocket | 創薬 long-cycle、2024 資金難航 → 2025-09 アルマダ復帰 → 12 月シード 1.5億 |
| p07 LiSTie | 8 | 2023-2026 | rocket | UMI シード 1.5億 + SBIR 核融合 15億 + QST 出資、2026-04 メディア『脱・中国 99.99% 国産リチウム』で SRL ジャンプ |
| p09 JOYCLE | 10 | 2023-2026 | deep_pivot | Shallow Tech 設立 → 群大野田研合流で deep化、2026-03 AMD 関与終結 (リバウンド失敗) |
| p11 BWE | 8 | 2024-2026 | lifted | (前 batch 完了済) |
| p18 Yellow Duck | 7 | 2023-2025 | ue_fail | UE 課題で PoC TRL=4 達成も Pre-Seed 調達不能 → 2025-09 ue_fail 終結 |
| p20 CryoX | 8 | 2024-2026 | rocket | NIMS 神谷氏 20+年研究、市場調査 → 国家戦略接続 → 2026-08 設立予定 |
| p21 SolvioraX | 8 | 2025-2028 | planning | 2025-12 PSI Step2 採択で μ_G ジャンプ、2027-04 NewCo 設立予定 |

### Sonnet が拾った重要洞察 (timeline 各点の `notes` フィールドに記録)
- **tiem** の HRL 1-3 停滞: まさ個人の技術偏重・営業力不足が燃え尽きの根本原因
- **CrestecBio** の 2024 停滞 → 2025 復帰の波形: 創薬特有 long-cycle で AMD 支援の中断・復帰パターン
- **LiSTie** メディア露出後 SRL ジャンプ
- **JOYCLE** 関与終結時の R&D コミット低下: AMD 卒業後リバウンド失敗パターン
- **YD** の UE 課題: 理論的にコスト合わず PoC TRL4 でも Pre-Seed 調達不能
- **BWE** の CEO 移譲過渡期で FRL 一時低下 → 体制安定化で回復

### このセッションでの限界 / 次の段階に必要なこと

1. **MCP 接続は私 (Claude Code) のセッション内のみ**: 本番 PWA から定期的に Slack/Drive/Notion を叩くには Slack/Drive/Notion API の bot token を Vercel env に追加 + API route 実装が必要
2. **cron 化**: 各 PJ について「最新の生データ差分から評価点を再評価」する cron (週次か月次) は別作業。`/api/cron/amd-score-l2-refresh` 等の route 化が必要
3. **WebSearch も同様**: Anthropic 公式 web_search tool を使うか、Google Custom Search API を vercel env に登録するか
4. **抽出精度の検証**: 71 評価点それぞれの μ/XRL/FRL 値はあくまで Sonnet の推定。まさが UI で実値と照らし合わせて補正していく運用

---

## TODO (次回以降)

1. **σ_SU を /venture-map/state-space と連携**: 現状 amd_score_inputs に手動入力した μ_A/μ_I/μ_G を使うが、本来は Triple Helix 状態空間モデルの推定値を pull すべき
2. **Shallow Tech 重み再分配**: TRL=1.0 を BRL/HRL に再分配して K=1.0 にする (§11.3)
3. **データ駆動 α 推定**: 9 PJ retrofit から階層 Bayesian で α を最尤推定 (理論 §5 末尾)
4. **CES 拡張**: 軸間補完性 (σ_SU と TRL は補完、BRL と HRL は代替) を ρ パラメータで表現 (理論 §1)
5. **VC valuation との比較ビュー**: AMD Score 高 + Valuation 低 = 過小評価サイン (理論 §10)
6. **AMD Score を atlas からトリガー**: 政策イベント・ニュースが入ったら関連 PJ の σ_SU を自動更新

---

## 関連

- 理論正本: [`/Users/masa/projects/AMD/before-zero/theory/amd_score.md`](../../../before-zero/theory/amd_score.md)
- 8 PJ メタ: [`/Users/masa/projects/AMD/before-zero/retrofit/su_timelines.ts`](../../../before-zero/retrofit/su_timelines.ts)
- v3.2 状態空間モデル: [`/Users/masa/projects/AMD/before-zero/theory/state_space_model.md`](../../../before-zero/theory/state_space_model.md)
- PJ Status コックピット: [`./2026-05_pj_status_cockpit.md`](2026-05_pj_status_cockpit.md)
- Venture Map モデル: [`./2026-05_venture_map_model.md`](2026-05_venture_map_model.md)
