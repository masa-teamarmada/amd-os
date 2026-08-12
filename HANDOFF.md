# AMD OS Handoff

最終更新: 2026-08-13 JST

対象: 資料室の高密度化を本番反映、共有checkoutの同期待ち

作業種別: 開発・本番反映

## 今回の到達点

- 資料室を、scope rail・操作toolbar・短いdrop rail・密な一覧行で構成する高密度UIへ変更した。権限、資料操作、独立route、データ正本は不変。
- 実装commitは`374d5a28`、mobile操作面積の追補は`c59b319d`。いずれもorigin/mainに含まれる。
- production `v3.72.23` / `c59b319d`で資料室を確認した。その後のmainは別レーンの`v3.72.34` / `6a5c4017`まで進行済み。
- 実測はdesktop 1440×900で一覧10行分の高さ、mobile 390×843で主要操作44px以上、document／modal横overflow 0。

## 正本と現在地

- 資料室の設計正本: `pwa/design/FEATURE_REGISTRY.md` の「資料室」。
- 人向け運用: `pwa/manual/2-3-pj-cockpit.md` の「資料」。
- 変更履歴と実装履歴: `pwa/manual/9-3-appendix-changelog.md`、`pwa/design_log/sessions_2026-08.md`。
- 過去のつくよみ外部リサーチ確認は、今回の資料室作業と独立。再開時は現行仕様とautomation実行記録をread-onlyで確認する。

## Repo状態

- canonical path: `/Users/masa/projects/AMD/amd-os`。
- `origin/main`とproductionは`v3.72.34` / `6a5c4017`で一致。
- 正規checkoutはorigin/mainに対してahead 1。この未push handoff commitは資料室の仕様・manual・履歴・handoffだけ。未commitは`pwa/AGENTS.md`と重要情報抽出・通知feedbackの4ファイルで、今回の資料室作業とは別レーン。
- worktreeは正規checkoutに加え、detached `/Users/masa/.codex/worktrees/f8b1/amd-os` がある。稼働中の別Codex sessionが使っていることを確認済み。終了・closeoutまで削除・pruneしない。

## 検証済み

- `npm run test:workspace-documents-core`
- `npm run test:workspace-documents-contract`
- `npm run test:critical-ui`
- `npx eslint src/components/workspace-documents/WorkspaceDocumentRoom.tsx`
- `npx tsc --noEmit`、`npm run build`
- production資料室のdesktop/mobile実測、`/api/build-info`で`v3.72.23` / `c59b319d`を確認

## 未解決

- 資料室の実装は完了。仕様・manual・履歴の同期はこのhandoff更新で行う。
- closeoutは未完了。資料室handoff commitがorigin/mainよりahead 1で、他レーンのdirtyが残り、detached worktreeは稼働中の別Codex sessionが所有している。

## 次セッションで最初にすること

別レーンの5 dirty pathのownerと調整し、この資料室handoff commitをpushできるcleanなmainへ戻す。稼働中のdetached worktreeはそのsessionのcloseoutまで保全する。資料室の実装commitはすでにorigin/mainに含まれるため再適用しない。

## 参照先

- 次セッション用プロンプト: `SESSION_MIGRATION_PROMPT.md`
- 資料室の設計: `pwa/design/FEATURE_REGISTRY.md`
- 人向け手順: `pwa/manual/2-3-pj-cockpit.md`
- 実装履歴: `pwa/design_log/sessions_2026-08.md`
- 再発防止: `pwa/BUGS.md`
