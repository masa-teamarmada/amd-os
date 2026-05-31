# Textbook L2 10 real-data first-run dry-run

> 作業日時: 2026-05-31 18:23 JST
> 追記: 2026-05-31 18:40 JST candidate creation 実施
> worker branch: `codex/textbook-l10-real-data-dry-run`
> 本文追記: なし
> `apply_approved_textbook_insights.mjs --apply`: 未使用

## 結果

- 2026-05-31 18:23 JST 時点では本番 `textbook_insight_candidates` / `l2_notifications(l2_kind='textbook_insight')` / `approved` はすべて 0 件だった。
- Textbook司令塔追加指示により、2026-05-31 18:40 JST に proposal JSON の2件だけを本番 `textbook_insight_candidates` + `l2_notifications` へ作成した。
- 作成後も2件とも `status='candidate'`。`approved` 化はしていない。
- まさが `/notifications` で yes/no するまでは採否未確定。
- local applier dry-run は `approved` 候補が無いため空結果。
- Textbook本文追記なし。`--apply` 未使用。

## 実データ候補案

| source | source row | practice_kind | routing | duplicate key |
|---|---|---|---|---|
| `project_strategy_signals` | `0f7bb7e6-58ec-4f4c-a014-528b840cb9fb` | `decision_branch` | `8-2-field-decisions-and-branches` | `target_id=p10`, `scope_key=textbook:e9f2991e58c6`, `source_hash=e9f2991e58c6...` |
| `protocols` | `p4u-b035cb789f34` | `relationship_playbook` | `8-4-relationship-playbook` | `target_id=p00`, `scope_key=textbook:cecd5768a518`, `source_hash=cecd5768a518...` |

## 作成後DB状態

| candidate_id | notification_id | status | practice_kind | target_bzm_slug | confidentiality | BZM review |
|---|---|---|---|---|---|---|
| `81d30242-5b00-462b-bc1d-44c673afae71` | `0721a0c0-b4b8-4fcb-ab3c-b0c193f6f783` | `candidate` | `decision_branch` | `8-2-field-decisions-and-branches` | `sanitized` | `required=false`, `status=not_required` |
| `ef6f6ffb-161b-46a7-8802-233f2835ff9c` | `9f790428-4f21-4ff3-8551-4d8fa8d8505f` | `candidate` | `relationship_playbook` | `8-4-relationship-playbook` | `sanitized` | `required=false`, `status=not_required` |

## 採用可否の一次判断

- `decision_branch` 候補は、未公開技術・未実証知財を含む外部相談で、相手先の魅力度よりも「説明語彙と開示範囲の線引き」を先に固定する分岐を扱っている。Before Zero の意思決定再利用性が高く、`8-2` の現場判断章に置く候補として妥当。
- `relationship_playbook` 候補は、研究機関初回接触で提案先行より課題傾聴を優先する関係構築ルールを扱っている。研究機関OS導入・KUTE型エコシステム構築にも横展開できるため、`8-4` の関係構築章に置く候補として妥当。
- まさが no にしそうな違和感ポイントは、1件目は「まだ抽象化が強く、具体ケースの迫力が薄い」こと、2件目は「すでにProtocol候補なのでTextbookにも重ねる必要があるか」の判断。
- no理由が「抽象化しすぎ」「固有情報を削りすぎ」「Protocolで十分」「章違い」なら、今後の候補生成ルールへそれぞれ body_md の具体度、sanitized粒度、source種別の重複扱い、routing調整として反映する。

## Routing確認

- routing fixture で `decision_branch -> 8-2`, `failure_learning -> 8-3`, `relationship_playbook -> 8-4`, `reusable_question/field_transition -> 8-5`, `theory_case -> 6-1` を確認。
- 実データ候補案でも `decision_branch` は `8-2-field-decisions-and-branches`、`relationship_playbook` は `8-4-relationship-playbook` に向ける設計で問題なし。
- unknown `practice_kind` は丸めず fallback warning に残ることも fixture で確認。

## Duplicate risk

- 既存の Textbook 候補/通知は 0 件なので、現時点の重複は無い。
- 実投入する場合は `target_id + scope_key` と `source_hash` で重複防止する。
- 作成前に対象 `scope_key` / `source_hash` の候補・通知が0件であることを確認済み。
- 作成は `target_id + scope_key` の upsert 経由で実施。作成後も対象候補2件・通知2件のみ。

## Approval / applier gate

- `approved` が 0 件なので、local applier は本文追記対象を持たない。
- 候補を本番DBへ作成した後も、まさが `/notifications` で yes するまでは `approved` にならない。
- `internal_only` と BZM review未承認候補を skip する local applier gate はコード上確認済み。

## No理由フィードバックループ

- `/api/notifications/feedback` は `action='no'` のときも `l2_feedbacks` に `[いいえ] <任意コメント>` を保存する。
- Textbook候補では `rejectNotificationCandidates -> updateTextbookInsightCandidates(status='rejected')` により、任意コメントがあれば `textbook_insight_candidates.review_comment` にも入る。
- `/notifications` UI は同じ通知の `l2_feedbacks.feedback_text` を「過去の修正依頼」として表示するため、コメント付き no なら Textbook司令塔が後で取得・確認できる。
- ただし現行UIは no理由入力を必須にしていない。空コメントで no された場合は `l2_feedbacks.feedback_text='[いいえ]'`、候補 `review_comment=null` になり、違和感の中身は戻らない。

## 次アクション

1. まさが `/notifications` で2件を yes/no する。
2. yes 済み候補が出ても次workerは local applier dry-run まで。本文追記は別途承認後。
3. Textbook用の no 理由を必須化、または no理由カテゴリを追加する改善タスクを検討する。
