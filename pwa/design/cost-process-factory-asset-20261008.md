# 8工程を含む一枚の工場イラスト

## 動く設備の分離

同日のまさの指摘「点線だけ動いている」への改訂。元の一枚の絵から静止背景と透明な動作部品を組み込み画像生成で作り、同じ1536×1024座標へ重ねる。

- 背景: `public/illustrations/cost-process-factory-background-20261008.png`（生成元 `exec-84563e2a-0d88-48b7-8b3b-b2d930b76341.png`）。
- 動作部品: `public/illustrations/cost-process-factory-moving-parts-20261008.png`（生成元 `exec-791b0527-1eb4-4d54-a23c-7d995bbe92be.png`、RGBA・透明背景）。
- トラック走行、コンベヤー上の容器移動、充填・設置・回収の3本のアーム旋回をCSSで動かす。透明部品の生成時の僅かな位置・サイズのずれはSVGで位置を合わせる。停止・動きを減らす設定は部品の動作にも効く。

### 背景の編集プロンプト

```text
Use case: precise-object-edit. Edit the supplied 1536×1024 factory illustration into the STATIC BACKGROUND LAYER for a mechanical animation. Preserve exactly the canvas size, camera, equipment positions, shared floor, conveyor, pipes, machinery bodies, color palette and every other detail.
Remove ONLY these moving foreground parts and paint the naturally visible background behind them: (A) the entire white delivery truck in the upper-right roadway, approximately x1280..1505 y245..420, preserving the loading bay and road; (B) the yellow filling robot arm above the cartridge conveyor at x840..919 y208..294, preserving its white support frame; also remove the one suspended cartridge around x908 y281 but preserve standing cartridges on the belt; (C) the yellow installation robot arm at x1188..1293 y464..555, preserving the cartridge rack and reactor body; (D) the yellow collection robot arm at x489..590 y581..649, preserving its base pedestal, collection bin and metal workstation. Leave all green cartridges elsewhere intact. The removed moving parts will be overlaid in their exact original positions separately. Do not relocate, scale or redraw the remaining scene, do not add new equipment, do not add text, arrows, effects or any motion trails. Output one opaque image of the full scene with only those removals.
```

### 動作部品の編集プロンプト

```text
Use case: background-extraction. The supplied 1536×1024 factory illustration is the source for a transparent ANIMATION PARTS LAYER. Output a 1536×1024 truly transparent PNG, preserving exact original pixel-space positions, orientation and scale of these five parts ONLY. Everything else must be transparent, including ALL background, floor, pipes, machinery bodies and conveyors. Do not crop tightly, do not center or rearrange parts, preserve the original full canvas coordinates.
Keep (A) the entire existing white delivery truck including cab, cargo body, green loaded cartridges and wheels, approximately x1280..1505 y245..420, not the loading bay or road; (B) the yellow filling robot arm above the conveyor at x840..919 y208..294, not the white frame; (C) the yellow installation robot arm at x1188..1293 y464..555, not the silver reactor or cartridge rack; (D) the yellow collection robot arm at x489..590 y581..649, not its pedestal or surrounding workstation; (E) the one green cylindrical cartridge suspended at approximately x908 y281, original width about22 and height50, separately from the filling arm.
These are cutouts of the ORIGINAL visible objects, not redesigned icons, not a sprite atlas. Preserve their crisp industrial illustration detail, exact shape, light and perspective. Keep the original coordinates so each object can overlay the edited static background perfectly. No shadows on the transparent background, no text, borders or extra objects.
```

2026-10-08。DDの工程サマリで、培養から返送後処理までを一つの連続した場面として使う。

- 生成方法: Codexの組み込み画像生成。参照画像はまさの提示した立体工場イラストで、画風・つながった構成の参考として使用。
- 配置先: `public/illustrations/cost-process-factory-20261008.png`。
- 生成元: `generated_images/01a116ac-d3c6-7c73-a923-481b363eda05/exec-20b41a27-d3a9-4ccf-a489-b5fa56701ba9.png`。
- 一つの画像内に8設備と連続する配管・コンベヤー・配送路を収める。実設備の設計図ではなく工程の模式図。
- ウェブ画面ではこの一枚の上に、細胞増殖・光・CO₂・液体・充填・搬送・装着・処理・回収・洗浄の動きを重ねる。費用は画像に焼き込まず試算の数値を表示する。

## 生成プロンプト

```text
Use case: scientific-educational.
Asset type: one coherent full-scene illustration for an animated wastewater process cost summary.
Primary request: Draw ONE integrated isometric miniature industrial world containing all eight process stations as one connected factory-and-customer operating scene. The supplied image is only a style and composition reference for a continuous industrial production line. This must NOT be a sprite atlas, eight separate icons, eight cards, or eight isolated square panels.
Style: clean polished isometric technical illustration, pale warm-gray common floor, charcoal equipment chassis, white enamel, green biological liquid, blue water pipes, small yellow safety details. Consistent camera, perspective, lighting and scale across the whole illustration. Crisp and readable, soft subtle shadows, diagrammatic machinery, no people required.
Composition: landscape 3:2, ONE continuous shared floor, compact winding U-shaped process route. Leave the upper 16% and lower 16% of the entire image mostly empty light background for live text annotations added in code. Four main operating stations on the upper run at approximately x=13%,37%,63%,87%, y=35%; four on the lower return run at x=87%,63%,37%,13%, y=67%. These are components of ONE scene, joined by real pipes, a continuous conveyor, customer equipment platforms, and a road, not isolated islands. The winding route travels upper-left to upper-right, turns down on the right, and returns right to left on the lower run. Keep the central aisle clear enough to see the physical connections. All eight stations must be clearly distinct and fully visible.
Exactly these eight components in order:
1 upper-left: a transparent cylindrical cyanobacteria photobioreactor with green liquid, external lamp bars, CO2 inlet pipe, a few visible biological cells; keep the front liquid window clearly visible.
2 upper-mid-left: harvest/concentration centrifuge connected directly to the culture tank by a green liquid pipe; visible separation bowl and concentrate outlet feeding the next station.
3 upper-mid-right: cartridge filling and quality-check workstation with robotic filling nozzle and several green-core cylindrical cartridges moving on the shared conveyor.
4 upper-right: shipping/loading bay and a small delivery truck parked on a road which continues around the right edge toward the customer platform below.
5 lower-right: customer reactor installation station, open modular cartridge rack and a small robotic handling arm, physically next to the treatment equipment.
6 lower-mid-right: a transparent closed treatment tank receiving blue wastewater through pipes, green cartridges inside, clear water outlet with a small pipe continuing downstream.
7 lower-mid-left: cartridge extraction and collection station with a handling arm, collection tray and used green-core cartridges; connected to the treatment tank by the same lower conveyor.
8 lower-left: return washing/analysis workstation with open wash bowl, analysis instrument, used-cartridge rack and separate recovery container; connected by the returning conveyor, with a subtle return pipe toward the culture/production side.
Show a shared conveyor/road/pipeline system with coherent materials and a common floor so it reads immediately as ONE illustration. Do not add more major machines or duplicate any station. No text, numbers, labels, logos, signage, legends, borders, watermark, interface elements, arrows, badges or card backgrounds. This will be animated with aligned translucent flows and moving cartridges in the website.
```
