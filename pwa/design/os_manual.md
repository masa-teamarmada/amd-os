# AMD OS 全体マニュアル 設計議論 (#23)

> **状態**: 2026-05-25 実装済み。`pwa/manual/*.md` を正本にし、`/manual` route で表示。左上は本の目次型の全体目次、左下はカテゴリメニュー、右側は `/manual` なら本の目次型のセクション別目次、`/manual/{slug}` なら本文を表示する。2026-05-25 追加で、デフォルトをユーザー向け、`?audience=developer` を開発者向けに分離。大きい操作型マップは一度実装したが、感覚的に理解しにくいため現行 UI では非表示。
>
> 関連: [`ui_hint_tooltip.md`](ui_hint_tooltip.md) (= 個別 UI ヒント)

---

## 背景

要望:

> OS 全体のマニュアルも作りたい。
> これは大きなコンテンツになるので、トップのナビゲーターの立替の右あたりに入れるようにしたい。

UI ヒント ([`ui_hint_tooltip.md`](ui_hint_tooltip.md)) は「個別 UI 要素の使い方」、マニュアルは「OS 全体の機能体系・運用フロー・設計思想」を扱う。両者は対象スケールが違う。

## 配置

トップナビ:

```
ダッシュボード | AMD Protocol | Atlas | Scholar | Venture Map | Management | Seeds | VC | マイページ | Admin | 立替 | [📖 マニュアル] | アカウント
```

`立替` の右隣に `📖 マニュアル` (or `❓ Help` / `📚 Docs`) を追加。

## 現行 UX (= 2026-05-25)

`pwa/src/app/(app)/manual/manual-chapters.ts` が章 metadata、topic、section 目次順の正本。

`/manual` の主役は、左側に常時表示する **本の目次型の全体目次 + カテゴリメニュー**。全体目次は `MANUAL_SECTIONS -> chapters` の同じツリーを `/manual` と `/manual/{slug}` の両方で表示し、読んでいる最中に章全体の位置を見失わないようにする。

番号体系は、表示対象 audience ごとに `sectionIndex-chapterIndex` で採番する。

- ユーザー向け例: `1-1 AMD OS とは`, `2-1 はじめて使う人向け`, `2-2 メンバーの日常ワークフロー`
- 開発者向け例: 開発者向けの表示章だけで再採番し、`1-1 全体設計`, `1-2 データと抽出` のように並べる
- 本文 H2 は表示時に `chapterNumber-h2Index` へ正規化する。旧 md 内の `10.1` / `4.0` のような古い番号を左上目次や画面表示に出さない

### ユーザー向け / 開発者向けの分離

`ManualChapterConfig.audience` と `ManualTopicNodeConfig.audience` で表示面を分ける。

- `/manual`: ユーザー向け。日常利用、コックピット、月次オペ、スコア/判断ロジック、探索系アセットを読む
- `/manual?audience=developer`: 開発者向け。内部構造、抽出 pipeline、復旧履歴、実装手順、過去判断ログを読む
- 開発者向け章は default のメニュー / 目次 / 全章一覧には出さない
- direct URL で開いた開発者向け章には `開発者向け` badge を表示する
- ユーザー向け本文では個人名や裏事情を出さず、`AMD 経営チーム` / `レビュー担当` / `admin` など役割で書く

### 左固定メニューと色つき目次

topic と section は `ManualTopicColor` を持ち、カテゴリメニュー、テーマ別章カード、セクション見出しに色を反映する。

- `blue`: まず触る
- `cyan`: PJを見る
- `emerald`: 月次オペ
- `violet`: 経営判断
- `amber`: 外部探索
- `teal`: 知識・通知 / 抽出
- `rose`: Admin
- `slate`: OS構造
- `indigo`: 設計・開発

`/manual` は `lg` 以上で `280px + content` の 2 column。左メニューは `sticky top-20` で常時見える。

- `/manual` / `/manual/{slug}` 左上: 本の目次型の全体目次。`1. 入口` / `1-1 AMD OS とは` のように、セクション番号と章番号を縦に並べる。`MANUAL_SECTIONS` のカテゴリをトグルでき、章リンクから各 `/manual/{slug}` へ移動する。どのページに遷移しても同じ目次ツリーを表示する。
- `/manual` 左下: カテゴリメニュー。topic を押すと URL を `?topic={key}` へ同期し、右側の本の目次内でその topic の先頭章へスクロールする。カテゴリ home / 章 card 一覧は置かない。
- `/manual` 右側: 本の目次型の section 別目次と全章一覧を表示する。選択 topic の heading、関連 topic pill、compact 章 card 一覧は置かない。
- 章ページ (`/manual/{slug}`) 左下: カテゴリメニューを表示する。カテゴリを押した場合は元の章本文を残さず `/manual?topic={key}` のカテゴリ表示へ移動する。
- 章ページ (`/manual/{slug}`) 右側: 章本文を先頭表示する。topic home、関連章 card、metadata panel は置かない。
- 本文内 H2/H3/H4 目次は左上の主要ナビにしない。主要ナビは常にマニュアル全体の目次にする。
- マップ形式は現行 UI では非表示。理解補助として再開する場合も、本文・目次の見やすさを落とさないことを優先する。

