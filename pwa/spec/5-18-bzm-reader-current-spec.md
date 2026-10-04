# 書斎仕様（執筆途中の本と論文を読む画面）

> **この章は何か**: 執筆途中の本と論文を、Kindle のように1ページずつめくって通読する画面 `/bzm/read`（書斎）の確定仕様。公開範囲、画面と URL、別のアドレスの専用アプリとしてのインストールとアドレスの振り分け、棚に並べる6冊、原稿の前処理、描画、読書画面の操作（左の目次の列、見開きの間隔を含む）、位置の記憶、図の配信と専用ヘッダ、本番への同梱、検査、残課題を定める。2026-10-03 に新設し、同日の点検後の修正を反映した（build v3.150.0）。2026-10-04 に AMD OS とは別の専用アプリにし、読書画面の左に目次の列を常設して、見開きの左右のページの間を広げた（build v3.153.0）。同日午後、書斎を別のアドレス `https://bookshelf-armada.vercel.app` で開く方式にし、アドレスの振り分けを middleware に置いた（build v3.154.0）。設計の詳細と数値は `pwa/design/bzm_reader.md` を正本とし、この章はその確定した要点を `/spec` から読めるようにしたもの。

## 1. 位置づけ

- 読む人は管理者（まさ）。草稿の通読と、赤入れの前読みに使う。
- 既存の `/bzm/[slug]` は、章を1枚の長い紙で見る作業画面で、左ナビが常に幅を取り、文字は固定の大きさである。書斎は外枠を外した全画面で、文字の大きさ・行間・書体・背景を読む人が決める。
- 書斎は AMD OS とは別のアドレス `https://bookshelf-armada.vercel.app` で開く別アプリとして使う。サーバのプログラムと Supabase は AMD OS と同じで、アドレス（オリジン）だけが違う。そのため AMD OS をインストールした端末でも、書斎は AMD OS の窓に取り込まれず、ホーム画面や Dock に単独のアプリとして入る（§3.1）。棚も外枠（左ナビ・通知・チャット・月初合意ゲート）を持たず、AMD OS の左ナビに入口を置かない。入口は書斎のアドレスか、インストールした「書斎」アプリ。AMD OS のアドレスで `/bzm/read` 配下を開いても、書斎のアドレスへ移る。
- 原稿の正本は従来どおりリポジトリ直下の `bzm/*.md`。書斎は読むだけで、原稿を書き換えない。
- 共有する型は `pwa/src/lib/bzm-reader/types.ts`。型と設計正本は同じ commit で直す。

## 2. 公開範囲

| 項目 | 内容 |
|---|---|
| 入れる人 | 管理者（`members.is_admin`）だけ。`/model` と同じ扱い |
| 認証 | 会員かどうかは `(app)/layout.tsx` が判定する。管理者かどうかは `src/lib/bzm-reader/require-reader-admin.ts` の `requireReaderAdmin()`（`getCurrentMemberAccess` の `isAdmin`）が判定し、会員でなければ `/auth/login`、管理者でなければ `/dashboard` へ戻す |
| 判定の呼び出し元 | `read/layout.tsx`、棚・続きから開く・読書画面の3つの page、章ページの `generateMetadata` のすべて。layout は画面遷移のたびに再描画されず、他の segment の描画も止めないため、layout だけに置かない。同じリクエスト内では会員情報の問い合わせは一度だけ |
| 公開例外 | `/bzm/public` の公開例外（ログインなしで読める原稿）には入れない |
| 専用アプリ | インストールした書斎から開いても、同じ `requireReaderAdmin()` が働く（管理者限定は変わらない）。書斎のアドレスで管理者でない人が `/dashboard` へ戻されたときは、middleware が AMD OS のアドレスの `/dashboard` へ送る（§3.1） |
| 絞る理由 | 棚には未投稿の論文と、匿名化前の事実を含む草稿が並ぶ。`/bzm` は会員全員が読めるが、論文（`PAPER_P1_*`）は現行の `/bzm` では読めない。書斎で会員全員に見せると、見える範囲が広がる。広げるかはまさが決める |

## 3. 画面と URL

書斎の正規のアドレスは `https://bookshelf-armada.vercel.app`。下の URL はそのアドレスのパス。AMD OS のアドレス（`https://amd-os-pwa.vercel.app`）で `/bzm/read` 配下を開いたときは、書斎のアドレスの同じパスへ送る（§3.1）。

