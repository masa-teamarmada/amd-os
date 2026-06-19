# HANDOFF - AMD OS

- Last updated: 2026-06-19 (monthly agreement / payout gate / finance table closeout)
- Canonical root: `/Users/masa/projects/AMD/amd-os`
- Production URL: `https://amd-os-pwa.vercel.app`
- Default branch: `main`
- Next thread prepared: `019eddf4-8877-7f50-8180-e53e5ee1c118` (`AMD OS finance table follow-up`)

## Latest Session Summary

- 月初合意は「見える化」から `/admin/payouts` の支払 gate へ進める仕様にした。未合意 / 条件更新あり / 修正要望中は server-side で支払データ保存・PDF生成・送付・送付済み確定を止め、admin override は理由・actor・対象 member/PJ/月を監査ログへ残す。
- CTB p06 は 202605 から freeze overlay なので、202606 月初合意・支払 gate では `not_required`。`projects.status='active'` だけで判定しない。
- りり / ID006 (NIMS 無償出向) と あき / ID029 (無報酬稼働) は `members.exclude_from_payout_notice=true` の対象として、月初合意・支払通知書・支払 gate から外す仕様にした。
- SX は 202604/202605 の契約前稼働があるため、202606 以降に `carryInYen` / `stockYen` として未払い残が出るのは異常ではない。本人画面と admin 合意一覧では、`今月支払` と `今月末未払い残（今月は支払われない）` を分けて表示する。
- `/admin/payouts` に報酬債務台帳を置き、`前月残 + 今月発生 - 今月支払 = 月末未払い残` を member × PJ × 稼働月で読む仕様にした。
- `/admin/payouts` と `/management-score` 下部の先12か月表は、`キャッシュ支払` / `会社留保` / `報酬債務` / `cap超過チェック` の4表へ分解済み。会社留保は支出ではなく `cap/売上枠 - 外部支払` として読む。
- 詳細ログ: `pwa/design_log/sessions_2026-06.md` の `2026-06-19 — /admin/payouts 先12か月表を目的別4表へ分解`。

## Repo / Deploy State

- Accepted product commit: `038d0e62 Split forward finance tables by purpose`。
- Production check after deploy: `BUILD_VERSION=v0.28.13`, `git_sha=038d0e62e048e07c7154872a527289f59b6e739d`, `dirty=false`。
- Current `main` also contains later docs / H-1 closeout commits (`e32d2bd2`, `010c0403`) after the finance deploy. Re-check `/api/build-info` before assuming production moved past `038d0e62`.
- This handoff commit is docs-only. It should not change the accepted finance UI behavior.

## Verification Already Run

- `npx tsc --noEmit --pretty false`
- targeted eslint for `AdminPayoutsClient.tsx`, `management-score/page.tsx`, `/api/admin/payouts/route.ts`, `reward-summary.ts`, `build-info.ts`, `check_pwa_critical_ui.cjs`
- `npm run test:critical-ui`
- `npm run build`
- `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh`
- production `/api/build-info` confirmed `v0.28.13` / `038d0e62...` / `dirty=false`
- Browser smoke for admin pages was limited by login redirect; next session should verify logged-in UI with まさ's session or Chrome state.

## Unresolved Tasks

1. Verify and, if needed, implement the actual DB/code path for あき / ID029 exclusion:
   - `members.exclude_from_payout_notice=true`
   - `/mypage` / `/dashboard` no-compensation display includes ID029, not only ID006
   - `/monthly-agreement`, `/admin/monthly-work-agreements`, `/admin/payouts`, cron prebuild all treat ID029 as `not_required`
2. Logged-in smoke:
   - `/admin/payouts?ym=202606`
   - `/management-score`
   - `/monthly-agreement?ym=202606`
   - `/admin/monthly-work-agreements?ym=202606`
3. Continue UX refinement of the 4 finance tables. If まさ still feels "設計がいけてない", keep one table = one purpose. Do not merge company reserve, cash out, reward debt, and cap risk back into one table.
4. Contract revision/legal rollout is still a parallel workstream. Hard guard operation must assume contract amendment, member consent, and legal review; do not present this as legal advice.

## Read First Next Session

1. `HANDOFF.md`
2. `pwa/spec/3-14-monthly-work-agreement-current-spec.md`
3. `pwa/manual/6-5-admin-payouts-reward-notice-spec.md`
4. `pwa/manual/7-1-reward-calc-spec.md`
5. `pwa/manual/4-5-management-score-and-finance-simulation-spec.md`
6. `pwa/manual/2-2-member-workflows-quick-start.md`
7. `pwa/manual/6-6-member-billing-prompts-spec.md`
8. `pwa/BUGS.md`
9. `pwa/design_log/sessions_2026-06.md`

## First Next Action

```sh
cd /Users/masa/projects/AMD/amd-os
git fetch origin main
git status -sb
git log --left-right --oneline main...origin/main
curl -fsS https://amd-os-pwa.vercel.app/api/build-info
```

Expected: local `main` is aligned with `origin/main`; production is `v0.28.13` / `038d0e62...` / `dirty=false` or newer. If production is older/newer, inspect before making finance changes.

## Guardrails

- Do not revert unrelated dirty files or other sessions' docs.
- Do not use `git add .`.
- For PWA production deploys, use `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh` from repo root.
- 月初合意 gate は報酬計算式に混ぜない。支払 action の直前に read gate として置く。
- `stockYen` は月末未払い残高。支払予定でもPL原価でもない。
