# HANDOFF - AMD OS

- Last updated: 2026-06-24 (admin payouts / monthly agreement gate closeout)
- Canonical root: `/Users/masa/projects/AMD/amd-os`
- PWA root: `/Users/masa/projects/AMD/amd-os/pwa`
- Production URL: `https://amd-os-pwa.vercel.app`
- Default branch: `main`

## Latest Session Summary

- `/admin/payouts` の月初合意支払 gate を調整した。2026/05以前の稼働月 (`source_ym <= 202605`) は月初合意機能の導入前/移行月として支払可能にする。
- 移行月バイパス行は DB に偽の合意 row を作らず、server-side gate 上で `agreed` / `migrationBypass=true` として扱う。
- UI は移行月バイパスだけの場合、個別メンバー表を出さず `対象支払行 4 / 移行月スキップ 4 / blocker 0` の summary にする。4人だけが合意済みに見える誤読を避けるため。
- `/admin/payouts` 初期表示は SSR で支払データ本体を返し、月初合意 gate は必要に応じて `gateOnly=1` で後追い取得する。write action は server-side gate を必ず通す。
- 関連仕様は `pwa/spec/3-14-monthly-work-agreement-current-spec.md`、`pwa/manual/6-5-admin-payouts-reward-notice-spec.md`、`pwa/design/FEATURE_REGISTRY.md`、`pwa/BUGS.md`、`pwa/design_log/sessions_2026-06.md` に同期済み。

## Repo / Deploy State

- Local branch: `main`
- Local / `origin/main` HEAD at handoff inventory: `3677cd33 fix(governance): hide unreviewed meeting action candidates`
- Monthly agreement gate accepted production: `35b618ff Fix migration payout gate summary display`
- Production `/api/build-info` at handoff inventory: `v0.34.19` / `35b618ff882a82277ca6e133d753515ac0d318e3` / `dirty=false`
- `origin/main` is ahead of production by `1532f914` (`v0.34.21`, BZM nav pointer) and `3677cd33` (`v0.34.22`, governance confirmed-only action items). Treat production alignment as not fully caught up until `/api/build-info` shows `3677cd33` or later.
- No unpushed commits before this handoff update.
- The governance/action-items bundle that was dirty during inventory is now committed on `main` as `3677cd33`; it still needs production catch-up/verification if the UI change must be visible now.

## Dirty State To Own

| path | status | class | owner guess | resolution action | risk |
|---|---:|---|---|---|---|
| `HANDOFF.md` | `M` | this closeout | current session | stage named file and commit handoff bundle | low |
| `SESSION_MIGRATION_PROMPT.md` | `M` | this closeout | current session | stage named file and commit handoff bundle | low |
| `pwa/HANDOFF_pwa_rebuild.md` | `M` | this closeout | current session | stage named file and commit handoff bundle | low |
| `gas-slack/.clasp.json` | `??` | unknown / local tooling | GAS/Slack owner or quarantine | decide track vs local exclude vs safe remove; do not print contents | low-medium: accidental secret/local link commit risk |

Dirty buckets:
- safe to commit now: three handoff docs above
- needs Masa/GAS owner decision: `gas-slack/.clasp.json` owner/handling
- expected after this handoff commit: no tracked dirty files; `gas-slack/.clasp.json` remains untracked

## Verification Already Run For Monthly Agreement / Payout Work

- `npx tsx -e ...buildPayoutAgreementGateSummary(...)`: `source_ym=202605` row returns `status=agreed`, `migrationBypass=true`, `blockers=0`.
- `git diff --check`
- `npx tsc --noEmit`
- `npx eslint src/lib/monthly-work-agreement-payout-gate.ts src/components/admin/AdminPayoutsClient.tsx` (existing `react-hooks/exhaustive-deps` warning 1, error 0)
- `npm run build`
- `npm run test:critical-ui`
- Logged-in browser check: `/admin/payouts?ym=202606` on production `v0.34.19` shows `対象支払行 4 / 移行月スキップ 4 / blocker 0`, no individual member table.

## Unresolved Tasks

1. **Production catch-up for `3677cd33`**
   - `origin/main` contains BZM nav pointer fix (`1532f914`, `v0.34.21`) and governance confirmed-only action-item fix (`3677cd33`, `v0.34.22`), but production was last observed at `35b618ff` / `v0.34.19`.
   - Run the normal PWA deploy flow if production still lags after this handoff commit.
2. **Governance/action-items production verification**
   - After deploy, verify governance/cockpit surfaces show only `review_status='confirmed'` + `status in ('open','in_progress')` action items and exclude `source='meeting_summary'` candidates.
3. **Older carried items**
   - Logged-in visual check for `/admin/ms-overview` edit mode is still useful if that area is touched again.
   - `value_milestones` estimate-line pollution remains a separate cleanup task.
4. **`gas-slack/.clasp.json`**
   - Do not commit until GAS/Slack owner decides. Treat as local link/quarantine until then.

## Read First Next Session

1. `HANDOFF.md`
2. `pwa/spec/3-14-monthly-work-agreement-current-spec.md`
3. `pwa/manual/6-5-admin-payouts-reward-notice-spec.md`
4. `pwa/design/FEATURE_REGISTRY.md`
5. `pwa/BUGS.md`
6. `pwa/design_log/sessions_2026-06.md`
7. For governance production verification: `pwa/design/governance_action_items.md`, `pwa/manual/2-3-pj-cockpit.md`

## First Next Action

```sh
cd /Users/masa/projects/AMD/amd-os
git fetch origin main
git status -sb --untracked-files=all
git log --left-right --oneline main...origin/main
curl -fsS https://amd-os-pwa.vercel.app/api/build-info
```

Then check whether production has caught up to `3677cd33`; if not, deploy through the normal PWA flow.

## Guardrails

- Do not show candidate action items in PJ cockpit governance surfaces unless the confirmed-only WIP is intentionally completed.
- Do not re-expand migration-month monthly agreement rows into individual `合意済` member rows. Migration-only gate should stay summary-style.
- Do not create fake `member_monthly_work_agreements` rows for 2026/05 or earlier.
- Do not use `git add .`; stage named files only.
- For PWA production-bound changes, use `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh` after this handoff commit is clean.
