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

展開時の詳細欄は、kind ごとに正本テーブルを lazy fetch して表示する。個別 fetch が未実装、または候補行が通知作成後に移動/統合されて見つからない場合でも、「DB未反映」と断定せず、通知本文を fallback 詳細として表示する。D-11 `news_mention` は `project_media_mentions` を `metadata_json.source_url` / `occurred_on` / title fallback で引き、保存済みの掲載行を表示する。

`l2_notifications.saved_count >= total_count` かつ `total_count > 0` の通知は、すでに正本保存済みとみなし、UI の肯定ボタンを「はい・確認済み」と表示する。保存済み通知の yes feedback は、追加反映ではなく確認・学習フィードバックとして扱う。ただし `coverage_gap` は例外。候補行 (`l2_coverage_gaps`) が保存済みでも、まさの採否判断は未完了なので、`saved_count` に関係なく「経営ハイライトに追加 / 見送る」等の判断ボタンとして表示する。2026-07-16 以降の coverage gap 通知 writer は `saved_count=0,total_count=1` で作る。

`project_config_gap` は通知一覧に残さず、dashboard の抽出状況へ集約する。`source_cache.collected_at` は根拠の保存証跡であり、connector監視の実行周期ではない。抽出状況は保存証跡と `project_meeting_summaries.source_kinds` から得るMTG抽出での利用時刻を分ける。対応事項は未読かつ未dismissの `connector_auth`、PJ台帳の設定不足、ログイン中管理者の Calendar 接続エラーだけに限定し、保存時刻の古さで接続障害を断定しない。

## 通知レーン

`/notifications` は、既存の未対応 / 未読 / 回答済みタブを残したまま、表示中の通知を `critical` と `normal` に分ける。

| lane | 表示名 | 意味 | 代表例 |
|---|---|---|---|
| `normal` | 通常通知 | OSに新データが入った、候補が増えた、通常レビューが必要 | L2候補、MTGサマリ、VCニュース、通常の raw_data_gap |
| `critical` | 緊急性の高い通知 | まさが見落とすと事故る復旧・ガードレール・重要 blocker | `connector_auth`、Notion再認証、high以上の経営ガードレール、明示criticalの要対応、重要 automation blocker |

実装は `pwa/src/lib/notification-priority.ts`。2026-06-26 時点では DB migration を増やさず、既存列から導出する。
PWA の右下ポップアップは `pwa/src/components/notifications/CriticalRealtimeNotify.tsx` が担当し、`critical` と判定された未読の `app_notifications` / `l2_notifications` / `meeting_notifications` を Realtime + 10秒pollで拾う。`/notifications` の一覧・採否 UI は従来通りで、ポップアップは緊急通知を見落とさないための入口に限定する。L2 のポップアップは `/notifications?notification_id=...` に遷移し、通知ページは対象rowを追加取得・自動展開する。MTG 通知は本文中に緊急語があっても `normal` 固定で、緊急扱いが必要な場合は `connector_auth` / `guardrail_match` / `contract_signals` 等の専用通知として別発火させる。

| source | 判定材料 |
|---|---|
| `app_notifications` | `kind='connector_auth'` は常に `critical`。`meta.priority/severity/urgency/notification_priority/notification_channel/risk_level` が `critical` / `urgent` / `blocker` 等なら `critical`。title/body/meta reason に再認証・blocker・事故・緊急・期限超過等の運用緊急語がある場合も `critical`。 |
| `l2_notifications` | 明示 `notification_priority='critical'`、または `metadata_json` の priority/severity/reason/blocker_kind 等に期限超過 / blocker / 再認証 / 緊急等の運用緊急語がある場合は `critical`。その他の L2 候補は `normal`。`l2_kind` / `importance >= 8` / title / summary だけでは `critical` にせず、契約予兆・総会/役会・D-11メディア掲載も通常レビューに残す。 |
| `meeting_notifications` | 常に `normal`。MTGサマリは一次記録なので、NDA / 契約 / 法務 / SHA / COI / 再認証 / blocker 等の語が含まれても右下ポップアップにはしない。緊急扱いが必要なものは `connector_auth` / `guardrail_match` / `contract_signals` 等の専用通知で出す。 |

