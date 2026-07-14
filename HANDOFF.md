# AMD OS Handoff

Last updated: 2026-07-14 JST
Target: `/Users/masa/projects/AMD/amd-os`
Topic: SX `SolvioraX経営会議` W-Prep 起動漏れの復旧と再発防止

## Current Truth

- 2026-07-14 11:00 JST の `SolvioraX経営会議` は recurring Calendar 予定として存在し、DB row も `source_kinds='upcoming'` で作成済みだったが、visible prep thread が未起動だった。
- 手動復旧済み。thread `SolvioraX経営会議 prep` は `/Users/masa/projects/AMD/SX` target で作成・pin 済み。DB readback は `prep_worker_status='ready'`、session id `019f5c0a-049a-73c0-a424-679689934c33`、prep draft 保存済み。
- 根本原因は「月曜夜にできた予定」ではない。Calendar recurring 予定も、スプシ正本の `CFG_PJAlias: SolvioraX -> SX` / `CFG_ColorPJHistory: 2025-06-01+ colorId=4 -> SX` も既に存在した。W-Prep がその正本を必ず使う契約になっていなかった。
- active automation `/Users/masa/.codex/automations/w-prep-launch/automation.toml` は更新済み。Calendar direct-scan のPJ推定は `CFG_ColorPJHistory` first、`CFG_PJAlias` next、`SolvioraX` / `colorId=4` は SX/p21 と明記した。
- AMD OS 側は `calendar-sync` alias mirror に `p21: ["SolvioraX"]` を追加し、critical UI guard、spec/manual、L2_DATA、scheduled-tasks README、BUGS、design_log、appendix changelog を同期済み。`BUILD_VERSION` は `v3.39.67`。

## Repo State

- Closeout bundle before commit started from `main` at `4a7e2720`, `origin/main` aligned, no local unpushed commits.
- This handoff is part of the closeout bundle. Exact final commit / production build-info must be taken from `git log -1 --oneline` and `https://amd-os-pwa.vercel.app/api/build-info` after deploy.
- Repo-local dirty expected before closeout commit: only the SX/W-Prep bundle and this handoff/migration prompt. External automation files under `/Users/masa/.codex/automations/w-prep-launch/` are repo-external and tracked by automation memory, not git.
- Closeout inventory found stale `.claude/worktrees` / `claude/*` branches that are main-aligned safe deletion candidates. They were not created by this session; final closeout response should state whether they were removed or left pending by Masa decision.

## Verification

- `git diff --check` passed.
- `npm --prefix /Users/masa/projects/AMD/amd-os/pwa run test:critical-ui` passed.
- `npx tsc --noEmit --pretty false` passed.
- `npm run build` passed in `/Users/masa/projects/AMD/amd-os/pwa`.
- DB readback for `upcoming:7k11p8g6rs5lf9jhtfcvglnn1d_20260714T020000Z`: `ready`, `prep_draft_len=2415`.

## Unresolved Tasks

- No known unresolved task for the 2026-07-14 `SolvioraX経営会議` prep itself.
- Next W-Prep run should be watched once to confirm `SolvioraX` / `colorId=4` no longer lands in unmapped skip. If it does, inspect the live automation prompt and CalendarRepo read path first.

## First Next Action

1. Run `git fetch origin main`, `git status -sb`, `git log -1 --oneline`, and production `/api/build-info`.
2. Confirm the latest main contains `v3.39.67` and `p21: ["SolvioraX"]`.
3. If another SX recurring prep is missing, do not assume Calendar creation timing. Check `CFG_ColorPJHistory`, `CFG_PJAlias`, active W-Prep prompt, then the DB row’s `prep_worker_status`.

## Pointers

- Meeting flow spec: `pwa/spec/3-3-meeting-flow-current-spec.md`
- L2 routine manual: `pwa/manual/8-3-l2-extraction-routines-spec.md`
- L2_DATA writer table: `pwa/design/L2_DATA.md`
- Scheduled task index: `pwa/scheduled-tasks/README.md`
- Incident record: `pwa/BUGS.md`
- Session log: `pwa/design_log/sessions_2026-07.md`
- Active W-Prep config: `/Users/masa/.codex/automations/w-prep-launch/automation.toml`
- W-Prep memory: `/Users/masa/.codex/automations/w-prep-launch/memory.md`

## Guardrails

- `w-prep-launch` must not treat DB upcoming rows alone as complete. It must Calendar-scan the same 7-day window.
- Calendar PJ mapping order for W-Prep is color history first, alias second, fallback project names last.
- `SolvioraX経営会議` must not be unmapped-skipped when either `SolvioraX` title alias or `colorId=4` after `2025-06-01` is present.
- PWA production changes go through `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash /Users/masa/projects/AMD/amd-os/pwa/scripts/deploy.sh`; do not use direct `npx vercel deploy`.
