# services/project-share/vsx — VSX PROJECT SHARE

汎用「Project Share」機能の、PJ別パイロットインスタンス。AMD OS の PWA とは別の独立
Vercel サービスとして、パスワード認証付きの Vercel Node Function で動く。認証済み
ユーザーに、AgVenture Lab 事業資料（`GET /documents/agventure-lab`）に加えて、Vercel
Blob（private store）上のプロジェクト共有ファイルを一覧・アップロード・閲覧・削除できる
ポータルを提供する。

VSX（香川大学 / AgVenture Lab）固有の資料は `content/` 配下に
content snapshot として同梱している。汎用機能とPJ別インスタンスの境界は
[`../README.md`](../README.md) を参照。

## 本番情報

- 公開URL: `https://vsx.team-armada.jp`（Vercel alias設定済み）
- Vercelプロジェクト: `vsx-agventure-lab`（`.vercel/project.json` はローカルのみ、gitに含めない）
- Vercel Blob: 専用のprivate store `vsx-project-share`、保管先プレフィックスは `vsx/files/` 固定
- PJ別の秘密値（`VSX_ACCESS_PASSWORD` / `VSX_AUTH_SECRET`）は、このリポジトリのどのファイルにも
  書かず、Vercelの当該プロジェクトの Environment Variables にのみ設定する

PSI Step 2共同レビュー資料は `https://vsx.team-armada.jp/psi-step2` で配信する。
`vercel.json` の限定的な外部rewriteにより、資料本体、Next.jsアセット、資料専用API、画像だけを
`vsx-psi-step2-review` プロジェクトへ転送する。ブラウザ上のURLとセッションCookieは
`vsx.team-armada.jp` 配下に保ち、ポータルのファイルAPIとは競合させない。

## 構成

- `content/` — このインスタンス固有のcontent snapshot。build.mjsが読む素材はここに閉じる。
  - `index.html` — AgVenture Lab事業資料本体（旧 `agventure-lab-business-deck/index.html` の
    スナップショット）。
  - `assets/logo-symbol.png` / `assets/logo-type.png` — AMD正規ロゴ2点。
  - `assets/cover-illustration.png` — 事業資料の表紙イラスト。
  - `assets/tech-photo.png` — 技術説明用の生成写真。
  - `assets/business-model-*.png` — ビジネスモデルの主体3者を示す生成画像ピクト。コード描画ではなく`<img>`で使う。
- `build.mjs` — 2つの成果物を生成する。ローカルでのみ実行し、両方を Vercel へのデプロイ対象に
  必ず含めること（cloud build ではリモートで実行できない）。この配置だけで完結し、
  リポジトリ外のファイル（個人ホームディレクトリ配下等）には一切依存しない。
  - `server/deck-data.mjs` — `content/index.html` と `content/assets/` 配下のロゴ2点・
    表紙イラスト・技術写真・ビジネスモデルの生成画像ピクト3点を data URL に変換して埋め込んだ、Function バンドル内 module。
    static ディレクトリでの公開は行わない。
  - `public/vendor/blob-client.mjs` — `@vercel/blob/client` を esbuild でブラウザ向けに
    バンドルしたもの。ポータルの素の HTML/JS から `import { upload } from "/vendor/blob-client.mjs"`
    として読み込み、100MB超のファイルはブラウザから直接マルチパートアップロードする。
- `api/index.mjs` — 唯一の Vercel Function（`api/` 配下はこのファイルのみ。Hobby プランの
  Serverless Functions 上限に抵触しないよう、共有モジュールは `server/` へ分離している）。
  `vercel.json` の rewrites で全ルートがここに集約され、パス名で各ルートへディスパッチする薄いルーター。
- `server/lib/` — ルート間で共有するモジュール。
  - `security.mjs` — 共通セキュリティヘッダー（`Cache-Control: no-store` 等）と CSP。
  - `auth.mjs` — HMAC 署名付きセッション Cookie の発行・検証、パスワード照合。
  - `origin.mjs` — 変更系リクエストの同一オリジン検証（Origin優先、Refererにフォールバック）。
  - `pathGuard.mjs` — Blob パス名 `vsx/files/<folder...>/<basename>` の組み立てとパストラバーサル防止。
  - `body.mjs` — フォーム/JSON ボディの読み取り（上限付き）。
  - `respond.mjs` — JSON/HTML/text レスポンスの送信ヘルパー。
  - `blobStore.mjs` — `@vercel/blob` の `list` / `head` / `rename` / `del` / `issueSignedToken` /
    `presignUrl` の薄いラッパー。テストで差し替えられるよう関数を注入可能にしている。
