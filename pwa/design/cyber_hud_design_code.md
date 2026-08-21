# Cyber HUD Design Code

AMD OS の cyber dashboard / cockpit 系UIで、次セッションの実装者が同じ罠に落ちないための設計コード。

## Goal

このHUDは「Webサイトを3D空間に置いたようなCSS演出」ではなく、`three.js` 空間そのものに情報パネル、グリッド、レーザー、投影光、奥行き、カメラ操作を配置する。

ユーザー要求の基準は、参考画像のような cyber cockpit / holographic dashboard。単なるカードUIの発光版では足りない。

## Decision Rule

新しい要素を実装する前に、必ず以下で判断する。

### Graphic fidelity rule

このUIのクオリティを落とすグラフィック要素は、主役/脇役を問わずCSSで手を抜かない。

このHUDで「かっこよさ」「サイバー感」「空間感」「高密度なSF感」を落とす可能性がある要素は、実装都合でCSSだけに逃がさず、`three.js` geometry / material / light / shader / SVG asset / generated texture を使って作る。

特に以下は、原則としてCSSのみで作らない。

- HUDフレームの主形状
- KPIインジケーター、リング、メーター、分割バー
- レーザー、投影光、ビーム、粒子、走査線
- 3D空間内で角度・奥行き・接続関係を持つもの
- 参考画像のように、線幅差、切り欠き、目盛り、複数レイヤーの発光が品質を決めるもの

CSSは情報レイアウト、文字、軽いfilter/opacity/transitionに使う。
「CSSでそれっぽくできる」は採用理由にしない。主役かどうかではなく、見た瞬間にWeb部品っぽく安くなるなら採用しない。

発光、レーザー、投影、粒子、空間スキャン、ネオンの輪郭強調などのエフェクトは、原則として `three.js` 側の geometry / material / light / shader / texture で実装する。CSSの `box-shadow` / `drop-shadow` / `filter` は、テキストやHTML情報部品の補助に留め、空間エフェクトの正本にしない。

迷ったら最初に1つだけ高密度な `three.js` / SVG / texture の試作を作り、CSS版と比較する。30分でCSS版が安っぽく見えるなら即捨てる。

### CSS / HTMLでよいもの

- テキスト、数値、ラベル、表、ボタンなどの情報レイアウト
- カード内の文字組み、行間、余白
- 軽いhover brightness、文字のglow、scanline
- accessibility上HTMLで持つべき操作要素

CSS/HTMLは「情報の中身」を担当する。3D空間の物理的な位置合わせは担当させない。

### three.js側で実装するもの

- グリッド、床/空間、奥行きライン
- パネル本体の3D座標、フレーム、外形
- カードとモーダルの空間配置
- レーザー、投影光、ビーム、粒子、走査線
- ネオン発光、bloom的な外光、ホログラム投影面
- カメラ回転・ズーム時にも接続が維持されるもの
- 「角から角へつながる」「このライン上に置く」などワールド座標の正確さが必要なもの

角や線の接続は、同じthree.js座標系で管理する。CSSの見た目サイズから目測で合わせない。

### 画像生成 / テクスチャ化を検討するもの

- 参考画像級に密度の高いSFフレーム
- 量産する複雑なHUD装飾パーツ
- KPIリング、分割バー、メーターなど、細かい切り欠きや目盛りが必要なHUDインジケーター
- 背景都市、サイバー空間、発光素材
- CSS/three.jsのプリミティブで再現すると時間が溶ける装飾

「なんとかHTML/CSSで頑張る」前に、画像生成・テクスチャ・SVGアセット化のほうが速く品質が出るか判断する。

### HUD indicator rule

KPI系のリング、バー、メーター、セグメント表示はCSS gradientで作らない。

CSSの `conic-gradient` / `repeating-linear-gradient` / `clip-path` だけで作ると、参考画像のようなHUD密度には届かず、安っぽいWeb部品になる。

KPIインジケーターは以下の順で実装を検討する。

1. `three.js` geometry / lineSegments: 3D空間で角度・奥行き・接続が必要なもの
2. SVG asset/component: 2D HUDとして細かい線、目盛り、切り欠きを作るもの
3. generated texture / image asset: 参考画像級の装飾密度が必要なもの

HTML/CSSは数値、ラベル、配置補助に留める。HUDの主形状をCSS gradientで粘らない。

## Current Architecture Direction

HUDパネルは `three.js` のmesh/lineを正本にする。

- パネル外形: `three.js` geometry
- パネル座標: `three.js` world/local coordinates
- レーザー始点/終点: パネルgeometryの角座標
- HTML: パネル内の文字・数値だけ

`@react-three/drei` の `Html` は便利だが、CSS boxとthree.js geometryは別物。カメラを回してもレーザーを角に密着させたい場合、`Html` のCSS枠に合わせてはいけない。

## Projection Rule

カード/球体などのPJオブジェクトから詳細モーダルへ投影するときは、以下を守る。

1. 投影元オブジェクトの発光点を three.js 座標で定義する。カードなら上端左右角、球体なら球体中心 + 上方向オフセット。
2. 詳細モーダル下端の左右角を three.js 座標で定義する。
3. 投影ビームの面はこの4点から生成する。
4. レーザー線は左角→左角、右角→右角を直接結ぶ。
5. 光の色は選択中PJの `accent` を使う。
6. 床からの投影台、床円、床起点ビームは使わない。

