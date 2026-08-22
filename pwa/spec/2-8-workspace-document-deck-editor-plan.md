# 2-8 資料室 スライドエディタ 実装計画

> **状態**: Phase 0 / 1 / 2 が本番稼働（2026-08-22 時点、build v3.90.0）。Phase 3 以降は計画。
> 本章は資料室スライドエディタの設計正本。フェーズが完了するたびに該当節を現行仕様の記述へ書き換え、
> ユーザー向けの使い方は `pwa/manual/` の資料室章へ落とす。
> Phase 2 まではUIを持たない配管とレンダラなので、利用者から見える変化はまだ無い（導線はPhase 3）。

---

## 1. 何を解決するか

資料室にアップロードしたHTML資料は、いま `HTML編集` ボタンから**生ソースのtextarea**でしか直せない
（[`WorkspaceDocumentRoom.tsx`](../src/components/workspace-documents/WorkspaceDocumentRoom.tsx) の `dialog === "edit_html"`）。
まさが実務で編集できる状態ではない。パワポと同じ操作感で直せるUIを作る。

同時に、いまの保存は**無条件上書き**で、過去版も競合検知も無い
（[`source/route.ts`](../src/app/api/workspace-documents/[documentId]/source/route.ts) の `upsert: true`）。
これは [`1-4-os-convergence-current-spec.md`](1-4-os-convergence-current-spec.md) が既に欠落として記録している
「過去版・承認版・差し替え理由・復元可能性を正本として保持できない」そのもの。
直接操作エディタはソース編集より壊しやすいので、**版履歴は先に入れる**。

---

## 2. 確定した方針

### 2.1 正本の反転

```
現在:  HTML（ソース）が正本  →  PDFは生成物
今後:  モデル（JSON）が正本  →  HTML / PDF / 将来PPTX は全部生成物
```

きっかけはまさの指摘。「最初からそのUIで開く前提でえいみが作ればいい」。
モデルが正本なら、**任意のHTMLをモデルへ逆解析する工程が発生しない**。
逆解析こそがコストの本体だったので、モデル方式の代償は消える。

### 2.2 コンポーネント＋スロット方式（x,y,w,h方式は採らない）

パワポ互換の「全部が絶対座標の箱」にすると、HTMLの表現力（可変グリッド、
CSS Grid、レスポンシブ、任意のマークアップ）を自分で捨てることになる。
まさの狙い（HTMLはパワポを圧倒できる）と正面から矛盾する。

なので**意味のあるブロックの配列**をモデルにし、見た目はレンダラが決める。
自由度は2つの逃げ道で確保する。

| 逃げ道 | 用途 |
|---|---|
| `freeCanvas` ブロック | パワポ的に絶対座標でドラッグ配置したいとき |
| `rawHtml` ブロック | 既存の凝ったマークアップをそのまま持ち込みたいとき |

### 2.3 案Bは捨て仕事にならない

直接操作エディタ（案B）は、そのまま **`rawHtml` ブロックの中身エディタ**になり、
かつ**モデル化していない既存資料のエディタ**として恒久的に残る。
「案Bを作ってから案A」は乗り換えではなく一本道。

### 2.4 スライド寸法は併用、既定は固定16:9

固定16:9と可変フローを**スライド単位で切替**できるようにし、既定は固定16:9。
投影で崩れる事故のほうが、縦に伸びて読みにくい事故より高くつく。
寸法モデルは後から変えるのが一番難しい決定なので、ここだけ先に固定する。

### 2.5 既存資料は自動変換しない

既存デッキ（例: `SX_2026_SEASON_OVERVIEW_20260727.html`）は完全に手書きのクラス体系で、
機械変換すれば必ず劣化する。**自動変換はしない**。案Bエディタで直し続け、
まさが指定したものだけモデルで作り直す。

---

## 3. データモデル

### 3.1 新規テーブル

`pwa/scripts/migrations/310_workspace_document_decks.sql` で **2026-08-21 適用済み**。
3表とも `workspace_documents` の `document_id` で ON DELETE CASCADE する。

| 表 | 役割 | 押さえどころ |
|---|---|---|
| `workspace_document_decks` | 1資料1モデルの正本 | `model_sha256` が編集の楽観ロック鍵。`published_sha256` は **最後に公開したモデルのsha256** で、`model_sha256` と違えば未公開の変更がある（migrationの部分index `WHERE published_sha256 IS DISTINCT FROM model_sha256` がこの意味で張ってある） |
| `workspace_document_revisions` | 版履歴（追記のみ） | `kind='deck_model'` はモデルをDB行に、`kind='html_source'` は本文をStorageへ退避する。CHECK制約でどちらか一方だけを持つ |
| `workspace_document_assets` | デッキが参照する画像 | `(storage_bucket, storage_path)` がunique。同じpathが別の画像で埋まらない |

**列名は [`pwa/design/db_schema.md`](../design/db_schema.md) を見る。**
本節の初版に書いたDDLは実体とズレていた（`assets.storage_bucket` / `assets.content_sha256` /
`decks.published_at` / `decks.created_at` / `revisions.storage_bucket` が抜けていた）ので、
実体を持つmigrationとdb_schema.mdを正本にし、DDLの転記はここへ残さない。

