# SESSION MIGRATION PROMPT - AMD OS management guardrails / critical notifications closeout

```text
cd /Users/masa/projects/AMD/amd-os

まず `HANDOFF.md` を読んで。次に `pwa/spec/3-7-notifications-current-spec.md`、`pwa/spec/3-15-management-guardrails-current-spec.md`、`pwa/BUGS.md`、`pwa/design_log/sessions_2026-06.md` の「2026-06-27 - 経営ガードレール実装と緊急通知の誤爆停止」を読んで。その次に `pwa/manual/3-3-notifications-and-tsukuyomi.md`、`pwa/manual/8-2-notification-review-and-strategy-signals-spec.md`、`pwa/design/notifications.md`、`pwa/CLAUDE.md` / `pwa/AGENTS.md` を読んで。

作業開始前に必ず:
1. `git fetch origin main`
2. `git status -sb --untracked-files=all`
3. `git log --left-right --oneline main...origin/main`
4. `curl -fsS https://amd-os-pwa.vercel.app/api/build-info`

current truth:
- functional base before the handoff-doc commit は `132d5aae fix(pwa): restore initiative crisis threshold`。production `/api/build-info` は `v0.34.31` / `132d5aaec9151deb1d1bad48375f98e81c54715e` / `dirty=false` だった。
- この handoff bundle は manual/spec が production-visible なため `pwa/src/lib/build-info.ts` を `v0.34.32` に bump している。closeout後は `git log -1 --oneline` と production `/api/build-info` を見て最新 SHA を確認する。
- 経営ガードレールは実装済み: migration `154_management_guardrails.sql`、`pwa/src/lib/management-guardrails.ts`、`POST /api/guardrails/evaluate`、`/api/notifications/feedback`、初期 guardrail card 10件。
- 通知は通常通知と緊急通知に分離済み。緊急通知は右下ポップアップに出る。
- 最終 critical rule:
  - `connector_auth` は critical。
  - `metadata_json.notification_priority='critical'` や metadata 上の blocker / 期限超過 / 再認証は critical。
  - high/critical の `guardrail_match` は critical。
  - `meeting_notifications` は常に normal。
  - `l2_notifications` は `l2_kind`、`importance`、title、summary だけでは critical にしない。
  - 契約、総会、取締役会、NDA、法務、D-11メディア掲載、high importance L2 は通常レビューに残す。
- ポップアップから L2 通知へ飛ぶ時は `/notifications?notification_id=...`。通知ページは対象rowが最新100件から漏れていても追加取得して自動展開する。
- closeout直前の live unread check では final priority logic で `app=0 / L2=0 / MTG=0` critical unread。

repo state:
- checkout には大量の unrelated dirty が残る前提。H-1 / meeting assets / venture map / admin / cockpit / finance / management-score / task-notification 系のWIPを、この通知/guardrail作業に混ぜない。
- `git add .` は使わない。
- 既存dirtyを勝手に revert / checkout / clean しない。
- mixed hunks があるファイルは guardrail/critical-notification hunk だけを stage する。

次にやること:
1. まさがまた右下の「緊急通知」誤爆を見たら、まず live row の source table と metadata を見る。MTG/L2 の title/body keyword scanning は復活させない。
2. 経営ガードレールを続けるなら、`pwa/spec/3-15-management-guardrails-current-spec.md` から guardrail card 管理UI、PJ/MTG/action の自動タグ付け UI、protocol から guardrail card への昇格フローを進める。
3. 通知priorityをさらに固めるなら、3通知テーブルへ `notification_priority text default 'normal'` を追加し、writer 明示値を一次ソースにする migration を検討する。
4. PWA deploy が必要なら main push = Vercel auto deploy。直接 `npx vercel deploy` は禁止。

注意:
- MTG本文や L2本文の「事故」「blocker」「再認証」などの語は、緊急性の根拠にしない。
- `contract_signals` / `shareholder_meeting` / `action_item` kind だけで critical にしない。
- raw Gmail / Slack / Notion transcript や secret を handoff / outbox / chat に貼らない。
```