将来 DB で固定する場合の設計案: `app_notifications.notification_priority` / `l2_notifications.notification_priority` / `meeting_notifications.notification_priority` を `text check in ('normal','critical') default 'normal'` で追加し、writer が明示する。後方互換のため、空なら同じ導出関数で補完する。

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
| `textbook_insight` | `textbook_insight_candidates.status='approved'`。その後 local applier が `pwa/bzm/*.md` へ追記 | `status='rejected'` |
| `coverage_gap` | `l2_coverage_gaps.review_status='confirmed'`。`proposed_target_l2='strategy_signal'` は同時に `project_strategy_signals.status='confirmed'` を upsert し、`l2_coverage_gaps.routed_to='project_strategy_signals:<signal_id>'` を保存 | `review_status='rejected'` |
| `action_item` | `action_items.review_status='confirmed'`。保存済み候補を確認済みにして dashboard / cockpit の要対応面へ出す | `review_status='rejected'` |
| `guardrail_match` | `guardrail_matches.status='acknowledged'` | `status='dismissed'` |

すべての action は `l2_feedbacks` に保存し、`tsukuyomi_learnings` にも通知回答として残す。
`coverage_gap` は「確認してから手作業で別L2へ入れる」通知ではない。安全に自動ルートできる `proposed_target_l2` は「はい」の同一トランザクション相当の処理で下流テーブルへ反映し、未対応の target は `routed_to` が空のまま残して設計 gap として扱う。

PWA の `coverage_gap` 表示は、検知器の内部語をそのまま出さない。カードタイトルは「重要メモに残す？: ...」に統一し、詳細欄は「会議メモにあった話」「いまの要約で目立たない話」「残すとどうなる？」だけを表示する。UI 表示では `D-6` / `coverage_gap` / `raw transcript` / `元情報` / `取りこぼし` / `条件付き投資家関心` / `薄い` / `candidate` / `salience` を使わない。「重要メモに残す」は内部的には D-6 `project_strategy_signals` への追加だが、まさ向けには「あとで見返す重要メモ」と説明する。H-1要約本文の復元ではない。

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
| meeting_summary yes re-extract failure | 502 |
| immediate re-extract failure | feedback insert は成功、console warning |

## Validation

- `/notifications` は non-admin で表示されない。
- `/notifications` は OS通知と L2/MTGレビューをそれぞれ「緊急性の高い通知」「通常通知」に分ける。
- critical 未読通知は `/notifications` の表示に加えて右下ポップアップにも出る。
- `connector_auth` は `critical` に入り、通常レビュー候補は `normal` に入る。
- MTGサマリ本文に NDA / 契約 / 法務 / SHA / COI / 再認証 / blocker 等があっても `critical` にならない。必要な緊急通知は `connector_auth` / 明示 `notification_priority='critical'` / 期限超過 / blocker 等で出す。
- L2候補は「要対応」というラベルや high importance だけでは `critical` にならない。期限超過 / blocker / 明示 critical の場合だけ右下ポップアップ対象にする。
- `?notification_id=` / `?meeting_id=` で開いた通知は、最新100件に含まれない場合も追加取得して表示し、自動展開する。
- `comment` は `l2_feedbacks` だけ増え、候補 status を変えない。
- `yes` / `no` は対象 table の status 遷移と `l2_feedbacks.feedback_text` prefix (`[はい]` / `[いいえ]`) を確認する。

## 再構築可能性チェック

この章で通知一覧、normal/critical レーン、採否 API、status 遷移の主要 contract は再構築できる。まだ不足しているのは `applyApprovedNotification()` 内の `project_registry_diff` allowlist patch 詳細と、meeting summary re-extraction の同期確認 contract。
