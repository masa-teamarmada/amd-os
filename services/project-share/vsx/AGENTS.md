# AGENTS.md — services/project-share/vsx

このディレクトリで作業する Claude / Codex / えいみが守るルール。

## これは何か

汎用「Project Share」機能（[`../README.md`](../README.md) 参照）の、VSX（香川大学 /
AgVenture Lab）向け PJ別パイロットインスタンス。AMD OS PWA（`pwa/`）とは完全に
独立した Vercel Node Function アプリで、`pwa/` の Next.js ビルド・デプロイパイプラインとは
一切結合しない。

- 公開URL: `https://vsx.team-armada.jp`
- Vercelプロジェクト: `vsx-agventure-lab`
- Vercel Blob store: `vsx-project-share`（prefix `vsx/files/`）

詳細仕様・認証方式・Blob運用・移管履歴は [`README.md`](README.md) を正本にする。

## 守ること

- **このディレクトリの実装を `pwa/` へ混ぜない**。共有する依存やコンポーネントはない。
  Next.js の型・lint・testパイプラインの対象にも含めない。
- **認証値をコミットしない**。`VSX_ACCESS_PASSWORD` / `VSX_AUTH_SECRET` / `VSX_ALLOWED_EMAILS` の
  実値はVercelの当該プロジェクトの環境変数にのみ置き、HANDOFFやチャットにも書かない。
  `.vercel/` はgit管理しない（`.gitignore`済み）。
- **`content/` 配下はこのインスタンス固有のcontent snapshot**。ここのPJ固有ハードコード
  （事業資料本体・ロゴ・写真・パスワードで守る対象データ）を、汎用Project Share機能へ
  無理に一般化しない。他PJへ同様の機能を展開する場合は、この `vsx/` をコピーして
  新しいインスタンスディレクトリ（例: `services/project-share/<pj>/`）を作る。
- **build.mjsはこのディレクトリ内で完結させる**。個人ホーム
  ディレクトリ配下や、リポジトリ外パスへの依存を新たに持ち込まない。素材を差し替える
  場合は `content/` 配下のファイルを置き換える。
- デプロイ前は必ずローカルで `npm run build` を実行し、生成物
  （`server/deck-data.mjs` / `public/vendor/blob-client.mjs`）をコミット・デプロイ対象に含める。
  Vercel cloud build はこの生成をリモートで実行できない。
- 変更後は `npm run check` と `npm test` を通す。
- 本番デプロイは AMD OS PWA の `main` push 自動デプロイとは別扱い。既存リンク先の
  Vercelプロジェクトへ、このディレクトリから `vercel --prod` で行う。
- 変更の要点・本番デプロイIDは [`README.md`](README.md) の「移管履歴 / これまでのデプロイ記録」
  節に追記する。
