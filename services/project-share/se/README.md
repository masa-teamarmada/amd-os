# SE PROJECT SHARE

SE関係者向けの、パスワード付きファイル共有ポータル。

- URL: `https://se.team-armada.jp`
- Vercel project: `se-project-share`
- Blob store: private `se-project-share`
- 保存prefix: `se/files/`
- 環境変数名: `SE_ACCESS_PASSWORD` / `SE_AUTH_SECRET`

ログイン後はファイル一覧を検索でき、外部からファイルをドロップしてアップロードできる。フォルダは「フォルダを作成」で作成し、行のダブルクリックでフォルダへ移動またはファイルを閲覧する。ファイル行の名前部分をドラッグしてフォルダ行へドロップすると移動する。

VSXの資料やPSIレビューは扱わない。保管データと認証はSE専用で、秘密値はリポジトリに置かない。

## 開発・検証

```sh
npm ci
npm run build
npm run check
npm test
git diff --check
```
