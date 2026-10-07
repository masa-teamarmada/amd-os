# 権限一覧・メンバー追加・共通ログインの引き継ぎ

更新：2026-10-07 JST。作業種別：development。今回の依頼は実装・本番確認まで完了。新しい機能の追加依頼はなし。

## 現在地

- `/admin/permissions`は１人１行、名前・メール・所属の３列とactive PJごとのコックピット／ワークスペース／DD３列。閲覧は青、編集は赤。有効な社内active・外部active/invitedを含み、初回ログイン前の人も除外しない。
- 表の最後に空欄追加行を常設。名前・メール・所属を別のDB列へ保存。追加/Enterで外部accountだけを登録し、権限は各セルから別途付与。既存メール・停止済みを黙って上書き/再開しない。
- `/auth/login`は全員共通のメール入力＋「続ける」。厳密なteam-armada.jpはGoogle、その他は既存メールリンク。domainは認証方式だけを選び、権限は既存サーバ/DBが検査する。
- 未許可メールの承認依頼は既存のまさSlack DMと`/admin/access`へ。承認は機関/PJワークスペースの閲覧のみ。DD・編集は別付与。通知経路は調査のみで変更/試験送信なし。
- 実装・検証の詳細：[権限一覧](HANDOFF_PROJECT_SPACE_PERMISSIONS_20261007.md)、[ログイン](HANDOFF_LOGIN_ENTRY_20261007.md)、[開発履歴](pwa/design_log/sessions_2026-10.md)。恒久仕様は下記spec/manual。

## 保存・公開・検証

- 権限の初期実装`6923efac`、招待済み表示`96a30729`、空欄追加/独立３列`2817b000`、共通ログイン`0e5c1cd5`はmainへ保存/push済み。
- ログイン自身の公開はv3.161.14、production Ready・SHA一致・PC1392×824/mobile390×800を確認。後続の別担当変更を含む最新本番はv3.161.15 / `1e5dc53f87df670c28559abd267588d4378c787c`で、closeout時にbuild-infoとmainの一致を確認。
- 追加schemaのmigration `20261007090000_project_surface_permissions`と`20261007171000_workspace_account_affiliation`は本番適用・履歴登録済み。再適用しない。
- 権限/メール認証/次画面/critical UIの検査、型検査、正規deploy必須gateを確認。保存系はDB rollbackとlocal模擬応答、ログイン振り分けは実handler＋通信代替で検証。本番利用者登録、権限付与、メール/Slack試験送信、Google実ログインを検証名目で行わない。
- 資料同名raceの既存固定regex検査は今回未変更の資料APIでも失敗。`pwa/BUGS.md`に既存記録あり。ログインの検査成功と混同しない。
- スクリーンショット：`/Users/masa/.codex/visualizations/2026/10/07/01a11471-c176-7972-8339-7eecea332656/`内のpermissions-addrow-desktop/mobile.png、login-entry-desktop/mobile.png。
- iOS/macOS/Androidの管理・外部ログインUIは未移植/未変更。ネイティブへの移植依頼は今回なし。

## リポジトリと終了判定

- cwd実パスは`/Users/masa/projects/AMD/amd-os`。mainのみ、本体worktree１つ。追加branch/worktreeなし。今回の実装未保存/未pushなし、競合なし。
- 別担当のフェーズ/Excel変更は`1e5dc53f`へ保存・push・本番反映済み。所有差分として再保存/再変更しない。
- 旧未追跡`SESSION_MIGRATION_PROMPT_task_based_pt_20260922.md`は作業前からの歴史資料。保管先への移動はまさに確認中。実行用正本として読ませず、今回の実装commitにも混ぜない。quarantine ownerは旧「タスク方式への変更」担当/最終判断まさ。次の判断条件はこの１ファイルの保管先への移動可否の回答。未回答なら`do not archive`。
- 既存2026-08-03/04のstash２件はHTML preview等の保管物。このセッションで作成/適用/削除なし。
- 一時QA route・dev server・使い捨てmain clone・viewport overrideは撤去/解除済み。必要な画面証拠だけはリポ外の既知保存先へ保持。
- 会話の検討材料は0件。今回の判断は製品UI仕様であり、個人特性として保存しない。

## 次の行動と読む順

新しい作業はまさの次の依頼を待つ。再開時はgit fetchと実際の差分・公開版を確認し、この依頼を再実装しない。残る終了条件は旧未追跡文書の扱いだけ。

1. `/Users/masa/projects/AGENTS.common.md`、AMD level memory、repo `AGENTS.md`
2. この引き継ぎ、必要に応じて個別２枚
3. `pwa/manual/1-1-intro.md`、`pwa/spec/1-3-reconstruction-coverage-audit.md`
4. `pwa/spec/2-1-pwa-runtime-routes.md`、`3-24-project-surface-pages-current-spec.md`、`5-17-dd-package-current-spec.md`
5. `pwa/manual/2-1-member-quick-start.md`、`2-6-admin-ops.md`、`ios/DESIGN.md`、`pwa/BUGS.md`

同期ゲート：manual2-1/2-3/2-6/9-3、spec2-1/3-23/3-24/5-17/6-1、designのregistry/schema/SPEC、ios/DESIGNを保存済み。理論・数式・model/BZMは対象外。詳細棚卸しは開発履歴の同日「権限と共通ログイン」を参照。
