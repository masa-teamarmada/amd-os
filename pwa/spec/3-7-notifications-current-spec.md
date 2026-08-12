# Notifications / 採否ゲート仕様

> **この章は何か**: `/notifications` と `POST /api/notifications/feedback` の current contract。通知の主目的は、L2 candidateをOS正本へ採用するか不採用にするかの最終判断。先手TODOと本人作業は [`2-4-proactive-todo-current-spec.md`](2-4-proactive-todo-current-spec.md) へ分ける。

既存 automation id `amd-os-proactive-heartbeat` が未審査candidateを読み、`destination_label`、`changes[]`、`approval_effect`、`rejection_effect`を完成させる。全部揃い、feedback APIに安全な採否処理がある候補だけ `attention_state='approved' AND requires_masa_decision=true` にする。candidateの`status`や正本は、このレビュー段階では変更しない。
通知カードはこの4項目を「反映先 / 追加・更新する情報 / 採用すると / 採用しないと」の順で表示する。`saved_count` はcandidate保存件数であり、採用済み表示の根拠にしない。

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

L2/MTG通知カードは、操作を促す場合に **「確認・反映先」「追加・更新する情報」「この操作の結果」** を同じカード内に表示する。`app_notifications` は `meta.action_contract` の `action_owner/action_required/action_label/action_url/completion_condition/why_now` を正本として、全カードに **「まさがやること」「開く場所」「完了条件」** を表示する。完了報告は `action_owner='none'` で「対応不要」を明示する。追加先や行動が未定義の候補は肯定操作・緊急扱いの根拠にしない。

展開時の詳細欄は、kind ごとに正本テーブルを lazy fetch して表示する。個別 fetch が未実装、または候補行が通知作成後に移動/統合されて見つからない場合でも、「DB未反映」と断定せず、通知本文を fallback 詳細として表示する。D-11 `news_mention` は `project_media_mentions` を `metadata_json.source_url` / `occurred_on` / title fallback で引き、保存済みの掲載行を表示する。ただし `coverage_gap` は例外。元の `l2_coverage_gaps` 行が見つからない場合、汎用 fallback や内部IDを見せず、タイトルを「コピー前に元情報を確認」に変え、「このカードだけではコピー対象を判断できない」と表示して肯定ボタンを disabled にする。

`l2_notifications.saved_count >= total_count` かつ `total_count > 0` の通知は、すでに正本保存済みとみなし、UI の肯定ボタンを「はい・確認済み」と表示する。保存済み通知の yes feedback は、追加反映ではなく確認・学習フィードバックとして扱う。ただし `coverage_gap` は例外。候補行 (`l2_coverage_gaps`) が保存済みでも、まさの採否判断は未完了なので、`saved_count` に関係なく「重要メモにコピー / コピーしない」の判断ボタンとして表示する。2026-07-16 以降の coverage gap 通知 writer は `saved_count=0,total_count=1` で作る。

`project_config_gap` は通知一覧に残さず、dashboard の抽出状況へ集約する。`source_cache.collected_at` は根拠の保存証跡であり、connector監視の実行周期ではない。抽出状況は保存証跡と `project_meeting_summaries.source_kinds` から得るMTG抽出での利用時刻を分ける。対応事項は未読かつ未dismissの `connector_auth`、PJ台帳の設定不足、ログイン中管理者の Calendar 接続エラーだけに限定し、保存時刻の古さで接続障害を断定しない。

## 通知レーン

`/notifications` は、既存の未対応 / 未読 / 回答済みタブを残したまま、表示中の通知を `critical` と `normal` に分ける。

| lane | 表示名 | 意味 | 代表例 |
|---|---|---|---|
| `normal` | 通常通知 | 採否で正本や次の行動が変わる、または本人行動が必要だが即時ではない | approved L2採否、approved本人行動 |
| `critical` | 緊急性の高い通知 | 今見ないと判断機会が閉じる、または本人限定blockerが継続する | 24h以内の明示期限、不可逆な判断窓、直接復旧できるconnector auth |

