# 2-8 資料室 スライドエディタ 実装計画

> **状態**: 計画（2026-08-21 まさ承認）。実装はこれから。
> 本章は「これから作るもの」の設計正本。フェーズが完了するたびに該当節を現行仕様の記述へ書き換え、
> ユーザー向けの使い方は `pwa/manual/` の資料室章へ落とす。

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

`pwa/scripts/migrations/310_workspace_document_decks.sql`

```sql
-- 現行版のモデル（1資料1行）
create table workspace_document_decks (
  document_id      uuid primary key references workspace_documents(document_id) on delete cascade,
  schema_version   int  not null,
  model            jsonb not null,
  model_sha256     text not null,
  published_sha256 text,                    -- 最後に publish したHTMLのsha。null=未公開/差分あり
  updated_at       timestamptz not null default now(),
  updated_by_account_id uuid
);

-- 版履歴（モデル資料・生HTML資料の両方）
create table workspace_document_revisions (
  revision_id   uuid primary key default gen_random_uuid(),
  document_id   uuid not null references workspace_documents(document_id) on delete cascade,
  revision_no   int  not null,              -- 資料内で1始まりの連番
  kind          text not null,              -- 'deck_model' | 'html_source'
  model         jsonb,                      -- kind='deck_model'
  storage_path  text,                       -- kind='html_source' の退避先
  content_sha256 text not null,
  byte_size     int  not null,
  note          text,                       -- 差し替え理由
  pinned        boolean not null default false,
  created_by_account_id uuid,
  created_at    timestamptz not null default now(),
  unique (document_id, revision_no)
);

-- 資料内アセット（画像など）
create table workspace_document_assets (
  asset_id     uuid primary key default gen_random_uuid(),
  document_id  uuid not null references workspace_documents(document_id) on delete cascade,
  storage_path text not null,
  mime_type    text not null,
  byte_size    int  not null,
  width        int,
  height       int,
  created_at   timestamptz not null default now()
);
```

保持: 各資料の直近50版 + `pinned=true` は無期限。超過分は古い順に削除し、
`html_source` はStorageの実体も消す。

### 3.2 デッキモデル schema v1

`pwa/src/lib/workspace-deck-model.ts`（手書きvalidator。このリポにzodは無い）

```ts
type Deck = {
  schemaVersion: 1;
  meta:   { title: string; docType: "deck" | "doc"; updatedAt: string };
  theme:  { preset: "amd"; tokens?: Partial<DeckTokens>; logo: "amd_horizontal" | "amd_mark" | "none" };
  defaults: { slideMode: "fixed16x9" | "flow"; contentWidthPx: number };
  slides: Slide[];
};

type Slide = {
  id: string;
  mode: "fixed16x9" | "flow";
  layout: "cover" | "section" | "standard" | "full";
  sectionTitle?: string;     // 全ページ共通の「章タイトル」。AMD_SLIDE_DESIGN_CODE の必須要素
  notes?: string;            // 発表者メモ。本文と分ける（対外資料ルール）
  blocks: Block[];
};

type Block = { id: string; style?: BlockStyle } & (
  | { type: "heading";    slots: { eyebrow?: string; title: string; lead?: string } }
  | { type: "bullets";    slots: { items: RichText[] }; variant?: "plain" | "check" | "number" }
  | { type: "twoCol";     slots: { left: Block[]; right: Block[] }; variant?: "even" | "wideLeft" | "wideRight" }
  | { type: "table";      slots: { head: RichText[]; rows: RichText[][] }; variant?: "plain" | "compare" }
  | { type: "kpiRow";     slots: { items: { label: string; value: string; unit?: string; note?: string }[] } }
  | { type: "timeline";   slots: { items: { when: string; title: string; body?: RichText }[] } }
  | { type: "funnel";     slots: { steps: { title: string; body?: RichText; metric?: string }[] } }
  | { type: "callout";    slots: { title?: string; body: RichText }; variant?: "info" | "warn" | "accent" }
  | { type: "quote";      slots: { body: RichText; source?: string } }
  | { type: "image";      slots: { assetId: string; caption?: string }; variant?: "inline" | "bleed" }
  | { type: "spacer";     slots: { size: "sm" | "md" | "lg" } }
  | { type: "freeCanvas"; slots: { items: { x: number; y: number; w: number; h: number; rot?: number; block: Block }[] } }
  | { type: "rawHtml";    slots: { html: string } }
);
```

- `RichText` は**インライン限定の最小サブセット**（`strong` / `em` / `br` / `a` / `code`）。
  段落構造はブロック側が持つ。任意HTMLを文字列に混ぜない。
- `freeCanvas` は `mode: "fixed16x9"` のスライドでのみ許可。座標は 1280×720 基準の実数。
- `rawHtml` は publish時にサニタイズ（`script` / `iframe` / `on*` / `javascript:` を除去）。
- モデルJSONは 2MB 上限（`WORKSPACE_DOCUMENT_DECK_MODEL_MAX_BYTES`）。画像はアセット参照で、
  モデルにbase64を埋めない。

