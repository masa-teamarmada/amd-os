# HANDOFF - AMD OS PWA

- Last updated: 2026-05-28 (codex handoff)
- Topic: 右下つくよみ visible mascot 非表示 + chat bridge 化 + production/current gap
- Canonical root: `/Users/masa/projects/AMD/amd-os`
- PWA root: `/Users/masa/projects/AMD/amd-os/pwa`
- Production URL: `https://amd-os-pwa.vercel.app`
- HEAD before handoff docs: `09a9c2a` (`Add invoice registration number to payouts`)
- Build version at HEAD: `v0.7.6`
- Last production version directly observed in this session: `v0.7.5`

## Latest Summary

- `pwa/src/app/(app)/layout.tsx` は visible `TsukuyomiMascot` を mount せず、invisible `TsukuyomiChatBridge` だけを render する状態。
- `TsukuyomiChatBridge` は `window.dispatchEvent(new CustomEvent("tsukuyomi:open", ...))` を受け、pending prefill を `localStorage` に保存して `TsukuyomiChatDrawer` を開く。右下 fixed button / 当たり判定は出さない。
- `pwa/design/SPEC_pwa.md` と `pwa/manual/8-1-knowledge-admin-tsukuyomi-spec.md` に、この visible mascot 非表示 + 明示導線維持を記録済み。
- Production dashboard を Chrome で確認し、`AMD OS v0.7.5` かつ右下 visible mascot なしを確認した。
- その後 current `main` は `v0.7.6` / `09a9c2a` へ進み、支払通知書宛先の `members.invoice_registration_number` 対応が入っている。`v0.7.6` production 反映と migration 107 remote apply は未確認。
- 詳細ログ: `pwa/design_log/sessions_2026-05.md` 末尾「2026-05-28 (codex)」。

## Verification / Deploy

Run and observed for the visible mascot removal:

- `npx tsc --noEmit` pass
- `npm run test:critical-ui` pass
- `npm run build` pass
- Vercel deployment `dpl_71ybU9TqXHbbsU8VJTvwNyk4J2ji` Ready
- Vercel URL: `https://amd-os-7vy0zxpdx-armada0130.vercel.app`
- Production alias: `https://amd-os-pwa.vercel.app`
- Chrome production dashboard: `AMD OS v0.7.5`, no bottom-right visible mascot

Observed deploy caveat:

- Vercel CLI / deploy script failed locally during upload or polling with network/DNS errors (`Client network socket disconnected before secure TLS`, `EADDRNOTAVAIL`, `ENOTFOUND api.vercel.com`), while `vercel inspect` later confirmed the deployment was Ready and aliased.

Not verified:

- Current HEAD `v0.7.6` production reflection
- Supabase migration `pwa/scripts/migrations/107_members_invoice_registration_number.sql` applied on remote

## Repo State

- Branch: `main`
- Remote tracking: `main...origin/main`
- Unpushed commits before handoff docs: none observed
- Worktree before handoff docs: clean
- Handoff docs changed in this flow:
  - `HANDOFF.md`
  - `pwa/HANDOFF_pwa_rebuild.md`
  - `pwa/design_log/sessions_2026-05.md`
  - `pwa/BUGS.md`

## Open Tasks

- [ ] Decide whether to deploy current `main` (`v0.7.6`) now that production was directly observed at `v0.7.5`.
- [ ] Before deploying `v0.7.6`, verify Supabase has `members.invoice_registration_number` / migration 107 applied.
- [ ] If deploying, run the normal PWA deploy path, then inspect the deployment URL directly if CLI polling fails.

## First Read Next Session

1. `HANDOFF.md`
2. `pwa/HANDOFF_pwa_rebuild.md`
3. `pwa/design/SPEC_pwa.md`
4. `pwa/manual/8-1-knowledge-admin-tsukuyomi-spec.md`
5. `pwa/manual/6-5-admin-payouts-reward-notice-spec.md`
6. `pwa/BUGS.md`
7. `pwa/design_log/sessions_2026-05.md`

## First Next Action

```sh
cd /Users/masa/projects/AMD/amd-os
git fetch --all --prune
git status -s
git log --branches --not --remotes --oneline
```

Then:

1. Check whether production is still `v0.7.5` or has advanced to `v0.7.6`.
2. Verify migration 107 on Supabase before sending any `v0.7.6` production deploy.
3. If Vercel CLI shows a network/polling failure, use `npx vercel inspect <deployment-url> --scope armada0130` before retrying.