保持: 各資料の直近50版 + `pinned=true` は無期限。超過分は古い順に削除し、
`html_source` はStorageの実体も消す。

### 3.2 デッキモデル schema v1

[`workspace-deck-model.ts`](../src/lib/workspace-deck-model.ts)（手書きvalidator。このリポにzodは無い）。
schemaと検証と正規化を1つの関数 `normalizeWorkspaceDeck()` に閉じ、
**戻り値の `deck` だけを保存・描画に使う**。「検査は通ったが保存された形は別」を作らないため。

```ts
type Deck = {
  schemaVersion: 1;
  meta:   { title: string; docType: "deck" | "doc"; updatedAt: string };
  theme:  { preset: "amd"; tokens: Partial<DeckTokens>; logo: "amd_horizontal" | "amd_mark" | "none" };
  defaults: { slideMode: "fixed16x9" | "flow"; contentWidthPx: number };
  slides: Slide[];
};

type Slide = {
  id: string;
  mode: "fixed16x9" | "flow";
  layout: "cover" | "section" | "standard" | "full";
  sectionTitle?: string;     // 全ページ共通の「章タイトル」。AMD_SLIDE_DESIGN_CODE の必須要素
  notes?: string;            // 発表者メモ。本文と分ける（対外資料ルール）。publish出力には出さない
  blocks: Block[];
};

// 正規化後は variant が必ず入る（レンダラ側で既定値を持たない）
type Block = { id: string; style?: BlockStyle } & (
  | { type: "heading";  slots: { eyebrow?: string; title: string; lead?: string } }
  | { type: "bullets";  variant: "plain" | "check" | "number";     slots: { items: RichText[] } }
  | { type: "table";    variant: "plain" | "compare";              slots: { head: RichText[]; rows: RichText[][] } }
  | { type: "twoCol";   variant: "even" | "wideLeft" | "wideRight"; slots: { left: Block[]; right: Block[] } }
  | { type: "callout";  variant: "info" | "warn" | "accent";       slots: { title?: string; body: RichText } }
  | { type: "image";    variant: "inline" | "bleed";               slots: { assetId: string; caption?: string } }
  | { type: "kpiRow";   slots: { items: { label: string; value: string; unit?: string; note?: string }[] } }
  | { type: "rawHtml";  slots: { html: string } }
);

// 段落構造はブロック側が持つ。素の文字列がそのまま本文テキスト
type RichNode = string
  | { t: "strong" | "em" | "code"; c: RichNode[] }
  | { t: "a"; href: string; c: RichNode[] }
  | { t: "br" };
type RichText = RichNode[];

type BlockStyle = {           // 生CSSは受け取らない。閉じた列挙だけ
  align?: "left" | "center" | "right";
  space?: "none" | "sm" | "md" | "lg";
  tone?:  "default" | "muted" | "accent";
};
type DeckTokens = Record<"accent" | "ink" | "muted" | "surface" | "line" | "canvas", string>;  // #rrggbb のみ
```

- **語彙は13種、実装は8種**。`timeline` / `funnel` / `quote` / `spacer` / `freeCanvas` は
  `WORKSPACE_DECK_BLOCK_SPECS` に `implemented: false` で載せてあり、保存の時点で断る。
  語彙から消さないのは、保存だけ通ってpublishで黙って消える事故を防ぐため。
- `freeCanvas` は `fixedOnly: true`。フローのスライドへ置くと、未実装よりも先に
  「固定16:9のスライドでだけ置けるよ」で断る（寸法モードの規則を先に伝える）。
- `RichText` は**インライン限定**（`strong` / `em` / `code` / `a` / `br`）。
  リンクは `http` / `https` / `mailto` だけ。`{ t: "text", v }` は素の文字列へ畳んで正規形を1つに保つ。
- `rawHtml` は**保存時と描画時の両方**でサニタイズする（`script` / `iframe` / 入力欄 / `on*` /
  `javascript:` / data URI以外の読み込み属性 / `@import` を除去）。保存時にも通すのは、
  エディタのプレビューと publish出力を同じ本文にするため。**サニタイズは冪等**でなければならない。
- 表の行は列数が見出しと違えば拒否する。足し引きで揃えると、抜けた数字に気づけない。
- モデルJSONは 2MB 上限（`WORKSPACE_DOCUMENT_DECK_MODEL_MAX_BYTES`）。画像はアセット参照で、
  モデルにbase64を埋めない。

**sha256は必ず `serializeWorkspaceDeck(normalizeWorkspaceDeck(...).deck)` に対して取る。**
Postgresのjsonbはキー順を保存しないので、DBから読み直したJSONをそのまま直列化すると
同じ内容でも別のsha256になり、楽観ロックが誤検知する。正規化は毎回同じ順でオブジェクトを
組み直すので、経路がどこであれ「同じ内容 → 同じsha256」が成り立つ。
`meta.updatedAt` もモデルの一部なので、serverで毎回 `now()` を入れない
（入れると中身の変わらない保存を見分けられなくなる）。

### 3.3 定数の追加先