| URL | 中身 | 外枠 |
|---|---|---|
| `/bzm/read` | 書斎（本棚）。専用アプリの入口。上に「書斎」の見出し、本ごとのカード、書けた章の数、総文字数、通読の目安時間、この端末での読書位置 | 外枠なし。白い背景、幅の上限 1200px、iPhone の画面端（safe-area）の余白 |
| `/bzm/read/[book]` | 続きから開く。この端末に残った読書位置の章へ移る。無ければ最初の書けている章 | 外枠なし |
| `/bzm/read/[book]/[chapter]` | 読書画面。未執筆の章を直接開いたときは「この章は未執筆」と、「最初の書けている章へ」「書斎へ戻る」を出す | 外枠なし。クライアントの `AppShell` が外す（下記） |
| `/api/bzm-reader/asset/[...path]` | 原稿フォルダ内の図を配る（§9） | — |

- `?at=start` と `?at=end` は、章の最初と最後のページから開く（前後の章へめくったとき）。`#見出しid` は、その見出しのページを開く。どちらも使ったら URL から外す（再読み込みで飛び直さず、以後は保存位置で戻る）。
- 外枠を外す判定は `src/components/nav/AppShell.tsx` の `isBzmReaderRoute`。`usePathname()` が `^\/bzm\/read(?:\/[^/]+){0,2}\/?$`（`BZM_READER_ROUTE`）に合うとき、左ナビと常駐の部品（通知・チャット）を載せず、本文だけを描く。対象は棚（`/bzm/read`）、続きから開く、読書画面の3つすべて。月初合意ゲートも同じ判定で飛ばす。
- 判定をクライアントに置く理由: サーバの layout はソフトナビゲーションで再描画されないため、書斎から画面内リンクで範囲外の画面（章間リンクの `/bzm/<slug>` など）へ移ったとき（と逆）に、外枠の有無が古いままになる。書斎のアドレスでは範囲外の画面が AMD OS のアドレスへ移る（§3.1）が、プレビューや手元の開発は振り分けないので、同じアドレスの中で移る。`(app)/layout.tsx` には書斎の判定を置かない。
- AMD OS の左ナビ（`GlobalNav.tsx`「資料」）には書斎の項目を置かない（2026-10-04 に外した）。`surface-catalog.ts` の `bzm-reader`（`prefixes: ["/bzm/read"]`）は `bzm` より前に残す。

### 3.1 別のアドレスの専用アプリとして入れる（2026-10-04、v3.154.0）

書斎は、AMD OS とは別のアドレス `https://bookshelf-armada.vercel.app` で開く別アプリとして、ホーム画面や Dock に単独で入れられる。AMD OS のアドレスは `https://amd-os-pwa.vercel.app`。アドレス（オリジン）が違うので、AMD OS をインストールした端末でも、書斎は AMD OS の窓に取り込まれない。

- 共通: サーバのプログラム（Vercel のプロジェクト `amd-os-pwa`、同じ deploy）、ログインの仕組み、Supabase（同じプロジェクト）。費用は増えず、1回の deploy で両方のアドレスが更新される。
- 別: クッキー（ログインの状態）と、アプリとしての登録（アドレスごと）。

| 場所 | 内容 |
|---|---|
| `pwa/src/lib/bzm-reader/hosts.ts` | 2つのアドレスの定数 `SHOSAI_HOST`（`bookshelf-armada.vercel.app`）・`AMD_OS_HOST`（`amd-os-pwa.vercel.app`）、書斎のアドレスで出してよいパスの判定 `isShosaiHostPath`、振り分け先の URL を返す純関数 `readerHostRedirect(url, host)`（振り分けないときは null）。`host` は要求の Host ヘッダで、小文字にしてポートを外して比べる |
| `pwa/src/middleware.ts` | `readerHostRedirect` の振り分けを、ログインの判定（`updateSession`）より前に行い、307（一時的）で送る。matcher の除外に `manifest-shosai\\.json` も入れてある（除外しないと manifest の取得がログイン画面への 307 になり、インストールが壊れる）。静的ファイル、manifest、画像、`/auth/callback`、`/api/build-info` は middleware を通らず、振り分けもされない |
| `pwa/src/app/auth/login/layout.tsx`・`src/components/auth/LoginAppContext.tsx` | 書斎のアドレスで開いたログイン画面は「書斎」として出す。layout が Host ヘッダ（`isShosaiHost`）で判定し、題「書斎」・`manifest-shosai.json`・`appleWebApp` の title「書斎」を出し、画面には見出し「書斎」と「AMDメンバーとしてログイン」だけを置く（PJメンバーと研究機関向けの入口は出さない。書斎は管理者限定のため）。ログイン画面で「ホーム画面に追加」しても書斎のアプリとして入る（v3.154.1） |
| `pwa/public/manifest-shosai.json` | `name`・`short_name` は「書斎」。`id`・`start_url` は `/bzm/read`、`scope` は `/`（書斎のアドレスは書斎の画面だけを出すので、ログイン画面もアプリの範囲に入る）。`display` は `standalone`。`background_color`・`theme_color` は `#ffffff`。アイコンは AMD OS と同じ `/icons/*`。向き（`orientation`）は固定しない |
| `pwa/src/app/(app)/bzm/read/layout.tsx` | 書斎の配下でだけ、ルートの `manifest: "/manifest.json"` を `manifest: "/manifest-shosai.json"` に差し替える。あわせて `appleWebApp`（`capable: true`、`title: "書斎"`、`statusBarStyle: "default"`）と `viewport.themeColor` の `#ffffff` を出す。ページの題は `title: "書斎"` で、`(app)/layout.tsx` の「… - AMD OS」を上書きする（アプリの窓の題に出る。章ページは「章の題 - 本の題」）。管理者の判定 `requireReaderAdmin()` は従来どおり |
| Vercel（コードの外） | プロジェクト `amd-os-pwa` の Domains に `bookshelf-armada.vercel.app`（本番に割り当て） |
| Supabase（コードの外） | Authentication の URL Configuration の Redirect URLs に `https://bookshelf-armada.vercel.app/**`（ログイン後に書斎のアドレスの `/auth/callback` へ戻るため） |

