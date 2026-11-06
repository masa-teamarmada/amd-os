# HANDOFF - 請求書の立替税率

- 更新: 2026-11-06 JST
- 作業種別: development
- 正本: `ios/DESIGN.md`、`pwa/design/FEATURE_REGISTRY.md`、利用手順: `pwa/manual/6-3-invoice-and-billing-routine-spec.md`

## 現在地

- 請求書へ上乗せする承認済み立替は、申請時の0%・8%・10%を明細単位で保持する。税率未設定の旧申請だけ10%を補完し、それ以外の税率はfreee発行前に止める。0%を偽値として10%へ置換しない。
- PWAの立替編集、請求書発行モーダルの税額概算、共通 `issue-invoice` Edge Function、iOS `InvoiceStepView` を同じ規則へ揃えた。iOSプレビューにも `tax_rate` を渡し、表示は固定の「消費税（10%）」ではなく「消費税（概算）」にした。
- DB migration・環境変数の変更はない。`check_invoice_expense_rule.mts` はPWA、Edge Function、iOSの0%・8%・10%の扱いを静的に検査する。
- `test:admin-kiyo`、`test:member-payout-matching`、`test:critical-ui`、TypeScript型検査は成功。Next.jsのローカルproduction buildは実行環境のポートbind禁止で停止した。iOSは既存依存を使ってもSwiftPMの診断キャッシュが保護領域へ書けず、実機/シミュレーターのCoreDeviceサービスも利用不可のため、ここではコンパイル・実機インストールを完了できていない。

## 未解決と最初の次アクション

1. この終了作業で、未記録のiOS対応・仕様同期・版数・引き継ぎを明示stageしてcommitする。
2. `git fetch origin`、`git rebase origin/main` を実行する。`b0234a711` は `origin/main` の `02425ec90` とpatch-equivalentなので、rebase後に重複していないことを確認する。
3. `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh` でPWAを反映し、`/api/build-info` のSHA一致を確認する。続けて `issue-invoice` Edge Functionを正規経路で反映・読戻しする。PWA反映だけで関数反映済みとは扱わない。
4. 通常のmacOS環境でiOSをbuildし、接続済み実機へinstall・launchして請求書画面の税額表示を確認する。

## 参照先

- 全画面仕様: `ios/DESIGN.md`
- 請求・立替の手順: `pwa/manual/6-3-invoice-and-billing-routine-spec.md`
- 請求書画面仕様: `pwa/design/FEATURE_REGISTRY.md`
- 再発防止メモ: `pwa/BUGS.md`
- 開発履歴: `pwa/design_log/sessions_2026-11.md`
- Android向け差分: `ios/HANDOFF_ios_to_android.md`
