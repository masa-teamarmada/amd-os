# 自社名刺案の保存・版管理

更新: 2026-10-12。PWA実装。利用停止者のRLS拒否は `20261012092110_amie_card_active_members.sql`（適用済み）。共通DB migration `20261012072118_amie_project_card_designs.sql` は本番適用済み。

## 画面と保存

全PJの社内コックピット「PJ管理 > 名刺案」（`?tab=card-designs`）、管理者の `/admin/card-designs` に同じ一覧部品を置く。管理者一覧は全PJ・氏名・ブランドで絞り込む。一種類一行、選択した版の表裏PDF・編集元・入稿PDF・履歴・用紙・発注記録を同じ面で表示する。外部ワークスペース/DDには追加しない。交換した相手の名刺 `/business-cards` と別台帳。

Driveは `projects.drive_folder_id` 直下の完全一致 `0_名刺` が保存先。未登録ルート、複数同名フォルダ、権限不足をエラー表示し、他PJへ代替保存しない。準備操作は0件なら作成、1件なら再利用、作成後に再照合する。登録フォームはDrive保存済み資料のURLを受け付ける。自動アップロード・印刷発注は行わない。

## データ・操作

`project_card_designs` は所有PJ・対象者キー・名刺種類の系列と最新版/承認版ポインタ、`project_card_design_versions` は変更されない版と承認状態、`project_card_design_projects` は関連PJリンク、`project_card_design_assets` は版別資料。列・制約・RLS・RPCの完全な再構築正本は上記migration。

POST `/api/project-card-designs` は氏名・ブランド・版名・関連PJ・資料・用紙を登録する。新しい版はdraft/review。request_keyで再送を冪等化、expected_versionで競合を409にし、RPCトランザクション内だけで版と採用ポインタを進める。承認は `/api/project-card-designs/{designId}/approve` の確認チェック＋同じ版番号照合。確認用・表・裏PDFの3種類が必須。新案は承認済みポインタを変えない。

登録時にDrive親フォルダ・MIMEを検証。PDFは実体を取得してSHA256を計算、private `workspace-files` のハッシュ付きパスへupsertなし保存し再ダウンロード照合する。表/裏は各1ページ97×61mm（91×55mm＋四辺3mm、誤差1pt）。20MB上限。編集元はDrive参照のまま。失敗時に前版を維持し、PDF保存だけ成功した場合の未参照オブジェクトは非公開のまま残る。削除は別途監査対象。

PDFの画面URLは `/project/{ownerProjectId}/card-designs/{designId}/assets/{assetId}`。PDF.js 6.4.299で保存済みPDFをcanvas描画し、Chrome内蔵PDF表示に依存しない。worker/CMap/標準フォントは同版のpublic/vendor/pdfjsへ同梱、外部CDNを使わない。font-faceとWASMを無効化して埋込フォントのパスから描く。PDF中のリンク/スクリプトは実行しない。原本ダウンロードと非PDF資料の安定したURLは `/api/project-card-designs/{designId}/assets/{assetId}/open`。毎回ログイン・所有PJ・資料PJ・版所属を再検証し、PDFを返す。4MB超だけ60秒有効の配信用署名URLへ転送し、台帳には保存しない。PDFから連絡先・住所を抽出しない。発注JSONには配送先/支払カードを入れない。

## 権限・読取り

activeな社内メンバーの既存cockpit read/editを利用。APIと直接RLSの両方でinactiveを拒否する。adminのみ横断一覧。APIは所有PJと資料PJ双方のread、登録は関連PJ全部のeditを確認する。同一オリジンのPOSTのみ。authenticatedはRLS SELECTだけ、書込みRPCはservice_roleのみ。外部JWT・anonは読み書きできない。共有/DD向け公開操作を提供しない。

GETは認証再検証後、権限内容を含むキーで30秒サーバ保持し同時取得を束ねる。安定順序の500件ページ読みにより1000行制限を跨ぐ。private/no-storeは権限変更後にHTTPキャッシュから返さないため。クライアントは共通参照キャッシュ30秒、書込み成功後に無効化。fresh=1はサーバ再読取り。全版を同じ一覧に含み、行選択後の追加読取りを不要にする。

## 初期登録と検証

`pwa/scripts/data/amie-card-initial-import.json` と `amie_import_project_card_designs.mjs` は初期登録を再現する。既定dry-run、--applyでPDF写し＋RPC。p00:チームアルマダr8承認/100枚アラベール200kg。p21:SOL単独2026-09-27承認、SOL＋チームアルマダr7確認待ち（関連p00）。既存の承認/注文証跡だけ採用し、併記案を承認しない。出荷予定と到着実績は別。

`test_amie_card_designs.sql` は全fixtureをROLLBACKし、再送・版競合・旧承認版保持・anon/外部/直接書込み拒否を確認する。型検査・参照キャッシュ契約・PJフォーマット契約・全deploy検査を実行。ブラウザ検証結果は実施後のhandoffに記録する。

iOS/macOS/Androidの専用画面は未移植。既存名刺OCR画面の挙動は変更なし。

PDF閲覧は所有PJを含むURLとし、PJ限定の社内メンバーも既存cockpit閲覧権限で開く。layoutとページ双方で判定し、URLのPJとDBの所有PJが一致しない場合は404。旧global PDF閲覧URLは認可後に新URLへ転送する。外部workspace権限だけでは開かない。
