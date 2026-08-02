# BZM 2.0 理論マップ 仕様

> **この章は何か**: `/bzm/map` の確定実装仕様。BZM 2.0 の主張・概念・測定・決定・文献・未解決論点を、有向エッジで育てる**論証台帳 / カバレッジ可視化ツール**である。

## 目的と非目的

- 自分が理解した理論要素をノードとして記録し、根拠・異論・反証・検証・未解決論点を別ノードとエッジで結ぶ。
- マップの空白とノードそのものを操作対象にし、外側の作成ボタンへ視線を往復せず地図を広げる。
- **真理マップではない。** ノード数、接続数、位置は真偽や確信度を表さず、台帳の充実度を示すだけ。
- SPS・ECR・AMD Score 等と合成したスコアを出さない。理論マップ自体が診断、予測、意思決定を代替しない。
- `status` は人が記録する分類であり、画面が自動で真偽判定しない。`source + established` も資料の存在確認であって、BZM 固有主張の確立を意味しない。

## 正本と履歴資産

| source | 役割 |
|---|---|
| `bzm_theory_nodes` / `bzm_theory_edges` | 唯一の共有ランタイム正本。ノード=理論要素、エッジ=理論要素同士の関係。利用者本人がOS UIから追加・編集・接続解除する |
| `bzm_theory_node_memos` | ノードの内側へ積む記録。選択ノードへ複数積めるが、ノードともエッジとも独立した別テーブルで、追加してもノード数・エッジ数を変えない |
| migration `214_bzm_theory_node_memos.sql` | `bzm_theory_node_memos` を空で作成する現在化migration。既存ノード・エッジ・利用者データは更新・移行・削除しない |
| migration `208_bzm_theory_map_user_authored_reset.sql` | 既存シードを削除し、0ノード / 0関係の利用者作成台帳へ戻す現在化migration |
| migration `203_bzm_theory_editor.sql` | テーブル・制約・RLSと、廃止済み初期データを含む再構築履歴 |
| `pwa/bzm/theory-graph/*.md` | 旧21ノード / 34関係の検証・復元用履歴資産。ランタイムへ自動読込しない |

DB取得に失敗した場合は空の `unavailable` 結果を返し、画面上部で編集停止を明示する。Markdownや廃止済みシードを自動表示して、利用者本人が書いた地図と混ぜてはならない。

## 概念境界: ノード・エッジ・メモは別物

- **ノード** = 理論要素そのもの。**エッジ** = 理論要素同士の関係。**メモ** = 選択ノードの内側へ積む記録で、ノードでもエッジでもない。
- メモを追加しても `bzm_theory_nodes` / `bzm_theory_edges` へは書かない。ノード数・エッジ数・画面上の件数表示は変わらない。
- 別の文献や別の理論要素をグラフへ加える場合だけ、空白クリックで新ノードを作り、必要なら `Cmd`/`Ctrl` 二点クリックでエッジ接続する。メモ追加はこの経路を経由しない。
- 2026-08-02 以前は「メモを追加」が1メモにつき1ノード+1エッジを作る誤仕様だった (`relationDirection` / `relationRoleDefaults` / `deriveNoteTitle` によるノード自動生成)。この誤仕様は撤回し、メモは `bzm_theory_node_memos` だけへ書く現行仕様に置き換えた。

## ノードモデル

`bzm_theory_nodes` の主要列:

| column | contract |
|---|---|
| `id` | text primary key。UI作成時は `<kind>-<uuid>` |
| `title` | 必須、1〜220文字 |
| `kind` | `concept` / `claim` / `measure` / `decision` / `source` / `question` |
| `layer` | `cross-layer` / `evidence` / `diagnosis` / `prediction` / `decision` / `institution` / `portfolio` |
| `status` | `established` / `conditional` / `design-choice` / `hypothesis` / `refuted` / `unknown` |
| `summary` | 必須、1〜2000文字 |
| `body_md` | 任意の詳細 Markdown、最大30000文字 |
| `source_ref` | 任意の文献情報、URL、OS内参照。最大1000文字 |
| `origin` | `seed` または `editor` |
| `created_by`, `updated_by` | 操作者の認証メール |
| `archived_at` | 将来の履歴退避用。通常表示は null のみ |

