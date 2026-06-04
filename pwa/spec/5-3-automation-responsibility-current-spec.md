# Automation 責務分担仕様

> **この章は何か**: LLM課金 cron 廃止後の、Codex automation / MMOマシン / Vercel cron / GAS / LaunchAgent の責務分担。旧 `/manual/9-1-decisions-and-history` から実装者向け current truth を移植した。

## 基本方針

2026-05-22 以降、PWA / GAS / Vercel から Anthropic・Gemini・OpenAI の従量課金 LLM API を定期実行しない。LLM が必要な L2 抽出は、Claude routine / Codex automation / MMOマシン Codex Desktop automation の定額枠へ寄せる。

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

### 束ね方 = cadence で 2 routine + MMO automation

L2 を cadence で分類し、**新ナンバリング (D = daily / M = month-end / H = hourly)** を当てる。

| グループ | routine / 実行場所 | cadence | run 消費 |
|---|---|---|---|
| **D-1〜D-10** | Claude routine `amd-os-l2-consolidated-evidence` | daily 08:00 JST (`0 8 * * *`) | 平常日 +1/日 |
| **M-1〜M-3** | Claude routine `amd-os-l2-monthend-evidence` | 月末候補日 16:00 発火 (`0 16 28-31 * *`)、Phase 0 で最終日判定、最終日のみ本処理、17:00 完了目標 | 月末候補日のみ +1 (空振り含む) |
| **H-1** | MMOマシン Codex Desktop automation `amd-os-l6-meeting-flow` | 毎時 09:00-21:00 JST | Claude routine 外 |

平常日の Claude routine run 消費は **1 本だけ**。月末日でも最大 2 本 (D + M)。daily run cap には全く触れない。

## L2 writers (新ナンバリング D / M / H)

| 新 | 旧 L2 | table | 実行場所 / writer | schedule | apply / evidence |
|---|---|---|---|---|---|
| **D-1** | ② | `protocols` | Claude routine `amd-os-l2-consolidated-evidence` (target) / 暫定 MMO `amd-os-l2-protocol-extract` | daily 08:00 JST | Supabase + notifications。yes は `confirmed` |
| **D-2** | ③ | `milestone_monthly_progress` / `project_monthly_notes` | Claude routine `amd-os-l2-consolidated-evidence` (target、daily 化) / 暫定 MMO `amd-os-l3-ms-progress-extract` | daily 08:00 JST | Supabase + revisions。旧 hourly / PWA hourly-estimate 停止 |
| **D-3** | ④ | `project_knowledge` | Claude routine `amd-os-l2-consolidated-evidence` (target) / 暫定 MMO `amd-os-l4-project-knowledge-extract` | daily 08:00 JST | candidate → active/rejected |
| **D-4** | ⑤ | `member_knowledge` | Claude routine `amd-os-l2-consolidated-evidence` (target) / 暫定 MMO `amd-os-l5-member-knowledge-extract` | daily 08:00 JST | candidate → active/rejected |
| **D-5** | ⑦ | `project_registry_diffs` | Claude routine `amd-os-l2-consolidated-evidence` (target) / 暫定 Codex `amd-os-ms` + `amd-os-l7-registry-diff-extract` | daily 08:00 JST | `outbox.registryDiffs` → LaunchAgent |
| **D-6** | ⑨ | `project_strategy_signals` | Claude routine `amd-os-l2-consolidated-evidence` (target) / 暫定 Codex `amd-os` + `amd-os-l9-strategy-signal-extract` | daily 08:00 JST | strategy-signals outbox → LaunchAgent |
| **D-7** | ⑩ | `textbook_insight_candidates` | Claude routine `amd-os-l2-consolidated-evidence` (target) / 暫定 Codex / local worker `amd-os-l10-textbook-insight-extract` | daily 08:00 JST | `outbox.textbookInsights` → candidate + notification。approved 後 local BZM applier が `pwa/bzm/*.md` へ追記 |
| **D-8** | ⑪ | `atlas_signals` | Claude routine `amd-os-l2-consolidated-evidence` (target) | daily 08:00 JST | `POST /api/atlas/signals-ingest` → Haiku autotag + `atlas_signals` upsert。派生 stories/reports は別系統 |
| **D-9** | ⑫ | `observation_log` / `macro_index_log` | Claude routine `amd-os-l2-consolidated-evidence` (= 外部 observation 収集) + **PWA non-LLM cron** `macro-aggregate-indicators` (= index 集計) | daily 08:00 JST + 月初集計 | observation_log upsert。index 集計は LLM 非依存 cron が担う |
| **D-10** | ⑬ | `member_activities(source='member_weekly')` | Claude routine `amd-os-l2-consolidated-evidence` (= daily 化、weekly 廃止) | daily 08:00 JST | Dashboard / MyPage read evidence |
| **M-1** | ① | `monthly_reports` | Claude routine `amd-os-l2-monthend-evidence` (target) / 暫定 Codex `AMD OS L2① 月次報告抽出` | 月末最終日 16:00 JST | `amd-os-ms/outbox.monthlyReports` → LaunchAgent。R313 trigger 置かない |
| **M-2** | ⑧ | `project_xrl_evidence` / `project_founding_members` | Claude routine `amd-os-l2-monthend-evidence` (= M-1 の後) / 暫定 Codex `amd-os-ms` + `amd-os-l8-xrl-evidence-extract` | 月末最終日 (M-1 後) | `outbox.xrlEvidence` → LaunchAgent。candidate → confirmed |
| **M-3** | ⑯ | `company_management_signal_reviews` | Claude routine `amd-os-l2-monthend-evidence` (= M-2 の後、新規 inline) | 月末最終日 17:00 完了 | `/management-score` read。candidate → confirmed。18:00 月次振り返り MTG 前に出揃わせる |
| **H-1** | ⑥ | `project_meeting_summaries` / `meeting_assets` | MMOマシン Codex Desktop automation `amd-os-l6-meeting-flow` / SKILL `amd-os-l6-meeting-extract` | 毎時 09:00-21:00 JST | Supabase / Calendar / Drive / Gmail draft。Claude routine 化しない |

