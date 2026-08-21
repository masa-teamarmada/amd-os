# 次セッション用 移行プロンプト（AMD OS PWA / 2026-08-21）

## 0. 最初に読む順

1. `/Users/masa/projects/AGENTS.common.md`（えいみ共通ルール正本）
2. `/Users/masa/.claude/projects/-Users-masa-projects-AMD/memory/MEMORY.md`（AMD階層の記憶索引）
3. `/Users/masa/projects/AMD/amd-os/CLAUDE.md`（モノレポ運用・main一本・commit即push）
4. `/Users/masa/projects/AMD/amd-os/pwa/AGENTS.md` と `pwa/CLAUDE.md`（PWA固有・deploy方針）
5. `/Users/masa/projects/AMD/amd-os/pwa/HANDOFF_pwa_rebuild.md`（直近セッション状態）
6. `/Users/masa/projects/AMD/amd-os/pwa/spec/1-1-overview.md` → 該当領域の `pwa/spec/*.md`
7. `/Users/masa/projects/AMD/amd-os/pwa/BUGS.md`（少なくとも冒頭の直近エントリ）

cwd は `/Users/masa/projects/AMD/amd-os`。

## 1. 状態スナップショット（2026-08-21 時点）

- ブランチ: `main` 一本。behind 0 / ahead 0 で `origin/main` と一致。今セッションで作ったbranch・worktreeは無い。
- 直近commit: `ab7cde4a fix(workspace-documents): keep Japanese file names in signed download URLs`
- 本番: `https://amd-os-pwa.vercel.app` / `/api/build-info` は `v3.87.1` / `ab7cde4ae7c184c9b9d50bea3b569a6f4168813e` / `deployed_at 2026-08-21T09:34:33.921Z`。
- 別セッション所有のdirtyが作業ツリーに残っている（資料室のHTML編集まわり: `pwa/src/lib/workspace-document-editing.ts`、`api/workspace-documents/[documentId]/source/route.ts`、`pwa/package.json`、未追跡の `WorkspaceDocumentDeckEditor.tsx` / `workspace-document-html-editing.ts` / `edit-frame/` など）。**触らない・commitしない・消さない。**
- 別セッションの `229edcfc`（v3.87.0 / PJ知財台帳の列追加）は今回のpushで一緒にorigin/mainへ上がっている。

## 2. 今セッションでやったこと（背景）

資料室のHTML資料をPDF化したときの不具合3件を、まさの実ファイルで潰した。

1. **左右に巨大な余白** — 資料HTML側の `@page` がPDF生成側のスタイルを上書きしていた。PDF専用CSSで元HTMLの `@page` を無効化（`ca2e7c0f`）。
2. **中途半端な改ページ** — 見出しだけが前ページ末尾に残る／最終ページが空白。見出しと直後の本文ブロックを同ページへ保ち、末尾の空ページを落とした（`daecf9c3` / v3.86.1）。まさから「うん、いい感じになった」と確認済み。
3. **日本語ファイル名の文字化け** — `SE_%25E6%258A%2580….pdf` になる。supabase-jsの `createSignedUrl(path, ttl, { download })` が名前を `encodeURIComponent` してクエリへ載せる一方、Storageはクエリの生値をデコードせずそのまま `Content-Disposition` の `filename` / `filename*` に入れるため二重エンコードになる。`withWorkspaceDownloadFileName(signedUrl, fileName)` を `pwa/src/lib/workspace-documents-core.ts` に追加し、`download=` を自前で1回だけエンコードして付ける方式へ変更（`ab7cde4a` / v3.87.1）。

**踏んではいけない罠**: ダウンロード名を付けるときに supabase-js の `{ download }` オプションへ戻さない。必ず `withWorkspaceDownloadFileName()` を経由する。`encodeURIComponent` が残す `'` `(` `)` `*` はRFC 5987のattr-char外なので追加でパーセント化する処理も、この関数の中にある。

## 3. 次のタスク

まさからの新しい指示待ち。未解決の宿題は無い。資料室のPDF周りを再度触るなら、`pwa/src/lib/workspace-document-html-pdf.ts` / `workspace-documents-core.ts` / `api/workspace-documents/[documentId]/pdf/route.ts` / `.../open/route.ts` を先に読む。

## 4. このPJで確立済みの運用ルール

- **branch作成は全面禁止。** main で直接 commit & push。worktree も作らない。dirty はbranchを作る理由にならない。
- **commitしたら即push。** 1機能=1commit。push直前に `git fetch origin main` して他セッションの更新を見る。
- **push = Vercel自動production deploy。** `npx vercel` 直接実行は禁止。原則ノンストップ・事後報告。
- 標準手順: 実装 → `npx tsc --noEmit` → 対象ファイルのESLint → `npm run build` → 対象ファイルだけ `git add`（`git add .` は禁止）→ commit → `AMD_OS_VERCEL_DEPLOY_APPROVED=1 bash pwa/scripts/deploy.sh`。
- `deploy.sh` は tracked dirty があると hard stop する。他セッション所有のdirtyが原因なら、それには触らず `git push origin main` を直接実行し、`/api/build-info` をpollingしてbuild versionとSHAをreadbackする。**コマンド成功だけで完了と呼ばない。**
- 仕様変更は同じcommitで正本へ反映する: 使い方 → `pwa/manual/`、確定実装仕様 → `pwa/spec/`、未移行領域 → `pwa/design/`。変更した層の附則（`manual/9-3`、`spec/6-1`）に日時つきで追記する。
- バグ・事故は `pwa/BUGS.md` に 症状／原因／対応内容／再発防止策 の形で残す。
- 開発履歴は `pwa/design_log/sessions_YYYY-MM.md` へ追記する。戦略・MTG準備など非開発作業はここへ入れない。
