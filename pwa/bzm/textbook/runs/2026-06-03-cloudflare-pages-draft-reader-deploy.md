# Cloudflare Pages Draft Reader Deploy

Date: 2026-06-03 JST

## Executive verdict

The Textbook draft reader is now deployed outside Vercel.

Public URL:

`https://textbook-draft.pages.dev/`

This is the current URL to use on mobile for horizontal draft reading.

## What changed

- Used the existing standalone static reader generated from `pwa/bzm/public-manuscript/*.md`.
- Logged into Cloudflare with Wrangler OAuth.
- Created Cloudflare Pages project `textbook-draft`.
- Deployed `pwa/bzm/textbook/reader/dist/index.html` to Cloudflare Pages production branch `main`.

## Deployment details

- Cloudflare account: `e1faf12f2c2ee933edd26fee6786efc8`
- Project: `textbook-draft`
- Production deployment: `7c718939-1288-46a6-9901-076a4b84c6af`
- Production URL: `https://textbook-draft.pages.dev/`
- Direct deployment URL: `https://7c718939.textbook-draft.pages.dev`
- Earlier preview deployment: `0f38f89e-7fe6-4ecc-b451-4cff2a1f1d4d`

The earlier preview deployment came from a detached `HEAD` branch and is not the canonical reader URL.

## Vercel impact

- `vercel deploy`: not run.
- GitHub push: not run.
- AMD OS PWA production deploy: not touched.
- Vercel quota: not consumed.

## Verification

- `node pwa/bzm/textbook/reader/generate-reader.mjs`: passed.
- Cloudflare Pages project creation: passed.
- Cloudflare Pages production deploy: passed.
- `curl -I -L https://textbook-draft.pages.dev`: HTTP 200.
- Reader content check: Prologue / Before Zero / Field Toolkit / Method Appendix content present in generated HTML.

## Notes

The draft reader is intentionally separate from the PWA. It is for draft reading and mobile review, not for AMD OS production release.

If a cleaner Team ARMADA subdomain is desired, add a Cloudflare Pages custom domain next. Do not use Vercel as a fallback.
