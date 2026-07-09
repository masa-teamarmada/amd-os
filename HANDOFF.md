# AMD OS Handoff

Last updated: 2026-07-09 JST
Target: `/Users/masa/projects/AMD/amd-os`
Topic: Admin finance cockpit flows / v0.39.22

## Summary

- ZMP OkuDoor の未払残表示を修正した。`未払残` は支払通知対象の外部メンバーへ将来払う残高だけを指し、役員の未充当繰越は会社留保側の内部検算へ寄せる。
- 本番DBの現行キャッシュでは、202609 の旧 `carryOverYen=1,082,900` は `externalUnpaid=333,200` / `reservePending=749,700` に分かれる。
- `/admin/billing` は互換 redirect にし、請求書発行の主入口を `/admin/invoices` へ移した。
- `/admin/ms-overview` 保存時の `milestone_change_events` と、PJ cockpit の折りたたみ `MS変更履歴` を追加した。
- Build version は `v0.39.22`。

## Repo State

- Canonical repo: `/Users/masa/projects/AMD/amd-os`
- Branch: `main`
- Branch rule: normal AMD OS work is main-direct; do not create a branch because of dirty state.
- Current bundle commit before deploy: `922ab43d` may change if this handoff is amended into it.
- Registered worktree: `/Users/masa/projects/AMD/amd-os [main]` only.

## Verification

- `git diff --check`
- `npm run test:critical-ui`
- `./node_modules/typescript/bin/tsc --noEmit --pretty false`
- `npm run build`

Build passed with the existing Next.js middleware deprecation warning only.

## Deploy Flow

Use the canonical flow:

```bash
cd /Users/masa/projects/AMD/amd-os
AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh
```

The deploy script checks clean tracked state, runs critical UI guard, runs deploy rollback guard, pushes `origin main`, and polls `https://amd-os-pwa.vercel.app/api/build-info`.

## Next Check

```bash
cd /Users/masa/projects/AMD/amd-os
git status -sb --untracked-files=all
git log --oneline --decorate -5
curl -fsS https://amd-os-pwa.vercel.app/api/build-info
```

## Pointers

- PJ cockpit spec: `pwa/spec/3-8-cockpit-current-spec.md`
- PJ cockpit manual: `pwa/manual/2-3-pj-cockpit.md`
- Admin payouts manual: `pwa/manual/6-5-admin-payouts-reward-notice-spec.md`
- Admin MS overview manual: `pwa/manual/6-8-admin-ms-overview-spec.md`
- Reward calc manual: `pwa/manual/7-1-reward-calc-spec.md`
- Feature registry: `pwa/design/FEATURE_REGISTRY.md`
