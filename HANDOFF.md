# AMD OS Handoff

Last updated: 2026-07-09 JST
Target: `/Users/masa/projects/AMD/amd-os`
Topic: `/admin/invoices` 請求書発行キュー / ZMP 立替精算 closeout / v0.39.24

## Summary

- `/admin/invoices` の中身を旧 billing matrix から請求書発行キューへ変更した。未発行を初期表示し、`未発行 / 発行済み / 送付済み / 入金済み / すべて` で絞り込む。
- 行の主操作は `発行` / `請求書を発行`。`AdminInvoiceIssueDialog` から明細確認、下書き保存、freee 発行へ進める。単なる手動 status 更新では発行済みにしない。
- 発行前確認は `予算 / 報告書 / 立替` だけに絞った。`支払通知 / 報酬支払` など請求書発行の前提ではない全ステップ横並びは戻さない。
- 請求額表示は `invoice_base_lines_json` の明細合計を最優先し、なければ `budget_reported_amount`、最後に `budget_yen / 0.65` へ fallback する。
- ZMP cockpit の `立替精算` は「契約可否」ではなく「発生額 / 不可」。ZMP は実務上OK、金額未入力時は `0円`。契約本文には明示条項がないため、巻き直し候補。
- Build version は `v0.39.24`。

## Repo State

- Canonical repo: `/Users/masa/projects/AMD/amd-os`
- Branch: `main`
- Branch rule: normal AMD OS work is main-direct; do not create a branch because of dirty state.
- This closeout bundle includes the current `origin/main` monthly-agreement density commit plus the invoice queue / ZMP closeout docs.
- Current commit and production SHA should be read with:
  - `git log -1 --oneline`
  - `curl -fsS https://amd-os-pwa.vercel.app/api/build-info`

## Verification

- `git diff --check`
- `npm run test:critical-ui`
- `./node_modules/typescript/bin/tsc --noEmit --pretty false`
- `npm run build`

Build passed with the existing Next.js middleware deprecation warning only.

## Unresolved Tasks

- `/admin/invoices`: none known.
- ZMP立替精算: 実際の月次立替金額をOSに残すなら、`/admin/projects` の ZMP 行の `立替精算` セルへ金額を入れる。
- ZMP契約: 実務運用と契約本文が乖離しているため、利益上乗せ条件や立替精算条項を含めた契約巻き直し候補。

## First Next Action

次に請求書発行を見る時は、`/admin/invoices` で `未発行` filter を開き、上から `発行` を押して明細確認、必要なら下書き保存、問題なければ freee 発行へ進む。

## Pointers

- Admin invoice route: `pwa/src/app/(app)/admin/invoices/page.tsx`
- Invoice queue UI: `pwa/src/components/admin/AdminInvoiceIssueQueue.tsx`
- Invoice issue dialog: `pwa/src/components/admin/AdminInvoiceIssueDialog.tsx`
- Invoice manual: `pwa/manual/6-3-invoice-and-billing-routine-spec.md`
- Member/admin billing manual: `pwa/manual/6-6-member-billing-prompts-spec.md`
- Runtime/design spec: `pwa/design/SPEC_pwa.md`
- Feature registry: `pwa/design/FEATURE_REGISTRY.md`
- Process bug/lesson: `pwa/BUGS.md`
- Session log: `pwa/design_log/sessions_2026-07.md`