アドレスの振り分け（`readerHostRedirect`）:

| 要求のアドレス | パス | 結果 |
|---|---|---|
| 書斎のアドレス | `/` | `/bzm/read`（棚）へ送る |
| 書斎のアドレス | `/bzm/read` と `/bzm/read/…`（書斎の画面）、`/api/bzm-reader/` 配下（図の API）、`/auth` と `/auth/…`（ログイン）、`/api/build-info` | そのまま出す |
| 書斎のアドレス | 上以外のすべてのパス | AMD OS のアドレスの同じパスと query へ送る |
| AMD OS のアドレス | `/bzm/read` と `/bzm/read/…` | 書斎のアドレスの同じパスと query へ送る（古いブックマークや、AMD OS の中から開いたときも書斎アプリ側へ移る） |
| 上の2つ以外（プレビューの deploy、手元の開発） | すべて | 振り分けない |

- 書斎の画面かどうかは、パスが `/bzm/read` ちょうどか `/bzm/read/` で始まるかで見る。`/bzm/readme` は書斎の画面ではなく、書斎のアドレスでは AMD OS のアドレスへ送る。
- インストール: iPhone は Safari で `https://bookshelf-armada.vercel.app` を開き、ログインして棚が出てから、共有ボタンの「ホーム画面に追加」で名前は「書斎」のまま追加する。Mac の Chrome は同じアドレスを開き、アドレスバー右端のインストールのアイコン、またはメニュー（︙）の「キャスト、保存、共有」の「ページをアプリとしてインストール」で入れる。AMD OS のアドレスから入れた「書斎」がある場合は、消して入れ直す（AMD OS のアドレスの書斎は、開くと書斎のアドレスへ移る）。手順の詳細は `pwa/manual/2-10-bzm-reader.md`。
- ログイン: 書斎のアドレスはクッキーが AMD OS とは別なので、書斎アプリでは初回に1回ログインする（Google）。未ログインで開くと、書斎のアドレスの `/auth/login?next=/bzm/read…`（開こうとした書斎のパスと query）へ送られ、ログイン後は書斎のアドレスの元の書斎の画面へ戻る（既存の `next` の仕組み）。`next` が無いときは `/` へ戻り、書斎のアドレスでは棚が開く。
- 範囲（scope）の外へ出るリンク: 原稿の章間リンクで、同じ本でない章は `/bzm/<slug>`（教科書の作業画面）へ飛ぶ。書斎のアドレスにこのパスは無いので、AMD OS のアドレスの同じパスへ送り、AMD OS の教科書の画面で開く。別のアドレスなので、書斎アプリの範囲の外の画面として開く。管理者でない人が `/dashboard` へ戻されたときも、同じ振り分けで AMD OS のアドレスへ移る。
- アドレスを変えるときは、`hosts.ts` の `SHOSAI_HOST`、Vercel の Domains、Supabase の Redirect URLs を同時に変える。インストール済みの書斎は、アドレスが変わると別のアプリとして扱われるので入れ直す。

## 4. 棚に並べる本

`pwa/src/lib/bzm-reader/library.ts` に固定で持つ。原稿の並び順の正本はここで、ファイル名の規則からは自動で拾わない（台帳 md と草稿メモが混ざるため）。

