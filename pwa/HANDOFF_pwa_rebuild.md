# HANDOFF - AMD OS PWA

- Last updated: 2026-05-28 (codex handoff)
- Topic: `/admin/payouts` 保存済み支払額優先 + 支払通知書PDF 税抜→税込表示の本番復旧
- Canonical root: `/Users/masa/projects/AMD/amd-os`
- PWA root: `/Users/masa/projects/AMD/amd-os/pwa`
- Production URL: `https://amd-os-pwa.vercel.app`
- HEAD before this handoff update: `f96df4e` (`docs: record invoice number manual coverage`)
- Latest functional commits: `5e91b8f`, `01f840c`, `fb8837f`, `09a9c2a`

## Latest Summary

- `/admin/payouts` は既存 `monthly_reward_payout` がある場合、保存済み支払額を画面・`payout_notices.total_yen`・PDF payload の正本にする。
- 4月稼働分 (`202604`) は変更不可扱いで、実績配分ではなく旧 planned share 計算を維持する。
- かるちゃん (ID003) の SX 202601-202603 は `155,578 + 327,737 + 248,425 = 731,740円`。これは税抜。
- GAS支払通知書PDFは税抜支払額に消費税10%を上乗せし、`お支払金額` / `合計（税込）` に税込額を出す。
- 一度、PDFだけ `731,740円(税込)` / `小計 665,218円` と旧割り戻しロジックで出たが、原因は GAS Web App deployment stale。`@1480` で修正を本番化し、`@1482` で一時検証関数削除後のクリーン版へ戻した。
- 詳細ログ: `pwa/design_log/sessions_2026-05.md` 末尾「2026-05-28 (codex) /admin/payouts 保存済み支払額優先 + 支払通知書PDF 税抜→税込反映」。

## Verification / Deploy

Run and observed:

- PWA: `npm run test:critical-ui` pass
- PWA: `npm run build` pass
- GAS syntax: `node --check gas/064_PayoutFreeeNotice.js` pass
- PWA production deploy済み: `https://amd-os-pwa.vercel.app`
- GAS auth: `npx --yes @google/clasp@latest login` pass (`masa@team-armada.jp`)
- GAS production deployment:
  - `@1480` `v1480_payout_notice_tax_excluded`
  - `@1482` `v1482_remove_temp_pdf_probe`
- Forced PDF regeneration:
  - `POST /api/cron/payout-notice-prebuild` with `{ ym:"202605", force:true }`
  - generated 7 / skipped 0 / failed 0
  - ID003 new PDF: `https://drive.google.com/file/d/1pardsUP_Yass7640mRyYgwfaZnklQxqK/view?usp=drivesdk`
- ID003 PDF text extraction verified:
  - `お支払金額 804,914円（税込）`
  - `小計（税抜） 731,740円`
  - `消費税（10%） 73,174円`
  - `合計（税込） 804,914円`

Known caveat:

- `clasp push` と PWA deploy だけでは GAS Web App `/exec` は更新されない。PWA が叩く deployment ID を `clasp deploy --deploymentId ...` で更新すること。

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
- Handoff/docs changed in this flow:
  - `HANDOFF.md`
  - `pwa/HANDOFF_pwa_rebuild.md`
  - `pwa/design_log/sessions_2026-05.md`
  - `pwa/BUGS.md`
  - `pwa/manual/6-5-admin-payouts-reward-notice-spec.md`
  - `pwa/manual/9-2-developer.md`
  - `gas/CLAUDE.md`

## Open Tasks

- Operational: actual invoice registration numbers still need to be entered in `/admin/members` as needed.
- No unresolved code task for the payout tax issue.

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

Then continue from the user's next request. If it touches payout PDFs, split investigation into (1) saved payout amount source, (2) PWA payload, and (3) GAS Web App deployment/PDF rendering.
