# HANDOFF - AMD OS PWA

- Last updated: 2026-05-28 (codex handoff)
- Topic: `/admin/members` インボイス登録番号 + `/admin/payouts` 支払通知書PDF反映
- Canonical root: `/Users/masa/projects/AMD/amd-os`
- PWA root: `/Users/masa/projects/AMD/amd-os/pwa`
- Production URL: `https://amd-os-pwa.vercel.app`
- HEAD before this handoff update: `d635d95` (`docs: update handoff after tsukuyomi bridge deploy`)
- Latest feature commit: `09a9c2a` (`Add invoice registration number to payouts`)
- Build version deployed: `v0.7.6`

## Latest Summary

- `members.invoice_registration_number` を Supabase に追加。migration `pwa/scripts/migrations/107_members_invoice_registration_number.sql` は remote apply 済み。
- `/admin/members` の台帳に「インボイス登録番号」列を追加し、既存の inline cell edit パターンで編集できる。
- `/admin/payouts` は `members.invoice_registration_number` を `invoiceRegistrationNumber` として GAS payload に渡す。
- `gas/064_PayoutFreeeNotice.js` の改善版PDFが宛先ブロック下に「インボイス登録番号」を出す。未登録時は「インボイス登録番号：（未登録）」。
- `pwa/design/SPEC_pwa.md` / `pwa/design/FEATURE_REGISTRY.md` / `pwa/manual/6-5-admin-payouts-reward-notice-spec.md` / `pwa/design/db_schema.md` に恒久仕様を反映済み。
- 詳細ログ: `pwa/design_log/sessions_2026-05.md` 末尾「2026-05-28 (codex) admin/members インボイス登録番号 + 支払通知書PDF反映」。

## Verification / Deploy

Run and observed:

- Supabase DDL: `python3 -X utf8 scripts/apply_ddl.py scripts/migrations/107_members_invoice_registration_number.sql` → `OK (201)`
- Schema dump: `python3 -X utf8 scripts/dump_schema.py` → `members.invoice_registration_number` in `db_schema.md`
- PWA: `npm run test:critical-ui` pass
- PWA: `npm run test:next-period-ui` pass
- PWA: `npx tsc --noEmit` pass
- PWA: `npm run build` pass
- PWA targeted lint: changed TS/TSX files pass
- GAS syntax: `node --check gas/064_PayoutFreeeNotice.js` / `node --check gas/062_PayoutRepo.js` pass
- GAS deploy: `npx @google/clasp push` pass
- PWA production deploy: `bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh` pass
- Latest Vercel deployment: `dpl_7oa9wHmjzvhQftyhkZFCE9xeH72n`
- Inspect-only URL: `https://amd-os-mws7pq829-armada0130.vercel.app`
- User-facing URL: `https://amd-os-pwa.vercel.app`
- Production auth redirects checked for `/admin/members` and `/admin/payouts` (`HTTP/2 307` to login)

Known verification caveat:

- Full `npm run lint` still fails on existing unrelated lint debt. Do not treat that as introduced by this session unless touched files regress; targeted lint for touched TS/TSX files passed.

## Repo State

- Branch: `main`
- Remote tracking before this handoff update: `main...origin/main`
- Unpushed commits before this handoff update: none observed
- Worktree before this handoff update: clean
- Handoff docs changed in this flow:
  - `HANDOFF.md`
  - `pwa/HANDOFF_pwa_rebuild.md`
  - `pwa/design_log/sessions_2026-05.md`

## Open Tasks

- [ ] Operational: enter actual invoice registration numbers in `/admin/members`.
- [ ] Operational: reissue already-generated payout PDFs if they need to show the newly entered registration number.

## First Read Next Session

1. `HANDOFF.md`
2. `pwa/HANDOFF_pwa_rebuild.md`
3. `pwa/design/SPEC_pwa.md`
4. `pwa/manual/6-5-admin-payouts-reward-notice-spec.md`
5. `pwa/design/FEATURE_REGISTRY.md`
6. `pwa/BUGS.md`
7. `pwa/design_log/sessions_2026-05.md`

## First Next Action

```sh
cd /Users/masa/projects/AMD/amd-os
git fetch --all --prune
git status -s
git log --branches --not --remotes --oneline
```

Then continue from the user's next request. If the task touches payout notice PDFs, check whether the existing PDF predates `v0.7.6`; old PDFs need force reissue to pick up the registration number.