`refuted` は削除ではなく反証済みの履歴を残すために使う。現行 UI は誤消去を防ぐためノード削除を持たない。

## エッジモデル

`bzm_theory_edges` は `id` (UUID)、`from_node_id`、`to_node_id`、`relation_type`、最大2000文字の任意 `note`、作成者・作成時刻を持つ。同じ `(from_node_id, relation_type, to_node_id)` は重複不可で、自己参照も不可。ノード参照は外部キーで保護する。文字数、自己参照、`raises` 到達先、`raises` 到達ノードのkind変更禁止はAPIとDB制約/triggerの両方で強制する。

| type | 表示 | `from → to` の意味 |
|---|---|---|
| `defines` | 定義する | from が to を定義・構成する |
| `supports` | 支持する | from が to の根拠になる |
| `challenges` | 異議を唱える | from が to に疑義を呈する |
| `refutes` | 反証する | from が to を反証する |
| `depends_on` | 依存する | from が to を前提とする |
| `supersedes` | 上書きする | from が旧版の to を置き換える |
| `operationalizes` | 運用化する | from が to を測定・実装可能にする |
| `tests` | 検証する | from が to を検証する |
| `raises` | 論点を残す | from が未解決論点の to を生む |

`raises` の到達先は必ず `question`。`raises` の入力がある問いを別 kind に変更する操作も拒否する。文献ノードは原則 `supports` / `challenges` / `refutes` / `tests` を使い、外部資料が BZM の概念を直接「定義した」と誤記しない。

## メモモデル

`bzm_theory_node_memos` は選択ノードの内側へ積む記録で、ノードでもエッジでもない。ノード削除時は `ON DELETE CASCADE` で追従する。

| column | contract |
|---|---|
| `id` | uuid primary key、`gen_random_uuid()` |
| `node_id` | 必須、`bzm_theory_nodes(id)` への外部キー |
| `memo_type` | 必須。`supports` / `challenges` / `refutes` / `raises` / `tests` の5種 (メモの役割ラベル) |
| `body` | 必須、trim後1〜2000文字。DB CHECKでも強制 |
| `created_by` | 操作者の認証メール |
| `created_at` | 既定 `now()` |

`memo_type` はエッジの `relation_type` と同じ語彙のうち5種を再利用したラベルだが、エッジは作らない。向きも接続先ノードも持たない。`defines` / `depends_on` / `supersedes` / `operationalizes` は方向が用途で変わるためメモの役割には出さず、既存の `Cmd`/`Ctrl` 二点クリック直接接続 (9 relationすべて選択可) に残す。

## 権限と書き込み境界

- 認証済み AMD メンバーは active ノードと、その active ノード間のエッジ、および active ノードに属するメモを閲覧できる。
- 追加・編集・接続解除・メモ追加は `members.is_admin=true` の管理者だけ。
- API は毎回 `requireMember()` / `requireAdmin()` で認証し、管理クライアントは認可後にだけ生成する。
- RLS でも authenticated read、`is_admin()` write、service role all を二重に強制する (ノード・エッジ・メモの3テーブル共通)。
- 空白クリック時は画面内だけに下書きノードを即時生成する。DBへのノード作成・編集は保存ボタン、既存ノード間の接続は2点目の `Cmd/Ctrl+click`、接続解除は削除確認、メモ追加は選択ノードの操作帯からユーザーが実行した時だけ書く。自動保存、通知、外部送信は行わない。

## API

`/api/bzm/theory-map` を使う。

