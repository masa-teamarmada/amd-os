# Cyber Dashboard Content Design

AMD OS の cyber dashboard に表示する情報設計メモ。  
この画面は単なるPJ一覧ではなく、AMD Studio全体の状態、価値創出、次に介入すべき場所を一目で掴むための cockpit。

## Core Intent

ダッシュボードで見せたいものは、以下の5つ。

1. いまAMD全体がどれくらい価値を生んでいるか
2. どのPJが伸びているか
3. どこにAMDが介入すべきか
4. 誰が何を動かしているか
5. AMDが入ったことでPJがどう改善したか

## First Implementation Scope

まずは以下の2系統から実装する。

### Studio Core KPI

AMD全体の健康状態を表すメインKPI。

- 現在稼働中PJ数
- 累計PJ数
- 累計調達額
- 累計売上 / 累計請求額
- 平均PJ期間
- active / sales / draft / frozen のPJ分布

### AMD Value Proof

AMDが介入したことでPJがどう変わったかを見せる指標。

- PJ開始時の平均スコア
- PJ終了時の平均スコア
- スコア改善幅の平均
- MS達成率
- 仮説検証サイクル数
- 成果イベント数: 調達、提携、PoC、採択、商談化など

## KPI Visual Treatment

Studio Core KPI と AMD Value Proof はダッシュボードの中心に置く。

このセクションはダッシュボードの主役なので、グラフィックの手を抜かない。  
「CSSでそれっぽいインジケーターを作る」のではなく、`three.js` / SVG / texture を使ってHUD素材として作る。

各数値は単なるカード内テキストではなく、HUD系インジケーターとして表示する。

- ring: スコア、稼働状態、達成率
- segmented bar: 累計数、改善幅、progression
- horizontal load bar: 調達額、パイプライン、売上
- scan meter: 平均期間、サイクル、速度感

KPIパネルは `three.js` のHUDフレーム上に載せ、HTML/CSSは数値表示とインジケーター内部の情報表現に使う。  
空間配置、フレーム、接続レーザーは `pwa/design/cyber_hud_design_code.md` のルールに従う。

ただし、KPIインジケーター本体をCSS gradientだけで作らない。  
リング、バー、目盛り、切り欠き、発光レイヤーは SVG component / generated texture / three.js geometry のいずれかを使う。

CSSで許容するのは、配置、文字、軽いfilter、opacity、transitionまで。  
HUDの形状そのものをCSSで無理に作ると品質が落ちる。

## Requested Data

まさから明示的に要望があった項目。

- 各PJカード
- これまでの累計PJ数
- 累計調達額
- メンバーリスト
- 各メンバーの自己紹介
- PJ開始時の平均スコア
- PJ終了時の平均スコア
- 平均PJ期間

## Additional Recommended Data

### Portfolio

- 領域別分布: robotics, energy, bio/agri, AI, materials など
- ステージ別分布: seed探索、事業化設計、PoC、資金調達、営業、休眠
- リスク分布: 技術 / 市場 / チーム / 資金 / 知財
- 今月伸びたPJ
- 停滞しているPJ
- 直近30日で動きがあったPJ
- 今後30日で重要イベントがあるPJ

### Intervention

- PJごとの現在詰まっている論点
- 次にAMDが動かすべきレバー
- founder確認待ち
- 継続/撤退判断が必要なPJ
- Before Zero 的なまだ形になる前の種

### Members

- メンバーリスト
- 各メンバーの自己紹介
- 担当PJ
- 稼働率 / キャパシティ
- 得意領域タグ
- 今月の貢献ログ
- expertise map: 誰に相談すると早いか

### Capital / Business Development

- 調達候補PJ
- 次に当てるべきVC / 企業 / 大学
- 提案中案件
- 商談パイプライン
- 今月の外部接点数
- 契約・請求・入金ステータス

## Spatial Layout

3D空間では、情報を役割ごとにレイヤー配置する。

- 中央: Studio Core / 全体KPI / AMD Value Proof
- 左奥: PJポートフォリオカード群
- 右奥: Members / Expertise map
- 手前: 今すぐ見るべき alerts / next actions
- 上空: 累計成果、調達額、スコア改善などの成果指標
- クリック時: PJ cockpit / member cockpit / finance cockpit を投影

## Data Implementation Notes

最初はモック値で表示面を作る。  
その後、Supabaseの `projects`, `value_plan_cycles`, `value_milestones`, billing系、member系テーブルから取得する。

将来的には、各KPIに以下を持たせる。

- `label`
- `value`
- `unit`
- `delta`
- `status`
- `sourceTable`
- `lastUpdatedAt`

数値は飾りではなく、AMDが何を改善しているかを証明するために置く。
