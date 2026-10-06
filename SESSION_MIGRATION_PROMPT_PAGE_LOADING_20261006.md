AMD OSのホーム・3スペース表示速度改善を引き継いで。作業場所は /Users/masa/projects/AMD/amd-os。仕事種別は開発。

読む順:
1. /Users/masa/projects/AGENTS.common.md
2. /Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md
3. AGENTS.md、HANDOFF_PAGE_LOADING_20261006.md
4. pwa/manual/1-1-intro.md、pwa/spec/1-3-reconstruction-coverage-audit.md
5. pwa/spec/2-1-pwa-runtime-routes.md、3-8-cockpit-current-spec.md、5-10-reference-data-caching-current-spec.md、5-17-dd-package-current-spec.md
6. pwa/BUGS.md、pwa/manual/2-1-member-quick-start.md、pwa/design_log/sessions_2026-10.md

現在地:
- まさの依頼は「ダッシュボードのPJポートフォリオ」と「コックピット・ワークスペース・DDパッケ内の各ページ」の遅さの原因特定と改善。実装46dd85cd/5981449a/f6a0d3a4はmainに統合、v3.159.23で本番反映と実画面を確認済み。追加依頼・未実装事項はない。
- 2026-10-06の再照合時はmain/originが369f2923、本番は91883c67/v3.159.24（別担当の後続資本政策修正は配布進行中）。後続の別担当修正を含むため、このSHAや旧版へ戻さない。開始時に必ずgit fetch/statusと公開/api/build-infoを再取得する。
- ホーム先行取得・表示専用DTO・60秒保持、3スペースの部品分割と既存認可済み読取の並行先読み、PJ/MS限定のまとめ取得、DDの選択読取と監査の並行化、コックピット内のNative History切替を実装。DB・数式・開示権限・ネイティブアプリは変更なし。
- データ取得3回の中央値: ホーム1093→295ms、コックピット1318→561ms、DD会社概要634→249ms。認証・監査・利用者回線・描画を含む全画面の表示時間ではない。初期JS gzipはコックピット約75%、workspace約84%、DD約75%減（選択部品の追加chunkは除く）。
- 型検査、回帰検査、627ページの本番ビルド、通常配布の全ゲート成功。実Chromeで主要ページ本文、連続選択・再読み込み復元、ホームとガントのPC/スマホを確認。全ページのブラウザー網羅とは扱わない。DD既存22 canonical/compatページは実DBのread-only loaderで検査。
- 設計と使い方は上記spec/manual、技術履歴と計測はdesign_log、既知事故はBUGS。画像は /Users/masa/.codex/visualizations/2026/10/06/01a10f1c-985a-7ae3-912b-7817a8adedac/。一時build cloneは復元可能なゴミ箱へ整理済み。

次の行動:
- この依頼の追加実装は不要。再び遅いとの指摘が来たら、対象PJ・ページ・初回/再訪/切替を分け、現行の認証→読取→描画を調べる。計測範囲を明示し、同じ実データの結果と権限が維持されることを確認する。
- 共有mainの資本政策差分は369f2923でcommit/push済み。今後の同領域の作業中差分は「エラー表示と解決導線を修正」（01a10f46-c2bd-7dc1-b990-e80214a22462）担当。資本政策の実装・検査・spec/manual/DESIGN/build-info/HANDOFFの差分を一括stage・削除しない。担当の受入・commit/push後に再判定する。
- 未追跡SESSION_MIGRATION_PROMPT_task_based_pt_20260922.mdは以前の資料。「SOLのDDパッケージ不足を洗い出す」（01a107d5-ee58-78c2-9c87-942ea2286f50）で保存可否を確認中。返答に従って同担当が処理する。別件は既存のSESSION_MIGRATION_PROMPT_CAPITAL_PLAN_DENSITY_20261006.md、SESSION_MIGRATION_PROMPT_SOL_DD_20261006.mdを参照。

運用:
- main一本。新規branch/worktree禁止。共有checkoutをreset/stash/deleteしない。必要ならmainの使い捨て通常cloneで検証する。
- 変更した仕様はspec/manualと附則を同じcommitで同期。PWA配布はAMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh。公開build-infoのSHAで本番反映を確認する。
- clone外node_modulesのsymlinkはTurbopackが拒否する。clone内に依存を用意する。秘密値・実データ全文をGit/ログへ出さない。
- pwa/HANDOFFはskip-ci判定の除外一覧にない。配布不要の今回専用引き継ぎはrootのHANDOFF_*.mdを使う。配布前ガードを迂回しない。
