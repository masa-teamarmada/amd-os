# 2026年11月 開発履歴

## 2026-11-05 月次試算表とAdminのcloseout

月次財務更新と残高線再計算の修正（147755452・034bb0e97）後、独立した月次試算表とAdmin閲覧順を0ad89a5efで追加。本人の既存visitを集計するservice_role専用RPC・indexのmigration 20261104100247適用済み。新規追跡・環境変数追加なし。ManagementのAdmin移設と相互リンク削除はbd364a248。旧URL履歴を新URLに合算。DB金額・モデル式は移設時に変更していない。通常のGit送信がGitHub障害で失敗した0ad89a5efは、同じtree・同じcommitをGit Data APIで再現し、force=falseで反映した。bd364a248は通常deploy.shで成功。

本番ビルド・型検査、重要導線・画面登録・閲覧数・資金計算検査、PC Chromeで確認済み。追加ローカルビルドは並行作業開始時に中断し、本番の同一commit検査を最終根拠とした。2026-11-05のcloseout確認では本番v3.165.13とmain/origin/main d7a562341が一致、dirtyなし。画面変更なしの引き継ぎ記録を保存。


## 2026-11-05 データ変更履歴の可読化と引き継ぎ

ユーザーの「何がどう変更されたのか分からない。全履歴を人間がすぐ理解でき、今後も同じ形式になるように」という依頼で実施。73cc6039aで表示台帳・名称解決・日本語の変更前後・一括内訳・詳細全項目・record_context・追加漏れ検査を追加。正本spec5-2、操作manual2-6、共通列db_schema、全画面正本ios/DESIGNへ同期した。新しい秘密値・環境変数・定期処理は追加していない。

全体build・型/静的検査・回帰・配布容量検査、PC Chromeと実データ1000件の名称解決、検索/空結果/詳細/記録情報/ページ送りを確認。表示確認用HTMLと画像、提出前点検readyを検証資料フォルダへ保管。共有checkoutで別作業が始まったため、確定したcommitだけをmainの反映用cloneでdeploy.shから送信し、v3.165.15のSHA一致を確認してcloneを撤去した。

後続の別作業57fcfea48はL2M専用データの分離・削除・監査対象の明示登録を実施。これは当チャットの表示改善とは別の作業として現行specを参照する。引き継ぎ着手時はmain/origin/mainと本番v3.165.17が9c3d84c96で一致し、差分・競合・未送信なし。現行test:data-change-historyも成功。引き継ぎ先はHANDOFF_CHANGE_HISTORY.md、同文の再開指示はSESSION_MIGRATION_PROMPT.md。個人の対話証拠は製品設計のため0件。
