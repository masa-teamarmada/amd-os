# 経営ガードレール仕様

> **この章は何か**: まさの頭の中にある「先に気づくべき経営ノウハウ」を、PJ / アクションのタグと照合して通知する予防レイヤーの current contract。

## Current Truth

| 項目 | 現行仕様 |
|---|---|
| L2 / layer | 経営ガードレール。既存L2候補の採否ではなく、事故前の予防通知 |
| 目的 | 設立前SHA、大企業入口設計、NDA前開示、PoCデータ利用許諾など、忘れると後戻りが大きい注意点を自動検知する |
| primary data | `guardrail_cards`, `guardrail_matches`, `guardrail_tag_definitions`, `guardrail_feedbacks` |
| evaluator | `POST /api/guardrails/evaluate` |
| notification kind | `l2_notifications.l2_kind='guardrail_match'` |
| review | `/notifications` の「はい」= `guardrail_matches.status='acknowledged'`、「いいえ」= `dismissed` |

## Protocol との関係

`protocols` と `guardrail_cards` は似ているが、DB上は別物として扱う。

| 種別 | 役割 | 主語 | 典型例 |
|---|---|---|---|
| `protocols` | 起きた判断・結果を構造化する知財 | 過去の事例 | 「ある分岐点で何を判断し、どうなったか」 |
| `guardrail_cards` | 未来の事故を防ぐ予防ルール | 事前チェック | 「このタグ組み合わせなら事前に止まって確認する」 |
| `guardrail_matches` | 予防ルールが実際に発火した履歴 | 現在のPJ/アクション | 「SX × 大企業技術者入口MTGで入口設計カードが発火」 |

Protocol から guardrail が育つことはある。たとえば失敗事例や後悔が `protocols` / `protocol_examples` に残り、その抽象化として `guardrail_cards.source_protocol_ids` に紐づく。ただし、guardrail は「通知して止める」ためのカードなので、protocol row を直接通知条件にしない。

## Tag Contract

タグは `axis -> tag[]` の JSON object で扱う。PJタグとアクションタグを合算し、カード側の `trigger_tags` の各 axis が1つ以上一致したときに発火する。

例:

```json
{
  "project_tags": {
    "domain": ["sales", "alliance"],
    "phase": ["enterprise_first_contact"]
  },
  "action_tags": {
    "action_type": ["external_meeting", "exhibition_followup"],
    "counterparty_role": ["engineer", "technical_contact"]
  }
}
```

`guardrail_tag_definitions` はタグ辞書で、UIや抽出器がタグ候補を出すときの正本になる。未知タグを即拒否するのではなく、MVPでは照合可能な文字列として受ける。辞書は表示・運用・将来の自動タグ付けのために育てる。

## Data Model

| table | purpose |
|---|---|
| `guardrail_tag_definitions` | axis/tag の辞書。`phase`, `action_type`, `domain`, `counterparty_role`, `risk`, `artifact` など |
| `guardrail_cards` | 予防ノウハウ本体。`trigger_tags`, `check_items`, `recommended_actions`, `severity` を持つ |
| `guardrail_matches` | card × target の発火履歴。`source_hash` で重複排除し、通知IDも保持 |
| `guardrail_feedbacks` | match/card への ack/dismiss/comment 履歴 |

`guardrail_cards.status='active'` のみ evaluate 対象。`severity` は `low / medium / high / critical`。

初期カード:

| card_id | title | severity |
|---|---|---|
| `gr:founder-sha-before-incorporation` | 設立前に創業者間SHAを締結する | critical |
| `gr:enterprise-entry-route` | 大企業への入口は経営企画・新規事業へ寄せる | high |
| `gr:nda-before-confidential-disclosure` | 秘密情報を出す前にNDAと開示範囲を決める | high |
| `gr:poc-data-permission` | PoCデータは利用許諾と責任分界を先に取る | high |
| `gr:joint-development-exclusivity-ip` | 共同開発は独占・知財・成果物帰属を先に分ける | high |
| `gr:unbriefed-pivot-in-shared-meeting` | 複数者MTGで未合意の方針転換を出さない | medium |
| `gr:university-coi-side-job` | 大学連携はCOI・兼業・職務発明を先に確認する | critical |
| `gr:fundraising-cap-table-public-commitment` | 資本政策や出資条件を早く外に確約しない | high |
| `gr:sample-chain-of-custody` | 研究試料・サンプルは授受履歴を残す | high |
| `gr:pr-consent-before-publication` | 外部公表は相手方承諾と表現確認を取る | high |

