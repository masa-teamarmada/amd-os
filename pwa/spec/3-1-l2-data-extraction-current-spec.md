# L2 データ抽出 / Outbox 仕様

> **この章は何か**: AMD OS の中核データである L2 と、5 生データ、Claude routine / Codex Desktop automation / Codex automation / PWA non-LLM cron / outbox / LaunchAgent 反映の確定仕様。運用者向けの読み方は `/manual/3-2-data-and-extraction` と `/manual/8-3-l2-extraction-routines-spec` にも置く。移行中は両方を更新する。

## 2026-06-04 registration gate

Claude定額token/routineへ載せるL2について、`~/.claude/scheduled-tasks/.../SKILL.md` が存在するだけでは登録済みと扱わない。**Claude routine** と呼べるのは、Claude Routines UI上で存在し、`ACTIVE`、`next run`、`last run` を確認できるものだけ。

2026-06-04時点で、Claude Routines UIにroutineが1本も見えない事故が確認された。過去docsの「routine登録完了」「subscription automationで稼働」等の記述は、UI証跡が無い限り current truth として使わない。

**Claude routine = マシン非依存**: Claude routine (cloud) は Anthropic-managed cloud infrastructure で実行され、`claude.ai/code/routines` / CLI `/schedule` / Desktop app のどこから登録しても同じ claude.ai アカウントに入る。**laptop を閉じても・どのマシンが OFF でも動く**。MMOマシンに置く必要はない。これと混同してはいけないのが Desktop / Local scheduled task (`~/.claude/scheduled-tasks/`) で、こちらは**マシン依存** (app open + 非スリープ中のみ)。事故時はここに全 disabled で置かれていた。

**制約**: Claude routine は最小インターバル 1 時間、daily run cap あり (one-off は cap 外)。→ **同じ cadence の L2 を 1 routine に束ねて run 数を最小化**する。

是正ターゲット (= 2026-06-08 まさ確定の cadence ベース束ね、新ナンバリング D / M / W / H):

| runtime | 対象 (新ナンバリング) | cadence | completion evidence |
|---|---|---|---|
| Claude routine `amd-os-l2-consolidated-evidence` | **D-1〜D-11 / D-13** = daily LLM L2 | daily 08:00 JST (`0 8 * * *`)、平常日 run +1 | Claude Routines UI `ACTIVE / next run / last run`、初回 one-off dry run |
| Claude routine `amd-os-l2-monthend-evidence` | **M-1〜M-3** = month-end L2 | 月末候補日 16:00 発火 (`0 16 28-31 * *`)、最終日判定、17:00 完了 | UI 登録証跡 + run evidence |
| Claude routine `amd-os-l2-weekly-vc-funding-signals` | **W-1** = VC News / Funding Signals | weekly Saturday 09:00 JST (`0 9 * * 6`) | UI 登録証跡 + `vc_news` / review outbox evidence |
| MMOマシン Codex実行系 | **H-1** = Meeting Flow | 毎時 09:00-21:00 JST | 2026-06-08時点の実稼働は Windows Task Scheduler `amd-os-l6-meeting-flow-launcher` → `codex exec` Live launcher。manual Live run 成功と次回run時刻を証跡にする。Claude routine 化しない |
| PWA non-LLM cron | **D-12** = Finance Ops Evidence / freee Transaction Actuals、D-9 の `macro_index_log` 集計など | D-12: `/api/cron/management-score-raw-data?includeFreee=1` daily / D-9 index: `/api/cron/macro-aggregate-indicators` monthly | code 上 LLM 非依存であること |

注: D-10 は `Member Activity Evidence` と呼び、旧「Member Weekly Activities」表記を廃止する。M-2 / M-3 は M-1 Monthly Reports を入力に含むため、M-1 が抽出できない月は正規完了扱いにしない。Media Mentions は D-11、Finance Ops Evidence / freee Transaction Actuals は D-12、Contract Signals は D-13、VC News / Funding Signals は W-1 とする。

PWA/Vercel background LLM cronはL2抽出用途では復活させない。

## 5 生データ

L2 抽出は必ず次の 5 種類を対象にする。

| 生データ | 例 |
|---|---|
| Gmail | メール、添付ファイル、外部関係者連絡 |
| Drive | Docs / Slides / Sheets / PDF / Office file |
| Calendar | event title / description / attendees / color |
| Slack | channel message / thread / file |
| Notion | 議事録 DB / PJ DB / page 本文 |

`source_cache` は旧 L1 正本ではなく、source refs / short snippet / hash の証跡キャッシュ。メール全文・議事録全文・Slack全文を L2 row に保存しない。

## L2 writers (新ナンバリング D / M / W / H)

cadence ベースで束ねた新ナンバリング: **D = daily** (Claude routine `amd-os-l2-consolidated-evidence`、08:00 JST。ただし D-12 は PWA non-LLM daily cron) / **M = month-end** (Claude routine `amd-os-l2-monthend-evidence`、月末最終日 16:00→17:00) / **W = weekly** (Claude routine `amd-os-l2-weekly-vc-funding-signals`、土曜 09:00 JST) / **H = hourly** (MMOマシン Codex Desktop automation)。

