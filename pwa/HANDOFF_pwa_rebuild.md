# HANDOFF - AMD OS PWA

- Last updated: 2026-05-29 (codex handoff)
- Topic: マニュアル sidebar 復旧 + コックピット MTGサマリ手動編集 + 議事録 narrative 固定 + `/mtg-minutes` skill
- Canonical root: `/Users/masa/projects/AMD/amd-os`
- PWA root: `/Users/masa/projects/AMD/amd-os/pwa`
- Production URL: `https://amd-os-pwa.vercel.app`
- HEAD before this handoff update: `0ff8a9f` (`fix(pwa): enforce narrative meeting minutes format`)
- Latest functional commits: `f2947fa`, `6c83fd5`, `170b731`, `0ff8a9f`

## Latest Summary

- `/manual/[slug]` は `ManualMapClient` を使う構造に戻し、章を開いても左のメニューが消えない。
- コックピット MTG詳細では「つくよみに修正依頼」を出さず、「議事録を手動修正」から `POST /api/meeting-summary/manual-update` で表示用フィールドを直接更新する。
- `project_meeting_summaries.narrative_md` は議事録本文の正本。`summary_short` / `decided` / `progress` / `next_actions` / `risks` は補助であり、本文を箇条書きへ戻さない。
- `narrative_md` の見出しは `## 🎯背景` → `## 📊経緯` → `## ✅決まったこと` → `## ▶️次の一手` → `## ⚠️残課題` に固定。L2⑥ routine と `/api/dialogue-meeting/narrate` の prompt / guard / manual に反映済み。
- repo外のローカル Codex skill `/Users/masa/.codex/skills/mtg-minutes` を追加。まさは `/mtg-minutes` にメモ、Notion URL、ページタイトルなどを添えて議事録化を呼べる。
- 詳細ログ: `pwa/design_log/sessions_2026-05.md` 末尾「2026-05-29 (#92) — Codex セッション / マニュアル sidebar 復旧 + MTGサマリ手動修正 + 議事録 narrative 固定 + /mtg-minutes skill」。

## Verification / Deploy

Run and observed:

- `npm run test:critical-ui` pass
- `npx tsc --noEmit --pretty false` pass
- Clean worktree verification also passed for `test:critical-ui` and `tsc --noEmit`
- PWA production deploy済み:
  - Deployment: `https://amd-os-9cvi9iswi-armada0130.vercel.app`
  - Inspect: `https://vercel.com/armada0130/amd-os-pwa/GzCtmNY6VwVxJYSsgK5t3GhWQpfV`
  - Deployment id: `dpl_GzCtmNY6VwVxJYSsgK5t3GhWQpfV`
  - Production alias: `https://amd-os-pwa.vercel.app`
- `curl -I -L https://amd-os-pwa.vercel.app/manual/2-3-pj-cockpit` は login へ 307 redirect、`next=/manual/2-3-pj-cockpit` 保持を確認。

## Repo State

- Branch: `main`
- Local HEAD / origin/main: `0ff8a9f` synced before this handoff doc update.
- Worktree is dirty with unrelated/unresolved parallel work. Do not revert or mix without re-reading context.
- Known unrelated dirty areas at handoff time include:
  - `docs/ip/*.docx` / `docs/ip/*.md`
  - Manual search / manual Tsukuyomi work: `pwa/src/app/(app)/manual/*`, `pwa/src/app/api/manual/*`
  - Weekly recurring upcoming MTG changes: `pwa/src/app/api/meeting-prep/calendar-sync/route.ts`, `pwa/src/components/cockpit/CockpitMeetingSummary.tsx`, parts of `pwa/design/meeting_summaries.md`, `pwa/scheduled-tasks/amd-os-l6-meeting-extract/SKILL.md`, `pwa/scripts/check_pwa_critical_ui.cjs`
  - L2① monthly report automation work: `pwa/scheduled-tasks/amd-os-l1-monthly-report-extract/`, `pwa/manual/8-3-l2-extraction-routines-spec.md`, `pwa/design/L2_DATA.md`, `pwa/src/lib/operations-catalog.ts`
  - Current worktree `pwa/src/lib/build-info.ts` shows `v0.8.6`, but committed/deployed HEAD for this handoff topic is `v0.8.5`.

## Open Tasks

- No unresolved code task for the manual sidebar or MTG narrative format commits.
- `/mtg-minutes` is local to this Mac under `/Users/masa/.codex/skills/mtg-minutes`; if a different machine needs it, copy/install the skill there too.
- Slash-skill discovery may require a new Codex thread or app reload before `/mtg-minutes` appears in the UI.

## First Read Next Session

1. `HANDOFF.md`
2. `pwa/HANDOFF_pwa_rebuild.md`
3. `pwa/design/SPEC_pwa.md`
4. `pwa/design/meeting_summaries.md`
5. `pwa/manual/2-3-pj-cockpit.md`
6. `pwa/manual/8-3-l2-extraction-routines-spec.md`
7. `pwa/BUGS.md`
8. `pwa/design_log/sessions_2026-05.md`

## First Next Action

```sh
cd /Users/masa/projects/AMD/amd-os
git fetch --all --prune
git status -s
git log --branches --not --remotes --oneline
```

Then continue from the user's next request. If it touches MTG summaries, preserve `narrative_md` as the primary artifact and avoid reintroducing Tsukuyomi correction UI in the MTG detail modal.
