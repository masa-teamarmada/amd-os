# SESSION MIGRATION PROMPT - AMD OS H-1 task registration

```text
cd /Users/masa/projects/AMD/amd-os

まず `HANDOFF.md` を読んで。次に `pwa/spec/3-3-meeting-flow-current-spec.md`、`pwa/spec/2-1-pwa-runtime-routes.md`、`pwa/spec/2-2-pwa-surface-inventory-current-spec.md`、その次に `pwa/BUGS.md` を読んで。続けて `pwa/manual/3-2-data-and-extraction.md`、`pwa/manual/8-3-l2-extraction-routines-spec.md`、`pwa/scheduled-tasks/amd-os-l6-meeting-extract/SKILL.md`、`pwa/design_log/sessions_2026-06.md` の最新 `2026-06-19 - H-1 task auto-registration + owner Slack nudge` を読んで。

今回の current truth:
- `/admin/calendar-review` は削除済み。admin が全件レビューする運用にはしない。
- H-1 の MTGカード / 議事録 / Gmail TODO / Slack TODO 由来の次アクションは `POST /api/task-calendar/register-tasks` で `tasks` に自動登録する。
- route は `WORKFLOW_SECRET` / `CRON_SECRET` または admin auth でのみ実行できる。未認証は 401。
- `task_id` で重複を止める。既存 task は既定で再通知しない。必要時だけ `renotify_existing=true`。
- Slack nudge は担当者本人だけへ送る。送信先は payload の `owner_slack_user_id`、無ければ `members.slack_id`。`send_slack=true` かつ non-dry-run の時だけ実送信する。
- PWA route は Calendar event 作成、Gmail送信、外部attendee招待、admin DM をしない。
- Calendar 作業枠候補が必要な場合だけ `/api/task-calendar/schedule-plan` を dry-run planner として使う。
- 実装 commit は `2354e085 feat(pwa): register H1 tasks with owner nudges`。production は closeout 時点で `v0.28.12` / `b2277b5f` / `dirty=false`、この commit を含む。
- 検証では実Slack DMは送っていない。送信テストをする場合は対象・件数・rollback・通知有無を先に明確にする。

作業前に必ず:
1. `git fetch origin main`
2. `git status -sb`
3. `curl -sS https://amd-os-pwa.vercel.app/api/build-info`

注意:
- `/Users/masa/projects/AMD/amd-os` は closeout 時点で finance/admin 系の unrelated dirty が残っていた。新作業に使う前に owner/action を確認する。
- 別 branch `codex/cx-contract-terms-cap-fix` に `019cdc4c feat(contracts): add contract terms cap source` の未push commit がある。今回の H-1 task registration とは別件。
- `git add .` は使わない。
- H-1 automation 側へ配線するなら、まず `dry_run=true` で payload と重複判定を確認し、owner Slack mapping が正しい時だけ `send_slack=true` にする。
```
