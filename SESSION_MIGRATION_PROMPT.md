# SESSION MIGRATION PROMPT — H-1通常更新の通知抑止

```text
cd /Users/masa/projects/AMD/amd-os

あなたは株式会社チームアルマダの社内OS「AMD OS」を引き継ぐえいみ。まさは、通知を見ても「何をどうすればよいか」が分からないなら通知の意味がないと指摘した。今回、H-1が会議記録・予定カード・Notion議事録のひも付けを自動更新しただけの `updated` はOS通知を生成しないようにした。既存実装をやり直さず、以下の正本を読んでから次の報告・修正に着手する。

## 最初に読む順

1. /Users/masa/projects/AGENTS.common.md
2. /Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md
3. /Users/masa/projects/AMD/amd-os/HANDOFF.md
4. /Users/masa/projects/AMD/amd-os/AGENTS.md
5. /Users/masa/projects/AMD/amd-os/CLAUDE.md
6. /Users/masa/projects/AMD/amd-os/pwa/AGENTS.md
7. /Users/masa/projects/AMD/amd-os/pwa/CLAUDE.md
8. /Users/masa/projects/AMD/amd-os/pwa/design/L2_DATA.md の「H-1の報告と通知」節
9. /Users/masa/projects/AMD/amd-os/pwa/spec/3-3-meeting-flow-current-spec.md のH-1節
10. /Users/masa/projects/AMD/amd-os/pwa/manual/8-3-l2-extraction-routines-spec.md のH-1節
11. /Users/masa/projects/AMD/amd-os/pwa/BUGS.md の `[notifications/H-1]` 項目
12. /Users/masa/projects/AMD/amd-os/pwa/design_log/sessions_2026-07.md の「2026-07-30 — H-1」節

## 状態スナップショット

- canonical cwd / branch: `/Users/masa/projects/AMD/amd-os` / `main`。H-1機能の基準commitは `789f6e43`、production確認は `v3.51.24` で済んでいる。handoff文書のcommit後はSHAが進むため、開始時に必ず `git status -sb --untracked-files=all`、`git rev-parse HEAD`、`git rev-parse origin/main`、`git worktree list --porcelain`、`curl -fsS https://amd-os-pwa.vercel.app/api/build-info` をread-onlyで取り直す。
- 実装commitは `17105192`。`pwa/scripts/notify_h1_report.mjs` は `--outcome updated` を受けるとDB接続より前に `{ok:true, action:'skipped_updated_outcome'}` を返し、`app_notifications` を書かない。誤呼び出しも成功終了にするので、呼び出し元のsanitized report/automation memory保存は続く。
- H-1が通知を作るのは `review_required` と `blocked` だけ。両方とも、まさが取る具体的行動、直接対象URL、完了条件の3つを必須にする。3つを埋められない一時失敗は通知せず、report/memoryに記録して次回runで再試行する。
- `updated`、対象なし、変更なし、既存カード確認のみ、次回runで自動再試行できる一時失敗はOS通知を作らない。過去に届いた通知は履歴として残しており、削除していない。

## 次タスク

1. 次の実H-1 runで `updated` が出た場合だけ、sanitized reportとautomation memoryが保存され、同run由来の `app_notifications(kind='h1_report')` が作られていないことをread-onlyで確認する。直接DB削除や過去通知の一括削除はしない。
2. まさが他の通知についても「何をすればよいか分からない」と報告したら、まず通知種別・生成経路・行動主体・直接URL・完了条件を確認する。H-1の今回の判断を、別の通知種別へ無断で横展開して止めない。
3. H-1の通知挙動を変えるときは、実装、`pwa/design/L2_DATA.md`、`pwa/spec/3-3-meeting-flow-current-spec.md`、`pwa/manual/8-3-l2-extraction-routines-spec.md`、manual/spec changelog、`pwa/BUGS.md`、development design logを同じ変更単位で同期する。

## 確立済みの運用ルール

- main一本。branch/worktreeを新規作成しない。共有checkoutがdirtyでも対象ファイルだけを明示stageし、`git add .` / `git add -A`は使わない。
- 通知は、読む人が自分で完了できる行動を求めるものだけにする。実行報告、空振り、内部再試行、まさの判断が不要な自動更新はreport/memoryに残し、OS通知には出さない。
- 正本反映と候補/outbox/通知を混同しない。外部サービスやDBのwriteは既存の認可済み経路を使い、readbackで確認する。
- PWA本番反映は `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh`。生の`git push`や`npx vercel`直接deployは使わない。PWAコードまたはユーザー表示を変えるdeployでは `pwa/src/lib/build-info.ts` をpatch bumpする。
- H-1変更後は最低限 `npm --prefix pwa run test:h1-notification-policy`、`npm --prefix pwa run test:notification-action-contract`、`npx tsc --noEmit`、`npm run build`、production `/api/build-info` を確認する。buildの既存NFT追跡warningは、成功を偽らず既知warningとして分離する。
```
