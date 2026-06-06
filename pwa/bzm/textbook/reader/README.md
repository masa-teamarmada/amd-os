# Textbook Draft Reader

This folder contains the standalone draft reader for the Textbook manuscript.

It is intentionally separate from the AMD OS PWA production surface.

## Local generation

```bash
node pwa/bzm/textbook/reader/generate-reader.mjs
```

Output:

```text
pwa/bzm/textbook/reader/textbook-reader.html
```

The generated HTML is a single-file horizontal swipe reader for smartphone draft reading.

## Cloudflare Pages deployment

Cloudflare is the preferred draft hosting target because it does not consume Vercel deployment quota.

Prerequisite:

```bash
npx wrangler login
```

Deploy:

```bash
node pwa/bzm/textbook/reader/deploy-cloudflare-pages.mjs
```

Default Cloudflare Pages project:

```text
textbook-draft
```

Override:

```bash
TEXTBOOK_PAGES_PROJECT=another-project node pwa/bzm/textbook/reader/deploy-cloudflare-pages.mjs
```

## Current blocker

Cloudflare account/login does not exist yet.

Until Masa creates/logs into Cloudflare, the deploy script can prepare the static files but cannot publish them.

## Operating rule

- Draft reading uses this standalone reader.
- Vercel is not used for Textbook draft review.
- AMD OS PWA production deploy is reserved for deliberate release checkpoints.
