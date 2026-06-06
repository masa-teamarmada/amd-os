# Vercel Ignore Build for Textbook Docs

Date: 2026-06-03 JST

Scope:
- Prevent Textbook/document-only commits from consuming Vercel deployments.
- Keep deliberate CLI/manual deploys available for release checkpoints.

## Executive verdict

The excessive deployment consumption was caused by Git-connected Vercel production builds running on every `main` push, including tiny Textbook markdown edits.

This is now treated as a deploy gate bug, not as a Textbook editing problem.

## Change

Added Vercel `ignoreCommand`:

`node scripts/vercel_ignore_build.mjs`

Added script:

`pwa/scripts/vercel_ignore_build.mjs`

The script exits:

- `0` to skip Vercel build when a Git-triggered deployment changes only docs/Textbook markdown surfaces.
- `1` to continue building when PWA code/config/package/public assets change.
- `1` for non-Git/manual CLI deployments so deliberate release checkpoint deploys can still run.

## Ignored docs/Textbook surfaces

The script skips auto-builds for changes limited to:

- top-level repo docs such as `README.md`, `AGENTS.md`, `CLAUDE.md`;
- `pwa/bzm/textbook/**`;
- `pwa/bzm/public-manuscript/*.md`;
- `pwa/bzm/*.md`;
- `pwa/design/**/*.md`;
- `pwa/design_log/**/*.md`.

## Build-forcing surfaces

The script forces build for:

- `pwa/src/**`;
- `pwa/public/**`;
- `pwa/scripts/vercel_ignore_build.mjs`;
- `pwa/vercel.json`;
- package/lock/config files.

This means manifest/UI/code changes still deploy normally.

## Operating rule

Textbook prose polish may continue to commit/push to `main`, but docs-only pushes should no longer consume Vercel deployment quota.

When manuscript changes should become public, run one deliberate release checkpoint deploy and inspect the route.

## Verification

- `npm run build`: passed.
- `git diff --check`: passed.
- local script test on this commit: build-forcing changes detected, exit `1`.
