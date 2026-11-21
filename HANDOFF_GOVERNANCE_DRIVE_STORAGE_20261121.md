# HANDOFF - 機関決定ページと資料保存先

- 更新: 2026-11-21 JST
- 作業種別: development（実装は完了済み。今回は再開用の引き継ぎを整理）
- 正本: `pwa/spec/3-23-project-format-current-spec.md`、`pwa/manual/2-3-pj-cockpit.md`

## 現在地

- 全PJの会社情報には「株主総会」「取締役会」を独立ページとして常設し、経営会議とは別に記録を表示する。各記録では決議事項と決議結果を分けて読める。
- 新しい会議添付は、PJの共有Driveフォルダ内の `0_経営会議`、`0_取締役会`、`0_株主総会` のいずれかに入り、その下に日付別フォルダを作る。
- 2026-10-31に、Drive保存先を持つPJの既存会議添付と機関決定資料をこの構成へ整理済み。保存先未登録の終了・草案PJは、保存先登録後に同じ構成を作る。
- 実装・型検査・本番反映は当時完了済み。今回の終了確認時点では、`main` と `origin/main` は同期している。

## 未解決

- このテーマの実装上の未解決はない。
- リポジトリ直下の未追跡 `S01_富士山_日本語.md` は別作業の記事原稿。本文は変更せず、原稿の担当と正本を確認してから扱う。

## 次の最初の作業

このテーマを再開する依頼が来たら、先に `git fetch origin main` を行い、対象PJのDrive保存先登録と、追加対象の会議種別・原資料を確認する。未登録の資料や会議を推測で追加しない。

## 参照先

- 現行の画面・保存先仕様: `pwa/spec/3-23-project-format-current-spec.md`
- 利用手順: `pwa/manual/2-3-pj-cockpit.md`
- 会議フロー: `pwa/spec/3-3-meeting-flow-current-spec.md`
- PJのDrive連携: `pwa/spec/3-23-project-workspace-integration-current-spec.md`
- 開発時の回帰・運用: `pwa/BUGS.md`
