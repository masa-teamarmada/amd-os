# BZM 2.0 理論マップ 仕様

> **この章は何か**: `/bzm/map` (理論マップ) の確定実装仕様。この画面は BZM 2.0 の主張・概念・測定・決定・外部ソース・未解決問いを、定義・支持・異議・反証・依存・上書き・運用化・検証の8関係で結んだ**論証台帳 / カバレッジ可視化ツール**である。

## これは何ではないか

- **「真理マップ」ではない。** ノードの数、接続数、画面上の位置は真偽判定や確信度のスコアではなく、単に「その主張・概念に、いま何件の記述が接続しているか」という記録の充実度を示すだけ。
- **統合スコアや合成指標を出さない。** SPS・ECR・AMD Score のような個別評価指標とは別物で、理論マップの接続数を経営判断や評価軸の代わりに使わない。
- **自動証明・自動採点ではない。** ノードの `status` (`established` / `conditional` / `design-choice` / `hypothesis` / `refuted` / `unknown`) は人が `pwa/bzm/theory-graph/*.md` の frontmatter に書いた分類であり、画面が自動判定するものではない。
- **個別理論の一般化した器。** この章では SPS・ECR など特定理論を仕様として断定しない。データは `pwa/bzm/theory-graph/*.md` の内容に従い、画面・parser・validator は理論の種類を問わず同じ契約で扱う。

## データモデル: 1 Markdown ファイル = 1 ノード

正本は `pwa/bzm/theory-graph/*.md`。1 ファイルが 1 理論ノードを表す。ファイル名 (拡張子を除く) は frontmatter の `id` と一致させる。

### frontmatter schema

```yaml
---
id: <ファイル名と同じ id>
title: "<ノードの見出し>"
kind: concept | claim | measure | decision | source | question
layer: cross-layer | evidence | diagnosis | prediction | decision | institution | portfolio
status: established | conditional | design-choice | hypothesis | refuted | unknown
summary: "<1〜2文の要約>"
source_ref: "<この主張の一次記述がある BZM Markdown へのパス、必要なら #見出し>"
relations:
  - type: <8関係のいずれか>
    target: <関係先ノードの id>
  - type: ...
    target: ...
---

## 内容

<本文 Markdown。数式・導出・rubric・引用など、このノードの詳細説明>
```

必須スカラーフィールド: `id`, `title`, `kind`, `layer`, `status`, `summary`, `source_ref`。`relations` は 0 件以上。

### node kind (種別)

| kind | 意味 |
|---|---|
| `concept` | 定義・概念 |
| `claim` | 主張・命題・定理 |
| `measure` | 測定・指標・診断式 |
| `decision` | 設計判断・採否決定 |
| `source` | 外部ソース (学術文献・標準・先行研究など) |
| `question` | 未解決の問い |

### node layer (層)

`cross-layer` / `evidence` (根拠層) / `diagnosis` (診断層) / `prediction` (予測層) / `decision` (決定層) / `institution` (制度層) / `portfolio` (ポートフォリオ層)。画面のマップ表示では、この順で列 (x 座標帯) を分けて配置する力学レイアウトを使う。

### node status (状態)

| status | 表示ラベル | 意味 |
|---|---|---|
| `established` | 現行採用・資料存在 | 現行 BZM への採用、または参照資料の存在を確認済み。内容の妥当性確立を一律には意味しない |
| `conditional` | 条件付き | 条件を満たす範囲でのみ成立するとして採用 |
| `design-choice` | 設計選択 | 唯一解ではなく、設計上の選択として採用 |
| `hypothesis` | 仮説 | まだ検証・確定していない仮説 |
| `refuted` | 反証済み | 反例・反証により棄却された (履歴として残す。削除しない) |
| `unknown` | 未解明 | 未解明・未評価 |

`status` は理論の真偽を画面が判定した結果ではなく、`pwa/bzm/theory-graph/*.md` の執筆者が記録した分類。とくに `source + established` は資料の存在確認であって、その資料から導く BZM 固有主張の確立ではない。旧証明が反証された場合も、ノードを消さず `refuted` として残す (`BOOK_DECISIONS.md` D-062 と同じ思想)。

## 8 relation の向きと意味

`relations[].type` は `from` (自ノード) → `to` (`target`) の有向エッジになる。

