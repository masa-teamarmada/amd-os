AMD OSの閲覧者表示・閲覧履歴の引き継ぎ。正規cwdは /Users/masa/projects/AMD/amd-os。まさは「10秒ごと→1分ごと」に変更する方針を受け入れ済み。今回の機能に残作業はないので、新しい依頼がない限り追加実装・通知起動・ネイティブ移植を自動再開しない。

読む順:
1. /Users/masa/projects/AGENTS.common.md
2. /Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md
3. /Users/masa/projects/AMD/amd-os/AGENTS.md、HANDOFF_PAGE_VIEWING_20261008.md
4. pwa/manual/1-1-intro.md、pwa/spec/2-1-pwa-runtime-routes.mdの閲覧機能、pwa/manual/2-1-member-quick-start.md、ios/DESIGN.md、pwa/HANDOFF_pwa_to_native_viewing.md
5. BUGS.md、pwa/BUGS.md、実装履歴pwa/design_log/sessions_2026-10.md。仕様統制はpwa/design/SPEC_GOVERNANCE.md、反映運用はpwa/spec/5-2。

状態:
PWA右上に同じ画面の閲覧者・閲覧履歴を表示。定期通信60秒、通信断180秒で失効。初回表示・復帰・ページ切替・パネルを開く操作は即時更新、非表示・退出は即時離脱。同じ人の複数タブは人数を重複計上しない。履歴は訪問ごとに1件、繰返し更新で増殖しない。最新50件は表示上限であり保存上限ではない。外部の履歴は本人のみ。
初回実装8414eb47、間隔変更f15ab19f、確認記録1a6f3482はmainへpush済み。2026-10-09に通常build・必要検査・正規deploy.sh・本番Chrome/DBまで確認し、実更新間隔60.158秒と退出後inactiveを確認した。2026-10-10本番読戻しはv3.162.13 / 8e17d62fdac03b62a9ff9f658d083678cf7bac4e / main / dirty=false。後続変更後も60秒/180秒は維持。今回の終了処理は文書のみで再build/DB試験/本番画面再検査はしていない。旧一時cloneは現在存在しない。資料・証跡の正本はrepoの仕様・開発ログで、/tmpの旧パスに依存しない。

最初の行動と残る境界:
まずgit fetch origin main、status、HEAD、ahead/behind、git cherry、branch/worktree/stashを読取り確認。共有checkoutはHEAD f2a08962、未コミット0、未push3、終了文書push前behind30で、最新main起点dbebf316とは分岐している。古いcheckoutの本文を現行仕様として編集せず、安全な最新mainのclean cloneを使う。
未push c0f23546 / 3f11241e / f2a08962 は別チャット「承認なしの押印を防ぐ設計」（01a11a36-1046-7ea0-a1d8-37c5ba39efa9）の契約承認・メール監視。patch未統合で、元担当の最終報告は通信障害によるpush停止。本番画面・5分監視・Slack実配信は未確認。今回の閲覧機能と混ぜてpush・merge・通知起動しない。quarantine ownerはその担当。再開条件は元担当が最新mainへの取り込みと正規反映経路を検証すること。既存stash2件も別作業なので復元・削除しない。共有checkout同期未完のためリポ全体はdo not archive、今回の閲覧機能は反映済み。
外部本人の閲覧機能の正常系は未検証。iOS/macOS/Androidの閲覧UIは未移植。Supabase migration20261008120000は適用済みで再適用禁止。DBやメール・通知の追加操作は新しい依頼の範囲を確認してから行う。

確立済みの運用:
main一本、新branch/worker worktree/子タスクなし。別作業をreset/stash/削除/一括commitしない。push直前に再fetch。PWA変更の反映はAMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.shのみで、CLI直接deployは禁止。code変更時は型・通常build・必要検査・本番SHA/画面/DBを確認し、manual/spec/変更履歴・必要な全プラットフォーム仕様を同期する。独立cloneのnode_modulesはroot内部に置き、メモリ不足時は検査用NODE_OPTIONSの上限を調整。本番と異なるwebpackの型エラーを根拠に無関係な既存exportを修正しない。メール送信は禁止。閲覧履歴へ生URL・クエリ・本文・入力・秘密値を保存しない。
