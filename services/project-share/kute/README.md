# KUTE PROJECT SHARE

KUTE関係者向けの、許可メールアドレス＋パスワード付きファイル共有ポータル。

- URL: `https://kute.team-armada.jp`
- Vercel project: `kute-project-share`
- Blob store: private `kute-project-share`
- 保存prefix: `kute/files/`
- 環境変数名: `KUTE_ACCESS_PASSWORD` / `KUTE_AUTH_SECRET` / `KUTE_ALLOWED_EMAILS`
- ログインはメールアドレス許可リスト＋既存パスワード方式。`KUTE_ALLOWED_EMAILS` に登録した
  メールアドレスのみログイン可能で、セッションCookieは30日間有効。詳細は
  [`../SPEC.md`](../SPEC.md) の「認証モデル（恒久）」を見る。

ログイン後はファイル一覧を検索でき、外部からファイルをドロップしてアップロードできる。フォルダはフォルダ＋アイコンで作成し、行のダブルクリックでフォルダへ移動またはファイルを閲覧する。ファイル行の「名前変更」からファイル名を編集でき、操作ボタン以外のどこをドラッグしても、行そのものの半透明プレビューがポインタについてきて、フォルダ行へドロップすると移動する。HTMLファイルは通常ダウンロードではなく「PDF化ダウンロード」でA4 PDFとして保存する。

ツールバーのリンク＋アイコンから、Google DriveやBoxなどの http / https URLをオンライン資料として追加できる。URLの中身をコピーせず、KUTE専用のprivate BlobへURL・表示名・保存先フォルダだけを記録する。表示名は省略でき、URLから自動設定される。オンライン資料も検索・名前変更・削除・フォルダ移動に対応し、行のダブルクリックで新しいタブに開く。元サービス側の閲覧権限はそのまま適用される。

VSXの資料やPSIレビューは扱わない。保管データと認証はKUTE専用で、秘密値はリポジトリに置かない。

## 開発・検証

```sh
npm ci
npm run build
npm run check
npm test
git diff --check
```
