# 通知レビュー UI / 経営ハイライト確認 仕様

`/notifications` 画面と、 PJ コックピット内 `CockpitStrategySignals` の **経営ハイライト確認** UI、 修正依頼履歴の見方をまとめる。 ユーザー向け概念は [3-3 章](3-3-notifications-and-tsukuyomi.md) を、 つくよみ修正依頼 dialog API は [8-1 章](8-1-knowledge-admin-tsukuyomi-spec.md) を見る。

## 何を見る画面か

`/notifications` は admin が **「通知 = 反映前の承認 UI」** として開く画面。 L2 抽出 routine が候補を作って通知を投げてくる、 まさが「はい・反映」「いいえ・不採用」「コメント」を返すと正本反映 or rejected する。

> 通知は事後報告ではなく、 **反映前の承認 UI**。 まさが「はい」を押すまで対象 L2 候補は正本反映しない (= まさ #43 2026-05-22 確定)。

## 対象データ source

| table | 通知種別 |
|---|---|
| `l2_notifications` | L2 ② プロトコル / ③ MS 進捗 / ④ PJ ナレッジ / ⑤ メンバーナレッジ / ⑦ OS 台帳差分 / ⑧ XRL 根拠 / ⑨ 経営ハイライト 等 |
| `meeting_notifications` | L2 ⑥ MTG サマリ通知 |
| `l2_feedbacks` | 過去の修正依頼履歴 (= conversation 履歴) |
| `app_notifications` | OS 全体の運用通知 (= 入金 nudge / cron 失敗 等) |

`l2_notifications` 列:

| column | 役割 |
|---|---|
| `notification_id` | UUID PK |
| `l2_kind` | `member_knowledge` / `project_knowledge` / `protocols` / `ms_progress` / `meeting_summary` / `project_registry_diff` / `xrl_evidence` / `strategy_signal` / `raw_data_gap` 等 |
| `target_id` | scope に応じた key (= `member.code_name` / `project_id` / `meeting_id`) |
| `scope_key` | `ym` / `'global'` / `YYYYMM:protocol:<protocol_id>` 等 |
| `title` / `summary` | カード表示 |
| `saved_count` / `total_count` | 抽出件数 / 全候補件数 |
| `importance` | 1 (軽微) / 2 (中) / 3 (重大) |
| `notified_at` | iOS APNs 配信時刻 (= server marker) |
| `read_at` | PWA 既読時刻 (= 人間 marker、 split: まさ #41 2026-05-20) |
| `metadata_json` | l2_kind ごとの詳細 (= evidence_refs / proposed_patch 等) |
| UNIQUE | `(l2_kind, target_id, scope_key)` |

## 画面構成 (= `pwa/src/app/(app)/notifications/page.tsx`)

server page で `members.is_admin` を確認、 admin 以外は `notFound()`。 fetch:

- `l2_notifications` 最新 100 件
- `meeting_notifications` 最新 100 件
- `l2_feedbacks` 最新 200 件
- `projects` 全件 (= title 紐付け用)

これを `NotificationsClient` に渡す。

### フィルタタブ

| タブ | 条件 |
|---|---|
| 未対応 | 未読 (= `read_at IS NULL`) かつ未回答 (= 対応する `l2_feedbacks` 行が無い) |
| 未読 | `read_at IS NULL` のみ |
| 回答済み | `l2_feedbacks.feedback_text` が `[はい]` / `[いいえ]` / コメントで保存済 |
| 修正依頼あり | この通知に紐づく feedback が 1 件以上 |

### カード

時系列降順。 各カードに:

- title (= l2 通知は絵文字付き、 meeting 通知は `📋 議事録: ...`)
- 補助メタ: 日時 / `l2_kind` / `target_id` / 未読 badge / 修正依頼 N 件 badge

### 展開時

- summary 本文
- 元データへの deep link (= `l2_kind` 別):
  - `protocols` → `/admin/protocols`
  - `ms_progress` → `/project/<project_id>/cockpit?ym=<ym>`
  - `project_knowledge` → `/project/<project_id>/cockpit` の PJ ナレッジ tab
  - `meeting_summary` → `/project/<project_id>/cockpit?meeting=<meeting_id>`
  - `xrl_evidence` → `/project/<project_id>/cockpit` の XRL tab
  - `strategy_signal` → `/project/<project_id>/cockpit` の経営ハイライト tab
- 既存 feedback 一覧 (= 同 `(l2_kind, target_id, scope_key)` の `l2_feedbacks`)
- 「✅ はい・反映」「❌ いいえ・不採用」「💬 コメントだけ送信」textarea + 送信ボタン

回答後は `l2_feedbacks.feedback_text` 先頭に `[はい]` / `[いいえ]` / コメントを書き、 通知カードを `回答済み` タブへ移動 + `read_at=now()` set。

## 正本反映ゲート (= はいを押した瞬間の処理)

`l2_kind` ごとに、 「はい」で何が起きるかが厳密に定義されてる:

| l2_kind | 保存時 status | はい (= reflect) | いいえ (= reject) |
|---|---|---|---|
| `member_knowledge` | (= 現 schema に `status` 列なし、 migration 検討中) | TBD | TBD |
| `project_knowledge` | `candidate` | `active` | `rejected` |
| `protocols` | `candidate` | `confirmed` | `rejected` |
| `founding_members` | `tentative` | `active` | `invalid` |
| `project_registry_diff` | `pending` | allowlist 済 DB 反映 + `applied` | `rejected` |
| `xrl_evidence` | `candidate` | `confirmed` | `rejected` |
| `strategy_signal` | `candidate` | `confirmed` (= まさえいMTGで `decision_state` 別途進む) | `rejected` |
| `raw_data_gap` | (通知のみ) | feedback 記録 + 再抽出 / 経路確認、 現物 DB 取り込みは保証しない | feedback 記録 |

> `protocols` の「はい」は `confirmed` であって `active` ではない (= まさ #68 current truth 2026-05-25)。 旧 md / コードで `active` と書いてあったら正本訂正対象。

> `raw_data_gap` は **例外**。 「はい」を押せば現物が OS に入る、 と勘違いする UX を作らない。 通知タイトルは `〜が OS 未取り込み` ではなく `〜の取り込み経路を確認` のように、 押した後に起きることを明示する書き方にする。

## 経営ハイライト確認 UI (= CockpitStrategySignals)

`project_strategy_signals` は L2 ⑨ で抽出される「進んだこと / 起きたこと」。 各 PJ cockpit の経営ハイライト tab + p00 cockpit でまさえいMTG 議題候補として表示される。

### `project_strategy_signals` 列

| column | 役割 |
|---|---|
| `signal_id` | UUID PK |
| `project_id` | 対象 PJ (= 会社全体は `p00`) |
| `ym` / `signal_date` | 発生月 / 日 |
| `signal_type` | `funding` / `commercial_progress` / `risk` / `partner_growth` 等 |
| `title` / `summary` | 経営ハイライト本文 |
| `impact_level` | `critical` / `high` / `medium` / `low` |
| `decision_state` | `observed` (= 検知のみ) → `decided` (= 方針確定) / `executing` (= 実行中) |
| `status` | `candidate` (= 抽出のみ) → `confirmed` (= まさえいMTG で確認) / `rejected` |
| `polarity` | `+` (= 好材料) / `-` (= 悪材料) / `=` (= 中立) |
| `confidence` | `0.0-1.0` の数値 |
| `source_refs_json` | 抽出元 5 生データへの参照 |
| `source_hash` | 冪等性 |
| `score_impact_summary` / `score_impact_delta_json` | Management Score / AMD Score への影響 |
| `confirmed_by` / `confirmed_at` | 確定アクター |

### CockpitStrategySignals 表示

PJ cockpit 経営ハイライト tab で:

- impact_level の chip (= critical / high / medium / low、 赤 / 橙 / 黄 / 灰)
- signal_type chip
- title 1 行 + summary 2-3 行
- polarity (= + / - / = アイコン)
- decision_state badge
- source_refs deep link (= MTG サマリ / monthly_report 等)
- アクション:
  - ✅ 確定 (= `confirmed`)
  - ❌ 不採用 (= `rejected`)
  - ⚠️ つくよみに修正依頼 (= 8-1 章の dialog 対話型ループ起動)
  - 🗨️ コメントだけ送信

### まさえいMTG (= L2 ⑨ dialogue) 接続

p00 cockpit + 各 PJ cockpit で `status='candidate'` 経営ハイライトを impact 順に並べ、 まさえいMTG セッションで 1 件ずつ確認していく。 詳細は `pwa/CLAUDE.md` の「🧭 まさえいMTG の始め方」section と [`pwa/design/project_strategy_signals.md`](../design/project_strategy_signals.md) を見る。

API (= dialogue API):

| API | body | 役割 |
|---|---|---|
| `POST /api/strategy-signals` | `{ action: 'confirm'|'reject'|'update'|'create', signal_id, decision_state?, confirmed_by? }` | signal の status / decision_state 更新 |
| `POST /api/dialogue-meeting` | `{ project_id, summary_short, decided[], progress[], next_actions[], risks[], related_signal_ids[] }` | まさえいMTG 議事録を `project_meeting_summaries` に保存 |
| `POST /api/dialogue-meeting/narrate` | `{ meeting_id: "dialogue:..." }` | Sonnet 4.6 で raw 配列 → narrative_md 生成 |

## 修正依頼ループ (= conversation 履歴)

`l2_feedbacks` の `feedback_text` には dialog 対話型 (= 8-1 章) の **conversation 全体** が保存される。 同 `(l2_kind, target_id, scope_key)` 単位で時系列に表示:

```text
[はい] (2026-05-26)

[まさからの修正依頼 2026-05-25]
> impact_level critical じゃなくて high にして欲しい

[つくよみ proposed]
> 「重要 → 注視」に impact_level を high に変更しました。
> これでいい?

[適用 2026-05-26]
> applied_feedback_summary: impact_level を critical → high に下げた
```

`status='active'` のフィードバックは次回 routine 発火時に prompt 注入される (= 同じ間違いを繰り返さない)。 古くなったら admin が手動で `status='archived'`。

### applied_count

`l2_feedbacks.applied_count` は LLM プロンプトに含められた回数。 `applied_count` が増えても結果が直らない (= 何度も同じ feedback が反映されてるのに UI が変わらない) ときは、 prompt 設計 / 抽出ロジックの根本問題。

## raw_data_gap 通知 (= 例外)

`raw_data_gap` は他通知と性質が違う。 通知タイトルは押した後に起きることを明示:

| ❌ 禁止 | ✅ OK |
|---|---|
| 〜 が OS 未取り込み | 〜 の取り込み経路を確認 |
| 〜 を取り込んで | 〜 を BRL 根拠候補にする? |
| 〜 が抜けてる | 〜 の L2 化先を確認 |

`metadata_json.evidence_refs` を詳細表示の正本とする。 `project_id + ym` の `source_cache` 全件を出すと「生データ取り込み通知」に見えて混乱するため禁止 (= まさ #42 2026-05-21 教訓)。

展開時に `project_meeting_summaries` を live 確認し、 すでに取り込み済なら「OS 取り込み済み」を詳細先頭に表示 (= stale 通知判定、 まさ #44 2026-05-22)。

## 通知の生成・消化 ライフサイクル

```mermaid
sequenceDiagram
  participant Routine as Cloud routine
  participant DB as l2_notifications
  participant iOS as Swift APNs
  participant PWA as /notifications
  participant Masa as まさ
  participant FB as l2_feedbacks
  Routine->>DB: upsert &lpar;saved_count++ で再通知&rpar;
  DB->>iOS: 配信 (notified_at=now)
  iOS->>Masa: push 表示
  Masa->>PWA: 開く
  PWA->>DB: read_at=now()
  Masa->>PWA: はい/いいえ/コメント
  PWA->>FB: l2_feedbacks INSERT
  Masa->>PWA: ⚠️ つくよみに修正依頼
  PWA->>FB: dialog で conversation 蓄積
  FB-->>Routine: 次回 fetch (= status='active')
```

`notified_at` (= iOS 配信 marker、 server) と `read_at` (= 人間既読 marker、 PWA) は別列。 iOS で再配信されても `read_at` は再セットされない (= まさ #41 2026-05-20 split)。

## トラブル時

| 症状 | 確認場所 |
|---|---|
| `/notifications` が空 | `members.is_admin` が true か、 `l2_notifications` row 数 |
| 通知タップで該当画面に飛ばない | `l2_kind` 別の deep link map、 `target_id` / `scope_key` parse |
| 「はい」 押したのに反映されない | 該当 `l2_kind` の正本反映ゲートが正しいか (= 上記表)、 `meeting_summary` は GAS 再抽出 502 を疑う |
| 同じ通知が消えない | `saved_count` 増えるたびに `read_at` がリセットされてないか、 UNIQUE 制約 `(l2_kind, target_id, scope_key)` で正しく upsert されてるか |
| 修正依頼が次回反映されない | `l2_feedbacks.status='active'`、 `applied_count` 増加、 該当 routine の `_l2_loadFeedbackBlock_` 実装 |
| 経営ハイライトが p00 に集約されない | `project_id='p00'` で signal 抽出されてるか (= AMD 全体は明示的に p00 で書く) |

## 関連

- 設計: [`pwa/design/notifications.md`](../design/notifications.md) (= 本仕様の設計議論)
- 設計: [`pwa/design/project_strategy_signals.md`](../design/project_strategy_signals.md) (= 経営ハイライト詳細 + まさえいMTG)
- 設計: [`pwa/design/feedback_dialog.md`](../design/feedback_dialog.md) (= dialog 対話型ループ)
- 3-3 章 [通知・修正依頼・正本反映ゲート](3-3-notifications-and-tsukuyomi.md) (= ユーザー向け概念)
- 8-1 章 [Knowledge Admin / Tsukuyomi](8-1-knowledge-admin-tsukuyomi-spec.md) (= 修正依頼 API 詳細)
- 8-3 章 [L2 Extraction Routines](8-3-l2-extraction-routines-spec.md) (= 各 L2 抽出側との feedback 接続)
