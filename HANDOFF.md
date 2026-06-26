# HANDOFF - AMD OS

- Last updated: 2026-06-26 (PWA favicon を Vercel default から AMD mark へ差し替え)
- Canonical root: `/Users/masa/projects/AMD/amd-os`
- PWA root: `/Users/masa/projects/AMD/amd-os/pwa`
- Production URL: `https://amd-os-pwa.vercel.app`
- Default branch: `main`

## Latest Session Summary

- Chrome タブの黒丸三角 (= Vercel default favicon) が残っていた問題を修正。
- `public/favicon.ico` の中身が Vercel default だったため、AMD mark ICO に差し替え、新規 `public/favicon-amd.ico` を追加。
- `src/app/layout.tsx` の metadata icons は `/favicon-amd.ico` を優先する。旧 `/favicon.ico` も同一 AMD payload。
- 恒久仕様は `pwa/design/SPEC_pwa.md`、再発防止は `pwa/BUGS.md`、作業ログは `pwa/design_log/sessions_2026-06.md` の 2026-06-26 エントリへ同期済み。
- 詳細 commit: `daa44ea3 fix(pwa): replace default favicon with AMD mark`。その後の別作業 commit `a26c460e` / `25b69730` にもこの変更は含まれる。

## Repo / Deploy State

- Local branch: `main`
- Local HEAD / `origin/main`: `25b69730 fix(pwa): rebuild management score guards`
- Favicon commit: `daa44ea3`
- Production `/api/build-info` at closeout: `v0.34.29` / `25b69730409426e70804836f253b4785a742db07` / `dirty=false`
- Production favicon proof:
  - HTML links: `/favicon-amd.ico` for `shortcut icon` and `icon`.
  - `/favicon-amd.ico` and `/favicon.ico`: 32426 bytes, SHA-256 `3d58f56c4c7e2c2a93460156d7652d6b2c953f43c6f36952552822c72f153071`.

## Verification Run

- `npm ci` in clean clone
- `npx tsc --noEmit`
- `npm run test:critical-ui`
- `npm run build`
- `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh`
- Production checks: `/api/build-info`, HTML favicon links, favicon file hashes

## Dirty State To Own

Favicon/handoff own files are committed or intentionally staged for this handoff. Remaining dirty is not from the favicon task.

| path / group | status | class | owner guess | resolution action | risk |
|---|---:|---|---|---|---|
| `pwa/design/FEATURE_REGISTRY.md`, `pwa/design/L2_DATA.md`, `pwa/design/meeting_summaries.md`, related `manual/` / `spec/` / scheduled-task SKILL diffs | `M` | other-worker | H-1 / L6 meeting flow worker | send back to that worker; do not mix into favicon closeout | medium: docs/spec drift if abandoned |
| `pwa/scheduled-tasks/amd-os-l6-meeting-prep-worker/outbox/*.md` | `??` | other-worker / local artifact | L6 meeting prep worker | decide commit as sanitized review artifact vs move/remove | medium: stale prep artifacts confuse next H-1 run |
| `pwa/scripts/update_drive_file.mjs`, `pwa/src/app/api/meeting-assets/replace/[assetId]/route.ts` | `??` | other-worker | meeting-assets replacement worker | send back to owner for commit or explicit carry-forward | medium: half-added API/helper route |
| `gas-slack/.clasp.json` | `??` | deploy-link-local / unknown | GAS/Slack owner or quarantine owner | decide track vs local exclude vs safe remove; do not print contents | low-medium: accidental local-link commit risk |

Dirty buckets:
- safe to remove after approval: none identified by this worker.
- send back to owner: H-1/L6 meeting flow docs, L6 prep outbox, meeting-assets replace route/helper.
- needs Masa decision: `gas-slack/.clasp.json` owner/handling if no GAS/Slack owner claims it.

## Unresolved Tasks

1. Favicon task: none. It is on `main`, deployed, and production-verified.
2. Existing carry-over from other workers:
   - H-1 / L6 meeting flow doc and scheduled-task diffs need their owner closeout.
   - L6 meeting prep outbox artifacts need owner decision.
   - Meeting-assets replacement API/helper needs owner closeout.
   - `gas-slack/.clasp.json` needs GAS/Slack owner or quarantine decision.

## Read First Next Session

1. `HANDOFF.md`
2. `pwa/design/SPEC_pwa.md`
3. `pwa/BUGS.md`
4. `pwa/design_log/sessions_2026-06.md`
5. `pwa/CLAUDE.md`
6. `pwa/AGENTS.md`

## First Next Action

```sh
cd /Users/masa/projects/AMD/amd-os
git fetch origin main
git status -sb --untracked-files=all
git log --left-right --oneline main...origin/main
curl -fsS https://amd-os-pwa.vercel.app/api/build-info
```

Expected: local `main` and `origin/main` align at or after `25b69730`; production build stamp is at or after `25b69730`; favicon HTML still points to `/favicon-amd.ico`.

## Guardrails

- Do not use `git add .`; stage named files only.
- Do not overwrite or revert dirty files from other workers while closing favicon/handoff.
- Favicon source of truth: `pwa/public/favicon-amd.ico` and `pwa/public/favicon.ico` should have identical AMD mark payload.
- For future PWA production-bound changes, use a clean tracked state and `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh`.
