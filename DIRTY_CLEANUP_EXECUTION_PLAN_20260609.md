# Dirty Cleanup Execution Plan 2026-06-09

このbranchは古い root checkout (`v0.15.3`) に溜まっていた dirty の保管庫。
目的は、このbranchを丸ごと merge することではなく、current root
`/Users/masa/projects/AMD/amd-os` の `v0.16.24+` line に必要な差分だけを
小さく再portし、残りを明示的に破棄できる状態にすること。

## Execution Rules

- root current checkout は `/Users/masa/projects/AMD/amd-os`。
- archive checkout は `/Users/masa/.codex/worktrees/root-dirty-recovery-20260609`。
- 作業開始ごとに root current で freshness gate を通す。
- archive branch を丸ごと merge / rebase / deploy しない。
- `git add .` は使わない。対象ファイルだけ stage する。
- DB write、Notion write、Drive write、Slack send、automation変更、production deploy はしない。
- Calendar / Slack / DB へ実writeするコードは、このcleanupでは持ち込まない。
- root current が dirty になったら、そのbucketを完了またはstashするまで次bucketへ進まない。

## Start Gate

```bash
cd /Users/masa/projects/AMD/amd-os
git fetch --all --prune
AMD_OS_MIN_BUILD_VERSION=v0.16.20 \
  AMD_OS_BASE_REF=origin/codex/prs-docs-v01618 \
  scripts/worker-freshness-check.sh
git status --short --branch
```

## Inventory

Archived dirty commit:

- `10dc61af wip: archive stale root dirty state`

Current root target:

- `codex/root-current-v01624`
- latest checked head when this plan was written: `330a939d docs: record pwa vercel project guard`
- `BUILD_VERSION=v0.16.24`

## Bucket Plan

| bucket | files | action | completion |
|---|---|---|---|
| A. Already current | `scripts/worker-freshness-check.sh` | 更新不要。同一内容が current root に存在する。 | No action. |
| B. Archive metadata | `DIRTY_RECOVERY_20260609.md`, this plan | archive branch only。current rootへ移植しない。 | Plan updated; archive clean. |
| C. Commander / migration notes | `COMMANDER_TASKS.md`, `HANDOFF_CLAUDE_MIGRATION_20260604.md`, `SESSION_MIGRATION_PROMPT_CLAUDE_20260604.md` | 原則破棄。歴史ログとしてarchiveに残すだけ。current truthへ必要な1行だけ確認して転記する。 | root `COMMANDER_TASKS.md` に必要なcurrent deploy gateだけ存在。残りはre-portしない。 |
| D. Calendar dry-run planners | `pwa/src/lib/meeting-calendar-upsert-plan.ts`, `pwa/src/lib/task-calendar-schedule-plan.ts`, related API routes, fixtures, check scripts, package scripts | 最優先の移植候補。dry-run onlyかつ `execute` / `dry_run=false` で拒否することを確認してから、current rootの新branchへ再portする。 | tests pass, route returns `write_enabled:false`, no Calendar/DB write path added. |
| E. L6 meeting extraction skill docs | `pwa/scheduled-tasks/amd-os-l6-meeting-extract/SKILL.md`, `pwa/spec/3-3-meeting-flow-current-spec.md` | Bucket D と同時に照合。dry-run planner説明だけ current docs に合わせて移植。 | Dの実装とdocsが矛盾しない。 |
| F. PRS / AMD Score / L2 / ERS docs | `pwa/design/*`, `pwa/manual/*`, `pwa/spec/*`, chapter index files | 丸ごと移植禁止。current `v0.16.24+` docsとの差分を読み、まだ欠けている説明だけ手で再portする。 | docs impact classified as updated / no update / confirm, build unaffected. |
| G. Generated/temp | Supabase `.temp`, empty `pwa/supabase/postgres.sql` | 既にarchive commitから除外済み。 | No action. |

## Bucket D Execution

1. root current で専用branchを切る。

```bash
cd /Users/masa/projects/AMD/amd-os
git switch -c codex/recover-calendar-dry-run-v01624
```

2. archiveから新規ファイルだけを取り出す。`package.json` は丸ごと戻さず、script行だけ追加する。

```bash
git checkout codex/root-dirty-recovery-20260609 -- \
  pwa/src/lib/meeting-calendar-upsert-plan.ts \
  pwa/src/lib/task-calendar-schedule-plan.ts \
  pwa/src/app/api/meeting-calendar/upsert-plan/route.ts \
  pwa/src/app/api/task-calendar/schedule-plan/route.ts \
  pwa/scripts/check_meeting_calendar_upsert_plan.mts \
  pwa/scripts/check_task_calendar_schedule_plan.mts \
  pwa/scripts/__fixtures__/meeting_calendar_upsert_plan.json \
  pwa/scripts/__fixtures__/task_calendar_schedule_plan.json
```

3. `pwa/package.json` にだけ、以下2 scriptを手で追加する。

```json
"test:meeting-calendar-upsert-plan": "node --experimental-strip-types scripts/check_meeting_calendar_upsert_plan.mts --fixture scripts/__fixtures__/meeting_calendar_upsert_plan.json",
"test:task-calendar-schedule-plan": "node --experimental-strip-types scripts/check_task_calendar_schedule_plan.mts --fixture scripts/__fixtures__/task_calendar_schedule_plan.json"
```

4. Safety review:

```bash
rg -n "\\.insert|\\.update|\\.upsert|\\.delete|calendar\\.events|slack|execute|dry_run|write_enabled" \
  pwa/src/lib/meeting-calendar-upsert-plan.ts \
  pwa/src/lib/task-calendar-schedule-plan.ts \
  pwa/src/app/api/meeting-calendar/upsert-plan/route.ts \
  pwa/src/app/api/task-calendar/schedule-plan/route.ts
```

5. Verification:

```bash
cd /Users/masa/projects/AMD/amd-os/pwa
npm run test:meeting-calendar-upsert-plan
npm run test:task-calendar-schedule-plan
npx tsc --noEmit
npm run build
```

6. Stage only the files in Bucket D and any explicitly reviewed docs from Bucket E.

## Bucket F Execution

Bucket F はdocsだけでも古いbaseの主語が混ざる危険があるため、次の手順で進める。

1. current root と archive の同名ファイルを1ファイルずつ比較する。
2. `PRS primary`、`R_net`、`L2旧slug`、`KUTE routing`、`contracts / MTG attachments`
   を巻き戻す文言がないか確認する。
3. current docsにまだ無い説明だけを手で追加する。
4. changelog行は、移植した内容に対応するものだけ current の末尾へ追加する。
5. `npm run build` で `/manual` `/spec` routesが壊れないことを確認する。

## Close Criteria

cleanup完了は以下を満たした時だけ。

- root current は `v0.16.24+` freshness gate OK。
- root current working tree clean。
- Bucket D/E/F が `ported / already-current / discarded` のどれかに分類済み。
- archive branchに未分類差分が残っていない。
- まさが確認した後にだけ、archive worktree / branch を削除する。

削除コマンドは最後だけ使う。

```bash
git worktree remove /Users/masa/.codex/worktrees/root-dirty-recovery-20260609
git branch -D codex/root-dirty-recovery-20260609
```

削除前に、root current側に必要なcommitが残っていることを確認する。
