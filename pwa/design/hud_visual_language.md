# AMD OS HUD Visual Language

最終更新: 2026-05-15

## Purpose

AMD OS HUD Client 全体の視覚言語を固定する。

ここで定義するのは、単なる「黒背景 + 水色線」のテーマではない。
AMD OS は deeptech studio の経営OSなので、見た目は **startup studio command center** として成立させる。

ユーザーがダッシュボードを開いた瞬間に感じるべきことは以下。

- いま AMD 全体の信号・PJ・資金・月次・外部環境が同じ制御盤に乗っている。
- 情報密度は高いが、どこを見るべきかは明確。
- 通常時は冷静なcyan control center。
- 異常時だけ赤いwarning systemが空間を奪う。
- 装飾ではなく、経営判断のための計器である。

## Reference Direction

### Dashboard Mock

正本reference:

- `design/assets/hud_dashboard_control_center_mock_20260515.png`

この画像は `/hud/dashboard` の実装ターゲット。
完全な背景画像として貼るのではなく、構成・情報密度・frame処理・KPI ring・file stack・alert moduleの視覚基準として使う。

### Normal Mode: Cyan Control Center

参考画像1の方向。

言語化すると、以下の質感。

- dark navy / graphite の深いキャンバス
- 全面に敷かれた微細な dotted circuit grid
- cyan / electric blue の細いが精密なHUD line
- coral / warning pink は小さな差し色として使う
- パネルはカードではなく、制御盤に刻まれた module
- 丸形インジケーター、分割リング、データバー、ファイルタブが同じ平面上で連携する
- 枠線はただのborderではなく、角・接点・切り欠き・厚みを持つ
- 余白は広げすぎない。密度は保つ。ただし重要情報には呼吸できる空間を残す

### Alert Mode: Red Threat Console

参考画像2の方向。

言語化すると、以下の質感。

- black / blood red / hot red の限定palette
- 中央にwarning coreを置く
- 円形リング、左右のbracket frame、細かいtick marksで緊急度を出す
- alertは通常UIの赤いbadgeではなく、別レイヤーの警告装置として表示する
- 背景全体のtemperatureを赤へ寄せ、ユーザーの視線を強制的にalertへ集める
- motionは短く、硬く、機械的。ふわふわは禁止

## Design Signature

AMD OS HUD のsignatureは **Signal Board / Circuit Command Plane**。

全ページを「カードの集合」ではなく、「同じ基板上に刻まれた情報module」として扱う。

具体的には以下を全体に反復する。

1. dotted circuit grid
2. stepped cyan frame
3. module connector line
4. segmented KPI ring / segmented bar
5. small file-tab labels
6. scanline / tick marks
7. alert時だけred command layer

これらがないページは、HUD Clientではなく「暗くしたWeb UI」に見える。

## Palette

### Normal Tokens

| Role | Color | Use |
|---|---|---|
| Void | `#020812` | 最背面。ほぼ黒だが完全な黒にはしない |
| Deep Navy | `#061827` | page base / panel base |
| Control Blue | `#0b2f46` | panel inner glow / selected surface |
| Cyan Line | `#32e7ff` | primary HUD line |
| Cyan Glow | `#7cf8ff` | emphasis edge / active state |
| Data Blue | `#2a9dff` | chart / secondary metric |
| Pale Text | `#e7fbff` | primary text |
| Muted Text | `#8fb9c6` | labels / metadata |
| Coral Signal | `#ff5f7e` | small deltas / warning hints |
| Amber Signal | `#ffd15a` | attention but not failure |

### Alert Tokens

| Role | Color | Use |
|---|---|---|
| Alert Void | `#120000` | alert overlay base |
| Deep Red | `#3a0508` | alert panel base |
| Hot Red | `#ff1d25` | warning ring / icon / critical text |
| Soft Red | `#ff6b76` | secondary red line |
| Alert Text | `#ffe7e7` | alert primary text |

