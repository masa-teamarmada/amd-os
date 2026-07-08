# AMD OS Handoff

Last updated: 2026-07-08 JST
Target: `/Users/masa/projects/AMD/amd-os`
Topic: Admin MS Overview 個人名カード回帰防止 / `v0.39.13` closeout

## Summary

See `pwa/design_log/sessions_2026-07.md` section:
- `2026-07-08 — Admin MS Overview 個人名カード回帰防止 / v0.39.13 closeout`

- `/admin/ms-overview` の上段メトリクスに、個人名同士を比べるカードが戻っていた件を調査・修正した。
- 原因は、過去にカード本体だけ中途半端に変わり、設計書・登録簿・変更履歴側に旧カードを連想させる文言が残っていたこと。
- 正しい current truth は 4 枚構成: 合計pt / 本契約pt / 別財布pt / `budgetImpact` 由来の `PJ予算残` または不足系カード。
- 3 枚化も、4 枚目を個人名カードへ戻すことも禁止として、`pwa/manual/6-8-admin-ms-overview-spec.md` と `pwa/design/FEATURE_REGISTRY.md` に固定済み。
- 旧カード文言は current tree から削除済み。`rg` で禁止語ゼロ件を確認済み。
- 本番は `v0.39.13` / `cb584019ca8710b684322688069c42bf1012d652` / `dirty:false` を確認済み。

## Current Truth

- Canonical repo: `/Users/masa/projects/AMD/amd-os`
- Branch: `main`
- Latest accepted product release commit: `cb584019ca8710b684322688069c42bf1012d652` (`chore(pwa): bump build version for MS guard`)
- Latest handoff docs commit: current `origin/main` HEAD. Re-check with `git log -1 --oneline` because this file is part of the docs commit itself.
- Production URL: `https://amd-os-pwa.vercel.app`
- Production `/api/build-info` observed after handoff docs deploy:
  - `build_version`: `v0.39.13`
  - `git_sha`: current `origin/main` HEAD
  - `git_branch`: `main`
  - `dirty`: `false`
- Worktree registry: one registered worktree only, `/Users/masa/projects/AMD/amd-os [main]`.
- Local branch inventory: `main` only.
- Local main vs origin/main before this handoff update: ahead `0`, behind `0`.

## Verification Already Run

MS Overview fix / guard:

```bash
npm run test:critical-ui
npm run test:deploy-version-guard
npx tsc --noEmit
node pwa/scripts/deploy-version-guard.cjs --target production --app-url https://amd-os-pwa.vercel.app --repo-root /Users/masa/projects/AMD/amd-os
curl -sS https://amd-os-pwa.vercel.app/api/build-info
```

Observed:
- critical UI anchors passed.
- deploy rollback guard passed with local `v0.39.13` > production `v0.39.12` before push.
- TypeScript check passed.
- Production switched to `v0.39.13`.
- Forbidden old wording search returned zero matches.

## Design Records

- User/dev manual: `pwa/manual/6-8-admin-ms-overview-spec.md`
- Important UI registry: `pwa/design/FEATURE_REGISTRY.md`
- Changelogs: `pwa/manual/9-3-appendix-changelog.md`, `pwa/spec/6-1-appendix-changelog.md`
- Bug/lesson: `pwa/BUGS.md` entry `[admin/ms-overview] 個人名カードが上段メトリクスへ戻った`
- Session log: `pwa/design_log/sessions_2026-07.md`

## Dirty State To Preserve

These files were already dirty after the accepted `v0.39.13` release and are not part of this handoff bundle. Do not revert or stage them casually.

| path | class | owner guess | next action | risk |
|---|---|---|---|---|
| `pwa/src/app/api/admin/ms-overview/route.ts` | other-worker / MS finance WIP | MS design amount worker | Decide whether exact design amount should use `budget × pt比`; if yes, sync spec/manual, test, bump version, commit, push. | Medium: deploy script hard-stops while dirty; accidental staging can ship unverified finance math. |
| `pwa/src/components/admin/AdminMsOverviewClient.tsx` | other-worker / MS finance WIP | MS design amount worker | Same bundle as above. | Medium |
| `pwa/src/lib/admin/ms-overview-calc.ts` | other-worker / MS finance WIP | MS design amount worker | Same bundle as above. | Medium |
| `pwa/scheduled-tasks/amd-os-l6-meeting-prep-worker/SKILL.md` | other-worker / L6 prep WIP | L6 prep worker | Decide whether prep Drive outputs should be HTML-only; if yes, sync related specs/manual and commit. | Low/Medium |
| `pwa/scripts/atlas_signal_review_tool.mjs` | preexisting / Atlas WIP | Atlas signal worker | Validate retryable disabled-ingest handling, then commit or revert in Atlas lane. | Low/Medium |

## First Next Action

If continuing this repo immediately:

```bash
cd /Users/masa/projects/AMD/amd-os
git fetch origin main --prune
git status -sb --untracked-files=all
git rev-list --left-right --count HEAD...origin/main
curl -fsS https://amd-os-pwa.vercel.app/api/build-info
```

Then resolve the dirty bundles above one lane at a time. The MS design amount WIP is the closest to the current MS topic, but it is not part of the already deployed card-removal guard.

## Closeout Decision

`do not archive` for the whole checkout while the five unrelated dirty files remain.

This MS card regression lane itself is complete: accepted work is on `main`, production has `v0.39.13`, current docs forbid the old card shape, and the old trigger wording search is zero.