[`workspace-documents-core.ts`](../src/lib/workspace-documents-core.ts) に追記した4件。
`WORKSPACE_DOCUMENT_REVISION_KEEP_COUNT` は Phase 0 で既にある。

```ts
export const WORKSPACE_DOCUMENT_DECK_SCHEMA_VERSION = 1;
export const WORKSPACE_DOCUMENT_DECK_MODEL_MAX_BYTES = 2 * 1024 * 1024;
export const WORKSPACE_DOCUMENT_ASSET_MAX_BYTES = 10 * 1024 * 1024;
export const WORKSPACE_DOCUMENT_ASSET_MAX_EDGE_PX = 1920;
```

保存先pathも同じファイルへ置く（`workspaceDocumentAssetStoragePathFromBase()`）。
`<資料のstorage_path>.asset.<asset_id>.<ext>` で、過去版の `.rev<N>.html` と同じく
現物の隣に並ぶ。

---

## 4. レンダラは1本だけ

[`workspace-deck-render.ts`](../src/lib/workspace-deck-render.ts) に **Reactコンポーネントとして
1回だけ**書き、3箇所で使い回す。

| 用途 | 呼び方 |
|---|---|
| エディタのキャンバス | `WorkspaceDeckView` をクライアントで直接マウント |
| publish（HTML書き出し） | `renderWorkspaceDeckDocument()`（内部で `renderToStaticMarkup()`） |
| PDF | publish済みHTMLを既存の [`workspace-document-html-pdf.ts`](../src/lib/workspace-document-html-pdf.ts) へ通す |

**拡張子が `.tsx` ではなく `.ts` で、JSXを書かずに `createElement` で組んでいる。**
契約テストが素のNode（`node --experimental-strip-types`）からこのファイルを読み、実際に描かせて
「scriptが混ざらない」「外部参照がゼロ」を検査するため。Nodeの型除去は `.tsx` を読めないので、
JSXで書くと publish出力の安全性を文字列assertでしか確かめられなくなる（§9の「振る舞いを検査したい
規則は純粋関数へ切り出す」と同じ判断）。文字のエスケープはReactに任せ、手書きのHTML連結でスロットを埋めない。

`react-dom/server` は **動的import**にする。静的importするとApp Routerのビルドが
「react-dom/server を読むコンポーネントを import している」と言って止まる。
そのため `renderWorkspaceDeckDocument()` は `async`。

CSSは [`workspace-deck-css.ts`](../src/lib/workspace-deck-css.ts) が `WORKSPACE_DECK_CSS` の**文字列1本**で持つ。
エディタはこれをiframeへ注入し、publishは `<style>` へ直接埋める。
Tailwindのユーティリティをデッキ内で使わない（publish先にTailwindが無いため、必ずズレる）。

**寸法は `--deck-u` 1本**。固定16:9のスライドは自分をコンテナにして `--deck-u: 1cqw`、
フローは `--deck-u: 12.8px`（1280px幅の固定スライドと同じ実寸）。
表示routeのCSPがscriptを一切許さないので、拡大縮小をJSでやる道は無い。コンテナ単位なら
画面幅が変わっても中身ごと拡大縮小して16:9を保てる。コンテナ単位はコンテナ自身の指定には
効かないので、余白は内側の `.deck-slide__inner` で取る。

**章タイトルをページ内で最大に保つ**（`AMD_SLIDE_DESIGN_CODE.md` 基本ルール6）。
`.deck-slide__section-title` のfont-sizeが、アイキャッチ（`.deck-heading__title`）を含む
どのブロックよりも大きいことを契約テストで機械検査する。

ロゴはCSS規則1つの中でだけbase64を持つ（[`workspace-deck-logo.ts`](../src/lib/workspace-deck-logo.ts)）。
スライドごとに `<img>` で貼ると同じbase64が枚数分だけ複製され、5MB上限を無駄に食う。
`public/` はCDN配信でVercel Functionのファイルシステムに在る保証が無いため、正本画像を
埋め込み用に縮小した定数として持つ（コードでロゴを描き起こしてはいない）。

publish出力は**自己完結HTML**: 画像はdata URI、フォントはシステムフォントスタック、外部参照ゼロ。
これで既存の [`render/route.ts`](../src/app/api/workspace-documents/[documentId]/render/route.ts) の
`default-src 'none'; img-src data:` CSPをそのまま通る。

**サイズ制約**: publish後のHTMLは `WORKSPACE_DOCUMENT_HTML_PREVIEW_MAX_BYTES`（5MB）以内でないと
プレビューが拒否される。base64は約1.33倍になるので画像の実バイト合計は約3.5MBが上限。
**縮小はブラウザ側でやる**。このリポに画像処理ライブラリ（sharp等）は無く、Vercelのnode functionへ
ネイティブ依存を足すのは割に合わない。アセットAPIは長辺1920pxを超える画像を**断る**側に倒し、
縮小はエディタ（canvas）の責任にする。黙って原寸を通すと publish後のHTMLが5MBを超え、
資料ごとプレビューできなくなる。エディタは推定publishサイズを常時表示して4MBを超えたら警告する（Phase 3）。

---

## 5. 編集フレームのセキュリティ境界

