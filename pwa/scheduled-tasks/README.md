# AMD OS L2 抽出 Routine SKILL 正本

このディレクトリは、L2 D / M / W / H と control layer の **routine / automation が読む SKILL 正本**。D / M / W の LLM 抽出は Claude routine、H-1 Meeting Flow だけ Windows MMO PC の Codex Desktop automation、D-12 など LLM 不要処理は PWA non-LLM cron が担う。実行手順の正本はこの repo 配下の SKILL.md に置く。

## 運用 (= 2026-05-26 以降)

- **正本**: 束ね routine は `amd-os-l2-consolidated-evidence` / `amd-os-l2-monthend-evidence` / `amd-os-l2-weekly-vc-funding-signals`。個別 L2 SKILL は束ね routine が参照する Phase 詳細。
- **Mac 用同期先 (履歴/補助)**: `~/.claude/scheduled-tasks/amd-os-l<N>-<name>/SKILL.md` (= 現行 writer ではない)
- **Cloud routine 用 (履歴/補助)**: claude.ai/code/routines の「指示」フィールドで `pwa/scheduled-tasks/amd-os-l<N>-<name>/SKILL.md を読んで実行` と指示していた。現行復旧先は 8-3 の実行場所表を優先
- **Windows MMO Codex 用**: H-1 `amd-os-l6-meeting-flow` のみ。D / M / W が MMO Codex automation に残っている場合は暫定/差分扱いで、Claude routine ACTIVE 確認後は PAUSED。
- **編集は repo の正本で**。Mac 側は rsync で同期 (= 双方向同期スクリプトを別途)
- **M-1 monthly report**: 2026-05-31 以降は Supabase L2 snapshot primary。5生データは L2 coverage gap / stale / source refs 不足 / no-data 判定候補の fallback として見る。
- **H-1 Notion eventId**: eventId を埋められるのは MMO automation。Calendar event から Notion page を見つけたら可能な範囲で `eventId` を追記し、欠損だけを理由に skip しない。title/date/attendees/Gemini/Drive/Gmail URL fallback を必ず使う。
- **H-1 held-source guard**: `npm run test:l6-held-source-guard` は、Calendar添付Geminiメモ + Notion eventId空 + report_emails空でも開催済み `project_meeting_summaries` 候補が出ることを検査する。upcoming row は残し、開催済み row は `prep_source_meeting_id` で紐付ける。

## Routine 一覧

| L2 | 実行場所 | routine / automation | cron | 詳細 |
|---|---|---|---|---|
| D-1〜D-11 / D-13 | Claude routine | `amd-os-l2-consolidated-evidence` | daily 08:00 JST | daily LLM L2。個別 SKILL を Phase 詳細として参照 |
| D-12 | PWA non-LLM cron + admin review | `/api/cron/management-score-raw-data?includeFreee=1` | daily | Finance Ops Evidence / freee Transaction Actuals |
| M-1〜M-3 | Claude routine | `amd-os-l2-monthend-evidence` | 月末候補日 16:00 JST | M-1 Monthly Reports → M-2 XRL → M-3 Management Signal |
| W-1 | Claude routine | `amd-os-l2-weekly-vc-funding-signals` | weekly Saturday 09:00 JST | VC News / Funding Signals |
| H-1 | Windows MMO Codex Desktop automation | `amd-os-l6-meeting-flow` / SKILL `amd-os-l6-meeting-extract` | 毎日 09:00-21:00 毎時 + Phase A 早期 exit | `project_meeting_summaries` / 予定MTGカード / Drive関連資料 |
| H-1 prep | Codex Cloud automation | `amd-os-l6-meeting-prep-spawner` | 毎朝 06:30 JST | 翌48h upcoming MTG ごとに worker を Codex Cloud で動的 spawn |
| H-1 prep | Codex Cloud automation (動的) | `amd-os-l6-meeting-prep-worker` | spawn 即発火 1回限り | 1 MTG 専属。文脈ロード→着地点draft→Drive資料draft→Notion議事録draft→readiness 計算→prep_* 列 upsert→session 待機保持 |
| H-1 prep | Codex Cloud automation | `amd-os-l6-meeting-prep-nudge` | 毎朝 07:30 JST | `prep_worker_status='ready'` の MTG を まさ専用 Slack DM でつくよみ口調まとめ通知 |
| D-13 | Claude routine + PWA route | `amd-os-l2-consolidated-evidence` Phase K-B / `POST /api/contracts/extract-l2` | daily 08:00 JST | Contract Signals |
| M-2 XRL 根拠 | Codex automation + outbox applier | `amd-os-l8-xrl-evidence-extract` | 6h ごと (L7 +15 分) | `project_xrl_evidence` |
| D-6 経営ハイライト | Codex automation + outbox applier | `amd-os-l9-strategy-signal-extract` | daily 03:20 JST | `project_strategy_signals` |
| control | Codex automation / worker heartbeat | `amd-os-proactive-heartbeat` | 10:15-20:15 JST 毎時15分 | `proactive_outbox` → PJ司令塔 thread通知 → `mark-sent` |

## 関連 md

- 設計議論: [`pwa/design/l2_extract_claude_routine.md`](../design/l2_extract_claude_routine.md)
- マニュアル: [`pwa/manual/8-3-l2-extraction-routines-spec.md`](../manual/8-3-l2-extraction-routines-spec.md)
- L2 全体仕様: [`pwa/design/L2_DATA.md`](../design/L2_DATA.md)
- 先手力 heartbeat: [`pwa/scheduled-tasks/amd-os-proactive-heartbeat/SKILL.md`](amd-os-proactive-heartbeat/SKILL.md)
