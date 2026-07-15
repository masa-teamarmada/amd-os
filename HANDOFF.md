# AMD OS Handoff

Last updated: 2026-07-15 JST
Target: `/Users/masa/projects/AMD/amd-os`
Topic: 日本文化マップを admin 内導線へ再固定

## Latest Session Summary

- まさ指摘「日本文化ページは admin に移動したはずなのに、またトップに戻ってる」を調査。
- 原因は巻き戻りではなく、2026-07-09 の移動 commit で旧「資料」グループからは外した一方、共通左サイドナビ `GlobalNav` の Admin group に `/admin/japanese-culture-map` 入口を残していたこと。
- `GlobalNav` から「日本文化」を削除し、入口を admin 画面内 `AdminSidebar` のみに限定した。
- 再発防止として `test:critical-ui` に「GlobalNav に `日本文化` / `/admin/japanese-culture-map` / `/japanese-culture-map` が戻ったら失敗する」ガードを追加。
- 恒久仕様は `pwa/design/FEATURE_REGISTRY.md`、`pwa/manual/2-6-admin-ops.md`、manual/spec changelog、`pwa/design/os_manual.md`、`pwa/BUGS.md` に反映済み。
- 詳細ログ: `pwa/design_log/sessions_2026-07.md` の「2026-07-15 — 日本文化マップを admin 内導線へ再固定」。

## Repo State

- Canonical branch: `main`.
- Accepted production commit: `7758389a fix(pwa): keep japanese culture map admin-only`.
- Production: `https://amd-os-pwa.vercel.app/api/build-info` readback at closeout was `build_version=v3.40.2`, `git_sha=7758389ad8bcc4115e32651e2b45e47b5daab41b`, `git_branch=main`, `dirty=false`.
- Local main was aligned to `origin/main` after the clean deploy clone push. No local unpushed commits remained before this handoff-doc commit.
- This handoff may be followed by a docs-only handoff commit; run `git log -1 --oneline` and `/api/build-info` at next start.

## Verification Run

- `npm run test:critical-ui` passed.
- `npx tsc --noEmit` passed.
- `npm run build` passed.
- `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh` completed in the clean deploy clone and production build-info matched the new commit.
- `git log --branches --not --remotes --oneline` returned empty before handoff-doc edits.

## Dirty State

| path | status | class | owner guess | resolution action | next judgment condition | risk |
|---|---:|---|---|---|---|---|
| `pwa/design/atlas_routine.md` | M | preexisting / other-worker | Atlas routine docs lane | Do not mix into this nav closeout. Next Atlas/routine owner should decide commit vs revert after reading diff. | Before next Atlas routine docs/deploy closeout. | medium: stale routine notes can be mistaken for current truth. |
| `pwa/bzm/2026-07-14_frontmatter_gairei_draft_v1.md` | ?? | preexisting / other-worker | BZM/frontmatter draft lane | Do not remove here. BZM owner should decide whether to register, move, or delete the draft. | Before next BZM publication/frontmatter session closes. | low-medium: untracked draft can be missed or accidentally swept later. |

## Unresolved Tasks

- None for the 日本文化マップ nav regression.
- Existing unrelated dirty above still needs its own owner closeout. This session did not create it and did not modify it.

## First Next Action

1. Run:
   ```bash
   cd /Users/masa/projects/AMD/amd-os
   git fetch origin main
   git status -sb --untracked-files=all
   git log -1 --oneline
   curl -fsS https://amd-os-pwa.vercel.app/api/build-info
   ```
2. If the user reports 日本文化 appearing on the top/common left nav again, inspect `pwa/src/components/nav/GlobalNav.tsx` first. `npm run test:critical-ui` should fail if it was re-added there.
3. Do not move the Japanese culture entry out of `AdminSidebar` unless the design contract in `FEATURE_REGISTRY.md` and manual/spec changelogs are intentionally changed.

## Pointers

- Runtime route spec: `pwa/spec/2-1-pwa-runtime-routes.md`
- Surface inventory: `pwa/spec/2-2-pwa-surface-inventory-current-spec.md`
- Feature contract / regression guard: `pwa/design/FEATURE_REGISTRY.md`
- Admin ops manual: `pwa/manual/2-6-admin-ops.md`
- Bug record: `pwa/BUGS.md`
- Session log: `pwa/design_log/sessions_2026-07.md`
- Critical UI guard: `pwa/scripts/check_pwa_critical_ui.cjs`

## Guardrails

- `GlobalNav` must not contain `日本文化`, `/admin/japanese-culture-map`, or `/japanese-culture-map`.
- The actual page remains `/admin/japanese-culture-map`; the legacy `/japanese-culture-map` route is redirect-only for old bookmarks.
- `AdminSidebar` remains the only UI entry for this admin knowledge view.
- PWA production changes go through `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh`; direct `npx vercel deploy` remains prohibited.
- `git add .` remains prohibited; stage only the explicit target files.
