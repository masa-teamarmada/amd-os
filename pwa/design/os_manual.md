# AMD OS 全体マニュアル 設計議論 (#23)

> **状態**: 2026-05-25 実装済み。`pwa/manual/*.md` を正本にし、`/manual` route で表示。2026-05-29 に全文検索と `/manual` 限定 Gemini 版つくよみ Q&A フロートを追加。章構成は「まず使う人向け」と「全体設計・細かい仕様」の 2 セクションへ整理済み。
>
> 関連: [`ui_hint_tooltip.md`](ui_hint_tooltip.md) (= 個別 UI ヒント)

---

## 背景

まさが指摘:

> OS 全体のマニュアルも作りたい。
> これは大きなコンテンツになるので、トップのナビゲーターの立替の右あたりに入れるようにしたい。

UI ヒント ([`ui_hint_tooltip.md`](ui_hint_tooltip.md)) は「個別 UI 要素の使い方」、マニュアルは「OS 全体の機能体系・運用フロー・設計思想」を扱う。両者は対象スケールが違う。

## 配置 (= まさ確定)

左サイドナビ:

```
AMD OSロゴ(ダッシュボード)
動かす: ボード | AMD Protocol | Atlas | Knowledge | 名刺
探索: Scholar | Venture Map | 研究機関 | Seeds | VC
自分: マイページ | 通知 | 立替
Admin: Admin | Management | 設計書
資料: 教科書 | マニュアル
```

`ダッシュボードに戻る` の独立リンクは置かず、AMD OSロゴをダッシュボード入口にする。`Management` はトップ階層から外し、Admin セクションから `/management-score` へ入る。横幅が狭い時はラベルを畳み、アイコン rail として表示する。

## 現行の章立て (= 2026-05-27 refactor で確定)

`pwa/src/app/(app)/manual/manual-chapters.ts` が表示順の正本。 **ファイル名 prefix = section-chapter 番号** で完全一致 (= 例: `7-1-reward-calc-spec.md` → 7 章 1 節)。 2026-05-27 まさ確定の refactor で audience 概念を廃止し、 全章を全 user に見せる単一マニュアルにした。

### section 1: 入口

```text
1-1 AMD OS とは
```

### section 2: まず使う人向け

```text
2-1 はじめて使う人向け
2-2 メンバーの日常ワークフロー
2-3 PJ コックピットの見方
2-4 AMD 全体コックピットの見方
2-5 探索系アセットの使い方
2-6 月次カード / admin請求早見表
2-8 名刺をPJの関係資産にする
```

### section 3: OS の基本構造

```text
3-1 全体設計
3-2 データと抽出
3-3 通知・修正依頼・正本反映ゲート
```

### section 4: 経営判断エンジン

```text
4-1 判断エンジン overview
4-2 Atlas / Macrotrend 詳細仕様
4-3 AMD Score 詳細仕様
4-4 FRL / HRL / 関連メンバー詳細仕様
4-5 AMD Management Score / Finance Simulation
4-6 卒業フェーズ検出
4-7 Venture Status / Narrative / PL / XRL
4-8 MS Progress / Monthly Report / Revision Loop
4-9 研究機関 ERS (機関エコシステム整備度)
```

### section 5: 外部探索・事業アセット

```text
5-1 Seeds / VC / Scholar 詳細仕様
5-2 HUD / Venture Map 仕様
```

### section 6: Admin / Finance / 月次オペ

```text
6-1 Operations Settings
6-2 Admin Projects / Members 台帳
6-3 請求書発行 / 月次サイクル
6-4 Finance / Payment Confirm
6-5 Admin Payouts / 支払通知書
6-6 Member Ops / 請求書発行 / Prompt
6-7 契約管理
6-8 Admin / MS Overview (= 全PJ MS 設計一望、2026-06-21 新設)
```

### section 7: 報酬・契約 (= 2026-05-27 新設)

```text
7-1 報酬計算ロジック 詳細仕様
```

- `gas-main/059_RewardV2_Ops.js` (= `rv2_calcRewardSummary`) の計算式・入力データ・進捗ソース優先度・月次キャップ・繰越制御を明文化
- 報酬実装を触るとき (= GAS 059 / 058 / 043 を変更したとき) はこの章を同 commit で更新する
- 既存の 6-5 (admin/payouts) / 6-6 (mypage) はあくまで「画面側の仕様」、 計算正本は 7-1 に集約

### section 8: Knowledge / Automation

```text
8-1 Knowledge Admin / Tsukuyomi
8-2 通知レビュー UI / 経営ハイライト確認
8-3 L2 Extraction Routines
```

### section 9: 開発者・履歴

```text
9-1 過去判断と経緯
9-2 開発者向け
9-3 附則（変更履歴）
```

### 2026-05-27 refactor のポイント

- 旧体系: ファイル名は `00-`, `01-`, ... `40-` の歴史的順序 (= flat 番号)、 表示章番号は `applyManualBookNumbering()` で section-chapter 形式に動的計算。 audience (= user / developer) で章が visible filter されて番号がズレる問題があった。
- 新体系: **ファイル名 = section-chapter 番号** に統一 (= 例: `7-1-reward-calc-spec.md`)。 audience 概念を廃止して全章を全 user に見せる。 動的計算は MANUAL_SECTIONS の順序通りに振るだけ (= 常に slug prefix と一致)。
- 旧スラッグから新スラッグへの全 cross-link は同 commit で更新済み。

