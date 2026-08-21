# 次セッション引き継ぎプロンプト（2026-08-21 資料室UI セッションから）

## 読む順

1. `/Users/masa/projects/AGENTS.common.md`（えいみ共通ルール正本）
2. `/Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md`（AMD level memory）
3. `/Users/masa/projects/AMD/amd-os/CLAUDE.md`（モノレポ全体ルール。main一本・branch全面禁止・commit即push）
4. `/Users/masa/projects/AMD/amd-os/pwa/CLAUDE.md`（PWA固有: deploy.sh・BUILD_VERSION bump・DDL適用）
5. `/Users/masa/projects/AMD/amd-os/pwa/HANDOFF_pwa_rebuild.md`（現在地・次の一手）
6. `/Users/masa/projects/AMD/amd-os/pwa/spec/3-8-cockpit-current-spec.md`（資料室の現行仕様。触る前に必読）
7. `/Users/masa/projects/AMD/amd-os/pwa/BUGS.md`（`[workspace-documents/room]` の2件が今回分）

## 状態スナップショット

- cwd: `/Users/masa/projects/AMD/amd-os`。branch `main`、ahead 0 / behind 0（2026-08-21 時点）。
- 本番: `https://amd-os-pwa.vercel.app`。`/api/build-info` は `v3.87.3` / SHA `6ff519dbab9e8b8185f576356bf428638e261bae`。
- このセッションの成果は `a6cd3d7d`（v3.86.2 フォルダ行drop）と `5ee97811`（v3.87.2 移動・削除・追加の即時反映）。どちらも本番に包含済み。
- 作業ツリーに残る dirty・未追跡は**別セッション所有**（資料室のHTML編集／デッキエディタ）。`pwa/package.json`、`pwa/src/app/api/workspace-documents/[documentId]/source/route.ts`、`pwa/src/lib/workspace-document-editing.ts`、`pwa/scripts/check_workspace_document_edit_frame.mts`、`check_workspace_document_html_editing.mts`、`pwa/src/app/api/workspace-documents/[documentId]/edit-frame/`、`pwa/src/components/workspace-documents/WorkspaceDocumentDeckEditor.tsx`、`pwa/src/lib/workspace-document-edit-agent.ts`、`pwa/src/lib/workspace-document-html-editing.ts`。**commit・revert・削除しない。**
- このセッションで作った branch / worktree: none。

## 次タスク

まさから追加依頼は出ていない。資料室を続けて触る場合の必達条件は以下。

- 資料室の一覧UI（`pwa/src/components/workspace-documents/WorkspaceDocumentRoom.tsx`）を変える前に、`pwa/spec/3-8-cockpit-current-spec.md` の資料室段落を読む。
- 守る契約3つ:
  1. mutation後に `await loadDocuments()` を復活させない。これがまさの言った「移動・削除・追加のたびに5〜7秒待たされる」の直接原因。背景同期は spinner を出さない `refreshDocuments()` のみ。
  2. ローカル反映は migration 217 の RPC（`workspace_move_document` / `workspace_archive_document`）のカスケードを鏡写しにする。folder移動は配下の `folderPath` を接頭辞置換、folder削除は配下ごと除去。ずれると背景同期の到着時に画面が飛ぶ。
  3. 失敗時は `setDocuments(snapshot)` で戻す。`create_link` だけは楽観行を作らない（開くURLが `documentId` 由来で `pending:` idは404）。
- 変更後は `node pwa/scripts/check_workspace_documents_contract.mjs` を必ず通す。

## このPJで確立済みの運用ルール

- **main一本。branch / worktree を作らない。** `spawn_task` で次セッションを起票しない（チップの起動導線が worktree を作る）。
- `git add .` は禁止。**今回触った対象ファイルだけを名前指定で stage** する。他セッションの dirty は戻さない。
- deploy に出す前に `pwa/src/lib/build-info.ts` の `BUILD_VERSION` を bump。**HEAD の実値を読んでから採る**（複数セッションが並行 bump しており、v3.87.0 / v3.87.1 は先取りされていた）。迷ったら patch。
- 本番反映は `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh`。他セッション所有の tracked dirty があると hard stop するので、その場合は対象ファイルだけを stage / commit して `git push origin main` を直接実行し、除外した差分を事後報告する。事前承認で止めない。
- 反映後は `/api/build-info` を readback し、`git merge-base --is-ancestor <自分のcommit> <本番SHA>` で本番包含を確認する。`vercel ls` のポーリングループは10分でタイムアウトするので回さない。
- 仕様を変えたら同じ作業単位で `pwa/manual/*.md`（使い方）と `pwa/spec/*.md`（実装仕様）を更新し、`pwa/manual/9-3-appendix-changelog.md` と `pwa/spec/6-1-appendix-changelog.md` の両方に追記する。
- 資料室の回帰は `pwa/scripts/check_workspace_documents_contract.mjs` がコード本文への正規表現検査で押さえている。他セッションが同じファイルを触ると既存 assertion が黙って落ちることがあるので、実行してから着手する。
