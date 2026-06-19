# HANDOFF - AMD OS

- Last updated: 2026-06-19 (closeout cleanup / Slack persona GAS mirror / PWA guard fixes)
- Canonical root: `/Users/masa/projects/AMD/amd-os`
- Production URL: `https://amd-os-pwa.vercel.app`
- Default branch: `main` only. Do not create branches for normal worker closeout.

## Current Truth

- Canonical checkout is the work root again. If it is dirty, classify each path and either commit, carry forward with owner/reason, or leave only with an explicit blocker.
- `gas-slack/` is the repo mirror of the live AMD-Slack GAS entrypoint. Slack Events / Interactivity debugging should read `gas-slack/S001_Router.js` before assuming the main GAS event log is the source of truth.
- Eimi parent Slack posts reply as Eimi; Tsukuyomi parent Slack posts reply as Tsukuyomi. Parent persona is detected from thread history and routed as `replyPersona=eimi|tsukuyomi`.
- PWA closeout bundle includes the member-link boundary helper and MS schedule pre-start anchor guard. Build stamp target for this bundle is `v0.28.7`.
- The Ehime University Seeds OS proposal draft lives under `pwa/proposals/` as an internal proposal artifact.

## Read First Next Session

1. `AGENTS.md`
2. `CLAUDE.md`
3. `pwa/AGENTS.md`
4. `pwa/CLAUDE.md`
5. `SESSION_MIGRATION_PROMPT.md`
6. `pwa/spec/3-7-notifications-current-spec.md`
7. `pwa/spec/3-10-l2-ms-progress-current-spec.md`
8. `pwa/spec/4-2-amd-score-current-spec.md`
9. `pwa/manual/4-3-amd-score-spec.md`
10. `pwa/design_log/sessions_2026-06.md`

## Next Action

```sh
cd /Users/masa/projects/AMD/amd-os
git fetch origin main
git status -sb
git log --left-right --oneline main...origin/main
```

Expected closeout state: clean worktree, `main` aligned with `origin/main`, and production `/api/build-info` on the pushed SHA after `pwa/scripts/deploy.sh` completes.

## Guardrails

- Never use `git add .`.
- Do not revert dirty files you did not create. Work with them or commit/carry-forward explicitly.
- Public `/bzm` text must not expose internal project names or real people unless already approved for that public surface.
- For PWA code changes, bump `pwa/src/lib/build-info.ts` before deploy.
