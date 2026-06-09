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

主役かどうかではなく、このUIのクオリティを落とすグラフィック要素はCSSで手を抜かない。
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

発光、投影、レーザー、粒子、空間スキャンなどのエフェクトは `three.js` 側で作る。CSSのshadow/filterはHTMLテキストや情報表示の補助であり、空間エフェクトの正本にしない。

## Requested Data

まさから明示的に要望があった項目。

- 各PJオブジェクト (現行モックでは X/F/M 空間上の3D発光球体)
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

- X/F/M 空間: 各PJを `x` / `f` / `m` のスコアに従って3D発光球体として配置
- X-Y床面: Studio Core / 全体KPI / AMD Value Proof
- 右奥: Members / Expertise map
- 手前: 今すぐ見るべき alerts / next actions
- 上空: 累計成果、調達額、スコア改善などの成果指標
- クリック時: PJ cockpit / member cockpit / finance cockpit を投影

## Current 3D Lab Implementation

現行モックは `src/components/dashboard/Cyber3DLab.tsx`。

- route: `/mock/dashboard-cyber-3d-lab` (公開確認用)
- route: `/dashboard-cyber-3d-lab` (認証付き実環境)
- PJ表示: カードではなく `x/f/m` mock score から three.js world coordinate に変換した発光球体
- 軸: world `x` = X、world `y` = F、world `z` = M
- KPI: `Studio Core KPI` / `AMD Value Proof` はX-Y平面に倒した床面HUD
- クリック: 球体を選択 → 2回パルス → 球体上方にPJ cockpitを投影
- 重要: 発光、球体、リング、投影面、レーザーは three.js 側を正本にする。HTML/CSSはラベル・数値・読み物の補助。

## Glass Cube Dashboard Variant

旧第2案は `src/components/dashboard/CyberGlassCubeDashboard.tsx`。

まさレビューで「glass cubeが全然ダメ」「3D感は欲しいが、glass cubeのような物体中心にするとカオス」と判断したため、Glass Cubeは廃案比較用として残す。今後の第2案正本候補にはしない。

- route: `/mock/dashboard-cyber-glass-cube` (公開確認用)
- route: `/dashboard-cyber-glass-cube` (認証付き実環境)
- PJ表示: 中央の浮遊ガラスキューブ群。PJ code / PJ名 / XFM指標はHTML/CSSラベルではなく、CanvasTextureに焼いてキューブ表面へ貼る。
- 空間: 参考画像のような青系holographic chamber。全面グリッドは置かず、床面の円形HUD・放射線・スキャンリングをthree.js geometryでX-Y平面に配置する。
- KPI: 左側に `Studio Core KPI`、右側に `AMD Value Proof`。HUDフレーム/リング/線はthree.js geometry、数値・背景HUDはCanvasTexture。CSSでオブジェクトを作らない。
- 既存XFM球体案は壊さず、別component / 別routeで比較できるようにする。

### Reference Image Object Breakdown

床面の円形HUDは、以下のオブジェクトとして作る。単に同心円や全面グリッドを増やさない。

- 中心核: 白に近い強い発光点 + シアンのハロー。全リングの中心と必ず一致させる。
- 中心周辺リング: 細いリング数本。密度は中心寄りに寄せる。
- 主リング: 太めの分割アーク2-3層。完全な円ではなく、途中で切れたセグメント。
- 接続ライン: 全周の大量放射線ではなく、少数の回路ライン。内側リングから外側へ接続する。
- 発光ノード: 接続ラインの曲がり角/先端に小さな強発光点を置く。
- 見え方: X-Y床面に寝かせ、カメラ視点では楕円に見える。中心ズレは禁止。

## HUD Tactical Wall Variant

第2案の作り直しは `src/components/dashboard/CyberHudWallDashboard.tsx`。

- route: `/mock/dashboard-cyber-hud-wall` (公開確認用)
- route: `/dashboard-cyber-hud-wall` (認証付き実環境)
- 視点: 固定カメラ。ユーザーにOrbitControlsで空間を回させない。
- 3D感: カメラではなく、HUDレイヤーの奥行きとパネルの重なりで出す。カード本体をふわふわ動かすとHUD感が下がるため、PJ/KPIカードは固定する。
- PJ表示: キューブではなく、各PJを高密度HUDモジュールとして配置。PJ code / PJ名 / XFM指標 / status / next action / progressをCanvasTextureに焼き、three.js plane + line frame + progress railで表示する。
- PJフレーム: 外側に別の細い線フレームを重ねない。CanvasTexture内の太い水色発光ラインを主役にし、AMD corporate siteのライン表現のように厚み・白い芯線・発光を持たせる。
- 背景線: 横ラインを雑に全面へ敷かない。パネル形状でclipし、枠からはみ出させない。
- KPI表示: `Studio Core KPI` / `AMD Value Proof` を左右に配置。回転するだけのリングは禁止。3枚目参考画像のような、静的な分割リング + segmented load bar + 数値を組み合わせたHUDインジケーターにする。
- 中央表示: 意味の薄いレーダーではなく、選択PJの `INPUT SIGNAL -> AMD INTERVENTION -> VALUE PROOF` を示す `VALUE CONVERSION CORE` を置く。
- PJ選択: 別ページへ遷移しない。PJカードクリックで同じ3D空間内に `PJ Cockpit Spatial View` を展開し、既存PJコックピットの内容を `PJ Status` / `MS & Goals` / `Monthly` / `Actions` / `Routine` に分解して配置する。
- Focus表示: PJ Focus中は全体KPI/Alert系のグローバルHUDを退避し、背面PJカードはdimする。前景のPJ cockpitカード群の背後にはthree.js遮蔽プレートを置き、重なった情報を沈める。CSS blur/filterでHUDオブジェクトを作らない。
- Focus表示の遮蔽: Focus/dockパネルは加算合成だけで貼らない。黒い面が遮蔽にならず背面文字が透けるため、前景cockpitのTexturePanelはNormal blendingを使う。
- Focusフレーム: 外付けbox/lineを適当につなぐだけにしない。パネルのCanvasTexture内に厚い外周グロー、白芯線、接点プレート、内側回路レール、下部接続レールを一体描画し、枠と背景HUDが無関係に見えないようにする。
- Focus dock interaction: `PJ STATUS` / `MS & GOALS` / `MONTHLY` / `ACTIONS` / `ROUTINE` はクリック可能にし、中央のPJ Cockpit Spatial Viewの内容を同一空間内で切り替える。
- Atlas: 各PJごとのAtlasは作らない。AtlasはAMD OS全体の外部環境・判断地図であり、PJ Focus内の主コンテンツにはしない。PJ文脈でAtlasを見る導線を入れる場合は、既存cockpit設計への追加として別途議論する。
- 空間構造: 手前レイヤーにステータス/アラート、中央レイヤーにPJモジュール群、奥レイヤーにKPI/Proof、背景に生成CanvasTextureのHUD回路。参考画像の「HUDパーツが密に並ぶ」印象を優先する。
- 禁止: CSSでHUDオブジェクトを作らない。CSSはcanvasのページ土台だけ。HUDフレーム、ゲージ、レール、発光、動きはthree.js / CanvasTexture側を正本にする。