既存の `render` ルートのCSPは `script-src` を一切許さない。**これは緩めない**。
編集用に別ルートを作る。

`pwa/src/app/api/workspace-documents/[documentId]/edit-frame/route.ts`

```
Content-Security-Policy:
  default-src 'none'; base-uri 'none'; form-action 'none';
  frame-ancestors 'self'; img-src data: blob:; style-src 'unsafe-inline';
  font-src data:; script-src 'nonce-<per-request>'; sandbox allow-scripts
```

- `sandbox allow-scripts` に **`allow-same-origin` を付けない** → フレームは不透明オリジン。
  資料HTMLがまさのセッションのcookie / localStorage / DOMへ到達できない。
- 親との通信は `postMessage` のみ。`event.origin === "null"` になるので、
  代わりに**リクエストごとに発行したnonceトークン**をメッセージに含めて照合する。
- 資料HTMLの `<script>` は、フレームへ流す前に `<!--amd:script:N-->` プレースホルダへ退避する。
  編集に元のJSは不要で、走らせる理由が無い。
  保存時にシリアライズしたDOMへ元の `<script>` を同じ位置で戻すので、資料側のJSは失われない。
  この退避・復元は `pwa/src/lib/workspace-document-html-editing.ts` に置き、契約テストで往復一致を検査する。

モデル資料のエディタは自前生成の信頼できるHTMLなので、
**同一オリジンiframe**（Tailwind隔離が目的）で描く。sandboxは不要。

---

## 6. API

| ルート | メソッド | 役割 |
|---|---|---|
| `.../[documentId]/source` | PUT | **改修**: `expected_sha256` 必須。不一致なら409。保存前に旧版を revision へ退避 |
| `.../[documentId]/revisions` | GET | 版一覧（no / kind / sha / bytes / note / pinned / 作成者 / 日時） |
| `.../[documentId]/revisions/[no]` | GET / POST | 取得 / 復元（復元も新しい版として積む＝履歴を破壊しない） |
| `.../[documentId]/deck` | GET / PUT | モデルの取得・保存（`expectedSha256` は **モデル** のsha256。初回だけ省略可） |
| `.../[documentId]/deck/publish` | POST | モデル→HTML生成→現物を差し替え→`published_sha256` 更新 |
| `.../[documentId]/assets` | GET / POST | 画像一覧・追加（POSTはbodyをそのままバイト列で受ける） |
| `.../[documentId]/edit-frame` | GET | 編集用フレーム（nonce script、sandbox） |

すべて既存の `resolveDocumentRowAccess` / `access.canUpload` / `isSameOriginWorkspaceMutation` を通す。
デッキ3本の認可は本文編集と同じ `loadEditableWorkspaceHtmlDocument()` 1本で、routeへ条件を書き写さない。
モデルの読み書きとpublishの手順は [`workspace-document-decks.ts`](../src/lib/workspace-document-decks.ts) に集約する。

監査は既存 `recordWorkspaceAuditEvent` の `workspace_document_mutated` を使い、
`detail.action` に `edit_deck` / `add_deck_asset` を足す。**publishは `action: "replace_html"` のまま**で、
`detail.deck_action = "publish_deck"` を添える（「HTMLを差し替えた」事実は同じで、
audit action名を増やすと `check_workspace_documents_contract.mjs` が要求するリテラルの意味が薄まる）。

**publishの楽観ロックはモデル側にだけ張る。** HTMLは生成物なので、HTML側を直接直した内容は
モデルに存在せず、再生成で消えるのが正しい。消える分は `replaceWorkspaceHtmlSource()` が
版として退避するので取り戻せる。逆に、いま画面で見ているモデルと違うものを公開しないよう、
publishは `expectedSha256`（モデルのsha256）を必須にして、食い違えば409で止める。

`GET /assets` は編集中の表示のために**60秒の署名URL**を付ける。publish出力では署名URLを使わない
（期限切れで資料の画像が消え、外部参照ゼロも崩れる）。この2つを混ぜない。

---

## 7. 画面

### 7.1 モデル資料のエディタ（3ペイン）

```
┌────────┬───────────────────────────┬──────────────┐
│ スライド │        キャンバス          │  プロパティ   │
│ 一覧    │  （実寸16:9、直接編集）      │              │
│ 縦並び  │                           │ 選択ブロックの │
│ 並替/   │  クリック→ブロック選択      │ バリアント／   │
│ 複製/   │  ダブルクリック→文字編集     │ 余白／寄せ／   │
│ 削除    │  ＋ボタン→ブロック挿入       │ 色／スロット   │
└────────┴───────────────────────────┴──────────────┘
          下部: 発表者メモ欄（本文と分離）
```

### 7.2 生HTML資料のエディタ（案B）

同じ3ペイン。ただしキャンバスは `edit-frame` のiframe、
スライド一覧は**区切り検出**の結果。

区切り検出は自動で決め打ちしない。`section` / `article` / `.slide` / `.section` などの
反復パターン候補を並べ、「スライドの区切りはこれで合ってる？」と選ばせる。
選択結果は `workspace_documents` の付随メタとして覚える。

### 7.3 資料室からの導線

