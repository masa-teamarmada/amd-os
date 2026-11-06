AMD OSの請求書における立替税率保持の本番反映を再開する。作業場所は `/Users/masa/projects/AMD/amd-os`。`pwa/` をセッションcwdにしない。

読む順:

1. `/Users/masa/projects/AGENTS.common.md`
2. `/Users/masa/projects/AMD/amd-os/AGENTS.md`
3. `/Users/masa/projects/AMD/amd-os/HANDOFF.md`
4. `pwa/manual/1-1-intro.md`、`pwa/spec/1-3-reconstruction-coverage-audit.md`
5. `ios/DESIGN.md`、`pwa/design/FEATURE_REGISTRY.md`、`pwa/manual/6-3-invoice-and-billing-routine-spec.md`
6. `pwa/BUGS.md`、`pwa/design_log/sessions_2026-11.md`

状態:

- 承認済み立替は申請時の0%・8%・10%を請求書の明細・概算へ明細単位で引き継ぐ。未設定だけ10%に補完し、その他の税率はfreee発行前に拒否する。
- PWA編集・発行モーダル、`issue-invoice` Edge Function、iOS `InvoiceStepView` とiOSの立替取得queryを更新済み。DB migration・環境変数は変更していない。
- `test:admin-kiyo`、`test:member-payout-matching`、`test:critical-ui`、対象eslint、`npx tsc --noEmit` は成功。iOS Debug / iphoneos署名付きbuildも成功。
- 実機install / launchだけはCoreDeviceService初期化タイムアウトで未完了。Next.js local production buildは管理環境のport bind / Google Fonts名前解決制限で未完了。
- GitHub現行mainは `02425ec90`。反映予定差分は `/tmp/amd-os-closeout-git.RG4REe/git` のmainで現行mainへrebase済み。元checkoutの `.git` は管理sandboxでindex書込みを拒否され、古いlocal commit列のまま。
- この終了セッションはGitHubとSupabaseのwrite connectorが承認必須かつ承認不可設定だったため、push、Vercel本番反映、Edge Function反映を完了できなかった。

次タスク:

1. `git fetch origin` し、mainが `02425ec90` のままならrebase済みtemp Gitのmainをpushする。進んでいれば再rebaseしてからpushする。
2. `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh` で本番を監視し、`https://amd-os-pwa.vercel.app/api/build-info` のSHA一致を確認する。
3. `issue-invoice` Edge Functionを別途deployし、関数本文を読戻す。
4. CoreDeviceServiceが使える通常環境でmasaiPhoneへinstall・launchし、請求書の税額概算表示を確認する。

運用:

- main一本。push前にfetchし、対象ファイルだけ明示stageする。`git add .` は使わない。
- PWAの仕様変更はmanual・spec・FEATURE_REGISTRY・開発履歴へ同じ変更で反映する。
- migrationは再適用しない。Edge FunctionはPWAとは別に反映・確認する。
- 本番完了はVercel Ready、`/api/build-info`、Edge Function読戻し、実機install / launchで判断する。
