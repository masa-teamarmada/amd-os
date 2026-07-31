# CX PROJECT SHARE

CX関係者向けの、パスワード付きファイル共有ポータル。

- URL: `https://cx.team-armada.jp`
- Vercel project: `cx-project-share`
- Blob store: private `cx-project-share`
- 保存prefix: `cx/files/`
- 環境変数名: `CX_ACCESS_PASSWORD` / `CX_AUTH_SECRET`

ログイン後はファイル一覧を検索でき、外部からファイルをドロップしてアップロードできる。フォルダはフォルダ＋アイコンで作成し、行のダブルクリックでフォルダへ移動またはファイルを閲覧する。ファイル行の名前部分をドラッグしてフォルダ行へドロップすると移動する。

ツールバーのリンク＋アイコンから、Google DriveやBoxなどの `http` / `https` URLをオンライン資料として追加できる。URLの中身はコピーせず、CX専用private Blobの `cx/links/` にURL・表示名・保存先フォルダだけを記録する。オンライン資料も検索・名前変更・削除・フォルダ移動に対応し、行のダブルクリックで新しいタブに開く。元サービス側の閲覧権限はそのまま適用される。

VSXの資料やPSIレビューは扱わない。保管データと認証はCX専用で、秘密値はリポジトリに置かない。

## 開発・検証

```sh
npm ci
npm run build
npm run check
npm test
git diff --check
```