| method | action | body / target |
|---|---|---|
| `GET` | 現在のノード・エッジ・メモを読む | member 必須。一部のみを正本扱いせず、失敗時は全体を `unavailable` にする |
| `POST` | ノード作成 | `{ action: "create_node", node, edge? }`。必要なら1本目の接続も同時要求 |
| `POST` | 既存ノード同士を接続 | `{ action: "create_edge", edge }` |
| `POST` | 選択ノードへメモを追加 | `{ action: "create_memo", nodeId, memoType, body }`。ノード・エッジは作らない |
| `PATCH` | ノード編集 | `{ nodeId, changes }` |
| `DELETE` | エッジ解除 | query `edgeId=<uuid>` |

`create_memo` は対象ノードが存在しactiveであること、`memoType` が5種のいずれか、`body` がtrim後1〜2000文字であることをAPIで検証する。

ノード作成後に1本目のエッジ作成が失敗した場合は、そのリクエストで作ったノードだけを補償削除し、片方だけ残さない。DBの生エラーはサーバーログに限定し、画面には安全な日本語エラーを返す。

## UI / UX

### 全体構造

ヘッダ → 検索・フィルタ → マップ/一覧 → 選択ノード台帳の順。desktop は地図と台帳を並べ、ノードが存在するmobileは可読性の高い一覧を初期表示する。空の台帳はmobileでもマップを表示し、最初のノードを作れる。件数は真偽・確信度ではない。

### 空白からノードを書く

管理者がマップの空いている場所をクリックすると、その座標に**保存前の下書きノードを即時生成**する。下書きの見た目は `graphData` → Canvas 描画の1系統だけで表示し、Canvasと別座標に同じ下書きを重ねて描くHTMLマーカーは持たない (= 2026-08-02 以前は `data-bzm-draft-node` マーカーがCanvas描画と同じ座標に重なって描かれ、空白1クリックで下書きが二重に見える不具合があった)。同じマップ上でノードの横に新規ノード編集オーバーレイを開く。API応答まで空の画面で待たせず、地図を縮めたり右台帳を押し出したりしない。オーバーレイはクリックしたノードを覆わない側へ配置し、mobileでは画面内に収まる下部オーバーレイにする。ヘッダや右台帳に作成ボタンは置かない。

1. 種別を、概念・主張・測定・決定・文献・論点のカードから選ぶ。
2. 見出しと要約を書く。この2項目だけで素早く記録できる。
3. 必要なときだけ詳細を開き、層・状態・本文・文献情報を足す。

文献を選んだ時は文献情報を基本欄に出し、論点を選んだ時は `question / cross-layer / unknown` を初期値にする。
入力中はタイトル・種別等を下書きノードへ反映する。保存成功時は同じ位置のままDBノードへ置き換え、キャンセルまたはEscapeでは下書きだけを消す。

### ノードを育てる

ノードの通常クリックは、そのノードを覆わない側へマップ内編集オーバーレイを開く。ドラッグ後に発火するクリックは抑止し、配置変更と編集を混同させない。編集オーバーレイを閉じた後は、選択ノードの小さな操作帯から同じノードへメモも積める。右側台帳は読み取りへ専念し、編集操作を置かない。

- **メモを追加** (2026-08-02 以前は「根拠」「異論」「論点」の3ボタンに分かれ、さらに1メモ=1ノード+1エッジを作る誤仕様だったが、いずれも撤回して1ボタン・ノード内メモへ統合): 選択ノードの操作帯にあるこのボタン1つで、マップ内にメモ用の作成オーバーレイを開く。**draft nodeは作らない** — 空白クリック時のノード下書きとは別経路。オーバーレイでは、まずメモ本文を書き、次にそのメモの役割を `supports` / `challenges` / `refutes` / `raises` / `tests` の5種から選ぶ (`MEMO_TYPE_OPTIONS`)。`defines` / `depends_on` / `supersedes` / `operationalizes` は接続の向きが用途によって変わり一律の既定値を決めがたいため、メモの役割には出さず、既存の `Cmd`/`Ctrl` を押した2ノード直接接続 (9 relationすべて選択可) に残す。層・状態・タイトル・出典・本文Markdown・接続プレビューは一切出さない — メモはノードでもエッジでもないため、これらの項目自体を持たない。保存は `POST { action: "create_memo", nodeId, memoType, body }` を呼び、選択ノードの `bzm_theory_node_memos` へ1行追加するだけで、ノード数・エッジ数・画面上の件数表示は変わらない。保存成功後はオーバーレイを閉じ、選択は同じノードのまま、成功文言は「メモを追加しました」。操作帯自体は残るため、同じノードへ何件でもメモを追加できる。
- **編集**: 選択ノードの内容を更新する。

