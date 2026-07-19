# SESSION MIGRATION PROMPT — AMD OS main 安全開始

```text
cd /Users/masa/projects/AMD/amd-os

目的:
- Codexの自動branch事故を再発させず、正本checkoutのmainだけで次の作業を始める。
- repo-targeted Local子タスク、Codex UIのHandoff、新branch、新worktreeは使わない。

最初に読む順:
1. /Users/masa/projects/AGENTS.common.md
2. /Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md
3. /Users/masa/projects/AMD/amd-os/HANDOFF.md
4. /Users/masa/projects/AMD/amd-os/CLAUDE.md
5. /Users/masa/projects/AMD/amd-os/AGENTS.md
6. /Users/masa/projects/AMD/amd-os/pwa/AGENTS.md
7. /Users/masa/projects/AMD/amd-os/pwa/CLAUDE.md
8. /Users/masa/projects/AMD/amd-os/pwa/manual/1-1-intro.md
9. /Users/masa/projects/AMD/amd-os/pwa/spec/1-3-reconstruction-coverage-audit.md
10. /Users/masa/projects/AMD/amd-os/pwa/spec/5-2-development-operations-current-spec.md
11. /Users/masa/projects/AMD/amd-os/pwa/manual/9-2-developer.md
12. /Users/masa/projects/AMD/amd-os/pwa/BUGS.md の先頭にあるCodex Local子タスク事故
13. /Users/masa/projects/AMD/amd-os/pwa/design_log/sessions_2026-07.md の2026-07-19 main復旧記録

状態スナップショット:
- 2026-07-17、親タスクがAMD OS repoをtargetにLocal子タスクを作ったため、Codexアプリが正本checkoutへ codex/019f6afff9097a60bada064e2d31df8b を作り、mainから自動切替した。
- 子タスク内に git switch / git branch の実行証跡はなく、branch作成は作業者へrepoルールが渡る前のアプリ側処理だった。
- 親タスクと原因子タスクには厳重注意を送り、AMD OSではLocal子タスク・UI Handoff・branch/worktreeを使わないと了承済み。
- 復旧前のdirty、untracked、全refs、16 stashは /Users/masa/.codex/cleanup_archives/amd-os-20260719-014300-main-recovery に保存・検証済み。
- rootはmainへ復旧済み。12 extra worktrees、16 local non-main branches、16 stash、culprit remote branchは整理済み。
- 再発防止は .codex/config.toml の multi_agent=false と、tracked .githooks/reference-transaction の二層。clone後は bash scripts/install-main-only-git-hook.sh を実行する。
- closeout build targetは v3.46.4。正確なcurrent SHAは下のコマンドでorigin/mainとproductionを照合する。

開始時に必ず実行:
git fetch origin main
git status -sb --untracked-files=all
git branch --show-current
git rev-list --left-right --count HEAD...origin/main
git worktree list --porcelain
git branch --format='%(refname:short)'
git stash list
git log --branches --not --remotes --oneline
git config --local --get core.hooksPath
scripts/worker-freshness-check.sh
curl -fsS https://amd-os-pwa.vercel.app/api/build-info

期待値:
- branch = main
- dirty = 0
- HEAD と origin/main = 同一
- ahead / behind = 0 / 0
- registered worktree = root 1件
- local branch = main 1本
- stash = 0
- unpushed local commit = 0
- core.hooksPath = /Users/masa/projects/AMD/amd-os/.githooks
- production = git_branch main、dirty false、git_shaがorigin/mainと一致

事故時の動き:
- 「ブランチを切り替えるには変更をコミットしてください」と出たらキャンセルする。
- 「コミットしてブランチを切り替える」は押さない。
- dirtyをreset/checkoutで消さない。patch、untracked、refs/stashをrepo外へarchiveしてverifyし、帰属を判定してからmainへ戻す。
- 原因不明のbranch/worktreeをそのまま削除しない。main未反映の固有commitとpatch-equivalentを分ける。

確立済み運用ルール:
- AMD OSはmain一本。Codex Desktopのrepo-targeted Local子タスク・UI Handoffを使わない。
- 分担が必要でも新branch/worktreeは作らない。同じmain、またはmainのdisposable clean cloneを使う。
- dirtyはbranch作成理由にもpush停止理由にもならない。対象ファイルだけstageし、git add .は禁止。
- local checkout、origin/main、production /api/build-infoを並べてcurrent truthを決める。
- PWA本番反映は AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh。CLI直接deployは禁止。
- raw本文、個人情報、secret、private URLをdurable artifactや最終報告へ出さない。

開始監査が全部期待値なら、branchを作らず、まさの次の依頼をmainで進める。
```
