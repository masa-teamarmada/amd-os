# AMD OS Handoff

Last updated: 2026-07-03 JST
Target: `/Users/masa/projects/AMD/amd-os`
Topic: 月初合意の入口モーダルを必須確認に戻す + closeout

## Latest Session Summary

See `pwa/design_log/sessions_2026-07.md` section "2026-07-03 — 月初合意入口モーダル closeout".

- 月初合意が未完了または条件更新ありのとき、OS内の他画面は背景に残し、月初合意モーダルを前面に出す。
- 最新 main では一度、背景クリックでモーダルを一時的に閉じられる状態が残っていたため、合意保存後だけ閉じる実装へ修正した。
- admin メンバーもテスト確認のため月初合意対象に含める current truth は維持。
- 2026年6月以前の稼働月は、契約改定前かつシステム未完成期間のため、支払 gate 上は移行月として合意済み扱いのまま維持。
- `MonthlyAgreementGateOverlay` は `/monthly-agreement` と同じ内容を modal 表示し、背景クリック・閉じるボタン・Esc で先送りする UI は置かない。
- 本 closeout では DB write / 合意保存 / 本番データ変更は行っていない。

## Repo State

- canonical branch: `main` / `origin/main`
- accepted production before this closeout: `v0.38.10` / `4f0a8001`
- this closeout bumps PWA build to `v0.38.11`
- clean working clone used for accepted work: `/tmp/amd-os-monthly-agreement-modal-ZYKPJe`
- canonical local root `/Users/masa/projects/AMD/amd-os` is dirty and behind/ahead with unrelated worker work; do not clean, reset, or mix it into this bundle without a separate reconciliation pass.

## Verification Run

Run from `/tmp/amd-os-monthly-agreement-modal-ZYKPJe/pwa`:

```bash
npm run test:critical-ui
npm run build
```

Observed:
- `test:critical-ui` passed after updating the guard so backdrop dismissal fails the check.
- `npm run build` passed.
- Browser/authenticated visual check for an actual member gate was not run in this closeout because the screen is login/account-state gated. Substitute verification: code path, critical UI guard, production build.

## Design Records

- Current spec: `pwa/spec/3-14-monthly-work-agreement-current-spec.md`
- Member manual: `pwa/manual/2-2-member-workflows-quick-start.md`
- Developer/admin manual: `pwa/manual/6-6-member-billing-prompts-spec.md`, `pwa/manual/6-5-admin-payouts-reward-notice-spec.md`
- Reward boundary: `pwa/manual/7-1-reward-calc-spec.md`
- Changelogs: `pwa/spec/6-1-appendix-changelog.md`, `pwa/manual/9-3-appendix-changelog.md`
- Bug/lesson: `pwa/BUGS.md` entry `[monthly-agreement] 必須モーダルを背景クリックで先送りできた`
- Session log: `pwa/design_log/sessions_2026-07.md`

## Unresolved Tasks

1. Authenticated visual proof: if まさ wants screen proof from his account, open production as admin with a pending/updated monthly agreement and confirm the modal appears over the requested page and cannot be dismissed by background click.
2. Root dirty tree cleanup: `/Users/masa/projects/AMD/amd-os` has unrelated tracked/untracked work and local commits. Assign a separate cleanup/reconciliation owner; do not archive or prune that root checkout from this thread.

## First Next Action

1. Read this `HANDOFF.md`.
2. Then read `pwa/spec/3-14-monthly-work-agreement-current-spec.md`.
3. Then read `pwa/BUGS.md`.
4. If changing the月初合意 entry gate, run:

```bash
cd /Users/masa/projects/AMD/amd-os/pwa
npm run test:critical-ui
npm run build
```

5. For production release, use:

```bash
AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh
```

## Archive Decision

The monthly-agreement modal fix is handoff-ready after commit/push/deploy verification. The root dirty checkout is not archive-ready and needs a separate owner/action.
