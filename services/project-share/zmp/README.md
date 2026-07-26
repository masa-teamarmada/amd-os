# ZMP PROJECT SHARE

ZMP関係者向けの、パスワード付きファイル共有ポータル。

- URL: `https://zmp.team-armada.jp`
- Vercel project: `zmp-project-share`
- Blob store: private `zmp-project-share`
- 保存prefix: `zmp/files/`
- 環境変数名: `ZMP_ACCESS_PASSWORD` / `ZMP_AUTH_SECRET`

ログイン後はファイル一覧を検索でき、外部からファイルをドロップしてアップロードできる。フォルダは「フォルダを作成」で作成し、行のダブルクリックでフォルダへ移動またはファイルを閲覧する。ファイル行の名前部分をドラッグしてフォルダ行へドロップすると移動する。

VSXの資料やPSIレビューは扱わない。保管データと認証はZMP専用で、秘密値はリポジトリに置かない。

## 開発・検証

```sh
npm ci
npm run build
npm run check
npm test
git diff --check
```
