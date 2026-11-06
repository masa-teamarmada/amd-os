# HANDOFF - 請求書の立替税率

- 更新: 2026-11-06 JST
- 作業種別: development
- 正本: `ios/DESIGN.md`、`pwa/design/FEATURE_REGISTRY.md`
- 利用手順: `pwa/manual/6-3-invoice-and-billing-routine-spec.md`

## 現在地

- 承認済み立替は、申請時の0%・8%・10%を請求書の明細と概算へ明細単位で引き継ぐ。未設定だけ10%に補完し、その他の税率はfreee発行前に拒否する。
- PWAの立替編集・請求書発行モーダル、iPhoneの請求書画面、iPhoneの立替取得query、共通の請求書発行処理のソースを同じ規則へ揃えた。DB migration・環境変数の変更はない。
- 実装差分はGitHubの `main` へ反映済み。PWA本番は `e606cf1bd` で `READY` を確認済み。この引き継ぎだけの後続commitはPWAを再buildしない。
- 共通の請求書発行処理はソースだけが更新済みで、本番への反映は未完了。ここが反映されるまで、freeeへ渡す立替税率は旧版のまま。

## 今回の確認

- PWAの管理画面・支払照合・重要画面の回帰検査、型検査はこのセッションで成功。
- iPhoneのシミュレーターbuildと実機接続は、この管理環境でCoreSimulator/CoreDeviceとSwiftPM cacheへの書込みが拒否され未確認。通常のMac環境で再実行する。
- 本番の版情報URLは、この管理環境が閲覧承認を出せず未確認。PWAの本番配布記録は `e606cf1bd` でREADY。

## 次の最初の作業

1. Supabase CLIへログイン済みの通常のMac環境で `issue-invoice` を本番へ反映し、配布済み関数の本文で0%・8%・10%と想定外税率の拒否を読戻す。この環境ではアクセストークンが無く、CLI反映を実行できなかった。請求書の新規発行は行わない。
2. PWA本番の版情報が `e606cf1bd` を返すことを確認する。
3. masaiPhoneへinstall・launchし、請求書画面の「消費税（概算）」が立替ごとの税率を反映することを確認する。

## 参照先

- 全画面仕様: `ios/DESIGN.md`
- 請求・立替手順: `pwa/manual/6-3-invoice-and-billing-routine-spec.md`
- 請求書画面仕様: `pwa/design/FEATURE_REGISTRY.md`
- 再発防止: `pwa/BUGS.md`
- 開発履歴: `pwa/design_log/sessions_2026-11.md`
- Android向け: `ios/HANDOFF_ios_to_android.md`