### テーマ

```text
まず触る
PJを見る
月次オペ
経営判断
外部探索
知識・通知
Admin設定
OSの構造
設計・開発
内部構造
抽出・復旧
運用内部
```

各テーマは以下を持つ。

- `chapterSlugs`: そのテーマで読む候補章
- `relatedTopicKeys`: 次に横移動できるテーマ
- icon: lucide icon key
- color: topic palette key
- audience: `user` or `developer`

### 章ページ側の横移動

章ページの横移動は、左上の全体目次、左下のカテゴリメニュー、下部の prev-next link に集約する。本文前に重複する関連 panel は置かない。

### 目次

`/manual` では、右側本文にもセクション別目次と全章一覧を置く。セクション別目次はカード一覧ではなく、`1. 入口` -> `1-1 AMD OS とは` のような book directory 形式にする。目的は以下。

- 全章へのリンク漏れを防ぐ
- 番号順で探したい admin / 開発者の導線を残す
- metadata 未設定 / 未分類の章を検出しやすくする

## 現行の章立て

### 入口

```text
1. 入口
  1-1 AMD OS とは
```

### まず使う人向け

```text
2. まず使う人向け
  2-1 はじめて使う人向け
  2-2 メンバーの日常ワークフロー
  2-3 PJ コックピットの見方
  2-4 AMD 全体コックピットの見方
  2-5 探索系アセットの使い方
  2-6 月次ルーティン早見表
```

### ユーザー向けの構造・判断

```text
3. OS の基本構造
  3-1 通知・修正依頼・正本反映ゲート
4. 経営判断エンジン
  4-1 判断エンジン overview
  4-2 AMD Score 詳細仕様
```

### 開発者向け詳細仕様

```text
1. OS の基本構造
  1-1 全体設計
  1-2 データと抽出
2. 経営判断エンジン
  2-1 Atlas / Macrotrend 詳細仕様
  2-2 FRL / HRL / 関連メンバー詳細仕様
  2-3 AMD Management Score / Finance Simulation
  2-4 Venture Status / Narrative / PL / XRL
  2-5 MS Progress / Monthly Report / Revision Loop
3. 外部探索・事業アセット
  3-1 Seeds / VC / Scholar 詳細仕様
  3-2 HUD / Venture Map 仕様
4. Admin / Finance / 月次オペ
  4-1 Operations Settings
  4-2 Admin Projects / Members 台帳
  4-3 Invoice / Billing Routine
  4-4 Finance / Payment Confirm
  4-5 Admin Payouts / 支払通知書
  4-6 Member Ops / Billing / Prompt
5. Knowledge / Automation
  5-1 Knowledge Admin / Tsukuyomi
  5-2 通知レビュー UI / 経営ハイライト確認
  5-3 L2 Extraction Routines
6. 開発者・履歴
  6-1 過去判断と経緯
  6-2 開発者向け
```

## 初期設計案の履歴

### 案 1: 機能別 (= 横断的) 章立て

```
1. はじめに (AMD OS とは / 5 生データ / L2 9 種)
2. PJ コックピット
   2.1 PJ Status (AMD Score + XRL)
   2.2 MS 進捗管理
   2.3 経営ハイライト (L2 ⑨)
   2.4 月次ルーティン
   2.5 MTG サマリ + 議事録
3. AMD 会社全体 (p00)
   3.1 Management Score
   3.2 経営判断 dialogue
4. Admin オペ
   4.1 admin/payouts (報酬支払)
   4.2 admin/projects (PJ 台帳)
   4.3 admin/members (メンバー台帳)
   4.4 admin/billing (請求マトリクス)
5. つくよみ (LLM 抽出)
   5.1 L2 9 種の抽出フロー
   5.2 通知と修正依頼
   5.3 学習ループ
6. Atlas (外部マクロシグナル)
7. Venture Map (PJ プロット)
8. Seeds (研究シーズ)
9. VC リスト
10. Scholar (OpenAlex / papers_log)
11. 探索系アセット詳細 (= Seeds / VC / Scholar の DB・inbox・cron route)
12. Atlas / Macrotrend 詳細仕様 (= signals / stories / themes / divergences / cron / API 認証)
13. 開発者向け (= GAS / Supabase / 環境変数 / デプロイ)
```

### 案 2: 業務フロー別 (= ロール別) 章立て

