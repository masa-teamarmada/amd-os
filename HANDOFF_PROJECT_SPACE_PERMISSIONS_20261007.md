# PJの３スペース閲覧・編集権限

## 最新：空欄追加行・名前／メール／所属（2026-10-07）

まさの追加依頼：表の最後の空欄から新メンバー登録、名前・メールを別々に保存、所属も必須。先頭３列を名前176/mobile112px・メール224px・所属160px、続けてPJごと３列。最後のtfootは下端に固定、フォームは表示領域幅max720pxで横左端に固定。PC１段・mobile２列２段、4px基準と既存の枠/書体/tokenを維持し、管理者が入力→追加→同じ表で付与を完結する台帳として設計した。

DBはdisplay_name/email/affiliationを独立保存。所属nullableの追加migration 20261007171000は本番適用・履歴登録済み、schema dump再生成済み。既存の所属は未登録—のまま推測しない。新規入力は３項目必須、追加/Enterでaccountのみinvited登録、成功後はフォームを空欄へ戻し追加した行へ移動。既存メール/社内/停止中はcreateOnlyで拒否して既存属性や状態を上書きしない。追加だけで権限や通知を作らない。新規account登録後に付与失敗した場合はそのaccountの選択を保持し再試行できる。

検証：一時的なlocalhostの実コンポーネント＋模擬応答で26→27行、名前・メール・所属の独立表示、未付与、次の空欄、重複拒否、検索0件でも追加行、390pxで横移動731px後もフォーム左25px、Enter登録を確認。本番DBはrollback transactionで３列とinvitedを保存・読戻し、fixture残存0を確認。実利用者の登録・通知・権限付与は今回の検証で行わない。manual/2-6・9-3、spec/2-1・3-24・6-1、ios正本を同期、理論変更なし。ネイティブ管理UIは未移植。

本番検証完了：2817b0004bf2698db75eefca6fa9a60a3c467698、v3.161.13。正規deploy.shの必須検査通過、2分24秒でReady。本番aliasのgit_sha一致、Vercel dpl_JDTMER2SWjDaMLoPhik9in9AqVst Readyを確認。test:space-permissionsは実createAccount関数をDB doubleで実行し、独立３列・invited・監査、既存active/invited/suspended/社内/所属欠測の拒否と書込み0も検証。workspace-access-admin、UI設計検査、ESLint、TypeScriptが通過。

実画面はPC1392px／mobile390×800で３つの識別列、既存26人、常設の空欄tfoot1行を確認。SOL杉浦先生のworkspace/DD閲覧を維持。追加フォームPC720×80px、mobile284×160px、mobile全操作44px、ページ横溢れなし。横移動499px後も名前と追加欄は左80.9pxで固定。表示・操作・余白・固定列を点検し評価8.5/10、表示blockerなし。証拠はpermissions-addrow-desktop.png／permissions-addrow-mobile.png。実画面では保存しない。追加の実操作は前記local模擬環境とDB rollbackで検証した。一時QA route・dev server・clean cloneは撤去済み。正規checkoutのorigin/mainとの0/0を確認、別担当の事業計画/Excel/SOLフェーズ差分と旧移行プロンプトのみ保持。

まさの通知先の質問も現行実装・本番DBで確認。未登録／利用可能権限なしのemail-startは承認要求台帳へ記録し、ID001のSlack DMへ通知（30分同一要求/全体20件毎時）。許可/拒否/管理画面ボタン、承認待ちはadmin/access。最新の既存要求1件はapproved/not_neededだがDM channelと投稿tsを保持し、送信記録がある。現在のSlack承認は機関/PJ workspace readonly、DD grantとは独立。通知の試験送信・変更は行わない。

## 最新訂正：招待済みメンバーの表示漏れ（2026-10-07）

まさの杉浦先生・他にも漏れがあるという指摘から全利用者を本番DBのGETで監査。社内active13人、外部14人のうちinvited13人全員が進行中PJの権限を付与済みだった。初回ログイン前というだけで表と付与選択から除外していた条件を修正した。外部suspendedの動作確認用1人は停止・DD失効済みで引き続き対象外。

現在の対象は社内active・外部active/invitedとactive PJ。杉浦美羽先生・石原先生はSOLワークスペースと正式DDの閲覧、名前未登録6人はSOLワークスペース、他5人はSEワークスペース。名前未登録はメールで区別し、招待済みは名前下に「初回ログイン待ち」を表示する。付与・アカウント状態・登録名は変更していない。下のv3.161.6時点のinvited除外・13人表は過去検証であり、この訂正が現行仕様。

検査：招待済みの既存権限・名前未登録の識別・停止中除外・未付与PJ/surfaceの境界をtest:space-permissionsで確認。ESLint・UI設計コード検査通過。本番DBから全26人×17 active PJを生成し、対象者との不足0／余分0、招待済みworkspace13件・正式DD2件を照合。manual/2-6・9-3、spec/2-1・3-24・6-1、ios/DESIGN.mdへ同期。理論変更・追加migrationなし。ネイティブ管理UIは従来どおり未移植。

反映先はmain、正規deploy.sh経由。共有checkoutに残る事業計画・Excel関連とSOLフェーズ台帳の別担当差分、旧移行プロンプトは今回のcommitに含めない。実装の復旧は今回のcommitをmainでrevertして通常反映する。

最終検証：96a30729217b413e575c602fa7fd21cb07657be5、v3.161.12。正規deployの必須検査とTypeScript検査通過、1分56秒で本番反映。Vercel dpl_4ES2hKbVYgfuC7fKRhNTZj5HA2dZはReady、本番aliasのgit_sha一致。実画面で26行・招待済み13行、付与選択26件、杉浦先生・石原先生のSOL workspace/DD閲覧、SEの招待済み5件の閲覧、停止中の検証用account除外を確認。保存を実行せず利用者権限・状態・通知は変更していない。

PC1392px／スマホ390×800で名前2行は約45pxの行高に収まり、ページ横溢れなし。スマホ名前列112px、表内115px横移動後も名前左80.9px・SOL名左192.9pxを維持しworkspace/DDの青い閲覧を同時確認。証拠はローカルpermissions-invited-desktop.png／permissions-invited-mobile.png。視認性・行密度・固定列・操作の確認を通過、評価8.5/10、表示blockerなし。viewportを戻し杉浦先生のSOL行を本番タブに保持。検証用clean cloneはpush一致・cleanを確認して削除済み。正規checkoutはorigin/mainとの0/0を確認。同期棚卸しは上表と同じ、今回追加の招待済み表示もmanual/spec/ios正本へ反映済み。

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
