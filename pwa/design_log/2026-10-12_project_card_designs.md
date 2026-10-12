# 2026-10-12 自社名刺案の開発記録

開発作業。名刺制作の業務正本はAMD/BUSINESS_CARDS、ここはコード/DB/配信/検証の記録。

- 456abf94: 全PJの社内PJ管理タブと管理者一覧、版/承認/資料4表、RLS、service専用保存/承認RPC、Driveフォルダ、PDF固定保存、初期登録3種類。v3.162.22でReady。
- bc14a23c: Chrome内蔵PDF表示が黒い画面となったため、PDF.js 6.4.299と同梱worker/CMap/標準フォントでOS内描画へ変更。CSPなしの同一PDFでも再現したため、検討したヘッダー変更は採用しない。v3.162.23でReady。
- 既存の別作業を含めないため、後段はmainの通常clean clone `/private/tmp/amie-card-ship-20261012` を使用。新branch/managed worktreeなし。正規deploy.shでmain push、Ready/API stampを確認。正規checkoutを再fetchして0/0へ同期。
- mainの別の共通更新後、Chrome実確認はv3.162.24でも通過。親PJの制作仕様/Drive保存先/承認状態は維持。
- 利用停止者はAPIだけでなくRLS helperでも拒否するよう補正。本番適用後、16 inactiveのhelper拒否、authenticatedのactive admin読取り/inactive0件を確認。fixtureはJWTの一時設定のみ、メンバー行変更なし。
- CLI生成時刻とMCP適用時刻が異なったため、今回の2 migrationファイルだけDB履歴の実version 20261012072118/20261012092110へ改名。DDL再適用/本番履歴変更なし。

検証: tsc、eslint、重点UI、参照キャッシュ、全PJフォーマット、Next本番build（2回目はローカルNode heap8GB）、deploy.sh全必須検査。SQLは再送、競合の原子性、前承認版保持、匿名/外部/直接書込み拒否、active gate。全fixture ROLLBACK。

ブラウザ: AMD/SOL各2種類、admin全3種類とPJ絞込/0件、AER未登録表示、3種類のPDF描画、AMD表入稿閲覧/編集元Googleスライドを確認。旧SOL proofは1ページの確認シート、AMD/併記proofは2ページ。PC1487×824、スマホ320×900。body scrollWidth=clientWidth=320、表の内部だけ182→600px横スクロール、scrollLeft320を実操作。新しい操作は44px。表示幅検証はChrome DevToolsの実寸で行い、終了時に解除。確認画像はDriveへ直接保存。

注意: Supabase advisorのauthenticated SECURITY DEFINER警告はcaller自身の許可をbooleanだけで返すRLS helperの意図した権限。anon/PUBLICは実行不可、保存/承認RPCはserviceのみ。主な確認コードはtest_amie_card_designs.sqlとios/supabase/tests/amie_card_active_members.sql。

仕様・マニュアル・DESIGN・機能/スキーマ登録簿・nav・フォーマット鍵を同期済み。最終対象v3.162.25（権限補正と資料同期）。最終配信/closeoutの実結果はDrive QAフォルダのreceiptへ記録。今回の機能での残作業なし、到着実績/併記の承認は未判断のまま保持。
