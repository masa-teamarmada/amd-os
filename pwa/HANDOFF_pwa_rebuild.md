# HANDOFF - AMD OS PWA

- Last updated: 2026-06-24 (admin payouts / monthly agreement gate closeout)
- Canonical root: `/Users/masa/projects/AMD/amd-os`
- PWA root: `/Users/masa/projects/AMD/amd-os/pwa`
- Production URL: `https://amd-os-pwa.vercel.app`
- Current branch: `main`

## 直近セッション要約

詳細は [`design_log/sessions_2026-06.md`](design_log/sessions_2026-06.md) の月初合意支払 gate セクション、仕様正本 [`spec/3-14-monthly-work-agreement-current-spec.md`](spec/3-14-monthly-work-agreement-current-spec.md)、マニュアル [`manual/6-5-admin-payouts-reward-notice-spec.md`](manual/6-5-admin-payouts-reward-notice-spec.md)、教訓 [`BUGS.md`](BUGS.md)。

- 2026/05以前の稼働月 (`source_ym <= 202605`) は月初合意の導入前/移行月として支払 gate 上 allow。
- 移行月 allow は実DBの合意 row を偽造しない。server response row に `migrationBypass=true` を持たせる。
- 移行月バイパス行だけで blocker が無い場合、`/admin/payouts` の gate panel は個別メンバー表を出さず、`対象支払行` / `移行月スキップ` / `blocker 0` の summary を表示する。
- `/admin/payouts` 初期表示は SSR data + gate 後追い取得に整理済み。保存・PDF・送付など write action は server-side gate を必ず通す。
- Production `v0.34.19` / `35b618ff` で `/admin/payouts?ym=202606` の summary 表示を logged-in browser で確認済み。

## Repo State

- Product baseline on `main`: `3677cd33 fix(governance): hide unreviewed meeting action candidates`, followed by docs-only handoff commit(s).
- Production at closeout: `v0.34.22` / `b24718ff675e4b1beb21e96195f21110e64bcc43` / `dirty=false`
- Production is aligned with product code through `3677cd33`. Build-info may show a later docs-only handoff commit because it does not change the product baseline.
- Dirty tracked after handoff commit: none expected.
- Untracked: `../gas-slack/.clasp.json` (owner undecided; do not commit).

## Verification Run For Payout Gate

```bash
npx tsx -e "...buildPayoutAgreementGateSummary(...)"
git diff --check
npx tsc --noEmit
npx eslint src/lib/monthly-work-agreement-payout-gate.ts src/components/admin/AdminPayoutsClient.tsx
npm run build
npm run test:critical-ui
```

- ESLint: existing `react-hooks/exhaustive-deps` warning in `AdminPayoutsClient.tsx`, error 0.
- Browser: logged-in production `/admin/payouts?ym=202606` showed `対象支払行 4 / 移行月スキップ 4 / blocker 0`, no individual member table.

## Unresolved / Next Actions

1. **Governance/action-items production smoke**
   - Build-info shows `3677cd33` in production. If this area matters next, verify confirmed-only governance display: `review_status='confirmed'`, `status in ('open','in_progress')`, and no `source='meeting_summary'` candidates.
2. **Admin payouts regression smoke**
   - Monthly agreement migration summary was verified on production `v0.34.19`. Since production is now `v0.34.22`, quick smoke `/admin/payouts?ym=202606` before further payout edits.
3. **`gas-slack/.clasp.json`**
   - Treat as local clasp/link artifact until GAS/Slack owner decides.
4. **Older carried tasks**
   - `/admin/ms-overview` logged-in visual check remains useful before touching MS editor again.
   - `value_milestones` estimate-line pollution cleanup remains separate.

## First Next Action

```bash
cd /Users/masa/projects/AMD/amd-os
git fetch origin main
git status -sb --untracked-files=all
git log --left-right --oneline main...origin/main
curl -fsS https://amd-os-pwa.vercel.app/api/build-info
```

Expected: local `main` and `origin/main` align, no tracked dirty files, production product code is `v0.34.22` with product baseline through `3677cd33`, and only `../gas-slack/.clasp.json` remains untracked.

## Pointers

- Monthly agreement spec: [`spec/3-14-monthly-work-agreement-current-spec.md`](spec/3-14-monthly-work-agreement-current-spec.md)
- Admin payouts manual: [`manual/6-5-admin-payouts-reward-notice-spec.md`](manual/6-5-admin-payouts-reward-notice-spec.md)
- Registry: [`design/FEATURE_REGISTRY.md`](design/FEATURE_REGISTRY.md)
- Bugs: [`BUGS.md`](BUGS.md)
- Session log: [`design_log/sessions_2026-06.md`](design_log/sessions_2026-06.md)
- Governance docs: [`design/governance_action_items.md`](design/governance_action_items.md), [`manual/2-3-pj-cockpit.md`](manual/2-3-pj-cockpit.md)

## Guardrails

- Migration-only monthly agreement gate stays summary-style; do not show the four ZMP rows as individual `合意済` rows.
- Do not create fake agreement rows for migration months.
- Do not let candidate action items leak into governance/cockpit confirmed surfaces.
- Do not use `git add .`.
