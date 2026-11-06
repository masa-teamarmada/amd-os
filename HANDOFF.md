# HANDOFF - 請求書の立替税率

- 更新: 2026-11-06 JST
- 作業種別: development
- 正本: `ios/DESIGN.md`、`pwa/design/FEATURE_REGISTRY.md`
- 利用手順: `pwa/manual/6-3-invoice-and-billing-routine-spec.md`

## 現在地

- 承認済み立替は、申請時の0%・8%・10%を請求書の明細と概算へ明細単位で引き継ぐ。未設定だけ10%に補完し、その他の税率はfreee発行前に拒否する。
- PWAの立替編集・請求書発行モーダル、共通 `issue-invoice` Edge Function、iOS `InvoiceStepView` を同じ規則へ揃えた。iOSの取得queryにも `tax_rate` を追加済み。
- DB migration・環境変数の変更はない。
- GitHubの現行mainは `02425ec90`。反映予定差分は、`/tmp/amd-os-closeout-git.RG4REe/git` のmainで現行mainへrebase済み。元checkoutの `.git` は管理sandboxでindex書込みを拒否されるため、古いlocal commit列のまま残っている。

## 検証

- `test:admin-kiyo`、`test:member-payout-matching`、`test:critical-ui`、対象eslint、`npx tsc --noEmit`: 成功。
- iOS Debug / iphoneos署名付きbuild: `BUILD SUCCEEDED`。
- 実機install / launch: `devicectl` がCoreDeviceService初期化タイムアウトとなり未完了。
- Next.js local production build: 管理環境のport bind / Google Fonts名前解決制限で未完了。ソース由来の型エラーは確認されていない。

## 未解決と最初の次アクション

1. `git fetch origin` 後、GitHub mainが `02425ec90` のままなら、rebase済みtemp Gitのmainをpushする。変わっていれば再rebaseしてからpushする。
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