`HTML編集` ボタンを**モデル資料なら3ペインエディタ、生HTML資料なら案Bエディタ**へ分岐させる。
textareaのソース編集は「詳細」の中に残す（緊急脱出用）。

---

## 8. フェーズ

各フェーズは独立してdeployでき、単体で価値が出る順に並べている。

### Phase 0 — 版履歴と競合検知（土台）

- migration `310_workspace_document_decks.sql`
- `source` PUT に `expected_sha256` 楽観ロック＋旧版退避
- 版一覧・プレビュー・復元UI（既存の資料室ダイアログに追加）
- 契約テスト `test:workspace-document-revisions`

これだけで**いまのソース編集が安全になる**。`1-4` の既知欠落が1つ埋まる。

**2026-08-21 実装済み（build v3.86.0 / commit `70d41bf2`）。** 計画からの変更点:

- 版の本文はDB行に持たず private Storage の `<basePath>.rev<N>.html` へ退避する。
- 退避は **DB insert を先に済ませてから Storage へ upload** する。逆順だと `revision_no`
  競合時に、別版の内容で同じobjectを潰す。`23505` は番号を進めて再試行し、upload失敗時は
  挿入済み行を削除して本文の無い版行を残さない。
- 認可は `loadEditableWorkspaceHtmlDocument()`、書き込みは `replaceWorkspaceHtmlSource()` の
  各1箇所へ集約した。以後の新しい編集経路もこの2つを通す（後述のPhase 1もそうしている）。
- `row.content_sha256` は未編集資料でNULL・移行資料で古いので、shaは毎回**現物のdownloadから**取る。

### Phase 1 — 直接操作エディタ（案B）

- `edit-frame` ルート＋nonce script＋script退避／復元
- フレーム内エージェント: 要素選択、インライン編集（`contenteditable`）、
  書式パネル（太字／色／サイズ／寄せ）、DOMシリアライズ
- スライド区切り検出＋手動確認、並べ替え／複製／削除
- 保存はPhase 0の経路

**この時点で既存の全デッキがパワポ的に編集できる。** まさの当面の要望はここで満たす。

**2026-08-21 実装済み（build v3.88.0）。** 計画からの変更点と、そう決めた理由:

