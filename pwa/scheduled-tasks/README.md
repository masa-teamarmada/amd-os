# AMD OS L2 抽出 Routine SKILL 正本

このディレクトリは、L2 ①〜⑩ / ⑰ と control layer の **routine / automation が読む SKILL 正本**。L2 ①は Codex automation、L2 ②〜⑥は Windows MMO PC の Codex Desktop automation、L2 ⑦⑧⑨は Codex automation + outbox/applier、L2⑩は candidate/outbox + local BZM applier、L2⑰契約予兆は既存 daily consolidated Claude routine に同居、先手力 heartbeat は Codex thread notification で動く。実行手順の正本はこの repo 配下の SKILL.md に置く。

## 運用 (= 2026-05-26 以降)

- **正本**: `pwa/scheduled-tasks/amd-os-l<N>-<name>/SKILL.md`
- **Mac 用同期先 (履歴/補助)**: `~/.claude/scheduled-tasks/amd-os-l<N>-<name>/SKILL.md` (= 現行 writer ではない)
- **Cloud routine 用 (履歴/補助)**: claude.ai/code/routines の「指示」フィールドで `pwa/scheduled-tasks/amd-os-l<N>-<name>/SKILL.md を読んで実行` と指示していた。現行復旧先は 8-3 の実行場所表を優先
- **Windows MMO Codex 用**: Codex Desktop automation の prompt でこの repo 内 SKILL を読む。repo は MMO 側で auto-pull されるが、即時反映したい場合は MMO 側で `git pull origin main` を確認する。
- **編集は repo の正本で**。Mac 側は rsync で同期 (= 双方向同期スクリプトを別途)
- **L2① monthly report**: 2026-05-31 以降は Supabase L2 snapshot primary。5生データは L2 coverage gap / stale / source refs 不足 / no-data 判定候補の fallback として見る。
- **L2⑥ Notion eventId**: eventId を埋められるのは MMO automation。Calendar event から Notion page を見つけたら可能な範囲で `eventId` を追記し、欠損だけを理由に skip しない。title/date/attendees/Gemini/Drive/Gmail URL fallback を必ず使う。
- **L2⑥ held-source guard**: `npm run test:l6-held-source-guard` は、Calendar添付Geminiメモ + Notion eventId空 + report_emails空でも開催済み `project_meeting_summaries` 候補が出ることを検査する。upcoming row は残し、開催済み row は `prep_source_meeting_id` で紐付ける。

## Routine 一覧

| L2 | 実行場所 | routine / automation | cron | 詳細 |
|---|---|---|---|---|
| ① monthly report | Codex automation + outbox applier | `amd-os-l1-monthly-report-extract` | daily 05:30 JST | `monthly_reports` |
| ② AMD プロトコル | MMOマシン Codex Desktop automation | `amd-os-l2-protocol-extract` | daily 08:00 JST | `protocols` |
| ③ MS 進捗 | MMOマシン Codex Desktop automation | `amd-os-l3-ms-progress-extract` | 毎時 0 分 | `milestone_monthly_progress` |
| ④ PJ ナレッジ | MMOマシン Codex Desktop automation | `amd-os-l4-project-knowledge-extract` | daily 08:15 JST | `project_knowledge` |
| ⑤ メンバーナレッジ | MMOマシン Codex Desktop automation | `amd-os-l5-member-knowledge-extract` | daily 08:30 JST | `member_knowledge` |
| ⑥ MTG サマリ | Windows MMO Codex Desktop automation | `amd-os-l6-meeting-flow` / SKILL `amd-os-l6-meeting-extract` | 毎日 09:00-21:00 毎時 + Phase A 早期 exit | `project_meeting_summaries` / 予定MTGカード / Drive関連資料 |
| ⑦ OS 台帳差分 | Codex automation + outbox applier | `amd-os-l7-registry-diff-extract` | 6h ごと | `project_registry_diffs` |
| ⑧ XRL 根拠 | Codex automation + outbox applier | `amd-os-l8-xrl-evidence-extract` | 6h ごと (L7 +15 分) | `project_xrl_evidence` |
| ⑨ 経営ハイライト | Codex automation + outbox applier | `amd-os-l9-strategy-signal-extract` | daily 03:20 JST | `project_strategy_signals` |
| ⑰ 契約予兆 | Claude routine (daily consolidated) | `amd-os-l2-consolidated-evidence` Phase K | daily 08:00 JST | `contract_signals` / `contracts` |
| control | Codex automation / worker heartbeat | `amd-os-proactive-heartbeat` | 10:15-20:15 JST 毎時15分 | `proactive_outbox` → PJ司令塔 thread通知 → `mark-sent` |

## 関連 md

- 設計議論: [`pwa/design/l2_extract_claude_routine.md`](../design/l2_extract_claude_routine.md)
- マニュアル: [`pwa/manual/8-3-l2-extraction-routines-spec.md`](../manual/8-3-l2-extraction-routines-spec.md)
- L2 全体仕様: [`pwa/design/L2_DATA.md`](../design/L2_DATA.md)
- 先手力 heartbeat: [`pwa/scheduled-tasks/amd-os-proactive-heartbeat/SKILL.md`](amd-os-proactive-heartbeat/SKILL.md)
