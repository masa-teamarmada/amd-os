# Cyber HUD Design Code

AMD OS の cyber dashboard / cockpit 系UIで、次セッションの実装者が同じ罠に落ちないための設計コード。

## Goal

このHUDは「Webサイトを3D空間に置いたようなCSS演出」ではなく、`three.js` 空間そのものに情報パネル、グリッド、レーザー、投影光、奥行き、カメラ操作を配置する。

ユーザー要求の基準は、参考画像のような cyber cockpit / holographic dashboard。単なるカードUIの発光版では足りない。

## Decision Rule

新しい要素を実装する前に、必ず以下で判断する。

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
- カメラ回転・ズーム時にも接続が維持されるもの
- 「角から角へつながる」「このライン上に置く」などワールド座標の正確さが必要なもの

角や線の接続は、同じthree.js座標系で管理する。CSSの見た目サイズから目測で合わせない。

### 画像生成 / テクスチャ化を検討するもの

- 参考画像級に密度の高いSFフレーム
- 量産する複雑なHUD装飾パーツ
- 背景都市、サイバー空間、発光素材
- CSS/three.jsのプリミティブで再現すると時間が溶ける装飾

「なんとかHTML/CSSで頑張る」前に、画像生成・テクスチャ・SVGアセット化のほうが速く品質が出るか判断する。

## Current Architecture Direction

HUDパネルは `three.js` のmesh/lineを正本にする。

- パネル外形: `three.js` geometry
- パネル座標: `three.js` world/local coordinates
- レーザー始点/終点: パネルgeometryの角座標
- HTML: パネル内の文字・数値だけ

`@react-three/drei` の `Html` は便利だが、CSS boxとthree.js geometryは別物。カメラを回してもレーザーを角に密着させたい場合、`Html` のCSS枠に合わせてはいけない。

## Projection Rule

カードから詳細モーダルへ投影するときは、以下を守る。

1. カード上端の左右角を three.js 座標で定義する。
2. 詳細モーダル下端の左右角を three.js 座標で定義する。
3. 投影ビームの面はこの4点から生成する。
4. レーザー線は左角→左角、右角→右角を直接結ぶ。
5. 光の色は選択中カードの `accent` を使う。
6. 床からの投影台、床円、床起点ビームは使わない。

## Anti-Patterns

- CSSのclip-pathやbox-shadowを3D接続の正本にする。
- `Html` の幅pxから目測でレーザー終点を合わせる。
- カメラを回すUIなのに、スクリーン座標っぽい見た目合わせで済ませる。
- 参考画像級のHUDフレームをCSS borderだけで再現し続ける。
- 「いけそう」で数時間粘る。30分で品質が出なければ、three.js geometry / texture / generated asset へ切り替える。

## Design Signature

- AMDカラー: cyan blue, deep blue, graphite gray, white glow
- PJごとのaccent: cyan / green / amber / blue / yellow / violet
- 空間: X-Y平面に奥へ伸びるgrid、各パネルはX-Z平面に立つ
- パネル: 半透明のガラス面 + neon edge + chamfered cyber frame
- Motion: click -> two pulses -> card-colored beam -> cockpit projection
- 操作: OrbitControlsでぐりぐり回しても、パネルとレーザーが同じ空間に固定される
