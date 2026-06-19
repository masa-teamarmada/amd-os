# Automation 責務分担仕様

> **この章は何か**: LLM課金 cron 廃止後の、Codex automation / MMOマシン / Vercel cron / GAS / LaunchAgent の責務分担。旧 `/manual/9-1-decisions-and-history` から実装者向け current truth を移植した。
>
> **2026-06-16 注記**: Claude routines 停止前提での L1-L3 抽出移植 inventory / approval bundle / first execution unit は [`5-8-l1-l3-codex-migration-current-spec`](5-8-l1-l3-codex-migration-current-spec) を優先する。この章は helper / applier / non-LLM cron / control layer の責務境界を主に扱う。

## 基本方針

2026-05-22 以降、PWA / GAS / Vercel から Anthropic・Gemini・OpenAI の従量課金 LLM API を定期実行しない。LLM が必要な L2 抽出は、**Codex automation / MMOマシン Codex Desktop automation / approved exception** へ寄せる。

これは「cron 禁止」ではない。DB同期、外部API fetch、通知、キャッシュ更新、入金・請求系など、LLM 非依存の cron は許可される。

## 2026-06-04 Claude routine registration incident

L2抽出をClaude定額token/routineへ載せる方針は決定済みだったが、Claude Routines UIにroutineが1本も見えない状態が確認された。`~/.claude/scheduled-tasks/.../SKILL.md` はローカル手順・素材であり、Claude routineがACTIVE登録されている証拠ではない。

以後、Claude routine化の完了条件は次の4点をすべて満たすこと。

1. Claude Routines UIにroutineが存在する。
2. UI上で `ACTIVE` と `next run` を確認できる。
3. `last run` または初回手動run/dry run evidenceがある。
4. 対象L2のDB row / outbox / applied / UI read evidenceのどれかで実出力を確認できる。

docs-only、SKILL.md作成、過去の「登録完了」記述だけでは完了にしない。

## 2026-06-04 cadence ベース束ね設計 (まさ確定)

事故の根本原因は、L2 を Claude routine に載せたつもりが (a) Mac の Local / Desktop scheduled task に置いていて全 disabled・未実行、(b) Claude routine を止めた理由 = **daily run cap** に対して、複数 L2 を 1 routine に束ねる設計が未着手だった、の二重構造。

### Claude routine = マシン非依存 (重要)

- **Claude routine (cloud / remote)** は Anthropic-managed cloud infrastructure 上で実行される。`claude.ai/code/routines` / CLI `/schedule` / Desktop app のどこから登録しても **同じ claude.ai アカウント**に入り、cloud で発火する。**laptop を閉じても・どのマシンが OFF でも動く** (公式: "they keep working when your laptop is closed")。MMOマシンに置く必要はない。
- これと混同してはいけないのが **Desktop / Local scheduled task** (`~/.claude/scheduled-tasks/`)。これは**マシン依存** (app open + 非スリープ中のみ発火)。事故時はここに 8 個置かれて全 disabled だった。**現行 writer として復活させない**。

### Claude routine の制約 (公式、research preview)

- **最小インターバル 1 時間**。毎時より細かい cron は拒否される。
- **daily run cap** がある (= アカウントごとに 1 日に開始できる run 数。数値は `claude.ai/code/routines` / `claude.ai/settings/usage` で確認。one-off run は cap 外)。
- → **同じ cadence の L2 を 1 routine に束ねて、1 日の run 数を最小化する**のが設計の柱。

### 束ね方 = cadence で 3 routine + MMO automation

L2 を cadence で分類し、**新ナンバリング (D = daily / M = month-end / W = weekly / H = hourly)** を当てる。

| グループ | routine / 実行場所 | cadence | run 消費 |
|---|---|---|---|
| **D-1〜D-11 / D-13** | Claude routine `amd-os-l2-consolidated-evidence` (表示名「AMD OS L2 日次抽出 (D-1〜D-11+D-13 統合)」) | daily 08:00 JST (`0 8 * * *`) | 平常日 +1/日 |
| **D-12** | PWA non-LLM cron `/api/cron/management-score-raw-data?includeFreee=1` + admin review | daily | Claude routine 外 |
| **M-1〜M-3** | Claude routine `amd-os-l2-monthend-evidence` (表示名「AMD OS L2 月末抽出 (M-1月次レポート/M-2 XRL/M-3経営シグナル)」) | 月末候補日 16:00 発火 (`0 16 28-31 * *`)、Phase 0 で最終日判定、最終日のみ本処理、17:00 完了目標 | 月末候補日のみ +1 (空振り含む) |
| **W-1** | Claude routine `amd-os-l2-weekly-vc-funding-signals` (表示名「AMD OS L2 週次抽出 (W-1 VCニュース/資金調達)」) | weekly Saturday 09:00 JST (`0 9 * * 6`) | 週 +1 |
| **H-1** | MMOマシン Windows Task Scheduler `amd-os-l6-meeting-flow-launcher` → `codex exec` Live launcher | 毎時 09:00-21:00 JST | Claude routine 外。2026-06-08 16:00 JST manual Live run 成功、次回 17:00 JST |

