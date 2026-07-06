# AMD OS Handoff

Last updated: 2026-07-06 JST
Target: `/Users/masa/projects/AMD/amd-os`
Topic: 月初合意 / MS編集の支払実績を freee 出金照合ベースへ修正

## Summary

See `pwa/design_log/sessions_2026-07.md` section "2026-07-03 — 月初合意 / MS編集 支払実績の freee 照合化" for details.

- まさの指摘どおり、計算キャッシュだけでは実際の振込額と同一と断定できないため、過去支払実績の判定を freee `wallet_txns` 照合ベースに変更した。
- `monthly_reward_payout.total_pay` は税抜の保存済み明細。`round(total_pay * 1.1)` が freee `wallet_txns.amount` と一致し、`reward_paid_by='freee_wallet_txn_verified:<ids>'` がある月だけ `支払実績`。
- `reward_paid_at` だけある月、または銀行出金はあるがPJ別明細額と一致しない月は `要照合` / `実績未照合`。実績にも未来予定にも混ぜない。
- ZMP p19 / ID026 では 202604 と 202605 だけが照合済み実績。202601〜202603 は `要照合`、202606 は証跡未確認のため `保存済み`。
- `/monthly-agreement` は `支払済み実績(税込)` / `実績未照合(税込)` / `これから支払予定(税込)` を分離し、明細は税抜/税込を併記。
- `/admin/ms-overview` の保存前支払検算は、照合済み実績だけを固定支払にし、未照合月がある場合は保存 `blocked`。

## Repo State / Closeout Warning

- Clean handoff worktree used here: `/Users/masa/.codex/worktrees/amd-os-ms-liability-deploy`
- Current clean base before this handoff commit was rebased: `origin/main` at `34973b68` (`docs(handoff): record contract cap closeout`).
- Handoff/doc files changed in this closeout: `HANDOFF.md`, `SESSION_MIGRATION_PROMPT.md`, `pwa/design_log/sessions_2026-07.md`, `pwa/BUGS.md`.
- Canonical local checkout `/Users/masa/projects/AMD/amd-os` is not clean/current: observed `main...origin/main [ahead 7, behind 79]` with many unrelated modified/untracked files. Do not merge, reset, or trust it as current truth without separate cleanup.
- Immediately before this handoff, `origin/main` also recorded the monthly_fixed contract cap closeout. Its durable detail remains in `pwa/design_log/sessions_2026-07.md`, `pwa/BUGS.md`, and the related spec/manual files.

Use `origin/main`, production `/api/build-info`, or a clean worktree for finance work.

## Verification Already Run For The Implementation

```bash
npx tsc --noEmit --pretty false
npm run test:critical-ui
git diff --check
npm run build
AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh
```

Observed during implementation closeout:
- Production deployment completed at `v0.38.3 / 7a7b0ddc70439cc977c80fc6593f467eba0e89d9`.
- Later sessions advanced production to `v0.39.5`; this handoff is rebased on latest `origin/main` and does not change product behavior.
- `npm run lint` was attempted and failed on pre-existing unrelated lint errors.
- Production UI for `/monthly-agreement?ym=202607&memberId=ID026` showed:
  - `支払済み実績(税込) ¥68,855`
  - `実績未照合(税込) ¥96,525`
  - `これから支払予定(税込) ¥223,726`
  - row badges `支払実績` / `要照合` / `保存済み`.

## Design Records

- Monthly agreement spec: `pwa/spec/3-14-monthly-work-agreement-current-spec.md`
- Admin MS Overview manual/spec: `pwa/manual/6-8-admin-ms-overview-spec.md`
- Reward calc manual: `pwa/manual/7-1-reward-calc-spec.md`
- Change history: `pwa/spec/6-1-appendix-changelog.md`, `pwa/manual/9-3-appendix-changelog.md`
- Bug/lesson: `pwa/BUGS.md`
- Session log: `pwa/design_log/sessions_2026-07.md`

## Open Risks / Next Checks

1. Product behavior for verified actuals is done and deployed.
2. ZMP p19 202601〜202603 remain `要照合`. Do not mark them actual unless freee出金とPJ別明細の税込額が1円単位で一致する根拠が見つかる.
3. Canonical local checkout `/Users/masa/projects/AMD/amd-os` has unrelated dirty/diverged state. Treat cleanup as a separate owner task; do not fold it into this handoff.
4. Existing unrelated lint errors remain outside this bundle.

## First Next Action

```bash
cd /Users/masa/projects/AMD/amd-os
git fetch origin main --prune
git status -sb --untracked-files=all
git rev-list --left-right --count origin/main...HEAD
curl -s https://amd-os-pwa.vercel.app/api/build-info
```

Then read this `HANDOFF.md`, `pwa/spec/3-14-monthly-work-agreement-current-spec.md`, `pwa/manual/6-8-admin-ms-overview-spec.md`, `pwa/manual/7-1-reward-calc-spec.md`, `pwa/BUGS.md`, `AGENTS.md`, `CLAUDE.md`, and `pwa/CLAUDE.md`.

If continuing the `要照合` cleanup, start from freee `wallet_txns` and saved `monthly_reward_payout`, not from recalculated reward cache alone.

## Archive Decision

Handoff for the MS/payment-actuals correction is archive-ready after the handoff commit is pushed. The canonical root checkout remains `do not archive` until its unrelated dirty/diverged state is separately reconciled.