| id | 題 | 種類 | 言語 | 章の出どころ |
|---|---|---|---|---|
| `bzm30-textbook` | BZM 3.0教科書 | 教科書 | ja | `bzm/BZM_3_0_TEXTBOOK_PLAN.md` §1 の16本（序、第1〜14章、付録）。未執筆の章は予定の題で目次に灰色で出す。序の題は「序 — このモデルは何を測るのか」（2026-10-04 に改題。`library.ts` の `plannedTitle` と `bzm-chapters.ts` の題で同じ） |
| `book-a` | ディープテック起業の経営学 | 本 | ja | `bzm-chapters.ts` の `BZM_PARTS`（`key: "book-a"`）の章と、`BZM_CHAPTERS` の題 |
| `bzm22-textbook` | BZM 2.2教科書 | 教科書 | ja | 序、状態と行動、価値と指標、文脈と限界（未執筆） |
| `bzm-course` | BZM 批判的基礎講座 | 講座 | ja | 索引、s00、s01 |
| `p1-paper` | The Before Zero Model（第1論文） | 論文 | en | `PAPER_P1_DRAFT_V2.md` を `# ` 見出しごとに章へ割る |
| `p1-supplement` | 第1論文 補足資料 | 論文 | en | `sm_v2/SM-A.md`〜`sm_v2/SM-G.md` |

- 棚の順は上の表の順。書けた章数は「ファイルがある章 / 全章」。
- 原稿は `readModelCanonFile("bzm", file)`（プロセス内 5 分のキャッシュ）で読む。原稿は参照系データ（更新は日単位、読む側は書かない）なので、読むたびに素のファイル読みを繰り返さない。

## 5. 原稿の前処理（純関数、`pwa/src/lib/bzm-reader/preprocess.ts`）

描画の前に、Markdown を次の順で整える。どれも原稿ファイルは書き換えない。

1. 先頭の YAML（`---` から `---` まで）を外し、`title:` を題の候補として返す。
2. HTML コメント `<!-- … -->` を本文から外し、中身を執筆メモとして集める（コードブロックの中は触らない）。
3. pandoc の見出し属性 `{-}`、`{.unnumbered}` を見出しから外す（`{#id}` は描画側で id にするので残す）。同じ原稿ファイルの中で同じ文字の見出し（h1〜h4）が複数あるときは、2件目以降に `{#<id>-2}`、`{#<id>-3}` を付け、目次の id と描画の id を一致させる（論文は章に割る前の通しで数える）。
4. 論文の引用番号 `<sup>[1,2]</sup>` を `[1,2](#ref-1)` の形へ直す。章に割った本では、10 で番号ごとのリンクに替わる。
5. 見出しが `References` または `参考文献` の節で、行頭が `N. ` の番号付きリストを、飛び先の目印つきの段落に直す。
6. 図のパスを、その md のあるフォルダからの相対として解き、`/api/bzm-reader/asset/<bzm からの相対パス>` に書き換える。`/` で始まる絶対パス（`pwa/public` の図）と `http(s)://` はそのまま。
7. 章間リンク `./slug` と `./slug.md` を、同じ本の章なら書斎の URL（`/bzm/read/<book>/<slug>`）へ、そうでなければ `/bzm/<slug>`（教科書の作業画面）へ書き換える。書斎のアドレスにこのパスは無いので、AMD OS のアドレスの同じパスへ送られ、AMD OS の教科書の画面で開く（書斎アプリの範囲の外の画面になる。§3.1）。
8. callout（`> [!NOTE]` など）の行を、「メモ」「ヒント」「重要」「注意」の見出しに置き換える（Book A 第5章冒頭の警告を落とさないため）。
9. コードブロックの外の `# ` 見出しで章に割る。最初の見出しより前（著者行など）は最初の章の頭に付ける。slug は見出しの文字から作り、重複したら末尾に `-2` を付ける。
10. 引用リンクの書き換え（`load.ts`、割ったあと）。論文を章に割った本で、文献一覧の章（`References`、`参考文献`）から番号と書誌の対応を作り、他の章の引用を `[1](/bzm/read/<book>/references#ref-1 "書誌")` の番号ごとのリンクに書き換える。範囲 `3–5` は両端の番号をリンクにし、区切りは残す。文献一覧の章そのものは書き換えない（そこには飛び先の目印があり、章内リンクで足りる）。押すと、文献一覧の章のその文献のあるページが開く。

目次の第2階層は、前処理後の本文の `## ` と `### ` を拾って作り、id は描画側と同じ `headingAnchorId`（`{#id}` 優先）で作る。

## 6. 描画（サーバ部品、`pwa/src/components/bzm-reader/ReaderMarkdown.tsx`）

