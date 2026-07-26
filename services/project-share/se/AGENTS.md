# AGENTS.md — services/project-share/se

SE向けのPJ別 Project Share インスタンス。AMD OS PWAとは独立したVercelサービスとして扱う。

- 公開URL: `https://se.team-armada.jp`
- Vercelプロジェクト: `se-project-share`
- Vercel Blob: private store `se-project-share`、prefix `se/files/`
- 環境変数名: `SE_ACCESS_PASSWORD` / `SE_AUTH_SECRET`

認証パスワードと署名鍵の値はリポジトリへ保存しない。PJ間でBlob store、prefix、Cookie、環境変数を共有しない。
ルートは汎用ファイルポータルで、ファイルの一覧・検索・アップロード・フォルダ作成・ダブルクリック閲覧・フォルダへのドラッグ移動を提供する。
VSX固有の資料、ルート、固定表示行はこのインスタンスに持ち込まない。

変更時はこのディレクトリで `npm run build`、`npm run check`、`npm test`、`git diff --check` を確認する。
