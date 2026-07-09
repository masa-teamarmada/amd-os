# AMD OS Handoff

Last updated: 2026-07-09 JST
Target: `/Users/masa/projects/AMD/amd-os`
Topic: Cockpit old proactive queue removal + ZMP paid-actual alignment closeout

## Summary

This closeout covered two active July 9 lanes:

- PJ / institution cockpit no longer shows the retired `ProactiveQueuePanel` / `proactive_outbox` TODO panel. The cockpit right column is now documents, strategy highlights, governance, grants, and meeting summaries. Product commit: `49c55af0`.
- Production build-info now returns `v0.39.15` / `49c55af0fac1f2e2a7e9955bd5ae519d45b5d843` / `dirty=false`.
- ZMP (`p19`) paid months 202601-202605 were rechecked in production Supabase. All have 4 member payout rows, `reward_paid_at`, and `reward_paid_by` beginning with `freee_wallet_txn_verified:`. `unverified=[]`.
- Existing ZMP handoff/BUGS/design_log notes were preserved and folded into this closeout instead of being reverted.
- A stale detached temp worktree at `fa121987` was clean, archived under `/Users/masa/.codex/cleanup_archives/amd-os-worktree-fa121987-20260709-134537`, then removed from the git worktree registry.

## Repo State

- Canonical repo: `/Users/masa/projects/AMD/amd-os`
- Branch: `main`
- Local / origin alignment before this docs-only handoff commit: ahead 0, behind 0 after `49c55af0` push.
- Local branches: `main` only.
- Registered worktrees: `/Users/masa/projects/AMD/amd-os [main]` only.
- Ignored local artifacts remain as normal local tooling: `.vercel/project.json`, `ios/supabase/.temp/*`, `pwa/.next`, `pwa/node_modules`.

Re-check the final docs-only closeout commit with:

```bash
cd /Users/masa/projects/AMD/amd-os
git log -3 --oneline
git status -sb --untracked-files=all
curl -fsS https://amd-os-pwa.vercel.app/api/build-info
```

## Verification Run

- `npm run test:critical-ui`
- `npx tsc --noEmit --pretty false`
- `npm run build`
- `npm run test:deploy-version-guard`
- `git diff --check`
- Browser check via local `http://localhost:3100`:
  - `/project/p25/cockpit` redirected to login; desktop 1280px and mobile 390px login screens had no horizontal overflow.
  - `/mock/dashboard-cyber-hud-wall` rendered without horizontal overflow.
- Production build-info confirmed `49c55af0` and `dirty=false`.
- Production Supabase ZMP read-back confirmed 202601-202605 payout totals and `unverified=[]`.

## Design Records

| Change | Spec/design | Manual |
|---|---|---|
| Remove old cockpit `ProactiveQueuePanel` / `proactive_outbox` display | `pwa/spec/3-8-cockpit-current-spec.md`, `pwa/spec/2-4-proactive-todo-current-spec.md`, `pwa/spec/5-3-automation-responsibility-current-spec.md`, `pwa/design/FEATURE_REGISTRY.md`, `pwa/design/SPEC_pwa.md`, `pwa/design/cockpit.md` | `pwa/manual/2-3-pj-cockpit.md`, `pwa/manual/8-3-l2-extraction-routines-spec.md`, changelogs |
| ZMP paid actual alignment and missing reserve approval UI | `pwa/BUGS.md`, `pwa/design_log/sessions_2026-07.md` | Existing rule remains in `pwa/manual/6-8-admin-ms-overview-spec.md`; next UI implementation must update it |

## Open Next Task

Implement the `/admin/ms-overview` paid-actual alignment UI:

1. Detect protected paid months where saved actual details or `freee_wallet_txn_verified:*` evidence are missing/mismatched.
2. Show `実支払へ合わせる` with member rows, computed amount, actual freee transfer amount, delta, transaction IDs, and budget impact.
3. If actual alignment exceeds `(client payment - buffer) * 65%`, ask whether to allow internal/company reserve drawdown.
4. On approval only, update `monthly_reward_payout`, `billing_cycles.reward_paid_at`, `billing_cycles.reward_paid_by`, and append `billing_log`.
5. Sync `pwa/manual/6-8-admin-ms-overview-spec.md`, `pwa/spec/3-14-monthly-work-agreement-current-spec.md`, `pwa/design/FEATURE_REGISTRY.md`, changelogs, and tests.

## Closeout Decision

After the final docs-only handoff commit/push, this session should be `archive ok` if `git status -sb --untracked-files=all` is clean and production build-info still points at the latest `origin/main`.