- `server/routes/` — ルートごとのハンドラー。
  - `login.mjs` — `GET/POST /`。未認証 GET はログイン画面、POST はパスワード照合とセッション発行。
  - `portal.mjs` — 認証済み `GET /` で返すポータル本体（素の HTML/JS、ビルド不要）。
  - `deckDocument.mjs` — `GET /documents/agventure-lab`。認証済みなら `DECK_HTML` をそのまま返す。
  - `files.mjs` — `GET/PATCH/DELETE /api/files`。一覧、既存ファイルのフォルダ移動、削除を扱う。
    一覧レスポンスは Blob URL を含まない（name/size/uploadedAt のみ）。
  - `folders.mjs` — フォルダの作成・一覧を扱う。
  - `upload.mjs` — `POST /api/upload`。`@vercel/blob/client` の `handleUpload` で、
    `vsx/files/` 配下のみ・上書き禁止・最大 500MB のクライアントトークンを発行する。
  - `access.mjs` — `POST /api/access`。`issueSignedToken` + `presignUrl` で 5分間だけ有効な
    private read URL をダウンロード用に発行する。
  - `view.mjs` — `GET /api/view`。認証・pathname検証後、private Blobを同一オリジンから
    インラインでストリーム表示する。HTMLはsandbox CSP下で配信する。
  - `logout.mjs` — `POST /api/logout`。セッション Cookie を失効させる。
- `public/robots.txt` — 全クローラーの全パスクロールを拒否する（`User-agent: *` / `Disallow: /`）。
- `vercel.json` — `buildCommand` はリモートで `build.mjs` を実行せず、構文チェックと
  `server/deck-data.mjs` / `public/vendor/blob-client.mjs` の存在確認だけを行い、
  `mkdir -p public` でプレースホルダを作る。全リクエストは `api/index.mjs` へ rewrite する。

## 認証方式

- 環境変数 `VSX_ACCESS_PASSWORD`（閲覧パスワード）と `VSX_AUTH_SECRET`（HMAC署名鍵）を
  Vercel の Environment Variables に設定する。値はこのリポジトリのどのファイルにも書かない。
- 未認証の GET リクエストにはログイン画面のみを返す。
- POST でパスワードを送信すると `timingSafeEqual` で照合し、成功時に 12 時間有効な
  HMAC 署名付き Cookie（`HttpOnly; Secure; SameSite=Lax`）を発行してポータルを返す。
- 認証済みの `GET /` はポータル、`GET /documents/agventure-lab` は事業資料 HTML を返す。
- 環境変数が未設定の場合は `503`。
- `/api/*` の変更系エンドポイント（upload / access / files PATCH・DELETE / logout）は、
  認証済み Cookie に加えて同一オリジン（Origin もしくは Referer が Host と一致）を要求する。
  ログインPOST（`POST /`）のみ同一オリジン必須判定の対象外（通常ブラウザからのフォームPOSTで
  Originヘッダが送られないケースの互換性のため）。
- 全レスポンスに `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`,
  `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Content-Security-Policy` を付与する。
- パスワードや Cookie の値はログに出力しない。

## Vercel Blob（private store）

