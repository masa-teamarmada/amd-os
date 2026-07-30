# AMD OS Handoff

Last updated: 2026-07-30 JST

Target: `/Users/masa/projects/AMD/amd-os`

Topic: H-1の「自動更新だけ」の通知を生成しない

## Latest Session Summary

- H-1の `updated` は会議記録・予定カード・Notion議事録ひも付けを自動更新しただけの結果なので、`app_notifications(kind='h1_report')` を作らない。sanitized reportとautomation memoryは従来どおり毎run保存する。
- 通知するのは、まさの判断が必要な `review_required` と、具体的な行動・対象URL・完了条件を揃えた `blocked` だけ。いずれも行動契約が欠ければ通知にせず、次回runへ委ねる。
- 呼び出し側が誤って `--outcome updated` を渡しても、`notify_h1_report.mjs` がDB接続より前に成功終了するため、OS通知を書かない。
- 既に届いたH-1通知は履歴として残す。過去通知の削除はしていない。

## Repo / Production State

- canonical branch: `main`。このhandoff自体の文書commit後は、開始時にHEAD / origin/mainとahead/behindをread-onlyで取り直す。
- H-1実装commit: `17105192 fix(h1): stop OS notifications for updated H-1 outcome`。変更履歴・build version同期の機能基準commit: `789f6e43`。
- H-1機能はproduction `v3.51.24`で確認済み。次セッション開始時に `https://amd-os-pwa.vercel.app/api/build-info` のSHA / `main` / `dirty=false` をread-onlyで再確認する。
- worktreeはroot 1件、local branchは `main` のみ。今回生成したbranch/worktreeはない。

## Unresolved Tasks

- 実装の未解決はなし。
- 次の実H-1 runで `updated` が出たときは、sanitized report・automation memoryが残り、OS通知が増えていないことをread-onlyで確認できる。これは動作監視であり、追加実装は不要。

## First Next Action

H-1または他の通知で「読んでも何をすればよいか分からない」と報告されたときだけ、まず結果区分・行動主体・直接URL・完了条件をread-onlyで確認する。今回の対象はH-1のみで、別通知種別を一律停止・削除しない。

## Pointers

- H-1実行・通知の正本: [`pwa/design/L2_DATA.md`](pwa/design/L2_DATA.md)、[`pwa/spec/3-3-meeting-flow-current-spec.md`](pwa/spec/3-3-meeting-flow-current-spec.md)
- OSマニュアル: [`pwa/manual/8-3-l2-extraction-routines-spec.md`](pwa/manual/8-3-l2-extraction-routines-spec.md)
- 実行ガード: [`pwa/scripts/notify_h1_report.mjs`](pwa/scripts/notify_h1_report.mjs)、[`scripts/h1-background-runner-prompt.md`](scripts/h1-background-runner-prompt.md)
- 回帰検査: [`pwa/scripts/check_h1_notification_policy.mjs`](pwa/scripts/check_h1_notification_policy.mjs)
- バグ・再発防止: [`pwa/BUGS.md`](pwa/BUGS.md)
- 開発履歴: [`pwa/design_log/sessions_2026-07.md`](pwa/design_log/sessions_2026-07.md)
- 次セッション用prompt: [`SESSION_MIGRATION_PROMPT.md`](SESSION_MIGRATION_PROMPT.md)

## Verification Evidence

- `npm --prefix pwa run test:h1-notification-policy`、`npm --prefix pwa run test:notification-action-contract`、`npx tsc --noEmit`、`npm run build` が成功。
- buildには既存の `next.config.ts` NFT追跡warningが出るが、compile・TypeScript・静的ページ生成は成功した。
- production build-infoとVercel production deployment Readyを確認済み。

## Closeout Classification

- work type: `development`
- durable note: `pwa/design/L2_DATA.md`、`pwa/spec/3-3-meeting-flow-current-spec.md`、`pwa/manual/8-3-l2-extraction-routines-spec.md`、`pwa/BUGS.md`
- design_log: 更新あり。H-1通知writerの実装判断・検査・本番確認を記録するため。
- main alignment: `main aligned`
- archive condition: このhandoff文書のcommit/push/deploy確認後に再判定する。
