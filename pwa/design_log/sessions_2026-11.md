# 2026年11月 開発履歴

## 2026-11-05 CTBの契約凍結

まさの「契約継続とされても嫌。契約凍結という新しいステータスを作ってそれにして」という指示で、CTBの契約に履行状態`frozen`と開始月`202605`を保存した。migration `20261105122042`を本番適用済み。押印状態`signed`と原本満了日2027-02-13は保持。契約台帳・PJ台帳は「契約凍結」と表示し、管理カレンダーの月次報告は凍結開始月以降を生成対象から外す。凍結前の対象月は保持する。仕様はspec5-6・5-9、操作はmanual2-6・6-7、ネイティブ境界は`pwa/HANDOFF_pwa_to_ios.md`。新規環境変数・定期処理なし。

commit `99bcd56b1`をmainへpushし、`deploy.sh`で本番SHA一致を確認。型検査、管理予定・契約台帳・重要UIの回帰検査、PC Chromeで両台帳の「契約凍結」を確認した。既存のCTB月報予定は0件。Googleカレンダーなど外部の既存予定は削除していない。

## 2026-11-05 月次試算表とAdminのcloseout

月次財務更新と残高線再計算の修正（147755452・034bb0e97）後、独立した月次試算表とAdmin閲覧順を0ad89a5efで追加。本人の既存visitを集計するservice_role専用RPC・indexのmigration 20261104100247適用済み。新規追跡・環境変数追加なし。ManagementのAdmin移設と相互リンク削除はbd364a248。旧URL履歴を新URLに合算。DB金額・モデル式は移設時に変更していない。通常のGit送信がGitHub障害で失敗した0ad89a5efは、同じtree・同じcommitをGit Data APIで再現し、force=falseで反映した。bd364a248は通常deploy.shで成功。

本番ビルド・型検査、重要導線・画面登録・閲覧数・資金計算検査、PC Chromeで確認済み。追加ローカルビルドは並行作業開始時に中断し、本番の同一commit検査を最終根拠とした。2026-11-05のcloseout確認では本番v3.165.13とmain/origin/main d7a562341が一致、dirtyなし。画面変更なしの引き継ぎ記録を保存。


## 2026-11-05 データ変更履歴の可読化と引き継ぎ

ユーザーの「何がどう変更されたのか分からない。全履歴を人間がすぐ理解でき、今後も同じ形式になるように」という依頼で実施。73cc6039aで表示台帳・名称解決・日本語の変更前後・一括内訳・詳細全項目・record_context・追加漏れ検査を追加。正本spec5-2、操作manual2-6、共通列db_schema、全画面正本ios/DESIGNへ同期した。新しい秘密値・環境変数・定期処理は追加していない。

全体build・型/静的検査・回帰・配布容量検査、PC Chromeと実データ1000件の名称解決、検索/空結果/詳細/記録情報/ページ送りを確認。表示確認用HTMLと画像、提出前点検readyを検証資料フォルダへ保管。共有checkoutで別作業が始まったため、確定したcommitだけをmainの反映用cloneでdeploy.shから送信し、v3.165.15のSHA一致を確認してcloneを撤去した。

後続の別作業57fcfea48はL2M専用データの分離・削除・監査対象の明示登録を実施。これは当チャットの表示改善とは別の作業として現行specを参照する。引き継ぎ着手時はmain/origin/mainと本番v3.165.17が9c3d84c96で一致し、差分・競合・未送信なし。現行test:data-change-historyも成功。引き継ぎ先はHANDOFF_CHANGE_HISTORY.md、同文の再開指示はSESSION_MIGRATION_PROMPT.md。個人の対話証拠は製品設計のため0件。

## 2026-11-05 取締役会と開閉カードの視認性

まさの「決議事項が目立たない」「薄いグレーの詳細が読みにくい」「カード全体を押せない」「ホバーでクリック範囲が分からない」という指摘を受け、PWAの機関決定一覧と通常業務画面の開閉カードを修正。`a5636bc95`で比較一覧と色、`49707a2ca`で白地の決議事項主領域、`d7a562341`で機関決定の行全体クリック、`0eeb9b1c4`で通常開閉カードの見出し・余白クリック、`9c3d84c96`でクリック可能面全体の淡青ホバーへ変更。本文・リンク・編集・入力・文字選択・キーボード開閉は独立させ、DD・印刷・ネイティブ画面は対象外。正本はspec3-23とspec2-7、操作はmanual2-3とmanual2-1、全画面正本ios/DESIGN、ネイティブ境界はHANDOFF_pwa_to_native_viewingに同期済み。最後のUI版v3.165.17は当時本番SHA一致とPC Chrome実画面で確認。引き継ぎ着手時は本番v3.165.18（SHA a1adb5c13）でUI版を含み、main/origin/mainは後続の文書commit 21a53d2c5で一致。専用引き継ぎはルートのHANDOFF_DISCLOSURE_UI.md。

## 2026-11-06 請求書の立替税率

立替を含む請求書で、非課税0%を10%へ戻してしまう経路を修正した。立替編集は0%を保持し、請求書発行時は0%・8%・10%だけをfreee明細へ渡す。未設定は既存どおり10%に補完し、想定外の税率は外部発行前に停止する。PWAとiOSの発行モーダルは、基本明細10%と立替ごとの税率を分けて概算税込額を表示する。`check_invoice_expense_rule.mts`に0%・8%・10%と概算の回帰検査を追加した。DB migration・環境変数は変更なし。操作manual6-3、画面仕様FEATURE_REGISTRY、変更履歴manual9-3/spec6-1、Android向け注意はios/HANDOFF_ios_to_androidへ同期。

## 2026-11-10 ゴールツリーの分かったこと

Rejuvidaの記録反映中、えいみがquestion-tree APIで分かったことを提案として入れると400（`Could not find the 'origin_kind' column of 'project_findings'`）。POSTが論理削除対象の全種類へ `origin_kind` を書いていたため、画面からの追加も同じく失敗していた。本番の `project_findings` は `review_state`・`proposal_reason`・`proposed_question_id`・監査列を持ち、`origin_kind` だけが無いことをREST読取りで確認。`6eef6522f`（v3.165.22）で `ORIGIN_KIND_RESOURCES`（question・action）だけへ書くよう修正し、`test:question-tree-task-review` にmigration上の表定義と追加時に書く列の照合を追加（修正前のrouteでは失敗、修正後は成功を確認）。

修正後、提案として入った分かったことが束の組み立てで捨てられ、画面に承認・却下の操作面が無いことが判明。`8f14d083a`（v3.165.23）で `FindingNode.isProposed` を追加し、未承認も線または `proposed_question_id` で論点へ仮に繋いで返す（最終確認日の導出からは除外）。論点行に「分かったこと 未承認N」の印、論点詳細の分かったこと一覧に琥珀色の未承認行と承認・却下を追加。仕様spec3-21、操作manual2-9、変更履歴manual9-3/spec6-1に同期。DB変更・環境変数・定期処理なし。

型検査0件、ゴールツリー状態31通り、重要UI検査が成功。2回とも `deploy.sh` で本番SHA一致を確認。本番でRejuvidaの11/9の分かったことを提案として追加し、PC Chrome（幅1456px）で論点行の印・詳細の未承認表示と承認・却下ボタンを確認。承認・却下は押していない（まさの判断待ち）。スマホ幅は、Chromeのウィンドウ幅を変更できず未確認。