- 保管先プレフィックスは `vsx/files/` 固定。フォルダは安全なパスセグメントとして扱い、
  ファイル名はベース名のみ（`/`・`\` を含む名前や `.` / `..` は拒否）で保存する。
- アップロードはブラウザから `@vercel/blob/client` の `upload()` を使い、`POST /api/upload`
  （`handleUpload`）でサーバー側の許可（`access: "private"`, `allowOverwrite: false`,
  `maximumSizeInBytes: 500MB`）を発行してから直接 Blob へ PUT する。100MB を超えるファイルは
  自動的にマルチパートアップロードになる。
- 閲覧は認証済みの `GET /api/view` が5分間だけ有効な署名付きURLをサーバー側で取得し、
  ファイルを `vsx.team-armada.jp` 内からインライン配信する。アップロードHTMLはsandbox CSP下で
  表示するため、ポータルのCookieや更新系APIへ同一オリジン権限を持たせない。
- ダウンロードは `POST /api/access` が `issueSignedToken` + `presignUrl` で5分間だけ有効な
  署名付きURLを発行し、ブラウザがそのURLへ直接アクセスする。一覧API（`GET /api/files`）は
  署名付きURLやBlobの生URLを一切含まない。
- 日本語ファイル名はVercel Blob 2.6.1のdelegation token内で文字化けするため、delegation tokenは
  GET操作と有効期限だけに制限し、最終的なpresigned URLの署名で対象pathnameを1件に固定する。
- 削除はサーバー側で `vsx/files/` 配下であることを検証したうえで `del()` を呼ぶ。
- 既存ファイルのフォルダ移動は `PATCH /api/files` が移動元と移動先を検証し、`rename()` を
  `allowOverwrite: false` で呼ぶ。同名ファイルがある移動先は409で拒否し、上書きしない。

## ビルド（デプロイ前にローカルで必須）

新配置（`services/project-share/vsx/`）を cwd にして実行する。

```sh
cd services/project-share/vsx
npm ci
npm run build
```

`server/deck-data.mjs` と `public/vendor/blob-client.mjs` が生成される。この2つの生成物を
Vercel へのデプロイ対象に必ず含めること。Vercel cloud build はリモートで `build.mjs` を
実行できないため、`buildCommand` では構文チェックと生成物の存在確認のみを行う。

## ローカル確認

```sh
cd services/project-share/vsx
npm run build
npm run check
npm test
```

## デプロイ

このディレクトリは AMD OS PWA（`pwa/`）とは別の独立した Vercel プロジェクトにデプロイする。
AMD OS PWA の `main` push 自動デプロイとは別扱い。ローカルの `.vercel/project.json` が既存プロジェクトリンク
（`vsx-agventure-lab`）を保持しているので、このディレクトリ内から通常どおり
`vercel --prod` でデプロイできる。実際のVercelプロジェクト側のGit連携／Root Directory設定は
未確認のため、ここでは断定しない。

```sh
cd services/project-share/vsx
npm run build
vercel --prod
```

## 移管履歴 / これまでのデプロイ記録

このインスタンスは、旧 `kagawa/agventure-lab-business-deck/deploy/` で実装・本番デプロイ
された VSX PROJECT SHARE の実装一式を、AMD OS 配下の恒久正本として移管したもの。
公開URL・Vercelプロジェクト・Blob storeは変更していない。

以下は旧配置での本番デプロイ・機能追加の記録（要点、時系列）。

### 本番デプロイ（2026-07-22）

- Vercelプロジェクト `vsx-agventure-lab` として本番デプロイ済み。公開URL:
  `https://vsx.team-armada.jp`（Vercel alias設定済み）。
- `team-armada.jp` の権威DNSに `A vsx 76.76.21.21`（TTL 600）を追加し、権威DNS解決とHTTPS 200を
  確認済み。
- `VSX_ACCESS_PASSWORD` を本番環境変数として更新済み（値はこのファイルに記載しない）。
- Vercel Blobは専用のprivate store `vsx-project-share` を使用する。
- `npm run check` / `npm run build` / `npm test`（node:test 64件）はすべて成功。
- 本番実測: 未認証APIは401、ログイン/ポータル/ファイル一覧/`GET /documents/agventure-lab`/
  ログアウトは各200。実ファイルをアップロードして一覧反映を確認し、署名付きダウンロードが200かつ
  内容一致、削除が200で残件0であることを確認済み。

### hotfix（2026-07-22）: 通常ブラウザからのログインがForbiddenになる不具合を修正

- 本番で、通常ブラウザのHTMLフォームからのログインPOSTが同一オリジン検証によりForbiddenになる
  不具合を修正した。ログインPOSTのみ同一オリジン必須判定を外し、PJパスワード照合（`timingSafeEqual`）
  とHMAC署名付きCookie発行は維持した。認証後のアップロード / 署名URL発行 / 削除 / ログアウトの
  同一オリジン防御は変更していない。
- 本番へ再デプロイ済み。curl実測でOriginなしの通常ログインが200、誤パスワードが401、認証後の
  cross-origin操作が403であることを確認。Chromeで`vsx.team-armada.jp`にPJ名・パスワードでログインし、
  ポータル・アップロードボタン・既存AgVenture Lab資料の表示を確認済み。

