# services/project-share/ — Project Share

PJ関係者・社外協力者へ、パスワード認証だけで資料・ファイルを共有するための機能群。
恒久仕様は [`SPEC.md`](SPEC.md) を正本にする。

## 汎用機能とPJ別インスタンスの境界

- **汎用機能**: パスワード認証 + HMAC署名Cookie、Vercel Blob（private store）を使った
  ファイル一覧・アップロード・フォルダ移動・署名付きダウンロード・インライン閲覧、という
  「認証付きファイル共有ポータル」の実装パターン。これは他PJにも展開できる形にしてある。
- **PJ別インスタンス**: 実際にVercelへデプロイする単位。1インスタンス = 1 Vercelプロジェクト
  = 1 Blob store = 1 セットの環境変数（パスワード・署名鍵）= 1 固有ドメイン。
  ある1つのPJの固定資料・ロゴ・写真などのcontent snapshotは、そのインスタンスディレクトリ
  配下の `content/` にだけ置く。

現在のインスタンス:

| dir | PJ | 公開URL |
|---|---|---|
| `vsx/` | VSX（香川大学 / AgVenture Lab） | `https://vsx.team-armada.jp` |
| `cx/` | CX | `https://cx.team-armada.jp` |
| `se/` | SE | `https://se.team-armada.jp` |
| `sx/` | SX | `https://sx.team-armada.jp` |
| `zmp/` | ZMP | `https://zmp.team-armada.jp` |

## 新しいPJへ展開する場合

汎用ロジック（`server/lib/` の認証・パス検証・セキュリティヘッダー、`server/routes/` の
ルートハンドラー）を無理に共通パッケージへ切り出さず、既存インスタンス（`vsx/`）を
まるごとコピーして新しいディレクトリ（例: `services/project-share/<pj>/`）を作る。

理由: インスタンスごとの環境変数・Blob prefix・ドメイン・contentを明示的に分離し、
PJ固有要件を混ぜないため。CX/SE/SX/ZMPは汎用ポータルのみを持ち、VSX固有の資料・外部rewrite・
固定表示行はコピー後に削除する。

コピー後にPJ別に変える必要があるもの:

- `content/` 配下の資料・ロゴ・写真
- `vercel.json` の rewrite（PJ固有の外部プロキシがあれば）
- Vercelプロジェクト名・ドメイン・Blob store・環境変数（パスワード・署名鍵）

変えないもの:

- `server/lib/` の認証・パス検証・セキュリティヘッダーのロジック
- `api/index.mjs` のルーター構造

### CX / SE / SX / ZMP インスタンス

`cx/`、`se/`、`sx/`、`zmp/` はファイル共有ポータル専用の初期空箱。各PJのパスワード値はVercel環境変数
にだけ設定し、リポジトリやURLへ記録しない。各インスタンスのREADMEを本番運用の入口にする。
