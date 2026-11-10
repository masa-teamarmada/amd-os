AMD OSの請求書における立替税率保持の本番反映を完了する。作業場所は `/Users/masa/projects/AMD/amd-os`。`pwa/` をセッションcwdにしない。

読む順:

1. `/Users/masa/projects/AGENTS.common.md`
2. `/Users/masa/.codex/memories/MEMORY.md`
3. `/Users/masa/projects/AMD/amd-os/HANDOFF.md`
4. `/Users/masa/projects/AMD/amd-os/AGENTS.md`
5. `pwa/manual/1-1-intro.md`、`pwa/spec/1-3-reconstruction-coverage-audit.md`
6. `ios/DESIGN.md`、`pwa/design/FEATURE_REGISTRY.md`、`pwa/manual/6-3-invoice-and-billing-routine-spec.md`
7. `pwa/BUGS.md`、`pwa/design_log/sessions_2026-11.md`

状態:

- 承認済み立替は申請時の0%・8%・10%を請求書の明細・概算へ明細単位で引き継ぐ。未設定だけ10%に補完し、その他の税率はfreee発行前に拒否する。
- PWA編集・発行モーダル、iOS `InvoiceStepView`、iOSの立替取得query、`issue-invoice`のソースを更新済み。DB migration・環境変数は変更していない。
- GitHub mainには実装とこの引き継ぎが反映済み。PWA本番の実装commit `e606cf1bd` はREADY。PWAの管理画面・支払照合・重要画面の回帰検査と型検査は成功。
- `issue-invoice` は本番へ未反映。この管理環境にはSupabase CLIのアクセストークンが無く、通常のCLI反映も実行できなかった。次回はログイン済みの通常Mac環境で反映する。
- iOSのシミュレーターbuildと実機install / launchはCoreSimulator/CoreDeviceとSwiftPM cacheの管理環境制約で未確認。PWA本番の版情報URLも閲覧承認が出せず未確認。

次タスク:

1. `git fetch origin --prune` してmainがorigin/mainと一致することを確認する。差分があればff-onlyで取り込む。
2. Supabase CLIへログインしてから、`cd /Users/masa/projects/AMD/amd-os/ios && supabase functions deploy issue-invoice --project-ref nbnhrhybjslbawdukvvk` を実行する。JWT検証を維持し、請求書の新規発行を検証目的で行わない。
3. 配布済み `issue-invoice` の本文で、立替は0%・8%・10%をそのまま渡し、未設定だけ10%、その他は発行前に拒否する分岐を読戻す。
4. `https://amd-os-pwa.vercel.app/api/build-info` が `e606cf1bd` を返すことを確認する。
5. masaiPhoneへinstall・launchし、請求書画面の「消費税（概算）」が立替ごとの税率を反映することを確認する。

運用:

- main一本。push前にfetchし、対象ファイルだけ明示stageする。`git add .` は使わない。
- PWAの仕様変更はmanual・spec・FEATURE_REGISTRY・開発履歴へ同じ変更で反映する。
- migrationは再適用しない。Edge FunctionはPWAとは別に反映・確認する。
- 本番完了はVercel READY、`/api/build-info`、Edge Function読戻し、実機install / launchで判断する。
