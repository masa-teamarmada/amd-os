# 通知・つくよみ修正依頼・正本反映ゲート

AMD OS の通知は「お知らせ」だけではない。多くの通知は、LLM / automation が作った候補を **正本に入れてよいか確認するゲート**。

## 先に知っておく言葉

| 用語 | 意味 |
|---|---|
| **通知** | ユーザーに見せるカード。単なるお知らせもあるが、多くは候補データの確認依頼。 |
| **正本反映ゲート** | 候補を正式データにしてよいか、人間が「はい / いいえ / コメント」で判断する入口。 |
| **L2 通知** | L2 候補や差分候補を確認する通知。例: PJ ナレッジ、MS 進捗、XRL 根拠、経営ハイライト。 |
| **経営ガードレール** | 見落とすと後戻りが大きい注意点を、PJ / アクションのタグから事前検知する通知。 |
| **candidate / pending** | 未確認候補。表示されても、まだ OS の確定事実ではない。 |
| **active / confirmed / applied** | 確認済み、または正本へ反映済みの状態。 |
| **l2_feedbacks** | 「ここが違う」「次回からこう見てほしい」という修正依頼の保存先。次回抽出の prompt に入れる。 |
| **つくよみ** | L2 抽出と修正依頼ループの担当名。Manual Q&A のつくよみとは別の運用概念。 |

## 通知の種類

| 種類 | 主なテーブル | 役割 |
|---|---|---|
| L2 通知 | `l2_notifications` | L2 候補・差分候補の確認 |
| MTG 通知 | `meeting_notifications` | 議事録 / MTG サマリ確認 |
| アプリ通知 | `app_notifications` | OS 運用上の通知 |
| Slack nudge | Slack DM + signed URL | 入金確認、PL承認など |

## 通常通知と緊急性の高い通知

通知画面では、同じ通知を「緊急性の高い通知」と「通常通知」に分けて表示する。

| レーン | 何を見るか | 例 |
|---|---|---|
| 通常通知 | OSに新データが入った、候補が増えた、通常レビューが必要 | L2候補、MTGサマリ、VCニュース、通常の取り込み経路確認 |
| 緊急性の高い通知 | 見落とすと事故る復旧・ガードレール・明示 blocker | Notion等の再認証、high以上の経営ガードレール、明示 critical の要対応、重要 automation blocker |

緊急性の高い通知は、対応が終わっても削除せず、既読欄から再試行できるものがある。特に connector 再認証は、リンクを開いたことと復旧完了は別なので、復旧できたかは対象 automation の次回成功で確認する。

緊急性の高い通知は右下ポップアップにも出る。ここに出してよいのは `connector_auth`、`metadata_json.notification_priority='critical'`、`metadata_json` 上の blocker / 期限超過 / 再認証など、writer が「今すぐ見るべき」と明示したものだけ。MTGサマリ、契約予兆、総会/役会、D-11メディア掲載、`importance` が高い L2 候補は、タイトルや本文に「事故」「blocker」「再認証」などの語が含まれていても通常通知に残す。

## `/notifications` でやること

`/notifications` は admin 向け。カードを展開して、候補の内容・根拠・既存 feedback を見て判断する。

| 操作 | 何が起きるか |
|---|---|
| はい・反映 | candidate / pending を active / confirmed / applied へ昇格 |
| いいえ・不採用 | rejected / invalid にする |
| コメントだけ送信 | 正本反映せず、`l2_feedbacks` に修正依頼として保存 |

回答後は未対応から外れ、回答済みとして扱う。

すでに正本へ保存済みの通知 (`saved_count >= total_count`) は、画面上では「はい・確認済み」として扱う。D-11メディア掲載のように collector が `project_media_mentions` と通知を同時に作る通知は、採否というより確認・学習フィードバック用になる。ただし `coverage_gap` は例外。候補行が保存済みでも採否は未完了なので、「はい・確認済み」ではなく「経営ハイライトに追加 / 見送る」などの判断ボタンを出す。

D-14 要対応 (`action_item`) は、通知作成時点で `action_items.review_status='candidate'` として保存済み。「はい・確認済み」で `confirmed` になり、dashboard / PJ cockpit の要対応面へ表示される。「いいえ・不採用」は `rejected` にする。

通知を展開したとき、正本行の専用表示がまだ無い種類でも「抽出された行が見つからない」とは出さず、通知本文を詳細欄の fallback として表示する。D-11メディア掲載は `project_media_mentions` の保存済み行を表示する。

`coverage_gap` は「元情報では重要そうだったのに、H-1要約では弱くなったかも」という差分通知。PWAでは `未OS化の可能性` のような内部語ではなく、「経営ハイライトに残す？: ...」という質問として出す。展開すると「元情報で見えていたこと」「H-1要約で弱くなった可能性」「押すと起きること」を表示する。「経営ハイライトに追加」は D-6 へ観測済みシグナルとして残す操作で、H-1要約本文を元に戻す操作ではない。

## iOS Swift版の「通知」タブ

iOS版は下部の `通知` タブから、同じ `l2_notifications` / `meeting_notifications` / `l2_feedbacks` を使う。スマホで連続処理しやすいよう、PWAの一覧とは表示を変えている。

- `判断 / 未読 / 履歴` の3セグメント
- `判断` は未回答を1件ずつカード表示し、次カードを後ろに予告する
- カード内に `観測 → 候補 → 判断 → 正本`、`OSの見立て`、`押すと起きること`、折りたたみ式の`根拠`を表示する
- ボタンは汎用の「はい / いいえ」ではなく、`MS進捗を確定 / 提案を破棄`、`採用候補にする / 見送る`、`根拠として確定 / 不採用`、`確認した / 修正する` のように結果を明記する
- `修正・コメント` は違う箇所のチップと自由記述を `l2_feedbacks` へ保存する
- `あとで` は端末内の永続状態を増やさないセッション内保留。通知画面を開き直すか、全件保留時の`もう一度見る`でキューへ戻る

