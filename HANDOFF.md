# AMD OS Handoff

最終更新: 2026-06-28 JST
対象: `/Users/masa/projects/AMD/amd-os`
トピック: Atlas 通常UIから HUD skin を分離

## いまの結論

- local branch: `main`
- accepted functional fix: `b1564928 fix(pwa): confine hud skin to hud routes`
- production `/api/build-info` checked: `v0.36.23` / `b1564928200b1d7d43ad158205890b69051d4070` / `dirty=false`
- handoff/docs bundle: `v0.36.24` bump を含む。次回は `git rev-parse HEAD origin/main` と production `/api/build-info` を live check する。
- Atlas 通常UIは復旧済み。`/atlas` top tag 色、`/atlas/map` の non-HUD node / label / edge、Dashboard への戻りで HUD skin が残らない挙動をまさが確認済み。

## 今回やったこと

- `/atlas` top の tag chip 色を inline palette で復活。
- `/atlas/map` の canvas drawing を通常 Atlas の domain palette / readable label に戻した。
- HUD Macrotrend 実験画面を `/hud/atlas/macrotrends` に隔離し、通常 `/atlas/macrotrends` は `/atlas/divergence` redirect に戻した。
- shared `(app)` layout から `amd-hud-page-skin` 付与を削除し、HUD skin を `components/hud/HudShell.tsx` 配下の `/hud/*` に限定。
- `pwa/design/atlas.md`、`pwa/manual/4-2-atlas-macrotrend-signal-spec.md`、`pwa/manual/5-2-hud-and-venture-map-spec.md`、`pwa/BUGS.md`、`pwa/design_log/sessions_2026-06.md` に仕様・事故・教訓を同期。

## Verification

- `npx tsc --noEmit --pretty false` 成功。
- `npm run build` 成功。
- deploy script `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh` 成功。
- production `/api/build-info` が `v0.36.22` -> `v0.36.23` と順に一致することを確認。
- 未ログイン Playwright は `/auth/login` まで。ログイン後の目視はまさ側確認で「なおった」。

## Current Truth

- 通常 `/atlas`, `/atlas/map`, `/atlas/divergence`, `/atlas/decisions` は HUD ではない。
- `amd-hud-page-skin` は shared `(app)` layout に置かない。
- HUD 表現、glow、dark shell、HUD nav は `/hud/*` の `HudShell` だけに閉じる。
- 通常 `/atlas/macrotrends` は `/atlas/divergence` へ redirect。HUD 実験版は `/hud/atlas/macrotrends`。

## Unresolved Tasks

1. 次回開始時に production `/api/build-info` が handoff/docs deploy 後の最新 commit / version と一致しているか確認する。
2. ログイン済みブラウザで余裕があれば `/atlas` -> `/atlas/map` reload -> `/dashboard` を再度目視し、HUD skin が残らないことを確認する。
3. mixed dirty は別作業由来が多い。`git add .` は使わず、owner / bundle ごとに分ける。

## Dirty / Untracked Classification

### preexisting / likely other-worker WIP

- notification stop / meeting flow / task notification bundle:
  - `gas/153_MeetingHourlyTrigger.js`
  - `pwa/design/L2_DATA.md`
  - `pwa/design/l2_extract_claude_routine.md`
  - `pwa/design/meeting_summaries.md`
  - `pwa/design/notifications.md`
  - notification/task API and component files
  - migrations `155_skip_non_actionable_app_notifications.sql` / `156_skip_meeting_summary_notifications.sql`
- contract / monthly agreement docs WIP:
  - `output/doc/monthly-work-agreement-outsourcing-contract-draft-20260628.docx`
  - `pwa/proposals/monthly-work-agreement-contract-revision-and-rollout-draft-20260628.md`
  - contract spec/manual dirty files
- Admin/Kiyo / meeting-assets / project-label WIP:
  - `pwa/src/app/(app)/admin/kiyo/page.tsx`
  - `pwa/src/app/api/meeting-assets/replace/[assetId]/route.ts`
  - `pwa/src/lib/project-labels.ts`
  - `pwa/scripts/update_drive_file.mjs`
  - migration `153_project_venture_legacy_name_hygiene.sql`
- H-1 prep outbox markdowns under `pwa/scheduled-tasks/amd-os-l6-meeting-prep-worker/outbox/`.
- local artifact: `gas-slack/.clasp.json`.

扱い: 今回の Atlas/HUD fix とは別bundle。owner へ戻すか cleanup worker で分類。

## First Next Action

1. `HANDOFF.md` -> `pwa/design/atlas.md` -> `pwa/manual/4-2-atlas-macrotrend-signal-spec.md` -> `pwa/manual/5-2-hud-and-venture-map-spec.md` -> `pwa/BUGS.md` の順で読む。
2. `git fetch origin main --prune`、`git status -sb --untracked-files=all`、production `/api/build-info` を確認する。
3. Atlas/HUD に触るなら、通常 route と `/hud/*` route の skin boundary を先に確認する。

## Archive 判定

handoff required。

理由:

- Atlas/HUD fix は main / production に入った。
- ただし repo には preexisting / other-worker dirty と untracked が残っている。
- 今回 bundle 以外を巻き込まず、次 owner が bundle 単位で閉じる必要がある。