- サーバで HTML まで描き、読書画面に渡す。Markdown と KaTeX の処理をブラウザへ送らない。
- react-markdown 10 + remark-gfm + katex。依存は追加しない。
- 数式は Markdown の解析の前に退避し、描画のときに KaTeX へ戻す。解析に通すと `_` や `*` が強調として壊れるため。退避の規則は `protect-math.ts` にあり、文字数の数え方も同じ規則を使う。
- インライン数式の規則は既存の `BzmMarkdown` と同じ。`$` と `$` の間に `$` を含まない。改行は許し、空行（段落の切れ目）はまたがない。開きと閉じの直前直後の空白や数字は問わない。`\$` は文字としての `$` で数式にしない。インラインコードの中の `$` も数式にしない。金額の `$` は `\$` と書く。
- 見出し h1〜h4 に id を振り、本文の直下のブロックに `data-bzr-block`（番号）を振る。番号は読書位置の復元に使う。
- 表は列の数（最初の行のセル数）で2種類にする。5列以上は横スクロールの囲み（`bzr-hscroll bzr-table--wide`、セルの最小幅 6em）。4列以下は囲みなし（`bzr-table--fit`）で本文の幅に収め、長い語は列の中で折り、段をまたいで割れる（行の途中と見出し行の直後では割れない）。表示数式は、はみ出すときだけ横に動く囲み（`bzr-hscroll`）に入れる。
- 引用リンク（href が `#ref-N` で終わるもの）は上付きの `[N]` にし、title の書誌があれば付ける。`#refdef-N` は飛び先の目印（`id="ref-N"`）にする。
- 色は `--bzr-*` の変数で決める。表の罫線は `--bzr-table-line`（本文の罫線より濃い）、図の背面は `--bzr-figure-bg`（黒の背景のときだけ白地）。
- 色と大きさは CSS 変数で決め、部品の中に色を直書きしない。クラス名は `bzr-` で始める。
- 英語の本は外側に `lang="en"`、和文は `lang="ja"`。英文は自動の単語分割（`hyphens: auto`）を使う。

## 7. 読書画面（ブラウザ部品、`pwa/src/components/bzm-reader/`）

### 7.1 ページの作り方

- ページ表示（既定）: 本文を、高さが画面いっぱいの多段組み（CSS columns）に流し込み、1段を1ページとして横へずらす。
- 本文の段を2つ置ける広い画面（目安 1100px 以上）で「見開き」が入なら、2段を1画面に並べて2ページずつめくる。この幅は「本文の領域の幅」で見る。左の目次の列（§7.3）を出しているときは、画面の幅からその列の幅を引いた値で判定する（列のぶん本文が 1100px を切れば1ページになる）。
- 見開きの左右のページの間（段の間）は、本文の領域の幅の 7% か 72px の大きいほう（上限 120px）。1ページ表示は 48px のまま。間の真ん中には、本のノドのように細い縦の罫線を引く（`.bzr-gutter`。スクロールするビューポートの外に置いて動かさない）。めくり幅は「1画面の幅 + 段の間」。
- 文字の大きさ・行間・余白・書体・画面の大きさが変わったら、ページを割り直し、読んでいた本文ブロックが入るページへ戻る。図の読み込みと書体の準備が済んだときも割り直す。段数（1ページと2ページ）が変わる割り直し（目次の列の開閉で本文の領域が狭まったときなど）は、段数の記録つきで、ブロック番号と `fraction` から戻る。
- 数式と図は段の途中で割らない。図は1ページの高さに収まるよう縮める。4列以下の表は段をまたいで割れる。5列以上の表と表示数式は横スクロールの囲みに入れ、ページ表示ではその高さを「ページの高さ − 3em」までに止めて、中を縦にもスクロールさせる。
- スクロール表示では、縦に流して読み、位置はスクロール量で持つ。

### 7.2 めくり方

| 操作 | 動き |
|---|---|
| 画面の右 3 割の押下、左へのスワイプ、右矢印、PageDown、Space | 次のページ |
| 画面の左 3 割の押下、右へのスワイプ、左矢印、PageUp、Shift+Space | 前のページ |
| 画面の中央の押下 | 上下の帯を出す／隠す |
| 下矢印、上矢印 | ページ表示では次／前のページ。スクロール表示では少しずつスクロール |
| Escape | 上下の帯を出す／隠す（パネルを開いているときはパネルを閉じるだけ） |
| ホイール・トラックパッドの縦横の動き（ページ表示） | 動きが一定量たまるごとに1ページ。めくった直後は続けてめくらない |
| Home / End | 章の最初／最後 |
| 章の最後のページでの「次」 | 次の書けている章の最初へ |
| 章の最初のページでの「前」 | 前の書けている章の最後へ |

