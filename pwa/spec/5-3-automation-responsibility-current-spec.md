# Automation 責務分担仕様

> **この章は何か**: LLM課金 cron 廃止後の、Codex automation / MMOマシン / Vercel cron / GAS / LaunchAgent の責務分担。旧 `/manual/9-1-decisions-and-history` から実装者向け current truth を移植した。

## 基本方針

2026-05-22 以降、PWA / GAS / Vercel から Anthropic・Gemini・OpenAI の従量課金 LLM API を定期実行しない。LLM が必要な L2 抽出は、Codex automation / MMOマシン Codex Desktop automation の subscription 枠へ寄せる。

これは「cron 禁止」ではない。DB同期、外部API fetch、通知、キャッシュ更新、入金・請求系など、LLM 非依存の cron は許可される。

## L2 ①〜⑩ current writers

| L2 | table | current writer | 実行場所 | schedule | apply |
|---|---|---|---|---|---|
| ① Monthly Reports | `monthly_reports` | `amd-os-l2` | Codex automation | daily 05:30 JST | `amd-os-ms/outbox.monthlyReports` → LaunchAgent |
| ② AMD Protocol | `protocols` | `amd-os-l2-protocol-extract` | MMOマシン Codex Desktop automation | daily 08:00 JST | Supabase REST / scheduled task contract |
| ③ MS Progress | `milestone_monthly_progress` | `amd-os-l3-ms-progress-extract` | MMOマシン Codex Desktop automation | hourly | Supabase REST / scheduled task contract |
| ④ PJ Knowledge | `project_knowledge` | `amd-os-l4-project-knowledge-extract` | MMOマシン Codex Desktop automation | daily 08:15 JST | Supabase REST / scheduled task contract |
| ⑤ Member Knowledge | `member_knowledge` | `amd-os-l5-member-knowledge-extract` | MMOマシン Codex Desktop automation | daily 08:30 JST | Supabase REST / scheduled task contract |
| ⑥ Meeting Flow | `project_meeting_summaries` | `amd-os-l6-meeting-flow` / SKILL `amd-os-l6-meeting-extract` | Windows MMO Codex Desktop automation | 09:00-21:00 hourly | Supabase REST / scheduled task contract |
| ⑦ Registry Diffs | `project_registry_diffs` | `amd-os-ms` + `amd-os-l7-registry-diff-extract` | Codex automation + outbox applier | every 6h | `outbox.registryDiffs` → LaunchAgent |
| ⑧ XRL Evidence | `project_xrl_evidence` | `amd-os-ms` + `amd-os-l8-xrl-evidence-extract` | Codex automation + outbox applier | every 6h +15m | `outbox.xrlEvidence` → LaunchAgent |
| ⑨ Strategy Signals | `project_strategy_signals` | `amd-os` + `amd-os-l9-strategy-signal-extract` | Codex automation + outbox applier | daily 03:20 JST | strategy-signals outbox → LaunchAgent |
| ⑩ Textbook Insights | `textbook_insight_candidates` | `amd-os-l10-textbook-insight-extract` | Codex automation / local worker + outbox applier + local BZM applier | TBD / manual start | `outbox.textbookInsights` → candidate + notification。approved 後 `apply_approved_textbook_insights.mjs` が `pwa/bzm/*.md` へ追記 |

SKILL 正本は `pwa/scheduled-tasks/amd-os-l<N>-*/SKILL.md`。L2 の品質改善は、PWA route / GAS function ではなく SKILL と outbox/applier contract を更新する。

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
