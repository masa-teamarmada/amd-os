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

## 22.3 正本反映ゲート

| l2_kind | 保存時 | はい | いいえ |
|---|---|---|---|
| `member_knowledge` | `candidate` | `active` | `rejected` |
| `project_knowledge` | `candidate` | `active` | `rejected` |
| `protocols` | `candidate` | `active` | `rejected` |
| `founding_members` | `tentative` | `active` | `invalid` |
| `project_registry_diff` | `pending` | DB反映 + `applied` | `rejected` |
| `xrl_evidence` | `candidate` | `confirmed` | `rejected` |
| `ms_progress` | `pending revision` | `confirmed` / progress 反映 | `discarded` |

経営ハイライト (`project_strategy_signals`) は `candidate` / `confirmed` / `rejected` / `archived` を持つ。cockpit には candidate も表示するが、未確認であることを明示する。

## 22.4 つくよみ修正依頼

```text
候補に違和感がある
  ↓
通知 / cockpit からコメントを送る
  ↓
l2_feedbacks に保存
  ↓
次回抽出 prompt に過去 feedback を含める
  ↓
抽出結果を改善する
```

`l2_feedbacks` は「まさが直したいと思ったこと」の正本。コメントは短くてもよいが、何が違うのかを書くと次回抽出が改善しやすい。

例:
- 「これは LOI じゃなく NDA」
- 「この人は創業候補ではなく VC 担当」
- 「この MS は PM 手動確定済みなので上書きしない」
- 「この external signal は SX には追い風だが CTB には関係ない」

## 22.5 現状ギャップ

2026-05-25 時点では、L2 ②④⑤⑥ の旧 writer が停止している。

| L2 | 状態 |
|---|---|
| ② AMD Protocol | GAS 155 停止。Claude routine 復旧予定 |
| ④ PJ ナレッジ | GAS 155 停止。Claude routine 復旧予定 |
| ⑤ メンバーナレッジ | GAS 155 停止。Claude routine 復旧予定 |
| ⑥ MTG サマリ | GAS 153 停止。Claude routine 復旧予定 |
| ⑨ 経営ハイライト | 抽出は動いているが、修正依頼ループは未実装 |

つまり、feedback UI だけ見ても「次回改善」がまだ完全には閉じていない領域がある。復旧計画は [03 章](03-data-and-extraction.md) と [05 章](05-decisions-and-history.md)。

## 22.6 入金確認・PL承認 nudge

通知には L2 以外の業務 nudge もある。

| nudge | 起点 | 反映先 |
|---|---|---|
| 入金確認 | `payment-confirm-nudges` / `/admin/payouts` | `billing_cycles.payment_confirmed_at` |
| freee同期 | `freee-payment-sync` | `billing_cycles.payment_confirmed_at`, `billing_log.detail` |
| 請求額 PL 承認 | `/api/notify/pl-review` | `billing_cycles.status`, `budget_yen` |

これらは LLM を使わない運用処理。LLM 系 cron 停止とは別枠で稼働する。

## 22.7 既読と履歴

- `notified_at`: iOS / APNs などへ通知した時刻
- `read_at`: PWA で人間が開いた時刻
- `applied_count`: feedback が抽出 prompt に含まれた回数
- `last_applied_at`: 最後に使われた時刻

通知行は削除せず蓄積する。UI は最新100件 + タブで整理する。

## 22.8 関連設計 md

- [`pwa/design/notifications.md`](../design/notifications.md)
- [`pwa/design/l2_extract_claude_routine.md`](../design/l2_extract_claude_routine.md)
- [`pwa/design/L2_DATA.md`](../design/L2_DATA.md)
