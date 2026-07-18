# AMD OS Handoff

Last updated: 2026-07-18 JST

Target: `/Users/masa/projects/AMD/amd-os`
Topic: 法人支払義務の自動DM停止と通知事故のcloseout

## Latest Session Summary

- 法人支払義務の日次同期が、経理担当へ未確認・当月・期限超過の候補を初回から一括DMしていた。送信済み28件を確認した。
- `81bc29e3` で日次同期からの自動DMを既定OFFにした。台帳と月次試算表の同期は継続し、手動送信は明示操作として残す。
- production は `v3.44.15` / `81bc29e3` でReadyを確認した。
- 実装元タスクへ、検知・台帳化と対人通知を推論で結びつけず、DMは明示依頼またはreview-firstの確認後だけにするよう注意を送った。

## Current Truth

- `/api/cron/payment-obligations` の日次実行は、`PAYMENT_OBLIGATION_AUTO_NUDGE_ENABLED=1` が本番で明示されない限りSlack DMを送らない。
- 自動DMを再開する前に、候補件数・重複防止・送信文面をdry-runで確認し、まさの明示指示を取る。
- 正本: `pwa/manual/6-9-company-payment-obligations-spec.md`。事故記録: `pwa/BUGS.md`。詳細ログ: `pwa/design_log/sessions_2026-07.md`。

## Verification

- `npx eslint src/app/api/cron/payment-obligations/route.ts src/lib/build-info.ts`
- `npx tsc --noEmit`
- `npm run test:payment-obligations`
- `npm run build`
- production `/api/build-info` とVercel production Readyを確認済み。

## Shared Root / Cleanup State

- この停止bundleはclean cloneでcommit・push・deployし、cloneは削除済み。今回起因の未commit差分・branch・worktreeは残っていない。
- shared rootには別レーンのdirty、branch、worktreeが残る。今回の所有物ではないため削除しない。次のownerは各レーンのcloseoutで対象bundleをmainへ畳み、証跡後に削除判断する。
- repo全体のarchive判定は **do not archive**。理由はshared rootの別owner WIPと、未整理のbranch/worktree debt。

## Unresolved Tasks

- 自動DMの再開は未依頼。必要になった時だけ、review-firstの送信設計を別bundleで確認する。

## First Next Action

1. `git fetch origin main` と production `/api/build-info` を取り直す。
2. 通知変更の依頼なら、先に「台帳同期」「候補表示」「人への送信」を分け、送信は既定OFFで設計する。

## Guardrails

- `git add .` を使わず、対象ファイルだけをstageする。
- shared rootの他レーンdirtyをstage・reset・削除しない。
- PWA本番反映は `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh` を使う。
- raw本文、個人情報、secret、private URLをhandoffやdurable logへ残さない。
