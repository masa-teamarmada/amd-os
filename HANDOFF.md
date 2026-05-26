# HANDOFF - AMD OS

- Last updated: 2026-05-25
- Topic: OS manual UX overhaul for team sharing
- Canonical root: `/Users/masa/projects/AMD/amd-os`
- PWA root: `/Users/masa/projects/AMD/amd-os/pwa`
- HEAD at handoff: `ad2e621`

## Latest Summary

- AMD OS manual is now ready for team sharing as a first pass.
- `/manual` uses a persistent left sidebar: top is the same book-like global TOC on every page, bottom is the category menu.
- The right side of `/manual` no longer shows a map, category home, or category chapter cards. It starts from the book-like `セクション別目次`.
- Manual numbering is display-time `sectionIndex-chapterIndex`: user side examples are `1-1 AMD OS とは`, `2-2 メンバーの日常ワークフロー`, `4-2 AMD Score 詳細仕様`.
- Manual H1/H2 rendering is normalized so stale source prefixes like `10.1` / `21.1` do not appear in the UI.
- User-facing and developer-facing manual surfaces are separated by `audience`; developer view is `/manual?audience=developer`.
- Details are in `pwa/design_log/sessions_2026-05.md` entries `#85` and `#87`.

## Current Live Facts

- Production URL: `https://amd-os-pwa.vercel.app/manual`
- Latest production deployment for the category-card removal:
  - Deployment URL: `https://amd-os-4pl6v5l6d-armada0130.vercel.app`
  - Deployment ID: `dpl_C5jkkV7CXKZrN2boKFsZvYxnkZ1E`
- Earlier manual book-numbering deploy:
  - Deployment URL: `https://amd-os-3uygkoaqw-armada0130.vercel.app`
  - Deployment ID: `dpl_HoRyyvqHxrMGWPH5GkbEuCu2ZKVn`

## Repo State

- Worktree is dirty and broad. Do not revert unrelated changes.
- Current manual UX files touched this session:
  - `pwa/src/app/(app)/manual/ManualMapClient.tsx`
  - `pwa/src/app/(app)/manual/manual-chapters.ts`
  - `pwa/src/app/(app)/manual/manual-data.ts`
  - `pwa/src/app/(app)/manual/page.tsx`
  - `pwa/src/app/(app)/manual/[slug]/page.tsx`
  - `pwa/scripts/check_pwa_critical_ui.cjs`
  - `pwa/design/os_manual.md`
  - `pwa/design/README.md`
  - `pwa/CLAUDE.md`
  - `pwa/design_log/sessions_2026-05.md`
- Many other PWA/GAS/iOS files are already modified from the long concurrent session. Inspect before editing or committing.
- This handoff was not committed because the worktree contains many unrelated pre-existing changes.

## First Read Next Session

1. `HANDOFF.md`
2. `pwa/HANDOFF_pwa_rebuild.md`
3. `pwa/design/os_manual.md`
4. `pwa/design/README.md`
5. `pwa/design/SPEC_pwa.md`
6. `pwa/BUGS.md`
7. `pwa/design_log/sessions_2026-05.md` entries `#85`, `#87`, and `#88`

## First Next Action

1. Run `git status --short`.
2. Open `https://amd-os-pwa.vercel.app/manual` in the logged-in browser and visually confirm the team-facing manual starts with the left global TOC + right `セクション別目次`.
3. If team feedback comes in, update `pwa/design/os_manual.md`, implementation, `check_pwa_critical_ui.cjs`, and append a new `design_log` entry.

## Open Tasks

- Gather team feedback on the manual UX and wording.
- Optional visual pass: production Chrome verification after hard refresh. Code/build/deploy verification passed, but a previous Chrome visual check was interrupted by active-tab switching.
- Commit strategy is unresolved because the worktree has broad unrelated changes. Before any commit, split manual UX changes from concurrent work.
- Previous raw-data/L2 automation work is not reverified in this manual handoff. See `pwa/design_log/sessions_2026-05.md #86` if continuing that line.

## Verification Commands Run This Session

- `git diff --check`
- `npm --prefix pwa run test:critical-ui`
- `npm --prefix pwa run build`
- `vercel --prod --yes` from repo root
- Node-level manual rendering check for user/developer numbering and normalized H1/H2 output
