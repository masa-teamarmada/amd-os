# AMD OS Handoff

Last updated: 2026-07-09 JST
Target: `/Users/masa/projects/AMD/amd-os`
Topic: Finance / Payment Confirm nudge 入金日当日化 + closeout

## Summary

- まさが共有した ZMP 入金確認Slack DMは、期日 `2026-07-31` なのに `2026-07-09` に届いていた。入金日前は確認不能なので、送信タイミングが誤り。
- 原因は `/api/cron/payment-confirm-nudges` が入金月 (`ym`) の未入金候補を全件送り、候補ごとの `dueDate` が今日かを見ていなかったこと。
- `入金確認できなかった` 画面は、freee/銀行で入金が無いという意味ではなく、signed token の即時反映APIが例外を返した時の汎用エラー画面。DB read-back では ZMP p19 / 202606 の `payment_confirmed_at` は未更新。
- fix commit `df434cbf` で、入金確認nudgeは今日 (JST) の `dueDate` と一致する候補だけ送るように変更。`支払月` 表示は `入金月` に統一。
- 後続 commit `d8934395` (`v0.39.34`) が `origin/main` / production に入り、`df434cbf` は ancestor として含まれる。
- 詳細ログ: `pwa/design_log/sessions_2026-07.md` の `2026-07-09 — Finance / Payment Confirm nudge 入金日当日化 / v0.39.33`。

## Repo State

- Canonical repo: `/Users/masa/projects/AMD/amd-os`
- Branch: `main`
- Product fix commit: `df434cbf fix(pwa): send payment confirm nudges on due date`
- Current product HEAD before this handoff docs refresh: `d8934395 fix(pwa): widen monthly agreement unpaid flow`
- Local main vs `origin/main` at closeout inventory: ahead `0`, behind `0`
- Worktree registry: `/Users/masa/projects/AMD/amd-os [main]` only
- Local branches: `main` only
- Production: `https://amd-os-pwa.vercel.app` is on the post-fix line. Re-check `/api/build-info` when resuming.

## Dirty State

Uncommitted changes are separate active WIP from other sessions, not part of the payment-confirm fix. Final closeout inventory observed two bundles: `/admin/invoices` freee取引先選択 / 請求書発行条件 and `/poc` matching UI/docs.

| path | status | class | owner guess | resolution action | risk |
|---|---:|---|---|---|---|
| `pwa/src/app/(app)/admin/invoices/page.tsx` | M | other-worker | invoice queue / freee取引先選択 worker | WIP全体を完成させ、対象ファイルだけ stage / commit / push / deploy | 中: 未完のまま archive すると請求書発行UIのWIPが宙に浮く |
| `pwa/src/app/api/admin/freee-partners/route.ts` | ?? | other-worker | invoice queue / freee取引先選択 worker | freee取引先候補取得のauth/data境界を確認して commit | 中 |
| `pwa/src/app/api/invoice/create/route.ts` | M | other-worker | invoice queue / freee取引先選択 worker | 発行API側の取引先/発行条件変更とUIをセットで検証 | 中 |
| `pwa/src/components/admin/AdminInvoiceIssueDialog.tsx` | M | other-worker | invoice queue / freee取引先選択 worker | 発行モーダルの請求先表示変更とセットで検証 | 中 |
| `pwa/src/components/admin/AdminInvoiceIssueQueue.tsx` | M | other-worker | invoice queue / freee取引先選択 worker | 報告書/立替 blocker 除外、freee選択UIを完成させる | 中 |
| `pwa/src/components/admin/AdminProjectsTable.tsx` | M | other-worker | invoice queue / freee取引先選択 worker | PJ台帳freee欄の選択UIと合わせて検証 | 中 |
| `pwa/src/components/admin/FreeePartnerPicker.tsx` | ?? | other-worker | invoice queue / freee取引先選択 worker | 検索UI状態とAPIのエラー表示を確認 | 中 |
| `pwa/src/app/(app)/poc/page.tsx` | M | other-worker | POC matching worker | POC UI/docs bundleとして完成・検証・commit | 中: POC画面のWIPが宙に浮く |
| `pwa/design/poc_matching.md`, `pwa/manual/2-5-research-assets-quick-start.md`, `pwa/manual/5-1-research-assets-vc-seeds-scholar-spec.md` | M | other-worker | POC matching worker | POC仕様変更とUIを同一commitにまとめる | 中 |
| `pwa/src/lib/build-info.ts` | M | other-worker | active WIP workers | WIP完成時に `v0.39.35` として検証/deploy | 中 |
| `pwa/design/FEATURE_REGISTRY.md`, `pwa/design/SPEC_pwa.md`, `pwa/manual/6-2-admin-projects-members-ledger-spec.md`, `pwa/manual/6-3-invoice-and-billing-routine-spec.md`, `pwa/manual/9-3-appendix-changelog.md`, `pwa/spec/6-1-appendix-changelog.md`, `pwa/scripts/check_pwa_critical_ui.cjs` | M | other-worker | invoice queue / POC workers | WIP仕様・回帰ガードと実装を、該当bundleごとに混ぜずに commit | 中 |

Resolution owner: next invoice queue / POC sessions. Payment-confirm closeoutでは巻き込まない。Handoff docs更新で触った `HANDOFF.md` / `SESSION_MIGRATION_PROMPT.md` / `pwa/BUGS.md` / `pwa/HANDOFF_pwa_rebuild.md` / `pwa/design_log/sessions_2026-07.md` だけはこの closeout の own-necessary。

## Verification / Deploy

Payment-confirm fixで実行済み:

- `npx tsc --noEmit`
- targeted `eslint`
- `npm run build`
- local dry-run:
  - `date=2026-07-09`: `groupCount=0`, `skippedBeforeDue=6`, `skippedAfterDue=1`
  - `date=2026-07-31`: `groupCount=0`, `skippedZeroAmount=5`
- `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh`
- production `/api/build-info` after deploy: `v0.39.33` / `df434cbf0e42d22cb49ab5fa19e5d2a291498e0c`
- production dry-run `date=2026-07-09`: `groupCount=0`

## Unresolved Tasks

- Payment-confirm nudge: none known.
- Exact old button exception: not reproduced from the expired/old Slack token. If it recurs, capture the error text under the red heading and inspect token payload / target `billing_cycles` / update exception.
- Closeout archive status: `do not archive` because the unrelated invoice queue freee取引先 WIP remains dirty.

## First Next Action

If continuing the current repo immediately, first decide which active WIP bundle to finish: invoice queue freee取引先 or POC matching.

1. Inspect the dirty files listed above and split by bundle.
2. For invoice queue: confirm the route/auth/data source for freee取引先 search.
3. For POC: confirm the intended UI/spec scope before touching shared docs.
4. Run targeted checks.
5. Stage only those files plus required spec/manual updates.
6. Commit/push/deploy through the normal AMD OS PWA path.

If touching payment-confirm again, first read `pwa/manual/6-4-finance-payment-confirm-spec.md` and dry-run `/api/cron/payment-confirm-nudges` with explicit `date`.

## Pointers

- Payment confirm manual: `pwa/manual/6-4-finance-payment-confirm-spec.md`
- Notification design: `pwa/design/notifications.md`
- PWA route/spec: `pwa/design/SPEC_pwa.md`
- Code: `pwa/src/app/api/cron/payment-confirm-nudges/route.ts`, `pwa/src/app/api/admin/payment-confirm/route.ts`, `pwa/src/app/payment-confirm/PaymentConfirmClient.tsx`
- Bug lesson: `pwa/BUGS.md`
- Session log: `pwa/design_log/sessions_2026-07.md`
