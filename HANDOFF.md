# AMD OS Handoff

Last updated: 2026-07-16 JST
Target: `/Users/masa/projects/AMD/amd-os`
Topic: `/admin/private-wiki` 人物文脈6項目化 closeout

## Latest Session Summary

- まさ依頼で `/admin/private-wiki` から `tags` 入力・tag filter を外し、誕生日 / 出身地 / 居住地 / 接点 / 家族 / タブーを追加した。
- DB migration `pwa/scripts/migrations/173_private_wiki_person_context_fields.sql` を追加し、production DBへ適用済み。
- API `/api/admin/private-wiki` は新6項目を保存/更新し、`tag` query と `tags` payload normalize を撤去済み。
- UI `AdminPrivateWikiClient` は新6項目を編集・一覧表示・検索対象にし、tag chip/filter/input は削除済み。
- spec/manual/design/db_schema/FEATURE_REGISTRY/critical UI/changelog を同期済み。
- 実装 commit `0d0cf4a0 Update admin private wiki person context fields` は `main` に入り、本番にも含まれている。
- 後続の別件 score fix commit `692db89b fix(pwa): contain score factor tables` も `origin/main` / production に反映済み。private wiki 変更はその current line に含まれる。
- 詳細ログ: `pwa/design_log/sessions_2026-07.md` の「Admin 裏wikiを人物文脈6項目へ更新」。

## Repo State

- Canonical branch: `main`。
- Implementation baseline before this handoff-docs commit: `692db89b fix(pwa): contain score factor tables`。
- Production readback before this handoff-docs commit: `https://amd-os-pwa.vercel.app/api/build-info` -> `build_version=v3.41.16`, `git_sha=692db89b17fe8dec83466db184e17b697bc31ebe`, `dirty=false`。
- This handoff update itself may create a newer docs-only commit and production SHA; next session must re-read `/api/build-info` instead of trusting this hash as final.
- Private wiki accepted commit: `0d0cf4a0` (ancestor of current `main`)。
- Branch/worktree cleanup: stale Claude worktrees `amazing-chebyshev-4b88bc` and `vibrant-chandrasekhar-1331a9` were main-aligned, evidence archived under `/Users/masa/.codex/cleanup_archives/20260716-142214-amd-os-stale-claude-worktrees`, then removed with their local branches.
- Remaining worktree list after cleanup: root checkout only.

## Verification Run

- `python3 -X utf8 scripts/apply_ddl.py scripts/migrations/173_private_wiki_person_context_fields.sql` -> OK (201)。
- `python3 -X utf8 scripts/dump_schema.py` -> `pwa/design/db_schema.md` regenerated; `private_wiki_entries` now has columns 20-25 for the six new fields.
- `npm run test:critical-ui` -> pass。
- `npx eslint 'src/app/(app)/admin/private-wiki/page.tsx' src/app/api/admin/private-wiki/route.ts src/components/admin/AdminPrivateWikiClient.tsx` -> pass。
- `npm run build` -> pass。
- Deploy: clean disposable cloneから `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh` を実行し、`v3.41.15` / `0d0cf4a0` の本番反映を確認。その後、別件 `v3.41.16` が本番へ入り、private wiki commit は ancestor として含まれている。
- Unauthenticated production API check: `/api/admin/private-wiki` -> `401 Unauthorized`。admin gate は維持。
- 未実施: adminログイン済みブラウザでの手操作 smoke。auth-gated のため次回必要ならまさログイン状態で確認する。

## Dirty State

| path | status | class | owner guess | resolution action | next judgment condition | risk |
|---|---:|---|---|---|---|---|
| `pwa/design/atlas_routine.md` | M | other-worker | Atlas / D-8 routine lane | Do not stage here. Atlas owner should commit/deploy or revert as its own bundle. | Before next Atlas/routine closeout. | medium |
| `pwa/scheduled-tasks/amd-os-l6-meeting-extract/SKILL.md` | M | other-worker | L6 meeting extract lane | Do not stage here. L6 owner should verify and commit/deploy or revert. | Before next L6 closeout. | medium |
| `pwa/scheduled-tasks/amd-os-l6-meeting-reviewer/SKILL.md` | M | other-worker | H-1 meeting summary reviewer lane | Do not stage here. H-1 owner should verify and commit/deploy or revert. | Before next H-1 reviewer closeout. | medium |
| `pwa/scripts/check_h1_meeting_summary_reviewer.mjs` | M | other-worker | H-1 meeting summary reviewer lane | Do not stage here. H-1 owner should verify test coverage and commit/deploy or revert. | Before next H-1 reviewer closeout. | medium |
| `pwa/scripts/review_h1_meeting_summary.mjs` | M | other-worker | H-1 meeting summary reviewer lane | Do not stage here. H-1 owner should verify report wording and commit/deploy or revert. | Before next H-1 reviewer closeout. | medium |
| `pwa/bzm/2026-07-14_frontmatter_gairei_draft_v1.md` | ?? | preexisting / other-worker | Book A frontmatter lane | Keep. BZM/frontmatter owner should decide register/move/delete after Masa review. | Before next Book A frontmatter closeout. | low-medium |

The exact dirty file list can change because active lanes share this checkout. Next session must rerun `git status -sb --untracked-files=all`.

## Unresolved Tasks

- None for `/admin/private-wiki` implementation/deploy.
- Optional manual smoke: logged-in admin opens `/admin/private-wiki`, creates/edits a dummy entry with the six new fields, confirms tag UI is gone, then archives the dummy entry.
- Repo hygiene: remaining unrelated dirty paths above belong to their owner lanes and must not be mixed into private wiki closeout.

## First Next Action

1. Run:
   ```bash
   cd /Users/masa/projects/AMD/amd-os
   git fetch origin main
   git status -sb --untracked-files=all
   git log -1 --oneline
   curl -fsS https://amd-os-pwa.vercel.app/api/build-info
   ```
2. If continuing private wiki work, open the logged-in production admin page and do the optional manual smoke above.
3. If closing repo hygiene, handle the three remaining dirty groups by owner lane; do not use `git add .`.

## Pointers

- Runtime route spec: `pwa/spec/2-1-pwa-runtime-routes.md`
- Admin manual: `pwa/manual/2-6-admin-ops.md`
- PWA surface spec: `pwa/design/SPEC_pwa.md`
- Feature registry: `pwa/design/FEATURE_REGISTRY.md`
- DB schema: `pwa/design/db_schema.md`
- Critical UI guard: `pwa/scripts/check_pwa_critical_ui.cjs`
- Session log: `pwa/design_log/sessions_2026-07.md`
- Session migration prompt: `SESSION_MIGRATION_PROMPT.md`
- PWA / AMD OS rules: `CLAUDE.md`, `pwa/AGENTS.md`, `pwa/CLAUDE.md`

## Guardrails

- `/admin/private-wiki` is admin-only. Do not surface these fields in normal cockpit, public pages, or institution external workspace.
- `tags` remains in DB only for compatibility; do not restore it as UI/API input, filter, or required anchor.
- Private fields must stay minimal and source-backed. Do not paste raw emails, full meeting notes, private URLs, secrets, or unnecessary personal details into durable artifacts.
- PWA deploy is `main push = Vercel production`; use `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh` from a clean checkout when shipping.
- `git add .`は禁止。対象ファイルだけ明示stage。
