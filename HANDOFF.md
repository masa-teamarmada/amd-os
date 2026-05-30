# HANDOFF - AMD OS

- Last updated: 2026-05-30 (codex handoff)
- Topic: CTB 2026-04 請求額 / 入金予定額 mismatch 修正、`予定請求額` 概念の廃止寄せ
- Canonical root: `/Users/masa/projects/AMD/amd-os`
- PWA root: `/Users/masa/projects/AMD/amd-os/pwa`
- Production URL: `https://amd-os-pwa.vercel.app`
- Current branch: `feat/bzm-textbook`
- Current HEAD: `720720d docs(bzm): 巻末3点セット新設 + 6-1 retrofit 透明性ノートを論文水準に`

## Latest Summary

- CTB (`p06`) 2026-04 稼働分で、freee 請求書は `270,000円税抜 / 297,000円税込` なのに、OS の入金予定が `275,844円税抜 / 303,428円税込` になっていた原因を調査。
- live Supabase の `billing_cycles(p06,202604).budget_reported_amount=275844` が入金予定計算で優先されていた。`5,844円` の由来は current DB / `source_cache` / `billing_log` からは復元不可。
- live DB は補正済み: `budget_reported_amount=270000`, `budget_yen=175500`, `reward_summary_json.monthlyBudget65/capBudgetYen=175500`。`billing_log.action='invoice_amount_corrected'` も追加。
- PWA code/docs は、`budget_reported_amount` を「予定請求額」ではなく「請求額（税抜）」として扱う方向へ変更済み。承認前は `請求額案`、承認後は `確定請求額`。
- 入金確認の税抜額は、freee 発行済み明細があれば `invoice_base_lines_json` を優先し、なければ確定請求額を使うように変更。
- Detailed session log: `pwa/design_log/sessions_2026-05.md` の「2026-05-30 (#97)」。

## Verification

- `npx tsc --noEmit` pass (`/Users/masa/projects/AMD/amd-os/pwa`)
- `npm run test:critical-ui` pass
- `npm run build` pass
- `git diff --check` pass
- Production deploy: 未実施。worktree に別作業の dirty 差分が多く、今回差分だけを安全に切り出す前に deploy しない。

## Repo State

- `git log --branches --not --remotes --oneline` は空。未 push commit なし。
- worktree は広く dirty。BZM / ERS / L2 / cockpit / manual / payment-confirm Slack action / finance fix が混在している。
- `git add .` / broad revert 禁止。必ず file-by-file で確認して stage する。
- BZM ワークストリームの handoff は `pwa/HANDOFF_bzm_textbook.md`。この handoff と混ぜない。
- 以前の payment-confirm Slack action は draft PR #2 (`codex/payment-confirm-slack-action`) と `pwa/design_log/sessions_2026-05.md` #96 を参照。GAS `invalid_rapt` blocker は未解決。

## Open Tasks

- 今回の finance fix を clean branch / clean worktree に切り出して commit する。
- その後、PWA deploy script で production 反映し、`https://amd-os-pwa.vercel.app` の build version と CTB 入金予定額表示を確認する。
- payment-confirm Slack action を続ける場合は、先に `clasp login` で GAS auth を更新し、GAS worker deploy 成功後にだけ `PAYMENT_CONFIRM_SLACK_INTERACTIVE=1` を有効化する。

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

Then isolate the finance fix before commit/deploy. Do not deploy the broad dirty worktree as-is.