## API

| method | path | auth | behavior |
|---|---|---|---|
| POST | `/api/guardrails/evaluate` | admin or `CRON_SECRET` | active card と入力タグを照合し、`guardrail_matches` + `l2_notifications` を作る |

Request body は単発または `items[]`。

```json
{
  "project_id": "p21",
  "target_type": "meeting",
  "target_id": "meeting-20260626-miura",
  "target_title": "SX × 三浦工業 初回MTG",
  "project_tags": {
    "phase": ["enterprise_first_contact"],
    "domain": ["sales", "alliance", "new_business"]
  },
  "action_tags": {
    "action_type": ["external_meeting", "exhibition_followup"],
    "counterparty_role": ["engineer", "technical_contact"]
  },
  "evidence_refs_json": [
    { "kind": "calendar", "ref_id": "..." }
  ]
}
```

Response:

| field | meaning |
|---|---|
| `matched` | 発火候補数 |
| `inserted` | 新規 `guardrail_matches` 数 |
| `skipped` | `source_hash` 重複でskipした数 |
| `notified` | `l2_notifications` upsert 成功数 |
| `matches[]` | `match_id`, `card_id`, `severity`, `matched_tags` |

`dry_run=true` の場合はDBを書かず、発火候補だけ返す。

## Notification / Feedback

`/api/guardrails/evaluate` は発火ごとに `l2_notifications` を作る。

| column | contract |
|---|---|
| `l2_kind` | `guardrail_match` |
| `target_id` | `project_id` があればPJ、なければ `target_id` |
| `scope_key` | `guardrail_matches.match_id` |
| `importance` | critical=10 / high=8 / medium=5 / low=2 |
| `metadata_json.notification_priority` | high/critical は `critical`、それ以外は `normal` |
| `metadata_json.guardrail_card_id` | 発火した card |
| `metadata_json.matched_tags` | 一致したタグ |

`POST /api/notifications/feedback`:

| action | effect |
|---|---|
| `yes` | `guardrail_matches.status='acknowledged'`、`guardrail_feedbacks.action='acknowledge'` |
| `no` | `guardrail_matches.status='dismissed'`、`guardrail_feedbacks.action='dismiss'` |
| `comment` | `l2_feedbacks` と `tsukuyomi_learnings` に残す。match status は変えない |

## Failure Mode

| failure | behavior |
|---|---|
| unauthenticated | 401 |
| non-admin | 403 |
| `items[]` なし / `target_type`, `target_id` なし | 400 |
| active card なし | `matched=0` |
| duplicate source_hash | `skipped_duplicate` |
| notification upsert failed | match は残し、`inserted_without_notification` として返す |

## Validation

1. migration `154_management_guardrails.sql` が通り、4 table と seed card が存在すること。
2. `dry_run=true` で SX × 大企業技術者入口タグが `gr:enterprise-entry-route` に当たること。
3. `dry_run=false` で `guardrail_matches` と `l2_notifications(l2_kind='guardrail_match')` が増えること。
4. `/notifications` から「はい」で `acknowledged`、「いいえ」で `dismissed` になること。
5. 同じ target/tags/card の再POSTで duplicate skip されること。

## まだ未実装

- PJ台帳やMTGカードへの自動タグ付け UI。
- guardrail card の管理UI。
- protocol から guardrail card を半自動生成する昇格フロー。
- 通知2分類の完全な仕様分離。現時点では `importance` と `metadata_json.notification_priority` でシグナルを渡す。