### PJ Cockpit HUD Mock Continuation (2026-05-17)

PJ cockpit は dashboard HUD と見た目が乖離しているため、実装前に画像生成モックを正本候補として作る。
初回生成画像は `pwa/design/assets/hud_cockpit_generated_mock_20260517.png`。雰囲気はまさOK。ただし現行cockpitのコンテンツが欠けているため、次回は下記をすべて入れたうえで再生成する。

現行cockpitに存在するコンテンツ:

- Project Header: PJ ID、PJ名、client、status、CONFIG。
- PJ Status / Venture Status: SU系PJのAMD Score状態、PRS primary、legacy M/X/F comparison、trend、status。
- Milestone Matrix: current plan cycle、Annual Goals、Routine Ops、Buffer、各MSのpt/担当/share/role/taskDescription/期間/サブアイテム。
- Next Period Setup: MS未設定warning、期間終了warning、次期MS設定/編集。
- Past MS Periods: 過去plan cycle折りたたみ、展開時のMilestone Matrix。
- Task Control / Kanban: Pending/TODO/Doing/Done、task title、assignee、priority、紐付きMS、drag/drop、task detail modal。
- Monthly List: ym、会議/報告/請求/入金badge、review dot、請求額、MS進捗率、MS別progress展開。
- Freeze Backfill / Meeting Summary。
- Right Column: 凍結/再開badge、月次ルーティン、PM lock、Nudge。
- Monthly Modal:
  - 進捗確認: plan info、5指標、未確認つくよみ推定、AI再推定、Edit、一括保存、MS加重平均、MS別進捗、この月の仕事、revision、報酬予定、メンバー報酬、進捗イベント、月次ノート、立替精算。
  - レポート: draft/fixed、生成/再生成、修正指示、FIX、PDF disabled、Markdown/plain表示、本文。
  - 請求書: client/契約、freee warning、件名、請求日/支払期限、明細編集、調整行、立替精算toggle、合計、備考、freee発行。

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

## HUD Project Signal Board Current Rules (2026-05-19)

`/hud/dashboard` の Project Signal Board は、生成PNG frameを背景にし、その上にReact overlayでlive dataを置く。

- 左から `PJ abbreviation frame`、`M/X/F bars`、`AMD score trend + AMD SCORE`、`先手力 ring + PL/PM/Closer` のzoneとして扱う。
- PJ row内の縦区切り線は、生成frame画像に既に含まれる線を優先する。DOMで追加線を重ねると二重/四重線に見えるため、原則追加しない。
- M/X/F barsは、全PJの最大値の約1.2倍をscale maxにし、数値は小数なしで表示する。
- Sparkline SVGは横幅可変にするため `preserveAspectRatio="none"` を必ず指定する。
- AMD SCOREは折れ線graphと同じzone内の右側に置き、右側に余白を抱えた巨大objectにしない。
- NO SCORE fallbackは、M/X/F bars + trend/score zoneの合計幅に収める。右端の先手力/PL/PM/Closer zoneまでは占有しない。
- 右端zoneは、先手力ringと `PL:` / `PM:` / `CLOSER:` を均等に置き、右端に張り付かせない。2026-05-21時点では、ringをrole labelsの左へ寄せ、score zoneとの間に空白が残りすぎないようにする。role labelsは9px級まで上げ、PL/PM/Closerが視認できる幅を確保する。
- board本体の表示対象は `active` + `ended`。`ended` は終了PJとして歴史的な signal / AMD SCORE を参照したいので折りたたみへ落とさない。`active` と `ended` を混ぜて AMD SCORE 降順で表示する。
- `sales` / `draft` / `frozen` / `lost` / unknown は `Other Project Files` の折りたたみに入れる。

このrowは画像frame座標とlive overlay座標のズレが起きやすい。修正時はdesktop幅だけで判断せず、ブラウザ幅を変えながら、各zoneの余白・重なり・NO SCORE幅を実測確認する。