| type | ラベル | 向きの意味 |
|---|---|---|
| `defines` | 定義する | `from` が `to` を定義・構成する (主に in-repo 一次記述からの接続) |
| `supports` | 支持する | `from` が `to` を裏付ける根拠になる (主に外部ソースからの接続) |
| `challenges` | 異議を唱える | `from` が `to` に疑義を呈するが、棄却までは至らない |
| `refutes` | 反証する | `from` が `to` を反証する |
| `depends_on` | 依存する | `from` が成立するために `to` の成立を前提とする |
| `supersedes` | 上書きする | `from` が `to` を置き換える (旧版・旧定理の履歴保持に使う) |
| `operationalizes` | 運用化する | `from` が `to` を測定・実装可能な形に運用化する |
| `tests` | 検証する | `from` が `to` を検証する (実証・前向き検証など) |

parser (`pwa/src/lib/bzm-theory-graph.ts`) は `kind`/`layer`/`status`/`relation type` を許可リストで検証し、不明な値はパースエラーにする。`source` ノードは `defines` を使わず、内容に応じて `supports` / `challenges` / `refutes` などの証拠関係を使うという運用ルールを `pwa/scripts/check_bzm_theory_graph.cjs` が契約チェックする。外部ソースは案件・理論を「定義」する立場にはないため。

## source_ref

`source_ref` は、このノードの一次記述がある BZM Markdown へのパス文字列 (`#見出し` を含めてよい)。`pwa/bzm/` 配下のファイルを指す in-repo パスを最低 1 つ含む必要があり、`pwa/bzm/` の外へ抜けるパスは許可しない (`check_bzm_theory_graph.cjs` が `path.resolve` で検証)。画面は `source_ref` からファイル名を抜き出し、存在すれば `/bzm/{slug}` (対象 BZM 章ページ) へのリンクを出す。`BzmMarkdown` は安定した見出し id を出力しないため、リンクは章ページを開くだけで、見出しへのフラグメント遷移は行わない。

## 保存場所とディレクトリ契約

| path | 役割 |
|---|---|
| `pwa/bzm/theory-graph/*.md` | 理論ノードの正本。1 ファイル = 1 ノード |
| `pwa/src/lib/bzm-theory-graph.ts` | frontmatter parser + graph builder (`parseTheoryNode`, `buildTheoryGraph`)。外部 YAML 依存なしの狭いスキーマ専用パーサ |
| `pwa/src/app/(app)/bzm/map/page.tsx` | Server Component。`bzm/theory-graph/*.md` を fs で読み、node/edge を構築してクライアント View へ渡す |
| `pwa/src/components/bzm/BzmTheoryMapView.tsx` | Client Component。力学グラフ (map) と一覧 (list) を持つ画面本体 |
| `pwa/scripts/check_bzm_theory_graph.cjs` | on-disk ファイル契約の validator。`src/lib/bzm-theory-graph.ts` と独立実装 (二重に同じ実装を信用しない) |

## parser / validator

- **parser** (`src/lib/bzm-theory-graph.ts`): flat scalar + 1 つの `relations:` リストだけを許すフラットな YAML サブセットを正規表現で読む。frontmatter が `---` で始まらない、必須フィールド欠落、`kind`/`layer`/`status`/relation `type` が許可リスト外、`relations` の `type` に対応する `target` が無い場合は `TheoryGraphParseError` を投げる。`buildTheoryGraph()` は id 重複、存在しない `target` への参照、同一 `(type, target)` の重複関係をエラーにする。
- **validator** (`scripts/check_bzm_theory_graph.cjs`, `npm run test:bzm-theory-graph`): parser のロジックを独立に再実装した上で、追加の on-disk 契約を検査する。
  - ファイル数が最低件数を満たす。
  - frontmatter `id` がファイル名と一致する。
  - `id` の重複がない。
  - `kind`/`layer`/`status`/relation `type` が許可リスト内。
  - `relations` に重複がない。
  - `source_ref` が `pwa/bzm/` 配下の実在ファイルを最低 1 つ指し、ディレクトリを脱出しない。
  - 全ての `relations[].target` が既存ノード id を指す。
  - BZM 2.0 要件が指定するシード内容 (旧定理の反証、P1 条件付き定理の区別など) に対応するノードが存在する。
  - `source` kind ノードが `defines` を使わない。

## 画面 (`/bzm/map`)

### 全体レイアウト

ヘッダ (ノード数・関係数・要約文) → フィルタ/検索バー → メイン (map/list 切替 + 選択ノード詳細) → 凡例、の縦積み。ヘッダ直下に「件数は接続の本数を示すだけで、真偽や確信度を表さない」という注記文を常に表示する。

### フィルタ

- **検索**: id / title / summary / source_ref の部分一致 (大小文字無視)。
- **layer フィルタ**: 7 layer をトグルボタンで on/off。
- **status フィルタ**: 6 status をトグルボタンで on/off。
- **relation フィルタ**: 8 relation type をトグルボタンで on/off。map 上のエッジだけを絞り込む。list のノードと選択ノード台帳は、反証や依存関係の見落としを避けるため relation filter の影響を受けない。
- 「フィルタ解除」ボタンで検索文字列を含む全フィルタを初期状態 (全選択) へ戻す。

