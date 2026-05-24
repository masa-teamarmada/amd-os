# 24. Operations Settings 仕様

`/admin/settings` は、AMD OS の Raw Data / L2 Data / Cron Control を一覧化する admin 専用画面。何がどこから入り、どの処理が動いていて、どれが止まっているかを確認するための運用台帳。

## 24.1 画面構成

URL: `/admin/settings`

| ブロック | 内容 |
|---|---|
| Operations Settings | Raw Data、L2 Data、Cron Control |
| DB Settings | `settings` table の key/value |

admin 以外は `notFound()` で見えない。

## 24.2 Raw Data

Raw Data は L2 の前にある一次データ。

| Source | Owner | 主な landing |
|---|---|---|
| Google Calendar | GAS | `project_meeting_summaries`, `meeting_notifications`, `project_strategy_signals` |
| Notion AI 議事録 | GAS | `project_meeting_summaries`, `project_strategy_signals` |
| Gmail / CircleBack / Meet | GAS + PWA | `project_meeting_summaries`, `source_cache`, `member_activities` |
| Slack | GAS / PWA connectors | `member_activities`, `source_cache`, `project_strategy_signals` |
| Google Drive | GAS / PWA | `monthly_reports`, `source_cache`, `project_strategy_signals` |
| Web / 外部シグナル | PWA + Codex automation | `atlas_stories`, `atlas_signals`, `macro_index_log`, `vc_news` |

この一覧は `pwa/src/lib/operations-catalog.ts` の `rawDataSources` が正本。

## 24.3 L2 Data

L2 Data は、Raw Data を OS が使える知識に変換したもの。

| L2 | Table | 目的 |
|---|---|---|
| monthly report | `monthly_reports` | PJ 月次レポート本文 |
| AMDプロトコル | `protocols` / `protocol_examples` | 判断パターンの構造化 |
| MS進捗 | `milestone_monthly_progress` | 月次 MS 進捗推定 |
| PJナレッジ | `project_knowledge` | PJ の事実・人物・論点 |
| メンバーナレッジ | `member_knowledge` | メンバーの強み・関心・最近の活動 |
| MTGサマリ | `project_meeting_summaries` | meeting 単位の決定・進捗・next action |
| OS台帳差分 | `project_registry_diffs` | 5 生データと OS 台帳の差分候補 |
| XRL根拠 | `project_xrl_evidence` / `project_xrl_log` | AMD Score の XRL 根拠 |
| 経営ハイライト | `project_strategy_signals` | 進んだこと・起きたこと |
| Score Inputs | `amd_score_inputs` | M/X/F 入力値と根拠 |

この一覧は `operations-catalog.ts` の `l2Datasets` が正本。

## 24.4 Cron Control の読み方

Cron Control は「実行ボタン」ではなく、まず状態台帳として読む。

| 表示 | 意味 |
|---|---|
| `Run Now` | PWA route または GAS function を admin 権限で手動起動できる |
| `Stopped` | 停止中。旧 LLM cron や Codex automation 移管済みで、UI から直接起動しない |
| `layer=GAS` | GAS web app 経由 |
| `layer=PWA` | PWA API route 経由 |
| `layer=Codex` | Codex automation / LaunchAgent 側で管理 |

停止中のものは、旧頻度・入力・出力・停止理由を見せるために残している。`Stopped` は「壊れている」ではなく「自動課金を避けるために止めた / 別実行系へ移した」という意味。

## 24.5 Run Now の内部フロー

`Run Now` は `/api/settings/cron-run` に POST する。

```text
OperationsSettingsClient
  POST /api/settings/cron-run
    -> admin check
    -> operationId を operations-catalog で解決
    -> paramsText を JSON parse
    -> PWA route or GAS function を実行
    -> 結果 JSON を UI に表示
```

PWA route の場合:
- `CRON_SECRET` を Authorization header に付ける
- `params.query` を URL query に変換する
- timeout は 240 秒

GAS function の場合:
- `NEXT_PUBLIC_GAS_WEBAPP_URL`
- `NEXT_PUBLIC_GAS_API_KEY`
- `mode=pwaApi&action=runFunc&fn=...`

`run.type === "manual"` の operation は、API 側でも 400 を返して実行しない。

## 24.6 Run Now できる代表例

2026-05-25 時点で UI から直接起動できる代表例:

| operation | 役割 | default params |
|---|---|---|
| `pwa-member-weekly-activities` | メンバー週次活動抽出 | `{"query":{"save":1}}` |
| `pwa-papers-quarterly-ingest` | OpenAlex / papers ingest | `{}` |
| `pwa-sync-pj-facts` | PJ facts sync | `{}` |
| `pwa-macro-aggregate-indicators` | macro 指標集計 | `{"query":{"since":"YYYY-MM"}}` |
| `pwa-freee-payment-sync` | freee 入金同期 | `{"query":{"ym":"YYYYMM","dryRun":0}}` |
| `pwa-payment-confirm-nudges` | 入金確認 nudge | `{"query":{"ym":"YYYYMM","dryRun":0}}` |
| `pwa-payout-reward-cache-refresh` | 報酬キャッシュ再計算 | `{"query":{"ym":"YYYYMM"}}` |

`dryRun` があるものは、まず `dryRun=1` で挙動確認してから本実行する。

## 24.7 停止中として残す代表例

| operation | 止めている理由 |
|---|---|
| GAS meeting hourly | 旧 LLM / Gemini 系。Claude routine `amd-os-meeting-extract` へ移管予定 |
| GAS L2 knowledge | 旧 LLM / Gemini 系。Claude routine へ移管予定 |
| Atlas collect / policy collect | LLM web search 系。Codex automation / review batch へ移管 |
| Seeds ingest / VC discover | web_search + LLM 系。費用対効果を見て手動 / automation 側で扱う |
| AMD Score L2 refresh | LLM 系。修正依頼ループと一緒に見直す |
| Management Score raw / calculate | Codex automation 側で対象月を明示して実行 |

止まっているからといって、すぐ cron 復活しない。まず [05 章 5.1](05-decisions-and-history.md#51-cron-廃止経緯--2026-05-22-仕様変更の本丸) の cron 廃止経緯を見る。

## 24.8 更新するときのルール

`/admin/settings` の表示内容を変える時は、次を同時に更新する。

| 触るもの | 理由 |
|---|---|
| `pwa/src/lib/operations-catalog.ts` | Raw / L2 / Cron 台帳の正本 |
| [05 章 5.4](05-decisions-and-history.md#54-codex--claude--vercel--launchagent-責務分担マトリクス) | 実行系の責務分担 |
| この章 | admin が読む運用仕様 |
| `pwa/design_log/sessions_YYYY-MM.md` | いつ何を変えたかの履歴 |

operation を追加する時は、`id`, `label`, `layer`, `cadence`, `trigger`, `input`, `output`, `run` を全部埋める。`run` が危ない、LLM 課金が大きい、手動レビューが必要なものは `manual` にして `Run Now` を出さない。

## 24.9 トラブル時

| 症状 | 見る場所 |
|---|---|
| `JSONが壊れてる` | Run Params が JSON として parse できるか |
| `unauthorized` | login できているか |
| `forbidden` | `members.is_admin` が true か |
| `CRON_SECRET is not configured` | Vercel / `.env.local` の `CRON_SECRET` |
| GAS endpoint error | `NEXT_PUBLIC_GAS_WEBAPP_URL` / `NEXT_PUBLIC_GAS_API_KEY` |
| Stopped で押せない | 停止中 operation。05 章と operations-catalog の reason を見る |