- 横書きなので右が次。リンク、ボタン、表の横スクロール、選択中の文字の上では、押してもめくらない。はみ出している表の上の横のホイールは、めくらず表を動かす。
- 本の最初のページで「前」、最後のページで「次」を押したときは、前後の章が無いので、帯を動かさず、画面下に「本の最初」「本の最後」を 2.2 秒出す。
- 帯のボタンをポインタで押したあとはフォーカスを外し、直後の Space・矢印キーでめくれるようにする。キーボードでボタンを操作したときはフォーカスを残し、ボタンやリンクにフォーカスがあるあいだの Space はそのボタンの操作として残す。
- 動きを減らす設定のときは、めくりの動きを付けない。

### 7.3 上下の帯・目次・しおり

- 上の帯: 「書斎へ戻る」、本と章の題、「目次」、「しおり」（このページを挟む／外す）、「文字の設定」。ボタンは 44px 以上。「目次」は、画面が 1100px 以上なら左の目次の列の開閉、それ未満なら目次のパネルを開く。
- 下の帯: 章の中の位置のつまみ（ドラッグでページへ飛ぶ）、ページ番号、本全体の進み具合、この章の残り時間。最初に表示し、めくると隠す。
- 左の目次の列（画面が 1100px 以上、2026-10-04）: 読書画面の左に常に出す。幅は `min(280px, 22vw)`。本文の領域（`.bzr-stage`）はその右側。目次としおりのタブを持ち、いま読んでいるページに当たる見出し（いまの画面の先頭ブロックと同じか、それより前にある最後の h2・h3）を強調する。強調した見出しが列の見える範囲から外れていれば、列の中だけをスクロールして寄せる。
  - 開閉は上の帯の「目次」ボタンと、列の先頭の「目次を閉じる」ボタン。状態は端末ごとの `localStorage` のキー `amd-os.bzm-reader.toc-open`（`"1"` が開、`"0"` が閉、既定は開。読み書きは try/catch）に持ち、文字の設定には含めない。
  - 色は `.bzr-root` のテーマ（白・セピア・黒）に従う。項目の高さは 44px 以上。
  - 項目を押したときの動きはパネルと同じ（見出しのページへ、別の章へ）。列は出したままなので、見出しを押しても上下の帯は隠さない。
  - 列は本文の領域の外にあるため、列の中の押下・ホイールでは本文をめくらない。キーも、Escape 以外は列の中では本文をめくらない。ポインタで押したボタンはフォーカスを外し、直後の矢印キーで本文をめくれる。画面を押したときの左右 3 割の判定は、列を除いた本文の領域の幅で見る。
  - 画面が 1100px 未満のときは、目次のボタンで横からパネルを出す（下の「目次」と同じ中身）。
- 目次: 本の章の一覧（いまの章を強調、未執筆の章は灰色で押せない）と、いまの章の見出し（h2・h3）。押すとその見出しのページへ飛ぶ。
- しおり: この本で挟んだ一覧（章の題、本文の冒頭 40 字、挟んだ日）。押すとその位置へ、外す操作もここ。
- パネルは閉じるボタン、Escape、背景の押下で閉じ、`document.body` 直下に出す（親の `overflow` に切られないように）。閉じるボタンは 44px 四方で、読み上げの名前は「閉じる」。
- 高さ 500px 未満の画面（スマホの横向きなど）は、本文の上下の余白を詰める。帯は出したときだけ本文に重なる。
- 目次の章は、ポインタを載せたときとフォーカスしたときに先読みする。いまの章を開いたら次の章も先読みする。

### 7.4 文字の設定

| 項目 | 選択肢 | 既定 |
|---|---|---|
| 文字の大きさ | 14〜30px の10段階 | 17px |
| 行間 | 1.6 / 1.8 / 2.0 / 2.2 | 1.8 |
| 余白 | 狭い / 標準 / 広い | 標準 |
| 書体 | ゴシック / 明朝 | ゴシック |
| 背景 | 白 / セピア / 黒 | 白 |
| 表示 | ページ / スクロール | ページ |
| 見開き | 広い画面で2ページ並べる | 入 |
| 執筆メモ | 章末に執筆メモを出す | 切 |

- 書体は端末に入っている字体を使う。Web フォントは読み込まない（CSP の `font-src 'self'` のため）。
- 設定は全書籍で共通。
- 見開きは、本文の領域の幅が 1100px 以上のときだけ効く。左の目次の列を開いたままだと、画面の幅が 1100px 以上でも1ページになる場合がある（計算上、列の幅が上限の 280px になる画面の幅 1272px 以上では、およそ 1380px 以上で列を開いたまま見開きになる）。この場合、設定パネルの「見開き」の補足は「左の目次を閉じると有効」と出る。

### 7.5 位置と進み具合

