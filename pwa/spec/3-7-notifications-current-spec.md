# Notifications / 採否ゲート仕様

> **この章は何か**: `/notifications` と `POST /api/notifications/feedback` の current contract。L2 候補は「はい」で初めて正本反映される。

## 画面

| route | file | auth |
|---|---|---|
| `/notifications` | `pwa/src/app/(app)/notifications/page.tsx` | admin only (`members.is_admin`) |

server page は以下を取得して `NotificationsClient` に渡す。

| source | select | limit |
|---|---|---|
| `l2_notifications` | `*` | 100 |
| `l2_feedbacks` | `*` | 200 |
| `projects` | `project_id, project_name` | all |

UI は `open` / `unread` / `answered` / `feedback` で絞り込み、展開時に `read_at` を楽観更新する。

## 通知にしないもの

通知は、まさが読んだあとに採否・復旧・確認・再試行などの具体アクションを取れるものだけにする。単なる作成ログ、既に別の正本 row に保存済みで読む以外の行動がないもの、担当者本人へ nudge すべきものは OS通知にしない。

| kind / source | 扱い |
|---|---|
| `app_notifications.kind='task_created'` | 廃止。task row 作成は `tasks` / caller response / 必要なら同一セッション内報告で扱う。 |
| `app_notifications.kind='meeting_action'` | 廃止。次MTGアクションは `meeting_action_items` と次回MTGカードに置き、担当者が解決できる場合だけ Slack nudge / 完了APIへ寄せる。 |
| `meeting_notifications` の議事録作成通知 | 廃止。議事録 / MTGサマリ作成は `project_meeting_summaries` / PJ cockpit / MTGカードで扱い、OS通知には出さない。誤り修正は cockpit の手動修正導線へ寄せる。 |

DB 側でも migration 155 の `skip_non_actionable_app_notifications` trigger がこの2 kind の insert を捨てる。これは未デプロイの古い writer や外部 caller が残っていても、非アクション通知を増やさないための防御。
`meeting_notifications` も migration 156 の `skip_meeting_summary_notifications` trigger が insert と writer upsert update を捨てる。既存行は read/notified 済みに倒し、PWA の一覧・未読バッジ・critical poll からも外す。

## 通知レーン

`/notifications` は、既存の未対応 / 未読 / 回答済みタブを残したまま、表示中の通知を `critical` と `normal` に分ける。

| lane | 表示名 | 意味 | 代表例 |
|---|---|---|---|
| `normal` | 通常通知 | OSに新データが入った、候補が増えた、通常レビューが必要 | L2候補、VCニュース、通常の raw_data_gap |
| `critical` | 緊急性の高い通知 | まさが見落とすと事故る復旧・ガードレール・重要 blocker | `connector_auth`、Notion再認証、high以上の経営ガードレール、明示criticalの要対応、重要 automation blocker |

実装は `pwa/src/lib/notification-priority.ts`。2026-06-26 時点では DB migration を増やさず、既存列から導出する。
PWA の右下ポップアップは `pwa/src/components/notifications/CriticalRealtimeNotify.tsx` が担当し、`critical` と判定された未読の `app_notifications` / `l2_notifications` を Realtime + 10秒pollで拾う。`/notifications` の一覧・採否 UI は従来通りで、ポップアップは緊急通知を見落とさないための入口に限定する。L2 のポップアップは `/notifications?notification_id=...` に遷移し、通知ページは対象rowを追加取得・自動展開する。MTG本文中に緊急語があっても議事録作成通知は出さず、緊急扱いが必要な場合は `connector_auth` / `guardrail_match` / `contract_signals` 等の専用通知として別発火させる。

| source | 判定材料 |
|---|---|
| `app_notifications` | `kind='connector_auth'` は常に `critical`。`meta.priority/severity/urgency/notification_priority/notification_channel/risk_level` が `critical` / `urgent` / `blocker` 等なら `critical`。title/body/meta reason に再認証・blocker・事故・緊急・期限超過等の運用緊急語がある場合も `critical`。 |
| `l2_notifications` | 明示 `notification_priority='critical'`、または `metadata_json` の priority/severity/reason/blocker_kind 等に期限超過 / blocker / 再認証 / 緊急等の運用緊急語がある場合は `critical`。その他の L2 候補は `normal`。`l2_kind` / `importance >= 8` / title / summary だけでは `critical` にせず、契約予兆・総会/役会・D-11メディア掲載も通常レビューに残す。 |
| `meeting_notifications` | 廃止済み。議事録作成通知は作らず、PWA通知にも数えない。緊急扱いが必要なものは `connector_auth` / `guardrail_match` / `contract_signals` 等の専用通知で出す。 |

