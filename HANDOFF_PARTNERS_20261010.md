# 関係先画面修正の引き継ぎ（2026-10-10）

作業分類は開発。実装ef0f40bf / v3.162.11はmainへpush・本番配信・ChromeとDBで確認済み。今回の依頼済み残作業なし。
- 初回は全関係先。両stateでPoC候補の有無による初期分岐を廃止。
- 管理権限者は進捗・履歴上部で対象名を確認して削除。既存APIのsoft-deleteを使い、履歴・出典を保持。
- SOLの旧SIER仮置き1件を削除済み。全94件・他行不変を確認。GSE16団体は保持。
- 検証履歴: pwa/design_log/sessions_2026-10.md。仕様: pwa/spec/3-16、使い方: pwa/manual/2-3、履歴: pwa/spec/6-1・pwa/manual/9-3、バグ: pwa/BUGS.md。schema/API契約は変更なし。
- GSEの原資料・登録根拠・要確認事項は /Users/masa/projects/AMD/SOL/GSE_CONTACT_IMPORT_20261010.md。適用SQLはSOL/work/261010_gse_contacts/import.sql（再実行禁止）。
- 終了時のorigin/main・本番は別作業8e17d62f / v3.162.13へ進んでいる。今回の実装は含まれる。
- canonicalは /Users/masa/projects/AMD/amd-os、main一本。一時cloneは記録を移して削除する。
- 共有checkoutには別作業の未push3件c0f23546/3f11241e/f2a08962がある。担当は未特定、隔離責任者は共有checkout管理担当（まさ判断）。本番へ統合する明示指示を判断条件とし、無検証でpush/reset/stashしない。この共有checkout全体はdo not archive。
最初の行動は新規指示の確認とgit fetch/本番build-info/対象DBの現状確認。今回の登録・削除を再実行しない。