### Color Rule

通常時の主役はcyan。
赤は常時使いすぎない。赤が多いと、本当のalert時に効かなくなる。

PJ別色やAtlasタグ色は維持してよいが、HUD上では以下の処理をかける。

- 彩度を少し抑える
- line / chip / node glow として使う
- large solid fill にはしない
- text colorは必ずdark backgroundで読める淡色へ補正する

## Background System

### 必須要素

HUD背景は以下の3層で作る。

1. **Base gradient**
   - deep navy -> void
   - 左側にcyan、右側にmagenta/coralをほんの少し入れる
2. **Dotted circuit grid**
   - 参考画像1のような微細な点列
   - CSSの粗い四角タイル反復は禁止
   - page全体に敷くが、主張しすぎない
3. **Long circuit traces**
   - horizontal / vertical / stepped line
   - 情報module同士をつなぐ
   - ランダム装飾ではなく、module boundaryやsection flowと対応させる

### 実装方針

- 低密度なgridはCSS backgroundでよい。
- dotted circuit grid / trace pattern はSVGまたはCanvas textureを推奨。
- 参考画像級の背景密度が必要な場合は、画像生成でbase textureを作り、CSSで薄く敷く。
- ただし重要なUI枠・KPI計器・alert coreを背景画像に埋め込まない。操作できる情報部品はcomponentとして分離する。

## Frame System

### Normal Frame

HUD frameはborderではなくmodule chassis。

必須特徴:

- chamfered corners
- stepped edges
- 2段以上のline thickness
- 一部に短いsolid cyan plate
- 細いtick marks
- module title tab
- 内側に薄いscanline

禁止:

- ただの `border: 1px solid cyan`
- 角を線で雑につないだだけのframe
- 背景lineがframeからはみ出る
- 接点処理のない装飾線
- cardを全部同じ四角枠にする

### Frame Tiers

| Tier | Use | Treatment |
|---|---|---|
| Shell Frame | page / dashboard section | 太いcyan line + dotted trace + title rail |
| Module Frame | PJ / KPI / list | stepped cyan frame + small plates |
| Micro Frame | chip / tab / row action | thin line + small notch |
| Alert Frame | critical modal / warning | red bracket + circular warning core |

### SVG vs Generated Image

2026-05-15 dashboard quality pass 以降、frame実装は以下で固定する。

- 実データが乗るframe、クリック領域、状態変化するmoduleは **SVG component** で作る。
- 固定サイズで、文字や状態を含まないdecorative backplate / chassis textureだけ **画像生成** を使ってよい。
- 画像生成で作る場合も、実データの枠線・hit area・hover/focusはSVG/DOM側に残す。

### Frame Wear / Grunge

2026-05-17 dashboard fidelity pass で、フレーム線そのものの「自然なかすれ」をSVG overlayで作ろうとしたが、意図したgrungeではなく画面全体に無数の縦線/横線が増える結果になった。
そのため現時点では **かすれ(grunge)表現は採用しない**。

- 禁止: 画面全体にscratch/wear overlayを重ねてフレームをかすれさせる実装。
- 禁止: 周期的な破線を「かすれ」と呼ぶこと。
- 当面の正解: 細い実線、低opacityの補助線、短い接点plate、控えめなglowでHUD感を出す。
- 次に再挑戦するなら、全画面overlayではなく、各frameのstroke mask/texture単位で検証し、目視確認してから採用する。
- frame画像にPJ名、KPI値、金額、status、button labelを焼き込まない。
- 画像生成の用途は「塗装・微細な基板テクスチャ・非操作の厚み」であって、UI部品の正本ではない。

理由: AMD OS HUDは実用クライアントなので、見た目の密度だけでなく、DBに連動する情報更新、クリック、モーダル、アクセシビリティ、レスポンシブ崩れ耐性を保つ必要がある。
したがって、まずSVGで高品質なchassisを作り、そこに生成画像のtextureを重ねる順序にする。

