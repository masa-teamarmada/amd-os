# Venture Map 仕様

Venture Map は、AMD OS の中でも「経営判断の制御盤」に近い領域。この章では、Venture Map の数理モデルと実験ビューの扱いをまとめる。

## Venture Map の目的

Venture Map は、過去 PJ の学習と外部マクロ波を重ねて、次にどの lane / timing を見るか判断するための画面。

```text
政策シグナル / 投資 / 論文 / 過去 PJ
        ↓
macro_index_log / papers_log / project_ventures
        ↓
macro_lane_weights
        ↓
Venture Map / AMD Score / Timeline / State Space
```

対象は「会社数」ではなく PJ。設立前の pre-founding も扱うので、AMD OS では原則として PJ 単位で見る。

## 数理モデルの概要

### Macrotrend 指数

```text
M_i(t) =
  α_i * 過去政策シグナルの減衰累積
  + β_i * 公募予算
  + γ_i * VC 投資
  + δ_i * 政策・ニュース言及
```

| 変数 | 意味 | 主な保存先 |
|---|---|---|
| `M_i(t)` | lane i の macro 指数 | `macro_index_log.index_value` |
| `α/β/γ/δ` | 政策・予算・投資・言及の重み | `macro_lane_weights` |
| `λ` | 政策効果の減衰率 | `macro_lane_weights.lambda` |
| `η` | 競合密度の効き方 | `macro_lane_weights.eta` |

### 論文・政策乖離

```text
D_i(t) = dN_i/dt - dM_i/dt
```

| 値 | 読み方 |
|---|---|
| `D > 0` | 論文先行。シーズ仕込み・スカウト強化 |
| `D < 0` | 政策先行。研究集中要請・大学連携強化 |
| `D'` が大きい | 領域転換点の可能性 |

現時点では微分は主に可視化・議論用で、完全な自動意思決定には使わない。

## 主なテーブル

| テーブル | 役割 |
|---|---|
| `project_ventures` | 過去 / 現行 PJ の Venture Map 用メタ |
| `project_xrl_log` | TRL / BRL / HRL などの時系列 |
| `macro_index_log` | lane 別の月次 macro 指数 |
| `macro_lane_weights` | α/β/γ/δ/λ/η の推定値 |
| `papers_log` | OpenAlex 由来の lane 別論文数 |
| `atlas_signals` | macro 指数の根拠になる外部 signal |
| `seeds` | 研究シーズ候補。Venture Map の旧予兆 seed とは意味が違う |

## 画面と読み方

| 画面 | 読むもの |
|---|---|
| `/venture-map` | lane ごとの macro wave、過去 PJ、paper / policy / investment の重なり |
| `/venture-map/amd-score` | PJ / SU 単位の AMD Score 一覧 |
| `/project/{projectId}/cockpit?tab=score-detail` | 1 PJ の SPS primary、SPS history、legacy M-X-F、律速軸、XRL チェックリスト |
| `/venture-map/timeline-3d` | 過去 PJ と macro wave の時間軸 |
| `/venture-map/state-space` | Triple Helix 状態空間 |
| `/venture-map/oscillator` | coupled oscillator 実験 |
| `/venture-map/cyberspace` | 表現実験ビュー |
| `/venture-map/su/{id}` | PJ 個別の XRL x macro 重ね表示 |

`/venture-map/cyberspace` や `oscillator` は、まだ意思決定の正本画面ではなく、表現・分析の実験ビュー。判断ロジックの正本は `/venture-map`, `/venture-map/amd-score`, `pwa/design/venture_map_model.md`, [4-3 章](4-3-amd-score-spec.md)。

## 自動更新

| 処理 | 役割 | 現状 |
|---|---|---|
| `papers-quarterly-ingest` | OpenAlex 論文数 -> `papers_log` | Vercel cron / Run Now 可 |
| `macro-aggregate-indicators` | `observation_log` / `atlas_signals` から macro 集計 | Vercel cron / Run Now 可 |
| `relearn-lane-weights` | α/β/γ/δ/λ/η 再学習 | LLM 系のため停止中扱い |
| `macro-backfill-historical` | 2010-2025 の historical 補完 | LLM 系のため停止中扱い |
| `venture-xrl-refresh` | XRL 自動判定 | LLM 課金あり。例外扱いとして要監視 |

cron の稼働状態は [6-1 章 Operations Settings](6-1-operations-settings-spec.md) と [9-1 章 5.4](9-1-decisions-and-history.md#54-codex--claude--vercel--launchagent-責務分担マトリクス) を見る。

## 関連設計 md

| md | 内容 |
|---|---|
| `pwa/design/venture_map_model.md` | Venture Map 数理モデル |
| `pwa/design/macrotrend_atlas_seeds_architecture.md` | Macrotrend -> Atlas -> Seeds 階層 |
| `pwa/design/amd_score.md` | AMD Score 理論・UI |
