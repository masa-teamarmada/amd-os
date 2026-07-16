# SESSION MIGRATION PROMPT — `project_ventures.display_name` 廃止 closeout

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
8. /Users/masa/projects/AMD/amd-os/pwa/design/cockpit.md
9. /Users/masa/projects/AMD/amd-os/pwa/manual/2-3-pj-cockpit.md
10. /Users/masa/projects/AMD/amd-os/pwa/manual/4-7-venture-status-narrative-pl-xrl-spec.md
11. /Users/masa/projects/AMD/amd-os/pwa/design/db_schema.md
12. /Users/masa/projects/AMD/amd-os/pwa/manual/9-3-appendix-changelog.md
13. /Users/masa/projects/AMD/amd-os/pwa/design_log/sessions_2026-07.md
14. /Users/masa/projects/AMD/amd-os/pwa/BUGS.md

状態スナップショット:
- canonical PJ 名は `projects.project_name` のみ。`project_ventures.display_name` は DB / code ともに legacy として廃止済み。
- 対外 alias / 検索語は `pwa/src/lib/project-labels.ts` の `getPrimaryProjectAlias()` / `getProjectSearchAliases()` を使う。`client_name` を canonical 名の代用にしない。
- live DB には 2026-07-16 JST に migration 178 を適用済み。`project_ventures.display_name` 列は削除済み、`project_knowledge` の旧 `PJ 表示名` 行は 0。
- exact `LisTie` scan は public base table の text/varchar/char 全走査で 0件。`p07` は `project_name=LST`, `client_name=LiSTie株式会社`, `news_search_query="LiSTie|リスティー"`。
- production readback を 2026-07-16 JST に確認した時点では `build_version=v3.44.1`, `git_sha=63c635ba241e5bbe8ca029fd691aeb32d9326d06`, `git_branch=main`, `dirty=false`。
- ただし closeout 中に GitHub `main` はさらに進んだ。root checkout の SHA は揺れるので、次回は `git fetch origin main` と `/api/build-info` の両方を取り直してから current truth を決める。

今回確立した仕様:
- Chrome tab / cockpit / HUD / venture-map / seeds / Tsukuyomi / funding / intro HTML / knowledge sync / founding members の PJ 名正本は `projects.project_name`。
- `project_ventures.display_name` を select / write する path は current source から除去済み。
- `PJ 表示名` knowledge は legacy。今後は `PJ名` のみ使う。
- `LiSTie` の表記修正は DB と docs に反映済み。古い `LisTie` は historical migration / changelog / unrelated text domain 以外に残さない。

検証済み:
- live DB verification query:
  - `project_ventures_display_name_column_exists=false`
  - `project_knowledge_pj_display_name_rows=0`
  - `exact_lisitie_hits=[]`
- source/docs grep で残る `display_name` は finance / member profile / historical migration だけ。
- shared root checkout の `./node_modules/.bin/tsc --noEmit --pretty false` は `.next/types/validator.ts` の stale route 参照で失敗。display_name bundle 固有の型エラーとは扱わない。

次タスク:
1. `git fetch origin main`、`git log -1 --oneline`、`git status -sb --untracked-files=all`、`git rev-list --left-right --count HEAD...origin/main` を最初に実行する。root shared checkout は multi-writer で SHA が動く。
2. `curl -fsS https://amd-os-pwa.vercel.app/api/build-info` を読み、production SHA が session 内で見た `63c635ba...` から進んでいるか確認する。
3. `/project/p07` を開き、tab title / HUD / venture-map / seed 関連 UI に `LisTie` や legacy display name が残っていないか確認する。
4. 新しい PJ alias path を作るなら `pwa/src/lib/project-labels.ts` を再利用し、`project_ventures.display_name` と `PJ 表示名` は二度と復活させない。
5. `pwa/BUGS.md` への今回の lesson 追記は未実施。shared root では reward-finance lane が同ファイルを dirty にしているので、混ぜずに owner を見て別 bundle にする。

次回開始時に必ず実行:
git fetch origin main
git status -sb --untracked-files=all
git rev-list --left-right --count HEAD...origin/main
git log -1 --oneline
curl -fsS https://amd-os-pwa.vercel.app/api/build-info

残dirtyのowner lane:
- reward-finance: pwa/BUGS.md, pwa/scripts/migrations/165_void_zmp_legacy_agreement_offsets.sql, pwa/src/lib/finance/live-monthly-pl-inputs.ts, pwa/src/lib/finance/monthly-pl-simulation.ts, pwa/src/lib/reward-summary.ts
- notifications: pwa/design/notifications.md, pwa/manual/3-3-notifications-and-tsukuyomi.md, pwa/manual/8-2-notification-review-and-strategy-signals-spec.md, pwa/spec/3-7-notifications-current-spec.md, pwa/spec/6-1-appendix-changelog.md, pwa/src/components/notifications/NotificationsClient.tsx
- Atlas D-8: pwa/design/atlas_routine.md
- L6 extract: pwa/scheduled-tasks/amd-os-l6-meeting-extract/SKILL.md
- H-1 reviewer: pwa/scheduled-tasks/amd-os-l6-meeting-reviewer/SKILL.md, pwa/scripts/check_h1_meeting_summary_reviewer.mjs, pwa/scripts/review_h1_meeting_summary.mjs
- Book A巻頭 draft: pwa/bzm/2026-07-14_frontmatter_gairei_draft_v1.md
これらを display_name / cockpit bundle に混ぜない。dirty 一覧は変動するので stage 前に取り直す。

確立済み運用ルール:
- branch/worktreeを新規作成しない。shared root の SHA が動く時は main の disposable clean clone へ切り替える。
- 対象ファイルだけ明示stageし、`git add .`を使わない。
- PWA本番反映は `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh`。
- local checkout、origin/main、production `/api/build-info` を並べてcurrent truthを決める。
- canonical PJ名は `projects.project_name`、alias は helper 経由、legacy `display_name` / `PJ 表示名` は復活させない。
- raw本文、個人情報、secret、private URLをhandoffやdurable logへ残さない。
```