### 追加修正・フォルダ機能・最終検証（2026-07-22）

- ロゴが過大表示される不具合とmodule scriptが読み込まれず操作不能になる不具合を修正。
- 固定表示されるAgVenture Lab資料行を、認証チェックを介さない素の別タブ open link
  （`GET /documents/agventure-lab`、認証は同エンドポイント側で維持）に変更。
- フォルダ機能を追加。作成・開く・空フォルダの削除、ネストしたパスでの一覧・作成に対応。
  空でないフォルダの削除は409で拒否する。
- ブラウザからのBlobアップロードに必要な`vercel.com`への接続のみをCSPで許可するよう、
  既存のCSPをアップロード動線に必要な範囲に絞って更新した。
- 本番の最終デプロイID: `dpl_Fp9eVSwQbP2rtYvdTj4VKuxAcQgV`。
- `npm run check` / `npm run build` / `npm test`（node:test 125件）はすべて成功。
- Chromeでの実機E2E確認: フォルダの作成・オープン、アップロードが100%到達すること、
  AgVenture Lab資料のオープン、空でないフォルダの削除保護（409）を確認。検証用に作成した
  テストデータは削除済み。
- デスクトップ表示と390px幅のモバイル表示で最終ビジュアル確認を実施。横方向のoverflowなし、
  仕上がりの品質確認は10点満点中9点。

### Finder / エクスプローラーからのドラッグ＆ドロップ対応（2026-07-22）

- OSのファイル管理画面からポータルへファイルをドロップすると、現在開いているフォルダへ
  アップロードする操作を追加した。複数ファイルの同時ドロップにも対応する。
- ファイルをドラッグしている間だけ、一覧全体を青い破線のドロップ領域として表示する。
  テキストやリンクのドラッグは対象外とし、ファイルをページへ落としたときのブラウザ遷移も防止する。
- ドロップ後は既存のアップロード処理を共用するため、進捗表示・Blobへの保存・一覧再取得・
  エラー表示はアップロードボタンと同じ挙動になる。アップロード中の二重実行も抑止する。
- `npm run check` / `npm run build` / `npm test` はすべて成功（node:test 133件）。
- 本番デプロイID: `dpl_6Q3P9jWvepwUqQDRLZXPoZtjpMPC`。公開URLは従来どおり
  `https://vsx.team-armada.jp`。
- 本番でルートおよび既存フォルダ内へのアップロードを確認し、確認用ファイルは削除済み。
  デスクトップ1597×904とモバイル390×844で横方向overflowなし、コンソールエラーなしを確認した。
  OS外部からの実ドラッグ自体は自動操作できないため、ドラッグイベント・ファイル判定・
  現在フォルダへの受け渡しは自動テストで検証した。

### PSI共同レビューの独自URL配信・日本語ファイル名修正（2026-07-22）

- `https://vsx.team-armada.jp/psi-step2` を共同レビュー資料の正式公開URLにした。
- 資料本体、Next.jsアセット、コメントAPI、画像だけを `vsx-psi-step2-review` へ内部転送し、
  VSX PROJECT SHAREの認証・ファイルAPIは従来どおりこのプロジェクトで処理する。
- `PSI Step 2` フォルダの共同レビュー入口HTMLを、正式公開URLへ向けた版に差し替えた。
- 日本語pathnameで署名URL発行が失敗する問題と、別タブをポップアップ扱いする問題を修正。
- `npm run check`、`npm run build`、node:test 144件が成功。
- 本番デプロイID: `dpl_FspPNTF2e1uYyjbix1WR6NXtjSTw`。

### 香川大学受領資料を反映した事業説明資料（2026-07-22）

- AgVenture Lab事業資料を、顧客課題、現場実績、製品・事業モデル、事業化基盤、PSI検証計画、
  オンサイトPoC、事業化の出口の順へ再構成した。
- 受領資料に記載された参画メンバーの役割を反映し、山地正洋の表記を修正した。
- `npm run build`、`npm run check`、node:test 141件が成功。
- 本番デプロイID: `dpl_7QZbLeftmFgnEsiovGdZXMdEK65v`。

### 行ダブルクリックで開く操作への統一（2026-07-22）