平常日の Claude routine run 消費は **1 本だけ**。月末日でも最大 2 本 (D + M)、土曜は W が追加される。H は Codex Desktop automation だけで、Claude routine 化しない。

## L2 writers (新ナンバリング D / M / W / H)

| 新 | 名称 | table | 実行場所 / writer | schedule | apply / evidence |
|---|---|---|---|---|---|
| **D-1** | AMD Protocol | `protocols` / `protocol_examples` | MMO側 Codex Desktop automation `amd-os-l2-protocol-extract` | daily 08:00 JST 相当 | Supabase + notifications。yes は `confirmed` |
| **D-2** | MS Progress | `milestone_monthly_progress` / `project_monthly_notes` | MMO側 Codex Desktop automation `amd-os-l3-ms-progress-extract` + non-LLM `ms-schedule-progress` | daily / hourly mixed | Supabase + revisions。旧 hourly / PWA hourly-estimate 停止 |
| **D-3** | Project Knowledge | `project_knowledge` | MMO側 Codex Desktop automation `amd-os-l4-project-knowledge-extract` | daily 08:15 JST 相当 | candidate → active/rejected |
| **D-4** | Member Knowledge | `member_knowledge` | MMO側 Codex Desktop automation `amd-os-l5-member-knowledge-extract` | daily 08:30 JST 相当 | candidate → active/rejected |
| **D-5** | Registry Diff | `project_registry_diffs` | `amd-os-ms` 系 second wave 予定 | daily target | `outbox.registryDiffs` → LaunchAgent |
| **D-6** | Strategy Signals | `project_strategy_signals` | Codex automation `amd-os` + `AMD OS D-6 経営ハイライト抽出` | daily 03:20 JST | strategy-signals outbox → LaunchAgent |
| **D-7** | Textbook Insights | `textbook_insight_candidates` | local worker `amd-os-l10-textbook-insight-extract` | manual / daily candidate | `outbox.textbookInsights` → candidate + notification。approved 後 local BZM applier |
| **D-8** | Atlas Signals | `atlas_signals` | Codex automation `amd-atlas-2` + `AMD OS D-8 Atlas外部シグナル抽出` | daily 08:10 JST | outbox / apply → `atlas_signals` upsert |
| **D-9** | Macrotrend Evidence / Index | `observation_log` / `macro_index_log` | observation collector planned + PWA non-LLM cron `macro-aggregate-indicators` | daily target + 月初集計 | observation_log upsert。index 集計は LLM 非依存 cron |
| **D-10** | Member Activity Evidence | `member_activities(source='member_weekly')` | Mac Codex automation `amd-os-l2-2` + MMO Task Scheduler launcher `amd-os-l2-member-weekly-activities`。内部 route は Anthropic API を使う例外 | daily 18:30 / 19:30 JST | Dashboard / MyPage read evidence。窓単位 delete-then-upsert + UNIQUE で重複防止 |
| **D-11** | Media Mentions | `project_media_mentions` / `news_mention` notifications | 専用writer未実装 | daily target | media mention candidate + notification |
| **D-12** | Finance Ops Evidence / freee Transaction Actuals | freee `trial_pl` / `company_actual_monthly` / `amd_management_score_raw_signals` / finance ops tables | PWA non-LLM cron `/api/cron/management-score-raw-data?includeFreee=1` + admin review | daily | freee取引履歴 → 月次試算表の実績値 |
| **D-13** | Contract Signals | `contract_signals` / `contracts` / `contract_documents` | PWA route `POST /api/contracts/extract-l2` + Codex collector planned | daily target | 契約管理 `/admin/contracts`、l2_notifications(l2_kind='contract_signals') |
| **M-1** | Monthly Reports | `monthly_reports` | Codex automation `AMD OS M-1 月次報告抽出` (`amd-os-l2`) | month-end / current rrule 05:30 JST | monthly reports outbox → applier。R313 trigger 置かない |
| **M-2** | XRL Evidence | `project_xrl_evidence` / `project_founding_members` | `amd-os-ms` 系 second wave 予定 | 月末最終日 (M-1 後) | candidate → confirmed。M-1が抽出できない月は正規完了扱いにしない |
| **M-3** | Management Monthly Signal | `company_management_signal_reviews` | month-end runner planned | 月末最終日 17:00 完了 | M-1/M-2後に抽出。18:00 月次振り返り MTG 前に出揃わせる |
| **W-1** | VC News / Funding Signals | `vc_news` / `vcs` / `vc_funds` / `vc_investments` / `project_vc_relations` | Codex automation `amd-os-l2-vc-news-funding-signals` | weekly Saturday 09:00 JST | VC / funding signal candidates。review first、safe write path 不明なら blocked summary |
| **H-1** | Meeting Flow | `project_meeting_summaries` / `meeting_assets` | MMOマシン Windows Task Scheduler `amd-os-l6-meeting-flow-launcher` → `codex exec` Live launcher / SKILL `amd-os-l6-meeting-extract` | 毎時 09:00-21:00 JST | Supabase / Calendar / Drive / Gmail draft。Claude routine 化しない。2026-06-08 16:00 JST manual Live run 成功、次回 17:00 JST |

