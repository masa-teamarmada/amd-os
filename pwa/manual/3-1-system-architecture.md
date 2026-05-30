# 全体設計 — OS の地図

AMD OS 全体の構成を、画面・データ・自動処理・外部サービスの関係で見る章。細かいコードや migration の正本は `pwa/design/` と `pwa/scripts/migrations/` だが、まずここで全体像を掴む。

用語が不安な時は、先に [1-1 章の共通用語](1-1-intro.md#先に知っておく共通用語) と [3-2 章の用語表](3-2-data-and-extraction.md#この章の読み方) を見る。ここでの `5 生データ` は Gmail / Drive / Calendar / Slack / Notion、`L2` はそこから OS 用に抽出した構造化データのこと。

## プラットフォーム構成

```text
5 生データ
  Slack / Notion / Calendar / Drive / Gmail
        ↓
L2 抽出・運用処理
  Codex automation / MMOマシン Codex Desktop automation / Vercel cron / GAS
        ↓
Supabase
  projects / members / billing_cycles / L2 tables / Atlas / Scores
        ↓
4 クライアント
  PWA / iOS / GAS / Android(TBD)
```

| レイヤー | 役割 |
|---|---|
| Supabase | DB 正本。PWA / iOS / GAS が共有 |
| PWA | ブラウザ版。cockpit、admin、Atlas、Seeds、VC、manual を持つ |
| iOS | ネイティブ版。先行実装がある機能も多い |
| GAS | freee / Slack / 外部サービス連携の一部。LLM定期抽出は 2026-05-22 に停止 |
| Codex automation | 5 生データ・Atlas の LLM レビューを subscription 枠で実行し outbox を出す |
| MMOマシン Codex Desktop automation | L2 ②〜⑥ の現行 writer。protocol / knowledge / MS進捗 / MTGフローを subscription 枠で抽出 |
| LaunchAgent | outbox JSON を 5 分ごとに拾って Supabase / API へ反映 |
| Vercel cron | LLM を使わない運用 cron。freee、入金、週次活動、集計など |

## 画面マップ

### 日常利用

| 画面 | 役割 |
|---|---|
| `/dashboard` | OS の入口。PJ 一覧と主要画面への導線 |
| `/mypage` | 自分の参加 PJ、今週の活動、月次報酬予定、月次TODO |
| `/project/{project_id}/cockpit` | PJ の中心画面 |
| `/notifications` | L2 候補・差分候補の確認 / 修正依頼 |
| `/reimburse` | 立替申請 |
| `/manual` | このマニュアル |

### 経営・判断

| 画面 | 役割 |
|---|---|
| `/project/p00/cockpit` | AMD 全社 cockpit |
| `/management-score` | AMD Management Score |
| `/venture-map/amd-score` | AMD Score 一覧 |
| `/venture-map/amd-score/{projectId}` | AMD Score 詳細 |
| `/atlas` | 外部マクロ signal / story |
| `/atlas/macrotrends` | 構造課題と変化仮説 |
| `/atlas/divergence` | 世界 / 日本差分 |
| `/atlas/decisions` | Atlas 由来の判断ログ |
| `/atlas/inbox/submit` | 手動 signal 投入 |
| `/atlas/admin/themes` | Atlas theme clustering 管理 |

### 探索・アセット

| 画面 | 役割 |
|---|---|
| `/seeds` | 研究シーズリスト |
| `/seeds/inbox` | 自動発見 seed の確認 |
| `/vcs` | VC リスト |
| `/vcs/inbox` | VC ニュース確認 |
| `/scholar` | 学術トレンド |

### Admin

| 画面 | 役割 |
|---|---|
| `/admin/projects` | PJ 台帳、契約・請求・支払条件 |
| `/admin/members` | AMD メンバー台帳、Google Calendar 状態、最終ログイン |
| `/admin/billing` | SU × 月の請求状態マトリクス |
| `/admin/payouts` | AMD から SU への支払通知書 |
| `/admin/finance` | 経理オペ台帳、固定費、領収書、freee |
| `/admin/protocols` | AMD Protocol 候補確認 |
| `/admin/prompts` | LLM prompt 管理 |
| `/admin/settings` | Raw Data / L2 Data / Cron Control |
| `/admin/tsukuyomi` | つくよみ管理 |
| `/admin/contexts` | LLM context 管理 |

### HUD / 実験ビュー

| 画面 | 役割 |
|---|---|
| `/hud/dashboard` | HUD 版 dashboard。将来的に正本化したい候補 |
| `/hud/project/{project_id}/cockpit` | HUD 版 PJ cockpit |
| `/hud/notifications` | HUD 版 notifications |
| `/hud/atlas` / `/hud/atlas/*` | HUD skin 付き Atlas |
| `/hud/seeds` / `/hud/seeds/*` | HUD skin 付き Seeds |
| `/hud/vcs` / `/hud/vcs/*` | HUD skin 付き VC List |
| `/hud/venture-map/amd-score/retrofit` | HUD 版 retrofit view |
| `/venture-map/cyberspace` | 実験ビュー |
| `/venture-map/oscillator` | Coupled oscillator 実験 |
| `/venture-map/state-space` | Triple Helix 状態空間 |
| `/venture-map/timeline-3d` | 3D timeline 実験 |
| `/venture-map/su/{id}` | SU 個別ビュー |

### 設定・編集系

| 画面 | 役割 |
|---|---|
| `/project/{project_id}/config` | 旧 PJ 設定。契約・請求・支払条件は `/admin/projects` を正本にする |
| `/vcs/{id}/edit` | VC 手入力編集 |

## データレイヤー

```text
Raw evidence
  source_cache / meeting docs / calendar / Gmail refs
        ↓
L2
  monthly_reports
  member_activities
  milestone progress
  project_knowledge
  member_knowledge
  project_meeting_summaries
  project_registry_diffs
  project_xrl_evidence
  project_strategy_signals
        ↓
Decision / Ops UI
  cockpit / notifications / admin / score / atlas
```

| 系統 | 主なテーブル |
|---|---|
| PJ / メンバー | `projects`, `members`, `project_members`, `project_ventures` |
| 月次 / 請求 | `billing_cycles`, `monthly_reports`, `reimbursements`, `payout_notices` |
| MS | `value_plan_cycles`, `value_milestones`, `milestone_monthly_progress`, `ms_progress_revisions` |
| L2 | `project_strategy_signals`, `project_xrl_evidence`, `project_registry_diffs`, `project_knowledge`, `member_knowledge`, `protocols` |
| 通知 | `l2_notifications`, `meeting_notifications`, `l2_feedbacks`, `app_notifications` |
| Atlas | `atlas_signals`, `atlas_stories`, `atlas_themes`, `atlas_divergences`, `atlas_decisions` |
| Seeds / VC | `seeds`, `seed_*`, `vcs`, `vc_*` |
| Scores | `amd_score_inputs`, `amd_score_alpha`, `amd_management_score_*`, `macro_index_log`, `papers_log` |

## 書き込み経路

| 経路 | 例 | 原則 |
|---|---|---|
| PWA UI -> API -> Supabase | 月次ルーティン、通知回答、admin編集 | ユーザー操作を即保存 |
| Codex automation -> outbox -> LaunchAgent -> API/Supabase | MS進捗、XRL根拠、経営ハイライト、Atlas | LLM が直接 DB へ大量書き込みしない |
| MMOマシン Codex Desktop automation -> Supabase/API | protocol / knowledge / MS進捗 / MTGフロー | source_hash と feedback を見て冪等に upsert |
| Vercel cron -> Supabase | freee同期、入金確認、週次活動、集計 | LLM 非使用の運用処理だけ残す |
| GAS -> Supabase / Slack / freee | 支払通知書 PDF、外部サービス連携 | LLM 定期抽出は停止中 |

## 認証と権限

- PWA の `(app)` 配下は Supabase Auth の Google login が必要
- `/auth/login` と `/auth/callback` は公開
- `/hud/dashboard/embed` は外部プレゼン用の公開 embed route
- admin 画面と `/notifications` は admin 権限を前提にする
- Google Workspace login は Calendar / Gmail scope を使う。Calendar 共有状態は `members.google_calendar_status` に残す

## 今回クロールで見つけた manual 化対象

今回の OS 全体クロールで、manual 側が薄かったもの:

| 領域 | 反映先 | 状態 |
|---|---|---|
| 初心者向けの使い方 | [2-1 章](2-1-member-quick-start.md) | 追記済み |
| 全体画面マップ / platform map | この章 | 追記済み |
| AMD Score の数式・軸・更新ロジック | [4-3 章](4-3-amd-score-spec.md) | 追記済み |
| 通知 / つくよみ修正依頼 / 正本反映ゲート | [3-3 章](3-3-notifications-and-tsukuyomi.md) | 追記済み |
| Seeds / VC / Scholar の使い方 | [2-5 章](2-5-research-assets-quick-start.md) | 追記済み |
| Venture Map の数理モデル・実験ビュー | [5-2 章](5-2-hud-and-venture-map-spec.md) | 追記済み |
| HUD 版の正本化方針 | [5-2 章](5-2-hud-and-venture-map-spec.md) | 追記済み |
| admin/settings の Cron Control | [6-1 章](6-1-operations-settings-spec.md) | 追記済み |

manual 拡充時は、この表を更新しながら「見つける -> 書く -> 再クロール」を回す。
