# ドライブURL・一覧密度・ワークスペース見出しの引き継ぎ

更新: 2026-10-06 JST。仕事種別: 開発。依頼分は完了、追加の次タスクなし。

## 到達点
- 全PJ共通WorkspaceDocumentRoomに閲覧URLとURLコピーを常時表示。初期は全フォルダのファイルを更新順に表示し、所属フォルダも見える。
- PCではカードを横一列へ縮小。Chrome実測ファイル65px・フォルダ49px。同じ画面に約8ファイル。狭い幅の操作領域は44pxを維持。
- ワークスペースのPC見出しを87pxから46pxへ縮小、タイトル20px、移動ボタン28px。
- DB・API認可・署名URL契約・理論変更なし。PWA共通部品のみ、Swift/macOS/AndroidのUIは未移植。

## 保存先
- 仕様: pwa/spec/3-8-cockpit-current-spec.md、3-16-project-weekly-control-current-spec.md、6-1-appendix-changelog.md
- 使い方: pwa/manual/2-3-pj-cockpit.md、9-3-appendix-changelog.md
- 導線台帳: pwa/design/FEATURE_REGISTRY.md、ios/DESIGN.md
- 検証・設計判断の経緯: pwa/design_log/sessions_2026-10.md、pwa/BUGS.md
- 再開文: SESSION_MIGRATION_PROMPT_DRIVE_20261006.md（汎用SESSION_MIGRATION_PROMPT.mdにも同文）
- 前の汎用再開文は内容不変でSESSION_MIGRATION_PROMPT_FUNCTION_STORAGE_CLOSEOUT_20261006.mdへ保全。

## 検証・配信
- URLコピー20f968b5/v3.160.8、常時表示dd4e6e56/v3.160.9、見出し456a0350（統合8d2816aa）/v3.160.12。すべてmain・本番反映済み。
- 正規deploy.sh、Readyとbuild-info SHA一致、認証済みChromeで表示・実クリップボードへの貼付を確認した。
- TypeScript・対象ESLint・workspace-documents-core・配布必須ゲート成功。
- workspace-documents-contractの同名競合文言正規表現は既存不整合で失敗。変更APIではなく既存routeの「選び直してください」と検査期待の「選び直してね」の差。
- closeout開始時main/origin=d0ece3c4、ahead0/behind0。本番v3.160.15/6e1f408aはこの変更を含む。後続担当の配信状態とは別に扱う。

## 残る別作業と判断条件
- 未追跡SESSION_MIGRATION_PROMPT_task_based_pt_20260922.mdは本作業以前の引き継ぎ資料。担当「タスク方式への変更」01a0c711-2edc-7cc3-b346-fbe198603454へ帰属。内容を変更・削除・一括commitしない。
- quarantine ownerは上記タスク担当。next judgment conditionは同タスク再開時の現行仕様・支払保護状態の照合。古い指示を現行仕様として実行すると支払/参画条件を誤る危険がある。
- 並行担当の開発課題関連ファイルは対象外。進行中担当が自身の実装検証・commit・配信で解消する。本作業の成果と混ぜない。
- 既存の全体HANDOFF_pwa_rebuild.mdは他タスクの履歴を含む。本タスクの再開入口は本書（200行未満）とする。

## 最初の行動
追加依頼がなければ実装を増やさない。再開する場合は共通ルールから読む。fetch後にmainを同期し、現在の配信とPC画面を確認する。密度を下げたり、URLを追加クリックの裏へ戻したりしない。
