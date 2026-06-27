# SESSION MIGRATION PROMPT - AMD OS closeout refresh

```text
cd /Users/masa/projects/AMD/amd-os

まず `HANDOFF.md` を読んで。次に仕様正本として `pwa/spec/3-7-notifications-current-spec.md` / `pwa/spec/3-3-meeting-flow-current-spec.md` / `pwa/spec/5-7-task-management-current-spec.md` を読み、そのあと `pwa/BUGS.md`、`CLAUDE.md`、`AGENTS.md`、`pwa/CLAUDE.md` を読んで。

今回の current truth:
- local branch: `main`
- local HEAD / origin/main: `0f0a7dbc79085a39ceaed4d4a69c17711cdb0f4c` (`fix(pwa): exclude counterpart proactive todos`)
- production `/api/build-info` checked 2026-06-28 JST: `v0.36.19` / `0f0a7dbc79085a39ceaed4d4a69c17711cdb0f4c` / `dirty=false`
- main alignment: main aligned
- production alignment: production aligned
- unpushed commits: none
- working tree: dirty mixed WIP

未解決の本筋:
- `/admin/payouts` は、まさの観測ではまだデータ表示まで約15秒かかる。
- この closeout では性能修正はしていない。次回は関連 md を先に読む。
- 入口: `pwa/BUGS.md` の `[pwa/admin-payouts]` 2026-06-23 entries、`pwa/design/db_schema.md` の `billing_cycles` / `payout_agreement` / `payout_notices`、`pwa/design/management_score.md` の payout / reward cache 周辺。
- その後、`/api/admin/payouts` 通常GET、SSR `loadTargetData(... includeAgreementGate:false)`、client revalidation、`gateOnly=1` のどこで15秒待っているかを切り分ける。

作業開始前に必ず:
1. `git fetch origin main --prune`
2. `git status -sb --untracked-files=all`
3. `git log --left-right --oneline main...origin/main`
4. `curl -fsSL https://amd-os-pwa.vercel.app/api/build-info`
5. `git diff --name-status`

dirty の大きな塊:
- notification noise stop WIP:
  - `gas/153_MeetingHourlyTrigger.js`
  - `pwa/src/lib/notifications-data.ts`
  - `pwa/src/components/nav/GlobalNav.tsx`
  - `pwa/src/components/notifications/AppNotificationsSection.tsx`
  - `pwa/src/components/notifications/CriticalRealtimeNotify.tsx`
  - `pwa/src/app/(app)/notifications/page.tsx`
  - `pwa/src/app/api/tasks/route.ts`
  - `pwa/src/app/api/task-calendar/register-tasks/route.ts`
  - `pwa/src/app/api/meeting-workflow/finalize/route.ts`
  - `pwa/src/app/api/notifications/feedback/route.ts`
  - `pwa/src/lib/operations-catalog.ts`
  - `pwa/scripts/migrations/155_skip_non_actionable_app_notifications.sql`
  - `pwa/scripts/migrations/156_skip_meeting_summary_notifications.sql`
  - related spec/design/manual/BUGS/design_log docs
- Atlas visual/UI WIP:
  - multiple `pwa/src/app/(app)/atlas/**` files
- Admin/Kiyo WIP:
  - `pwa/src/components/admin/AdminSidebar.tsx`
  - `pwa/src/app/(app)/admin/kiyo/page.tsx`
- meeting assets / project labels WIP:
  - `pwa/src/app/api/meeting-assets/replace/[assetId]/route.ts`
  - `pwa/src/lib/project-labels.ts`
  - `pwa/scripts/update_drive_file.mjs`
  - `pwa/scripts/migrations/153_project_venture_legacy_name_hygiene.sql`
- H-1 meeting prep outbox markdowns under:
  - `pwa/scheduled-tasks/amd-os-l6-meeting-prep-worker/outbox/`
- local-only artifact:
  - `gas-slack/.clasp.json`

次の進め方:
1. まずどの bundle を閉じるか決める。notification / Atlas UI / Admin-Kiyo / meeting-assets / H-1 outbox を混ぜない。
2. `git add .` は絶対に使わず、選んだ bundle のファイルだけ個別 stage する。
3. stage 後に `git diff --staged --stat` と `git diff --staged --name-status` を確認する。
4. notification stop bundle を触る場合は、DB migration 155/156 の適用有無、GAS writer 停止、PWA表示除外、manual/spec同期をまとめて検証する。
5. PWA deploy が必要なら `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh` を使う。直接 `npx vercel deploy` は使わない。
6. deploy 後は `/api/build-info` で build version / git sha / dirty=false を確認する。

守ること:
- AMD OS は main 一本。main と本番の差分を曖昧にしない。
- dirty tree から見えた未確認ファイルは勝手に削除しない。
- `COMMANDER_TASKS.md` はオーケストレーションボードではない。タスク登録の正本と混同しない。
- `/tasks` はすでに廃止対象。新規 UI 変更と混ぜない。
```
