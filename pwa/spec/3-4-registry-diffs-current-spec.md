# L2D-5 OS 台帳差分仕様

> **この章は何か**: 5 生データと OS 台帳を突合して、反映前の差分候補を作る L2D-5 の確定仕様。設計議論は `pwa/design/project_registry_diffs.md` にも残す。

## 定義

OS 台帳差分は、5 生データ側に現れているが AMD OS の構造データとずれている可能性がある候補。

| diff_kind | 例 |
|---|---|
| `member_candidate` | 継続登場する人物が `project_members` にいない |
| `partner_email_candidate` | 関係先メールが `project_partners` / PJ設定にない |
| `scope_change` | 支援範囲、成果物、除外範囲が変わった |
| `period_change` | 開始月、終了月、休止、再開の実態が違う |
| `status_change` | PJ status が現実とずれている |
| `billing_change` | 請求条件、稼働、pt、担当割合に差分がある |
| `assignment_change` | 担当者・役割・責任範囲が変わった |

## 正本テーブル

| table | 用途 |
|---|---|
| `project_registry_diffs` | 差分候補の正本。`pending -> applied/rejected/archived` |
| `l2_notifications` | `/notifications` に出す承認カード。`l2_kind='project_registry_diff'` |
| `l2_feedbacks` | まさコメント・次回抽出への学習 |

## 現行 writer

| 項目 | 値 |
|---|---|
| writer | Codex automation `amd-os-ms` |
| SKILL | `pwa/scheduled-tasks/amd-os-l7-registry-diff-extract/SKILL.md` |
| input | Gmail / Drive / Calendar / Slack / Notion + OS snapshot |
| output | `outbox.registryDiffs` |
| apply | LaunchAgent + `ms_progress_review_tool.mjs apply-outbox-dir` |

## 保存契約

`project_registry_diffs` は本文全文を保存しない。保存するのは、構造化候補・短い根拠・source refs / hash だけ。

| field | 契約 |
|---|---|
| `project_id` | 対象 PJ |
| `ym` | 月次差分なら対象年月。PJ全体なら NULL |
| `diff_kind` | 上記 kind |
| `target_table` / `target_key` | 反映候補先 |
| `current_snapshot_json` | OS 側の現値 |
| `proposed_patch_json` | 採用時に適用する patch |
| `evidence_refs_json` | source id / date / sender / snippet / hash |
| `confidence` | 0-1 |
| `status` | `pending` / `applied` / `rejected` / `archived` |

## 採否

- 「はい」: allowlist 済みの安全な DB 更新だけ実行し、`status='applied'` にする。
- 「いいえ」: `status='rejected'`。
- コメント: `l2_feedbacks` に保存し、次回 automation prompt に含める。

allowlist 外の変更や破壊的変更は、人間確認を追加し、automation が直接 DB 更新しない。

## 禁止事項

- Gmail / Slack / Notion / Drive 本文全文を保存しない。
- 「差分っぽい」だけで OS 台帳を自動更新しない。
- target table / column を想像しない。`pwa/design/db_schema.md` を見る。
- 既存 row を消す patch は自動適用しない。論理削除や status 変更も allowlist に限定する。
