# DD資料の版と変更履歴

2026-10-19。まさ依頼：OSの版と別にDD資料v2.0.0を表示し、ダウンロードにも付記、変更ログを保存する。

正本spec5-17、manual2-6、db_schema。DBのdocument_versionとdd_report_releasesを追加、両migration適用済み。SOLの現行editionは内部r85、移行元v1.20を保持して資料v2.0.0、変更履歴1件。将来のrevision更新はpatch版と履歴を同じtransactionで追加。本文・モデル・grant・NDAは変更なし。

画面上部の版と開閉履歴、PDF・Excel内容とZIP/PDF/Excel保存名、同梱相互参照、version付き出力cache/競合検査を実装。履歴は認可後・package一致を検証して版別キャッシュと500件のページ取得で読む。履歴表はRLS有効、serviceは読取/追加のみ。

検証済み：DD回帰、critical UI、対象eslint、8GB上限の型検査。DBはrollback検査で自動2.0.1、履歴1件の同時追加、過去版拒否、公開role権限なし・service削除権限なし、rollback後2.0.0/r85/履歴1件を確認。最初の4GB型検査はメモリ不足のため8GBで再検査成功。

本番反映・画面・実ファイル確認を完了。Swift/iOS/macOS/Androidは既存ブラウザのDD入口を利用、専用画面の追加はなし。OSマニュアル同期：版・履歴・出力名=spec5-17/manual2-6/ios DESIGN、履歴=spec6-1/manual9-3、すべて同期。BZM/model理論変更は対象外。

初回本番v3.163.28/bad16aa9で版と履歴の表示は確認済み。新しい出力キャッシュの再生成時、既存Lucideのclient境界でPDF処理が止まる問題を本番ログで確認。見出し・略歴の20アイコンを同一形状の静的SVGへ変更し、20形状の一致、DD回帰、型検査、静的検査を通過。v3.163.29として正規反映し、実ZIP確認を続ける。

## 完了確認

本番はv3.163.29 / 1ff693a673cbf5e497228a126316bbe28240746c。正規deploy.sh完了、/api/build-info一致。Mac ChromeでAMD OS版とDD資料v2.0.0、変更履歴の開閉と初回の版・日時・説明を確認。画面から実ZIPを取得し、実保存名と同梱2ファイルにv2.0.0、PDF132ページ・39資料、Excel21シートを確認。

ExcelのB3と全21シートの印刷ヘッダ、内部JSON、PDF先頭・章見出し・メタデータに版を確認。前版r85の数値・数式106,828セル一致。ExcelからPDF94件、PDFからExcel344件の同梱参照を同じv2.0.0名で検証。見出し・略歴アイコン20形状の一致と、PDF先頭・本文のレンダーを確認。

Drive日付フォルダ：261019_DD資料_v2.0.0 (1xQvdwRMtE_BDP_mJqQsiF7FIpIiGRNWL)。資料・制作元・検証と変更前控えを保存。0_配布用/DD用資料/いよぎんキャピタル向けのPDF/Excelを最新版へ更新し、正本と配布用4ファイルの名前・親・サイズ・全バイトとSHA256一致。旧r85配布コピー2件を既存履歴へ移動し、移動先を読戻し。配布用の2一覧、SOL側のDISTRIBUTION_MATERIALS/IYOGIN_FINANCING_MATERIALS/SOL_DD_CONTENTS_PLANを更新・読戻し。

DB最終読戻し：資料2.0.0、内部r85、source v1.20/SHA256保持、履歴1件。変更ログはdd_report_releases正本、画面「変更履歴」で確認。PDFを新規生成する際のLucide client境界エラーは静的SVGへ変更して解消、実出力成功。Cuaのダウンロードイベント待ちはタイムアウトしたが、Chromeの実Downloadsに正しい名前のZIPが完成しており、そこから全内容を検証済み。

本依頼の残作業なし。会話の検討材料0件（製品仕様）。開発変更はmainへpush・本番反映済み。新規branch/worktreeなし、design_logは未変更。検証原本・ログはDrive日付フォルダ。終了記録だけのcommitには[skip ci]を付け、製品版は変更しない。