通常ドラッグはノードの配置変更だけに使い、接続を作らない。接続は `Cmd+click`（他OSでは `Ctrl+click`）で2ノードを順に選ぶ。1点目はノードに近い細い実線ハローとマップ内の小さな接続待ち帯で示し、必要なら待ち帯のrelationを変更する。2点目を選んだ瞬間、API完了を待たずに**1点目 → 2点目**の線を描き、選択中のrelation（初期値 `supports`）で保存する。待ち帯も「線を表示済み・保存中」と即時に変える。「つなぐ」確認ボタンや接続パネルは出さない。同一ノードの2回選択は拒否して1点目を保持する。空白クリック、Escape、またはfilterで1点目が非表示になると接続待ちを解除する。保存中は多重操作を受けず、失敗時は仮の線だけを戻し、1点目を保持して安全なエラーを表示する。

エッジはノード中心まで描かず、from側・to側それぞれの形状外周との交点で止め、矢印の先端をto側外周へ接触させる。エッジをクリックすると予約区画に確認パネルを出して接続解除できる。新規・派生・編集はマップ内オーバーレイ、削除確認は `graph + right/lower panel` とする。Escapeで閉じられるが、保存・削除処理中は閉じない。

### 閲覧

- 全文検索: id / title / summary / source_ref。
- filter: layer、status、relation type。relation filter は地図のエッジだけに作用し、台帳から反証等を消さない。
- map: kind を固有の塗り色（色覚に依存しない形も併用）、接続本数を半径、layer を横方向の帯で表す。status は一覧・台帳の文字ラベルに退避し、ノード外周に点線・破線を重ねない。ノード中心に略字は置かない。
- list: kind / layer / status / 接続本数を1行で比較する。
- 台帳: summary、source_ref、本文を表示したうえで、**「メモ」と「接続しているノード」の二層**に分ける (2026-08-02 まさ確定、ノード内メモとグラフ接続の概念分離)。
  - **メモ**: 選択ノードの `bzm_theory_node_memos` 一覧。役割ラベル (`MEMO_TYPE_LABEL` + `MEMO_TYPE_COLOR`) + 本文を並べ、0件の空状態は「メモなし」1つ。複数件を新しい順に表示し、LaTeXは `$...$` / `$$...$$` をKaTeXで数式表示する。
  - **接続しているノード**: 既存edge一覧 (旧「関連メモ」を改称、`関連メモ`という語は使わない)。各行は relation 種別 (向き付き矢印 + `RELATION_LABEL`) と接続先ノードのタイトルを1行で表示し、クリックでその接続先ノードへ選択を移す。既存 edge は種別を問わず1本も破棄せず、単に表示をまとめるだけ。関連するエッジが0件の時の空状態は「接続しているノードなし」の1つだけ。
  - タイトル・要約・本文のLaTeXは `$...$` / `$$...$$` / `\(...\)` / `\[...\]` をKaTeXで数式表示し、不正な式でも画面全体を壊さない。
- source 以外で外部支持、異議反証、tests が無い時は「記録が手薄」と警告する。誤り判定ではない。**カバレッジ警告はedge (接続しているノード) だけを根拠に判定し、メモの分類 (`memo_type`) を外部根拠・反証・検証の接続がある証拠として数えない。**

