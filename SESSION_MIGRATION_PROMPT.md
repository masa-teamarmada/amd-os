AMD OSのDD修正を引き継いで。cwdは /Users/masa/projects/AMD/amd-os。
読む順:
1. /Users/masa/projects/AGENTS.common.md
2. /Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md
3. /Users/masa/projects/AMD/amd-os/AGENTS.md と pwa/manual/1-1-intro.md
4. pwa/HANDOFF_dd_spaces.md
5. pwa/spec/3-24-project-surface-pages-current-spec.md、5-17-dd-package-current-spec.md、3-23-project-format-current-spec.md
6. pwa/BUGS.md と pwa/design_log/sessions_2026-10.md のDD引き継ぎ項

まさの指定: コックピット・ワークスペース・DDは並列。見れる人と表示ページだけが違い、同じページ本文・同じ正本データを使う。タブ名だけを揃え、DDだけQA抜粋にする実装には戻さない。
ホームPJカードのコックピット導線、戻る/進む、DDのプレビュー帯・一覧削除、3領域の◯表、指定ページ追加、活動実績→沿革への改名は反映済み。
本文共通化は faa5dc17、6e1b66d2、7fa04c9c、4f52e150 でmainへpush済み。本番v3.157.1の表示を前セッションで確認。引き継ぎ開始時のmainは6d75f288、origin/mainと一致。後続作業が進むため開始時にfetch・status・配信版を再確認。
DD入場認可とPJ所属は独立。汎用APIへDD付与を流用しない。書込み権限を追加しない。ファイル公開・正式PDF選択は維持。migration469は適用済み、再適用しない。
検証済み: DD契約・共有データ再現試験・型検査・build・配信ゲート。Chromeで技術/競合本文の3領域一致、狭幅、主要タブ、会社概要の更新を確認。既存workspace資料同名race契約と旧workspace-route契約の失敗は別領域。ネイティブDDは未移植。
次の製品変更は未指定。追加依頼が来たら上記仕様を土台に対象を確定し、表示だけでなく認可後のデータ取得と本文一致を確認して進める。
共有checkoutには月次報告書/PDFの別作業と旧タスクpt移行プロンプトの未追跡ファイルがある。DD作業に混ぜてcommit・削除・stashしない。詳細はHANDOFF_dd_spaces.md。所有者の処理完了が確認できるまで共有checkoutをcleanと呼ばず、アーカイブ不可。
main一本。自分の対象だけstage。PWA変更は仕様・manual・ios/DESIGNを同期し、AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh でpushと配信確認。秘密値・外部通知・新しい公開付与を勝手に追加しない。
