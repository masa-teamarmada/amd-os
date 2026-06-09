# L2 データ抽出 / Outbox 仕様

> **この章は何か**: AMD OS の中核データである L2 と、5 生データ、Claude routine / Codex Desktop automation / Codex automation / PWA non-LLM cron / outbox / LaunchAgent 反映の確定仕様。運用者向けの読み方は `/manual/3-2-data-and-extraction` と `/manual/8-3-l2-extraction-routines-spec` にも置く。移行中は両方を更新する。

## 2026-06-04 registration gate

Claude定額token/routineへ載せるL2について、`~/.claude/scheduled-tasks/.../SKILL.md` が存在するだけでは登録済みと扱わない。**Claude routine** と呼べるのは、Claude Routines UI上で存在し、`ACTIVE`、`next run`、`last run` を確認できるものだけ。

2026-06-04時点で、Claude Routines UIにroutineが1本も見えない事故が確認された。過去docsの「routine登録完了」「subscription automationで稼働」等の記述は、UI証跡が無い限り current truth として使わない。

**Claude routine = マシン非依存**: Claude routine (cloud) は Anthropic-managed cloud infrastructure で実行され、`claude.ai/code/routines` / CLI `/schedule` / Desktop app のどこから登録しても同じ claude.ai アカウントに入る。**laptop を閉じても・どのマシンが OFF でも動く**。MMOマシンに置く必要はない。これと混同してはいけないのが Desktop / Local scheduled task (`~/.claude/scheduled-tasks/`) で、こちらは**マシン依存** (app open + 非スリープ中のみ)。事故時はここに全 disabled で置かれていた。

**制約**: Claude routine は最小インターバル 1 時間、daily run cap あり (one-off は cap 外)。→ **同じ cadence の L2 を 1 routine に束ねて run 数を最小化**する。

是正ターゲット (= 2026-06-04 まさ確定の cadence ベース束ね、新ナンバリング D / M / H):

| runtime | 対象 (新ナンバリング) | cadence | completion evidence |
|---|---|---|---|
| Claude routine `amd-os-l2-consolidated-evidence` | **D-1〜D-11** = 旧 L2 ②③④⑤⑦⑨⑩⑪⑫⑬ + 新 L2⑰ 契約予兆 | daily 08:00 JST (`0 8 * * *`)、平常日 run +1 | Claude Routines UI `ACTIVE / next run / last run`、初回 one-off dry run |
| Claude routine `amd-os-l2-monthend-evidence` | **M-1〜M-3** = 旧 L2 ①⑧⑯ | 月末候補日 16:00 発火 (`0 16 28-31 * *`)、最終日判定、17:00 完了 | UI 登録証跡 + run evidence |
| MMOマシン Codex Desktop automation | **H-1** = 旧 L2 ⑥ MTG flow | 毎時 09:00-21:00 JST | MMO 側 automation 履歴と DB/outbox evidence。Claude routine 化しない |
| PWA non-LLM cron | LLM を呼ばない同期・集計・cache (= D-9 の `macro_index_log` 集計含む) | 各 cron 定義 | code 上 LLM 非依存であること |

注: 旧 L2③ MS進捗と旧 L2⑬ Member Weekly は 2026-06-04 まさ確定で **daily 化**し D 群 (D-2 / D-10) に同居。新 L2⑰ Contract Signals も新規routineを作らず D 群 (D-11) に同居。旧 L2① と旧 L2⑧⑯ は全部「月末」なので M 群に統合 (= B/D 別枠を廃止)。

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

## L2 writers (新ナンバリング D / M / H ↔ 旧 L2)

cadence ベースで束ねた新ナンバリング: **D = daily** (Claude routine `amd-os-l2-consolidated-evidence`、08:00 JST) / **M = month-end** (Claude routine `amd-os-l2-monthend-evidence`、月末最終日 16:00→17:00) / **H = hourly** (MMOマシン Codex Desktop automation)。

