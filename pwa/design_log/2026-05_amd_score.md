# AMD Score 実装 — Before Zero Theory v3.2

作成: 2026-05-07 (blissful-kepler-9e95b0 セッション)
正本ステータス: 進化中。仕様変更したらここを同じ commit で更新する。

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

理論正本: [`/Users/masa/projects/before-zero/theory/amd_score.md`](../../../../before-zero/theory/amd_score.md)

---

## 数式 (要約)

```
AMD Score = K · Π (X_i + 1)^α_i      X = {σ_SU, TRL, BRL, GRL, SRL, HRL, FRL}
σ_SU      = ((μ_A+1)(μ_I+1)(μ_G+1))^(1/3) - 1     (Triple Helix CD)
K         = 100,000 / 10^Σα                       (全軸 9 で IPO 級 100,000 に校正)
```

Shallow Tech モード (TRL=null) は TRL 軸を計算から除外、6 軸 + K 再校正。

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

### フェーズ閾値

| score | フェーズ |
|---|---|
| 0-30 | seed_watch (シーズ察知) |
| 30-300 | seed_emerging (GAP ファンド検討) |
| 300-1,500 | pre_launch (立ち上げ準備期) |
| 1,500-3,500 | launch_prep (設立準備スタート) |
| 3,500-15,000 | launch_go (設立判定 GO) |
| 15,000-50,000 | scale (シリーズ A/B) |
| 50,000-100,000 | graduation (IPO/卒業) |

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
- AMD スコア経時グラフは log scale (1 → 100,000、フェーズ閾値ガイドライン入り)
- スコアチップは「<score> · <フェーズ名>」を phase 色で表示
- breakdown モーダルは 7 軸 contribution table + 詳細編集ページへの link
- 「7 軸を編集 →」リンク、未評価時は「AMD: 未評価 →」link
- events ドットは annotation として残し、score 線上の最近点に置く

### Supabase

migration: [`pwa/scripts/migrations/013_amd_score.sql`](../scripts/migrations/013_amd_score.sql) (本番適用済 2026-05-06)

```
amd_score_inputs (project_id FK projects, evaluated_at, mu_A/I/G + 5 XRL + FRL, shallow_tech_mode)
  UNIQUE(project_id, evaluated_at)
amd_score_alpha (alpha jsonb, effective_from / effective_to)
  base case を 1 行 seed
8 PJ の retrofit データを seed (tiem ×2 / bwe / cx / sx / ctb / yd / jc)
  ID mapping (008): tiem→p03, bwe→p11, jc→p09, ctb→p06, cx→p20, sx→p21, yd→p18
```

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

## TODO (次回以降)

1. **σ_SU を /venture-map/state-space と連携**: 現状 amd_score_inputs に手動入力した μ_A/μ_I/μ_G を使うが、本来は Triple Helix 状態空間モデルの推定値を pull すべき
2. **Shallow Tech 重み再分配**: TRL=1.0 を BRL/HRL に再分配して K=1.0 にする (§11.3)
3. **データ駆動 α 推定**: 9 PJ retrofit から階層 Bayesian で α を最尤推定 (理論 §5 末尾)
4. **CES 拡張**: 軸間補完性 (σ_SU と TRL は補完、BRL と HRL は代替) を ρ パラメータで表現 (理論 §1)
5. **VC valuation との比較ビュー**: AMD Score 高 + Valuation 低 = 過小評価サイン (理論 §10)
6. **AMD Score を atlas からトリガー**: 政策イベント・ニュースが入ったら関連 PJ の σ_SU を自動更新

---

## 関連

- 理論正本: [`/Users/masa/projects/before-zero/theory/amd_score.md`](../../../../before-zero/theory/amd_score.md)
- 8 PJ メタ: [`/Users/masa/projects/before-zero/retrofit/su_timelines.ts`](../../../../before-zero/retrofit/su_timelines.ts)
- v3.2 状態空間モデル: [`/Users/masa/projects/before-zero/theory/state_space_model.md`](../../../../before-zero/theory/state_space_model.md)
- PJ Status コックピット: [`./2026-05_pj_status_cockpit.md`](2026-05_pj_status_cockpit.md)
- Venture Map モデル: [`./2026-05_venture_map_model.md`](2026-05_venture_map_model.md)
