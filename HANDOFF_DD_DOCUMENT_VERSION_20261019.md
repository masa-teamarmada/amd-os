# DD資料の版と変更履歴

2026-10-19。まさ依頼：OSの版と別にDD資料v2.0.0を表示し、ダウンロードにも付記、変更ログを保存する。

正本spec5-17、manual2-6、db_schema。DBのdocument_versionとdd_report_releasesを追加、両migration適用済み。SOLの現行editionは内部r85、移行元v1.20を保持して資料v2.0.0、変更履歴1件。将来のrevision更新はpatch版と履歴を同じtransactionで追加。本文・モデル・grant・NDAは変更なし。

画面上部の版と開閉履歴、PDF・Excel内容とZIP/PDF/Excel保存名、同梱相互参照、version付き出力cache/競合検査を実装。履歴は認可後・package一致を検証して版別キャッシュと500件のページ取得で読む。履歴表はRLS有効、serviceは読取/追加のみ。

検証済み：DD回帰、critical UI、対象eslint、8GB上限の型検査。DBはrollback検査で自動2.0.1、履歴1件の同時追加、過去版拒否、公開role権限なし・service削除権限なし、rollback後2.0.0/r85/履歴1件を確認。最初の4GB型検査はメモリ不足のため8GBで再検査成功。

本番反映・画面・実ファイル確認は、このcommitの正規deploy後に実施する。Swift/iOS/macOS/Androidは既存ブラウザのDD入口を利用、専用画面の追加はなし。OSマニュアル同期：版・履歴・出力名=spec5-17/manual2-6/ios DESIGN、履歴=spec6-1/manual9-3、すべて同期。BZM/model理論変更は対象外。

初回本番v3.163.28/bad16aa9で版と履歴の表示は確認済み。新しい出力キャッシュの再生成時、既存Lucideのclient境界でPDF処理が止まる問題を本番ログで確認。見出し・略歴の20アイコンを同一形状の静的SVGへ変更し、20形状の一致、DD回帰、型検査、静的検査を通過。v3.163.29として正規反映し、実ZIP確認を続ける。
