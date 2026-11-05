AMD OSの変更履歴改善の引き継ぎ。作業場所は /Users/masa/projects/AMD/amd-os（pwaをcwdにしない）。

読む順:
1. /Users/masa/projects/AGENTS.common.md
2. /Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md
3. AGENTS.md、HANDOFF_CHANGE_HISTORY.md
4. pwa/manual/1-1-intro.md、pwa/spec/1-3-reconstruction-coverage-audit.md
5. pwa/spec/5-2-development-operations-current-spec.md「データ変更履歴の表示・保存契約」、pwa/spec/2-1-pwa-runtime-routes.md
6. pwa/manual/2-6-admin-ops.md「データ変更履歴」、pwa/BUGS.md、pwa/design_log/sessions_2026-11.md

状態:
2026-11-05の引き継ぎ着手時はmain/origin/main=9c3d84c96、未保存・未送信・競合なし。本番v3.165.17のgit_shaも9c3d84c96と一致。今回の引き継ぎ保存はその後の画面変更なしのcommitになるので、最新SHAはfetchして確認する。
このチャットの表示改善は73cc6039a。対象名・日本語の項目/状態・変更前→変更後、一括変更の内訳、詳細の全項目、記録情報、変更時の対象名保存と表示名追加漏れ検査を導入した。PC Chromeで実データ、対象名検索、空結果、詳細、記録情報、新旧ページ移動を確認済み。型検査・静的検査・全体build・配布容量検査・回帰検査も実施済み。
後続の別作業57fcfea48でL2M専用データをAMD OS監査から分離し、混入履歴を削除して明示登録方式へ変更。その詳細は現行spec5-2が正本。スクショのゲーム履歴を再表示するために旧ラベルや監査対象を復活させない。9c3d84c96は開閉できる場所のhover表示。
今回の検証資料は /Users/masa/.codex/cleanup_archives/2026-11-05-amd-change-history-73cc6039/ に保存。対象名が当時保存されておらず現行台帳からも取れない旧履歴は「対象名の記録なし」とする。

次の作業:
今回の依頼分に未完了タスクはない。新しいフィードバックを待つ。履歴の読みにくさが再報告されたら、対象の実レコードと意味を確認し、共通の表示処理・表示台帳・回帰検査を同じ変更で修正する。全履歴を展開する重いSQLではなく、保存先別の索引と対象行を限定して調べる。

運用:
main一本。既存の他作業の差分を戻さず、新しい枝や作業ツリーを作らない。変更前と送信直前にfetchして同期を確認する。
正本はspec5-2、操作はmanual2-6。新しいAMD OS表は表示台帳・検査基準・非公開の監査対象台帳へ同じmigrationで登録する。適用済みmigration 20261105012202/20261105015441/20261105021010/20261105021635は再適用しない。
コード変更時は「cd /Users/masa/projects/AMD/amd-os/pwa && npm run test:data-change-history」と変更に適した検査、PC Chromeの実画面確認を実施。スマホWebとSwiftの追加検証は依頼時のみ。
画面変更の本番反映は版を更新し、リポジトリルートから AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh。直接のVercel公開は使わない。画面に出ない引き継ぎ記録だけのcommitは[skip ci]で送信し、本番SHAとdocs commitの差を説明する。
