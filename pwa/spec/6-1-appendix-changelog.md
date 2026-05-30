# 附則（設計書変更履歴）

> **この章は何か**: `/spec` の追加・変更・削除を append-only で記録する変更履歴。設計書は「読めば current OS を再構築できる」粒度を求めるため、仕様変更のたびに必ずここへ追記する。

## 運用ルール

- `/spec` の章を追加・変更・削除したら、同じ commit でこの附則へ 1 行追記する。
- 記録項目は `日時 / 対象章 / 種別 / 変更箇所 / 理由 / 変更者`。
- 削除は、削除元・移植先・まさ承認または明確な移行理由を書く。
- この附則は append-only。過去行を書き換えない。
- manual / bzm の変更は、それぞれ `/manual/9-3-appendix-changelog`、`/bzm/9-5-appendix-changelog` にも記録する。

## 変更履歴

| 日時 | 対象章 | 種別 | 変更箇所 | 理由 | 変更者 |
|---|---|---|---|---|---|
| 2026-05-30 | 1-1 / 1-2 / 2-1 / 3-1 / 3-2 / 3-3 / 4-1 | 追加 | `/spec` 初期章を追加し、manual / spec / bzm 3層分割、PWA runtime、L2、monthly_reports、meeting flow、FRL CES を移行 | 現行 manual / design に混在していた確定実装仕様を設計書へ分離するため | えいみ |
| 2026-05-31 01:21 JST | 3-4 / 3-5 / 3-6 / 4-2 | 追加 | L2⑦ OS台帳差分、L2⑧ XRL根拠、L2⑨経営ハイライト、AMD Score実装仕様を追加 | L2 ⑦⑧⑨ と AMD Score の current contract を `/spec` へ移し、manual/design の重複を減らすため | えいみ |
| 2026-05-31 01:21 JST | 5-1 / 5-2 / 5-3 / 5-4 / 6-1 | 追加 | ドキュメント統制、開発/デプロイ運用、automation責務分担、判断履歴/事故ログ、設計書附則を追加 | まさ指摘「manual 9章に開発情報が残っている」「設計書だけでOSを再構築できる粒度が必要」「附則がないと勝手に消える事故を防げない」への対応 | えいみ |
| 2026-05-31 01:21 JST | 1-1 / 1-2 / 1-3 / 2-2 / 2-3 / 3-7 / 3-8 / 4-3 | 追加・変更 | 再構築品質バー、カバレッジ監査、PWA surface、Supabase data model、notifications、cockpit、ERS を追加し、移行マップを更新 | 司令塔追加指示「読むだけで current OS を再構築できるか」で監視する前提に合わせ、薄い整理ではなく不足と current truth を明示するため | えいみ |
| 2026-05-31 01:21 JST | 5-5 / 1-3 | 追加・変更 | GAS / iOS 役割境界仕様を追加し、カバレッジ監査の GAS / iOS 判定を `partial` に更新 | 合格条件に iOS 側の役割と GAS automation が含まれていたため、未確認点を明示しつつ現行境界を spec に上げるため | えいみ |
| 2026-05-31 | 3-1 | 追加 | L2⑥ MTGサマリの開催済みソース guard を追加。Calendar添付Gemini notes、Notion eventId空 fallback、report_emails空Gmail fallback、`prep_source_meeting_id`、`npm run test:l6-held-source-guard` を仕様化 | 飯野さんMTG欠落の再発防止を `/spec` だけで再構築できる粒度に上げるため | えいみ |