| 新 | 旧 | table | 現行 / 暫定 writer | 反映 |
|---|---|---|---|---|
| **D-1** | ② AMD Protocol | `protocols` | Claude routine `amd-os-l2-consolidated-evidence` (target) / 暫定 MMO `amd-os-l2-protocol-extract` | Supabase + notifications。yes は `confirmed` |
| **D-2** | ③ MS進捗 | `milestone_monthly_progress` / `project_monthly_notes` | Claude routine `amd-os-l2-consolidated-evidence` (target、daily 化) / 暫定 MMO `amd-os-l3-ms-progress-extract` | Supabase + revisions |
| **D-3** | ④ PJナレッジ | `project_knowledge` | Claude routine `amd-os-l2-consolidated-evidence` (target) / 暫定 MMO `amd-os-l4-project-knowledge-extract` | candidate → active/rejected |
| **D-4** | ⑤ メンバーナレッジ | `member_knowledge` | Claude routine `amd-os-l2-consolidated-evidence` (target) / 暫定 MMO `amd-os-l5-member-knowledge-extract` | candidate → active/rejected |
| **D-5** | ⑦ OS台帳差分 | `project_registry_diffs` | Claude routine `amd-os-l2-consolidated-evidence` (target) / 暫定 Codex `amd-os-ms` / SKILL `amd-os-l7-registry-diff-extract` | outbox → LaunchAgent |
| **D-6** | ⑨ 経営ハイライト | `project_strategy_signals` | Claude routine `amd-os-l2-consolidated-evidence` (target) / 暫定 Codex `amd-os` / SKILL `amd-os-l9-strategy-signal-extract` | strategy-signals outbox → LaunchAgent |
| **D-7** | ⑩ Textbook Insights | `textbook_insight_candidates` | Claude routine `amd-os-l2-consolidated-evidence` (target) / 暫定 Codex / local worker `amd-os-l10-textbook-insight-extract` | `outbox.textbookInsights` → candidate + notification → approved → local BZM applier |
| **D-8** | ⑪ Atlas Signals | `atlas_signals` / derived `atlas_stories` / `atlas_reports` | Claude routine `amd-os-l2-consolidated-evidence` (target) | `POST /api/atlas/signals-ingest` → Haiku autotag + upsert。派生 stories/reports は別系統 |
| **D-9** | ⑫ Macrotrend Evidence / Index | `observation_log` / `macro_index_log` / derived `macro_lane_weights` / `triple_helix_state_log` | Claude routine `amd-os-l2-consolidated-evidence` (= 外部 observation 収集) + **PWA non-LLM cron** `macro-aggregate-indicators` (= index 集計) | observation_log upsert + index 集計は LLM 非依存 cron |
| **D-10** | ⑬ Member Weekly Activities | `member_activities(source='member_weekly')` | Claude routine `amd-os-l2-consolidated-evidence` (= daily 化、weekly 廃止) | Dashboard / MyPage / admin |
| **D-11** | ⑰ Contract Signals | `contract_signals` / `contracts` / `contract_documents` | Claude routine `amd-os-l2-consolidated-evidence` Phase K (= 新規routine作成禁止) + PWA route `POST /api/contracts/extract-l2` | 契約管理 `/admin/contracts`、l2_notifications(l2_kind='contract_signals') |
| **M-1** | ① monthly_reports | `monthly_reports` | Claude routine `amd-os-l2-monthend-evidence` (target) / 暫定 Codex automation `AMD OS L2① 月次報告抽出` | `amd-os-ms/outbox.monthlyReports` → LaunchAgent |
| **M-2** | ⑧ XRL根拠 | `project_xrl_evidence` / `project_founding_members` | Claude routine `amd-os-l2-monthend-evidence` (= M-1 後) / 暫定 Codex `amd-os-ms` / SKILL `amd-os-l8-xrl-evidence-extract` | outbox → LaunchAgent。candidate → confirmed |
| **M-3** | ⑯ Management Monthly Signal | `company_management_signal_reviews` | Claude routine `amd-os-l2-monthend-evidence` (= M-2 後、新規 inline) | `/management-score`。candidate → confirmed。18:00 MTG 前に出揃わせる |
| **H-1** | ⑥ MTGサマリ + MTGフロー | `project_meeting_summaries` / `meeting_assets` | MMOマシン Codex Desktop automation `amd-os-l6-meeting-flow` | Supabase / Calendar / Drive / Gmail draft。Claude routine 化しない |
| (対象外) | ⑭ Finance Ops Evidence | finance ops tables | PWA non-LLM cron / admin review中心 | Management / finance ops |
| (対象外) | ⑮ VC News / Funding Signals | `vc_news` / funding signal tables | Claude routineまたはCodex automation候補。UI登録証跡が出るまでは未完 | external signal review |

