# AGENTS.md — services/project-share/zmp

ZMP向けのPJ別 Project Share インスタンス。AMD OS PWAとは独立したVercelサービスとして扱う。

- 公開URL: `https://zmp.team-armada.jp`
- Vercelプロジェクト: `zmp-project-share`
- Vercel Blob: private store `zmp-project-share`、prefix `zmp/files/`
- 環境変数名: `ZMP_ACCESS_PASSWORD` / `ZMP_AUTH_SECRET` / `ZMP_ALLOWED_EMAILS`

認証パスワード、署名鍵、許可メール一覧の実値はリポジトリ、HANDOFF、チャットへ保存しない。PJ間でBlob store、prefix、Cookie、環境変数を共有しない。
ルートは汎用ファイルポータルで、ファイルの一覧・検索・アップロード・フォルダ作成・ダブルクリック閲覧・フォルダへのドラッグ移動を提供する。
VSX固有の資料、ルート、固定表示行はこのインスタンスに持ち込まない。

変更時はこのディレクトリで `npm run build`、`npm run check`、`npm test`、`git diff --check` を確認する。