## Typography

HUD typographyは「可読性のための標準フォント」ではなく、制御盤の質感を作る主要要素。

### Direction

- 数値・英字ラベル: condensed / techno / mono寄り
- 日本語本文: 読みやすいsansを維持。ただしweightとletter spacingでHUDへ寄せる
- 見出し: uppercase English + Japanese support の混在を許す
- 小さすぎる文字は禁止。HUDは密度が高くても読めなければ失敗

### Candidate Fonts

実装候補:

- `Rajdhani` or `Share Tech Mono` for HUD labels / metrics
- `IBM Plex Sans JP` or existing Japanese font for body
- `Geist Mono` if Vercel stackに寄せる場合

フォント導入時は表示性能と日本語fallbackを確認する。

2026-05-15 dashboard quality pass:

- HUD display font: `Rajdhani`
- Japanese fallback: existing Geist / system sans
- 数字・英字ラベル・metric・SVG textはRajdhaniへ寄せる
- 日本語本文は読みやすさを優先し、必要箇所だけfallbackで受ける

### 協議資料の見出し階層

会議前のHTML資料や、複数人で方針を決めるための投影資料では、情報の階層そのものを中立に保つ。

- 表紙の最大見出しは、会議名または資料名のような事実名称にする。
- 各sectionでは、section名をその区画で最も大きい文字にする。英字label、番号、補足文、callout、catch copyをsection名より強く見せない。
- 作成者側の提案、推定着地、結論、評価、日程案をhero、tagline、eyecatch、section titleとして押し出さない。提案は本文または比較表に置き、`案`、`確認事項`、`協議事項`などの状態を明示する。
- 参加者がまだ否定していない選択肢を、打ち消し表現から導入しない。論点と選択肢をそのまま肯定形で記述する。
- section名は内容を指す中立な名詞句にする。例: `8月4日 桑折先生MTG資料`、`KUTEシーズ掘り起こし・エコシステム構築`。
- 投影前提のHTMLは、本文、table、menu、label、button、注記を含むすべての可視文字を16px以上にする。section名は36〜48px、資料番号や比較対象番号は28px以上を基準にする。viewport幅へ連動させず、狭い画面では固定のbreakpointで段階的に調整する。
- 連続型のMTG投影HTMLは、desktopで白背景の左固定menuを維持する。menuにはロゴ、会議名・日付、section anchor、関連資料を別tabで開く操作、meeting memoを置く。
- 左menuには少なくとも `メモをコピー`、`文言編集ON/OFF`、`HTML保存`、`メモ消去` の操作buttonを置き、本文を読みながら会議中の記録と修正が完結するようにする。
- 左menuを黒背景や強い装飾面にせず、白地、薄い境界線、AMD blueのactive表示で本文との視覚階層を保つ。mobileでは上部menuへ組み替え、本文幅を圧迫しない。
- MTG前の提示資料には `合意事項`、`決定事項`、`会議結果`、`担当確定`などの事後記録sectionを置かない。提示資料は論点、比較材料、確認事項、日程案までとし、実際に決まった内容は開催後の議事録へ記録する。
- 提示資料内に `合意 / 修正 / 保留`などの結果入力buttonや結果列を置かない。会議中の結果記録UIが必要な場合も、議事録側または議事録作成flowで扱う。

## Dashboard Direction

ダッシュボードは、参考画像1の「control center」をAMD OSの内容へ置き換える。

### Layout Concept

- 左: AMD全体のoperational ring
  - 全PJ active / frozen / attention
  - 今月のMS flow
  - unread / L2 extraction status
- 中央上: Control Center title rail
  - current month
  - studio operating mode
  - global health
- 中央: PJ signal board
  - PJ cardsではなく、module platesを配置
  - PJごとに X/F/M or MS/KPI状態を小型計器で表示
- 右: File stack / action queue
  - pending next actions
  - routine due
  - alerts
