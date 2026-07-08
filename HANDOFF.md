# AMD OS Handoff

Last updated: 2026-07-08 JST
Target: `/Users/masa/projects/AMD/amd-os`
Topic: D-10 Member Activity Evidence / MyPage「今週やったこと」修正 closeout

## Summary

See `pwa/design_log/sessions_2026-07.md` section:
- `2026-07-08 — D-10 Member Activity Evidence を Codex automation 合成へ移管`

- `/mypage` の「今週やったこと」に、メール本文冒頭、HTMLタグ、`meeting_id=upcoming... runner_surface=...` のような runner marker が表示されていた原因を特定した。
- 原因は、PWA 側の背景 Anthropic を封鎖した後、D-10 route の fallback synthesis が `snippet` をそのまま title にして保存していたこと。
- D-10 は `GET ?mode=evidence` で根拠を返し、Codex automation `amd-os-l2-2` が活動文を合成し、`POST /api/cron/member-weekly-activities` で `raw_metadata.synthesis_method='codex'` として保存する方式へ変更済み。
- legacy `interactive=1` GET 一発実行は、今後は保存しない。古い launcher やボタンが後から fallback row で上書きしないための安全策。
- 本番の今週分データは手動で再合成・保存済み。`member_activities(source='member_weekly')` の現行週 22 row はすべて `synthesis_method=codex`、既知の悪い文字列パターンは 0 件。

## Current Truth

- Canonical repo: `/Users/masa/projects/AMD/amd-os`
- Branch: `main`
- Accepted D-10 implementation commit: `0910a201b895792e5195553cf2e7234119fd2c29` (`Move D-10 synthesis to Codex automation`)
- Closeout start HEAD / origin/main: `3e3494c3fb96c372d848906c09359af6b0094b1f` (`Fix RLS on Eimi Slack usage log`)
- Production build-info observed during closeout:
  - `build_version`: `v0.39.7`
  - `git_sha`: `3e3494c3fb96c372d848906c09359af6b0094b1f`
  - `git_branch`: `main`
  - `dirty`: `false`
- Worktree registry: one registered worktree only, `/Users/masa/projects/AMD/amd-os [main]`.
- Local branch inventory: `main` only.
- Local main vs origin/main at closeout start: ahead `0`, behind `0`.

## Verification Already Run

D-10 implementation verification:

```bash
npm run lint -- src/app/api/cron/member-weekly-activities/route.ts src/lib/operations-catalog.ts
npx tsc --noEmit --pretty false
npm run build
git diff --check
AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh
curl -fsS https://amd-os-pwa.vercel.app/api/build-info
```

Production smoke:

```bash
GET /api/cron/member-weekly-activities?interactive=1&memberId=ID001&maxMessages=1&save=0
GET /api/cron/member-weekly-activities?mode=evidence&interactive=1&memberId=ID001&maxMessages=1
```

Observed:
- legacy direct GET returned `disabled:true`, `saved:0`.
- evidence mode returned evidence groups without Anthropic synthesis.
- Current week DB cleanup: total `22`, `synthesis_method=codex` `22`, bad-pattern count `0`.

## Design Records

- Current spec: `pwa/spec/3-1-l2-data-extraction-current-spec.md`
- Automation responsibility: `pwa/spec/5-3-automation-responsibility-current-spec.md`
- Codex migration truth: `pwa/spec/5-8-l1-l3-codex-migration-current-spec.md`
- User/dev manual: `pwa/manual/3-2-data-and-extraction.md`, `pwa/manual/6-1-operations-settings-spec.md`, `pwa/manual/8-3-l2-extraction-routines-spec.md`
- MyPage design: `pwa/design/mypage.md`
- Operations catalog: `pwa/src/lib/operations-catalog.ts`
- Changelogs: `pwa/spec/6-1-appendix-changelog.md`, `pwa/manual/9-3-appendix-changelog.md`
- Bug/lesson: `pwa/BUGS.md` entry `[pwa/D-10] MyPage「今週やったこと」にメール本文・HTML・runner marker が表示された`
- Session log: `pwa/design_log/sessions_2026-07.md`

## Open Risks / Next Checks

1. `/mypage` の「いますぐ抽出」ボタンは、現時点では古い refresh route から legacy GET を呼ぶため、D-10を直す導線としては機能しない。次に直すなら、ボタンを Codex automation / request queue に接続する。`ALLOW_PWA_LLM_CRONS=1` で route synthesis を復活させない。
2. Windows MMO の旧 Task Scheduler launcher を復活させる場合も、`interactive=1` GET 一発実行ではなく Mac と同じ `mode=evidence` -> Codex合成 -> POST 保存へ更新する。
3. `/Users/masa/projects/AMD/amd-os` には今回の D-10 とは別の unstaged 変更 `pwa/scripts/atlas_signal_review_tool.mjs` がある。内容は Atlas ingest disabled 時に outbox へ残す retryable exit を追加する差分。D-10 handoff では触らない。

## First Next Action

If continuing D-10 / MyPage work:

```bash
cd /Users/masa/projects/AMD/amd-os
git fetch origin main --prune
git status -sb --untracked-files=all
git rev-list --left-right --count HEAD...origin/main
curl -fsS https://amd-os-pwa.vercel.app/api/build-info
rg -n "member-weekly-activities|weekly-activities/refresh|mode=evidence|synthesis_method" pwa/src pwa/spec pwa/manual pwa/design
```

Then update `/mypage` manual refresh so it requests the D-10 Codex automation path instead of invoking legacy GET synthesis.

## Closeout Decision

`do not archive` for the whole repo checkout until the unrelated Atlas dirty file is either committed by its owner or intentionally reverted/removed by an approved cleanup pass.

D-10 itself is complete: implementation is on `main`, production includes it, current-week bad data is repaired, and D-10 spec/manual/design/BUGS/design_log are synchronized.
