# Static Reader for Draft Review

Date: 2026-06-03 JST

Scope:
- Stop using production PWA deployments as the default Textbook draft review surface.
- Create a standalone HTML reader for smartphone-style draft reading.
- Keep production deployment for deliberate release checkpoints only.

## Executive verdict

Textbook is still a draft, so routine prose polish should not be pushed through production PWA deployment just so Masa can read it.

The new default review surface is a standalone horizontal reader:

`pwa/bzm/textbook/reader/textbook-reader.html`

It is generated from:

`pwa/bzm/public-manuscript/*.md`

## Reader behavior

The reader:

- embeds the current public manuscript into a single HTML file;
- uses horizontal scroll snap for page-like side swiping;
- works as a standalone file without the PWA app shell;
- keeps progress in local storage;
- has a chapter selector;
- has font-size control;
- is designed for smartphone reading.

Generator:

`pwa/bzm/textbook/reader/generate-reader.mjs`

Command:

`node pwa/bzm/textbook/reader/generate-reader.mjs`

## Deployment policy

Draft review:

- Use the standalone HTML reader.
- Do not deploy production for every wording change.

Production PWA:

- Deploy only at deliberate release checkpoints.
- Deploy once, then inspect routes.
- Do not retry repeatedly when Vercel quota is blocked.

## Related deploy gate

This pairs with:

`pwa/scripts/vercel_ignore_build.mjs`

That script skips Git-triggered Vercel builds for docs/Textbook-only changes, so small manuscript edits do not consume deployment quota.

## Verification

- Reader generation succeeded.
- Generated file size: about 263 KB.
- `npm run build`: passed after Vercel ignore configuration.
- Playwright file rendering check on a 390 x 844 mobile viewport passed.
- Rendered page count: 80.
- First H1 detected: `Prologue: その一文は、少しだけ強すぎた`.
- Initial progress displayed as `1 / 80`.
- Next-page button advanced progress to `2 / 80`.