## L2 ⑥ MTG サマリの開催済みソース guard

`project_meeting_summaries` は準備カードと開催済み議事録を同じ table に別 row で持つ。準備カードは `meeting_id='upcoming:<calendar_event_id>'` / `source_kinds='upcoming'`、開催済み議事録は `meeting_id='<calendar_event_id>'`。既存準備カードを削除せず、開催済み row には `prep_source_meeting_id` が使える場合だけ `upcoming:<calendar_event_id>` を入れる。

L2 ⑥ writer は、次のいずれかがある event を upcoming だけで完了扱いにしない。

- Calendar event attachments / conference notes / description に Gemini / Google Meet notes の Google Docs link がある
- Notion 議事録ページの `eventId` が空でも、同日または近接日、title token、attendees、PJ context、Gemini / Drive / Gmail URL で該当 Calendar event へ fallback match できる
- `projects.report_emails` が空の PJでも、Gemini notes sender や follow-up Gmail が event title / PJ / client / attendee 文脈で hit する

fallback match は `confidence` と `needs_review` を run summary / candidate metadata に残す。`projects.report_emails` の不足は自動 DB 更新せず、`project_registry_diffs` または通知/outbox の config gap として出す。

Executable guard: `cd pwa && npm run test:l6-held-source-guard`。fixture は飯野さんケース相当 (`Calendar添付Geminiメモ + Notion eventId空 + report_emails空 + 既存upcoming行`) で、開催済み `meeting_id=<event_id>` 候補、`source_kinds` に `drive/gmail/notion`、`prep_source_meeting_id`、config gap が出ることを検査する。

## Writer 境界

- L2 ①⑦⑧⑨⑩は Codex automation が JSON outbox を作り、非LLM LaunchAgent が Supabase / PWA API に反映する。
- L2 ②〜⑥は MMOマシン Codex Desktop automation が現行 writer。
- 旧 GAS 153 / 155、AMD-Report GAS R313、PWA LLM cron は定期 writer として復活させない。
- PWA `/api/cron/hourly-estimate` は `ALLOW_PWA_LLM_CRONS=1` がない限り disabled response のみ。
- L2⑩ は `/notifications` の「はい」で DB 候補を `approved` にするだけ。git 管理の `pwa/bzm/*.md` 追記は local applier / worker が行い、Vercel runtime から直接 commit しない。

## Outbox 契約

| outbox | 用途 |
|---|---|
| `~/.codex/automations/amd-os-ms/outbox/` | monthlyReports / registryDiffs / xrlEvidence / MS revision |
| `~/.codex/automations/amd-os/strategy-signals-outbox/` | L2 ⑨ 経営ハイライト |
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
| ② AMD Protocol | [/spec/3-9-l2-protocol-current-spec](/spec/3-9-l2-protocol-current-spec) |
| ③ MS Progress | [/spec/3-10-l2-ms-progress-current-spec](/spec/3-10-l2-ms-progress-current-spec) |
| ④ Project Knowledge | [/spec/3-11-l2-project-knowledge-current-spec](/spec/3-11-l2-project-knowledge-current-spec) |
| ⑤ Member Knowledge | [/spec/3-12-l2-member-knowledge-current-spec](/spec/3-12-l2-member-knowledge-current-spec) |
| ⑩ Textbook Insights | [/spec/3-13-l2-textbook-insights-current-spec](/spec/3-13-l2-textbook-insights-current-spec) |

## 復旧時の確認順

1. 該当 L2 の現行 writer がどこかをこの章で確認する。
2. repo 内 SKILL (`pwa/scheduled-tasks/.../SKILL.md`) を読む。
3. outbox がある L2 は file が `outbox/`, `applied/`, `failed/` のどこにあるか確認する。
4. LaunchAgent / helper の失敗種別を分けて記録する。
5. DB/API へ直接逃げず、outbox 経路で閉じる。
