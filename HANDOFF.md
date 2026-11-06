# HANDOFF - 請求書の立替税率

- 更新: 2026-11-06 JST
- 作業種別: development
- 正本: `ios/DESIGN.md`、`pwa/design/FEATURE_REGISTRY.md`
- 利用手順: `pwa/manual/6-3-invoice-and-billing-routine-spec.md`

## 現在地

- 承認済み立替は、申請時の0%・8%・10%を請求書の明細と概算へ明細単位で引き継ぐ。未設定だけ10%に補完し、その他の税率はfreee発行前に拒否する。
- PWAの立替編集・請求書発行モーダル、共通 `issue-invoice` Edge Function、iOS `InvoiceStepView`、iOSの立替取得queryを同じ規則へ揃えた。
- DB migration・環境変数の変更はない。
- `main` のHEADは `d9c40aaf0`。請求書関連のローカル差分4コミットがあり、`origin/main` のローカル参照は `02425ec90`。作業ツリーはclean、worktreeはmainの1つだけ。
- `b0234a711` 相当の支払照合変更は既に `origin/main` に含まれるため、重複していない。

## 検証

- 既存記録上、`test:admin-kiyo`、`test:member-payout-matching`、`test:critical-ui`、対象eslint、`npx tsc --noEmit` は成功。
- iOS Debug / iphoneos署名付きbuild: `BUILD SUCCEEDED`。
- 実機install / launch: `devicectl` がCoreDeviceService初期化タイムアウトとなり未完了。
- Next.js local production build: 管理環境のport bind / Google Fonts名前解決制限で未完了。closeout時のfocused checkは無出力のまま停止したため、再開時に実行し直す。

## 未解決と最初の次アクション

1. `git fetch origin` 後、リモートが変わっていなければ `main` の4コミットをpushする。変わっていれば先にrebaseしてからpushする。
2. `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh` でVercel本番を監視し、`/api/build-info` のSHA一致を確認する。
3. `issue-invoice` Edge Functionを別途deployし、0%・8%・10%の変換と想定外税率拒否を読戻す。PWA反映だけで関数反映済みとは扱わない。
4. CoreDeviceServiceが使える通常環境でmasaiPhoneへinstall・launchし、請求書の「消費税（概算）」表示を確認する。

## 参照先

- 全画面仕様: `ios/DESIGN.md`
- 請求・立替手順: `pwa/manual/6-3-invoice-and-billing-routine-spec.md`
- 請求書画面仕様: `pwa/design/FEATURE_REGISTRY.md`
- 再発防止: `pwa/BUGS.md`
- 開発履歴: `pwa/design_log/sessions_2026-11.md`
- Android向け: `ios/HANDOFF_ios_to_android.md`