## 実装ファイル

| path | 役割 |
|---|---|
| `src/lib/bzm-theory-store.ts` | DB-only load、入力検証、mutation。障害時は `unavailable` |
| `src/app/api/bzm/theory-map/route.ts` | 認証付き read/write API |
| `src/app/(app)/bzm/map/page.tsx` | map data と admin 権限を並列取得する Server Component |
| `src/components/bzm/BzmTheoryMapView.tsx` | map/list、空白クリック、通常クリック編集、Cmd二点接続、配置ドラッグ、線クリック、選択台帳 |
| `src/components/bzm/BzmTheoryComposerDialog.tsx` | マップ内に浮かぶ新規ノード・メモ追加・編集オーバーレイ |
| `src/components/bzm/BzmMarkdown.tsx` | MarkdownとLaTeXの安全な表示 |
| `src/lib/bzm-theory-graph.ts` | ノード/エッジ/メモの型・許可値 (`THEORY_MEMO_TYPES` 等)、履歴Markdown snapshotのparser / graph builder。parser部分はランタイム非使用 |
| `scripts/migrations/203_bzm_theory_editor.sql` | DB schema、RLS、廃止済み21/34 seedの履歴 |
| `scripts/migrations/208_bzm_theory_map_user_authored_reset.sql` | 全edge→全nodeの順で削除し、空台帳へ現在化 |
| `scripts/migrations/214_bzm_theory_node_memos.sql` | `bzm_theory_node_memos` を空で作成。既存ノード・エッジ・利用者データは不変 |
| `scripts/check_bzm_theory_graph.cjs` | Markdown snapshot の独立 validator |
| `scripts/check_bzm_theory_editor.cjs` | migration、権限、mutation、UI anchor の contract test |

## 反映・検証

```bash
cd pwa
python3 -X utf8 scripts/apply_ddl.py scripts/migrations/203_bzm_theory_editor.sql
python3 -X utf8 scripts/apply_ddl.py scripts/migrations/208_bzm_theory_map_user_authored_reset.sql
python3 -X utf8 scripts/apply_ddl.py scripts/migrations/214_bzm_theory_node_memos.sql
python3 -X utf8 scripts/dump_schema.py
npm run test:bzm-theory-graph
npm run test:bzm-theory-editor
npm run test:critical-ui
npx tsc --noEmit
npm run build
```

本番確認では保存・接続・削除・メモ追加を実行せず、確認前後で既存ノード数 / 関係数 / メモ件数が変わっていないことを確認する。desktop / mobile で空白クリック→クリック座標への保存前下書き即時生成 (Canvas描画1件だけ、`data-bzm-draft-node` などの重複HTMLマーカーが無いこと) ＋マップ内オーバーレイ1件を確認し、Escapeで破棄する。通常クリック→ノードを覆わない編集オーバーレイ、ドラッグ→配置変更のみ、Cmd二点クリック→確認ボタンなしで仮線を即時表示、エッジ→両端がノード外周で停止、線クリック→非重複削除確認、種類色・外周点線なし・中心略字なし・LaTeX表示・非admin閲覧は、保存を伴わない検証環境または自動テストで確認する。選択ノード台帳は「メモ」と「接続しているノード」の二層に分かれていること (`関連メモ`という語が残っていないこと)、成長操作は「メモを追加」1ボタンで draft node を作らず `create_memo` だけを呼ぶこと、メモ追加後も nodes/edges の件数表示が不変であることをローカル/自動テストで確認する。

## 既知の制約

- 現行 UI はノード削除を持たない。誤記は編集し、反証済み理論は `refuted` で履歴を残す。
- 履歴Markdownのvalidatorは残るが、ランタイムDBとは同期せず自動表示もしない。
- ノード数が大きく増えると力学レイアウトの安定に時間がかかる。探索の正本は検索・一覧も併用する。
- layer の列は視覚的な整理であり、厳密な因果順序を表さない。
