# AMD OS L2 抽出 Routine SKILL 正本

このディレクトリは、L2 D / M / W / H と control layer の **routine / automation が読む SKILL 正本**。D / M / W のLLM抽出はClaude routine、H-1はMac LaunchAgentからの非可視 `codex exec --ephemeral`、D-12などLLM不要処理はPWA non-LLM cronが担う。実行手順の正本はこのrepo配下のSKILL.mdに置く。

## 運用 (= 2026-05-26 以降)

- **正本**: 束ね routine は `amd-os-l2-consolidated-evidence` / `amd-os-l2-monthend-evidence` / `amd-os-l2-weekly-vc-funding-signals`。個別 L2 SKILL は束ね routine が参照する Phase 詳細。
- **Mac 用同期先 (履歴/補助)**: `~/.claude/scheduled-tasks/amd-os-l<N>-<name>/SKILL.md` (= 現行 writer ではない)
- **Cloud routine 用 (履歴/補助)**: claude.ai/code/routines の「指示」フィールドで `pwa/scheduled-tasks/amd-os-l<N>-<name>/SKILL.md を読んで実行` と指示していた。現行復旧先は 8-3 の実行場所表を優先
- **H-1 background runner**: `scripts/run-h1-background.sh` と `scripts/run-h1-reviewer-background.sh` をLaunchAgentが実行する。H-1は平日毎時15分、reviewerは同45分。Codex Desktop cron `amd-os-l6-meeting-flow` / `amd-os-h-1-meeting-reviewer` はPAUSED。候補なしでは本文抽出・横断探索へ進まず、どちらも可視task・threadを作らない。
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
| H-1 | Mac LaunchAgentの非可視Codex runner | `run-h1-background.sh` / SKILL `amd-os-l6-meeting-extract` | 平日毎時15分。DB候補gate後、Calendarを一度だけ確認。候補なしは本文抽出・横断探索へ進まない | `project_meeting_summaries` / 予定MTGカード / Drive関連資料 |
| W-Prep | Codex automation | `w-prep-launch` | weekly Wednesday 15:00 JST | 実行日から数えて7日後の23:59:59.999 JSTまでの確定 upcoming MTG を Calendar + DB で照合し、必要な visible prep thread をPJ workspaceに作成・改題・pin・DB保存する。厳密な `now()+7 days` で切らず、DBだけを見て完了扱いにしない。Calendar直読みでは `CFG_ColorPJHistory` を先に見て、`2025-06-01` 以降の `colorId=4` と `SolvioraX` alias は SX/p21 として扱う。重複防止は `calendar_event_id` exact identity と `upcoming:<calendar_event_id>` canonical を優先する |
| W-Prep worker | visible Codex thread | `amd-os-l6-meeting-prep-worker` | thread 起動後に実行 | 1 MTG 専属。文脈ロード→着地点draft→HTML prep資料→Notion議事録draft→readiness 計算→prep_* 列 upsert→「これであってる？どうする？」で待機 |
| D-13 | Claude routine + PWA route | `amd-os-l2-consolidated-evidence` Phase K-B / `POST /api/contracts/extract-l2` | daily 08:00 JST | Contract Signals |
| M-2 XRL 根拠 | Codex automation + outbox applier | `amd-os-l8-xrl-evidence-extract` | 6h ごと (L7 +15 分) | `project_xrl_evidence` |
| D-6 経営ハイライト | Codex automation + outbox applier | `amd-os-l9-strategy-signal-extract` | daily 03:20 JST | `project_strategy_signals` |
| 先手 TODO | PWA non-LLM cron | `/api/cron/proactive-todo-extract` | daily 00:15 UTC (= 09:15 JST) | `project_meeting_summaries.next_actions` + 次回MTG予定 (7日以内) + Gmail期限つき依頼 (`email_action_request`) から `proactive_todos` upsert。開催済みMTG next_action の期限は本文内の明示期限を優先し、読めない場合だけ MTG 日 + 7 日。仕様: pwa/spec/2-4-proactive-todo-current-spec.md。MVP は daily 運用 (Vercel cron 制限のため)、頻度足りなければ Pro 化 or Mac LaunchAgent 移管。旧 `amd-os-proactive-heartbeat` (proactive_outbox 用) は 2026-06-27 廃止 |

## 関連 md

- 設計議論: [`pwa/design/l2_extract_claude_routine.md`](../design/l2_extract_claude_routine.md)
- マニュアル: [`pwa/manual/8-3-l2-extraction-routines-spec.md`](../manual/8-3-l2-extraction-routines-spec.md)
- L2 全体仕様: [`pwa/design/L2_DATA.md`](../design/L2_DATA.md)
- 先手力 heartbeat: [`pwa/scheduled-tasks/amd-os-proactive-heartbeat/SKILL.md`](amd-os-proactive-heartbeat/SKILL.md)