- 位置は端末ごとの `localStorage` に残す（キーは `types.ts` の `READER_STORAGE_KEYS`）。端末をまたいだ同期はしない。`localStorage` と背景色の Cookie はアドレス（オリジン）ごとに分かれるので、AMD OS のアドレスで残した位置・しおり・設定は、書斎のアドレスへ引き継がない（§3.1）。
- 残すもの: 章、章の中の位置 `fraction`（0〜1）、ページ先頭の本文ブロック番号、更新日時。画面が変わってから 300ms 遅らせて書き、ページを離れるときと隠れるときに書き残しを書く。
- 読書位置は、ブロック番号とブロック内の位置（`fraction`）の2つで持つ。復元は、そのブロックが占めるページ（スクロール表示では範囲）の中で `fraction` に最も近い位置へ戻す。長いブロックの途中のページにも戻る。ブロックが見つからなければ `fraction` だけで戻る。
- スクロール表示では、「上端にいるブロック」の判定と戻す位置を同じ許容値で決めるので、保存して戻しても1つ前のブロックへずれない。
- 割り直し（文字の大きさの変更など）では、読んでいたブロックとブロック内の差で戻る。表示方式を切り替えたときと、段数（1ページと2ページ）が変わったときは、差を使わず、ブロック番号と `fraction` で戻る（差は記録したときの段数で数えた画面数のため）。見開きの段の間が変わっても、読んでいたブロックが見える画面へ戻る。
- しおりの「挟んでいる」判定は、しおりのブロックがいまの画面に含まれ、`fraction` がいまの画面に最も近いこと。外すときも同じ条件で、いまの画面に当たるしおりをすべて外す。
- 本全体の進み具合 =（前の章までの文字数 + いまの章の文字数 × 章の中の位置）÷ 本の総文字数。未執筆の章は 0 字。
- 残り時間 = いまの章の残りの文字数 ÷ 1分の文字数（和文 500字、英文 1,300字）を切り上げた分。
- 文字数は目安。数えないもの: 空白と改行、見出しの `#` と `{#id}`、表の区切り行、コードブロックの囲み記号。リンクは表示文字だけ、図は 1 字、数式は 1 件 1 字で数える。コードブロックの中身、表の縦線、強調の記号は数える。
- 背景色は Cookie `amd-os.bzm-reader.theme`（`white` / `sepia` / `black`、有効期間 1 年）にも書く。章ページ（サーバ）が読んで、再読み込みの最初の描画から正しい背景で出し、白い光りを防ぐ。Cookie には背景色の名前だけを入れる。
- `localStorage` と Cookie が使えない環境でも画面は動く（読み書きはすべて例外を受ける）。

## 8. 検査に載せる純関数の置き場

検査 `check_bzm_reader.mts` は `node --experimental-strip-types` で走るため、検査から読む `library.ts`・`preprocess.ts`・`protect-math.ts`・`progress.ts`・`storage.ts`・`hosts.ts` は `@/` を使わず、拡張子 `.ts` 付きの相対 import だけにする。

## 9. 図を配る API（`GET /api/bzm-reader/asset/[...path]`）と専用ヘッダ

- 管理者だけ（既存の認証関数で `members.is_admin` を確かめる）。
- `bzmContentDir()` の下だけを配る。`..` と絶対パスを拒み、解いたパスが `bzm/` の中にあることを確かめる。
- 拡張子は png / jpg / jpeg / svg / webp / gif だけ。`Cache-Control: private, max-age=3600`。
- route は `nosniff` を付け、SVG にはさらに `Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'` を付けて、図の中のスクリプトを止める。
- 全体の設定（inline script を許す CSP）に route の CSP が上書きされると、SVG を直接開いたときに中のスクリプトが同一オリジンで走る。そのため `next.config.ts` の `headers()` が、この path（`/api/bzm-reader/asset/:path*`）にだけ後から専用ヘッダを当てて上書きする。

| ヘッダ | 値 |
|---|---|
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `SAMEORIGIN` |
| `Referrer-Policy` | `no-referrer` |
| `Content-Security-Policy` | `default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox` |

## 10. 本番で原稿を読むための同梱

動的な fs 読みは自動追跡に乗らず、本番だけ ENOENT になる前例がある。`next.config.ts` の `outputFileTracingIncludes` に次を置く。

- `/bzm/read/page`、`/bzm/read/[book]/page`、`/bzm/read/[book]/[chapter]/page`: `../bzm/**/*.md`
- `/api/bzm-reader/asset/[...path]/route`: `../bzm/**/*.png`、`*.jpg`、`*.jpeg`、`*.svg`、`*.webp`、`*.gif`

## 11. 検査

