# Operations Settings 仕様

`/admin/settings` は、AMD OS の Raw Data / L2 Data / Cron Control を一覧化する admin 専用画面。何がどこから入り、どの処理が動いていて、どれが止まっているかを確認するための運用台帳。

## 画面構成

URL: `/admin/settings`

| ブロック | 内容 |
|---|---|
| Operations Settings | Raw Data、L2 Data、Cron Control |
| DB Settings | `settings` table の key/value |

admin 以外は `notFound()` で見えない。

## Raw Data

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

## L2 Data

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

2026-05-25 時点の注意:
- ① `monthly_reports` は AMD-Report GAS R313 が別 clasp で生成し、PWA の report route / backfill route が補助する。
- ③ `milestone_monthly_progress` は GAS 154 -> PWA `/api/cron/hourly-estimate` が primary writer。Codex automation `amd-os-ms` は修正候補レビュー / OS 台帳差分 / XRL 根拠を outbox に出す。
- ②④⑤⑥ は 5/22 の LLM cron 停止以降 ghost 状態。復旧計画は [03 章](03-data-and-extraction.md) と `pwa/design/l2_extract_claude_routine.md` を見る。

## Cron Control の読み方

Cron Control は「実行ボタン」ではなく、まず状態台帳として読む。

| 表示 | 意味 |
|---|---|
| `Run Now` | PWA route または GAS function を admin 権限で手動起動できる |
| `Stopped` | 停止中。旧 LLM cron や Codex automation 移管済みで、UI から直接起動しない |
| `layer=GAS` | GAS web app 経由 |
| `layer=PWA` | PWA API route 経由 |
| `layer=Codex` | Codex automation / LaunchAgent 側で管理 |

停止中のものは、旧頻度・入力・出力・停止理由を見せるために残している。`Stopped` は「壊れている」ではなく「自動課金を避けるために止めた / 別実行系へ移した」という意味。

## Run Now の内部フロー

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

## Run Now できる代表例

2026-05-25 時点で UI から直接起動できる代表例:

| operation | 役割 | default params |
|---|---|---|
| `pwa-hourly-estimate` | MS進捗 hourly estimate を手動キック | `{"query":{"maxItems":3}}` |
| `pwa-member-weekly-activities` | メンバー週次活動抽出 | `{"query":{"save":1}}` |
| `pwa-papers-quarterly-ingest` | OpenAlex / papers ingest | `{}` |
| `pwa-sync-pj-facts` | PJ facts sync | `{}` |
| `pwa-macro-aggregate-indicators` | macro 指標集計 | `{"query":{"since":"YYYY-MM"}}` |
| `pwa-freee-payment-sync` | freee 入金同期 | `{"query":{"ym":"YYYYMM","dryRun":0}}` |
| `pwa-payment-confirm-nudges` | 入金確認 nudge | `{"query":{"ym":"YYYYMM","dryRun":0}}` |
| `pwa-payout-reward-cache-refresh` | 報酬キャッシュ再計算 | `{"query":{"ym":"YYYYMM"}}` |

`dryRun` があるものは、まず `dryRun=1` で挙動確認してから本実行する。

`pwa-hourly-estimate` は L2 ③ MS 進捗の primary writer。通常は GAS 154 が毎時 0 分に叩く。UI からの `Run Now` は詰まり確認や小さな再実行用なので、default は `maxItems=3` に抑えている。全件再推定したい時は [36 章](36-ms-progress-monthly-report-revision-spec.md) の `force=1` / `ym=YYYYMM` / `maxItems` の意味を確認してから実行する。

`pwa-payment-confirm-nudges` は Slack DM を実送信する処理。対象 group、予定税込額、admin 送信先だけ確認したい時は `{"query":{"ym":"YYYYMM","dryRun":1}}` を使う。signed token と `/payment-confirm` の仕様は [25 章](25-finance-payment-confirm-spec.md)。

## 停止中として残す代表例

