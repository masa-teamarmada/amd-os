# SOL外部開示の引き継ぎ — 2026-11-12

開発案件の終了記録。2026-10-10に、AMD社内Slackの保存を停止して既存保存2,939件を削除し、SOL側の247件を保持した。見つかった人物評価の本文・複製・復元履歴を除去し、共有面を公開確認済み記録に絞った。既存の先生方の閲覧権限は当時変更していない。原本の削除や先生本人の閲覧の有無の確認は行っていない。

10月の反映点は `8e17d62f`（当時v3.162.13）。11月12日にこの点が現行mainの祖先であること、本番v3.165.23が共有作業場所と同じ `b8dcfe4ce` を返すことを確認。記録前の作業場所は差分・未送信なし、ローカル枝・worktreeはmain本体のみ。旧一時cloneは不存在。最新の外部閲覧内容と権限の実地再検査は今回行っていない。

- 正本: [PJフォーマット](pwa/spec/3-23-project-format-current-spec.md)、[データ取り込み](pwa/spec/3-1-l2-data-extraction-current-spec.md)、[経路](pwa/spec/2-1-pwa-runtime-routes.md)
- 利用説明: [コックピット](pwa/manual/2-3-pj-cockpit.md)、[データ取り込み](pwa/manual/3-2-data-and-extraction.md)、[10月10日の変更履歴](pwa/manual/9-3-appendix-changelog.md)
- [既知の問題](pwa/BUGS.md)、[10月の実装履歴](pwa/design_log/sessions_2026-10.md)
- 当時の検証資料: `/Users/masa/.codex/visualizations/2026/10/06/01a110db-a2d7-7a12-bfde-8bc7ebe42723/SOL_EXTERNAL_DISCLOSURE_AUDIT_20261010.md`

未完の実装なし。再開依頼が来たら、最初に最新mainと本番を照合し、対象だけ読み取りで確認する。SOL DD変更は専用ローカル環境に留める。会話の検討材料: 0件。
