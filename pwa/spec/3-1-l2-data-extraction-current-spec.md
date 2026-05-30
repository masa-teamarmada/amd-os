# L2 データ抽出 / Outbox 仕様

> **この章は何か**: AMD OS の中核データである L2 ①〜⑩と、5 生データ、subscription automation、outbox / LaunchAgent 反映の確定仕様。運用者向けの読み方は `/manual/3-2-data-and-extraction` と `/manual/8-3-l2-extraction-routines-spec` にも置く。移行中は両方を更新する。

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

## L2 ①〜⑩

| L2 | table | 現行 writer | 反映 |
|---|---|---|---|
| ① monthly_reports | `monthly_reports` | Codex automation `AMD OS L2① 月次報告抽出` | `amd-os-ms/outbox.monthlyReports` → LaunchAgent |
| ② AMD Protocol | `protocols` | MMOマシン Codex Desktop automation `amd-os-l2-protocol-extract` | Supabase + notifications |
| ③ MS進捗 | `milestone_monthly_progress` / `project_monthly_notes` | MMOマシン automation `amd-os-l3-ms-progress-extract` | Supabase + revisions |
| ④ PJナレッジ | `project_knowledge` | MMOマシン automation `amd-os-l4-project-knowledge-extract` | candidate → active/rejected |
| ⑤ メンバーナレッジ | `member_knowledge` | MMOマシン automation `amd-os-l5-member-knowledge-extract` | candidate → active/rejected |
| ⑥ MTGサマリ + MTGフロー | `project_meeting_summaries` / `meeting_assets` | MMOマシン automation `amd-os-l6-meeting-flow` | Supabase / Calendar / Drive / Gmail draft |
| ⑦ OS台帳差分 | `project_registry_diffs` | Codex automation `amd-os-ms` / SKILL `amd-os-l7-registry-diff-extract` | outbox → LaunchAgent |
| ⑧ XRL根拠 | `project_xrl_evidence` / `project_founding_members` | Codex automation `amd-os-ms` / SKILL `amd-os-l8-xrl-evidence-extract` | outbox → LaunchAgent |
| ⑨ 経営ハイライト | `project_strategy_signals` | Codex automation `amd-os` / SKILL `amd-os-l9-strategy-signal-extract` | strategy-signals outbox → LaunchAgent |
| ⑩ Textbook Insights | `textbook_insight_candidates` | Codex automation / local worker `amd-os-l10-textbook-insight-extract` | `outbox.textbookInsights` → candidate + notification → approved → local BZM applier |

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