旧 L2⑭ Finance Ops Evidence (`company_finance_*`) は PWA non-LLM cron / admin review 中心で、LLM background cron は禁止。旧 L2⑮ VC News / Funding Signals (`vc_news`) は Claude routine または Codex automation 候補で UI 登録証跡までは未完。どちらも D/M/H routine の対象外。

SKILL 正本は `pwa/scheduled-tasks/amd-os-l2-consolidated-evidence/SKILL.md` (D 群) / `amd-os-l2-monthend-evidence/SKILL.md` (M 群) と、各 L2 の個別 `amd-os-l<N>-*/SKILL.md` (= 束ね SKILL が参照する詳細手順)。L2 の品質改善は、PWA route / GAS function ではなく SKILL と outbox/applier contract を更新する。

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

## Stopped LLM cron

| 旧経路 | 状態 | 理由 |
|---|---|---|
| GAS 153 MeetingHourlyTrigger | stopped / kill switch | L2⑥ は MMO automation へ移管 |
| GAS 155 L2KnowledgeExtractor | stopped / kill switch | L2②④⑤ は MMO automation へ移管 |
| GAS 152 NavigatorCron | stopped / kill switch | 旧 fallback 月次抽出 |
| PWA `/api/cron/hourly-estimate` | disabled unless explicit guard | L2③ は MMO automation primary |
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

## Outbox applier

LaunchAgent は Codex automation の outbox を Supabase に反映する非LLM applier。

| 項目 | 契約 |
|---|---|
| polling | 5 分ごと |
| 成功時 | `outbox/applied/` へ移動 |
| 失敗時 | artifact を残し、run summary に件数・原因・duplicate risk を明記 |
| 禁止 | automation が DB に直接 bypass write して outbox を飛ばすこと |

新しい automation outbox を追加したら、`scripts/run-ms-outbox-applier.sh` の監視対象へ明示追加する。

L2⑩ は既存 `amd-os-ms/outbox` の `textbookInsights` payload を使うため監視ディレクトリ追加は不要。ただし approved candidate を `pwa/bzm/*.md` に反映する local applier は git file を触る別段階であり、LaunchAgent の DB outbox applier だけでは完了しない。

## 再発防止

大規模な writer 移管を行うときは、停止対象と後継担当を 1 対 1 で表にしてから止める。2026-05-25 の L2 ②④⑤⑥ ghost 化は、GAS 4 個停止と Codex automation 2 個追加の「数」だけ見て、実カバー範囲を検証しなかったことが原因。