```
A. PM が月次でやること (= 月次ルーティン 6 step)
B. admin が月次でやること (= 請求発行 / 支払通知 / 入金確認)
C. CEO/CTO が経営判断するときの流れ (= 経営判断 dialogue + L2 ⑨ candidate)
D. メンバーが進捗報告するときの流れ (= マイページ + 月次モーダル + ノート)
E. SU の評価をどう設計しているか (= AMD Score / XRL / FRL / Triple Helix)
F. 開発者が機能を追加するときの流れ (= 設計 md → 実装 → critical-ui anchor → deploy)
```

### 案 3: ハイブリッド (= 推し)

`案 1` (機能別) を main にし、各章の冒頭に `案 2` (フロー別) の「誰がいつ使うか」を summary として置く。

```
2. PJ コックピット
   ## 誰がいつ使うか
   - PM が日常的に開く中心画面
   - 月次ルーティンで月初・月末に各 step 触る
   - 経営判断のタイミングで経営ハイライトを採否
   ## 構成
   2.1 PJ Status ...
   ...
```

## データ管理案

### A. 静的 Next.js `(app)/manual/[...slug]` route + `pwa/manual/` 配下に MD ファイル

- 章ごとに 1 MD (= `pwa/manual/02-cockpit/01-pj-status.md`)
- MarkdownView (= 既に存在) でレンダリング
- 検索: フロントエンドで全文検索 (= MiniSearch or FlexSearch)
- 編集: GitHub 上で md を edit + commit + deploy

### B. DB `os_manual_pages` テーブル

- admin / 編集権限者が /admin/manual で章を編集可能
- LLM 経由で章生成・更新も可
- 検索: PostgreSQL full text search
- ただし「マニュアル更新 = deploy なし」

### C. 案 A + B のハイブリッド (= 推し)

- 章本文 (= 設計仕様・運用フロー・解説) は md ファイル (= A) で git 管理
- LLM 生成の「FAQ」「最近変わったこと」セクションは DB (= B) で動的更新
- 議事録 / 設計 md が update されたときに「マニュアル該当章に反映」を LLM が自動 propose する

## 検索 / 横断機能

- **左固定メニュー**:
  - `/manual` と章ページのどちらでも、上に同じ全体目次、下にカテゴリメニューを固定表示する。
  - 全体目次は `MANUAL_SECTIONS -> chapters` のトグルツリー。active 章を含む section は初期展開してよいが、表示する目次ツリー自体はページごとに変えない。
  - 章ページの本文上部には関連章カードを置かない。本文が表示されたことをすぐ分かる状態を優先する。
  - `/manual` では topic と section anchor から関連章へ入る。`?topic=decision` のように URL に選択状態を残す。
- **検索バー**: 「請求額確定」「MS 期間設定」等で章 + 個別 UI hint も検索ヒット
- **「最近変わったこと」セクション**: 直近 1 週間で md が変わった章をリスト
- **コックピットからの誘導**: `Hint` クリック → 該当マニュアル章にジャンプ (= `ui_hint_tooltip.md` 案 D との接続)

## 初期コンテンツ (= まず何を書くか)

優先度:

1. **PJ コックピット**: PM が日常的に開くので。MS 進捗 / 月次ルーティン / 経営ハイライト / MTG サマリの 4 セクション
2. **L2 9 種**: AMD OS の中核データ正本 (= `pwa/design/L2_DATA.md` を読み手向けに書き直し)
3. **経営判断 dialogue 運用**: 対話セッションの使い方 (= `pwa/CLAUDE.md` 末尾を読み手向けに書き直し)
4. **つくよみ修正依頼**: 通知での「はい/いいえ/コメント」の意味 / 学習ループの仕組み
5. **admin/payouts**: 月次支払通知書発行フロー (= `pwa/design/FEATURE_REGISTRY.md` ベース)

## 残設計事項 (= 次セッション)

- データ管理は A/B/C のどれにするか
- 検索エンジン選定 (= MiniSearch / FlexSearch / Postgres FTS)
- 左固定メニューの全体目次と右側本文内 H2/H3 anchor をどこまで同期するか
- 関連 chapter metadata の更新漏れを検出する checker を追加するか

## 関連設計 md

- [`ui_hint_tooltip.md`](ui_hint_tooltip.md) — 個別 UI ヒント
- [`FEATURE_REGISTRY.md`](FEATURE_REGISTRY.md) — 「消してはいけない業務導線」 = マニュアル化必須リスト
- [`SPEC_GOVERNANCE.md`](SPEC_GOVERNANCE.md) — 仕様 md の正本構造 (= マニュアルとの役割分担)
- [`L2_DATA.md`](L2_DATA.md) — L2 中核データ正本 (= マニュアル「L2 9 種」章の元データ)
