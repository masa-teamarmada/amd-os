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
| `meeting_notifications` | `*` | 100 |
| `l2_feedbacks` | `*` | 200 |
| `projects` | `project_id, project_name` | all |

UI は `open` / `unread` / `answered` / `feedback` で絞り込み、展開時に `read_at` を楽観更新する。

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
| `meeting_id` | no | related `meeting_notifications` |
| `feedback_text` | comment yes | free text |
| `action` | no | `yes` / `no` / `comment` |

## Kind 別採否

| l2_kind | yes | no |
|---|---|---|
| `member_knowledge` | `member_knowledge.status='active'` | `status='rejected'` |
| `project_knowledge` | `project_knowledge.status='active'` | `status='rejected'` |
| `protocols` | `protocols.status='confirmed'` | `status='rejected'` |
| `meeting_summary` | meeting summary re-extraction / confirmation path | reject / feedback |
| `project_registry_diff` | allowlist 済み patch のみ apply | `project_registry_diffs.status='rejected'` |
| `xrl_evidence` | `project_xrl_evidence.status='confirmed'` | `status='rejected'` |
| `founding_members` | `project_founding_members.status='active'` | `status='invalid'` |
| `project_strategy_signal` | `project_strategy_signals.status='confirmed'` | `status='rejected'` |

すべての action は `l2_feedbacks` に保存し、`tsukuyomi_learnings` にも通知回答として残す。

## 禁止事項

- candidate を通知表示しただけで正本反映しない。
- allowlist 外の DB patch を自動適用しない。
- source refs が弱い候補を「はい」なしで confirmed にしない。

## Failure Mode

| failure | response / behavior |
|---|---|
| unauthenticated | 401 |
| non-admin | 403 / page notFound |
| unknown l2_kind | 400 |
| Supabase update error | 500 with error message |
| meeting_summary yes re-extract failure | 502 |
| immediate re-extract failure | feedback insert は成功、console warning |

## Validation

- `/notifications` は non-admin で表示されない。
- `comment` は `l2_feedbacks` だけ増え、候補 status を変えない。
- `yes` / `no` は対象 table の status 遷移と `l2_feedbacks.feedback_text` prefix (`[はい]` / `[いいえ]`) を確認する。

## 再構築可能性チェック

この章で通知一覧、採否 API、status 遷移の主要 contract は再構築できる。まだ不足しているのは `applyApprovedNotification()` 内の `project_registry_diff` allowlist patch 詳細と、meeting summary re-extraction の同期確認 contract。
