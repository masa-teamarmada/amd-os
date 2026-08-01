# SE PROJECT SHARE

SE関係者向けの、許可メールアドレス＋パスワード付きファイル共有ポータル。

- URL: `https://se.team-armada.jp`
- Vercel project: `se-project-share`
- Blob store: private `se-project-share`
- 保存prefix: `se/files/`
- 環境変数名: `SE_ACCESS_PASSWORD` / `SE_AUTH_SECRET` / `SE_ALLOWED_EMAILS`
- ログインはメールアドレス許可リスト＋既存パスワード方式。`SE_ALLOWED_EMAILS` に登録した
  メールアドレスのみログイン可能で、セッションCookieは30日間有効。詳細は
  [`../SPEC.md`](../SPEC.md) の「認証モデル（恒久）」を見る。

ログイン後はファイル一覧を検索でき、外部からファイルをドロップしてアップロードできる。フォルダはフォルダ＋アイコンで作成し、行のダブルクリックでフォルダへ移動またはファイルを閲覧する。ファイル行の名前部分をドラッグしてフォルダ行へドロップすると移動する。

ツールバーのリンク＋アイコンから、Google DriveやBoxなどの `http` / `https` URLをオンライン資料として追加できる。URLの中身はコピーせず、SE専用private Blobの `se/links/` にURL・表示名・保存先フォルダだけを記録する。オンライン資料も検索・名前変更・削除・フォルダ移動に対応し、行のダブルクリックで新しいタブに開く。元サービス側の閲覧権限はそのまま適用される。

VSXの資料やPSIレビューは扱わない。保管データと認証はSE専用で、秘密値はリポジトリに置かない。

## 開発・検証

```sh
npm ci
npm run build
npm run check
npm test
git diff --check
```