- 固定資料・フォルダ・ファイルの各行から「開く」「表示」ボタンを廃止し、行の操作欄以外を
  ダブルクリックすると開く操作へ統一した。フォルダは同じ画面内で移動し、固定資料とファイルは
  新しいタブで開く。キーボード利用者向けに、行フォーカス時のEnter / Spaceも同じ操作にした。
- ダウンロード・削除の操作欄は行ダブルクリックの対象外。ボタンの既存動作は維持した。
- 非公開Blobの直リンクがChrome側で遮断されるケースを避けるため、ファイル閲覧用の
  `GET /api/view` を追加し、認証・pathname検証後にポータルと同じオリジンから安全にストリーム表示する。
- `npm run check` / `npm run build` / `npm test` は成功（node:test 146件、失敗0件）。
- 本番デプロイID: `dpl_5RHAbeXFeZzZmadjZjDNxSPaLTzZ`。

### 既存ファイルのドラッグ＆ドロップ移動（2026-07-23）

- 一覧内のファイル行を表示中のフォルダ行へドラッグすると、ファイル名を変えずに移動する。
- ドラッグ中のファイル行を薄く表示し、移動先フォルダを公式ブルーの受け皿表示へ切り替えて
  「ここへ移動」を示す。ダブルクリック、キーボード操作、ダウンロード、削除は維持した。
- 内部移動は専用MIME type、Finder / エクスプローラーからのアップロードは`Files` typeで判定し、
  moveとcopyの処理を分離した。
- サーバー側は認証・同一オリジン・パス検証を通した`PATCH /api/files`からVercel Blobの`rename()`を
  呼ぶ。移動先の同名ファイルは409で拒否し、コピー失敗時は元ファイルを残す。
- `npm run check` / `npm run build` / `npm test` は成功（node:test 171件、失敗0件）。
- 本番デプロイID: `dpl_6zDCfVwhBAa8esgbSYk69NaMHHb9`。本番aliasは
  `https://vsx.team-armada.jp`。反映後1時間のerror logと5xxは0件。

### AgVenture Lab向け短時間説明資料の5セクション化（2026-07-23）

- 事業説明を「技術」「茶とトマトの実証テーマ」「ビジネスモデルと成長」「3年計画」の本文4節と、
  表紙・結びに圧縮した。
- ビジネスモデルは、農家へのデータ提供とサブスクリプション、研究機関・JA・産地組織へのデータ
  提供とデータ利用料の交換関係を、中央寄せのピクト図で表現した。
- `npm run build` / `npm run check` / `npm test` は成功（node:test 171件、失敗0件）。
- 本番デプロイID: `dpl_4gbbxa8y8nsCAyD6fRDmY3yPyiTZ`。
- 事業・資料判断の詳細は旧配置 `kagawa/2026-07-23_AgVentureLab_pitch_update.md` を参照する
  （事業資料の意思決定ログはKagawa側に残置）。

### AMD OS への正本移管（2026-07-23）

- 実装一式（`api/` / `server/` / `public/` / `test/` / `build.mjs` / `vercel.json` /
  `package*.json`）を `kagawa/agventure-lab-business-deck/deploy/` から
  `amd-os/services/project-share/vsx/` へコピーし、AMD OS を正本にした。
- `build.mjs` が参照していた個人ホームディレクトリ配下の絶対パス（事業資料HTML本体、
  AMD正規ロゴ2点、表紙イラスト、技術写真）を撤廃し、`content/` 配下のcontent snapshotを
  相対パスで読む自己完結構成にした。
- 公開URL・Vercelプロジェクト（`vsx-agventure-lab`）・Blob store（`vsx-project-share`）・
  環境変数は変更していない。
- 新配置から本番デプロイし、`https://vsx.team-armada.jp` のログイン画面200、未認証API 401、
  `/psi-step2` 200、Vercel Readyを確認した。本番デプロイID:
  `dpl_5PsPsd9oGh2NAiD1ajYds8Bqamb8`。
- 旧配置 `kagawa/agventure-lab-business-deck/deploy/` は、本番確認後にKagawa側から退避した。
  Kagawa側には事業資料本体と意思決定ログだけを残し、Project Shareの正本は本ディレクトリに一本化した。

