# HANDOFF - AMD OS

- Last updated: 2026-05-28 (codex handoff)
- Topic: PWA 右下つくよみ非表示の本番確認 + current main / production 差分整理
- Canonical root: `/Users/masa/projects/AMD/amd-os`
- PWA root: `/Users/masa/projects/AMD/amd-os/pwa`
- Production URL: `https://amd-os-pwa.vercel.app`
- HEAD before handoff docs: `09a9c2a` (`Add invoice registration number to payouts`)
- Build version at HEAD: `v0.7.6`

## Latest Summary

- まさ指摘「右下のつくよみを非表示にして」を受け、PWA global layout から visible `TsukuyomiMascot` を外した状態を確認した。
- 修正依頼 drawer の明示導線は消さず、`TsukuyomiChatBridge` が `tsukuyomi:open` event だけを受ける invisible bridge として残っている。
- Production `https://amd-os-pwa.vercel.app/dashboard` を Chrome で確認し、表示 version `AMD OS v0.7.5` かつ右下 mascot なしを確認済み。
- その後 current `main` は `09a9c2a` / `v0.7.6` まで進み、支払通知書のインボイス登録番号対応が入っている。`v0.7.6` の production 反映と Supabase migration 107 適用状態はこの handoff 時点では未確認。
- 詳細ログ: `pwa/design_log/sessions_2026-05.md` 末尾「2026-05-28 (codex)」。

## Verification / Deploy

Run and observed for the Tsukuyomi visible mascot removal:

- `npx tsc --noEmit` pass
- `npm run test:critical-ui` pass
- `npm run build` pass
- Vercel deployment `dpl_71ybU9TqXHbbsU8VJTvwNyk4J2ji` Ready
- Production alias includes `https://amd-os-pwa.vercel.app`
- Chrome production dashboard: `AMD OS v0.7.5`, no bottom-right visible mascot

Not verified:

- Current HEAD `v0.7.6` production reflection
- Supabase migration `107_members_invoice_registration_number.sql` actual remote apply state

## Repo State

- Branch: `main`
- Remote tracking: `main...origin/main`
- Unpushed commits before handoff docs: none observed (`git log --branches --not --remotes --oneline` empty)
- Worktree before handoff docs: clean
- Handoff edits in this flow should be limited to:
  - `HANDOFF.md`
  - `pwa/HANDOFF_pwa_rebuild.md`
  - `pwa/design_log/sessions_2026-05.md`
  - `pwa/BUGS.md`

## Open Tasks

- [ ] Confirm whether production should be advanced from observed `v0.7.5` to current HEAD `v0.7.6`.
- [ ] Before deploying `v0.7.6`, verify migration `107_members_invoice_registration_number.sql` / `members.invoice_registration_number` is applied in Supabase.
- [ ] If Vercel CLI deploy polling fails with local network errors, inspect the deployment URL before retrying; the deployment may already be Ready.

## Pointers

- PWA handoff: `pwa/HANDOFF_pwa_rebuild.md`
- PWA canonical spec: `pwa/design/SPEC_pwa.md`
- Tsukuyomi manual: `pwa/manual/8-1-knowledge-admin-tsukuyomi-spec.md`
- Payout notice manual: `pwa/manual/6-5-admin-payouts-reward-notice-spec.md`
- Bug / operations log: `pwa/BUGS.md`
- Session log: `pwa/design_log/sessions_2026-05.md`

## First Read Next Session

1. `HANDOFF.md`
2. `pwa/HANDOFF_pwa_rebuild.md`
3. `pwa/design/SPEC_pwa.md`
4. `pwa/manual/8-1-knowledge-admin-tsukuyomi-spec.md`
5. `pwa/manual/6-5-admin-payouts-reward-notice-spec.md`
6. `pwa/BUGS.md`
7. `pwa/design_log/sessions_2026-05.md`

## First Next Action

```sh
cd /Users/masa/projects/AMD/amd-os
git fetch --all --prune
git status -s
git log --branches --not --remotes --oneline
```

Then verify the `v0.7.6` deployment/migration decision:

```sh
cd /Users/masa/projects/AMD/amd-os/pwa
npx vercel inspect https://amd-os-pwa.vercel.app --scope armada0130
```
