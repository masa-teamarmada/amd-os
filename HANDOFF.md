# HANDOFF - AMD OS

- Last updated: 2026-05-28 (codex handoff)
- Topic: `/admin/payouts` 保存済み支払額優先 + 支払通知書PDF 税抜→税込表示の本番復旧
- Canonical root: `/Users/masa/projects/AMD/amd-os`
- PWA root: `/Users/masa/projects/AMD/amd-os/pwa`
- Production URL: `https://amd-os-pwa.vercel.app`
- HEAD before this handoff update: `f96df4e` (`docs: record invoice number manual coverage`)
- Latest functional commits: `5e91b8f`, `01f840c`, `fb8837f`, `09a9c2a`

## Latest Summary

- `/admin/payouts` は既存 `monthly_reward_payout` がある場合、`reward_summary_json` の再計算値ではなく保存済み支払額を正本にする状態まで復旧済み。
- 4月稼働分 (`202604`) は既に変更不可なので、実績配分を適用せず旧 planned share 計算で固定済み。
- かるちゃん (ID003) の SX 202601-202603 保存済み内訳は `155,578 + 327,737 + 248,425 = 731,740円`。この 731,740円は税抜。
- 支払通知書PDFは税抜支払額に消費税10%を上乗せして表示する。検証済み新PDFは `小計 731,740円 / 消費税 73,174円 / 合計 804,914円`。
- PDFだけ旧税計算で出た原因は、GAS Web App deployment が stale で旧割り戻しロジックを serve していたこと。`@1480` で本番更新し、`@1482` で一時検証関数削除後のクリーン版に戻した。
- 詳細ログ: `pwa/design_log/sessions_2026-05.md` 末尾「2026-05-28 (codex) /admin/payouts 保存済み支払額優先 + 支払通知書PDF 税抜→税込反映」。

## Verification / Deploy

Run and observed:

- `npm run test:critical-ui` pass
- `npm run build` pass
- `node --check gas/064_PayoutFreeeNotice.js` pass
- PWA production deploy済み: `https://amd-os-pwa.vercel.app`
- `npx --yes @google/clasp@latest login` pass (`masa@team-armada.jp`)
- GAS本番 Web App deployment:
  - `@1480` `v1480_payout_notice_tax_excluded`
  - `@1482` `v1482_remove_temp_pdf_probe` (一時検証関数削除後)
- `POST https://amd-os-pwa.vercel.app/api/cron/payout-notice-prebuild` with `{ ym:"202605", force:true }` pass: generated 7 / failed 0
- ID003 PDF text extracted and verified:
  - `お支払金額 804,914円（税込）`
  - `小計（税抜） 731,740円`
  - `消費税（10%） 73,174円`

Known caveat:

- `clasp push` が `Script is already up to date.` でも、本番 Web App は `clasp deploy --deploymentId ...` しないと古い version のまま。支払通知書PDFを触ったら、deployment update + force再生成 + 実PDF確認まで必須。

## Repo State

- Branch: `main`
- Worktree before this handoff doc update: clean
- During handoff, unrelated dirty files appeared and were not edited/staged here:
  - `pwa/design/ms_progress.md`
  - `pwa/manual/4-8-ms-progress-monthly-report-revision-spec.md`
  - `pwa/scheduled-tasks/amd-os-l3-ms-progress-extract/SKILL.md`
  - `pwa/src/lib/build-info.ts`
  - `pwa/src/lib/progress-estimator.ts`
  Do not mix them into payout-tax commits without re-reading owner/context.
- Handoff/docs edits in this flow:
  - `HANDOFF.md`
  - `pwa/HANDOFF_pwa_rebuild.md`
  - `pwa/design_log/sessions_2026-05.md`
  - `pwa/BUGS.md`
  - `pwa/manual/6-5-admin-payouts-reward-notice-spec.md`
  - `pwa/manual/9-2-developer.md`
  - `gas/CLAUDE.md`

## Open Tasks

- Operational: actual invoice registration numbers still need to be entered in `/admin/members` as needed.
- No unresolved code task for the payout tax issue at this handoff.

## Pointers

- PWA handoff: `pwa/HANDOFF_pwa_rebuild.md`
- Payout notice manual: `pwa/manual/6-5-admin-payouts-reward-notice-spec.md`
- Developer manual: `pwa/manual/9-2-developer.md`
- Feature registry: `pwa/design/FEATURE_REGISTRY.md`
- PWA canonical spec: `pwa/design/SPEC_pwa.md`
- Bug / operations log: `pwa/BUGS.md`
- GAS deploy rules: `gas/CLAUDE.md`
- Session log: `pwa/design_log/sessions_2026-05.md`

## First Read Next Session

1. `HANDOFF.md`
2. `pwa/HANDOFF_pwa_rebuild.md`
3. `pwa/design/SPEC_pwa.md`
4. `pwa/manual/6-5-admin-payouts-reward-notice-spec.md`
5. `pwa/BUGS.md`
6. `pwa/design/FEATURE_REGISTRY.md`
7. `gas/CLAUDE.md`
8. `pwa/design_log/sessions_2026-05.md`

## First Next Action

```sh
cd /Users/masa/projects/AMD/amd-os
git fetch --all --prune
git status -s
git log --branches --not --remotes --oneline
```

Then continue from the user's next request. If it touches payout PDFs, confirm whether the issue is PWA/DB amount selection or GAS Web App deployment/PDF rendering before changing code.