## Anti-Patterns

- CSSのclip-pathやbox-shadowを3D接続の正本にする。
- CSSのbox-shadow/drop-shadow/filterで、空間内の発光・投影・レーザーを代替する。
- `Html` の幅pxから目測でレーザー終点を合わせる。
- カメラを回すUIなのに、スクリーン座標っぽい見た目合わせで済ませる。
- 参考画像級のHUDフレームをCSS borderだけで再現し続ける。
- KPIリングやバーをCSS gradientだけで作り続ける。
- 「いけそう」で数時間粘る。30分で品質が出なければ、three.js geometry / texture / generated asset へ切り替える。
- 同じ役目のパネルを画面ごとに書き写し、置き場所に合わせて padding / font-size / 装飾を一段ずつ刻み直す。

## Shared panel kits

同じ役目のUIを2画面以上に置くときは、**先に共通キットを作ってから両方がそれをimportする**。
片方をコピーして寸法だけ調整する運用を禁じる。置き場所ごとに数値がズレて、まさが画面を見た瞬間に気づく差になる。

| キット | 実装 | 使う場面 |
|---|---|---|
| 数式パネル | [`src/components/formula/FormulaPanelKit.tsx`](../src/components/formula/FormulaPanelKit.tsx) | 数式 + パラメータ実値 + 出典を出すパネル全部。`FormulaPanelShell` / `FormulaBlock` / `MeaningChip` / `FormulaLine` / `ParamRow` / `Citation` |

数式パネルキットの規律:

- 外枠・HUDフレーム(SVG)・背景ドット・グリッド・KaTeX発光は `FormulaPanelShell` が持つ。呼び出し側は `title` / `lead` / `badge` / 中身だけ渡す。
- 呼び出し側で `px-` / `py-` / `text-[Npx]` / 背景gradientを上書きしない。狭い場所に置くからという理由で縮めない (モーダルは `max-w-[1200px]` あり、コックピットのタブより狭くない)。
- 新しい行の型が要るなら、その画面にローカル定義せず**キット側へ足す**。
- 現在の live 利用者は `/seeds` シーズ詳細モーダル (`SpsFormulaPanel`) だけ。`AmdScoreFormulaPanel` もキットに載せてあるが、2026-08-21 時点で route から到達不能 (`AmdScoreView` / `AmdScoreRetrofit` がどこからも import されておらず、`/venture-map/amd-score/retrofit` と `/hud/venture-map/amd-score/retrofit` は redirect のみ)。復活時に寸法が再分岐しないよう、キットに載せたまま critical UI anchor で固定する。
- **適用対象外**: PJコックピット「スコア詳細」タブ (`CockpitAmdScoreDetailTab` → `CurrentSpsAssessmentCard` / `Bzm22ProvisionalObservatory`)。あちらは `text-[9px]` 級の台帳向け密度重視レイアウトで、HUD 数式パネルとは役目が違う。密度側を HUD 寸法へ引き上げると1画面に載る根拠量が落ちる。

事故 (2026-08-21): `SpsFormulaPanel` を `AmdScoreFormulaPanel` から書き写して作った際、HUDのSVGコーナーフレームを省き、padding / 見出し / KaTeX / ラベル幅を一段ずつ縮小した。
まさが本番画面で「なんでここだけデザインコード変えたの?」と即座に指摘。SVG省略はこのファイルの Graphic fidelity rule 違反でもあった。共通キット化で再発を止めた。

事故の後日訂正 (2026-08-21 同日): 「コックピットのスコア詳細タブと寸法を揃えた」と説明したが、比較対象にした `AmdScoreFormulaPanel` は既に route から到達不能だった。
揃えるべき根拠は「今どこかの画面で見えている寸法」ではなく、このファイル (HUD デザインコード正本) 側にある。生きている画面と突き合わせただけで正本を読まないと、退役済みの見た目を新しい正解として固定してしまう。

## Design Signature

- AMDカラー: cyan blue, deep blue, graphite gray, white glow
- PJごとのaccent: cyan / green / amber / blue / yellow / violet
- 空間: X-Y平面に奥へ伸びるgrid、各パネルはX-Z平面に立つ
- パネル: 半透明のガラス面 + neon edge + chamfered cyber frame
- Motion: click -> two pulses -> PJ-colored beam -> cockpit projection
- 操作: OrbitControlsでぐりぐり回しても、パネルとレーザーが同じ空間に固定される

## HUD Client Visual Language

実用HUD Client (`/hud/*`) の全体テイストは [hud_visual_language.md](hud_visual_language.md) を正本にする。

このファイルは主に `three.js` / 3D HUD / CSS禁止ラインの設計コード。
`hud_visual_language.md` は、ダッシュボード・Atlas・Seeds・VC・Notifications・Cockpitなど `/hud` 全体を同じ見た目へ揃えるための視覚言語。

特に以下は `hud_visual_language.md` を優先する。

- cyan control center の通常mode
- red threat console のalert mode
- dotted circuit grid / stepped frame / segmented KPI の反復
- 画像生成すべき部位と、動的UIとして実装すべき部位の切り分け
- HUD quality gate
