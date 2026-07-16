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
| Score Inputs | `amd_score_inputs` | SPS input (`prs_potential`, `prs_r_net`) と legacy M-X-F 入力値・根拠 |

この一覧は `operations-catalog.ts` の `l2Datasets` が正本。

2026-05-29 時点の注意:
- M-1 `monthly_reports` は OS の必須データなので生成対象。primary writer は Codex automation `AMD OS M-1 月次報告抽出` (= daily 05:30 JST) で、`amd-os-ms/outbox.monthlyReports` を非LLM helper が反映する。PWA の report route / backfill route、月次報告モーダルの手動生成・修正、AMD-Report GAS R313 は復旧・手動編集・旧経路。R313 は未生成/差分あり時に Claude API を呼びうるため、2026-05-29 実画面確認時点では `run_monthlyReportCron` / `run_L2CronDaily` trigger を置いていない。
- D-2 `milestone_monthly_progress` は **MMOマシン automation `amd-os-l3-ms-progress-extract`** が primary writer。GAS 154 -> PWA `/api/cron/hourly-estimate` は 2026-05-29 に再停止済み。Codex automation `amd-os-ms` は修正候補レビュー / OS 台帳差分 / XRL 根拠を outbox に出す。
- D-1D-3D-4H-1 は旧 GAS LLM cron から subscription automation へ移管済み。D-1D-3D-4は **MMOマシン Codex Desktop automation** (`amd-os-l2-protocol-extract` / `amd-os-l4-project-knowledge-extract` / `amd-os-l5-member-knowledge-extract`)、H-1は **Windows MMO Codex Desktop automation `amd-os-l6-meeting-flow`**。D-7 Textbook Insights は approved 後に local BZM applier が `pwa/bzm/*.md` へ追記する。復旧時は [3-2 章](3-2-data-and-extraction.md) と [8-3 章](8-3-l2-extraction-routines-spec.md) の M/W/D/H L2 抽出ルート表を見る。

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

2026-05-29 時点で UI から直接起動できる代表例:

| operation | 役割 | default params |
|---|---|---|
| `pwa-papers-quarterly-ingest` | OpenAlex / papers ingest | `{}` |
| `pwa-sync-pj-facts` | PJ facts sync | `{}` |
| `pwa-macro-aggregate-indicators` | macro 指標集計 | `{"query":{"since":"YYYY-MM"}}` |
| `pwa-freee-payment-sync` | freee 入金同期 | `{"query":{"ym":"YYYYMM","dryRun":0}}` |
| `pwa-payment-confirm-nudges` | 入金確認 nudge | `{"query":{"ym":"YYYYMM","dryRun":0}}` |
| `pwa-payout-reward-cache-refresh` | 報酬キャッシュ再計算 | `{"query":{"ym":"YYYYMM"}}` |

`dryRun` があるものは、まず `dryRun=1` で挙動確認してから本実行する。

`pwa-hourly-estimate` と `pwa-member-weekly-activities` の legacy synthesis は旧 PWA LLM cron。2026-05-29 に停止済みで、`ALLOW_PWA_LLM_CRONS=1` なしでは LLM を呼ばない。D-10 の定期抽出は PWA route の `mode=evidence` と Codex automation の POST 保存で行う。MS進捗の定期抽出は **MMOマシン automation `amd-os-l3-ms-progress-extract`** 側で行う。

`pwa-payment-confirm-nudges` は Slack DM を実送信する処理。対象 group、予定税込額、admin 送信先だけ確認したい時は `{"query":{"ym":"YYYYMM","dryRun":1}}` を使う。入金日当日の候補だけが送信対象なので、過去/未来日の判定を検証する時は `{"query":{"ym":"YYYYMM","date":"YYYY-MM-DD","dryRun":1}}` を使う。signed token と `/payment-confirm` の仕様は [6-4 章](6-4-finance-payment-confirm-spec.md)。

## 停止中として残す代表例

| operation | 止めている理由 |
|---|---|
| GAS R313 monthly report trigger | M-1の定期 writer は Codex automation `AMD OS M-1 月次報告抽出`。R313 は従量課金 Claude API を呼びうる旧経路なので trigger 復活しない |
| GAS meeting hourly | 旧 LLM / Gemini 系。Windows MMO Codex Desktop automation `amd-os-l6-meeting-flow` へ移管済 |
| PWA hourly-estimate | 旧 MS進捗 writer。定期抽出は MMOマシン automation `amd-os-l3-ms-progress-extract` へ移管済 |
| PWA member-weekly-activities | UI からは停止のまま。現在の定期 writer は Codex 側 (`AMD OS D-10 メンバー活動根拠抽出 (Mac)`) で、route は evidence 収集と Codex合成結果の POST 保存だけを担う。legacy GET synthesis は復活させない |
| GAS L2 knowledge | 旧 LLM / Gemini 系。D-1D-3D-4は MMOマシン Codex Desktop automation `amd-os-l2/l4/l5-*-extract` へ移管済 |
| Claude routine `amd-os-l<N>-<data>-extract` | 2026-05-25〜26 の移行検討/一部登録の履歴。現行判断では、復旧・運用確認は 3-2 / 8-3 の **実行場所 + automation** 表を見る。PWA から直接叩く対象ではない |
| Atlas collect / policy collect | LLM web search 系。Codex automation / review batch へ移管 |
| Seeds ingest / VC discover | web_search + LLM 系。費用対効果を見て手動 / automation 側で扱う |
| AMD Score L2 refresh | LLM 系。修正依頼ループと一緒に見直す |
| Management Score raw / calculate | Codex automation 側で対象月を明示して実行。raw -> calculate の順序と 5 軸ロジックは [4-5 章](4-5-management-score-and-finance-simulation-spec.md) |