将来 DB で固定する場合の設計案: `app_notifications.notification_priority` / `l2_notifications.notification_priority` を `text check in ('normal','critical') default 'normal'` で追加し、writer が明示する。後方互換のため、空なら同じ導出関数で補完する。

## API

| method | path | file |
|---|---|---|
| GET | `/api/notifications/feedback` | `pwa/src/app/api/notifications/feedback/route.ts` |
| POST | `/api/notifications/feedback` | same |

認証:

- Supabase auth session 必須。
- `members.email = user.email` で member を引く。
- `is_admin` でない場合 403。

POST body:

| field | required | meaning |
|---|---|---|
| `l2_kind` | yes | kind。allowed list 以外は 400 |
| `target_id` | yes | project_id / code_name 等 |
| `scope_key` | no | default `global` |
| `notification_id` | no | related `l2_notifications` |
| `meeting_id` | no | legacy meeting feedback 用。新規の議事録作成通知は作らない。 |
| `feedback_text` | comment yes | free text |
| `action` | no | `yes` / `no` / `comment` |

## Kind 別採否

| l2_kind | yes | no |
|---|---|---|
| `member_knowledge` | `member_knowledge.status='active'` | `status='rejected'` |
| `project_knowledge` | `project_knowledge.status='active'` | `status='rejected'` |
| `protocols` | `protocols.status='confirmed'` | `status='rejected'` |
| `meeting_summary` | legacy feedback 記録のみ。新規通知は作らない | feedback 記録 |
| `project_registry_diff` | allowlist 済み patch のみ apply | `project_registry_diffs.status='rejected'` |
| `xrl_evidence` | `project_xrl_evidence.status='confirmed'` | `status='rejected'` |
| `founding_members` | `project_founding_members.status='active'` | `status='invalid'` |
| `project_strategy_signal` | `project_strategy_signals.status='confirmed'` | `status='rejected'` |
| `textbook_insight` | `textbook_insight_candidates.status='approved'`。その後 local applier が `pwa/bzm/*.md` へ追記 | `status='rejected'` |
| `guardrail_match` | `guardrail_matches.status='acknowledged'` | `status='dismissed'` |

すべての action は `l2_feedbacks` に保存し、`tsukuyomi_learnings` にも通知回答として残す。

## 禁止事項

- candidate を通知表示しただけで正本反映しない。
- allowlist 外の DB patch を自動適用しない。
- source refs が弱い候補を「はい」なしで confirmed にしない。
- `textbook_insight` は「はい」だけで git 管理ファイルを本番 runtime から編集しない。追記は local applier / commit / push 経路に限定する。

## Failure Mode

| failure | response / behavior |
|---|---|
| unauthenticated | 401 |
| non-admin | 403 / page notFound |
| unknown l2_kind | 400 |
| Supabase update error | 500 with error message |
| legacy meeting_summary feedback | feedback 記録のみ。新規 meeting notification は作らない |
| immediate re-extract failure | feedback insert は成功、console warning |

## Validation

- `/notifications` は non-admin で表示されない。
- `/notifications` は OS通知と L2レビューをそれぞれ「緊急性の高い通知」「通常通知」に分ける。
- critical 未読通知は `/notifications` の表示に加えて右下ポップアップにも出る。
- `connector_auth` は `critical` に入り、通常レビュー候補は `normal` に入る。
- 議事録本文に NDA / 契約 / 法務 / SHA / COI / 再認証 / blocker 等があっても議事録作成通知は出さない。必要な緊急通知は `connector_auth` / 明示 `notification_priority='critical'` / 期限超過 / blocker 等で出す。
- L2候補は「要対応」というラベルや high importance だけでは `critical` にならない。期限超過 / blocker / 明示 critical の場合だけ右下ポップアップ対象にする。
- `?notification_id=` で開いた通知は、最新100件に含まれない場合も追加取得して表示し、自動展開する。`?meeting_id=` は legacy link として受け取るが、新規 meeting notification は表示しない。
- `comment` は `l2_feedbacks` だけ増え、候補 status を変えない。
- `yes` / `no` は対象 table の status 遷移と `l2_feedbacks.feedback_text` prefix (`[はい]` / `[いいえ]`) を確認する。

## 再構築可能性チェック

この章で通知一覧、normal/critical レーン、採否 API、status 遷移の主要 contract は再構築できる。まだ不足しているのは `applyApprovedNotification()` 内の `project_registry_diff` allowlist patch 詳細と、meeting summary re-extraction の同期確認 contract。