| 検査 | 内容 |
|---|---|
| `npm run test:bzm-reader`（deploy 前ゲート） | 前処理の各規則の入出力、見出しの連番、論文の引用の書き換え、数式の退避（実原稿の全章で数式の外に `$` が残らない）、文字数の数え方、棚の本と章の重複なし、Book A の章が `BZM_PARTS` と一致、未執筆の章の返し方、`ReaderMarkdown` を描いたときの目次と見出しの id の一致、表の囲みの種類、進み具合、端末内保存、書斎のアドレスの振り分け（`readerHostRedirect`。書斎のアドレスの `/` が棚へ、書斎の画面・図の API・ログインはそのまま、それ以外と `/bzm/readme` は AMD OS のアドレスへ。大文字・ポート付きの Host。AMD OS のアドレスは `/bzm/read` 配下だけを書斎のアドレスへ。プレビューと手元の開発は振り分けない） |
| `npm run test:critical-ui` | 管理者の判定（`require-reader-admin.ts` の `isAdmin` と `redirect("/dashboard")`、layout と3つの page の `requireReaderAdmin()`）、外枠を外す判定 `isBzmReaderRoute` が `AppShell.tsx` にあり `(app)/layout.tsx` に無いこと、`BZM_READER_ROUTE` が棚を含む3画面に合う正規表現であること、左ナビ（`GlobalNav.tsx`）に `"/bzm/read"` が無いこと、専用アプリの部品（`manifest-shosai.json` の `start_url`（`/bzm/read`）・`scope`（`/`）・`display`、`middleware.ts` の `manifest-shosai\\.json` の除外、`read/layout.tsx` の `manifest: "/manifest-shosai.json"`）、アドレスの振り分け（`middleware.ts` が `readerHostRedirect(request.nextUrl` を呼び `NextResponse.redirect(hostRedirect, 307)` で送ること、`hosts.ts` の `SHOSAI_HOST` と `AMD_OS_HOST`）、`surface-catalog` の `bzm-reader`、同梱指定、図の API の専用ヘッダ、`test:bzm-reader` の登録、読書画面の「目次」「文字の設定」ボタン、左の目次の列（`ReaderTocColumn` と `data-bzr-toc-col`、`toc-open` の保存キー、`reader-shell.css` の `.bzr-toc-col {`・`--bzr-toc-w`・`.bzr-gutter::after`） |
| `npx tsc --noEmit` | 共有型と各担当の部品の整合 |

## 12. 残課題

- 端末をまたいだ読書位置・しおりの同期（DB の表が要る。まさの判断待ち）。
- 文字列への線引きとメモ（ハイライト）。
- 縦書き（数式の多い本では崩れやすい。iOS の `TextbookReaderView` は縦書き）。
- 電波の無い場所での読書（service worker が無い）。
- AMD OS 本体の `manifest.json` の `orientation: "landscape"`。Android にインストールした AMD OS は横向きに固定されうる。外すかはまさが決める。書斎の `manifest-shosai.json` は向きを固定しない。
- iOS / macOS / Android のネイティブ画面は未移植（`macos/PARITY.md`、`ios/DESIGN.md`）。

## 確認した current truth

- `pwa/design/bzm_reader.md`（設計正本）
- `pwa/src/lib/bzm-reader/types.ts` / `library.ts` / `preprocess.ts` / `protect-math.ts` / `progress.ts` / `storage.ts` / `load.ts` / `require-reader-admin.ts` / `hosts.ts`
- `pwa/src/components/bzm-reader/ReaderMarkdown.tsx` / `ReaderView.tsx` / `ReaderPanels.tsx` / `ReaderTocColumn.tsx` / `useReaderPagination.ts` / `reader.css` / `reader-shell.css`
- `pwa/src/app/(app)/bzm/read/**`（`layout.tsx` の manifest 差し替え、`page.tsx` の棚の外枠なしの表示）、`pwa/src/app/api/bzm-reader/asset/[...path]/route.ts`
- `pwa/public/manifest-shosai.json`、`pwa/src/middleware.ts`（アドレスの振り分け、matcher の除外）、`pwa/src/app/auth/login/page.tsx` と `pwa/src/app/auth/callback/route.ts`（開いているアドレスへ戻るログイン）
- `pwa/src/components/nav/AppShell.tsx`（`isBzmReaderRoute`、`BZM_READER_ROUTE`）、`pwa/src/lib/surface-catalog.ts`、`pwa/src/components/nav/GlobalNav.tsx`（書斎の項目なし）、`pwa/next.config.ts`（同梱指定と図の専用ヘッダ）
- `pwa/scripts/check_bzm_reader.mts`、`pwa/scripts/check_pwa_critical_ui.cjs`、`pwa/scripts/deploy.sh`
