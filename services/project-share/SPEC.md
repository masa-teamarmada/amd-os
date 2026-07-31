# SPEC.md — Project Share 恒久仕様

正本。PJ別インスタンスの実装詳細は各インスタンスの `README.md`（[`vsx/README.md`](vsx/README.md)、
[`cx/README.md`](cx/README.md)、[`se/README.md`](se/README.md)、[`sx/README.md`](sx/README.md)、
[`zmp/README.md`](zmp/README.md)、[`kute/README.md`](kute/README.md)）を見る。ここには、インスタンス横断で守るべき
恒久仕様だけを置く。

## 目的

PJ関係者・社外協力者へ、AMD OS本体のログイン（Supabase Auth）を要求せずに、
1個のパスワードだけで資料・ファイルを共有する。1インスタンス = 1 PJ = 1 独立
Vercelプロジェクトとし、AMD OS PWA 本体の認証・データとは分離する。

## 認証モデル（恒久）

- 環境変数2つ（アクセスパスワード、HMAC署名鍵）をVercel環境変数にのみ置く。
  リポジトリ内のどのファイルにも平文で書かない。
- 未認証GETはログイン画面のみ返す。POSTのパスワード照合は `timingSafeEqual` を使う
  （タイミング攻撃対策）。
- 認証成功で発行するセッションCookieは、HMAC署名付き・`HttpOnly; Secure; SameSite=Lax`・
  有効期限つき。
- 変更系エンドポイント（アップロード、署名URL発行、削除、ログアウト等）は、セッション
  Cookieに加えて同一オリジン検証（Origin優先、Refererにフォールバック）を必須にする。
  ログインPOSTのみ、通常ブラウザのフォームPOSTとの互換性のため同一オリジン必須判定の
  対象外にできる（パスワード照合とCookie発行のセキュリティは維持したまま）。
- 環境変数が未設定の場合は `503` を返し、認証をバイパスしない。

## ファイル共有モデル（恒久）

- ストレージは Vercel Blob の private store を使い、PJごとに専用storeを分ける。
- 保管先はPJ専用のprefixで固定する（例: `vsx/files/`）。ファイル名・フォルダ名は
  パストラバーサル防止のバリデーションを通す。
- 一覧APIはBlobの生URLや署名付きURLを含まない。
- ダウンロード・閲覧は、短時間（分単位）だけ有効な署名付きURLをサーバー側で都度発行する
  方式に統一し、恒久的な公開URLを発行しない。
- アップロードは大容量ファイルに対応するため、クライアント直PUT（ブラウザから
  `@vercel/blob/client`）方式を使う。サーバーはアップロード許可トークンの発行だけを行う。
- ファイル名変更とフォルダ移動は、private Blobの`rename`を使って保存先の存在確認後に実行する。
  同名ファイルへの上書きは許可しない。名前はフォルダ名と同じ安全な文字列検証を通す。
- ファイルのポインタドラッグ移動中は、ドラッグ対象のファイル名プレビューをポインタに追従させる。
  移動先フォルダは背景・枠線・フォルダアイコンの色で示し、補助文言は表示しない。
- 全レスポンスに `Cache-Control: no-store` を含む共通セキュリティヘッダーとCSPを付与する。

## デプロイモデル（恒久）

- 各インスタンスは、AMD OS PWA（`pwa/`）とは別の独立Vercelプロジェクトにデプロイする。
  PWAの`main` push自動デプロイ対象とは混同せず、各インスタンスのREADMEに記載した方法で
  反映する。Git連携が未確認なら、`main` pushだけで反映されたと判断しない。
- ビルド生成物（HTML/画像を埋め込んだ module、ブラウザ向けバンドル）はローカルで生成し、
  git管理してデプロイ対象に含める。Vercel cloud build 側ではリモートで生成できない
  前提を維持する（`vercel.json` の `buildCommand` は生成物の存在確認だけを行う）。
- 各インスタンスのcontentは、そのインスタンスディレクトリの `content/` に閉じる。
  リポジトリ外の個人ディレクトリパスへ依存しない。

## 変更履歴

- 2026-07-23: VSX PROJECT SHARE（香川大学 / AgVenture Lab 向け）を最初のPJ別インスタンスとして
  AMD OS 配下へ正本移管。汎用仕様として本ファイルを新設。
- 2026-07-26: CX / SE PROJECT SHAREを追加。各PJに専用Vercelプロジェクト、private Blob store、
  prefix、認証環境変数、サブドメインを割り当て、VSX固有資料を持ち込まない構成にした。
- 2026-07-26: SX / ZMP PROJECT SHAREを追加。各PJに専用Vercelプロジェクト、private Blob store、
  prefix、認証環境変数、サブドメインを割り当て、VSX固有資料を持ち込まない構成にした。
- 2026-07-30: KUTE PROJECT SHAREを追加。専用Vercelプロジェクト、private Blob store、prefix、
  認証環境変数、サブドメインを割り当て、KUTE固有資料を持ち込まない初期空箱とした。
- 2026-07-31: KUTEに限り、外部URLをオンライン資料としてprivate Blobの専用prefixへ記録する機能を追加。
  URLの内容は取得・複製せず、URL・表示名・保存先フォルダだけを記録する。他のPJ別インスタンスには未展開。