- 下: Infographic strip
  - Atlas trend
  - Seeds / VC pipeline
  - AMD Score movement

### Dashboard Components

| Component | Visual Form | Implementation Direction |
|---|---|---|
| Studio Core KPI | large segmented ring + small numeric bars | SVG or Canvas component |
| PJ Module | stepped cyan frame with status plates | SVG frame + HTML text |
| Monthly Routine | file stack / checklist rail | HTML + SVG frame |
| Atlas Signal | small node strip / pulse map | Canvas / SVG |
| AMD Score | segmented M-X-F graph / radar-like triplet | SVG or Canvas |
| Alert Queue | red mini bracket modules | SVG / component |

## Alert Design

アラートは通常UIの中に小さく埋め込まない。
critical時は参考画像2のように、画面の一部を赤いwarning consoleへ切り替える。

### Alert Levels

| Level | Visual | Example |
|---|---|---|
| Notice | cyan/amber small chip | 未読、軽い更新 |
| Attention | amber rail + pulse tick | 期限近い、要確認 |
| Warning | coral/red module | ルーティン遅延、データ欠損 |
| Critical | full red alert console | DB書き込み失敗、請求重大エラー |

### Critical Modal

critical modalは以下を持つ。

- central warning core
- circular segmented ring
- left/right bracket panels
- action buttonsはred outline / one primary hot red
- 背景はblack-red overlay
- copyは短く、何が危ないかと次の操作だけ

## Motion

HUD motionは「浮遊」ではなく「計器の反応」。

許可:

- scanline sweep
- short pulse
- tick increment
- segmented ring fill
- panel lock-in
- hard blink for alert

禁止:

- ふわふわ上下するカード
- 意味なく回るKPI
- slow decorative drifting circles
- hoverで大きく跳ねる
- ユーザーが作業中に視界を奪う常時animation

## Image Generation Policy

画像生成は使う。ただし、UIの責任を画像に丸投げしない。

### 画像生成すべきもの

1. **Background texture**
   - dotted circuit grid
   - subtle sci-fi console pattern
   - page全体の空気を作る薄いtexture
2. **Decorative chassis asset**
   - dashboard hero frame
   - alert console backplate
   - high-density non-interactive HUD ornament
3. **Alert core texture**
   - red warning ring background
   - critical modalの奥に敷く非操作レイヤー
4. **Prototype reference sheet**
   - 実装前にframe / ring / tab / file stackの見た目を固めるためのstyle sheet

### 画像生成しないもの

- 実データの文字
- ボタンや入力フォーム
- クリック対象
- PJ名、金額、score、status
- テーブルやリスト本体
- 状態によって変わるKPIの値

動的情報はHTML/SVG/Canvasで描画する。
画像生成は「質感と部品の見本」、実UIは「データと操作」を担当する。

## Implementation Stack

| Need | Preferred |
|---|---|
| Page shell background | CSS + SVG/Canvas texture |
| Reusable HUD frames | SVG components |
| KPI rings / segmented meters | SVG or Canvas |
| Dynamic graph | SVG / Canvas / existing chart lib with HUD skin |
| 3D spatial dashboard | three.js |
| Dense decorative plate | generated bitmap texture |
| Alert core | SVG + optional generated texture |

## Quality Gate

実装前・実装後に以下を確認する。

1. これは暗いWebカードではなく、制御盤moduleに見えるか。
2. frameに厚み、切り欠き、接点処理があるか。
3. 背景は四角タイルや雑なline反復に見えないか。
4. 赤は本当にalertだけに効いているか。
5. 文字は読めるか。特に日本語と数値。
6. 動きは計器の反応であり、ふわふわしていないか。
7. 同じ四角枠を量産していないか。
8. 操作できる情報を画像に埋め込んでいないか。
9. 現行PWAと同じ情報・操作・DB書き込みを落としていないか。
10. 一目でAMD OSのcontrol centerだとわかるsignatureがあるか。
