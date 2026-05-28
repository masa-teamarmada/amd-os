# HANDOFF - AMD OS

- Last updated: 2026-05-28 (codex handoff)
- Topic: `/admin/members` インボイス登録番号 + `/admin/payouts` 支払通知書PDF反映
- Canonical root: `/Users/masa/projects/AMD/amd-os`
- PWA root: `/Users/masa/projects/AMD/amd-os/pwa`
- Production URL: `https://amd-os-pwa.vercel.app`
- HEAD before this handoff update: `d635d95` (`docs: update handoff after tsukuyomi bridge deploy`)
- Latest feature commit: `09a9c2a` (`Add invoice registration number to payouts`)
- Build version deployed: `v0.7.6`

## Latest Summary

- `members.invoice_registration_number` を Supabase に追加し、`pwa/design/db_schema.md` を remote schema から再生成済み。
- `/admin/members` に「インボイス登録番号」列を追加。セルクリックで編集し、保存時に trim + uppercase する。
- `/admin/payouts` の支払通知書PDF生成 payload に `invoiceRegistrationNumber` を渡し、GAS `payoutBuildNoticePdfBlob_` が宛先ブロック下に「インボイス登録番号」を表示する。
- GAS 本体へ `npx @google/clasp push` 済み。
- PWA production deploy 済み。最新 deployment: `dpl_7oa9wHmjzvhQftyhkZFCE9xeH72n` / `https://amd-os-mws7pq829-armada0130.vercel.app` / alias `https://amd-os-pwa.vercel.app` Ready。
- 詳細ログ: `pwa/design_log/sessions_2026-05.md` 末尾「2026-05-28 (codex) admin/members インボイス登録番号 + 支払通知書PDF反映」。

## Verification / Deploy

Run and observed:

- `python3 -X utf8 scripts/apply_ddl.py scripts/migrations/107_members_invoice_registration_number.sql` pass (`OK (201)`)
- `python3 -X utf8 scripts/dump_schema.py` pass; `members.invoice_registration_number` appears in `pwa/design/db_schema.md`
- `npm run test:critical-ui` pass
- `npm run test:next-period-ui` pass
- `npx tsc --noEmit` pass
- `npm run build` pass
- changed TS/TSX files individual eslint pass
- `node --check gas/064_PayoutFreeeNotice.js` and `node --check gas/062_PayoutRepo.js` pass
- `npx @google/clasp push` pass
- `bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh` pass, production alias Ready
- Production auth redirects checked for `/admin/members` and `/admin/payouts` (`HTTP/2 307` to `/auth/login?...`)

Known verification caveat:

- Full `npm run lint` still fails on existing unrelated repo lint debt (Atlas/HUD/cjs/no-explicit-any etc.). The files touched in this session pass targeted eslint.

## Repo State

- Branch: `main`
- Remote tracking before this handoff update: `main...origin/main`
- Unpushed commits before this handoff update: none observed
- Worktree before this handoff update: clean
- Handoff edits in this flow should be limited to:
  - `HANDOFF.md`
  - `pwa/HANDOFF_pwa_rebuild.md`
  - `pwa/design_log/sessions_2026-05.md`
  - `pwa/manual/2-6-admin-ops.md`
  - `pwa/manual/6-2-admin-projects-members-ledger-spec.md`

## Open Tasks

- [ ] Operational: enter each contractor's invoice registration number in `/admin/members`.
- [ ] Operational: for already-generated payout PDFs, use existing force reissue / individual reissue flow so the new invoice registration number appears in the actual PDF.

## Pointers

- PWA handoff: `pwa/HANDOFF_pwa_rebuild.md`
- PWA canonical spec: `pwa/design/SPEC_pwa.md`
- Payout notice manual: `pwa/manual/6-5-admin-payouts-reward-notice-spec.md`
- Feature registry: `pwa/design/FEATURE_REGISTRY.md`
- DB schema reference: `pwa/design/db_schema.md`
- Bug / operations log: `pwa/BUGS.md`
- Session log: `pwa/design_log/sessions_2026-05.md`

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

Then continue from the user's next request. If it concerns payout PDFs, first confirm whether the target member has `members.invoice_registration_number` set and whether the PDF was generated before or after `v0.7.6`.
