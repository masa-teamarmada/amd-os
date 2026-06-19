# SESSION MIGRATION PROMPT - AMD OS Slack persona

```text
cd /Users/masa/projects/AMD/amd-os

まず `HANDOFF.md` を読んで。次に `pwa/spec/3-7-notifications-current-spec.md`、その次に `pwa/BUGS.md` を読んで。続けて `pwa/design/notifications.md`、`gas/DEBUG.md`、`pwa/design_log/sessions_2026-06.md` の最新 `2026-06-19 — えいみ親投稿へのSlackスレッド返信をえいみ名義へ固定` を読んで。

今回の current truth:
- えいみ名義のSlack投稿は、本体GAS `pwaApi runFunc` から `slackNotifyPostToChannelTsukuyomi_(channelId, {text})` を呼ぶ。
- Slack Events / Interactivity の実入口は AMD-Slack GAS `gas-slack/S001_Router.js`。本体GASの `DB_SlackEventLog` に出ない時は、まず `gas-slack/` を見る。
- えいみ親投稿 (`U0ACK22BBDF` / `B0AC42V38ES`) への thread `message` / thread `app_mention` は `replyPersona=eimi` としてえいみが返す。
- つくよみ親投稿 (`U0A663YPJNQ` / `B0A6WQZ5Q4Q`) への返信は `replyPersona=tsukuyomi`。
- AMD-Slack GAS は `@16 v16_eimi_parent_persona_route_cleanup`、本体GAS PWA Web App は `@1495 v1495_eimi_route_cleanup_docs` へdeploy済み。
- テストスレッド `C04QB6F7YPN / 1781786286.688969` で、message相当POSTとapp_mention相当POSTの両方がえいみ返信になることを確認済み。

作業前に必ず:
1. `git fetch origin main`
2. `git status -sb`
3. `git log --left-right --oneline main...origin/main`

注意:
- `gas-slack/` は live AMD-Slack GAS から復元したソース mirror。Slack Events / Interactivity を読む時は本体GASだけでなく、まずここを確認する。
- repo state はこの prompt の記載より `git status -sb` / `git log --left-right --oneline main...origin/main` を優先する。
- もし dirty が残っていたら、対象ごとに stage/commit/carry-forward を分ける。`git add .` と勝手な revert はしない。
```