| 新 | data | table | target writer | 反映 |
|---|---|---|---|---|
| **D-1** | AMD Protocol | `protocols` / `protocol_examples` | Claude routine `amd-os-l2-consolidated-evidence` | Supabase + notifications。yes は `confirmed` |
| **D-2** | MS Progress | `milestone_monthly_progress` / `project_monthly_notes` | Claude routine `amd-os-l2-consolidated-evidence` | Supabase + revisions |
| **D-3** | Project Knowledge | `project_knowledge` | Claude routine `amd-os-l2-consolidated-evidence` | candidate → active/rejected |
| **D-4** | Member Knowledge | `member_knowledge` | Claude routine `amd-os-l2-consolidated-evidence` | candidate → active/rejected |
| **D-5** | Registry Diff | `project_registry_diffs` | Claude routine `amd-os-l2-consolidated-evidence` | outbox → applier / notification |
| **D-6** | Strategy Signals | `project_strategy_signals` | Claude routine `amd-os-l2-consolidated-evidence` | strategy-signals outbox → applier |
| **D-7** | Textbook Insights | `textbook_insight_candidates` | Claude routine `amd-os-l2-consolidated-evidence` | candidate + notification → approved → local BZM applier |
| **D-8** | Atlas Signals | `atlas_signals` / derived `atlas_stories` / `atlas_reports` | Claude routine `amd-os-l2-consolidated-evidence` | `POST /api/atlas/signals-ingest` → upsert。派生 stories/reports は別系統 |
| **D-9** | Macrotrend Evidence / Index | `observation_log` / `macro_index_log` / derived `macro_lane_weights` / `triple_helix_state_log` | Claude routine `amd-os-l2-consolidated-evidence` + PWA non-LLM cron `macro-aggregate-indicators` | observation_log upsert + index 集計 |
| **D-10** | Member Activity Evidence | `member_activities` | Claude routine `amd-os-l2-consolidated-evidence` | Dashboard / MyPage / admin |
| **D-11** | Media Mentions | `project_media_mentions` / `news_mention` notifications | Claude routine `amd-os-l2-consolidated-evidence` | media mention candidate + notification |
| **D-12** | Finance Ops Evidence / freee Transaction Actuals | freee `trial_pl` / `company_actual_monthly` / `amd_management_score_raw_signals` / finance ops tables | PWA non-LLM cron `/api/cron/management-score-raw-data?includeFreee=1` + admin review | freee取引履歴 → 月次試算表の実績値 |
| **D-13** | Contract Signals | `contract_signals` / `contracts` / `contract_documents` | Claude routine `amd-os-l2-consolidated-evidence` Phase K + PWA route `POST /api/contracts/extract-l2` | 契約管理 `/admin/contracts`、l2_notifications(l2_kind='contract_signals') |
| **M-1** | Monthly Reports | `monthly_reports` | Claude routine `amd-os-l2-monthend-evidence` | monthly reports outbox → applier |
| **M-2** | XRL Evidence | `project_xrl_evidence` / `project_founding_members` | Claude routine `amd-os-l2-monthend-evidence` | M-1後に抽出。candidate → confirmed |
| **M-3** | Management Monthly Signal | `company_management_signal_reviews` | Claude routine `amd-os-l2-monthend-evidence` | M-1 / M-2後に抽出。18:00 MTG 前に出揃わせる |
| **W-1** | VC News / Funding Signals | `vc_news` / `vcs` / `vc_funds` / `vc_investments` / `project_vc_relations` | Claude routine `amd-os-l2-weekly-vc-funding-signals` | reviewable candidates。安全な write path が曖昧なら outbox / blocked summary |
| **H-1** | Meeting Flow | `project_meeting_summaries` / `meeting_assets` | MMOマシン Windows Task Scheduler `amd-os-l6-meeting-flow-launcher` → `codex exec` Live launcher | Supabase / Calendar / Drive / Gmail draft。Claude routine 化しない。2026-06-08 16:00 JST manual Live run 成功、次回 17:00 JST |

## H-1 MTG サマリの開催済みソース guard

`project_meeting_summaries` は準備カードと開催済み議事録を同じ table に別 row で持つ。準備カードは `meeting_id='upcoming:<calendar_event_id>'` / `source_kinds='upcoming'`、開催済み議事録は `meeting_id='<calendar_event_id>'`。既存準備カードを削除せず、開催済み row には `prep_source_meeting_id` が使える場合だけ `upcoming:<calendar_event_id>` を入れる。

H-1 writer は、次のいずれかがある event を upcoming だけで完了扱いにしない。

