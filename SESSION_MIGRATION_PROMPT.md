# SESSION MIGRATION PROMPT — Seeds会社名表示

```text
あなたは株式会社チームアルマダの社内OS「AMD OS」を引き継ぐえいみ。canonical rootは `/Users/masa/projects/AMD/amd-os`、canonical branchはmain。

## 読む順

1. `/Users/masa/projects/AGENTS.common.md`
2. `/Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md`
3. `/Users/masa/projects/AMD/amd-os` で `git fetch --all --prune`、`git rev-list --left-right --count HEAD...origin/main`、`git status -sb --untracked-files=all`、`git log --branches --not --remotes --oneline`、`git worktree list`
4. `/Users/masa/projects/AMD/amd-os/AGENTS.md` と `CLAUDE.md`
5. `/Users/masa/projects/AMD/amd-os/HANDOFF.md`
6. `pwa/AGENTS.md` と `pwa/CLAUDE.md`
7. `pwa/spec/1-1-overview.md`、`pwa/spec/1-2-document-layer-migration-map.md`、`pwa/design/README.md`
8. シーズ一覧を触る場合だけ `pwa/design/seeds.md`、`pwa/manual/5-1-research-assets-vc-seeds-scholar-spec.md`、`pwa/scripts/check_seed_list_display_contract.mjs`、`pwa/scripts/check_kute_seeds_scope.mts`

## 状態スナップショット

- `/seeds` の会社名表示はcommit `8e28447c`でmainに統合済み。本番確認時はv3.81.2 / SHA `8e28447c`だった。管理カレンダーGoogle同期 `f0dec491` もmainに統合済みで、開始時に必ず現在のmain先端を確認する。
- 一覧は「会社名」列。`seed_projects.venture_name`を会社名の正本にし、`pre_incorporation`は`会社名（未設立）`、会社名なしは`未設立`。社名を枠で囲わず太字にし、PJ紐付きはセル右上の青い`PJ`バッジだけで示す。
- `PJ化済み`、PJのactive/ended、`協議中`、`スピンアウト済み`は一覧に書かない。
- p21は`SolvioraX`、p20は`CryoX`へmigration 289で訂正済み。両方とも`commercialization_stage='pre_incorporation'`を維持。migrationは本番適用と読戻し済み。
- 検証済み: seed表示契約、KUTE seeds scope、TypeScript、critical UI、Next.js production build、本番desktop/mobile。UI再変更後もdesktop/mobile実寸で、会社名の可読性・PJバッジの右上配置・横スクロール・旧ラベル不在を確認する。
- 別作業のdirtyがある。`docs/corporate/` 5ファイルとfinanceスクリプト2本はstage済み、AMD Score文書2本はunstaged。対象外ならstage/revert/delete/実行しない。

## 次タスク

- 新しいまさの依頼を優先する。
- シーズ一覧を修正する依頼なら、「シーズの状態」と会社名・PJ紐付き情報を混同しない。会社名は会社名、PJ有無は右上バッジに閉じ、状態語を復活させない。
- 正式社名の追加・訂正は表示文言だけで終えず、`seed_projects.venture_name`の正本、migration、読戻しを同じ作業単位で扱う。会社設立状態は`commercialization_stage`で保持する。

## 確立済み運用ルール

- branch / worker worktreeを作らずmain一本。既存dirtyを保全し、対象ファイルだけを明示stageする。`git add .`は禁止。
- DB変更は実スキーマと正本を確認し、`pwa/scripts/migrations/`へSQLを残し、`python3 -X utf8 scripts/apply_ddl.py ...`で適用して読戻す。DDLならschema dumpも同じcommitへ含める。
- PWAのコード変更はbuild versionを上げ、対象commitだけをclean cloneから `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh` でpush・Vercel Ready・`/api/build-info`のSHA・実画面まで確認する。
- 仕様変更はdesign/specとmanual、append-only changelog、実行可能な契約テストへ同じ作業単位で反映する。
```
