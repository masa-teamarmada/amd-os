# AMD OS Handoff

Last updated: 2026-07-16 JST
Target: `/Users/masa/projects/AMD/amd-os`
Topic: `project_ventures.display_name` 廃止と `LisTie` 根絶確認

## Latest Session Summary

- LST cockpit の Chrome tab が `LisTie` になる根因は `pwa/src/app/(app)/project/[projectId]/layout.tsx` の legacy fallback だった。tab title は `projects.project_name` 固定へ戻した。
- PJ の canonical name は `projects.project_name`、対外 alias / 検索語だけ `pwa/src/lib/project-labels.ts` で `news_search_query` / `client_name` から導く形に整理した。
- cockpit / HUD / venture-map / seeds / Tsukuyomi / funding / intro HTML / knowledge sync / founding members など、`project_ventures.display_name` を select / write していた経路を `project_name` 基準へ統一した。
- live DB には migration 178 を 2026-07-16 JST に適用済み。`project_ventures.display_name` 列を削除し、旧 `PJ 表示名` knowledge を `PJ名` へ寄せた。
- live DB 再確認で `project_ventures.display_name` 列なし、`entity_name='PJ 表示名'` 行 0、public text/varchar/char 全走査で `LisTie` 0件、`p07` は `LST / LiSTie株式会社 / "LiSTie|リスティー"` を確認した。
- 詳細ログ: `pwa/design_log/sessions_2026-07.md` の「2026-07-16 — `project_ventures.display_name` 廃止と `LisTie` 根絶確認」。

## Current Truth

- PJ表示名の正本は `projects.project_name` のみ。`project_ventures.display_name` は DB / code ともに legacy。
- 対外 alias が必要なときだけ `getPrimaryProjectAlias()` / `getProjectSearchAliases()` を使う。`client_name` を canonical PJ 名の代用にしない。
- source tree 上の `display_name` は finance / member profile など別ドメインに残る。PJ 文脈での `display_name` は廃止済み。
- production readback を 2026-07-16 JST に確認した時点では `build_version=v3.44.1`, `git_sha=63c635ba241e5bbe8ca029fd691aeb32d9326d06`, `git_branch=main`, `dirty=false`。
- closeout 中に GitHub `main` はさらに先へ進んだ。共有 root checkout の SHA は揺れる前提で、次セッションは必ず `git fetch origin main` と `/api/build-info` を取り直す。

## Verification Run

- live DB verification query:
  - `project_ventures_display_name_column_exists=false`
  - `project_knowledge_pj_display_name_rows=0`
  - `exact_lisitie_hits=[]`
  - `p07 = { project_name: "LST", client_name: "LiSTie株式会社", news_search_query: "\"LiSTie|リスティー\"" }`
- source/docs grep で残る `display_name` は finance / member profile / historical migrations のみ。PJ文脈の `project_ventures.display_name` 参照は current source から消えている。
- shared root checkout での `./node_modules/.bin/tsc --noEmit --pretty false` は `.next/types/validator.ts` の stale route 参照で失敗した。display_name bundle の型エラーではなく、checkout local blocker と扱う。

## Dirty State

display_name 廃止 bundle 自体は current `main` に乗っている。shared root checkout の残dirtyは別レーン。

