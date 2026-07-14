# SESSION MIGRATION PROMPT — SX SolvioraX W-Prep closeout

```text
cd /Users/masa/projects/AMD/amd-os

最初に読む順:
1. /Users/masa/projects/AGENTS.common.md
2. /Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md
3. /Users/masa/projects/AMD/amd-os/HANDOFF.md
4. /Users/masa/projects/AMD/amd-os/CLAUDE.md
5. /Users/masa/projects/AMD/amd-os/AGENTS.md
6. /Users/masa/projects/AMD/amd-os/pwa/AGENTS.md
7. /Users/masa/projects/AMD/amd-os/pwa/CLAUDE.md
8. /Users/masa/projects/AMD/amd-os/pwa/spec/3-3-meeting-flow-current-spec.md
9. /Users/masa/projects/AMD/amd-os/pwa/manual/8-3-l2-extraction-routines-spec.md
10. /Users/masa/projects/AMD/amd-os/pwa/design/L2_DATA.md
11. /Users/masa/projects/AMD/amd-os/pwa/scheduled-tasks/README.md
12. /Users/masa/projects/AMD/amd-os/pwa/BUGS.md
13. /Users/masa/projects/AMD/amd-os/pwa/design_log/sessions_2026-07.md

状態スナップショット:
- 2026-07-14 11:00 JST の SX `SolvioraX経営会議` prep が未起動だった件は手動復旧済み。
- DB row `upcoming:7k11p8g6rs5lf9jhtfcvglnn1d_20260714T020000Z` は readback で `prep_worker_status='ready'`、session id `019f5c0a-049a-73c0-a424-679689934c33`、prep draft 保存済み。
- 原因は Calendar recurring 予定やスプシ正本の欠落ではない。`CFG_PJAlias: SolvioraX -> SX` と `CFG_ColorPJHistory: 2025-06-01+ colorId=4 -> SX` は既にあった。W-Prep がそれを必ず使う契約になっていなかった。
- active automation `/Users/masa/.codex/automations/w-prep-launch/automation.toml` は更新済み。Calendar直読みのPJ推定は `CFG_ColorPJHistory` first、`CFG_PJAlias` next、`SolvioraX` / `colorId=4` は SX/p21。
- AMD OS repo側は `calendar-sync` alias mirror に `p21: ["SolvioraX"]` を追加し、critical-ui guard / spec / manual / L2_DATA / scheduled-tasks README / BUGS / design_log / changelog を同期。`BUILD_VERSION` は `v3.39.67`。
- functional PWA bundle commit は `29caad07 fix(pwa): harden SolvioraX prep mapping`。その後に docs-only closeout commit が続くため、final HEAD / production build-info は作業開始時に `git log -1 --oneline` と `curl https://amd-os-pwa.vercel.app/api/build-info` で取り直す。
- closeout cleanup 済み: stale `.claude/worktrees` 6個と local `claude/*` branch 6本は main-aligned 確認後に削除済み。final inventory は root worktree 1個、local branch `main` のみ。

次タスク:
1. まず `git fetch origin main`、`git status -sb`、`git log -1 --oneline`、`git rev-list --left-right --count HEAD...origin/main` を実行する。
2. production `/api/build-info` を確認し、`v3.39.67` 以降、`dirty=false`、branch `main` になっているか見る。
3. 次の W-Prep run で SX recurring event がまた漏れた場合は、Calendar作成タイミングではなく、まず active W-Prep prompt と `CFG_ColorPJHistory` / `CFG_PJAlias` の読み取りを疑う。
4. `SolvioraX経営会議` は、title alias `SolvioraX` または `2025-06-01` 以降の `colorId=4` がある限り SX/p21 として扱う。unmapped skip してはいけない。

確立済みルール:
- W-Prep は DB upcoming だけを見て完了扱いにしない。必ず Calendar の同じ7日窓を直接見る。
- Calendar direct-scan のPJ推定順は `CFG_ColorPJHistory` → `CFG_PJAlias` / title alias → `projects.project_name/client_name` fallback。
- `create_thread` target は PJ directory 優先。SX は `/Users/masa/projects/AMD/SX`。`/Users/masa/projects/AMD/amd-os` は prep thread 作業場にしない。
- thread は `{meeting_title} prep` に改題し、pin して、DB に `prep_worker_session_id` / `prep_worker_status='preparing'` を保存してから次の会議へ進む。
- PWA code change の本番反映は `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh`。直接 `npx vercel deploy` は使わない。
- `git add .` 禁止。対象ファイルだけ stage する。
- raw本文、secret、個人情報、Drive URL を handoff / BUGS / design_log に出さない。
```
