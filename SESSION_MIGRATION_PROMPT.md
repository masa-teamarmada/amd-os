AMD OSのデータ変更履歴を引き継ぐ。作業場所は /Users/masa/projects/AMD/amd-os。pwa/をセッションのcwdにしない。

読む順:
1. /Users/masa/projects/AGENTS.common.md
2. /Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md
3. /Users/masa/projects/AMD/amd-os/AGENTS.md と /Users/masa/projects/AMD/amd-os/HANDOFF_CHANGE_HISTORY.md
4. pwa/manual/1-1-intro.md、pwa/spec/1-3-reconstruction-coverage-audit.md
5. pwa/spec/5-2-development-operations-current-spec.md「データ変更履歴の表示・保存契約」、pwa/spec/2-1-pwa-runtime-routes.md、ios/DESIGN.md
6. pwa/manual/2-6-admin-ops.md「データ変更履歴」、pwa/BUGS.md、pwa/design_log/sessions_2026-11.md

状態:
2026-11-05にAMD OS変更履歴へL2M専用データが混入した問題を修正した。実装commitは57fcfea48。L2M専用20表の監査を止め、混入履歴226,744件を履歴DBから削除し、新規表の監査を明示登録制にした。画面/API側のL2M非表示フィルターはない。L2M本体データは変更していない。migration 20261105015441/20261105021010/20261105021635は本番適用済みで再適用しない。DBでL2M履歴0件・有効なL2M監査trigger0件を確認。本番v3.165.16の変更履歴画面をPCのAMD OS Chromeアプリで開き、AMD OS履歴が表示されることを確認した。
その後、別作業でmainは進行。引き継ぎ着手時はmain/origin/main=a1adb5c13、作業ツリーclean。現行本番版は未確認。正本は上記spec/manual、実装履歴はdesign_log、再発防止はBUGS。`cd /Users/masa/projects/AMD/amd-os/pwa && npm run test:data-change-history`は今回成功。

次の作業:
今回依頼分に残作業はない。新たな混入が報告されたら、画面で隠さず、DBの対象行と監査triggerの所属を調べ、原因を修正して誤記録を履歴本体から除去する。新しいAMD OS表を追加する場合は監査対象台帳・表示台帳・回帰検査を同じ変更で更新する。

運用:
main一本。既存の他作業の差分を戻さず、新規branch/worktreeを作らない。変更前とpush前にfetchして同期を確認。PWAを変更したらPC Chromeで表示確認し、`AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh`をリポジトリルートから実行してpush・本番buildまで確認する。スマホWeb確認は依頼時のみ。iOSを変更する場合はbuildに加えて実機install/launchまで確認する。履歴の大量行を全件展開する重いSQLは避け、対象表・期間・索引で絞る。