- Calendar event attachments / conference notes / description に Gemini / Google Meet notes の Google Docs link がある
- Notion 議事録ページの `eventId` が空でも、同日または近接日、title token、attendees、PJ context、Gemini / Drive / Gmail URL で該当 Calendar event へ fallback match できる
- `projects.report_emails` が空の PJでも、Gemini notes sender や follow-up Gmail が event title / PJ / client / attendee 文脈で hit する

fallback match は `confidence` と `needs_review` を run summary / candidate metadata に残す。`projects.report_emails` の不足は自動 DB 更新せず、`project_registry_diffs` または通知/outbox の config gap として出す。

Executable guard: `cd pwa && npm run test:l6-held-source-guard`。fixture は飯野さんケース相当 (`Calendar添付Geminiメモ + Notion eventId空 + report_emails空 + 既存upcoming行`) で、開催済み `meeting_id=<event_id>` 候補、`source_kinds` に `drive/gmail/notion`、`prep_source_meeting_id`、config gap が出ることを検査する。

## Writer 境界

- D/M/W の LLM 抽出は Claude routine が target writer。Claude Routines UIの `ACTIVE / next run / last run` と初回 evidence が揃うまで、暫定 automation は差分リスクとして扱う。
- H-1 (= H-1) だけ MMOマシン Codex実行系が target writer。2026-06-08時点では Codex Desktop UI automation store ではなく、Windows Task Scheduler Live launcherを実稼働経路にする。
- 旧 GAS 153 / 155、AMD-Report GAS R313、PWA LLM cron は定期 writer として復活させない。
- PWA `/api/cron/hourly-estimate` は `ALLOW_PWA_LLM_CRONS=1` がない限り disabled response のみ。
- D-7 は `/notifications` の「はい」で DB 候補を `approved` にするだけ。git 管理の `pwa/bzm/*.md` 追記は local applier / worker が行い、Vercel runtime から直接 commit しない。

## Outbox 契約

| outbox | 用途 |
|---|---|
| `~/.codex/automations/amd-os-ms/outbox/` | monthlyReports / registryDiffs / xrlEvidence / MS revision |
| `~/.codex/automations/amd-os/strategy-signals-outbox/` | D-6 経営ハイライト |
| `~/.codex/automations/amd-atlas/outbox/` | Atlas 外部 signal |

反映はローカルの非LLM LaunchAgent `jp.teamarmada.amd-os-ms-outbox-applier` が行う。成功 file は `applied/`、失敗 file は `failed/` へ移動する。

## 採否 / 正本反映

| kind | yes | no |
|---|---|---|
| MS進捗 revision | monthly modal 側で confirm | discard |
| OS台帳差分 | allowlist 済み DB 更新 | `project_registry_diffs.status='rejected'` |
| XRL根拠 | `project_xrl_evidence.status='confirmed'` | `rejected` |
| 経営ハイライト | `project_strategy_signals.status='confirmed'` | `rejected` |
| Textbook Insights | `textbook_insight_candidates.status='approved'` → local applier で `pwa/bzm/*.md` 追記 | `rejected` |
| PJナレッジ | `project_knowledge.status='active'` | `rejected` |
| AMD Protocol | `protocols.status='confirmed'` | `rejected` |
| founding members | `project_founding_members.status='active'` | `invalid` |

## 禁止事項

- `source_cache` だけを見て no-data 判定しない。
- 5 生データのうち一部だけで「全部確認済み」と扱わない。
- `monthly_reports.final_content` を `force:true` なしで上書きしない。
- R313 / `/api/report/generate` / `/api/cron/monthly-reports-backfill` を定期 writer にしない。
- raw source 全文を L2 row や通知に保存しない。
- 存在しない列名や status 値を想像で書かない。`pwa/design/db_schema.md` を確認する。

## 個別 Rebuild Spec

| L2 | rebuild spec |
|---|---|
| D-1 AMD Protocol | [/spec/3-9-l2-protocol-current-spec](/spec/3-9-l2-protocol-current-spec) |
| D-2 MS Progress | [/spec/3-10-l2-ms-progress-current-spec](/spec/3-10-l2-ms-progress-current-spec) |
| D-3 Project Knowledge | [/spec/3-11-l2-project-knowledge-current-spec](/spec/3-11-l2-project-knowledge-current-spec) |
| D-4 Member Knowledge | [/spec/3-12-l2-member-knowledge-current-spec](/spec/3-12-l2-member-knowledge-current-spec) |
| D-7 Textbook Insights | [/spec/3-13-l2-textbook-insights-current-spec](/spec/3-13-l2-textbook-insights-current-spec) |

## 復旧時の確認順

1. 該当 L2 の現行 writer がどこかをこの章で確認する。
2. repo 内 SKILL (`pwa/scheduled-tasks/.../SKILL.md`) を読む。
3. outbox がある L2 は file が `outbox/`, `applied/`, `failed/` のどこにあるか確認する。
4. LaunchAgent / helper の失敗種別を分けて記録する。
5. DB/API へ直接逃げず、outbox 経路で閉じる。
