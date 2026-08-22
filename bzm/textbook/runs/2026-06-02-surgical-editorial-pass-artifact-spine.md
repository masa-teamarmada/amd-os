# Textbook surgical editorial pass artifact spine

Date: 2026-06-02 JST

Worker: `Textbook surgical editorial pass artifact spine`

Branch: `codex/textbook-surgical-editorial-pass-artifact-spine`

Base: `8252cd2 docs(textbook): apply artifact spine p0 rewrite`

## Purpose

Apply the P0 cold-reader follow-up as a surgical editorial pass after the artifact-spine rewrite. This pass keeps the current scenes, tension, and traveling artifacts intact while removing the remaining navigation and structure debt before another cold-reader review.

## Inputs

- `pwa/bzm/textbook/PUBLICATION_POSITIONING.md`
- `pwa/bzm/textbook/COMMANDER_TASKS.md`
- `pwa/bzm/textbook/runs/2026-06-02-public-manuscript-artifact-spine-p0-rewrite.md`
- `origin/codex/textbook-cold-reader-review-artifact-spine-p0:pwa/bzm/textbook/runs/2026-06-02-cold-reader-review-artifact-spine-p0.md`
- Current public manuscript `00` through `24`
- Public manuscript route manifest `pwa/src/app/(app)/bzm/public/public-manuscript.ts`

## Changed Files

- `pwa/bzm/public-manuscript/03-support-can-isolate-researchers.md`
- `pwa/bzm/public-manuscript/04-gap-vc-ceo-function.md`
- `pwa/bzm/public-manuscript/05-before-disclosure.md`
- `pwa/bzm/public-manuscript/11-macro-tailwinds-as-conditions.md`
- `pwa/bzm/public-manuscript/12-readiness-axes.md`
- `pwa/bzm/public-manuscript/13-founder-readiness-field-language.md`
- `pwa/bzm/public-manuscript/14-institution-as-nursery.md`
- `pwa/bzm/public-manuscript/21-institution-readiness-as-nursery.md`
- `pwa/bzm/public-manuscript/24-institution-nursery-checklist.md`
- `pwa/src/app/(app)/bzm/public/public-manuscript.ts`
- `pwa/bzm/textbook/COMMANDER_TASKS.md`

## Surgical Fixes

| Debt | Fix |
|---|---|
| Ch04/Ch05 filename-title semantic order | Renamed `04-before-disclosure.md` to `04-gap-vc-ceo-function.md` and `05-gap-vc-ceo-function.md` to `05-before-disclosure.md`; updated the public manuscript manifest so route slugs and reader-facing titles match the chapter order. |
| Public route / TOC stopped at Ch14 | Added Ch15-21 as the theory part and Ch22-24 as `Toolkit — 実務道具` in the public manuscript manifest. Toolkit numbering uses A/B/C to keep those files from reading as ordinary body chapters. |
| Visible scaffolding | Replaced `後半の理論への橋`, `Chapter 8との違い`, `この章では`, repeated `会議を閉じる前に残すもの`, and a few mechanical chapter-end labels with reader-facing headings. |
| Toolkit A/B/C placement | Kept H1s as Toolkit A/B/C, tightened Toolkit C's opening around first-90-days pilot use, and shifted Ch24 away from re-explaining the nursery theory. |
| Ch14/21/24 overlap | Ch14 now sets the problem and layer separation, Ch21 keeps the model/operation split including unknown vs not_started, and Ch24 focuses on checklist / pilot charter use. |

## Build / Deploy

Route manifest code changed, so `npm run build` was run. This worktree initially had no `pwa/node_modules`, so `npm ci` was run first from the existing lockfile.

No deploy was performed. This branch is a worker follow-up and no public-release decision was requested.

## Verification

- `npm run build`: passed.
- `git diff --check`: passed.
- conflict marker scan: no hits.
- Public manuscript forbidden-term scan: no hits for `AMD|Team ARMADA|株式会社チームアルマダ|まさ|AMD OS|L2|candidate|local applier|routing|pwa/|/spec|正本|司令塔|worker|スタパ|文字起こし|Vercel|Supabase`.
- Old template scan: no hits for `明日使える問い|明日できる小さな行動`.
- Changed public manuscript files: each has exactly one H1.
- Public manuscript manifest consistency: no missing markdown files and no unlisted public manuscript markdown files.
- Old Ch04/Ch05 slugs scan in public manuscript and public route files: no hits.
- `git diff --cached --check`: pending until final staging.
