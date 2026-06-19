# HANDOFF - AMD OS

- Last updated: 2026-06-19 (SX / admin payouts reward cap)
- Canonical root: `/Users/masa/projects/AMD/amd-os`
- Clean current-truth checkout used for this session: `/Users/masa/.codex/tmp/amd-os-sx-reserve-deploy`
- Production URL: `https://amd-os-pwa.vercel.app`
- Functional production proof: `v0.28.3` / `ef84244e97b597235a77f90dc0789766259363eb` / `dirty=false`
- Default branch alignment: `main aligned` at functional closeout (`origin/main` contained `ef84244`; later handoff-only commits may advance the SHA without changing `BUILD_VERSION`)

## Latest Session Summary

Details are appended in `pwa/design_log/sessions_2026-06.md` under `2026-06-19 — SX reward cap / reserve buffer / officer reserve equal allocation`.

- `/admin/payouts` の SX(p21) PJ別収支 / 予算チェックを調査し、契約前稼働・契約バッファ・役員会社留保・非役員支払の関係を整理した。
- 契約バッファは `companyReserveBufferYen=800000` / `companyReserveBufferMonthlyYen=200000` / `companyReserveBufferStartYm=202606` とし、202606〜202609 に20万円ずつ消化する共通ロジックへ変更済み。
- 役員留保は非役員支払より先取りしない。`members.is_officer=true` も通常の月次cap按分に入れ、割当分だけ `companyReserveYen/officerReserveYen` に振り替え、支払通知書 `totalPay` は0のまま除外する。
- SX `billing_cycles.reward_summary_json` は本番DBで再計算済み。202606 は `buffer=200000`, `budget=481200`, `totalPaySum=274169`, `companyReserveYen=207031`。
- 202606 メンバー別: まさ留保 `207031`, かる支払 `136460`, ちこ支払 `137709`。
- 本番 deploy 済み。`/api/build-info` で `v0.28.3` / `ef84244...` / `dirty=false` を確認済み。

## Repo State

- Current clean checkout: `/Users/masa/.codex/tmp/amd-os-sx-reserve-deploy`
- Branch: `main`
- Functional HEAD before this handoff update: `ef84244 Treat officer reserve as equal cap allocation`
- Upstream: `origin/main`
- Dirty state in clean checkout: none, except ignored local artifacts `pwa/.next` and `pwa/node_modules`; `ios/supabase/.temp/project-ref` is present and should be treated as local Supabase link state.
- Canonical local checkout `/Users/masa/projects/AMD/amd-os` is not clean and is stale (`c0a7e5dc`, ahead 1 / behind 7 at closeout inventory). It contains many unrelated dirty files and should not be used for implementation until a separate owner resolves or carries them forward.

## Verification Observed

Commands run from `/Users/masa/.codex/tmp/amd-os-sx-reserve-deploy/pwa`:

```sh
npx tsc --noEmit --pretty false
npx eslint src/lib/reward-summary.ts src/lib/build-info.ts src/components/admin/AdminPayoutsClient.tsx src/app/api/admin/payouts/route.ts
npm run build
npm run test:critical-ui && npm run test:deploy-version-guard
bash pwa/scripts/deploy.sh --dry-run
AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh
```

Notes:

- focused eslint had 0 errors and 2 pre-existing warnings in `AdminPayoutsClient.tsx` (`fmtDeltaYen`, `budgetAuditBadge` unused).
- SX reward summaries were recomputed with `scripts/backfill_reward_summaries.ts --project=p21` after production switched to `v0.28.3`.

## Unresolved Tasks

- None for the SX payout/reserve logic delivered in this session.
- Operational follow-up: classify and resolve the unrelated dirty state in `/Users/masa/projects/AMD/amd-os` before treating that local checkout as a safe work root.
- Optional cleanup: decide whether the temporary clean checkout `/Users/masa/.codex/tmp/amd-os-sx-reserve-deploy` should be removed after another clean clone/fresh checkout is available.

## First Next Action

```sh
cd /Users/masa/projects/AMD/amd-os
bash /Users/masa/.codex/skills/closeout/scripts/closeout_inventory.sh /Users/masa/projects/AMD/amd-os
```

If continuing payout work immediately, prefer a fresh clean checkout based on `origin/main` or use `/Users/masa/.codex/tmp/amd-os-sx-reserve-deploy` after confirming `git status -sb` is clean and `git rev-parse HEAD == git rev-parse origin/main`.

## First Read Next Session

1. `HANDOFF.md`
2. `pwa/spec/5-6-contracts-management-current-spec.md`
3. `pwa/manual/7-1-reward-calc-spec.md`
4. `pwa/manual/6-5-admin-payouts-reward-notice-spec.md`
5. `pwa/BUGS.md`
6. `pwa/design_log/sessions_2026-06.md`
7. `AGENTS.md`
8. `CLAUDE.md`
9. `pwa/AGENTS.md`
10. `pwa/CLAUDE.md`
