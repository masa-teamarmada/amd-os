# SESSION MIGRATION PROMPT — PJワークスペース 継続

```text
あなたは株式会社チームアルマダの社内OS「AMD OS」を引き継ぐえいみ。
前セッションでは、PJワークスペースのガント並べ替えが元へ戻る不具合をトランザクション保存へ直し、初期表示の旧・淡い和風色をAMD配色へ統一した。再読み込みは重いmanagement投影を他queryと並列化し、PJ名・active member・表示名だけを認可確認後60秒cacheへ分離した。ガント・論点・関係先・週次データはfresh readのまま。

## 読む順

1. `/Users/masa/projects/AGENTS.common.md`
2. `/Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md`
3. `/Users/masa/projects/AMD/amd-os` で `git fetch --all --prune`、`git rev-list --left-right --count HEAD...origin/main`、`git status -sb --untracked-files=all`、`git log --branches --not --remotes --oneline`、`git worktree list`
4. `/Users/masa/projects/AMD/amd-os/AGENTS.md`
5. `/Users/masa/projects/AMD/amd-os/CLAUDE.md`
6. `/Users/masa/projects/AMD/amd-os/HANDOFF.md`
7. `pwa/AGENTS.md` と `pwa/CLAUDE.md`
8. `pwa/spec/3-16-project-weekly-control-current-spec.md`
9. `pwa/manual/2-3-pj-cockpit.md`
10. `pwa/BUGS.md` の `workspace/gantt-task-reorder` と `workspace/loading-performance`

## 状態スナップショット

- canonical repoは `/Users/masa/projects/AMD/amd-os`、canonical branchは`main`。開始時にorigin/mainとのahead/behind、未push commit、dirtyを必ず再確認する。
- 並べ替え修正はcommit `71a8ca5f`、初期配色・reload修正は`4167691d`。どちらもmain、本番へ反映済み。
- 本番desktop/mobileで旧skin 0件、背景`#f5f5f7`、横崩れなし、console warning/error 0件を確認済み。再読み込み実測は約4.1〜5.1秒。
- 回帰検査は `pwa/scripts/check_workspace_reload_contract.cjs` と並べ替え関連のAPI/DB契約検査。TypeScriptとproduction buildも前セッションで成功済み。
- AMD Scoreの2文書、`docs/corporate/`の文書群、financeの2スクリプト、Admin運用カレンダー一式は別作業のdirty。corporate/financeはstage済み、Admin/AMD Scoreはunstaged、Admin pageはuntracked。対象タスクでない限りstage・revert・削除・実行しない。

## 次タスク

- 今回の依頼自体は完了。新しいまさの依頼を優先する。
- もしワークスペースのさらなる高速化を求められたら、最初にproduction相当で各Supabase queryとRSC payloadの所要時間を計測する。現状の4.1〜5.1秒を基準にし、最重量枝を特定してから改善する。
- ガント、論点、関係先、週次データを丸ごとcacheして編集直後に古い値を返す案は採らない。認可は毎回freshに確認する。
- UI変更後はdesktop/mobile実寸、旧skin不在、背景色、横overflow、console warning/errorを再確認する。

## 確立済みの運用ルール

- branch / worker worktreeを作らずmain一本。既存dirtyを保全し、対象ファイルだけを明示stageする。
- commit前にorigin/mainをfetchし、同じ正本mdの並行更新を確認する。
- PWAはbuild versionを上げ、`AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh`でmain push、Vercel Ready、`/api/build-info`のgit SHAまで確認する。dirtyな正規checkoutからdeployしない場合は、mainの同一commitを持つ使い捨てclean cloneを使う。
- 仕様変更は `pwa/spec/3-16-project-weekly-control-current-spec.md`、人向け挙動は `pwa/manual/2-3-pj-cockpit.md`、再発防止は `pwa/BUGS.md` と実行可能な検査へ同じ作業単位で反映する。
- 本番確認はbuild/versionだけで終えず、実際のworkspace画面でまさが報告した操作・見た目を確認する。
```
