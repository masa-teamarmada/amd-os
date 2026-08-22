# Route / Main Integration Review

Date: 2026-06-03 JST

Worker: Textbook commander / integration gate review

Scope:
- Review the current story polish branch for main integration readiness.
- Merge latest `origin/main` into the story branch.
- Do not push to `main` in this pass.
- Do not deploy.

Branch:
- `codex/textbook-full-story-final-readthrough-polish`

## Executive verdict

The story polish branch is now integration-ready as a branch, but should not be blindly pushed to `main` without one final release-style review.

This branch now contains:

- Prologue-to-Epilogue narrative finish and polish.
- Field Toolkit A/B/C reference-mode content and UI distinction.
- Method Appendix M0 through M8.
- Public notation rewrite.
- Two prototype Model Notes.
- Review/run notes and ledger updates.
- Latest `origin/main` merged into the branch.

The branch has been brought up to date with current `origin/main` and builds locally.

## Main divergence before integration

Before merge:

- `origin/main` had 9 commits not in the story branch.
- The story branch had 32 commits not in `origin/main`.

The main-only commits included PWA deploy gate policy, monthly-report no-activity guard, mojibake cleanup, notification L2 display, and iOS HUD/WebView work.

Because of that divergence, a raw `origin/main..HEAD` diff looked noisy and included non-Textbook iOS/PWA files. That did not mean the story branch intended to revert those files; it meant the branch had not yet incorporated the latest main commits.

## Merge performed

Action performed:

`git merge --no-edit origin/main`

Result:

- Merge completed with the `ort` strategy.
- No manual conflict resolution required.
- Latest main changes are now present in the story branch.
- Branch now has `origin/main` fully included.

Current relation after merge:

- `origin/main...HEAD`: `0 33`
- Meaning: no main-only commits remain outside the branch; the branch is ahead with Textbook/story commits plus the merge commit.

## Build gate

Command:

`cd pwa && npm run build`

Result:

- passed.
- Existing warning: `middleware` file convention deprecated.

The build confirms:

- public manuscript manifest compiles;
- new Method Appendix routes are included in the dynamic public route surface;
- latest main PWA changes and Textbook public manuscript changes can coexist.

## Manifest and route checks

Manifest consistency after merge:

- missing markdown: `[]`
- unlisted public manuscript markdown: `[]`

Relevant route/code changes on this branch:

- `pwa/src/app/(app)/bzm/public/public-manuscript.ts`
  - Epilogue added.
  - Field Toolkit section retained.
  - Method Appendix section added after Field Toolkit.

- `pwa/src/app/(app)/bzm/public/[slug]/page.tsx`
  - Field Toolkit visual distinction retained.

- `pwa/src/app/(app)/bzm/public/PublicManuscriptNav.tsx`
  - Field Toolkit nav distinction retained.

## Deployment gate

Do not deploy from this pass.

Reason:

- Current policy forbids small repeated production deploys.
- This pass is integration review, not final release.
- Local build has passed.
- Production deploy should be bundled with the final `main` integration or a deliberate release checkpoint.

When main integration is performed, the deploy decision should be explicit:

- If this is a release checkpoint, deploy once after main push and inspect.
- If still editing, skip deploy and state `deployなし。理由: quota温存 / integration branch only / local build passed`.

## Risks before main push

### 1. Large public manuscript surface

The branch changes almost every public manuscript chapter, adds an Epilogue, adds Method Appendix M0-M8, and adjusts Toolkit UI. This is intentional, but it means main integration should be treated as a release-sized change.

### 2. Model Note styling is still provisional

Appendix cold-reader review gave conditional pass, but noted that Model Note prose still shows some scaffolding. This is acceptable before main integration, but should remain a P1 post-merge polish item.

### 3. Browser visual check still depends on env

Previous local browser check against the public route failed because that worktree lacked Supabase public env variables and middleware returned 500. Build passes, but rendered inspection of authenticated/middleware-protected public route still needs either:

- proper env in a local dev server; or
- production/staging after a bundled deploy.

### 4. Production deploy quota

Do not retry production deploy repeatedly. If quota blocks, report blocker and keep branch/main state clear.

## Recommended main integration order

1. Reconfirm clean branch state.
2. Reconfirm `origin/main...HEAD` has no left-side commits.
3. Run `npm run build` in `pwa`.
4. Push the branch.
5. Merge or fast-forward the Textbook changes into `main` from this branch.
6. Run `npm run build` again if the integration worktree differs.
7. Push `main`.
8. Decide deploy once:
   - deploy if this is the intended release checkpoint;
   - otherwise no deploy with explicit quota/local-build reason.
9. Run final route/TOC audit after deployment or local env browser check.

## Next actions

1. `main integration execution`
   - Push current branch after this review note.
   - Merge into main in a clean integration worktree.

2. `Method Appendix layout/readability pass`
   - Visual styling for Model Notes and Method Appendix.

3. `Technical notation review`
   - Check formula consistency and simplified notation.

4. `final publication readiness audit`
   - Sales-readiness, route/TOC, narrative fatigue, Toolkit usability, and Method Appendix clarity.
