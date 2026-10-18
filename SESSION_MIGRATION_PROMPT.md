AMD OSのDD閲覧画面の修正を引き継ぐ。作業場所は /Users/masa/projects/AMD/amd-os。作業種別development。まさ受入済みで、今回の画面修正に残作業はない。新しい依頼を受けてから着手する。

読む順:
1. /Users/masa/projects/AGENTS.common.md
2. /Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md
3. /Users/masa/projects/AMD/amd-os/AGENTS.md と HANDOFF_DD_VIEWER_20261018.md
4. pwa/manual/1-1-intro.md、pwa/spec/1-3-reconstruction-coverage-audit.md、pwa/spec/5-17-dd-package-current-spec.md、pwa/spec/2-1-pwa-runtime-routes.md
5. pwa/manual/2-1-member-quick-start.md、2-6-admin-ops.md、pwa/BUGS.mdの2026-10-18 DD節、pwa/design_log/sessions_2026-10.mdのDD終了節

状態:
確認済み製品はmain/origin/main・本番 v3.163.13 / ac938cd5355a3e8eae0d3002f1def37f642e72fb。終了記録だけのcommitはその後になる。再開時にfetch、status、ahead/behind、公開/api/build-infoを取り直す。恒久仕様は上記spec/manual、実装履歴はdesign_log、バグの原因と再発防止はBUGS。チャットや/tmpを発掘する必要はない。

完了した挙動:
DD上部のOS版・資料別閲覧者を表示。リンクを押すと対象がすぐ青くなり、本文だけに回転マークを表示する。読み込み中も左メニューは表示・操作でき、別資料を選び直せる。同一リンクの連打は抑止。dd/loading.tsxによる全体置換は削除済み。リロード開始時も現在の本文で回転表示。用語はマウスオーバーで説明を開く。
入口は資料一覧、共通前提は左メニュー上部。共通前提の最初の表の縦方向はページ全体でスクロールする。
ヘッダは「PDF+excel一括ダウンロード」だけ。「この資料をPDF」「表・数式付きExcel」「計算条件を編集」「本文を編集」と編集欄は削除。修正はえいみに伝える運用。編集用モデルを閲覧ページへ渡す処理も削除。既存の更新API・認可は維持。旧ボタンは管理者/社内DD編集者向けで、まさだけに限定していなかった。外部アカウントは編集対象外。
ZIPは同じ版のPDFとExcelを収録し、取得後にも版・開示条件を再照合する。出力の本文/数値分担は別作業v3.163.12以降の最新spec5-17を優先する。

別の進行中作業:
共有checkoutに残るPDF/Excel参照改善の13パスは「いよぎんC向けDDパッケージ準備」(01a14258-f17e-75c0-bd20-a505cb3bb891)が担当。activeと現在の実物監査依頼を確認し、closeout手順で担当へ返却済み。対象一覧と保持理由・期限はHANDOFFの表。こちらの終了記録へ混入させず、同担当が監査完了前に検証・仕様同期・commit・正規反映まで担当する。次セッションの最初に同チャットの状態と差分を再確認。新たな依頼がなければその作業を引き取らない。

確認と運用:
DD/閲覧者/ファビコン/用語hover/出力認可とZIPの回帰検査、型・静的検査、正規反映の全検査が通過。Macの実画面でメニュー保持・読み込み途中の選び直し・完了解除・hover・最終編集欄0を確認。ユーザー指定によりスマートフォンのPWA幅は追加確認しない。スマホはSwiftだけで使用する。Swift専用UI、DB schema、RLS、環境変数、経済モデルは今回変更なし。
main一本。新branch/worktree・サブエージェントを作らず、共有差分のreset/stash/delete/一括commitをしない。PWA変更時はspec/manual/附則と必要な共通DESIGN・native handoffを同期。反映は AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh で束ね、READY・公開SHA・Mac実画面を確認。終了記録だけは既存の画面非表示判定に従ってpushし、再構築しない。メールや対人通知は送らない。会話の検討材料0件。
