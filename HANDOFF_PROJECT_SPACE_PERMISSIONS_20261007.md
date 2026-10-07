# PJの３スペース閲覧・編集権限

まさの依頼：adminにPJごとのコックピット・ワークスペース・DD権限一覧を新設し、新規メンバーへの閲覧・編集付与を可能にする。

正本はpwa/spec/2-1、3-24、5-17、manual/2-6、ios/DESIGN.md。入口は/admin/permissions。内部個別grantは既存所属と独立、外部workspace/DDは従来のgrant。権限は追加型でadmin・既存社内・所属を下げない。DD editは掲載項目編集、外部workspace editは共有資料編集。権限再付与・全社設定はadminだけ。

migration 20261007090000は本番適用済み。Supabase migration履歴にもapplied登録をreadback済み（重複適用不要）。RLSとservice専用RPC、同一transactionの監査を確認。実grantは0、既存の利用者権限は変更していない。grantの保存・読戻しとadmin以外の拒否はrollback付き本番transactionで検証した。

他platformは管理画面未移植。共通DB・capability・APIは利用可能。iOS/macOS/Androidの移植時はscope再確認、既存権限との加算、停止/期限状態、actorを維持する。schema変更を再適用しない。

前セッションのSOL原稿・manual訂正等はSOL担当の変更として保持し、同担当がd1d70969等でcommitしたことを確認。旧SESSION_MIGRATION_PROMPT_task_based_pt_20260922.mdは保管資料で今回の指示に使用しない。

6923efac（v3.161.0）はmain push済み、本番aliasのSHA一致、Vercel TypeScript・630ページbuild成功を確認。画面確認で、同PJの後発検証DDをUUID順で拾う点とスマホダイアログの入力幅を発見しv3.161.1で修正。正式DDは既存DD管理と同じ最初のcreated_atを選び、選択検査を追加。理論変更なし、BZM同期不要。

## 完了・検証（2026-10-07）

- 最終実装はmainの5ddf3d028f8d4bf6f5b34616c60ae191fccd5c3a、v3.161.1。承認済みdeploy.sh経由のmain push後、2分39秒で本番Ready。https://amd-os-pwa.vercel.app/api/build-info のgit_sha一致を確認。
- 本番入口：https://amd-os-pwa.vercel.app/admin/permissions 。PC 1392×824、スマホ390×800で一覧・PJ絞込み・既存権限セル・新規メンバー付与ダイアログを確認。ページ横溢れなし、スマホの表内スクロールのみ許容。ダイアログ幅358px、scrollWidth358px、入力と保存操作は44px以上。
- SOLの正式DDに既存の外部閲覧権限が表示されること、コックピット・ワークスペース・DDを独立した列で判定することを実画面と既存DBで照合。既存メンバー編集、新規外部登録、閲覧/編集選択を操作確認したが、本番画面では保存しない。登録・招待メール・利用者権限の変更は行っていない。
- 保存系はrollback付きSupabase transactionで閲覧付与→読戻し→編集変更、非admin・無効surface・authenticated直接書込み/実行の拒否を確認。永続的な内部個別grantは0件。
- test:space-permissions（PJ/space/member境界、停止/期限、更新対象の所属PJ、DD掲載操作、正式DD選択）、workspace access admin/scope、surface catalog、DD package、project overview/cost model/threeparty、契約一覧・portfolio・project space loading・critical UI検査が通過。deploy.shの必須ゲートも通過し、本番ビルド成功。最終TypeScript検査は8GB指定でexit 0。
- ローカルwebpack生成の旧.next/types/app検査は既存ページの余分なexportで失敗したため、生成物だけを/tmp/amie_space_permissions_legacy_types_app_20261007へ退避し保存。ソースの修正や削除はしていない。現行Turbopackの検査と本番ビルドは成功。ローカルwebpack全体成功とは報告しない。
- 未認証のadmin一覧・保存APIは401、PJ space loader/navとDD編集APIは404を確認。対象PJと利用者をサーバーで認可し、一覧の表示だけで権限を成立させない。
- 他platformの管理UIは未移植。PWAの追加対応は残っていない。移植時は上記正本と本番適用済みmigrationを参照する。

## 終了時の保管と責任範囲

今回の変更はコード・schema・manual/spec・全platform正本・この引き継ぎに保存しmainへpush。復旧は上記実装commitをmainでrevertし通常deploy経路で反映する。新しいtableは追加型で実grant0のため、DDLの削除やmigration再適用は不要。

