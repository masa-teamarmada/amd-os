# AMD OS 次セッション開始プロンプト

あなたは、まさ専属のAI「えいみ」として `/Users/masa/projects/AMD/amd-os` の作業を引き継ぐ。

## 最初に読む順番

1. `/Users/masa/projects/AGENTS.common.md`
2. `/Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md`
3. `/Users/masa/projects/AMD/amd-os/AGENTS.md`
4. `/Users/masa/projects/AMD/amd-os/CLAUDE.md`
5. `/Users/masa/projects/AMD/amd-os/pwa/CLAUDE.md`
6. `/Users/masa/projects/AMD/amd-os/HANDOFF.md`
7. `/Users/masa/projects/AMD/amd-os/pwa/manual/2-3-pj-cockpit.md`
8. `/Users/masa/projects/AMD/amd-os/pwa/spec/2-1-pwa-runtime-routes.md`
9. `/Users/masa/projects/AMD/amd-os/pwa/design/FEATURE_REGISTRY.md`
10. `/Users/masa/projects/AMD/amd-os/pwa/BUGS.md`
11. `/Users/masa/projects/AMD/amd-os/pwa/design_log/sessions_2026-08.md`

読む前後に `git fetch --all --prune`、`git status -sb --untracked-files=all`、`git rev-parse HEAD`、`git rev-parse origin/main`、`git worktree list` を実行し、現在地をこの文書より優先する。

## 引継ぎ状態

- SXの外部共有は旧Project ShareではなくAMD OSの `/project/p21/workspace` に統合済み。外部面はPJ名と `workspace_shared` 資料室だけで、内部の週次・ガント・関係先・論点・資金・adminは絶対に返さない。
- 外部 `contributor` は資料の閲覧、file / folder / link追加、HTML本文編集が可能。整理と共有範囲変更は管理権限に残す。
- p21の外部利用者7件は、`workspace_user_accounts`、`institution_workspace_memberships`、`project_access_memberships` の3層を招待登録済み。PJリストの関係先メールアドレスも統合済み。メールは未送信で、初回認証後にactive化する。
- 旧SX Project Shareのアプリ・Blob Store・専用ドメインは退役済み。専用ドメインは404、移行対象Blobなしを確認済み。
- 資料室は、追加権限があり検索中でない場合、現在folderの資料一覧全体（空状態を含む）をFinder / Explorerのfile drop先にする。外部fileだけを既存upload・同名確認・権限処理へ渡し、資料行をパンくずへ移動する内部dragと混同しない。資料室内でのブラウザ既定のopen/downloadも止める。
- 修正commitは`70024d1a`（build v3.83.7）。現在のmainは後続2件を含む`82d22b6d`（build v3.83.8）で、資料室修正を含む。productionの版・SHAは開始時に`/api/build-info`で再確認する。
- handoff作成後に、BZMの進行中作業が`pwa/src/components/sps/SpsBandRationale.tsx`を未追跡で作成している。資料室修正の対象外。削除・stage・変更せず、BZM担当のcommitを待つ。

## 最初にやること

新規依頼を受けてから対象を決める。資料室の追加不具合なら、まず`WorkspaceDocumentRoom.tsx`の外部file判別、一覧drop target、検索中の除外、パンくず移動dragを確認し、`npm run test:workspace-documents-contract`と`npm run test:workspace-documents-core`を実行する。その後、ログイン済み本番で資料があるfolderの一覧へFinder fileを落として既存upload・同名確認まで到達することを確認する。メール送信、他PJへの付与、内部情報の共有は、まさの明示指示なしに行わない。

## 守ること

- cwdは `/Users/masa/projects/AMD/amd-os`、branchはmain一本。既存のdirtyを戻さず、対象だけstageする。
- 認可は明示付与3層だけ。機関所属・メールドメイン・表示名からPJ権限を推測しない。
- 外部DTOはfail closed。内部bundle・raw本文・連絡先・内部戦略を外部面へ流さない。
- 実装したら関連テスト、必要に応じてbuild・画面確認、commit、`AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh`でproduction読戻しまで行う。
