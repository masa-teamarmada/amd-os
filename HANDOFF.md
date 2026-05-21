# HANDOFF - AMD OS

- Last updated: 2026-05-17
- Topic: OS生データ差分レビューをCodex主導に移し、L2拡張・Atlas停止/移管・CTB凍結履歴DB化まで進めた
- Canonical root: `/Users/masa/projects/AMD/amd-os`
- HEAD at handoff: `8e1a7da`

## Summary

- 月次進捗推定の低品質問題から、Codex automationが5生データ（Gmail / Drive / Calendar / Slack / Notion）とOSデータの差分をレビューする運用へ移行中。
- SupabaseはOS正本であり、生データではない。GAS Sheetもバックアップ/人間確認用で、リアルタイム差分レビューの正本として使わない。
- L2に `project_registry_diffs` と `project_xrl_evidence` / `project_founding_members` を追加済み。通知ページで「はい/いいえ/コメント」を受け、コメントはつくよみ学習側へ回す方針。
- LLMはDBへ直接書かず、outbox JSONを作るだけ。反映は `ms_progress_review_tool.mjs apply-outbox` / `apply-outbox-dir` が担当する。
- Codex cron sandboxはSupabase/PWA/GASへ届かないことがあるため、local non-LLM LaunchAgent `jp.teamarmada.amd-os-ms-outbox-applier` を導入し、5分ごとにoutboxをapplyする。
- Atlas collect cronは課金回避のためPWA cronから外し、Atlas外部シグナルもCodex outbox + local applierへ移行中。
- CTBは202412で一度終了/凍結、その後再開、202605で再凍結。`project_freeze_periods` を追加して履歴管理できるようにした。

Details are in `pwa/design_log/sessions_2026-05.md` under "OS生データ差分レビューのCodex主導化 / L2拡張 / CTB凍結履歴DB化".

## Repo State

- Worktree is dirty and broad. Many HUD / Atlas / cockpit / L2 files were already modified during the long session.
- Do not revert unrelated changes. Inspect with `git status --short` before editing.
- Important session files:
  - `pwa/scripts/ms_progress_review_tool.mjs`
  - `pwa/scripts/atlas_signal_review_tool.mjs`
  - `scripts/run-ms-outbox-applier.sh`
  - `scripts/launchagents/jp.teamarmada.amd-os-ms-outbox-applier.plist`
  - `pwa/scripts/migrations/060_l2_registry_and_xrl_evidence.sql`
  - `pwa/scripts/migrations/061_project_freeze_periods.sql`
  - `pwa/vercel.json`
  - `pwa/vercel.disabled-crons.json`
  - `pwa/design/L2_DATA.md`
  - `pwa/design/atlas_routine.md`
  - `pwa/design/cockpit.md`
  - `pwa/design/db_schema.md`
  - `pwa/BUGS.md`

## Current Live Facts

- Vercel production alias: `https://amd-os-pwa.vercel.app`
- Latest deploy observed in this session:
  - deploy URL: `https://amd-os-7647lvrcb-armada0130.vercel.app`
  - deploy id: `dpl_5nkdCtkvhQYuBJfqhB9tSmmmXqAg`
- CTB live DB:
  - `projects.freeze_from_ym = 202605`
  - `projects.restart_expected_ym = null`
  - `project_freeze_periods` has `202501 -> 202604 closed` and `202605 -> null active`
- local applier LaunchAgent:
  - label: `jp.teamarmada.amd-os-ms-outbox-applier`
  - interval: 300 sec
  - applies `/Users/masa/.codex/automations/amd-os-ms/outbox` and `/Users/masa/.codex/automations/amd-atlas/outbox`

## First Read Next Session

1. `HANDOFF.md`
2. `CLAUDE.md`
3. `pwa/CLAUDE.md`
4. `pwa/design/L2_DATA.md`
5. `pwa/design/atlas_routine.md`
6. `pwa/design/cockpit.md`
7. `pwa/design/db_schema.md`
8. `pwa/BUGS.md`
9. `pwa/design_log/sessions_2026-05.md`

## First Actions Next Session

1. Run `git status --short` and separate this session's L2/automation work from unrelated HUD/front-end work.
2. Check local applier health:
   - `launchctl print gui/$(id -u)/jp.teamarmada.amd-os-ms-outbox-applier`
   - inspect `/tmp/amd-os-ms-outbox-applier.log` and `/tmp/amd-os-ms-outbox-applier.err`
3. Check latest outbox dirs:
   - `/Users/masa/.codex/automations/amd-os-ms/outbox`
   - `/Users/masa/.codex/automations/amd-os-ms/applied`
   - `/Users/masa/.codex/automations/amd-os-ms/failed`
   - `/Users/masa/.codex/automations/amd-atlas/outbox`
4. If continuing L2 review, run:
   - `node pwa/scripts/ms_progress_review_tool.mjs health`
   - `node pwa/scripts/ms_progress_review_tool.mjs automation-prepare --ym 202605`
   - if health fails but local snapshot exists, continue observation-only and clearly mark stale snapshot.

## Open Tasks

- UI/admin support for `project_freeze_periods` is not done. DB/helper/docs are done; PWA consumption may still need implementation.
- CTB freeze history is fixed, but the resumed plan-cycle/MS shape may still need follow-up if cockpit needs a 202604-202605 cycle rather than old `PC-p06-202306-202412`.
- Verify the next Atlas automation run creates an outbox and the local applier ingests it.
- Re-check KUTE/CLG/SX raw-data route gaps after the next snapshot refresh. Prior runs showed KUTE Gmail present but Slack/Drive/Notion/OS reflection gaps.
- Old failed outboxes remain:
  - `/Users/masa/.codex/automations/amd-os-ms/failed/20260516-131550-diff-review.failed.json`
  - `/Users/masa/.codex/automations/amd-os-ms/failed/20260516-191058-diff-review.failed.json`
  Review only if needed; later outboxes superseded many candidates.

## Verification Commands Run This Session

- `node pwa/scripts/ms_progress_review_tool.mjs refresh-snapshot --ym 202605`
- `node pwa/scripts/ms_progress_review_tool.mjs local-snapshot --project p06 --ym 202605`
- `node pwa/scripts/atlas_signal_review_tool.mjs health`
- `node pwa/scripts/atlas_signal_review_tool.mjs recent --hours 48 --limit 5`
- `launchctl print gui/$(id -u)/jp.teamarmada.amd-os-ms-outbox-applier`
- `npx vercel --prod --yes --cwd /Users/masa/projects/AMD/amd-os`
