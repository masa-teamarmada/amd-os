# services/project-share/ — Project Share

PJ関係者・社外協力者へ、パスワード認証だけで資料・ファイルを共有するための機能群。
恒久仕様は [`SPEC.md`](SPEC.md) を正本にする。

## 正本と引き継ぎ

- いま動いている機能・認証・ストレージ・PDF化の仕様: [`SPEC.md`](SPEC.md)
- Vercel上のPDF化で判明した実装上の注意: [`DEBUG.md`](DEBUG.md)
- 次回の作業開始位置: [`HANDOFF.md`](HANDOFF.md)
- 新しいセッションへ渡すそのまま使える依頼文: [`SESSION_MIGRATION_PROMPT.md`](SESSION_MIGRATION_PROMPT.md)

## 汎用機能とPJ別インスタンスの境界

- **汎用機能**: パスワード認証 + HMAC署名Cookie、Vercel Blob（private store）を使った
  ファイル一覧・アップロード・名前変更・フォルダ移動・署名付きダウンロード・インライン閲覧、という
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
| `kute/` | KUTE（工学院大学） | `https://kute.team-armada.jp` |

## 新しいPJへ展開する場合

汎用ロジック（`server/lib/` の認証・パス検証・セキュリティヘッダー、`server/routes/` の
ルートハンドラー）を無理に共通パッケージへ切り出さず、既存インスタンス（`vsx/`）を
まるごとコピーして新しいディレクトリ（例: `services/project-share/<pj>/`）を作る。

理由: インスタンスごとの環境変数・Blob prefix・ドメイン・contentを明示的に分離し、
PJ固有要件を混ぜないため。CX/SE/SX/ZMP/KUTEは汎用ポータルのみを持ち、VSX固有の資料・外部rewrite・
固定表示行はコピー後に削除する。

コピー後にPJ別に変える必要があるもの:

- `content/` 配下の資料・ロゴ・写真
- `vercel.json` の rewrite（PJ固有の外部プロキシがあれば）
- Vercelプロジェクト名・ドメイン・Blob store・環境変数（パスワード・署名鍵）

変えないもの:

- `server/lib/` の認証・パス検証・セキュリティヘッダーのロジック
- `api/index.mjs` のルーター構造

### CX / SE / SX / ZMP / KUTE インスタンス

`cx/`、`se/`、`sx/`、`zmp/`、`kute/` はファイル共有ポータル専用の初期空箱。各PJのパスワード値はVercel環境変数
にだけ設定し、リポジトリやURLへ記録しない。各インスタンスのREADMEを本番運用の入口にする。