### 3.3 定数の追加先

[`workspace-documents-core.ts`](../src/lib/workspace-documents-core.ts) に追記:

```ts
export const WORKSPACE_DOCUMENT_DECK_SCHEMA_VERSION = 1;
export const WORKSPACE_DOCUMENT_DECK_MODEL_MAX_BYTES = 2 * 1024 * 1024;
export const WORKSPACE_DOCUMENT_ASSET_MAX_BYTES = 10 * 1024 * 1024;
export const WORKSPACE_DOCUMENT_ASSET_MAX_EDGE_PX = 1920;
export const WORKSPACE_DOCUMENT_REVISION_KEEP_COUNT = 50;
```

---

## 4. レンダラは1本だけ

`pwa/src/lib/workspace-deck-render.tsx` に **Reactコンポーネントとして1回だけ**書き、
3箇所で使い回す。

| 用途 | 呼び方 |
|---|---|
| エディタのキャンバス | クライアントで直接マウント |
| publish（HTML書き出し） | `renderToStaticMarkup()` でサーバ生成 |
| PDF | publish済みHTMLを既存の [`workspace-document-html-pdf.ts`](../src/lib/workspace-document-html-pdf.ts) へ通す |

CSSは `pwa/src/lib/workspace-deck-css.ts` が `export const DECK_CSS = \`...\`` の**文字列1本**で持つ。
エディタはこれをiframeへ注入し、publishは `<style>` へ直接埋める。
Tailwindのユーティリティをデッキ内で使わない（publish先にTailwindが無いため、必ずズレる）。

publish出力は**自己完結HTML**: 画像はdata URI、フォントはシステムフォントスタック、外部参照ゼロ。
これで既存の [`render/route.ts`](../src/app/api/workspace-documents/[documentId]/render/route.ts) の
`default-src 'none'; img-src data:` CSPをそのまま通る。

**サイズ制約**: publish後のHTMLは `WORKSPACE_DOCUMENT_HTML_PREVIEW_MAX_BYTES`（5MB）以内でないと
プレビューが拒否される。base64は約1.33倍になるので画像の実バイト合計は約3.5MBが上限。
アセットアップロード時に長辺1920pxへ自動縮小し、エディタは推定publishサイズを常時表示して
4MBを超えたら警告する。

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
| `.../[documentId]/deck` | GET / PUT | モデルの取得・保存（`expected_sha256` 同様） |
| `.../[documentId]/deck/publish` | POST | モデル→HTML生成→Storage上書き→`published_sha256` 更新 |
| `.../[documentId]/assets` | GET / POST | アセット一覧・アップロード（縮小＋WebP化） |
| `.../[documentId]/edit-frame` | GET | 編集用フレーム（nonce script、sandbox） |

すべて既存の `resolveDocumentRowAccess` / `access.canUpload` / `isSameOriginWorkspaceMutation` を通す。
監査は既存 `recordWorkspaceAuditEvent` に `edit_deck` / `publish_deck` / `restore_revision` を追加。

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
- `workspace-deck-render.tsx` / `workspace-deck-css.ts`
- `deck` / `deck/publish` / `assets` API
- ブロック第1弾: `heading` / `bullets` / `table` / `twoCol` / `callout` / `image` / `kpiRow` / `rawHtml`
- publish → 既存の render / pdf / project-share がそのまま動くことを確認

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
| `check_workspace_deck_model.mts` | schema v1 のvalidator：必須スロット、未知type拒否、`freeCanvas`はfixedのみ、モデル上限バイト |
| `check_workspace_deck_render.mts` | 代表モデル → publish HTML のスナップショット。外部参照ゼロ、`script`混入ゼロ、5MB以内 |
| `check_workspace_document_html_editing.mts` ✅ | script退避→復元の往復一致、本文差し替えの純粋関数、**退避番号ずれの検出**（4-a: scriptが消えて目印コメントが本文に残る／4-b: 先頭追加で番号がずれ別scriptが別位置へ） |
| `check_workspace_document_edit_frame.mts` ✅ | `allow-same-origin` を付けないこと（ヘッダ値だけを切り出して検査。JSDocの日本語説明に語が入るので本文全体をgrepしない）、nonce付き `script-src`、token照合、埋め込みagentがtranspileヘルパーを要する構文を使わないこと |
| `check_workspace_document_revisions.mts` ✅ | insert先行のrevision採番、追記のみ、退避失敗時に上書きしないこと、sha算出の統一、保持50件＋pinnedの除外 |

既存の `check_workspace_documents_core.mts` / `check_workspace_documents_contract.mjs` は
新定数・新ルートを含むよう更新する。

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
