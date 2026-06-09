# 契約管理

`/contracts` は、契約締結の予兆から押印版保存までを追う backoffice 画面。契約書は機密性が高いので、初期実装では admin だけが見られる。

## 見るもの

| 項目 | 内容 |
|---|---|
| 契約予定枠 | 予兆または手動で作った契約候補 |
| status | `予定枠` / `作成中` / `レビュー中` / `押印待ち` / `押印済み` / `停滞` / `中止` |
| version history | 契約書ドラフト、修正案、赤入れ、押印版のDrive metadata |
| signed missing | 押印版がまだ登録されていない契約 |
| dry-run | 5生データからの予兆候補と、Slack nudge候補 |

## ファイルの置き場

契約書ファイル本体はDriveに置く。

```text
共有ドライブ/ARMADA/a3_backoffice/契約
```

OSにはDrive file id、link、version label、押印版かどうかだけを保存する。契約書本文やメール全文はDBに入れない。

## 予兆検知

予兆dry-runは Gmail / Slack / Notion / Drive / Calendar の5生データを見て、`契約書`、`NDA`、`業務委託`、`共同研究契約`、`MOU`、`押印`、`電子署名`、`DocuSign`、`クラウドサイン`、`修正案`、`法務確認` などを拾う。

高確度のものだけ予定枠化候補。曖昧なものはreview扱いにする。

## Nudge

押印版が保存されないまま一定日数を過ぎた契約は、Slack nudge候補になる。初期実装はdry-runだけで、Slackへ実送信しない。

実送信に進む時は、送信先PJ channel、文面、対象件数、送信タイミングを確認してから進める。