止まっているからといって、すぐ cron 復活しない。まず [9-1 章 5.1](9-1-decisions-and-history.md#51-cron-廃止経緯--2026-05-22-仕様変更の本丸) の cron 廃止経緯を見る。

## 手動 route と Run Now に出さない route

PWA route は存在するが、UI の `Run Now` には出さない運用 job がある。理由は、LLM 課金が大きい、範囲指定を間違えると広く書き換える、または事前に対象確認が必要だから。

| operation | route | 理由 |
|---|---|---|
| `manual-monthly-reports-backfill` | `/api/cron/monthly-reports-backfill` | missing `monthly_reports` を Sonnet で生成する重い backfill。`limit` / `concurrency` と対象月を確認してから使う。R313 trigger が止まっていても、この route を手動実行すれば token 課金は発生しうる |
| `manual-freeze-period-backfill` | `/api/cron/freeze-period-backfill` | 休止期間 PJ の reports + meetings を Sonnet で統合する。対象 PJ と再開月の確認が必要 |
| `manual-triple-helix-recompute` | `/api/cron/triple-helix-recompute` | ASPI 8 domain × 16 quarter の BVAR/Kalman 再計算。時間と投入データを確認してから使う |
| `manual-management-score-raw` | `/api/cron/management-score-raw-data` | Management Score は raw -> calculate の順番がある |
| `manual-management-score-calc` | `/api/cron/management-score-calculate` | raw 収集後に対象月を明示して実行する |

これらは `operations-catalog.ts` では `run.type="manual"` にして、`/api/settings/cron-run` が 400 を返すようにする。手動で使う時は、4-8 章 / 4-5 章 / 対応する design md を読んでから `curl` または Codex automation 側で実行する。

ASPI / Macrotrend 系には、route は残っているが Vercel schedule と Run Now から外している LLM-backed job もある。

| route | 状態 | 認証 | 使う時の前提 |
|---|---|---|---|
| `/api/cron/lane-suggest` | stopped | `CRON_SECRET` | 新規 PJ の `project_ventures.lanes` 候補を `lane_suggestions` に保存する。承認は `/admin/projects` |
| `/api/cron/kaken-ingest` | stopped | `CRON_SECRET` | KAKEN OpenSearch + fallback LLM で `observation_log key=I_R` を補完 |
| `/api/cron/grant-ingest` | stopped | `CRON_SECRET` | NEDO / JST / AMED 採択情報 + fallback LLM で `observation_log key=B` を補完 |
| `/api/cron/vc-investment-ingest` | stopped | `CRON_SECRET` | VC news + LLM で `observation_log key=V` を補完 |
| `/api/cron/relearn-lane-weights` | stopped | `CRON_SECRET` | `macro_lane_weights` を Sonnet で再推定。復活時は最新 ASPI 8 domain と before-zero model の確認が必要 |
| `/api/cron/macro-backfill-historical` | stopped | `CRON_SECRET` | 2010-2025 の `macro_index_log` を chunk + retry で補完。`lane`, `startYear`, `endYear` を絞って実行する |

これらは `pwa/design/aspi_lanes.md` と [4-2 章](4-2-atlas-macrotrend-signal-spec.md) が詳細仕様。`CRON_SECRET` で守られていても、LLM費用と広範囲 upsert があるため、再開は owner 承認後にする。

## Cron / source route 棚卸し

`/admin/settings` の Cron Control は「全 API route 一覧」ではない。用途別に以下のように分ける。

| 種類 | route 例 | 表示方針 |
|---|---|---|
| 実行中の運用 cron | `/api/cron/freee-payment-sync`, `/api/cron/payment-confirm-nudges`, `/api/cron/payout-reward-cache-refresh` | Run Now または active operation として表示 |
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
| [9-1 章 5.4](9-1-decisions-and-history.md#54-codex--claude--vercel--launchagent-責務分担マトリクス) | 実行系の責務分担 |
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
| Stopped で押せない | 停止中 operation。9-1 章と operations-catalog の reason を見る |
| 入金確認 nudge が飛ばない | `SLACK_BOT_TOKEN`, admin の `slack_id`, [6-4 章](6-4-finance-payment-confirm-spec.md) |
| MS進捗が増えない | `amd-os-l3-ms-progress-extract` の実行履歴、`progress_estimate_state.source_hash`、月次モーダルの手動「AIで再推定」。PWA/GAS hourly は停止済みなので復旧対象にしない |
