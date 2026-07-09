# AMD OS Handoff

Last updated: 2026-07-09 JST
Target: `/Users/masa/projects/AMD/amd-os`
Topic: Japanese culture map moved into admin + closeout

## Summary

- `日本文化マップ` の実画面を `/admin/japanese-culture-map` へ移動した。
- 旧 `/japanese-culture-map` は互換 redirect として残した。未ログイン時は `(app)` auth gate が先に走るため、`/auth/login?next=%2Fjapanese-culture-map` へ入る。
- グローバル nav の一般 `資料` から外し、admin nav / admin sidebar / page title mapping へ追加した。
- spec / manual / design / feature registry / changelog を admin 配下の正本へ同期した。
- Accepted product deploy: `v0.39.18` / `1327db6b4c2709bf261910868eead7168667a68e` / `dirty=false`.

## Repo State

- Canonical repo: `/Users/masa/projects/AMD/amd-os`
- Branch rule: this repo works on `main`; do not create a branch for normal AMD OS work.
- Product change commit: `1327db6b Move Japanese culture map into admin`.
- `main` and `origin/main` were aligned before this handoff refresh.
- Local branches: `main` only.
- Registered worktrees: `/Users/masa/projects/AMD/amd-os [main]` only.
- Final docs-only handoff commit may be newer than `1327db6b`; recheck `git log -1` and production `/api/build-info` after closeout deploy.
- Local tooling artifacts are normal: `.vercel/project.json`, `ios/supabase/.temp/*`, `pwa/.next`, `pwa/node_modules`. `ios/supabase/.temp/project-ref` is tracked.

Re-check with:

```bash
cd /Users/masa/projects/AMD/amd-os
git status -sb --untracked-files=all
git log -3 --oneline
git worktree list
curl -fsS https://amd-os-pwa.vercel.app/api/build-info
```

## Verification Run

- `npm run test:critical-ui`
- `npx tsc --noEmit`
- `npm run build`
- Local dev server route smoke:
  - `/admin/japanese-culture-map` redirected to `/auth/login?next=%2Fadmin%2Fjapanese-culture-map`.
  - `/japanese-culture-map` redirected to `/auth/login?next=%2Fjapanese-culture-map` before child redirect because auth gate runs first.
- `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh`
- Production build-info confirmed `v0.39.18` / `1327db6b4c2709bf261910868eead7168667a68e` / `dirty=false`.
- Production route headers confirmed `/admin/japanese-culture-map` is auth-gated.

## Design Records

| Change | Spec/design | Manual |
|---|---|---|
| `日本文化マップ` の実 route を `/admin/japanese-culture-map` に移動 | `pwa/spec/2-1-pwa-runtime-routes.md`, `pwa/spec/2-2-pwa-surface-inventory-current-spec.md`, `pwa/design/FEATURE_REGISTRY.md`, `pwa/design/SPEC_pwa.md` | `pwa/manual/2-6-admin-ops.md` |
| 旧 `/japanese-culture-map` を互換 redirect として維持 | `pwa/spec/2-1-pwa-runtime-routes.md` | changelogs |
| nav / sidebar / title を admin 扱いへ同期 | `pwa/design/os_manual.md`, `pwa/design/FEATURE_REGISTRY.md` | `pwa/manual/2-6-admin-ops.md` |
| Build version `v0.39.18` と changelog | `pwa/spec/6-1-appendix-changelog.md` | `pwa/manual/9-3-appendix-changelog.md` |

## Open Next Task

- Japanese culture map lane: no known open implementation task.
- Optional smoke if needed: login-capable browserで `/admin/japanese-culture-map` を開き、admin sidebar / map rendering / old-route authenticated redirect を目視する。
- Carry-forward unrelated lane: `/admin/ms-overview` の `実支払へ合わせる` admin UI は前回から未実装。実支払証跡・member別差額・freee transaction IDs・reserve 承認を同じ flow で扱う必要がある。

## Closeout Decision

This lane is `archive ok` after the final handoff docs commit/push if:

- `git status -sb --untracked-files=all` is clean,
- `main` and `origin/main` are aligned,
- production `/api/build-info` points to latest `origin/main`,
- worktree registry and local branch list still contain only the canonical `main`.