Media Mentions は D-11 として runner 未実装。Finance Ops Evidence / freee Transaction Actuals は D-12 として PWA non-LLM daily cron / admin review / freee sync に置き、LLM抽出writerには混ぜない。Contract Signals は D-13 として existing PWA route を活かし、前段 collector を Codex 側で新設する。W-1 は Codex automation を current writer として扱う。

SKILL 正本は `pwa/scheduled-tasks/amd-os-l2-consolidated-evidence/SKILL.md` (D 群) / `amd-os-l2-monthend-evidence/SKILL.md` (M 群) / `amd-os-l2-weekly-vc-funding-signals/SKILL.md` (W 群) と、各 L2 の個別 `amd-os-l<N>-*/SKILL.md` (= 束ね SKILL が参照する詳細手順)。L2 の品質改善は、PWA route / GAS function ではなく SKILL と outbox/applier contract を更新する。

## Control layer: proactive heartbeat

先手力維持ループは L2 ではなく、L2 と司令塔 / worker をつなぐ control layer。`proactive_outbox` に積まれた `queued` / `blocked` かつ due soon の行を、10:15-20:15 JST の毎時15分 heartbeat が拾い、`project_commander_threads.commander_thread_id` へ `send_message_to_thread` 相当で通知する。

| 項目 | 契約 |
|---|---|
| SKILL 正本 | `pwa/scheduled-tasks/amd-os-proactive-heartbeat/SKILL.md` |
| helper | `node pwa/scripts/proactive_loop_tool.mjs heartbeat --status queued,blocked --due-hours 72 --limit 20 --json` |
| 通知先 | `project_commander_threads.commander_thread_id` または `proactive_outbox.commander_thread_id` |
| 成功後 | `mark-sent <outbox_id>` で `status='sent_to_commander'`, `sent_at=now()`, `proactive_loop_events.event_type='sent_to_commander'` を記録 |
| 禁止 | heartbeat 内で外部送信や重い draft 生成をしない。司令塔 worker に渡す |
| 例外 | routing missing / duplicate risk / network failure は mark-sent せず、AMD OS司令塔へ報告 |

## Control layer: L2 health action ledger

`amd-os-l2-extraction-health-check` は read-only monitor で、DB write / scheduler change / Slack通知 / Notion更新 / 修復実行をしない。その代わり、health output の後段に action ledger を置き、red/yellow を「放置可能な報告」ではなく「owner付き incident」に変換する。

| 項目 | 契約 |
|---|---|
| helper | `node pwa/scripts/l2_health_action_loop.cjs --input pwa/tmp/l2-health-latest.json` |
| npm script | `cd pwa && npm run --silent health:l2:actions -- --input tmp/l2-health-latest.json` |
| ledger | `pwa/tmp/l2-health-action-ledger.json` |
| write scope | local artifact のみ。DB / Notion / Slack / Drive / scheduler / LaunchAgent は触らない |
| dedupe | health row id / failureMode / destination から内部の重複判定キーを作る。ただしUIや手順の主語は health output の row id / row name にする |
| owner | verification / review drain / outbox drain / extraction recovery / scheduler evidence のいずれか |
| worker化 | `currentOpenWorkerPrompts[]` を司令塔が visible worker prompt として使う |
| close | 次回 health で該当 L2 が green、または review/outbox が分類済みになった証跡がある時だけ |