iOSとPWAで書き込み境界を混同しない。iOSの `project_registry_diff` 採用はcandidate diffをacceptedにするところまでで、実DB（OS台帳）反映はPWA/helperの安全な反映処理が行う。`meeting_summary` の `確認した` は確認記録だけで、要約を再抽出しない。

`connector_auth` は採否候補ではないが、未読の間は `再認証を開く / あとで` の復旧カードとして判断キューに出る。リンクを開いたことは復旧成功ではないため、既読後も履歴から再認証を開き直せる。

## 正本反映ゲート

| l2_kind | 保存時 | はい | いいえ |
|---|---|---|---|
| `member_knowledge` | `candidate` | `active` | `rejected` |
| `project_knowledge` | `candidate` | `active` | `rejected` |
| `protocols` | `candidate` | `active` | `rejected` |
| `founding_members` | `tentative` | `active` | `invalid` |
| `project_registry_diff` | `pending` | DB反映 + `applied` | `rejected` |
| `xrl_evidence` | `candidate` | `confirmed` | `rejected` |
| `ms_progress` | `pending revision` | `confirmed` / progress 反映 | `discarded` |
| `guardrail_match` | `open` | `acknowledged` | `dismissed` |

`project_config_gap`（抽出設定不足）は採否候補ではないため、通知一覧には出さない。dashboard の「抽出状況」で、5つの情報源の最終保存時刻と、PJごとのメール・Slack・Drive設定不足を確認してPJ台帳から直す。

抽出状況の「保存」は、L2の根拠として残った証跡であって、connector の最終チェック時刻ではない。保存が古いことだけを異常にしない。MTG抽出で実際に使えた時刻を別に表示し、未読の再認証通知、PJ設定不足、Calendar接続エラーだけを理由と解決先つきの対応事項にする。既読の再認証通知は過去の案内として扱い、現在の再認証要求にはしない。

Slackを使わないPJは、PJ台帳の `Slack CH` 列で「チャンネルなし」をチェックする。これは空欄のまま放置するのとは違い、抽出状況で設定不足として扱わない明示設定。

経営ハイライト (`project_strategy_signals`) は `candidate` / `confirmed` / `rejected` / `archived` を持つ。cockpit には candidate も表示するが、未確認であることを明示する。

## つくよみ修正依頼

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

### マニュアル限定つくよみ Q&A

`/manual` と `/manual/[slug]` 右下の **つくよみ Manual Q&A** は、上の修正依頼ループとは別物。Gemini が該当する `pwa/manual/*.md` の本文を読んで回答し、「ここ見たらOK」の参照章リンクを返すだけの read-only 実験導線。つくよみキャラとして敬語は使わず、高校生にも分かるくらい噛み砕いて案内する。

- DB に書き込まない
- `l2_feedbacks` / `tsukuyomi_chat_logs` に保存しない
- PJ コックピットや Venture Map の内容を修正しない
- global の visible mascot は復活させず、マニュアル route だけで表示する

## 修正依頼ループの現状

2026-05-25 時点では、D-1D-3D-4H-1 の旧 GAS writer が停止していた。2026-05-29 時点の現行 writer は subscription automation 側に移管済みなので、復旧時は [3-2 章](3-2-data-and-extraction.md) と [8-3 章](8-3-l2-extraction-routines-spec.md) の実行場所つき表を見る。

| L2 | 状態 |
|---|---|
| D-1 AMD Protocol | MMOマシン Codex Desktop automation `amd-os-l2-protocol-extract`。`l2_feedbacks` を prompt に入れる |
| D-3 PJ ナレッジ | MMOマシン Codex Desktop automation `amd-os-l4-project-knowledge-extract`。`l2_feedbacks` を prompt に入れる |
| D-4 メンバーナレッジ | MMOマシン Codex Desktop automation `amd-os-l5-member-knowledge-extract`。schema gap は別途確認 |
| H-1 MTG サマリ | Windows MMO Codex Desktop automation `amd-os-l6-meeting-flow`。MTG修正依頼を次回抽出に入れる |
| D-6 経営ハイライト | Codex automation `amd-os`。修正依頼ループは対話型と接続予定 |

つまり、feedback UI だけでは完結しない。次回 automation がどこで動くかまで含めて確認する。

## 入金確認・PL承認 nudge

通知には L2 以外の業務 nudge もある。

| nudge | 起点 | 反映先 |
|---|---|---|
| 入金確認 | `payment-confirm-nudges` / `/admin/payouts` | `billing_cycles.payment_confirmed_at` |
| freee同期 | `freee-payment-sync` | `billing_cycles.payment_confirmed_at`, `billing_log.detail` |
| 契約由来請求額のPM事後通知 | `contract-billing-auto-confirm` 内部通知 | `billing_cycles.status`, `budget_yen` |

これらは LLM を使わない運用処理。LLM 系 cron 停止とは別枠で稼働する。

## 既読と履歴

- `notified_at`: iOS / APNs などへ通知した時刻
- `read_at`: PWA で人間が開いた時刻
- `applied_count`: feedback が抽出 prompt に含まれた回数
- `last_applied_at`: 最後に使われた時刻

通知行は削除せず蓄積する。UI は最新100件 + タブで整理する。

## 関連設計 md

- [`pwa/design/notifications.md`](../design/notifications.md)
- [`pwa/design/l2_extract_claude_routine.md`](../design/l2_extract_claude_routine.md)
- [`pwa/design/L2_DATA.md`](../design/L2_DATA.md)
