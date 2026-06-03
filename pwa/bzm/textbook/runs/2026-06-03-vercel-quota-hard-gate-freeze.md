# Vercel Quota Hard Gate Freeze

Date: 2026-06-03 JST

Scope:
- Apply the emergency Vercel deploy quota hard gate.
- Override old worker close gates that assumed push/deploy on every completed change.
- Do not push this update while the quota freeze is active.
- Stop the old "deploy once after quota recovery" retry rule.

## Executive verdict

Vercel quota protection now overrides the old `commit -> push -> deploy` close gate.

The current state is:

- State: `Active / Vercel quota freeze`
- Production deploy: prohibited
- Pushes that may trigger Vercel auto-deploy: prohibited
- Pushes to preview-targeted branches are also prohibited when they may trigger Vercel auto-deploy
- Worker output: local build/test/check, local commit if useful, then handoff
- Required wording for withheld push/deploy: `withheld due to Vercel quota gate`
- Quota recovery: does not authorize deploy by itself

## Why

Textbook and OS work produced many small changes, and each `main` push triggered a full Vercel build/deploy. This consumed the daily 100-deploy quota and stopped development for 24 hours.

This is now treated as a critical delivery blocker.

## Rule

Do not deploy for:

- wording changes;
- markdown edits;
- CSS polish;
- micro UI adjustments;
- individual worker output.

Do not push to a branch or `main` when that push may trigger a Vercel deployment, unless it is part of an approved deploy bundle.

Do not auto-retry deploy after quota recovery. Quota recovery only makes deploy technically possible again; it does not approve deploy.

## Worker close gate override

Old close gate:

`build -> commit -> push -> deploy`

New close gate during freeze:

`local build/test/check -> local commit if useful -> no push/deploy -> handoff as withheld due to Vercel quota gate`

## Deploy bundle requirement

Before any push/deploy that can trigger Vercel, prepare a bundle summary:

- bundle name;
- included changes;
- excluded changes;
- local verification;
- planned deploy count;
- push target;
- rollback plan;
- production/staging inspection plan.

Only after approval, do one push/deploy bundle. The expected deploy count should normally be one.

## Script guard

`pwa/scripts/deploy.sh` now refuses to run unless:

`AMD_OS_VERCEL_DEPLOY_APPROVED=1`

This guards manual production deploys. It does not by itself stop Git-connected Vercel auto-deploys, so push discipline remains required.

## Current handoff

This rule update is local-only for now.

Push/deploy is withheld due to Vercel quota gate.

## Verification

- `git diff --check`: passed.
- manual deploy script guard: passed. `bash pwa/scripts/deploy.sh` exits before calling Vercel unless `AMD_OS_VERCEL_DEPLOY_APPROVED=1` is set.
- push/deploy: withheld due to Vercel quota gate.