## 初期設計案の履歴

### 案 1: 機能別 (= 横断的) 章立て

```
1. はじめに (AMD OS とは / 5 生データ / M/W/D/H L2)
2. PJ コックピット
   2.1 PJ Status (AMD Score + XRL)
   2.2 MS 進捗管理
   2.3 経営・事業シグナル (D-6)
   2.4 月次カード / admin請求
   2.5 MTG サマリ + 議事録
3. AMD 会社全体 (p00)
   3.1 Management Score
   3.2 まさえいMTG (経営判断 dialogue)
4. Admin オペ
   4.1 admin/payouts (報酬支払)
   4.2 admin/projects (PJ 台帳)
   4.3 admin/members (メンバー台帳)
   4.4 admin/invoices (請求書発行)
5. つくよみ (LLM 抽出)
   5.1 M/W/D/H L2の抽出フロー
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
A. 月次カードで確認すること / admin が請求でやること
B. admin が月次でやること (= 請求書発行 / 支払通知 / 入金確認)
C. CEO/CTO が経営判断するときの流れ (= まさえいMTG + D-6 candidate)
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
   - 月次カードで状態を確認し、請求・支払は admin 側で処理する
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

## handoff 時の追記ゲート (= 2026-05-27)

handoff は、実装した新仕様が OS マニュアルへ落ちたか確認する最後のゲートにする。Codex の handoff skill / Claude 側の handoff どちらでも同じ。

ルール:
- 新たな route / 画面 / UI 導線 / API / cron / routine / automation / DB 状態 / 運用ルールを実装したら、該当する `pwa/manual/*.md` にユーザー/開発者向けの説明を追記する
- 詳細仕様は `pwa/design/*.md` や `FEATURE_REGISTRY.md` に置き、マニュアルには「使う人・次に触る開発者が迷わない要約」を置く
- 章対応は `pwa/src/app/(app)/manual/manual-chapters.ts` を見る。新章を作る場合は、本文 md と `manual-chapters.ts` とこの `os_manual.md` を同時に更新する
- 純粋な refactor / typo / test only などマニュアル対象外の場合は、handoff の棚卸し表で `対象外: 理由` を明記する
- `HANDOFF_pwa_rebuild.md` だけに恒久仕様を書いて閉じない

### マニュアル本文の品質ルール (= 2026-05-29 追加)

まさ指摘: 3-2 で `生データ` や `L2` が説明なしに出ており、全体として設計ログの切り貼りになっている箇所がある。今後の manual 更新では以下を必須にする。

- 章冒頭に、読む人・使う場面・その章の結論を置く
- 初出の内部語はその場で短く説明する
- `生データ` / `L2` / `正本` / `source_cache` / `outbox` / `LaunchAgent` / `routine` / `automation` / `candidate` / `confirmed` は、1-1 共通用語または 3-2 用語表へリンクする
- 表だけで説明を終えず、表の前後に「何を見る表か」「どう判断する表か」を書く
- 古い writer・停止済み cron・復旧予定は、現行の primary writer と混ぜずに分ける
- 設計 md の詳細を貼るだけで閉じず、マニュアル単体で最低限読める説明に変換する

## 検索 / 横断機能

- **検索バー**: 2026-05-29 実装済み。`manual-data.ts` が `pwa/manual/*.md` から `ManualSearchDocument` を作り、`ManualMapClient` の左カラム検索で章タイトル / summary / 見出し / 本文 / 画面パス / テーブル名を横断検索する。「請求額確定」「MS 期間設定」等で該当章へ遷移できる。追加 dependency は使わず、`manual-search.ts` の軽量スコアリングで処理する。
- **つくよみ Manual Q&A**: 2026-05-29 実験実装。`/manual` と `/manual/[slug]` だけに `ManualTsukuyomiFloat` を表示し、`POST /api/manual/tsukuyomi/ask` が `GEMINI_API_KEY` + `gemini-2.5-flash` で該当章のマニュアル本文を根拠に回答する。既存 global Tsukuyomi mascot は復活させない。DB 書き込み・修正 tool は持たず、回答と「ここ見たらOK」の参照章リンクだけ返す。回答文体はつくよみキャラとして敬語禁止、高校生にも分かる噛み砕き優先。
- **「最近変わったこと」セクション**: 直近 1 週間で md が変わった章をリスト
- **「関連章」自動リンク**: 章末尾に Sonnet が「この章を読んだあなたへの推奨章」生成
- **コックピットからの誘導**: `Hint` クリック → 該当マニュアル章にジャンプ (= `ui_hint_tooltip.md` 案 D との接続)

## 初期コンテンツ (= まず何を書くか)

優先度:

1. **PJ コックピット**: PM が日常的に開くので。MS 進捗 / 月次カード / 経営・事業シグナル / MTG サマリの 4 セクション
2. **M/W/D/H L2**: AMD OS の中核データ正本 (= `pwa/design/L2_DATA.md` を読み手向けに書き直し)
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
- [`L2_DATA.md`](L2_DATA.md) — L2 中核データ正本 (= マニュアル「M/W/D/H L2」章の元データ)