作業開始前からの未追跡SESSION_MIGRATION_PROMPT_task_based_pt_20260922.mdは旧移行資料として保持し、今回のcommit対象から除外。共有checkoutの保管責任は元の移行作業側で、次の移行再開時に正本との重複を確認する。既存stash2件は2026-08-03/04のHTML preview作業による一時保管であり、今回の作業では作成・適用・削除しない。今回の未commit変更、追加branch/worktree、未push実装は残さない。ローカルの生成物・検証ログは再実行可能な証拠であり起動依存はない。会話証跡の恒久保存候補は0件。

## OSマニュアル同期ゲート

| 差分 | マニュアル | 確定仕様 | 全プラットフォーム正本 | 状態 |
| --- | --- | --- | --- | --- |
| adminのPJ×3スペース一覧・付与 | manual/2-6、9-3 | spec/2-1、3-24、6-1 | ios/DESIGN.md | 同期済み |
| 内部個別コンテンツ編集 | manual/2-3、2-6 | spec/2-1、3-23、6-1 | ios/DESIGN.md | 同期済み |
| DD掲載項目の編集委譲 | manual/2-6、9-3 | spec/5-17、6-1 | ios/DESIGN.md | 同期済み |
| 理論・数式 | 対象なし | 対象なし | model/BZM変更なし | 同期不要 |

## まさの一覧再設計依頼（2026-10-07）

名前を１列目・１人１行、PJごと３スペース列の横長matrixに変更。active PJ/member/accountのみ、未付与も含む。invitedは外部アクセス管理で確認し、初回ログイン後に現役表へ表示。青の閲覧・赤の編集は文字を併記し、固定名前列と２段見出し、表内65dvh以内の縦横スクロール。名前/メール検索とPJ絞込み。付与保存・認可・DBは変更なし。詳細理由はセルのtitle/dialogで確認。

設計：管理者が少人数と複数PJの権限を同じ行で比較する。領域はPJ・所属・３スペース・付与・招待/停止。色は既存の白/灰/黒の台帳に青の閲覧・赤の編集を加える。１人１行とPJ３列の交差点がこの画面の比較単位。縦の繰返し・毎セルの説明行・無条件全幅列拡張を避け、名前112/176px、１スペース96px、行44px、見出し32px×2、4px基準で既存の書体・border tokenを使用。細い罫線とPJ境界、説明は開いた先へ移す。

検証：pure matrix検査にactive人/PJ限定、同一人のメール統合、未付与の人保持、複数PJ/スペースの独立セルを追加。本番画面確認結果は下記。

本番v3.161.5では481行→13人×17 active PJ（51スペース列）の13行を確認。単一PJの外枠を表に合わせ、スマホの名前列を112px、PJ名を左寄せの横sticky文字へ修正し、初期位置と横移動時にPJ名が見切れないように調整済み。

最終反映：4b1deecebbd423396db0bcf97352d848399b0f23、v3.161.6。clean cloneから正規deploy.sh経由のmain push、全必須検査通過、2分19秒でReady、本番aliasのSHA一致。正規checkoutもfetchしてorigin/mainとの整合を確認。直前のmatrix実装e86a3af2は同時進行の組織図担当が正規deploy経路で共有mainごとpushし、そのReadyも確認済み。最終layout修正はこの作業のdeployで反映。

画面検証：PC1392×824で13人×17PJ・51スペース列、名前先頭、１PJ時の外枠466px/表464px（余分な拡張なし）。スマホ390×800でページ横溢れなし、名前列112px、SOL名を読める。表を115px横移動しても名前左80.9px・PJ名左192.9pxを維持。遠いKGWへ移動しても名前列は固定。名前検索１行・空状態も確認。セルから選択済みPJ/人/スペースのdialogを開き、新規外部メンバーの入力も確認。dialog幅358px=scrollWidth、入力/select/保存44px。今回の表示検証では保存を実行せず、利用者権限・通知・登録データの変更なし。明色PC/スマホで視認性・余白・列境界・操作・幾何を確認し、評価8.5/10。未修正の表示blockerなし。

保存証拠はローカルのpermissions-matrix-desktop.png/permissions-matrix-mobile.png。ローカル開発サーバは停止、検証用clean cloneは全件commit/push一致を確認して削除済み。共有checkoutのchangelog2ファイルに残る組織図ルールの重複追記削除は「DD組織図の協業先配置を変更」側の差分として保持し、この作業の追記だけをstageした。残る実装作業なし、ネイティブ管理UIは従来どおり未移植。