### ビジネスモデル主体ピクトの画像アセット化（2026-07-23）

- スタートアップ、農家、研究機関・JA・産地組織を表す主体ピクトを画像生成し、透明PNG 3点として`content/assets/`へ配置した。
- 主体イラストを構成していたインラインSVGパスは全撤去し、`<img>`参照へ置換した。矢印、交換価値ラベル、枠、配置のみHTML/CSSで維持した。
- ブラウザ編集済み文言の保存キー`agventureLabDeck:v8:edit:`と、ビジネスモデル図の`s3-030`〜`s3-036`は変更していない。
- `npm run build` / `npm run check` / `npm test` は成功（node:test 173件、失敗0件）。1440×900で横方向overflow 0、画像3点の読込、図内インラインSVG 0件、コンソールエラー0件を確認した。モバイルは明示指示により未確認。
- 本番デプロイID: `dpl_4gmYBbNDRmpprR1qJ2jFsqQ3oJFe`。本番aliasは従来どおりVSX PROJECT SHARE。

### ファイルのドラッグ＆ドロップ移動が本番で動かない不具合を修正（2026-07-23）

- 第1弾の修正（`<tr>`の`draggable`を外し`.name-content`を明示的なドラッグ面`.drag-handle`にする）をデプロイしたが、実機の押下→移動→離すの一連操作でも`dragstart`すら発火せず、`PATCH /api/files`が一切飛ばない事象が本番で継続した。HTML5ネイティブドラッグ自体がタッチ/トラックパッド操作や実際のマウスジェスチャーと相性が悪く、`draggable`属性に依存する限り再現しない不具合を仕込み続けるリスクがあると判断し、内部移動のドラッグ実装をネイティブHTML5ドラッグ（`dragstart`/`dragover`/`drop`、`dataTransfer`、`INTERNAL_MOVE_MIME`）からPointer Events（`pointerdown`/`pointermove`/`pointerup`/`pointercancel`）へ全面的に置き換えた。
- 新しい仕組み: ファイル名セルの`.drag-handle`（`data-drag-handle="true"`、`draggable`属性は付けない）で`pointerdown`を受けると、`pointerId`・pathname・開始座標だけを`pointerDrag`状態に記録する（まだ見た目は変えない）。`pointermove`（`window`購読）で移動量が`DRAG_THRESHOLD_PX`（6px）を超えた時点で初めて`dragging-row`を付けてドラッグ開始とし、以降は`document.elementFromPoint(event.clientX, event.clientY)`で指またはカーソル直下の要素から`tr[data-row-type="folder"]`を解決してハイライト（`drop-target`）する。`pointerup`（`window`購読）でその時点のドロップ先フォルダに対して`moveFileTo`を一度だけ呼び、呼ぶ前に`endPointerDrag()`で状態を完全にクリアする。`pointercancel`とウィンドウの`blur`は`moveFileTo`を呼ばず`endPointerDrag()`のみで状態を片付ける。
- ドラッグ面のCSSは`user-select: none`（テキスト選択に負けない）に加え、`touch-action: none`を付与してタッチ操作時にページスクロールへ奪われないようにした。外部Finder/Explorerからのファイルドロップ（`document`購読・`isFileDrag`/`dataTransfer.types`ベース）は別実装のままで、Pointer Events化の影響を一切受けない。
- 行のダブルクリック/Enter/Space起動、アクション列のダウンロード・削除、フォルダの開く・削除は無改修で維持されることをテストで確認した。
- `test/portal.test.mjs`のドラッグ関連テストを、旧`dragstart`/`dragend`/`dataTransfer`前提の文字列一致から、`pointerdown`での状態記録・`pointermove`の閾値判定とelementFromPoint解決・`pointerup`でのmoveFileTo一発呼び出しと状態クリア順序・`pointercancel`/`blur`でのキャンセル・外部Filesドロップとの分離を検証する契約ベースのテストへ全面的に書き換えた。
- `npm run build` / `npm run check` / `npm test` は成功（node:test 177件、失敗0件）。
- 本番で実ファイルをルートから`PSI Step 2`へドラッグし、`PATCH /api/files`の200応答、移動先表示、再読み込み後の永続化を確認した。検証用ファイルは確認後に削除済み。本番デプロイID: `dpl_89eykBk7sVstEWGL6cKUARYogL1N`。
