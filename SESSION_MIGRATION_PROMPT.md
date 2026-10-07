AMD OSの権限一覧と共通ログインの引き継ぎ。作業種別は開発。cwdは /Users/masa/projects/AMD/amd-os のまま使う。

読む順：
1. /Users/masa/projects/AGENTS.common.md
2. /Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md
3. repoのAGENTS.md、HANDOFF_ACCESS_LOGIN_20261007.md。詳細が必要ならHANDOFF_PROJECT_SPACE_PERMISSIONS_20261007.mdとHANDOFF_LOGIN_ENTRY_20261007.md
4. pwa/manual/1-1-intro.md、pwa/spec/1-3-reconstruction-coverage-audit.md、pwa/spec/2-1-pwa-runtime-routes.md、3-24-project-surface-pages-current-spec.md、5-17-dd-package-current-spec.md
5. pwa/manual/2-1-member-quick-start.md、2-6-admin-ops.md、ios/DESIGN.md
6. pwa/BUGS.md、pwa/design_log/sessions_2026-10.mdの同日「権限と共通ログイン」

状態：
権限ページ/admin/permissionsは１人１行、名前・メール・所属の独立３列と、active PJごとコックピット/ワークスペース/DDの３列。閲覧は青、編集は赤。社内activeと外部active/invitedを表示し、初回ログイン前の杉浦先生などを落とさない。確認時は26人・17PJ。表の末尾に必ず空欄追加行があり、３項目入力後に追加/Enterで外部accountだけを登録する。既存メールは上書きせず、権限はセルから別に付ける。
ログイン/auth/loginは全員共通のメール入力と「続ける」１つ。厳密なteam-armada.jpだけGoogleへ、それ以外はメールリンクへ進む。まさの最後の意図は「そもそも社内向けかどうかでUI上で分岐させる必要なくない？ ドメインで判断できるじゃん」。入口選択を戻さず、domainから閲覧権限を付けない。共有URLのnext、既存PKCE、書斎の管理者Google入口を保つ。
未許可メールの既存承認依頼はまさSlack DMと/admin/accessに来る。許可は機関/PJ workspace閲覧のみで、DD/編集は独立。調査だけで通知変更や試験送信はなし。

保存・検証：
初期権限6923efac、招待表示96a30729、追加行2817b000、共通ログイン0e5c1cd5はmainへ保存/push済み。本番のログインv3.161.14でReady/SHA一致・PC1392×824/mobile390×800を確認。closeoutの最新確認では別担当のフェーズ改善も含む1e5dc53f/v3.161.15がmainと本番で一致。docs-onlyの終了記録はこの後のmain履歴を確認する。
migration20261007090000_project_surface_permissionsと20261007171000_workspace_account_affiliationは本番適用・履歴登録済み。再適用しない。関連権限・認証検査、型検査、deploy必須gate成功。登録/付与はDB rollbackとlocal模擬応答、ログイン振り分けは実handler＋通信代替で検証。本番で利用者登録・権限付与・メール/Slack送信・Google実ログインはしていない。資料登録APIの既存固定regex検査失敗は今回のログイン差分と別で、BUGSへ記録済み。
画面証拠は /Users/masa/.codex/visualizations/2026/10/07/01a11471-c176-7972-8339-7eecea332656/ のpermissions-addrow-desktop/mobile.png、login-entry-desktop/mobile.png。一時QA route、server、使い捨てmain clone、viewport変更は終了。iOS/macOS/Androidの管理・外部ログインUIは未移植/未変更。

次の行動：
今回の製品作業の残件はない。まさの次の依頼を待ち、権限一覧・追加行・共通ログインを再実装しない。再開時はgit fetchしてHEADとorigin/main、未保存差分、本番build-infoを読み直す。別担当のフェーズ/Excel変更は既にmainへ反映済み。作業前からの旧未追跡SESSION_MIGRATION_PROMPT_task_based_pt_20260922.mdは、削除せず復元できる保管先へ移す可否をまさに確認中。この旧文書を実行用の正本として採用しない。扱いの最終状態はHANDOFF_ACCESS_LOGIN_20261007.mdの終了判定を読む。

運用：
main一本。新branch/worktreeを作らず、他担当の差分をreset/stash/delete/一括保存しない。対象だけを明示して保存する。実装公開はAMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.shを使い、まとめて１回のpushでReadyと本番を確認。docs-onlyの終了記録は通常pushし[skip ci]で追加実ビルドを避ける。手動Vercel deployや適用済みmigrationの再適用は禁止。メールは送らず、Slack等の対人通知も依頼外に追加しない。nativeを触る新依頼が来たらそのplatformの規則と実機検証条件を先に読む。