| 決めたこと | 理由 |
|---|---|
| デッキ保存は別ルートを作らず `PUT /source` に `mode:"deck"` を足す | 別ルートにすると認可と楽観ロックの配管が二重化するだけで、守る不変条件は同じ |
| `replaceWorkspaceHtmlSource()` に `transformNextSource?: (currentSource) => string` フックを足し、sha照合を通った直後・`nextSha256` 算出の前に走らせる | ①現物のdownloadが1回で済む ②**shaが一致した現物からしかscript退避を作らない**ので、`edit-frame` が配ったtokenと必ず同じ値になる。transform後にサイズを再検査して413 |
| script退避／復元と本文差し替えを `workspace-document-html-editing.ts` の**純粋関数**（`workspaceDocumentDeckSaveSource(currentSource, framedHtml)` ほか）へ切り出す | ルート直書きだと `server-only` の壁で文字列assertしか書けない。純粋関数なら振る舞いテストが書ける |
| `auditAction` は `replace_html` のまま固定し、デッキ編集の区別は `auditDetail: { editor: "deck" \| "source" }` へ逃がす | `check_workspace_documents_contract.mjs` がこのリテラルを要求している。audit名を増やすと契約側の意味が薄まる |
| **見たまま編集には「このまま上書き保存」を出さない**（競合時は「最新を読み込み直す」のみ） | 退避番号は現物のscript並びに紐づく。別セッションがscriptを足す／消すと、①scriptが失われて目印コメントが本文に残る ②別のscriptが黙って別位置に入る、が起きる。**保存後のHTMLを見ても壊れたと分からない**種類の破損なので、選ばせない。ソース編集側は従来どおり強制上書きを残す |
| スライド区切りセレクタは `localStorage` の `amd-deck-slide-selector:<documentId>` に覚える | 計画は「`workspace_documents` の付随メタとして覚える」だったが、Phase 1でDB列を足すとPhase 2/3のモデル置き場（`workspace_document_decks`）と意味が混ざる。端末ごとの記憶に留める代わり、スキーマを汚さない |
| 未保存のまま閉じる操作は `onDirtyChange` で親へ伝え、`window.confirm` で止める | Base UI の `Dialog.Root` に外側クリック閉じを封じる prop が無い（`modal` はあるが `dismissible` は無い）。controlled な `open` を変えないことで閉じるのを止める |
| 一覧行のボタンは**「編集」1つ**にして見たまま編集を開く。ソース編集へは見たまま編集フッタの「HTMLソースで編集」、逆はソース編集フッタの「見たまま編集へ戻る」 | 行にはすでにPDF化／整理／削除があり、1440幅でこれ以上増やせない。**導線自体は双方向に残す** |
| **編集は資料室のモーダルではなく別タブの専用ページ `/workspace-document/{documentId}/edit` で開く**（2026-08-21 改訂）。資料室の「編集」は `<a target="_blank">`、戻り先は `?from=<今いるpathname>` | 初版はモーダルに載せたが、資料室は左メニューとコックピットの内側にあるため実効幅が画面の約1/3しか無く、3ペイン（スライド一覧／プレビュー／書式）が入らない。まさ「モーダルちっさ。編集はブラウザの別タブ開く方がいい」。別タブなら Phase 3 のデッキエディタもそのまま同じページへ載る |
| 編集ページは**見たまま編集を常時下敷き**にし、ソース編集（`max-w-4xl`）と版履歴（`max-w-3xl`）だけを重ねる。資料室側からは3つのダイアログとその state を**削除**する | 両方に置くと同じ楽観ロックが二重実装になり、片方だけ直して競合検知が抜ける。契約テストで `source.room` に `expectedSha256` 系が残らないことを機械検査する |
| 保存後の元タブ同期は **BroadcastChannel**（`amd-os-workspace-documents`）で `{type:"document-updated", documentId}` だけを配り、受け側が自分で `refreshDocuments()` する | 本文は最大5MBあり、チャネルへ載せると同一オリジンの全タブへ毎回コピーが飛ぶ。「更新されたよ」だけ配れば、受け側は既存の権限チェックを通った一覧APIで取り直せる |
| 編集ページの認可は `loadEditableWorkspaceHtmlDocument()` で**表示前**に確かめ、`recordWorkspaceAuditEvent` に `open_editor` を残す。`?from=` は `/` 始まりかつ `//`・`/\` 非始まりだけ通す | URLを直接叩けるページになったので、資料室UIの表示条件（`permissions?.canUpload`）はもう防御にならない。戻り先クエリは無検証だと外部サイトへのオープンリダイレクトになる |
| **フレームとの合言葉はレンダー中に作らない**。`useState<string \| null>(null)` +マウント後の `useEffect` で一度だけ決め、決まるまで `<iframe>` 自体を描かない（2026-08-22 修正） | `useState` の initializer はSSRで1回、hydrationでもう1回走る。乱数を引くと `iframe` の `src` 属性（=SSR値）と親が照合する state（=hydration値）が食い違い、フレームが正しく送った `ready` を親が**無言で捨て続ける**。オーバーレイが剥がれず「資料を読み込み中」から一生進まない。詳細は `pwa/BUGS.md` |
| **見たまま編集の保存は元HTMLとバイト一致しない**ことを仕様として認め、バイト保存が要る利用者はソース編集へ寄せる（2026-08-22 明文化） | 保存は編集中DOMの clone を `documentElement.outerHTML` で書き出す再シリアライズなので、void要素の自己終了スラッシュがブラウザの正規形へ揃う（`<br />`→`<br>`、`<img … />`→`<img …>`、`<meta … />`→`<meta …>`）ほか末尾に空行が入る。実測（293101B の実資料）で**差分はこの正規化と末尾空行だけ、本文テキストは完全一致**を確認済み。HTML5 では void 要素の `/` は無意味なのでパース結果・表示・PDF化は同一。モデル正本（Phase 2）へ移れば「元HTMLのバイト保存」自体が前提から外れるので、追いかけて直さない |
| 入力イベントは `dirty` だけでなく**選択情報も送り直す**（`markTyping`、150ms のトレーリング）（2026-08-22 修正） | `input` で `dirty` しか送っていなかったため、文字を書き換えても右パネル上部の要素プレビュー文言と文字サイズが打つ前のまま固まっていた。打鍵ごとに送ると変換中の1文字ごとに往復が増えるので、手が止まってから1回だけ送る |
| フレームの準備完了を **20秒**（`FRAME_READY_TIMEOUT_MS`）で見切り、理由・「読み込み直す」・ソース編集への逃げ道を出す（2026-08-22 追加） | 沈黙のローディングは「壊れている」と「重い」を利用者が区別できない。まさを10分待たせた |
| フレーム内エージェントは文字列テンプレートではなく **TS関数 + `Function.prototype.toString()`** で埋め込み、設定は `JSON.stringify(config)` を引数で渡す | 型検査が効く。ただしtranspileヘルパーが注入されると埋め込み先で黙って死ぬので、エージェント内で spread / async-await / for...of / optional chaining を使わない（契約テストで機械検査する） |
| 版履歴から「編集に戻る」とき、見たまま編集から来た場合はフレームを作り直す | 版を戻した直後は本文が入れ替わっている。開いたままのフレームを再利用すると古いDOMを保存してしまう |

### Phase 2 — モデルとレンダラ

- `workspace-deck-model.ts`（schema + validator + normalizer）
- `workspace-deck-render.ts` / `workspace-deck-css.ts` / `workspace-deck-logo.ts` / `workspace-deck-assets.ts`
- `deck` / `deck/publish` / `assets` API と、3本が共有する `workspace-document-decks.ts`
- ブロック第1弾: `heading` / `bullets` / `table` / `twoCol` / `callout` / `image` / `kpiRow` / `rawHtml`
- publish → 既存の render / pdf / project-share がそのまま動くことを確認

**2026-08-22 実装済み（build v3.90.0）。** UIはまだ無く、ここまでは配管とレンダラだけ。
計画からの変更点と、そう決めた理由:

| 決めたこと | 理由 |
|---|---|
| レンダラは `.tsx` ではなく **`.ts` にしてJSXを書かない**（`createElement` で組む） | 契約テストが素のNodeからレンダラを読んで実際に描かせ、「scriptが混ざらない」「外部参照ゼロ」を検査する。Nodeの型除去は `.tsx` を読めないので、JSXにすると publish出力の安全性を文字列assertでしか確かめられない。ここは資料を配る経路そのものなので、検査できる形を優先した |
| `react-dom/server` は**動的import**にし、`renderWorkspaceDeckDocument()` を `async` にした | 静的importするとApp Routerのビルドが「react-dom/server を読むコンポーネントを import している」で止まる。描く木は `WorkspaceDeckView` 1本のままで、Phase 3のエディタはこの木を直接マウントする（文字列を毎回 innerHTML で差し替えるとcaretが飛ぶ） |
| 寸法は **`--deck-u` 1本**にして、固定16:9はコンテナ単位（`1cqw`）、フローは `12.8px` へ切り替える | 表示routeのCSPがscriptを許さないので、拡大縮小をJSでやる道が無い。コンテナ単位なら画面幅が変わっても中身ごと拡大縮小して16:9を保てる。2系統のCSSを書かずに済む |
| **画像の縮小はサーバでやらず、長辺1920px超を断る** | このリポにsharpは無く、Vercelのnode functionへネイティブ依存を足すのは割に合わない。黙って原寸を通すと publish後のHTMLが5MBを超えて資料ごとプレビューできなくなるので、断る側に倒した。縮小はPhase 3のエディタ（canvas）の責任 |
| 画像のMIMEは**ヘッダを信じず、バイト列を読んで決める**（`workspace-deck-assets.ts`） | publishでdata URIとしてHTMLへ焼き込むので、「画像だと言われた別の何か」を資料へ入れない。ついでに寸法も取れて上限判定に使える。SVGは受け付けない（サニタイズが要るのに、図はブロックで組めるので得るものが無い） |
| ロゴは**縮小した正本画像のbase64定数**を持ち、CSS規則1つの中で使う | publish出力は外部参照ゼロでなければ表示routeのCSPを通らない。`public/` はCDN配信でFunctionのファイルシステムに在る保証が無く、自分のoriginへHTTPで取りに行くのは落ちる可能性を足すだけ。スライドごとに `<img>` で貼ると同じbase64が枚数分だけ複製される |
| `rawHtml` は**保存時と描画時の両方**でサニタイズし、冪等性を契約テストで固定した | 保存時に通すのはエディタのプレビューと publish出力を同じ本文にするため。冪等でないとモデルのsha256が保存のたびに動き、楽観ロックが誤検知する |
| 語彙は13種のまま持ち、未実装の5種は**保存の時点で断る** | 語彙から消すと「保存はできたのにpublishで消えた」が起きる。未知のtypeと未対応のtypeで別のメッセージを返せるようにもなる |
| デッキの版は `kind='deck_model'` として同じ `workspace_document_revisions` へ積む。既存の版履歴routeは、デッキの版のGETでモデルJSONを返し、**HTML復元経路では戻さない**（400で案内） | 履歴を2箇所に分けない。一方でHTMLの復元とモデルの復元は別物で、同じPOSTに乗せると「HTMLへ戻したつもりがモデルは古いまま」になる。モデルの復元はGETで取って `PUT /deck` として積み直す（履歴は壊れない） |
| publishは現物のsha256をその場で読んで渡し、**HTML側の楽観ロックは張らない** | HTMLは生成物。モデルに無い手編集は再生成で消えるのが正しく、消える分は版へ退避される。二重ダウンロードになるが、`replaceWorkspaceHtmlSource()` の契約を緩めるより安い |

### Phase 3 — デッキエディタ（案A本体）

- 3ペインUI、ブロック挿入ライブラリ、スロット編集、バリアント切替、DnD並べ替え
- 発表者メモ欄
- `rawHtml` ブロックの中身編集はPhase 1のエージェントを再利用
- 固定16:9／フロー切替、はみ出し警告

### Phase 4 — 自由配置と作成側

- `freeCanvas`（ドラッグ／リサイズ／スナップ／整列ガイド）
- 残りブロック: `timeline` / `funnel` / `quote` / `spacer`
- **えいみの出力をモデルへ**: [`AMD_SLIDE_DESIGN_CODE.md`](../../../AMD_SLIDE_DESIGN_CODE.md) を改訂し、
  新規資料はHTML直書きではなくデッキJSONで作る
- デザインコードの機械検査（章タイトル > アイキャッチ、ロゴは正規画像、外部参照ゼロ）

### Phase 5 — 書き出し

- PPTX書き出し（モデル → `pptxgenjs`）。`rawHtml` は既存のpuppeteer経路で画像化して1枚の図として貼る
- PDFをモデル専用の印刷CSSへ（現在の「元資料の`@page`を打ち消す」補正が不要になる）

---

## 9. 契約テスト

`pwa/scripts/` に追加し、`package.json` の `test:` 系へ登録する。

| script | 検査内容 |
|---|---|
| `check_workspace_deck_model.mts` ✅ | schema v1 のvalidator：必須スロット、未知type拒否、未対応typeの拒否、`freeCanvas`はfixedのみ、RichTextのインライン限定、`rawHtml`サニタイズの**冪等**、モデル上限バイト、id採番と重複、**jsonbのキー順が変わっても直列化が変わらないこと**（sha256の安定）、画像のバイト判定と長辺上限 |
| `check_workspace_deck_render.mts` ✅ | 代表モデル → publish HTML を実際に描かせる。`script`混入ゼロ、外部参照ゼロ（読み込み属性と `url()` を全走査）、5MB以内、発表者メモが漏れないこと、描画時のサニタイズ、**章タイトル > 他の全ブロック**のfont-size、classがすべて `deck` 接頭辞（Tailwind不使用の機械検査）、同じモデルから同じバイトが出ること |
| `check_workspace_document_html_editing.mts` ✅ | script退避→復元の往復一致、本文差し替えの純粋関数、**退避番号ずれの検出**（4-a: scriptが消えて目印コメントが本文に残る／4-b: 先頭追加で番号がずれ別scriptが別位置へ） |
| `check_workspace_document_edit_frame.mts` ✅ | `allow-same-origin` を付けないこと（ヘッダ値だけを切り出して検査。JSDocの日本語説明に語が入るので本文全体をgrepしない）、nonce付き `script-src`、token照合、埋め込みagentがtranspileヘルパーを要する構文を使わないこと |
| `check_workspace_document_revisions.mts` ✅ | insert先行のrevision採番、追記のみ、退避失敗時に上書きしないこと、sha算出の統一、保持50件＋pinnedの除外 |

既存の `check_workspace_documents_core.mts` / `check_workspace_documents_contract.mjs` は
新定数・新ルートを含むよう更新済み。

**実装上の制約**: `server-only` を import する lib は素のNodeから読めない（依存が入っていない）。
そのため lib 側の検査は source 文字列 assert になる。**振る舞いを検査したい規則は純粋関数へ
切り出す**（Phase 1 の `workspace-document-html-editing.ts` がその形）。
文字列 assert を書くときは検査範囲を狭く取る。過去に `.storage.from(` の否定assertが同じ
ファイルのGETハンドラの正当なdownloadに誤反応した。

---

## 10. まだ決めていないこと

| 論点 | 現時点の扱い |
|---|---|
| モデル資料と生HTML資料の見分け方 | `workspace_document_decks` に行があればモデル資料、で足りる想定。列追加はしない |
| 複数人同時編集 | 対象外。409で弾いて「別のセッションが更新しています」を出すところまで |
| テンプレート（表紙／章扉のひな形） | Phase 3以降。まず素のブロックで運用してから型を抽出する |
| 生HTML資料のモデル化支援 | 自動変換はしない。まさが指定したものを手で作り直す方針は変えない |

---

## 附則

- 2026-08-21: 初版。まさ承認（正本反転／コンポーネント＋スロット／併用・既定16:9／自動変換なし）。
- 2026-08-21: Phase 0 実装（build v3.86.0 / commit `70d41bf2`）。migration 310 適用済み。§8 Phase 0 に実装差分を追記。
- 2026-08-21: Phase 1 実装（build v3.88.0）。§8 Phase 1 に決定表、§9 に契約テストの実体を追記。
- 2026-08-21: 編集UIを資料室モーダルから**別タブの専用ページ**へ移設（build v3.89.0）。まさの実使用で「モーダルちっさ」。§8 Phase 1 の決定表へ別タブ化5件を追記。併せて `DialogContent` の既定 `sm:max-w-sm` が tailwind-merge のグループ分離で呼び出し側の `max-w-*` を無効化していた不具合を修正（OS全体17ファイル32箇所のうち30箇所が384pxに潰れていた）。詳細は `pwa/BUGS.md`。
- 2026-08-22: 見たまま編集の**永久ローディング**を修正（build v3.89.3）。フレームとの合言葉をSSR/hydrationで二重生成していたため `ready` が親に届かなかった。§8 Phase 1 の決定表へ2件（合言葉の作り方・読み込みタイムアウト）を追記し、契約テスト `check_workspace_document_edit_frame.mts` に §5「親側 — 合言葉の作り方と、ローディングの出口」を追加。詳細は `pwa/BUGS.md`。
- 2026-08-22: 見たまま編集の全経路を**本番の実資料で実操作して確認**（スライド送り／要素選択／書式パネル／文字編集／保存往復／版履歴）。その過程で見つけた2件を §8 Phase 1 の決定表へ追記。(1) 入力中に選択情報を送り直していなかったため右パネルの要素プレビューが古いまま固まる不具合を修正（build v3.89.4）、(2) 保存が再シリアライズであり元HTMLとバイト一致しないことを仕様として明文化。
- 2026-08-22: Phase 2 実装（build v3.90.0）。モデル schema v1 + レンダラ1本 + API 3本 + 契約テスト2本。
  §3.1 のDDL転記を実体（migration / db_schema.md）への参照へ置き換え、§3.2 / §3.3 / §4 / §6 を実装後の記述へ更新。
  §8 Phase 2 に決定表を追記。UIはPhase 3。
