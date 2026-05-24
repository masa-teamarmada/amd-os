# AMD OS 全体マニュアル 設計議論 (#23)

> **状態**: 2026-05-25 実装済み。`pwa/manual/*.md` を正本にし、`/manual` route で表示。章構成は「まず使う人向け」と「全体設計・細かい仕様」の 2 セクションへ整理済み。
>
> 関連: [`ui_hint_tooltip.md`](ui_hint_tooltip.md) (= 個別 UI ヒント)

---

## 背景

まさが指摘:

> OS 全体のマニュアルも作りたい。
> これは大きなコンテンツになるので、トップのナビゲーターの立替の右あたりに入れるようにしたい。

UI ヒント ([`ui_hint_tooltip.md`](ui_hint_tooltip.md)) は「個別 UI 要素の使い方」、マニュアルは「OS 全体の機能体系・運用フロー・設計思想」を扱う。両者は対象スケールが違う。

## 配置 (= まさ確定)

トップナビ:

```
ダッシュボード | AMD Protocol | Atlas | Scholar | Venture Map | Management | Seeds | VC | マイページ | Admin | 立替 | [📖 マニュアル] | まさ
```

`立替` の右隣に `📖 マニュアル` (or `❓ Help` / `📚 Docs`) を追加。

## 現行の章立て (= 2026-05-25)

`pwa/src/app/(app)/manual/manual-chapters.ts` が表示順の正本。

### まず使う人向け

```text
00 はじめに
08 はじめて使う人向け
09 探索系アセット
01 PJ コックピット
02 AMD 会社全体
04 admin オペ
```

### 全体設計・細かい仕様

```text
20 全体設計
07 判断エンジン
21 AMD Score 詳細仕様
22 通知・つくよみ
23 HUD / Venture Map 仕様
24 Operations Settings 仕様
03 データと抽出
05 過去判断と経緯
06 開発者向け
```

## 初期設計案の履歴

### 案 1: 機能別 (= 横断的) 章立て

```
1. はじめに (AMD OS とは / 5 生データ / L2 9 種)
2. PJ コックピット
   2.1 PJ Status (AMD Score + XRL)
   2.2 MS 進捗管理
   2.3 経営・事業シグナル (L2 ⑨)
   2.4 月次ルーティン
   2.5 MTG サマリ + 議事録
3. AMD 会社全体 (p00)
   3.1 Management Score
   3.2 まさえいMTG (経営判断 dialogue)
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
10. 開発者向け (= GAS / Supabase / 環境変数 / デプロイ)
```

### 案 2: 業務フロー別 (= ロール別) 章立て

```
A. PM が月次でやること (= 月次ルーティン 6 step)
B. admin が月次でやること (= 請求発行 / 支払通知 / 入金確認)
C. CEO/CTO が経営判断するときの流れ (= まさえいMTG + L2 ⑨ candidate)
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
   - 経営判断のタイミングで経営・事業シグナルを採否
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

- まさ/えいみが /admin/manual で章を編集可能
- LLM 経由で章生成・更新も可
- 検索: PostgreSQL full text search
- ただし「マニュアル更新 = deploy なし」

### C. 案 A + B のハイブリッド (= 推し)

- 章本文 (= 設計仕様・運用フロー・解説) は md ファイル (= A) で git 管理
- LLM 生成の「FAQ」「最近変わったこと」セクションは DB (= B) で動的更新
- まさが議事録 / 設計 md を update したときに「マニュアル該当章に反映」を LLM が自動 propose する

## 検索 / 横断機能

- **検索バー**: 「請求額確定」「MS 期間設定」等で章 + 個別 UI hint も検索ヒット
- **「最近変わったこと」セクション**: 直近 1 週間で md が変わった章をリスト
- **「関連章」自動リンク**: 章末尾に Sonnet が「この章を読んだあなたへの推奨章」生成
- **コックピットからの誘導**: `Hint` クリック → 該当マニュアル章にジャンプ (= `ui_hint_tooltip.md` 案 D との接続)

## 初期コンテンツ (= まず何を書くか)

優先度:

1. **PJ コックピット**: PM が日常的に開くので。MS 進捗 / 月次ルーティン / 経営・事業シグナル / MTG サマリの 4 セクション
2. **L2 9 種**: AMD OS の中核データ正本 (= `pwa/design/L2_DATA.md` を読み手向けに書き直し)
3. **まさえいMTG 運用**: 対話セッションの使い方 (= `pwa/CLAUDE.md` 末尾を読み手向けに書き直し)
4. **つくよみ修正依頼**: 通知での「はい/いいえ/コメント」の意味 / 学習ループの仕組み
5. **admin/payouts**: 月次支払通知書発行フロー (= `pwa/design/FEATURE_REGISTRY.md` ベース)

## 残設計事項 (= 次セッション)

- 案 1/2/3 のどれで章立てするか (= まさ確定)
- データ管理は A/B/C のどれにするか (= まさ確定)
- 初期コンテンツ 5 章の draft 作成 (= まさが書く or LLM が draft → まさレビュー)
- 検索エンジン選定 (= MiniSearch / FlexSearch / Postgres FTS)
- ナビ追加位置の最終確認 (= 立替の右 / 別位置)

## 関連設計 md

- [`ui_hint_tooltip.md`](ui_hint_tooltip.md) — 個別 UI ヒント
- [`FEATURE_REGISTRY.md`](FEATURE_REGISTRY.md) — 「消してはいけない業務導線」 = マニュアル化必須リスト
- [`SPEC_GOVERNANCE.md`](SPEC_GOVERNANCE.md) — 仕様 md の正本構造 (= マニュアルとの役割分担)
- [`L2_DATA.md`](L2_DATA.md) — L2 中核データ正本 (= マニュアル「L2 9 種」章の元データ)