| operation | 止めている理由 |
|---|---|
| GAS meeting hourly | 旧 LLM / Gemini 系。Claude routine `amd-os-l6-meeting-extract` へ移管済 (= 2026-05-25 まさ #71) |
| GAS L2 knowledge | 旧 LLM / Gemini 系。Claude routine `amd-os-l2..l5-*-extract` へ移管済 (= 2026-05-25 まさ #71) |
| Claude routine `amd-os-l<N>-<data>-extract` | 2026-05-25 まさ #71 確定。L2 ②〜⑨ すべて Claude routine に統一。`CronOperation.layer="Claude"` で `operations-catalog.ts` に登録、`run.type="manual"` (= `~/.claude/scheduled-tasks/` ローカル cron、PWA から直接叩けない、Claude Code セッション経由で実行)。詳細は [05 章 §5.7](05-decisions-and-history.md#57-l2-②④⑤⑥-ghost-化と-claude-routine-4-個新設計画--2026-05-25) + 設計議論 [`pwa/design/l2_extract_claude_routine.md`](../design/l2_extract_claude_routine.md) |
| Atlas collect / policy collect | LLM web search 系。Codex automation / review batch へ移管 |
| Seeds ingest / VC discover | web_search + LLM 系。費用対効果を見て手動 / automation 側で扱う |
| AMD Score L2 refresh | LLM 系。修正依頼ループと一緒に見直す |
| Management Score raw / calculate | Codex automation 側で対象月を明示して実行。raw -> calculate の順序と 5 軸ロジックは [29 章](29-management-score-and-finance-simulation-spec.md) |

止まっているからといって、すぐ cron 復活しない。まず [05 章 5.1](05-decisions-and-history.md#51-cron-廃止経緯--2026-05-22-仕様変更の本丸) の cron 廃止経緯を見る。

## 手動 route と Run Now に出さない route

PWA route は存在するが、UI の `Run Now` には出さない運用 job がある。理由は、LLM 課金が大きい、範囲指定を間違えると広く書き換える、または事前に対象確認が必要だから。

| operation | route | 理由 |
|---|---|---|
| `manual-monthly-reports-backfill` | `/api/cron/monthly-reports-backfill` | missing `monthly_reports` を Sonnet で生成する重い backfill。`limit` / `concurrency` と対象月を確認してから使う |
| `manual-freeze-period-backfill` | `/api/cron/freeze-period-backfill` | 休止期間 PJ の reports + meetings を Sonnet で統合する。対象 PJ と再開月の確認が必要 |
| `manual-triple-helix-recompute` | `/api/cron/triple-helix-recompute` | ASPI 8 domain × 16 quarter の BVAR/Kalman 再計算。時間と投入データを確認してから使う |
| `manual-management-score-raw` | `/api/cron/management-score-raw-data` | Management Score は raw -> calculate の順番がある |
| `manual-management-score-calc` | `/api/cron/management-score-calculate` | raw 収集後に対象月を明示して実行する |

これらは `operations-catalog.ts` では `run.type="manual"` にして、`/api/settings/cron-run` が 400 を返すようにする。手動で使う時は、36 章 / 29 章 / 対応する design md を読んでから `curl` または Codex automation 側で実行する。

ASPI / Macrotrend 系には、route は残っているが Vercel schedule と Run Now から外している LLM-backed job もある。

| route | 状態 | 認証 | 使う時の前提 |
|---|---|---|---|
| `/api/cron/lane-suggest` | stopped | `CRON_SECRET` | 新規 PJ の `project_ventures.lanes` 候補を `lane_suggestions` に保存する。承認は `/admin/projects` |
| `/api/cron/kaken-ingest` | stopped | `CRON_SECRET` | KAKEN OpenSearch + fallback LLM で `observation_log key=I_R` を補完 |
| `/api/cron/grant-ingest` | stopped | `CRON_SECRET` | NEDO / JST / AMED 採択情報 + fallback LLM で `observation_log key=B` を補完 |
| `/api/cron/vc-investment-ingest` | stopped | `CRON_SECRET` | VC news + LLM で `observation_log key=V` を補完 |
| `/api/cron/relearn-lane-weights` | stopped | `CRON_SECRET` | `macro_lane_weights` を Sonnet で再推定。復活時は最新 ASPI 8 domain と before-zero model の確認が必要 |
| `/api/cron/macro-backfill-historical` | stopped | `CRON_SECRET` | 2010-2025 の `macro_index_log` を chunk + retry で補完。`lane`, `startYear`, `endYear` を絞って実行する |

これらは `pwa/design/aspi_lanes.md` と [34 章](34-atlas-macrotrend-signal-spec.md) が詳細仕様。`CRON_SECRET` で守られていても、LLM費用と広範囲 upsert があるため、再開は owner 承認後にする。

## Cron / source route 棚卸し

`/admin/settings` の Cron Control は「全 API route 一覧」ではない。用途別に以下のように分ける。

| 種類 | route 例 | 表示方針 |
|---|---|---|
| 実行中の運用 cron | `/api/cron/freee-payment-sync`, `/api/cron/member-weekly-activities`, `/api/cron/hourly-estimate` | Run Now または active operation として表示 |
| 停止中だが仕様を残す cron | `/api/cron/amd-score-l2-refresh`, `/api/cron/member-activities`, `/api/cron/venture-narrative-refresh` | Stopped / manual reason を表示 |
| backfill / recompute | `/api/cron/monthly-reports-backfill`, `/api/cron/freeze-period-backfill`, `/api/cron/triple-helix-recompute` | `manual-*` operation として棚卸しだけ表示 |
| source refs collect | `/api/sources/gmail/collect`, `/api/sources/slack/collect` | Raw Data / L2 入力として説明。Cron Control には原則出さない |
| 画面補助 API | `/api/progress/ms-schedule`, `/api/rewards/sync`, `/api/mypage/weekly-activities/refresh` | 各画面仕様の章で説明。Cron Control には出さない |

`source_cache` は全文保存の正本ではなく、短い snippet / hash / source_url の証跡キャッシュ。Gmail / Slack 取り込み route は `Bearer CRON_SECRET` で守り、取り込み完了通知は作らない。

## 更新するときのルール

`/admin/settings` の表示内容を変える時は、次を同時に更新する。

| 触るもの | 理由 |
|---|---|
| `pwa/src/lib/operations-catalog.ts` | Raw / L2 / Cron 台帳の正本 |
| [05 章 5.4](05-decisions-and-history.md#54-codex--claude--vercel--launchagent-責務分担マトリクス) | 実行系の責務分担 |
| この章 | admin が読む運用仕様 |
| `pwa/design_log/sessions_YYYY-MM.md` | いつ何を変えたかの履歴 |

operation を追加する時は、`id`, `label`, `layer`, `cadence`, `trigger`, `input`, `output`, `run` を全部埋める。`run` が危ない、LLM 課金が大きい、手動レビューが必要なものは `manual` にして `Run Now` を出さない。

## トラブル時

| 症状 | 見る場所 |
|---|---|
| `JSONが壊れてる` | Run Params が JSON として parse できるか |
| `unauthorized` | login できているか |
| `forbidden` | `members.is_admin` が true か |
| `CRON_SECRET is not configured` | Vercel / `.env.local` の `CRON_SECRET` |
| GAS endpoint error | `NEXT_PUBLIC_GAS_WEBAPP_URL` / `NEXT_PUBLIC_GAS_API_KEY` |
| Stopped で押せない | 停止中 operation。05 章と operations-catalog の reason を見る |
| 入金確認 nudge が飛ばない | `SLACK_BOT_TOKEN`, admin の `slack_id`, [25 章](25-finance-payment-confirm-spec.md) |
| MS進捗が増えない | `gas/154_PwaCronCaller.js` の `NAV_PWA_HOURLY_ESTIMATE_DISABLED_20260522` が `false` か、GAS trigger が `nav_pwa_pingHourlyEstimate` を持つか、PWA `/api/cron/hourly-estimate` が 401/500 を返していないか |
