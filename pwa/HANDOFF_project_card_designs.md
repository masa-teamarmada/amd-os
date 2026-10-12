# 自社名刺案の引き継ぎ

2026-10-12。開発・納品対象v3.162.28。機能本番反映とChrome確認済み（機能確認はv3.162.23/24）。配信の最終結果は共有Drive `a0_management/0_名刺/261012_OS登録確認/closeout-receipt.json` と開発記録を参照。

- 専用台帳3系列/3版/16資料/9固定PDFを登録済み。AMD r8/SOL単独は承認済み、併記r7は確認待ち。
- 共通DB migration2件適用済み。ファイル名はDB適用履歴の実versionへ整合済み。再適用しない。
- PJ管理の名刺案・管理者全PJ一覧・独自PDF描画/原本取得・編集元への導線を確認。
- activeな社内メンバーのみ。停止者の直接RLS読取りも0件。外部公開・追加発注は行わない。
- 手動の次作業はなし。SOL併記の最終承認/発注、注文の到着実績確認は別の明示依頼が来たときだけ。
- 次回はcommon→AGENTS→spec3-25→manual2-3→本番の対象PJ名刺案を先に読む。資料の上書きや重複再登録から始めない。

正本: `../docs/PROJECT_BUSINESS_CARD_DESIGNS.md`、`spec/3-25-project-card-designs-current-spec.md`、`manual/2-3-pj-cockpit.md`、`design_log/2026-10-12_project_card_designs.md`。名刺制作は親のBUSINESS_CARDS、ソフトウェア開発とは分ける。

|新仕様|設計正本|OSマニュアル|状態|
|---|---|---|---|
|PJ名刺・全PJ一覧・版と承認・PDF閲覧|spec3-25|manual2-3|同期済み|
|RLS/active判定・migration履歴整合|migration2件/spec3-25|manual2-3|適用・検査済み|
|名刺OCR/理論|既存のまま|manual2-8|変更なし|
