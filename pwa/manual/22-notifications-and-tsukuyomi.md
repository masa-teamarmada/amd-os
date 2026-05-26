# 22. 通知・つくよみ修正依頼・正本反映ゲート

AMD OS の通知は「お知らせ」だけではない。多くの通知は、LLM / automation が作った候補を **正本に入れてよいか確認するゲート**。

## 22.1 通知の種類

| 種類 | 主なテーブル | 役割 |
|---|---|---|
| L2 通知 | `l2_notifications` | L2 候補・差分候補の確認 |
| MTG 通知 | `meeting_notifications` | 議事録 / MTG サマリ確認 |
| アプリ通知 | `app_notifications` | OS 運用上の通知 |
| Slack nudge | Slack DM + signed URL | 入金確認、PL承認など |

## 22.2 `/notifications` でやること

`/notifications` は admin 向け。カードを展開して、候補の内容・根拠・既存 feedback を見て判断する。

| 操作 | 何が起きるか |
|---|---|
| はい・反映 | candidate / pending を active / confirmed / applied へ昇格 |
| いいえ・不採用 | rejected / invalid にする |
| コメントだけ送信 | 正本反映せず、`l2_feedbacks` に修正依頼として保存 |

回答後は未対応から外れ、回答済みとして扱う。

フィルタ、既読 / 未読、kind 別 deep link、cockpit 側の経営ハイライト修正履歴は [28 章](28-notification-review-and-strategy-signals-spec.md)。

## 22.3 正本反映ゲート

| l2_kind | 保存時 | はい | いいえ |
|---|---|---|---|
| `member_knowledge` | 現 schema に `status` 列なし | TBD | TBD |
| `project_knowledge` | `candidate` | `active` | `rejected` |
| `protocols` | `candidate` | `confirmed` | `rejected` |
| `founding_members` (= 関連メンバー) | `tentative` | `active` | `invalid` |
| `project_registry_diff` | `pending` | DB反映 + `applied` | `rejected` |
| `xrl_evidence` | `candidate` | `confirmed` | `rejected` |
| `ms_progress` | `pending revision` | `confirmed` / progress 反映 | `discarded` |
| `raw_data_gap` | 通知のみ | feedback記録 + 再抽出/抽出経路確認。現物DB取り込みは保証しない | feedback記録 |

経営ハイライト (`project_strategy_signals`) は `candidate` / `confirmed` / `rejected` / `archived` を持つ。cockpit には candidate も表示するが、未確認であることを明示する。

`raw_data_gap` は「はいを押すとOSへ取り込まれる」通知ではない。raw source は見つかったが、L2化先・backfill経路・helper/UI対応が未確定なときに使う。取り込める候補が明確なら、OS台帳差分は `project_registry_diff`、XRL根拠は `xrl_evidence`、MS進捗は revision、MTGは `meeting_summary` に寄せる。

## 22.4 つくよみ修正依頼

```text
候補に違和感がある
  ↓
通知 / cockpit からコメントを送る
  ↓
l2_feedbacks に保存
  ↓
次回抽出に過去 feedback を含める (対応済み領域のみ)
  ↓
抽出結果を改善する
```

`l2_feedbacks` は「人間が直したいと思ったこと」の正本。コメントは短くてもよいが、何が違うのかを書くと次回抽出が改善しやすい。

例:
- 「これは LOI じゃなく NDA」
- 「この人は関連メンバーではなく VC 担当」
- 「この MS は PM 手動確定済みなので上書きしない」
- 「この external signal は SX には追い風だが CTB には関係ない」

## 22.5 現状ギャップ

2026-05-25 時点では、L2 ②④⑤⑥ の自動取り込みに未復旧領域がある。

| L2 | 状態 |
|---|---|
| ② AMD Protocol | 自動取り込み復旧予定。yes status は `confirmed` |
| ④ PJ ナレッジ | 自動取り込み復旧予定 |
| ⑤ メンバーナレッジ | 自動取り込み復旧予定。現 schema に `status` 列なし |
| ⑥ MTG サマリ | 自動取り込み復旧予定 |
| ⑨ 経営ハイライト | 抽出は動いているが、修正依頼ループは未実装 |

つまり、feedback UI だけ見ても「次回改善」がまだ完全には閉じていない領域がある。復旧計画は開発者向けマニュアルで管理する。

## 22.6 入金確認・PL承認 nudge

通知には L2 以外の業務 nudge もある。

| nudge | 起点 | 反映先 |
|---|---|---|
| 入金確認 | `payment-confirm-nudges` / `/admin/payouts` / `/payment-confirm` | `billing_cycles.payment_confirmed_at`, `billing_log.detail` |
| freee同期 | `freee-payment-sync` | `billing_cycles.payment_confirmed_at`, `billing_log.detail` |
| 請求額 PL 承認 | PL 承認通知 | `billing_cycles.status`, `budget_yen` |

これらは LLM を使わない運用処理。抽出系の未復旧領域とは別枠で稼働する。

入金確認 nudge は active admin への Slack DM。ボタンは 2 つある。

| ボタン | 動き |
|---|---|
| 予定通り入金済み | 予定税込額を即反映 |
| 金額を入力 | `/payment-confirm` で実入金額とメモを入れて反映 |

token と金額計算の詳細は [25 章 Finance / Payment Confirm](25-finance-payment-confirm-spec.md)。

## 22.7 feedback とつくよみ学習

通知への回答は `l2_feedbacks` に保存し、`tsukuyomi_learnings` にも学習メモを作る。`yes` / `no` の時は、allowlist された L2 だけ正本 status も更新する。

| action | 保存 | 正本更新 |
|---|---|---|
| `yes` | `[はい]` prefix 付きで `l2_feedbacks` | kind ごとの `active` / `confirmed` / `applied` へ昇格 |
| `no` | `[いいえ]` prefix 付きで `l2_feedbacks` | kind ごとの `rejected` / `invalid` へ更新 |
| `comment` | コメント本文を `l2_feedbacks` | 更新しない |

詳細な kind 別ルール、即時再抽出、既知ギャップは [27 章 Knowledge Admin / Tsukuyomi](27-knowledge-admin-tsukuyomi-spec.md#276-apinotificationsfeedback)。

## 22.8 既読と履歴

- `notified_at`: iOS / APNs などへ通知した時刻
- `read_at`: PWA で人間が開いた時刻
- `applied_count`: feedback が抽出 prompt に含まれた回数
- `last_applied_at`: 最後に使われた時刻

通知行は削除せず蓄積する。UI は最新100件 + タブで整理する。

## 22.9 関連章

- [01 章 PJ コックピット](01-pj-cockpit.md)
- [28 章 通知レビュー UI / 経営ハイライト確認](28-notification-review-and-strategy-signals-spec.md)
- [27 章 Knowledge Admin / Tsukuyomi](27-knowledge-admin-tsukuyomi-spec.md)
