# OS台帳差分 (D-5) — 設計の正本

最終更新: 2026-05-15
正本ステータス: 定義確定、実装中。

> **manual / spec / bzm 3層分割中**: D-5 OS 台帳差分の確定実装仕様は `/spec/3-4-registry-diffs-current-spec.md` へ移行済み。移行完了までは、この design も設計議論・履歴として残し、迷う内容は両方に置く。

---

## 定義

**OS台帳差分** は、5生データと OS の構造データを突合して見つけた「OSへ反映すべきかもしれない差分候補」。

これは生データ本文そのものではない。Gmail / Drive / Calendar / Slack / Notion の現物から、AMD OS の台帳に必要な粒度だけを抽出する。

例:
- PJメンバー候補: メールや議事録に継続登場する人物が `project_members` にいない
- 関係先メール候補: PJ関係者らしきメールアドレスが `project_partners` / PJ設定にない
- PJ担当・関係者候補: 役割や担当範囲が OS 上の担当情報とずれている
- 契約・スコープ候補: 合意内容、支援範囲、成果物、除外範囲が変わった可能性
- 期間・ステータス候補: 開始月、終了月、休止、再開、終了の実態が OS と違う
- 請求・稼働候補: 月次請求、pt、担当割合、稼働実績の差分

---

## 目的

5生データ側で事実が変わっているのに OS 台帳が古い、という状態をなくす。

ただし、自動で確定更新してよい差分と、人間確認が必要な差分を分ける。原則として D-5 は **pending diff → 通知 → はい/いいえ/コメント → 反映または学習** の流れを通す。

---

## 保存先

### 現在

移行テーブル新設前は、通知を正面の受け口にする。

- `l2_notifications`
  - `l2_kind = 'project_registry_diff'`
  - `target_id = project_id`
  - `scope_key = ym` または `global`
  - `summary` は OS に入れるべき差分の要約だけ。メール全文や議事録全文は入れない
  - `metadata` に候補 patch / evidence refs / confidence を入れる

### 新設予定

`project_registry_diffs`

推奨カラム:

| column | 意味 |
|---|---|
| `diff_id` | UUID PK |
| `project_id` | 対象 PJ |
| `ym` | 月次差分なら対象年月。PJ全体なら NULL |
| `diff_kind` | `member_candidate` / `partner_email_candidate` / `scope_change` / `period_change` / `status_change` / `billing_change` / `assignment_change` / `other` |
| `target_table` | 反映先候補テーブル |
| `target_key` | 既存 row を指すキー。新規候補なら NULL |
| `current_snapshot_json` | OS 側の現在値 |
| `proposed_patch_json` | 採用時に適用する差分 |
| `evidence_refs_json` | 5生データ上の根拠参照。本文全文ではなく、source id / date / sender / snippet / hash |
| `confidence` | 0-1 |
| `status` | `pending` / `accepted` / `rejected` / `applied` / `archived` |
| `review_comment` | まさコメント |
| `created_by` | `automation` / `codex` など |
| `created_at` | 作成日時 |
| `reviewed_at` | 採否日時 |
| `applied_at` | DB反映日時 |

重複回避キーは `project_id + ym + diff_kind + target_table + target_key + proposed_patch_hash` を基本にする。

---

## 通知ルール

保存された pending diff は必ず `/notifications` に出す。

- 「はい」: `proposed_patch_json` を Supabase へ適用し、`status='applied'`
- 「いいえ」: `status='rejected'`
- コメントあり: `l2_feedbacks` / つくよみ学習リストへ保存し、次回抽出プロンプトに含める

通知には差分要約を載せる。メール全文・議事録全文・Slack全文は載せない。

---

## 生データとの関係

5生データは根拠であって保存対象ではない。

OS台帳差分に保存するのは次だけ:
- OS へ入れるべき構造化候補
- 根拠の短い引用または snippet
- 根拠 source への参照
- 生データ本文の hash

全文が必要なときは connector / 元サービス / 生データ参照から確認する。

---

## 実装メモ

KUTE では Gmail だけでも重要な差分が出る。GAS のバックアップシートではなく、Supabase 上の PJ定義 + Gmail connector / PWA route の現物を使う。

オートメーションは、まず OS snapshot を取り、5生データを source ごとに集め、差分候補だけを D-5 として通知する。
