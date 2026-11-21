# 機関決定ページと資料保存先の再開文

作業場所は `/Users/masa/projects/AMD/amd-os`。このテーマは実装済みで、追加資料の整理や仕様確認を頼まれた場合だけ再開する。

読む順:

1. `/Users/masa/projects/AGENTS.common.md`
2. `/Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md`
3. `/Users/masa/projects/AMD/amd-os/HANDOFF_GOVERNANCE_DRIVE_STORAGE_20261121.md`
4. `/Users/masa/projects/AMD/amd-os/AGENTS.md`
5. `pwa/manual/1-1-intro.md`
6. `pwa/spec/1-3-reconstruction-coverage-audit.md`
7. `pwa/manual/2-3-pj-cockpit.md`
8. `pwa/spec/3-23-project-format-current-spec.md`
9. `pwa/spec/3-3-meeting-flow-current-spec.md`
10. `pwa/spec/3-23-project-workspace-integration-current-spec.md`
11. `pwa/BUGS.md`

状態:

- 株主総会と取締役会は全PJ共通の独立ページで、経営会議の記録とは別に扱う。決議事項と決議結果は同じ記録内でも区別して表示する。
- 新規の会議添付は、各PJの共有Driveフォルダ配下の `0_経営会議`、`0_取締役会`、`0_株主総会` に会議種別ごとに保存し、その下に日付別フォルダを作る。
- 2026-10-31時点で、Drive保存先を登録済みのPJについて既存添付と機関決定資料の整理、画面仕様・マニュアル・実装の反映、本番確認まで完了している。
- 再開前に必ず最新の `main`、本番、対象PJのDrive保存先登録を確認する。別作業の未追跡原稿は触らない。

再開時の作業:

1. `git fetch origin main` の後、遅れ・未送信変更・未追跡ファイルを確認する。別作業の原稿を混ぜない。
2. 対象PJのDrive保存先が登録済みか、対象会議が株主総会・取締役会・経営会議のどれか、元資料が何かを確認する。
3. 保存先未登録のPJは、先にPJの正しいDrive保存先を確認して登録する。未確認の資料・会議・決議を推測で追加しない。
4. 製品を変更する場合は、マニュアル・仕様・変更履歴を同じ変更で同期し、対象検査と正規の反映手順を行う。PCのChromeで実画面と保存先を読戻す。

守ること:

- PJ固有の例外を作らず、全PJ共通のフォーマットを保つ。
- 会議種別の保存先は `0_経営会議`、`0_取締役会`、`0_株主総会` に固定する。
- main一本で扱い、別branchや作業ツリーを作らない。対象ファイルだけを明示して記録する。
- メール送信、共有権限の変更、資料の外部公開は行わない。
