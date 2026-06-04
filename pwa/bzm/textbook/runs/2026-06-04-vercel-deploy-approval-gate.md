# Vercel Deploy Approval Gate

Date: 2026-06-04 JST

## Executive verdict

Vercel deploy is no longer fully frozen, but it is still gated.

Before any Vercel production deploy, preview deploy, or git push that may trigger Vercel auto-deploy, the commander must ask Masa for approval with a deploy bundle.

## Current state

- State: `Active / Vercel deploy approval gate`
- Deploy allowed: yes, only after approval
- Push allowed: yes, only after approval if the push may trigger Vercel
- `askuserquestion` status: not yet requested for the next bundle
- Deploy count after this gate update: 0
- Push withheld: yes, until a deploy bundle is approved

## Required deploy bundle

Every approval question must include:

- included changes;
- excluded changes;
- local build/test/browser verification;
- planned deploy count;
- push/deploy target;
- rollback plan;
- production inspection method.

## Still prohibited

Do not deploy one-off changes for:

- wording;
- markdown;
- minor UI polish;
- light CSS changes;
- comments;
- log wording.

Bundle multiple worker results and deploy once.

## Approval pending handling

If the commander is waiting for Masa approval, record it as `approval pending`.

Do not classify approval wait as an unknown blocker.

## Script guard

`pwa/scripts/deploy.sh` now refuses to run unless:

`AMD_OS_VERCEL_DEPLOY_APPROVED=1`

This keeps manual deploys behind the approval bundle gate.

## Verification

- `git diff --check`: passed.
- conflict marker scan: no hits.
- manual deploy script guard: passed. `bash pwa/scripts/deploy.sh` exits with code 1 before calling Vercel unless `AMD_OS_VERCEL_DEPLOY_APPROVED=1` is set.
- push/deploy: not run.
