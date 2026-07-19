# AMD OS Handoff

Last updated: 2026-07-19 JST

Target: `/Users/masa/projects/AMD/amd-os`
Topic: Codex 自動branch事故の復旧と main-only 開始条件

## Latest Session Summary

- Codex で main から新セッションを始めようとした際、「ブランチを切り替えるには変更をコミットしてください」アラートが出た事故を復旧した。
- 原因は、親タスクが AMD OS repo を target に Local 子タスクを作ったこと。Codex アプリが子タスクへ repo ルールを渡す前に `codex/019f6afff9097a60bada064e2d31df8b` を作り、正本 checkout を main から切り替えた。子タスク内に `git switch` / `git branch` の実行証跡はない。
- 原因タスクと親タスクの両方へ、AMD OS では Local 子タスク・UI Handoff・branch/worktree を使わないよう厳重注意を送付し、両方から了承を得た。
- 57 tracked changes、4 untracked files、16 stash、16 local non-main branches、12 extra worktreesを、検証済み外部archiveへ保存してから整理した。価値ある差分を消していない。
- 復旧archive: `/Users/masa/.codex/cleanup_archives/amd-os-20260719-014300-main-recovery`。patch、untracked tar、全refs/stash bundle、SHA256、reflog/status証跡を含み、bundle verify済み。
- root checkoutを `main = origin/main` へ戻し、culprit remote branchも削除した。157本の無関係なhistorical remote branchは、固有commitを持つものが多数あるため今回の削除対象外。archive bundleにはremote refsも含む。

## Durable Prevention

- `.codex/config.toml`: `[features] multi_agent = false`。
- `.githooks/reference-transaction`: `main` 以外のlocal branch作成を拒否。
- `scripts/install-main-only-git-hook.sh`: cloneごとにtracked hookを有効化。
- `CLAUDE.md` / `SETUP_NEW_MAC.md` / `/spec/5-2` / `/manual/9-2`: Local 子タスク禁止、アラート時はキャンセル、main復旧監査を同期。
- branch alertで `コミットしてブランチを切り替える` は押さない。

## Current Truth

- branch: `main`
- build target after this closeout: `v3.46.4`
- expected closeout state: dirty 0 / worktree 1 / local branch `main` only / stash 0 / ahead-behind `0 0`
- production truth: closeout commitをmainへpush後、`/api/build-info` の `git_branch=main` / `dirty=false` / final SHA一致で確認する。
- branch事故の既知復旧タスク: none

## First Next Action

1. 新セッションは repo root `/Users/masa/projects/AMD/amd-os` を開く。
2. `SESSION_MIGRATION_PROMPT.md` を貼り、main-only開始監査を実行する。
3. 監査が全て期待値なら、branchを作らず、まさの次の依頼をmainで開始する。

## Guardrails

- Codex Desktop の repo-targeted Local 子タスク・UI Handoffを使わない。
- 新branch / worktreeを作らない。分担が必要なら同じmain、またはmainのdisposable clean cloneを使う。
- dirtyを見つけてもbranchへ逃げず、owner / action / riskを分ける。
- `git add .` を使わず、対象ファイルだけstageする。
- PWA本番反映は `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh` を使う。
