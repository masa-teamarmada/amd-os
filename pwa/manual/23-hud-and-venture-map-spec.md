# 23. HUD / Venture Map 仕様

HUD と Venture Map は、AMD OS の中でも「経営判断の制御盤」に近い領域。この章では、HUD client の位置付け、Venture Map の数理モデル、実験ビューの扱いをまとめる。

## 23.1 HUD client の位置付け

HUD は、現行 PWA を壊さずにもう 1 系統として育てるクライアント。

```text
現行版
  /dashboard
  /project/{project_id}/cockpit
  components/cockpit/*

HUD版
  /hud/dashboard
  /hud/project/{project_id}/cockpit
  components/hud/*
```

原則:

| 原則 | 内容 |
|---|---|
| 現行 UX を落とさない | `/dashboard` や現行 cockpit を直接 HUD 化しない |
| DB/API は共有 | データ取得・保存処理は現行と同じ Supabase / API を使う |
| UI は分離 | HUD 化する部品は `components/hud/*` へ複製してから変更する |
| parity を先に確認 | 表示項目、クリック、modal、DB 書き込み、権限、空状態を現行と照合する |
| visual language を守る | `pwa/design/hud_visual_language.md` が正本。暗いカード UI に戻さない |

## 23.2 HUD routes

| Route | 内容 |
|---|---|
| `/hud/dashboard` | HUD 版 control center |
| `/hud/project/{project_id}/cockpit` | HUD 版 PJ cockpit |
| `/hud/notifications` | HUD 版 notifications |
| `/hud/atlas` / `/hud/atlas/*` | HUD skin 付き Atlas |
| `/hud/seeds` / `/hud/seeds/*` | HUD skin 付き Seeds |
| `/hud/vcs` / `/hud/vcs/*` | HUD skin 付き VC List |
| `/hud/venture-map/amd-score/retrofit` | HUD 版 retrofit view |
| `/hud/dashboard/embed` | 外部プレゼン用の公開 embed route |

`/hud/*` 配下では通常の GlobalNav を隠し、HUD shell nav を使う。

## 23.3 HUD dashboard のデータ入力

`/hud/dashboard` は次のデータを統合する。

| 入力 | 主な用途 |
|---|---|
| `projects` | PJ signal board、status、role line |
| `billing_cycles` | 月次ルーティン action queue |
| `members` | login user の code name |
| `amd_score_inputs` + `amd_score_alpha` | PJ ごとの M/X/F signal と score history |
| `amd_management_score_snapshots` | AMD Management Score ring / history |

action queue は `billing_cycles` から未完タスクを作る。

```text
請求額未確定 -> 請求額確定
報告会未調整 -> 報告会日程調整
月次報告書未FIX -> 月次報告書FIX
請求書未送付 -> 請求書送付
請求書送付済み + 未入金 -> 入金確認
```

HUD dashboard の数値は「別計算」ではなく、現行 cockpit / admin が使う正本データを別表示している。

## 23.4 HUD 化の parity checklist

HUD 側で部品を置き換える前に、最低限この表を埋める。

| 項目 | 確認内容 |
|---|---|
| 表示データ | 現行版にある項目が欠けていないか |
| 操作 | クリック、入力、drag/drop、toggle が残っているか |
| modal | 現行で開く modal が HUD 側でも開くか |
| DB/API 書き込み | 保存先と payload が同じか |
| 権限 | admin / member / viewer の制御が落ちていないか |
| 空状態 | データなし、未設定、error の見え方 |
| mobile | 横幅不足で破綻しないか |

見た目の品質より先に、業務操作の欠落を潰す。

## 23.5 Venture Map の目的

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

## 23.6 数理モデルの概要

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

## 23.7 主なテーブル

| テーブル | 役割 |
|---|---|
| `project_ventures` | 過去 / 現行 PJ の Venture Map 用メタ |
| `project_xrl_log` | TRL / BRL / HRL などの時系列 |
| `macro_index_log` | lane 別の月次 macro 指数 |
| `macro_lane_weights` | α/β/γ/δ/λ/η の推定値 |
| `papers_log` | OpenAlex 由来の lane 別論文数 |
| `atlas_signals` | macro 指数の根拠になる外部 signal |
| `seeds` | 研究シーズ候補。Venture Map の旧予兆 seed とは意味が違う |

## 23.8 画面と読み方

| 画面 | 読むもの |
|---|---|
| `/venture-map` | lane ごとの macro wave、過去 PJ、paper / policy / investment の重なり |
| `/venture-map/amd-score` | PJ / SU 単位の AMD Score 一覧 |
| `/venture-map/amd-score/{projectId}` | 1 PJ の M/X/F と律速軸 |
| `/venture-map/timeline-3d` | 過去 PJ と macro wave の時間軸 |
| `/venture-map/state-space` | Triple Helix 状態空間 |
| `/venture-map/oscillator` | coupled oscillator 実験 |
| `/venture-map/cyberspace` | 表現実験ビュー |
| `/venture-map/su/{id}` | PJ 個別の XRL x macro 重ね表示 |

`/venture-map/cyberspace` や `oscillator` は、まだ意思決定の正本画面ではなく、表現・分析の実験ビュー。判断ロジックの正本は `/venture-map`, `/venture-map/amd-score`, `pwa/design/venture_map_model.md`, [21 章](21-amd-score-spec.md)。

## 23.9 自動更新

| 処理 | 役割 | 現状 |
|---|---|---|
| `papers-quarterly-ingest` | OpenAlex 論文数 -> `papers_log` | Vercel cron / Run Now 可 |
| `macro-aggregate-indicators` | `observation_log` / `atlas_signals` から macro 集計 | Vercel cron / Run Now 可 |
| `relearn-lane-weights` | α/β/γ/δ/λ/η 再学習 | LLM 系のため停止中扱い |
| `macro-backfill-historical` | 2010-2025 の historical 補完 | LLM 系のため停止中扱い |
| `venture-xrl-refresh` | XRL 自動判定 | LLM 課金あり。例外扱いとして要監視 |

cron の稼働状態は [24 章 Operations Settings](24-operations-settings-spec.md) と [05 章 5.4](05-decisions-and-history.md#54-codex--claude--vercel--launchagent-責務分担マトリクス) を見る。

## 23.10 関連設計 md

| md | 内容 |
|---|---|
| `pwa/design/HUD_CLIENT_MIGRATION.md` | HUD client 移行方針 |
| `pwa/design/hud_visual_language.md` | HUD 視覚言語 |
| `pwa/design/venture_map_model.md` | Venture Map 数理モデル |
| `pwa/design/macrotrend_atlas_seeds_architecture.md` | Macrotrend -> Atlas -> Seeds 階層 |
| `pwa/design/amd_score.md` | AMD Score 理論・UI |
