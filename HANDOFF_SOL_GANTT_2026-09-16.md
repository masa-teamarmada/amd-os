# SOLガント 引き継ぎ
更新: 2026-09-16 / 開発

## 現状
- 4区分13工程。展開はMS・タスク、親期間は子の最小開始〜最大終了。論点を時間軸へ表示しない。
- 既存UIの行構造・配色・固定名前列を維持。資料は工程内容の参照。
- 各工程の「＋ タスク追加」で新規作成／既存タスクの紐付け・移動・解除が可能。共通タスク正本を使う。
- 機能11db2794（v3.140.9）を本番確認済み。closeout時の公開build-infoは後続cbc56159、同版、main、dirty=false。
- build/型検査/工程投影/実route検査、rollback内DB検査、手元の作成・移動・解除、狭幅を含む画面検査済み。本番は表示とダイアログを確認し、テストタスクは保存していない。
- レビューは実装者の検査。独立したUIUXデザイナー監査ではない。
- 2本のmigration（20260916160000 / 20260916210000）は適用・履歴登録済み、再適用不要。

## Gitと未解決
- 正規repo: /Users/masa/projects/AMD/amd-os。作業clone: /tmp/sol-gantt-20260916（main）。今回の変更はorigin/mainへpush済み。
- 共有元に別作業の3未pushコミット・29dirty。書込み前にCLOSEOUT_SOL_GANTT_2026-09-16.mdの全パス・復旧資料・担当と判断条件を読む。共有元全体はdo not archive。
- 今回の機能に未実装の残件なし。共有元復旧・統合はMasa decision needed。IABのクラッシュタブはclose拒否で自動cleanup待ち。

## 次の最初の操作
共通ルール→AMD memory→この文書→仕様→BUGSを読み、git fetchとstatusで現在地を確認。共有元をreset/stashしない。機能の再実装やmigration再適用は不要。追加の依頼があれば現行mainのclean cloneで限定変更する。

## 正本への導線
- 仕様: pwa/spec/3-21-question-tree-current-spec.md
- 操作: pwa/manual/2-9-question-tree.md（manual-chapters.ts登録済み）
- データ: pwa/design/db_schema.md、ios/DESIGN.md、pwa/design/FEATURE_REGISTRY.md
- バグ・教訓: pwa/BUGS.md
- 開発履歴: pwa/design_log/sessions_2026-09.md
- UI確認: pwa/design_log/sol-gantt-ui-review-2026-09-16.md
- closeout: CLOSEOUT_SOL_GANTT_2026-09-16.md
- 次セッション: SESSION_MIGRATION_PROMPT.md のSOLガント節
