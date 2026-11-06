AMD OSの請求書における立替税率保持の本番反映を再開する。作業場所は `/Users/masa/projects/AMD/amd-os`。`pwa/` をセッションcwdにしない。

読む順:

1. `/Users/masa/projects/AGENTS.common.md`
2. `/Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md`
3. `/Users/masa/projects/AMD/amd-os/HANDOFF.md`
4. `pwa/manual/1-1-intro.md`、`pwa/spec/1-3-reconstruction-coverage-audit.md`
5. `ios/DESIGN.md`、`pwa/design/FEATURE_REGISTRY.md`、`pwa/manual/6-3-invoice-and-billing-routine-spec.md`
6. `pwa/BUGS.md`、`pwa/design_log/sessions_2026-11.md`

状態:

- 承認済み立替は申請時の0%・8%・10%を請求書の明細・概算へ明細単位で引き継ぐ。未設定だけ10%に補完し、その他の税率はfreee発行前に拒否する。
- PWA編集・発行モーダル、`issue-invoice` Edge Function、iOS `InvoiceStepView`、iOSの立替取得queryを更新済み。DB migration・環境変数は変更していない。
- 既存記録上、対象テスト・eslint・`npx tsc --noEmit`・iOS Debug / iphoneos署名付きbuildは成功。
- 実機install / launchだけはCoreDeviceService初期化タイムアウトで未完了。Next.js local production buildはport bind / Google Fonts名前解決制限で未完了。closeout時のfocused checkは無出力で停止したため、再開時に再実行する。
- `main` のHEADは `d9c40aaf0`、請求書関連のローカル差分は4コミット。`origin/main` のローカル参照は `02425ec90`。作業ツリーはclean、worktreeはmainの1つだけ。

次タスク:

1. `git fetch origin` してリモートの先行を確認し、必要ならrebaseしてから `git push origin main`。
2. `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh` で本番を監視し、`https://amd-os-pwa.vercel.app/api/build-info` のSHA一致を確認する。
3. `issue-invoice` Edge Functionを別途deployし、関数本文と0%・8%・10%の結果を読戻す。
4. CoreDeviceServiceが使える通常環境でmasaiPhoneへinstall・launchし、請求書の税額概算表示を確認する。

運用:

- main一本。push前にfetchし、対象ファイルだけ明示stageする。`git add .` は使わない。
- PWAの仕様変更はmanual・spec・FEATURE_REGISTRY・開発履歴へ同じ変更で反映する。
- migrationは再適用しない。Edge FunctionはPWAとは別に反映・確認する。
- 本番完了はVercel Ready、`/api/build-info`、Edge Function読戻し、実機install / launchで判断する。
