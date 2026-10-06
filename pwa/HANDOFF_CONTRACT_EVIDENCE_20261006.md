# PJ契約リストの文書・やりとり

2026-10-06。PWAの既存契約リストに契約ごとのDrive版と短い確認済み経緯を追加。実装・境界は `spec/5-6-contracts-management-current-spec.md` と `spec/5-17-dd-package-current-spec.md`。台帳登録は `scripts/migrations/484_iyogin_nda_versions_history_20261006.sql` を適用済み。

いよぎんNDAは2版・4履歴、署名待ち・未締結。署名完了・契約期間は未確認。署名版を受領したら既存の押印版登録経路で更新する。DDは追加履歴を取得しない。Drive共有・通知の追加なし。

検証: `test:project-contract-list`、型検査、通常の本番反映ゲートと実画面確認。Swiftの移植は未実施。
