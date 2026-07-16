# 通知レビュー UI / 経営ハイライト確認 仕様

`/notifications` 画面と、 PJ コックピット内 `CockpitStrategySignals` の **経営ハイライト確認** UI、 修正依頼履歴の見方をまとめる。 ユーザー向け概念は [3-3 章](3-3-notifications-and-tsukuyomi.md) を、 つくよみ修正依頼 dialog API は [8-1 章](8-1-knowledge-admin-tsukuyomi-spec.md) を見る。

> 実装者向けの D-6 経営ハイライト確定仕様は [/spec/3-6-strategy-signals-current-spec](/spec/3-6-strategy-signals-current-spec) へ移行済み。ここでは `/notifications` の運用・確認手順を中心に扱う。

## 何を見る画面か

`/notifications` は admin が **「通知 = 反映前の承認 UI」** として開く画面。 L2 抽出 routine が候補を作って通知を投げてくる、 まさが「はい・反映」「いいえ・不採用」「コメント」を返すと正本反映 or rejected する。

> 通知は事後報告ではなく、 **反映前の承認 UI**。 まさが「はい」を押すまで対象 L2 候補は正本反映しない (= まさ #43 2026-05-22 確定)。

## 対象データ source

| table | 通知種別 |
|---|---|
| `l2_notifications` | D-1 プロトコル / D-2 MS 進捗 / D-3 PJ ナレッジ / D-4 メンバーナレッジ / D-5 OS 台帳差分 / M-2 XRL 根拠 / D-6 経営ハイライト 等 |
| `meeting_notifications` | H-1 MTG サマリ通知 |
| `l2_feedbacks` | 過去の修正依頼履歴 (= conversation 履歴) |
| `app_notifications` | OS 全体の運用通知 (= task追加、入金 nudge、cron 失敗、H-1報告 等) |

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
- `app_notifications` は `AppNotificationsSection` が client side で最新分を読む

これを `NotificationsClient` に渡す。

### 通常通知 / 緊急通知 / 右下ポップアップ

通知ページの一覧は、未対応 / 未読 / 回答済み / 修正依頼ありのタブを保ったまま、表示中のカードを `normal` と `critical` に分ける。分類関数は `pwa/src/lib/notification-priority.ts`。

| source | critical にしてよい条件 |
|---|---|
| `app_notifications` | `kind='connector_auth'`、または `meta.priority/severity/urgency/notification_priority/risk_level` が `critical` / `urgent` / `blocker` 等。title/body/meta reason の再認証・blocker・期限超過も critical。H-1報告 (`kind='h1_report'`) は通常通知として扱う。 |
| `l2_notifications` | 明示 `metadata_json.notification_priority='critical'`、または `metadata_json` の priority/severity/reason/blocker_kind 等に blocker / 期限超過 / 再認証 / 緊急等がある場合だけ critical。`l2_kind`、`importance`、title、summary だけでは critical にしない。 |
| `meeting_notifications` | 常に normal。MTG本文は一次記録なので、NDA / 契約 / 法務 / SHA / 再認証 / blocker 等の語が入っても右下ポップアップには出さない。 |

`CriticalRealtimeNotify` は critical 未読だけを Realtime + 10秒poll で拾い、右下ポップアップを出す。L2 ポップアップは `/notifications?notification_id=...` に飛び、通知ページは対象rowが最新100件から漏れていても追加取得・自動展開する。MTG通知はポップアップ対象外なので、緊急扱いが必要な場合は `connector_auth` / `guardrail_match` / 明示 `notification_priority='critical'` などの専用通知として別に出す。

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
| `coverage_gap` | `l2_coverage_gaps.review_status='candidate'` | `confirmed`。`proposed_target_l2='strategy_signal'` なら `project_strategy_signals.status='confirmed'` も自動作成し、`routed_to` に行き先を残す | `rejected` |

> `protocols` の「はい」は `confirmed` であって `active` ではない (= まさ #68 current truth 2026-05-25)。 旧 md / コードで `active` と書いてあったら正本訂正対象。

> `raw_data_gap` は **例外**。 「はい」を押せば現物が OS に入る、 と勘違いする UX を作らない。 通知タイトルは `〜が OS 未取り込み` ではなく `〜の取り込み経路を確認` のように、 押した後に起きることを明示する書き方にする。

> `coverage_gap` は `raw_data_gap` と違い、OS のカバレッジ漏れ候補を扱う。押したあとに手作業で別L2へ入れる運用にしない。安全にルートできる候補は「はい」と同時に下流テーブルへ自動反映する。2026-06-27 時点では `proposed_target_l2='strategy_signal'` を D-6 経営ハイライトへ自動昇格する。H-1 reviewer 由来の raw 再確認は採否APIではなく reviewer / source fallback 側の責務にする。ただし PWA のまさ向け表示では、この内部語を出さない。2026-07-16 以降、通知タイトルは「重要メモに残す？: ...」、詳細は「会議メモにあった話」「いまの要約で目立たない話」「残すとどうなる？」へ統一する。表示禁止語は `D-6` / `coverage_gap` / `raw transcript` / `元情報` / `取りこぼし` / `条件付き投資家関心` / `薄い` / `candidate` / `salience`。「重要メモに残す」は D-6 への追加だが、H-1要約本文の復元ではない。

## 経営ハイライト確認 UI (= CockpitStrategySignals)

`project_strategy_signals` は D-6 で抽出される「進んだこと / 起きたこと」。 各 PJ cockpit の経営ハイライト tab + p00 cockpit でまさえいMTG 議題候補として表示される。

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
| `signal_scope` / `applies_to_company_score` | AMD会社バイタルへ入れる範囲分類。`company` / `cross_project` かつ TRUE のものだけ Management Score 対象 |
| `pipeline_status` / `pipeline_probability` / `expected_amount_yen` / `expected_contract_ym` | 契約前 pipeline の状態、確度、見込み金額、見込み月 |
| `company_score_axis` / `scope_reason` | Management Score 側の軸と、対象/非対象にした理由 |
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

### まさえいMTG (= D-6 dialogue) 接続

p00 cockpit + 各 PJ cockpit で `status='candidate'` 経営ハイライトを impact 順に並べ、 まさえいMTG セッションで 1 件ずつ確認していく。 詳細は `pwa/CLAUDE.md` の「🧭 まさえいMTG の始め方」section と [`pwa/design/project_strategy_signals.md`](../design/project_strategy_signals.md) を見る。

`status='confirmed'` は「PJ cockpit上で採用する」意味で、AMD会社バイタルへ入れる意味とは分ける。会社スコアへ入れるには `applies_to_company_score=true` と `company_score_axis` が必要。香川大/KUTE/NIMSのような契約前高確度案件は candidate のままでも、確度・見込み月・scope理由が揃っていれば pipeline 材料にできる。

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
  participant Routine as subscription automation
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
