# HANDOFF - AMD OS

- Last updated: 2026-06-27 (経営ガードレール実装 / 緊急通知の誤爆停止 closeout)
- Canonical root: `/Users/masa/projects/AMD/amd-os`
- PWA root: `/Users/masa/projects/AMD/amd-os/pwa`
- Production URL: `https://amd-os-pwa.vercel.app`
- Default branch: `main`

## Latest Session Summary

- SX x 三浦工業 MTG をきっかけに、設立前SHA・大企業入口設計・NDA前開示・PoCデータ許諾のような経営ノウハウを、忙しい時でも OS が先回り検知する「経営ガードレール」として設計・実装した。
- `guardrail_tag_definitions` / `guardrail_cards` / `guardrail_matches` / `guardrail_feedbacks` と `POST /api/guardrails/evaluate` を追加し、初期 guardrail card 10件を seed した。
- 通知は通常通知と緊急通知に分け、まさ要望どおり緊急通知は右下ポップアップにした。
- その後、MTGサマリや L2 通常レビューが「緊急通知」に誤爆したため、critical 判定を明示 metadata / connector_auth / guardrail priority に限定した。
- `meeting_notifications` は常に normal。`l2_notifications` は `l2_kind` / `importance` / title / summary だけでは critical にしない。
- 詳細ログ: `pwa/design_log/sessions_2026-06.md` の「2026-06-27 - 経営ガードレール実装と緊急通知の誤爆停止」。

## Repo / Deploy State

- Local branch: `main`
- Functional base before this handoff-doc commit: `132d5aae fix(pwa): restore initiative crisis threshold`
- `origin/main` before this handoff-doc commit: `132d5aae fix(pwa): restore initiative crisis threshold`
- Production before this handoff-doc commit: `/api/build-info` = `v0.34.31` / `132d5aaec9151deb1d1bad48375f98e81c54715e` / `dirty=false`
- This handoff bundle bumps PWA build version to `v0.34.32` because manual/spec content is production-visible.
- Unrelated dirty state remains large and intentional. Do not use `git add .`, `git checkout --`, `git reset --hard`, or broad cleanup.
- If this file is at `HEAD`, the latest commit is the handoff/docs closeout commit. Re-check `git log -1 --oneline` and production `/api/build-info` before claiming current deployment truth.

## Verification Run

- Priority rules tested:
  - MTG with `blocked by reauthentication`: `normal`
  - D-11 media high importance: `normal`
  - shareholder/board kind only: `normal`
  - contract kind only: `normal`
  - connector auth: `critical`
  - explicit guardrail critical metadata: `critical`
  - action item high importance: `normal`
  - action item blocker only in summary: `normal`
  - action item blocker in metadata: `critical`
- `npm run --silent lint -- src/lib/notification-priority.ts src/components/notifications/CriticalRealtimeNotify.tsx src/components/notifications/NotificationsClient.tsx src/app/'(app)'/notifications/page.tsx`: passed.
- `npm run test:critical-ui`: passed.
- `npm run build`: passed during the notification-fix sequence before this docs handoff. Full local dirty tree should not be treated as clean proof because many unrelated WIP files remain.
- Live unread check under final priority logic: `app=0 / L2=0 / MTG=0` critical unread.

## Unresolved Tasks

1. Guardrail card 管理UIを作る。
2. PJカード / MTGカード / action 入力時の自動タグ付け UI を作る。
3. protocol から guardrail card を半自動生成する昇格フローを設計する。
4. 経営ガードレールの発火理由・severity を PJ cockpit / MTGカード上で事前確認できる UI を作る。
5. 通知 priority は今は導出関数。将来、3通知テーブルに `notification_priority text default 'normal'` を追加して writer 明示値を一次ソースにする案が残っている。

## Dirty State Notes

- Current checkout includes unrelated WIP in H-1 / meeting assets / venture map / admin / cockpit / finance / management-score / task-notification areas.
- Notification source files may appear dirty locally because other workers are active. This handoff only records the shipped current rule and docs/manual closeout.
- Stage and commit only named files for the current task. If a file contains mixed hunks, stage only the guardrail/critical-notification hunk.

## Read First Next Session

1. `HANDOFF.md`
2. `pwa/spec/3-7-notifications-current-spec.md`
3. `pwa/spec/3-15-management-guardrails-current-spec.md`
4. `pwa/BUGS.md`
5. `pwa/design_log/sessions_2026-06.md`
6. `pwa/manual/3-3-notifications-and-tsukuyomi.md`
7. `pwa/manual/8-2-notification-review-and-strategy-signals-spec.md`
8. `pwa/design/notifications.md`
9. `pwa/CLAUDE.md`
10. `pwa/AGENTS.md`

## First Next Action

```sh
cd /Users/masa/projects/AMD/amd-os
git fetch origin main
git status -sb --untracked-files=all
git log --left-right --oneline main...origin/main
curl -fsS https://amd-os-pwa.vercel.app/api/build-info
```

If まさ sees another right-bottom emergency popup, inspect the live row's source table and metadata first. Do not reintroduce title/body keyword scanning for MTG or L2 rows.

## Guardrails

- Do not make MTG summaries critical based on body text.
- Do not make `l2_notifications` critical from `l2_kind`, `importance`, title, or summary alone.
- Do not treat contract/board/shareholder/NDA topic words as immediate interruption signals.
- Keep connector reauth, explicit blocker/overdue metadata, and high/critical management guardrails as the right-bottom popup lane.
- Do not mix unrelated dirty work into notification/guardrail handoff commits.
