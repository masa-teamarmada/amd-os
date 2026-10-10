# 閲覧中・閲覧履歴 — 引き継ぎ

更新日: 2026-10-10 JST。仕事種別: 開発。まさ受入済みの閲覧機能と1分更新の終了処理。

## 現在地

- 同じ画面の閲覧者表示と閲覧履歴はPWAで反映済み。定期更新1分、通信断の失効3分。開く・戻る・ページ切替・パネル操作は即時更新、非表示・退出は即時離脱。
- 初回実装 `8414eb47`、更新間隔変更 `f15ab19f`、検証記録 `1a6f3482` はmainへpush済み。2026-10-09のChrome/DBで60.158秒間隔、訪問の重複なし、退出後inactiveを確認した。
- 2026-10-10の本番読戻し: `v3.162.13` / `8e17d62fdac03b62a9ff9f658d083678cf7bac4e` / main / dirty=false。後続の別機能反映後も60秒・180秒の共通定数は維持。今回の終了処理では追加のDB検査・画面再検査・build・deployを行っていない。
- Supabase migration `20261008120000` は適用済み、再適用禁止。iOS/macOS/Androidの閲覧UIは未移植。外部本人の実ログイン正例は導入時未確認で、今回も再検証していない。
- 詳細な実装・検証履歴は [開発ログ](pwa/design_log/sessions_2026-10.md)、恒久仕様は [spec2-1](pwa/spec/2-1-pwa-runtime-routes.md)、使い方は [manual2-1](pwa/manual/2-1-member-quick-start.md)。

## 残作業と最初の次アクション

今回の閲覧機能に残作業なし。新しい依頼がない限り、追加実装・通知・保持期間変更・外部実験・ネイティブ移植を自動再開しない。
次セッションはcommon→AMD横断memory→この文書→仕様→BUGSの順に読み、Gitと本番版を読戻してから、まさの新しい依頼だけに着手する。

## Git・終了状態

- 正規cwd: `/Users/masa/projects/AMD/amd-os`。共有checkoutのHEADは `f2a08962890df8212eb88f47f3eca15b20dda006`。2026-10-10 fetch時点は未コミット0、未push3、behind30（終了文書push前）。今回の文書は最新main `dbebf316ef8a0485fd6d23c98bad3c0f996eb515` 起点の独立clean cloneから反映する。
- 3件 `c0f23546` / `3f11241e` / `f2a08962` はpatch未統合。帰属はチャット「承認なしの押印を防ぐ設計」(`01a11a36-1046-7ea0-a1d8-37c5ba39efa9`)。同チャットの最終報告は通信障害でpush未完了、本番画面・5分監視・Slack実配信は未確認。今回の閲覧機能として一括push・merge・通知起動しない。
- quarantine ownerは上記チャット担当。次の判断条件: 同担当が3件を最新mainと比較し、正規deploy.shと各監視経路を検証して統合するとき。最終本番確認まで同機能を反映済みとは扱わない。共有checkoutの同期未完了が残るため、リポ全体の終了判定は `do not archive`。
- 既存stash2件はHTML preview/PDF作業の保存名で理論・SX・Project Share差分を含む。今回の生成物ではない。元担当が最新mainへの包含を確認するまで復元・削除せず保持。
- 今回の変更は文書のみ、mainへcommit/pushする。新規branch/registered worktreeなし。前回の `/tmp/amd-os-viewing-20261008` は現在存在せず、再開場所として使用しない。今回のclean clone `/tmp/amd-os-viewing-closeout-20261010` は終了文書push後に `/Users/masa/.codex/cleanup_archives/20261010-page-viewing-closeout/repo` へ移す。

## 文書と検証の導線

- [移行プロンプト](SESSION_MIGRATION_PROMPT.md)。上書き前のSOLコスト用プロンプトは既存 `SESSION_MIGRATION_PROMPT_COST_PWA_20261007.md` と同一内容なので、そちらを保持。
- [運用上の教訓](BUGS.md): 独立cloneの依存・メモリ・代替ビルド方式。既存symlink事故の詳細はpwa/BUGS.mdの2026-10-06項目。
- [全プラットフォーム仕様](ios/DESIGN.md)、[ネイティブ引き継ぎ](pwa/HANDOFF_pwa_to_native_viewing.md)。理論の変更なし、bzm対象外。

| 棚卸し | 設計正本・記録先 | OSマニュアル章 | 状態 |
|---|---|---|---|
| 閲覧者・履歴の画面/認可/DB/API | spec2-1 / FEATURE_REGISTRY / db_schema / ios DESIGN | manual2-1 | 同期済み |
| 60秒更新・180秒失効 | spec2-1 / core / 既存検査SQL | manual2-1 / manual9-3、spec6-1 | 同期済み |
| 実装・migration・本番確認履歴 | design_log/sessions_2026-10 | 対象外: 開発履歴 | 移動・保存済み |
| ローカル検査の失敗と解決 | BUGS.md | 対象外: 製品挙動変更なし | 保存済み |
| 未移植・外部検証の境界 | HANDOFF_pwa_to_native_viewing / 本文 | manual2-1 | 保存済み |
| 残る別作業3件/stash2件 | 本文 / 移行プロンプト | 対象外: Git棚卸し | 帰属・次の判断条件明記 |

会話の検討材料: 0件。製品設定は設計正本へ保存し、個人特性として保存しない。