recurring automation としてこの後段を既存 health check に組み込む場合も、automation.toml や Codex automation 登録の変更は scheduler change bundle に対象・影響・rollbackを明記して別タスク化する。repo 側 helper の追加だけでは scheduler を変更した扱いにしない。

## Stopped LLM cron

| 旧経路 | 状態 | 理由 |
|---|---|---|
| GAS 153 MeetingHourlyTrigger | stopped / kill switch | H-1 は MMO automation へ移管 |
| GAS 155 L2KnowledgeExtractor | stopped / kill switch | D-1 / D-3 / D-4 は MMO / Codex 系へ移管 |
| GAS 152 NavigatorCron | stopped / kill switch | 旧 fallback 月次抽出 |
| PWA `/api/cron/hourly-estimate` | disabled unless explicit guard | D-2 は non-LLM default + MMO revision path |
| `venture-xrl-refresh` cron | schedule disabled | Gemini 2.5 Flash を定期実行しない |

「cron 復活」は原則として提案しない。必要なら、token 課金なしの処理であることを code と spec に明記する。

## Allowed Vercel cron

現行 allowed は LLM 非依存の運用系。追加する場合も同じ基準を満たす。

| cron | 役割 | LLM |
|---|---|---|
| `freee-payment-sync` | freee API → Supabase 入金同期 | no |
| `payment-confirm-nudges` | 入金確認通知 | no |
| `payout-reward-cache-refresh` | 報酬 cache 再計算 | no |
| `papers-quarterly-ingest` | 論文 ingest | no |
| `sync-pj-facts` | PJ メタ同期 | no |
| `macro-aggregate-indicators` | マクロ指標集計 | no |

`member-weekly-activities` は Anthropic 経路があるため active cron から外す。

## D-10 の current writer

D-10 は抽出漏れ実害が出たため、唯一「複数 writer の冗長並走」を正とする。**current truth** では Mac / MMO の Codex writer が route を叩く。抽出ロジックは PWA route `/api/cron/member-weekly-activities` 側にあり (per-member OAuth Gmail/Calendar read)、writer は route を叩くトリガ。

| # | writer | 実行場所 | schedule (JST) | 仕組み |
|---|---|---|---|---|
| 1 | Codex automation `amd-os-l2-2` (`AMD OS D-10 メンバー活動根拠抽出 (Mac)`) | Mac (このマシン) | daily 18:30 | Codex Desktop が toml rrule で発火 → route curl。当日18時締め窓を即日抽出 |
| 2 | Windows Task Scheduler `amd-os-l2-member-weekly-activities` | MMO マシン | daily 19:30 | launcher `run-d10.ps1` (`Invoke-RestMethod`) → route 実行。logs/ に JSON + latest-status.txt。**MMO の Codex Desktop scheduler は toml rrule を尊重しない既知問題があるため launcher 方式** |

**重複排除は route が構造的に保証**: 窓 (前日18:00〜当日18:00) 単位の delete-then-upsert + UNIQUE(member_id, project_id, source, source_item_id)。複数 writer が同じ窓を処理しても、後着 writer が窓を再構築するだけで重複行はできない。

**例外**: この route 内部では Anthropic API を使う。D-10 だけは、まさ判断で定額外トークンを許容する。

## Outbox applier

LaunchAgent は Codex automation の outbox を Supabase に反映する非LLM applier。

| 項目 | 契約 |
|---|---|
| polling | 5 分ごと |
| 成功時 | `outbox/applied/` へ移動 |
| 失敗時 | artifact を残し、run summary に件数・原因・duplicate risk を明記 |
| 禁止 | automation が DB に直接 bypass write して outbox を飛ばすこと |

新しい automation outbox を追加したら、`scripts/run-ms-outbox-applier.sh` の監視対象へ明示追加する。

D-7 は既存 `amd-os-ms/outbox` の `textbookInsights` payload を使うため監視ディレクトリ追加は不要。ただし approved candidate を `pwa/bzm/*.md` に反映する local applier は git file を触る別段階であり、LaunchAgent の DB outbox applier だけでは完了しない。

## 再発防止

大規模な writer 移管を行うときは、停止対象と後継担当を 1 対 1 で表にしてから止める。2026-05-25 の D-1D-3D-4H-1 ghost 化は、GAS 4 個停止と Codex automation 2 個追加の「数」だけ見て、実カバー範囲を検証しなかったことが原因。
