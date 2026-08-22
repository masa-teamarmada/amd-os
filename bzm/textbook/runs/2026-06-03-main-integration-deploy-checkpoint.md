# Main Integration Deploy Checkpoint

Date: 2026-06-03 JST

Worker: Textbook commander / deploy checkpoint

Scope:
- Confirm the post-integration `main` state.
- Attempt one production deploy checkpoint only.
- Do not retry deployment after a quota blocker.
- Do not edit public manuscript body.

## Executive verdict

The Textbook story baseline is integrated into `main`, but production deployment is blocked by the Vercel daily deployment quota.

Current `main` contains:
- Prologue-to-Epilogue narrative polish.
- Field Toolkit A/B/C reference-mode cleanup and visual distinction.
- Method Appendix M0 through M8.
- Public notation rewrite.
- Ch16 and Ch19 optional Model Note prototypes.
- All related run notes and `COMMANDER_TASKS.md` updates.

Local release gate passed before the `main` push. Production deploy did not pass because the Vercel account/project is over the daily deployment limit.

## Main state confirmed

Confirmed after `HEAD:main` push:
- `HEAD`: `3fd31fa74310b1750d4f1c8d5495c3a6a5f1a534`
- `origin/main`: `3fd31fa74310b1750d4f1c8d5495c3a6a5f1a534`
- Latest commit: `3fd31fa docs(textbook): audit final publication readiness`
- `git log --branches --not --remotes --oneline`: empty
- Worktree: clean on `codex/textbook-full-story-final-readthrough-polish`

Manifest consistency after push:
- missing public manuscript markdown: `[]`
- unlisted public manuscript markdown: `[]`

## Build gate

Command before `main` push:

`cd pwa && npm run build`

Result:
- passed.
- Existing warning: `middleware` file convention deprecated.

This was sufficient for main integration because the branch had already merged current `origin/main` and the public manuscript manifest was consistent.

## Deploy checkpoint

Command attempted once from repo root with the existing Vercel project identifiers:

`VERCEL_ORG_ID=team_s2MXGfgBuLbRgl3G0TWtN5np VERCEL_PROJECT_ID=prj_raZW3HSKIszzPUwNTHfy7xDGzLHm npx vercel deploy --prod --yes`

Result:

Deployment failed with Vercel quota blocker:

`Resource is limited - try again in 24 hours (more than 100, code: "api-deployments-free-per-day").`

No further deploy retry was attempted.

## Deployment status

Deploy status:
- `main`: updated.
- Production: not updated by this checkpoint.
- Reason: Vercel daily deployment quota exceeded.

This is not a code/build blocker. It is an external deployment quota blocker.

## Next action

When the quota recovers, run one deliberate deploy checkpoint and then inspect:
- `/bzm/public`
- `/bzm/public/25-epilogue`
- `/bzm/public/22-field-note-safety-loop`
- `/bzm/public/26-method-how-to-read-the-model`
- one formula-heavy Method Appendix page, especially M5.

Do not retry repeatedly. If production inspection cannot be done, use an env-complete local/staging environment and record the route inspection result.

## Acceptance gate

This checkpoint is complete because:
- main integration is confirmed;
- local build passed;
- manifest consistency passed;
- deploy was attempted once as a release checkpoint;
- quota blocker was recorded;
- no retry loop was started.