### map 表示 (力学グラフ)

- `react-force-graph-2d` を `next/dynamic({ ssr:false })` で読み込む (Canvas 依存のため SSR 不可)。
- ノード形状は `kind` で分ける (概念=円、主張=菱形、測定=正方形、決定=三角形、外部ソース=六角形、未解決問い=点線円)。
- ノード色は `status` で分ける。
- ノード半径はそのノードの接続本数 (次数) に応じて大きくする。
- エッジは `type` で色分けし、`challenges`/`refutes` は太め、`depends_on`/`supersedes` は破線にする。
- `layer` ごとに x 座標帯を分け、同じ layer のノードを y 方向へ分散する独自 d3 force (`createLayerForce`) を適用し、`cross-layer → evidence → diagnosis → prediction → decision → institution → portfolio` の順で列を作る。
- ノードクリックで選択状態にし、右側の選択台帳パネルに詳細を出す。「全体を表示」ボタンで `zoomToFit` する。

### list 表示

- フィルタ通過ノードを、kind/layer/status バッジと接続本数付きの 1 行リストとして表示する。行クリックで選択する。767px 以下では、縮小した Canvas より可読性を優先して list を初期表示する。

### 選択ノードの台帳パネル

選択中ノードについて、以下を表示する。

- kind / status / layer バッジ、title、summary。
- `source_ref` (章ページへのリンクがあれば付与)。
- ノード本文 (`body`) を `<details>` で開閉表示。
- **カバレッジの欠落検知**: `source` kind 以外のノードで、以下のいずれかが無ければ警告リストに出す。
  - 外部ソース (`kind: source`) からの `supports` 系入力接続が無い (「外部ソースによる支持がない」)。
  - `challenges`/`refutes` の入力接続が無い (「異議・反証の接続がない」)。
  - `tests` の接続が無い (「検証 (tests) の接続がない」)。
  この欠落検知は、そのノードが「間違っている」ことを示すものではなく、単に台帳として手薄な箇所を可視化するもの。
- 関係グループ (各グループに件数バッジ付き):
  - 支持・定義・具体化 (入力): `supports`/`defines`/`operationalizes` の入力エッジ。
  - 異議・反証 (入力): `challenges`/`refutes` の入力エッジ。
  - 検証 (tests): 入出力どちらの `tests` エッジも表示。
  - 依存・上書き: `depends_on`/`supersedes` の入出力エッジ。
  - 波及先: このノードが `supports`/`challenges` 系で他ノードへ及ぼす出力エッジ。
  各行をクリックすると、相手ノードを選択して台帳パネルを差し替える。

## 更新手順

1. 新しい理論ノードを追加する場合、`pwa/bzm/theory-graph/` に新しい `.md` ファイルを作る。ファイル名 (拡張子除く) を frontmatter `id` と一致させる。
2. 既存ノードの主張・summary・関係を更新する場合、そのノードの `.md` ファイルを直接編集する。`relations` を追加・削除する際は、相手ノードの id が既存の id と一致していることを確認する。
3. `cd pwa && npm run test:bzm-theory-graph` を実行し、frontmatter・on-disk 契約が通ることを確認する。
4. OS 画面 (`/bzm/map`) を開き、追加・変更したノードが map / list / フィルタで正しく表示され、欠落検知が意図通りかを目視確認する。
5. 理論の追加・変更・削除は `pwa/bzm/9-5-appendix-changelog.md` に append-only で 1 行記録する (実装仕様の同期は `pwa/spec/6-1-appendix-changelog.md`、マニュアルの同期は `pwa/manual/9-3-appendix-changelog.md`)。

## 既知の制約

- parser は外部 YAML ライブラリを使わない自前の狭いスキーマ専用パーサであり、ネストしたマッピングや複数行文字列など、一般的な YAML の記法はサポートしない。
- `BzmMarkdown` が安定した見出し id を持たないため、`source_ref` の `#見出し` 部分は画面のリンク先には反映されず、対象章ページを開くだけになる。
- 画面は読み取り専用。ノードの追加・編集・削除は Markdown ファイルの直接編集でのみ行い、OS 画面からの書き込みは持たない。
- map 表示の力学レイアウトはノード数増加に応じて再計算コストが増える。件数の急増時はレイアウト安定までの時間が伸びる可能性がある。
- `layer` による列分けは視覚的なヒントであり、理論上の依存順序を厳密に表すものではない。
