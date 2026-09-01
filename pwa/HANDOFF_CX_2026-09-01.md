# HANDOFF — CX論点・仮説（2026-09-01）

## 到達点

- CX (`p20`) で論点・仮説を追加できない不具合を復旧した。原因は表示用の標準4分類fallbackと、保存APIが検証する実登録分類の不一致。
- migration `pwa/scripts/migrations/358_seed_cx_management_tracks.sql`を本番適用済み。CXの4分類をreadbackし、既存記録を上書きしない追加のみであることを確認した。commit `ad5918cd`。
- 論点・仮説リストは、列構成と全文表示を変えずに短い論点の行高を圧縮した。共通44px操作高、空の担当補助行、セル余白が原因。commit `f7495b7a`、本番 `v3.100.14` のSHA readback済み。

## リポジトリ状態

- canonical: `/Users/masa/projects/AMD/amd-os` の `main`。
- 本セッション由来の実装はすべてcommit・push済み。PWAの本番反映はmain pushによるVercel Git連携で、`/api/build-info`が`f7495b7a`を返した。
- このcheckoutにはBZM P1原稿・プレビュー・監査メモと`pwa/design_log/sessions_2026-08.md`の別作業がdirtyで残る。今回の変更ではないため、削除・revert・一括stageしない。

## 未解決と次の一手

- この機能の未解決はない。次の画面フィードバックが来たら、まず本番のログイン済み現物で対象タブを確認する。
- PWAを再び変更する場合は、`BUILD_VERSION`、`pwa/spec/3-16-project-weekly-control-current-spec.md`、`pwa/manual/2-3-pj-cockpit.md`、両附則を同じcommitで更新する。`npm run test:critical-ui`とproduction buildを通し、main push後に`/api/build-info`のSHAをHEADと照合する。

## 参照先

- 仕様: `pwa/spec/3-16-project-weekly-control-current-spec.md`
- 利用説明: `pwa/manual/2-3-pj-cockpit.md`
- 実装履歴: `pwa/design_log/sessions_2026-09.md`
- 不具合・教訓: `pwa/BUGS.md` の `[PWA/project-workspace] 互換表示した論点分類を保存APIが拒否した`
