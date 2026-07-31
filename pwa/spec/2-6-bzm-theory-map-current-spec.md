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
| `bzm_theory_nodes` / `bzm_theory_edges` | 唯一の共有ランタイム正本。利用者本人がOS UIから追加・編集・接続解除する |
| migration `208_bzm_theory_map_user_authored_reset.sql` | 既存シードを削除し、0ノード / 0関係の利用者作成台帳へ戻す現在化migration |
| migration `203_bzm_theory_editor.sql` | テーブル・制約・RLSと、廃止済み初期データを含む再構築履歴 |
| `pwa/bzm/theory-graph/*.md` | 旧21ノード / 34関係の検証・復元用履歴資産。ランタイムへ自動読込しない |

DB取得に失敗した場合は空の `unavailable` 結果を返し、画面上部で編集停止を明示する。Markdownや廃止済みシードを自動表示して、利用者本人が書いた地図と混ぜてはならない。

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

## 権限と書き込み境界

- 認証済み AMD メンバーは active ノードと、その active ノード間のエッジを閲覧できる。
- 追加・編集・接続解除は `members.is_admin=true` の管理者だけ。
- API は毎回 `requireMember()` / `requireAdmin()` で認証し、管理クライアントは認可後にだけ生成する。
- RLS でも authenticated read、`is_admin()` write、service role all を二重に強制する。
- 書き込みはユーザーが保存ボタンを押した時だけ。自動保存、通知、外部送信は行わない。

## API

`/api/bzm/theory-map` を使う。

| method | action | body / target |
|---|---|---|
| `GET` | 現在のノードとエッジを読む | member 必須 |
| `POST` | ノード作成 | `{ action: "create_node", node, edge? }`。必要なら1本目の接続も同時要求 |
| `POST` | 既存ノード同士を接続 | `{ action: "create_edge", edge }` |
| `PATCH` | ノード編集 | `{ nodeId, changes }` |
| `DELETE` | エッジ解除 | query `edgeId=<uuid>` |

ノード作成後に1本目のエッジ作成が失敗した場合は、そのリクエストで作ったノードだけを補償削除し、片方だけ残さない。DBの生エラーはサーバーログに限定し、画面には安全な日本語エラーを返す。

## UI / UX

### 全体構造

ヘッダ → 検索・フィルタ → マップ/一覧 → 選択ノード台帳の順。desktop は地図と台帳を並べ、ノードが存在するmobileは可読性の高い一覧を初期表示する。空の台帳はmobileでもマップを表示し、最初のノードを作れる。件数は真偽・確信度ではない。

### 空白からノードを書く

管理者がマップの空いている場所をクリックすると、**マップの内側**に新規ノード作成パネルを重ねる。ヘッダや右台帳に作成ボタンは置かない。

1. 種別を、概念・主張・測定・決定・文献・論点のカードから選ぶ。
2. 見出しと要約を書く。この2項目だけで素早く記録できる。
3. 必要なときだけ詳細を開き、層・状態・本文・文献情報を足す。

文献を選んだ時は文献情報を基本欄に出し、論点を選んだ時は `question / cross-layer / unknown` を初期値にする。

### ノードを育てる

ノード選択時だけマップ下端に小さな操作帯を出す。右側台帳は読み取りへ専念し、編集操作を置かない。

- **根拠**: 新しい文献・証拠ノードから選択ノードへ `supports`。
- **異論**: 新しい文献・証拠ノードから選択ノードへ `challenges`。
- **論点**: 選択ノードから新しい問いノードへ `raises`。
- **編集**: 選択ノードの内容を更新する。

既存ノードを別ノードへドラッグして重ねると、接続先を選択済みのマップ内パネルを開く。relation と方向を選び、保存前に「A —関係→ B」の文章プレビューを必ず出す。エッジをクリックすると、マップ内に確認パネルを出して接続解除できる。作成・接続・削除確認のパネルはbody portalへ出さず、マップ領域の `absolute overlay` とする。背景クリックまたはEscapeで閉じられるが、保存・削除処理中は閉じない。

### 閲覧

- 全文検索: id / title / summary / source_ref。
- filter: layer、status、relation type。relation filter は地図のエッジだけに作用し、台帳から反証等を消さない。
- map: kind を形、status を色、接続本数を半径、layer を横方向の帯で表す。
- list: kind / layer / status / 接続本数を1行で比較する。
- 台帳: summary、source_ref、本文、支持・異議反証・検証・依存上書き・残っている論点・波及先を表示する。
- source 以外で外部支持、異議反証、tests が無い時は「記録が手薄」と警告する。誤り判定ではない。

## 実装ファイル

| path | 役割 |
|---|---|
| `src/lib/bzm-theory-store.ts` | DB-only load、入力検証、mutation。障害時は `unavailable` |
| `src/app/api/bzm/theory-map/route.ts` | 認証付き read/write API |
| `src/app/(app)/bzm/map/page.tsx` | map data と admin 権限を並列取得する Server Component |
| `src/components/bzm/BzmTheoryMapView.tsx` | map/list、空白クリック、ノード重ね合わせ、線クリック、選択台帳 |
| `src/components/bzm/BzmTheoryComposerDialog.tsx` | マップ内の新規・育成・接続・編集panel |
| `src/lib/bzm-theory-graph.ts` | 履歴Markdown snapshotのparser / graph builder。ランタイム非使用 |
| `scripts/migrations/203_bzm_theory_editor.sql` | DB schema、RLS、廃止済み21/34 seedの履歴 |
| `scripts/migrations/208_bzm_theory_map_user_authored_reset.sql` | 全edge→全nodeの順で削除し、空台帳へ現在化 |
| `scripts/check_bzm_theory_graph.cjs` | Markdown snapshot の独立 validator |
| `scripts/check_bzm_theory_editor.cjs` | migration、権限、mutation、UI anchor の contract test |

## 反映・検証

```bash
cd pwa
python3 -X utf8 scripts/apply_ddl.py scripts/migrations/203_bzm_theory_editor.sql
python3 -X utf8 scripts/apply_ddl.py scripts/migrations/208_bzm_theory_map_user_authored_reset.sql
python3 -X utf8 scripts/dump_schema.py
npm run test:bzm-theory-graph
npm run test:bzm-theory-editor
npm run test:critical-ui
npx tsc --noEmit
npm run build
```

DB反映後は0ノード / 0関係を確認する。desktop / mobile で空白クリック→マップ内作成、選択ノードの操作帯、ノード重ね合わせ→マップ内接続、線クリック→マップ内削除確認、編集、非admin閲覧を目視する。

## 既知の制約

- 現行 UI はノード削除を持たない。誤記は編集し、反証済み理論は `refuted` で履歴を残す。
- 履歴Markdownのvalidatorは残るが、ランタイムDBとは同期せず自動表示もしない。
- ノード数が大きく増えると力学レイアウトの安定に時間がかかる。探索の正本は検索・一覧も併用する。
- layer の列は視覚的な整理であり、厳密な因果順序を表さない。