実装は `pwa/src/lib/notification-priority.ts`。2026-06-26 時点では DB migration を増やさず、既存列から導出する。
PWA の右下ポップアップは `pwa/src/components/notifications/CriticalRealtimeNotify.tsx` が担当し、gateを通った未読の `app_notifications` / `l2_notifications` を Realtime + 10秒pollで拾う。`meeting_notifications` は対象外。`/notifications` の一覧・採否 UI は従来通りで、ポップアップは即時条件を満たす通知の入口に限定する。L2 のポップアップは `/notifications?notification_id=...` に遷移し、通知ページは対象rowを追加取得・自動展開する。

| source | 判定材料 |
|---|---|
| `app_notifications` | 明示priorityや運用緊急語はcritical候補にすぎない。`action_owner!='none'` かつ具体行動・直接URL・完了条件が全部揃う場合だけ `critical`。旧 `connector_auth` は直接の再認証URLがある場合だけ `critical`。 |
| `l2_notifications` | `attention_state='approved' AND requires_masa_decision=true` が前提。importance、title、summary、緊急語だけでは表示もcritical化もしない。 |
| `meeting_notifications` | 通知面・未読数・右下ポップアップの対象外。会議記録としてcockpitに残す。 |

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
| `textbook_insight` / BZM | `metadata_json.destination_kind='bzm_textbook'` の候補を `status='approved'`。その後 local applier が `pwa/bzm/*.md` へ追記 | `status='rejected'` |
| `textbook_insight` / 経営ノウハウ | `metadata_json.destination_kind='management_knowledge'` の候補から、管理 → 経営ノウハウへ本文・分類・成熟度・タグ・再利用する場面を1件保存し候補を `applied` | `status='rejected'` |
| `coverage_gap` | `l2_coverage_gaps.review_status='confirmed'`。`proposed_target_l2='strategy_signal'` は同時に `project_strategy_signals.status='confirmed'` を upsert。`proposed_target_l2='shareholder_meeting'` は候補の会議種別・日付・議題・決議・添付ファイル名だけを `project_shareholder_meetings` に1行追加し、`routed_to='project_shareholder_meetings:<id>'` を保存。メール送信・Driveアップロード・元資料編集はしない | `review_status='rejected'` |
| `action_item` | `action_items.review_status='confirmed'`。保存済み候補を確認済みにして dashboard / cockpit の要対応面へ出す | `review_status='rejected'` |
| `guardrail_match` | `guardrail_matches.status='acknowledged'` | `status='dismissed'` |

`project_strategy_signal` のうち `metadata_json.origin_kind='external_research'` は、つくよみ外部リサーチのレビュー候補。通常通知として1件ずつ表示し、ボタンは「採用 / 見送り」とする。採用時は `metadata_json.signal_source_hash` に完全一致する candidate だけを confirmed にし、該当PJ cockpit の `経営ハイライト → 採用リサーチ` へ残す。見送りは rejected とし cockpit へ出さない。候補提示・採否とも Slack は使わない。

すべての action は `l2_feedbacks` に保存し、`tsukuyomi_learnings` にも通知回答として残す。
`coverage_gap` は「確認してから手作業で別L2へ入れる」通知ではない。安全に自動ルートできる `proposed_target_l2` は「はい」の同一トランザクション相当の処理で下流テーブルへ反映し、未対応の target は `routed_to` が空のまま残して設計 gap として扱う。

PWA の `coverage_gap` 表示は、検知器の内部語や監査メモをそのまま出さない。カードタイトルは、具体候補が取れている場合だけ「重要メモにコピーする？: ...」にする。元候補が取れない、またはタイトルが「経営判断を要確認」程度の薄い通知は「コピー前に元情報を確認: ...」に変え、カード内では「このカードだけではコピー対象を判断できない」「内容が分からないならコピーしない」「再確認したい場合はコメントに元情報を再確認と書く」を表示する。この状態では肯定ボタンを押せない。具体候補が取れている場合の詳細欄は、最初に「コピーされる文章」を表示し、続けて「判断の目安」「コピーしても起きないこと」を表示する。「会議メモで見つかった内容」「通知した理由」のような監査者向け説明は出さない。UI 表示では `D-6` / `coverage_gap` / `raw transcript` / `元情報` / `取りこぼし` / `条件付き投資家関心` / `薄い` / `candidate` / `salience` / `目立たない話` を使わない。「重要メモにコピー」は内部的には D-6 `project_strategy_signals` への追加だが、まさ向けには「保存済みの会議要約とは別に、重要メモへコピーする」と説明する。H-1要約本文の復元・書き換えではない。

