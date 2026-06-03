# Cloudflare Pages Draft Reader Prep

Date: 2026-06-03 JST

Scope:
- Prepare Cloudflare Pages deployment for the Textbook draft reader.
- Do not use Vercel.
- Do not require production PWA deployment.

## Executive verdict

Cloudflare Pages is the right target for Textbook draft review because it avoids Vercel deployment quota entirely.

However, Cloudflare cannot be completed in this session because no Cloudflare account/login exists yet.

Status:

- State: `Blocked by Masa`
- Reason: Cloudflare account creation/login required.
- Not blocked by code.

## Prepared

Added:

- `pwa/bzm/textbook/reader/deploy-cloudflare-pages.mjs`
- `pwa/bzm/textbook/reader/README.md`

Existing reader:

- `pwa/bzm/textbook/reader/generate-reader.mjs`
- `pwa/bzm/textbook/reader/textbook-reader.html`

Prepared local publish directory during the attempt:

- `/private/tmp/textbook-draft-pages/index.html`

## How to continue after Cloudflare account exists

Run:

```bash
npx wrangler login
```

Then:

```bash
node pwa/bzm/textbook/reader/deploy-cloudflare-pages.mjs
```

Expected result:

- Cloudflare Pages project: `textbook-draft`
- Draft URL: `https://textbook-draft.pages.dev`

Custom domain can be added later:

- `textbook-draft.team-armada.jp`

## Verification

- `npx wrangler --version`: `4.97.0`
- `npx wrangler whoami`: not authenticated, but exits `0`; deploy helper now checks output text instead of exit code only.
- Wrangler OAuth was attempted and then cancelled after confirming no Cloudflare account exists yet.
- Reader file was prepared for Pages upload.
- Deploy helper now exits before attempting Pages deploy when Wrangler is not authenticated.

## Operating rule

Do not fall back to Vercel for this draft reader.

Textbook draft hosting should use Cloudflare Pages once account setup is complete.
