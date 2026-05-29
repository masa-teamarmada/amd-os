# HANDOFF - AMD OS PWA

- Last updated: 2026-05-29 (codex handoff)
- Topic: 入金確認nudge Slack action準備 + feature flag safety + GAS再認証待ち
- Canonical root: `/Users/masa/projects/AMD/amd-os`
- PWA root: `/Users/masa/projects/AMD/amd-os/pwa`
- Production URL: `https://amd-os-pwa.vercel.app`
- Current local branch at handoff: `feat/bzm-textbook`
- Clean PR branch: `codex/payment-confirm-slack-action`
- Draft PR: `https://github.com/masa-teamarmada/amd-os/pull/2`
- Clean feature commit: `dc7027a fix(payment): prepare Slack-native payment confirmation`

## Latest Summary

- 入金確認nudgeの「予定通り入金済み」を、ブラウザ遷移ではなくSlack内完結にする実装を準備した。
- PWA `POST /api/admin/payment-confirm` は `mode=expected` を受け、signed tokenの予定額で `billing_cycles.payment_confirmed_at` を更新してJSONを返す。
- PWA `cron/payment-confirm-nudges` は `PAYMENT_CONFIRM_SLACK_INTERACTIVE=1` の時だけ `payment_confirm_expected` Slack actionを出す。未設定時は既存のURL confirm buttonを維持する。
- GAS `slackInteractiveWorker` 側に `payment_confirm_expected` handlerを追加。PWA APIを呼んだ後、つくよみがSlackスレッドに結果を返信する。
- GAS deployは `clasp` の `invalid_grant / invalid_rapt` で未完了。PWA productionは安全弁offのまま再deploy済みなので、現時点では既存UXのまま壊れていない。
- Detailed session log: `pwa/design_log/sessions_2026-05.md` の「2026-05-29 (#96)」。

## Verification / Deploy

- Current checkout:
  - `npm run lint -- src/app/api/cron/payment-confirm-nudges/route.ts src/app/api/admin/payment-confirm/route.ts src/lib/build-info.ts` pass
  - `node --check gas/80_SlackWebhook.js && node --check gas/081_SlackInteractive.js` pass
  - `npm run build` pass
- Clean worktree `/tmp/amd-os-payment-confirm-action`:
  - `npm ci` 実行後、local env filesを検証用にコピーして同じlint / syntax check / build pass
- PWA production:
  - Unsafe first deploy: `dpl_EcWatpieftJpQJSBAGjzxFF5Zirh`
  - Final safe deploy: `dpl_9jcgL4SRYk97zq7PpsvwhTVSTBVB` / `https://amd-os-azsenw0p3-armada0130.vercel.app`
  - Production alias: `https://amd-os-pwa.vercel.app`
  - `PAYMENT_CONFIRM_SLACK_INTERACTIVE` is not present in Vercel env, so Slack action is not active yet.
- GAS:
  - `clasp push --force` and `clasp deployments` failed with `invalid_grant` / `invalid_rapt`.
  - Worker production deploy is pending Google reauthentication.

## Repo State

- Current local branch: `feat/bzm-textbook`
- Current local HEAD: this docs handoff commit (`docs: refresh payment confirm handoff`; run `git log -1 --oneline` for exact hash)
- Clean feature PR: #2 from `codex/payment-confirm-slack-action`, commit `dc7027a`.
- Local worktree has broad unrelated dirty files. Do not stage/revert broadly.
- Payment code is isolated in the clean PR; local handoff docs are updated so the next session starts from the current blocker, not the older Manual Q&A state.

## Open Tasks

- Reauth GAS:

```sh
cd /Users/masa/projects/AMD/amd-os/gas
npx --yes @google/clasp@latest login
```

- Deploy GAS worker:

```sh
npx --yes @google/clasp@latest push --force
npx --yes @google/clasp@latest deploy --deploymentId AKfycbwzA_sBg4iXhQH1dQjMKvgpeBShFcJ9_XmNdW0O0lptbCcTlApkJy7xArdAh4R7zl3G --description payment_confirm_expected_slack_action
```

- Enable the PWA flag only after GAS deploy succeeds:

```sh
cd /Users/masa/projects/AMD/amd-os
npx vercel env add PAYMENT_CONFIRM_SLACK_INTERACTIVE production --scope armada0130
# value: 1
npx vercel --prod --scope armada0130
npx vercel inspect https://amd-os-pwa.vercel.app --scope armada0130
```

- Test a Slack action end-to-end before marking done.

## First Read Next Session

1. `HANDOFF.md`
2. `pwa/design/SPEC_pwa.md`
3. `pwa/BUGS.md`
4. `pwa/manual/6-4-finance-payment-confirm-spec.md`
5. `pwa/design_log/sessions_2026-05.md`
6. `pwa/src/app/api/admin/payment-confirm/route.ts`
7. `pwa/src/app/api/cron/payment-confirm-nudges/route.ts`
8. `gas/80_SlackWebhook.js`
9. `gas/081_SlackInteractive.js`

## First Next Action

```sh
cd /Users/masa/projects/AMD/amd-os
git fetch --all --prune
git status -sb
npx vercel inspect https://amd-os-pwa.vercel.app --scope armada0130
```

Then do GAS `clasp login`, deploy the worker, and only then turn on `PAYMENT_CONFIRM_SLACK_INTERACTIVE`.
