# HANDOFF - AMD OS PWA

- Last updated: 2026-05-30 (codex handoff)
- Topic: CTB 202604 請求額 / 入金予定額 mismatch 修正、請求額入力フローの用語整理
- Canonical root: `/Users/masa/projects/AMD/amd-os`
- PWA root: `/Users/masa/projects/AMD/amd-os/pwa`
- Production URL: `https://amd-os-pwa.vercel.app`
- Current branch: `feat/bzm-textbook`
- Current HEAD: `720720d docs(bzm): 巻末3点セット新設 + 6-1 retrofit 透明性ノートを論文水準に`

## Latest Summary

- CTB (`p06`) 2026-04 稼働分の freee 請求書は `297,000円税込` だが、OS の入金予定が `303,428円税込` になっていた。
- 原因は `billing_cycles.budget_reported_amount=275844` が入金予定計算で優先されていたこと。正しい税抜請求額は `270000`。
- live DB は補正済み。`budget_reported_amount=270000`, `budget_yen=175500`, `reward_summary_json.monthlyBudget65/capBudgetYen=175500`。`billing_log` に `invoice_amount_corrected` を追加。
- PWA は「予定請求額」という別概念を置かず、入力値を請求額（税抜）として扱う方針へ整理。承認前だけ `請求額案`、承認後は `確定請求額`。
- 入金確認は、freee発行済み請求書の明細 (`invoice_base_lines_json`) があれば明細合計を優先し、なければ確定請求額 (`budget_reported_amount`) を使う。
- Detailed session log: `pwa/design_log/sessions_2026-05.md` の「2026-05-30 (#97)」。

## Verification

- `npx tsc --noEmit` pass
- `npm run test:critical-ui` pass
- `npm run build` pass
- `git diff --check` pass
- Production deploy: 未実施。dirty worktree が広すぎるため、finance fix を切り出してから deploy する。

## Repo State

- 未 push commit なし (`git log --branches --not --remotes --oneline` is empty)。
- worktree は広く dirty。BZM / ERS / L2 / cockpit / manual / payment-confirm Slack action / finance fix が混在。
- `git add .` 禁止。stage は必ず対象ファイルを読み直してから個別に行う。
- BZM は `pwa/HANDOFF_bzm_textbook.md` に分離済み。
- 入金確認 Slack action の前回 handoff は `pwa/design_log/sessions_2026-05.md` #96。GAS `invalid_rapt` blocker はまだ残っている。

## Open Tasks

- finance fix を clean branch / clean worktree に切り出して commit。
- PWA deploy script で production 反映。
- 本番で CTB 202604 の入金予定額が `297,000円税込`、税抜請求額が `270,000円` になることを確認。
- payment-confirm Slack action を続ける場合は、GAS reauth -> GAS deploy -> `PAYMENT_CONFIRM_SLACK_INTERACTIVE=1` -> PWA redeploy -> Slack実押下test の順に進める。

## First Read Next Session

1. `HANDOFF.md`
2. `pwa/design/SPEC_pwa.md`
3. `pwa/BUGS.md`
4. `pwa/manual/6-3-invoice-and-billing-routine-spec.md`
5. `pwa/manual/6-4-finance-payment-confirm-spec.md`
6. `pwa/design/routine.md`
7. `pwa/design_log/sessions_2026-05.md`
8. `pwa/src/lib/payment-groups.ts`
9. `pwa/src/components/cockpit/CockpitRoutineBudgetModal.tsx`
10. `pwa/src/components/cockpit/CockpitRoutineInvoiceModal.tsx`

## First Next Action

```sh
cd /Users/masa/projects/AMD/amd-os
git fetch --all --prune
git status -sb
git diff -- pwa/src/lib/payment-groups.ts pwa/src/components/cockpit/CockpitRoutineBudgetModal.tsx pwa/src/components/cockpit/CockpitRoutineInvoiceModal.tsx pwa/src/app/payment-confirm/PaymentConfirmClient.tsx pwa/src/app/api/cron/payment-confirm-nudges/route.ts pwa/manual/6-3-invoice-and-billing-routine-spec.md pwa/manual/6-4-finance-payment-confirm-spec.md pwa/design/routine.md pwa/design/FEATURE_REGISTRY.md pwa/design/SPEC_pwa.md
```

Then isolate finance changes before commit/deploy. Do not deploy the whole dirty worktree.