| path group | status | class / owner | resolution action | next judgment condition | risk |
|---|---:|---|---|---|---|
| `pwa/BUGS.md`, `pwa/scripts/migrations/165_void_zmp_legacy_agreement_offsets.sql`, `pwa/src/lib/finance/live-monthly-pl-inputs.ts`, `pwa/src/lib/finance/monthly-pl-simulation.ts`, `pwa/src/lib/reward-summary.ts` | M | other-worker / reward-finance lane | finance owner が単独 bundle で検証・commit・deploy | 次回 reward/finance closeout 前 | high |
| `pwa/design/notifications.md`, `pwa/manual/3-3-notifications-and-tsukuyomi.md`, `pwa/manual/8-2-notification-review-and-strategy-signals-spec.md`, `pwa/spec/3-7-notifications-current-spec.md`, `pwa/spec/6-1-appendix-changelog.md`, `pwa/src/components/notifications/NotificationsClient.tsx` | M | other-worker / notifications lane | notifications owner が単独 bundle で検証・commit・deploy | 次回 notifications closeout 前 | medium |
| `pwa/scheduled-tasks/amd-os-l6-meeting-reviewer/SKILL.md`, `pwa/scripts/check_h1_meeting_summary_reviewer.mjs`, `pwa/scripts/review_h1_meeting_summary.mjs` | M | other-worker / H-1 reviewer lane | H-1 owner が reviewer テスト後に単独 bundle 化 | 次回 H-1 closeout 前 | medium |
| `pwa/scheduled-tasks/amd-os-l6-meeting-extract/SKILL.md` | M | other-worker / L6 extract lane | L6 owner が単独 bundle で検証・commit・deploy | 次回 L6 closeout 前 | medium |
| `pwa/design/atlas_routine.md` | M | other-worker / Atlas D-8 lane | Atlas owner が単独 bundle で commit/deploy または revert | 次回 Atlas closeout 前 | medium |
| `pwa/bzm/2026-07-14_frontmatter_gairei_draft_v1.md` | ?? | preexisting / Book A巻頭 lane | Book A owner が register / move / delete を判断 | 次回 Book A closeout 前 | low-medium |

## Repo / Cleanup State

- Canonical branch: `main`。
- shared root checkout は multi-writer。closeout 中に root `HEAD` と `origin/main` が外部更新で進んだため、最終 handoff 整理は disposable clean clone で実施した。
- `bash /Users/masa/.codex/skills/closeout/scripts/closeout_inventory.sh /Users/masa/projects/AMD/amd-os` では、main-aligned の `.claude/worktrees/*` / `claude/*` が複数残っていた。active owner 不明なので、この session では prune していない。
- repo 全体の archive 判定は `do not archive`。理由は shared root の別レーン dirty と、owner 未確定の main-aligned worktree / branch 残存。

## Unresolved Tasks

- display_name 廃止そのものの追加実装タスクはなし。
- 最新 main が production `/api/build-info` に追いついた後、`/project/p07` と venture-map/HUD で `LisTie` が UI に残っていないことを再確認する。
- `pwa/BUGS.md` への今回の lesson 追記は未実施。shared root の同ファイルが reward-finance lane で dirty のため、混ぜて closeout しない。

## First Next Action

1. `/Users/masa/projects/AMD/amd-os` で `git fetch origin main`、`git log -1 --oneline`、`git status -sb --untracked-files=all`、`git rev-list --left-right --count HEAD...origin/main` を取り直す。
2. `curl -fsS https://amd-os-pwa.vercel.app/api/build-info` で production SHA を確認し、`/project/p07` を開いて tab title と HUD / venture-map 表記を再確認する。
3. PJ alias が要る新規コードでは `pwa/src/lib/project-labels.ts` を使い、`project_ventures.display_name` / `PJ 表示名` を復活させない。

## Pointers

- Canonical helper: `pwa/src/lib/project-labels.ts`
- Cockpit metadata path: `pwa/src/app/(app)/project/[projectId]/layout.tsx`
- Venture status data: `pwa/src/lib/venture-status-data.ts`
- Venture map data: `pwa/src/lib/venture-map-data.ts`
- DB schema ref: `pwa/design/db_schema.md`
- Design / manual: `pwa/design/cockpit.md`, `pwa/manual/2-3-pj-cockpit.md`, `pwa/manual/4-7-venture-status-narrative-pl-xrl-spec.md`
- Changelog: `pwa/manual/9-3-appendix-changelog.md`
- Session log: `pwa/design_log/sessions_2026-07.md`
- Next-session prompt: `SESSION_MIGRATION_PROMPT.md`

## Guardrails

- `project_ventures.display_name` を再追加しない。PJ名の正本は `projects.project_name`。
- `client_name` を canonical PJ 名の代わりに使わない。対外 alias / 検索語だけ helper 経由で扱う。
- `project_knowledge.entity_name='PJ 表示名'` を新規に書かない。PJ名は `PJ名` で揃える。
- shared root checkout で SHA が動いていたら、その場 staging を信用しない。clean clone か target-only bundle に切り替える。
