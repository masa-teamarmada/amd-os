AMD OSの請求書における立替税率保持の反映確認を再開する。作業場所は`/Users/masa/projects/AMD/amd-os`。`pwa/`をセッションのcwdにしない。

読む順:

1. `/Users/masa/projects/AGENTS.common.md`
2. `/Users/masa/projects/AMD/amd-os/AGENTS.md`
3. `/Users/masa/projects/AMD/amd-os/HANDOFF.md`
4. `pwa/manual/1-1-intro.md`、`pwa/spec/1-3-reconstruction-coverage-audit.md`
5. `ios/DESIGN.md`、`pwa/design/FEATURE_REGISTRY.md`、`pwa/manual/6-3-invoice-and-billing-routine-spec.md`
6. `pwa/BUGS.md`、`pwa/design_log/sessions_2026-11.md`

状態:

- 承認済み立替は申請時の0%・8%・10%を請求書の明細・概算へ明細単位で引き継ぐ。未設定だけ10%に補完し、その他の税率はfreee発行前に拒否する。
- PWAの編集・発行モーダル、Edge Function、iOS `InvoiceStepView` を同じ計算規則に更新済み。DB migration・環境変数は変更していない。
- `npm --prefix pwa run test:admin-kiyo`、`test:member-payout-matching`、`test:critical-ui`、`tsc --noEmit`は成功。Next.jsローカルproduction buildは実行環境がポートbindを禁止するため、ソース外のTurbopackエラーで停止。iOSはSwiftPM診断キャッシュとCoreDeviceサービスが保護・隔離され、ここではコンパイルと実機installを完了できていない。
- 反映前に`git fetch origin`、`git rebase origin/main`を行う。`b0234a711`は`origin/main`の`02425ec90`とpatch-equivalentなため、重複が残らないことを確認する。

次タスク:

1. 未記録のiOS対応、仕様同期、版数、引き継ぎを対象ファイルだけ明示stageしてcommitする。
2. rebase後に正規deploy scriptでPWAを反映し、`https://amd-os-pwa.vercel.app/api/build-info`で今回のSHAを確認する。
3. `issue-invoice` Edge FunctionをPWAとは別に正規経路で反映し、関数の読戻しをする。
4. 通常のmacOS環境でiOSをbuildし、接続済み実機へinstall・launchして請求書画面の税額表示を確認する。

運用:

- main一本。作業前とpush直前にfetchし、対象ファイルだけを明示stageする。`git add .`は使わない。
- PWAの仕様変更はmanual・spec・FEATURE_REGISTRY・開発履歴へ同じ変更で反映する。画面確認はPC Chromeで行う。
- migrationは再適用しない。Edge FunctionはPWAとは別に反映・確認する。
- 本番完了は`/api/build-info`と対象画面、必要な関数ログの読戻しで判断する。
