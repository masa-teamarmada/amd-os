# Textbook L2 10 real-data first-run dry-run

> 作業日時: 2026-05-31 18:23 JST
> worker branch: `codex/textbook-l10-real-data-dry-run`
> 本文追記: なし
> `apply_approved_textbook_insights.mjs --apply`: 未使用

## 結果

- 本番 `textbook_insight_candidates`: 0 件。
- 本番 `l2_notifications(l2_kind='textbook_insight')`: 0 件。
- `approved` 候補: 0 件。
- 既存候補が無いため、通知承認済み候補を使った local applier dry-run は空結果になった。
- worker が勝手に user approval を偽造しないため、本番DBへの候補/通知作成は行っていない。
- 実データから少数候補案を `2026-05-31-textbook-l10-real-data-first-run-proposal.json` に作成した。

## 実データ候補案

| source | source row | practice_kind | routing | duplicate key |
|---|---|---|---|---|
| `project_strategy_signals` | `0f7bb7e6-58ec-4f4c-a014-528b840cb9fb` | `decision_branch` | `8-2-field-decisions-and-branches` | `target_id=p10`, `scope_key=textbook:e9f2991e58c6`, `source_hash=e9f2991e58c6...` |
| `protocols` | `p4u-b035cb789f34` | `relationship_playbook` | `8-4-relationship-playbook` | `target_id=p00`, `scope_key=textbook:cecd5768a518`, `source_hash=cecd5768a518...` |

## Routing確認

- routing fixture で `decision_branch -> 8-2`, `failure_learning -> 8-3`, `relationship_playbook -> 8-4`, `reusable_question/field_transition -> 8-5`, `theory_case -> 6-1` を確認。
- 実データ候補案でも `decision_branch` は `8-2-field-decisions-and-branches`、`relationship_playbook` は `8-4-relationship-playbook` に向ける設計で問題なし。
- unknown `practice_kind` は丸めず fallback warning に残ることも fixture で確認。

## Duplicate risk

- 既存の Textbook 候補/通知は 0 件なので、現時点の重複は無い。
- 実投入する場合は `target_id + scope_key` と `source_hash` で重複防止する。
- 今回の proposal は未投入なので rollback 対象は無し。

## Approval / applier gate

- `approved` が 0 件なので、local applier は本文追記対象を持たない。
- 候補を本番DBへ作成した後も、まさが `/notifications` で yes するまでは `approved` にならない。
- `internal_only` と BZM review未承認候補を skip する local applier gate はコード上確認済み。

## 要判断

次に進めるには、`2026-05-31-textbook-l10-real-data-first-run-proposal.json` の2件を `apply-outbox` で本番 `textbook_insight_candidates` + `l2_notifications` に作ってよいか、Textbook司令塔/まさ判断が必要。
