# HANDOFF - AMD OS PWA

- Last updated: 2026-05-29 (codex handoff)
- Topic: OSマニュアル検索 + つくよみ Manual Q&A + production rollback 復旧
- Canonical root: `/Users/masa/projects/AMD/amd-os`
- PWA root: `/Users/masa/projects/AMD/amd-os/pwa`
- Production URL: `https://amd-os-pwa.vercel.app`
- Feature commit: `c06cdd6 Add searchable manual and manual Tsukuyomi Q&A`
- Current branch at handoff: `feat/bzm-textbook`
- Production alias note: parallel deploys moved the alias during handoff. Last inspected at 2026-05-29 16:47 JST: `dpl_EcWatpieftJpQJSBAGjzxFF5Zirh` (`https://amd-os-qsfx93eva-armada0130.vercel.app`), Ready, aliased to production. Re-run `vercel inspect` before treating a deploy ID as current truth.

## Latest Summary

- Manual search is implemented on `/manual` and `/manual/[slug]`. `manual-data.ts` builds search documents from `pwa/manual/*.md`; `manual-search.ts` scores titles, summaries, headings, body text, paths, and table-like identifiers.
- `ManualTsukuyomiFloat` is page-local to the manual routes. The global visible mascot remains removed.
- `POST /api/manual/tsukuyomi/ask` is authenticated, read-only, and uses Gemini 2.5 Flash with manual text context. It does not write DB rows, update projects, or save `tsukuyomi_chat_logs`.
- Answer UX now includes `ここ見たらOK` chapter links, Tsukuyomi non-keigo tone, high-school-level explanations, and protected code display for identifiers such as `monthly_reports`.
- The temporary disappearance of the float was caused by a clean GitHub `main` auto deploy overwriting an earlier dirty direct deploy. `c06cdd6` is now pushed to `origin/main`, so clean deploys include the feature.
- Detailed session log: `pwa/design_log/sessions_2026-05.md` の「2026-05-29 (#95)」。

## Verification / Deploy

- `npx tsc --noEmit` pass.
- `npm run build` pass.
- Chrome authenticated verification confirmed search input, float visibility, L2 answer quality, reference links, no polite phrases, no `この抜粋`, and underscore preservation.
- `c06cdd6` pushed to `origin/main`.
- Latest alias inspect: `npx vercel inspect https://amd-os-pwa.vercel.app --scope armada0130` -> `dpl_EcWatpieftJpQJSBAGjzxFF5Zirh` Ready.
- 未確認: authenticated DOM check after this latest `dpl_EcWat...` alias update. The same feature commit is on `origin/main` and current branch, and user confirmed the restored float immediately before handoff.

## Repo State

- Current branch: `feat/bzm-textbook`
- Feature commit: `c06cdd6` is present on `main`, `origin/main`, and the current branch.
- Unpushed commits at handoff start: none.
- Worktree is dirty with broad parallel BZM/IP/ERS/L2/cockpit/payment/manual work. Do not revert or stage blindly.
- Handoff/docs files changed for this handoff should be staged selectively, not with `git add .`.

## Open Tasks

- No known blocker for Manual search / Manual Q&A.
- If production loses the manual float again, check Vercel alias history before changing code.
- If editing Manual Q&A next, verify `/manual` with an authenticated browser and ask `L2データってなに？`.

## First Read Next Session

1. `HANDOFF.md`
2. `pwa/design/os_manual.md`
3. `pwa/design/SPEC_pwa.md`
4. `pwa/design/FEATURE_REGISTRY.md`
5. `pwa/BUGS.md`
6. `pwa/design_log/sessions_2026-05.md`
7. `pwa/src/app/(app)/manual/ManualTsukuyomiFloat.tsx`
8. `pwa/src/app/api/manual/tsukuyomi/ask/route.ts`
9. `pwa/src/app/(app)/manual/manual-search.ts`

## First Next Action

```sh
cd /Users/masa/projects/AMD/amd-os
git fetch --all --prune
git status -sb
npx vercel inspect https://amd-os-pwa.vercel.app --scope armada0130
```

Then only if needed, browser-check `/manual` and test the Manual Q&A prompt `L2データってなに？`.
