# ZMP PROJECT SHARE

ZMP関係者向けの、パスワード付きファイル共有ポータル。

- URL: `https://zmp.team-armada.jp`
- Vercel project: `zmp-project-share`
- Blob store: private `zmp-project-share`
- 保存prefix: `zmp/files/`
- 環境変数名: `ZMP_ACCESS_PASSWORD` / `ZMP_AUTH_SECRET`

ログイン後はファイル一覧を検索でき、外部からファイルをドロップしてアップロードできる。フォルダはフォルダ＋アイコンで作成し、行のダブルクリックでフォルダへ移動またはファイルを閲覧する。ファイル行の名前部分をドラッグしてフォルダ行へドロップすると移動する。

ツールバーのリンク＋アイコンから、Google DriveやBoxなどの `http` / `https` URLをオンライン資料として追加できる。URLの中身はコピーせず、ZMP専用private Blobの `zmp/links/` にURL・表示名・保存先フォルダだけを記録する。オンライン資料も検索・名前変更・削除・フォルダ移動に対応し、行のダブルクリックで新しいタブに開く。元サービス側の閲覧権限はそのまま適用される。

VSXの資料やPSIレビューは扱わない。保管データと認証はZMP専用で、秘密値はリポジトリに置かない。

## 開発・検証

```sh
npm ci
npm run build
npm run check
npm test
git diff --check
```