`coverage_gap.proposed_target_l2='shareholder_meeting'` は「ガバナンス履歴候補」とは呼ばず、「開催履歴を追加する？」として表示する。これはメール・資料から見つけた下書きで、採用前は正式な開催履歴ではない。**開催日・会議種別・議事録/決議/書面決議の開催済み証跡がそろい、既存正本と重複しない場合だけ**通知を作る。ジョブカン等の承認ワークフローと招集通知だけのメールは候補にしない。カードには追加先 `会社概要 → 総会・取締役会`、追加する `会議種別 / 開催日 / 議題 / 決議 / 添付ファイル名`、採用結果（開催履歴を1件追加、外部送信・資料アップロードなし）を出す。採用経路は `POST /api/notifications/feedback` のみで、添付URL・メール本文・source hash は正本表示へ持ち込まない。

PWA / iPhone の `textbook_insight` 表示は、候補の本文を「OSの見立て」に一度だけ出し、その下に「追加先」「追加・更新する情報」「押すと起きること」を構造化して出す。`destination_kind='management_knowledge'` は追加先を `管理 → 経営ノウハウ` とし、分類・成熟度・タグ・再利用する場面・次に確認することを表示する。yes は同じ値と本文を `management_knowledge_entries` へ1件保存し、元の会議メモ・プロトコル・BZM本文を変更しない。`destination_kind='bzm_textbook'` は従来どおり BZM内の追記先と候補の型を表示し、yes は `approved`、no は `rejected`。BZM本文は Vercel runtime から編集せず、local applier 経路だけが追記する。保存先は `practice_kind` から推測せず抽出器が明示する。

通知一覧には表示中リスト内の通し番号 (`No.1`, `No.2`...) を出す。この番号は `l2_notifications` / `meeting_notifications` の永続IDではなく、現在のフィルタ結果の順番を探すための人間用番号。未対応 / 未読 / 回答済み / 修正依頼あり のフィルタや既読折りたたみで番号は変わり得る。

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
- `connector_auth` は直接の再認証先がある場合だけ `critical` に入り、対応先がないものと通常レビュー候補は `normal` に入る。
- `app_notifications` の全カードに「まさがやること / 開く場所 / 完了条件」が出る。結果報告は「対応不要」と表示する。
- app通知の明示criticalは、具体行動・直接URL・完了条件が欠けたら `normal` へ降格する。
- MTGサマリ本文に NDA / 契約 / 法務 / SHA / COI / 再認証 / blocker 等があっても `critical` にならない。必要な緊急通知は `connector_auth` / 明示 `notification_priority='critical'` / 期限超過 / blocker 等で出す。
- L2候補は「要対応」というラベルや high importance だけでは `critical` にならない。期限超過 / blocker / 明示 critical の場合だけ右下ポップアップ対象にする。
- `?notification_id=` / `?meeting_id=` で開いた通知は、最新100件に含まれない場合も追加取得して表示し、自動展開する。
- `comment` は `l2_feedbacks` だけ増え、候補 status を変えない。
- `yes` / `no` は対象 table の status 遷移と `l2_feedbacks.feedback_text` prefix (`[はい]` / `[いいえ]`) を確認する。

## 再構築可能性チェック

### 2026-07-25: 契約 action item

`action_item` が契約状態を変える場合は、表示 metadata に実在確認済みの `contract_id`、契約名、相手先、種別、現在状態、変更後状態を入れる。PWA/iOSは `管理 → 契約` と `current → next` を先に表示し、yesでその1契約と要対応だけを更新する。IDまたは変更後状態が欠けるものは、`action_items.review_status='needs_source'` と不足項目を保存するだけで、通知一覧・判断キューへ出さない。PJ名・日時・件名の近さから契約を推測しない。

この章で通知一覧、normal/critical レーン、採否 API、status 遷移の主要 contract は再構築できる。まだ不足しているのは `applyApprovedNotification()` 内の `project_registry_diff` allowlist patch 詳細と、meeting summary re-extraction の同期確認 contract。
