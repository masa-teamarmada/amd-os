const pptxgen = require("pptxgenjs");
const fs = require('fs');
const nodePath = require('path');
const { imageSize } = require('image-size');
const sizeOf = (p) => imageSize(fs.readFileSync(p));
const pres = new pptxgen();
pres.layout = 'LAYOUT_WIDE'; // 13.333 x 7.5
pres.author = 'えいみ × まさ';
pres.title = 'AMD Venture Map 理論化戦略';

const HERE = __dirname;
const C = {
  blue: '1A8FE6',
  blueDark: '0B6FC2',
  blueLight: 'E6F2FC',
  gray: '4A4A4A',
  graySoft: 'F2F4F7',
  grayBorder: 'D9DDE3',
  text: '1F2937',
  textMuted: '6B7280',
  white: 'FFFFFF'
};
const FT = 'Yu Gothic';
const LOGO_PATH = '/Users/masa/projects/AMD/amd-os/ios/logo_trans.png';
const EQ_DIR = nodePath.join(HERE, 'eqs');
const OUT_PPTX = nodePath.join(HERE, '..', '2026-05_venture_map_theory_strategy.pptx');
const TOTAL = 19;
const VERSION = 'v0.7';

function eqImg(slide, name, opts) {
  const path = `${EQ_DIR}/${name}.png`;
  const dim = sizeOf(path);
  const ratio = dim.width / dim.height;
  let w, h;
  if (opts.h !== undefined) { h = opts.h; w = h * ratio; }
  else if (opts.w !== undefined) { w = opts.w; h = w / ratio; }
  let x = opts.x;
  if (opts.cx !== undefined) x = opts.cx - w / 2;
  let y = opts.y;
  if (opts.cy !== undefined) y = opts.cy - h / 2;
  slide.addImage({ path, x, y, w, h });
}

function logo(slide, opts = {}) {
  const x = opts.x !== undefined ? opts.x : 10.95;
  const y = opts.y !== undefined ? opts.y : 0.25;
  const hexSize = opts.size || 0.42;
  const fontSize = opts.fontSize || 14;
  slide.addImage({ path: LOGO_PATH, x, y, w: hexSize, h: hexSize });
  slide.addText([
    { text: 'team', options: { color: C.gray, fontSize, bold: true } },
    { text: 'ARMADA', options: { color: C.blue, fontSize, bold: true } }
  ], { x: x + hexSize + 0.05, y, w: 1.85, h: hexSize, fontFace: 'Arial', valign: 'middle', margin: 0 });
}

function header(slide, num, kicker, title) {
  slide.addShape(pres.shapes.OVAL, { x: 0.6, y: 0.45, w: 0.5, h: 0.5, fill: { color: C.blue }, line: { type: 'none' } });
  slide.addText(String(num).padStart(2, '0'), { x: 0.6, y: 0.45, w: 0.5, h: 0.5, fontSize: 13, fontFace: FT, color: C.white, bold: true, align: 'center', valign: 'middle', margin: 0 });
  slide.addText(kicker, { x: 1.3, y: 0.4, w: 9, h: 0.3, fontSize: 11, fontFace: FT, color: C.blue, charSpacing: 4, bold: true, margin: 0 });
  slide.addText(title, { x: 1.3, y: 0.7, w: 12, h: 0.55, fontSize: 22, fontFace: FT, color: C.gray, bold: true, margin: 0 });
}

function footer(slide, page) {
  slide.addShape(pres.shapes.LINE, { x: 0.6, y: 7.05, w: 12.1, h: 0, line: { color: C.grayBorder, width: 0.5 } });
  slide.addText(`AMD Venture Map 理論化戦略 ${VERSION}`, { x: 0.6, y: 7.15, w: 8, h: 0.3, fontSize: 9, fontFace: FT, color: C.textMuted, margin: 0 });
  slide.addText(page + ' / ' + TOTAL, { x: 11, y: 7.15, w: 1.7, h: 0.3, fontSize: 9, fontFace: FT, color: C.textMuted, align: 'right', margin: 0 });
}

// ============================================================
// === 1: Title ===
// ============================================================
{
  const s = pres.addSlide();
  s.background = { color: C.white };
  s.addShape(pres.shapes.OVAL, { x: 10.5, y: 5.8, w: 4.5, h: 4.5, fill: { color: C.blueLight }, line: { type: 'none' } });
  s.addShape(pres.shapes.OVAL, { x: 11.8, y: 4.4, w: 2.2, h: 2.2, fill: { color: C.blueLight, transparency: 50 }, line: { type: 'none' } });
  s.addImage({ path: LOGO_PATH, x: 0.7, y: 0.6, w: 0.95, h: 0.95 });
  s.addText([
    { text: 'team', options: { color: C.gray, fontSize: 30, bold: true } },
    { text: 'ARMADA', options: { color: C.blue, fontSize: 30, bold: true } }
  ], { x: 1.75, y: 0.6, w: 4.5, h: 0.95, fontFace: 'Arial', valign: 'middle', margin: 0 });
  s.addText('AMD VENTURE MAP', { x: 0.7, y: 2.2, w: 12, h: 0.4, fontSize: 16, fontFace: FT, color: C.blue, charSpacing: 12, bold: true, margin: 0 });
  s.addText('理論化戦略', { x: 0.7, y: 2.7, w: 12, h: 1.2, fontSize: 60, fontFace: FT, color: C.gray, bold: true, margin: 0 });
  s.addText(`— 全体方向性 ${VERSION}`, { x: 0.7, y: 4.0, w: 12, h: 0.5, fontSize: 22, fontFace: FT, color: C.textMuted, margin: 0 });
  s.addShape(pres.shapes.LINE, { x: 0.7, y: 4.7, w: 2.5, h: 0, line: { color: C.blue, width: 2.5 } });
  s.addText([
    { text: 'URA向け教科書', options: { color: C.gray, bold: true, fontSize: 18 } },
    { text: '   →   ', options: { color: C.blue, fontSize: 18 } },
    { text: 'AMDプロトコル理論武装', options: { color: C.gray, bold: true, fontSize: 18 } },
    { text: '   →   ', options: { color: C.blue, fontSize: 18 } },
    { text: '学会発表', options: { color: C.gray, bold: true, fontSize: 18 } }
  ], { x: 0.7, y: 5.0, w: 12, h: 0.5, fontFace: FT, margin: 0 });
  s.addText('AMD のスタジオ運営を理論として体系化する。\n直近は URA・EIR が現場で使える実用書、最終は学会発表で社会的インパクト。',
    { x: 0.7, y: 5.7, w: 11, h: 1.0, fontSize: 14, fontFace: FT, color: C.text, margin: 0 });
  s.addText('2026-05-03   |   えいみ × まさ', { x: 0.7, y: 6.95, w: 10, h: 0.3, fontSize: 11, fontFace: FT, color: C.blue, margin: 0 });
}

// ============================================================
// === 2: Starting Point (v0.1 仮説) ===
// ============================================================
{
  const s = pres.addSlide();
  s.background = { color: C.white };
  logo(s);
  header(s, 1, 'STARTING POINT  ／  着手地点', 'AMD の経営判断を、ゼロから理論として構築していく');

  s.addShape(pres.shapes.RECTANGLE, { x: 0.6, y: 1.45, w: 12.1, h: 1.0, fill: { color: C.blueLight }, line: { type: 'none' } });
  s.addShape(pres.shapes.RECTANGLE, { x: 0.6, y: 1.45, w: 0.12, h: 1.0, fill: { color: C.blue }, line: { type: 'none' } });
  s.addText([
    { text: 'AMD のスタジオ運営は、20 社超の経営経験から成り立つ。これを ', options: { color: C.text, fontSize: 13 } },
    { text: 'ゼロから理論として体系化していく', options: { color: C.blueDark, fontSize: 13, bold: true } },
    { text: '。', options: { color: C.text, fontSize: 13, breakLine: true } },
    { text: '手始めに、最重要かつ世界共通の悩みである ', options: { color: C.text, fontSize: 13 } },
    { text: '「マクロトレンド・タイミング論」', options: { color: C.blueDark, fontSize: 13, bold: true } },
    { text: ' から構築してみた。', options: { color: C.text, fontSize: 13, breakLine: true } },
    { text: '※ 本デッキ後半で、この v0.1 を批判 → ', options: { color: C.gray, fontSize: 12 } },
    { text: 'v0.2 に改訂', options: { color: C.blueDark, fontSize: 12, bold: true } },
    { text: ' したプロセスも記録。', options: { color: C.gray, fontSize: 12 } }
  ], { x: 0.85, y: 1.45, w: 11.6, h: 1.0, fontFace: FT, valign: 'middle', margin: 0 });

  const lx = 0.6, ly = 2.6, lw = 6.0, lh = 4.4;
  s.addShape(pres.shapes.RECTANGLE, { x: lx, y: ly, w: lw, h: lh, fill: { color: C.graySoft }, line: { type: 'none' } });
  s.addText('最初に構築したモデル (仮説 v0.1)', { x: lx + 0.3, y: ly + 0.18, w: lw - 0.6, h: 0.35, fontSize: 11, fontFace: FT, color: C.blue, charSpacing: 4, bold: true, margin: 0 });
  s.addText('マクロトレンド・タイミング論', { x: lx + 0.3, y: ly + 0.5, w: lw - 0.6, h: 0.45, fontSize: 17, fontFace: FT, color: C.gray, bold: true, margin: 0 });
  s.addShape(pres.shapes.LINE, { x: lx + 0.3, y: ly + 1.0, w: 1.0, h: 0, line: { color: C.blue, width: 1.5 } });
  eqImg(s, 'eq1', { x: lx + 0.3, y: ly + 1.15, w: lw - 0.6 });
  eqImg(s, 'eq2', { x: lx + 0.3, y: ly + 1.75, w: lw - 0.6 });
  eqImg(s, 'eq3_combined', { x: lx + 0.3, y: ly + 2.35, w: lw - 0.6 });
  eqImg(s, 'eq4', { x: lx + 0.3, y: ly + 2.85, w: lw - 0.6 });
  s.addText('※ 9 社の経営経験 + Atlas / OpenAlex データから推定。実データでの検証はこれから。',
    { x: lx + 0.3, y: ly + 3.95, w: lw - 0.6, h: 0.35, fontSize: 9, fontFace: FT, color: C.textMuted, italic: true, margin: 0 });

  const rx = 7.0, ry = 2.6, rw = 5.7, rh = 4.4;
  s.addShape(pres.shapes.RECTANGLE, { x: rx, y: ry, w: rw, h: rh, fill: { color: C.white }, line: { color: C.grayBorder, width: 0.75 } });
  s.addText('次に構築する理論領域', { x: rx + 0.3, y: ry + 0.18, w: rw - 0.6, h: 0.35, fontSize: 11, fontFace: FT, color: C.blue, charSpacing: 4, bold: true, margin: 0 });
  s.addText('AMD オペレーションの全体像', { x: rx + 0.3, y: ry + 0.5, w: rw - 0.6, h: 0.45, fontSize: 17, fontFace: FT, color: C.gray, bold: true, margin: 0 });
  s.addShape(pres.shapes.LINE, { x: rx + 0.3, y: ry + 1.0, w: 1.0, h: 0, line: { color: C.blue, width: 1.5 } });
  const nextAreas = ['Before 0 価値注入関数', 'シーズ × CEO × AMD マッチング', 'XRL ボトルネック動学', '卒業 / フェードアウト動学', '契約モデル選択', '失敗パターン分類器'];
  nextAreas.forEach((g, i) => {
    const yy = ry + 1.2 + i * 0.42;
    s.addShape(pres.shapes.OVAL, { x: rx + 0.3, y: yy + 0.12, w: 0.18, h: 0.18, fill: { color: C.blue }, line: { type: 'none' } });
    s.addText(g, { x: rx + 0.55, y: yy, w: rw - 0.85, h: 0.4, fontSize: 12, fontFace: FT, color: C.text, valign: 'middle', margin: 0 });
  });

  footer(s, 2);
}

// ============================================================
// === Math slide template (v0.1 解説用) ===
// ============================================================
function mathSlide(s, num, kicker, title, eqName, vars, interpretation, eqOpts = {}) {
  s.background = { color: C.white };
  logo(s);
  header(s, num, kicker, title);

  const eqBoxY = 1.55, eqBoxH = 1.5;
  s.addShape(pres.shapes.RECTANGLE, { x: 0.6, y: eqBoxY, w: 12.1, h: eqBoxH, fill: { color: C.blueLight }, line: { type: 'none' } });
  s.addShape(pres.shapes.RECTANGLE, { x: 0.6, y: eqBoxY, w: 0.12, h: eqBoxH, fill: { color: C.blue }, line: { type: 'none' } });
  eqImg(s, eqName, { cx: 6.6667, cy: eqBoxY + eqBoxH / 2, h: eqOpts.h || 1.0 });

  const tx = 0.6, ty = 3.3;
  s.addText('変数定義', { x: tx, y: ty, w: 7.0, h: 0.35, fontSize: 11, fontFace: FT, color: C.blue, charSpacing: 4, bold: true, margin: 0 });
  const tHeader = [
    { text: '記号', options: { fill: { color: C.gray }, color: C.white, bold: true, fontSize: 10, align: 'center', valign: 'middle' } },
    { text: '意味', options: { fill: { color: C.gray }, color: C.white, bold: true, fontSize: 10, valign: 'middle' } },
    { text: '現在の扱い', options: { fill: { color: C.gray }, color: C.white, bold: true, fontSize: 10, valign: 'middle' } }
  ];
  const tRows = [tHeader];
  vars.forEach((v, i) => {
    const fillColor = i % 2 ? C.graySoft : C.white;
    tRows.push([
      { text: v[0], options: { fill: { color: fillColor }, color: C.blueDark, bold: true, fontSize: 10, italic: true, align: 'center', valign: 'middle' } },
      { text: v[1], options: { fill: { color: fillColor }, color: C.text, fontSize: 10, valign: 'middle' } },
      { text: v[2], options: { fill: { color: fillColor }, color: C.textMuted, fontSize: 10, valign: 'middle' } }
    ]);
  });
  s.addTable(tRows, { x: tx, y: ty + 0.4, w: 7.0, colW: [1.0, 3.5, 2.5], rowH: 0.32, border: { pt: 0.5, color: C.grayBorder }, fontFace: FT });

  const ix = 8.0, iy = 3.3;
  s.addShape(pres.shapes.RECTANGLE, { x: ix, y: iy, w: 4.7, h: 3.55, fill: { color: C.graySoft }, line: { color: C.grayBorder, width: 0.5 } });
  s.addText('解釈・意義', { x: ix + 0.25, y: iy + 0.15, w: 4.2, h: 0.35, fontSize: 11, fontFace: FT, color: C.blue, charSpacing: 4, bold: true, margin: 0 });
  s.addShape(pres.shapes.LINE, { x: ix + 0.25, y: iy + 0.55, w: 1.0, h: 0, line: { color: C.blue, width: 1.5 } });
  s.addText(interpretation, { x: ix + 0.25, y: iy + 0.7, w: 4.2, h: 2.75, fontSize: 11, fontFace: FT, color: C.text, paraSpaceAfter: 8, margin: 0 });
}

// ============================================================
// === 3: 数式① マクロトレンド指数 (v0.1) ===
// ============================================================
{
  const s = pres.addSlide();
  mathSlide(s, 2, 'EQUATION 1 (v0.1)  ／  数式①',
    'マクロトレンド指数  Mᵢ(t) — 政策・予算・VC・言及の合成', 'eq1',
    [
      ['Mᵢ(t)', 'レーン i のマクロトレンド指数 (0–1)', 'macro_index_log.index_value'],
      ['Pᵢ(s)', '政策密度', 'Atlas atlas_signals'],
      ['Bᵢ(t)', '公募予算・グラント配分額', '未投入 (β で吸収)'],
      ['Vᵢ(t)', 'VC 投資額', '未投入 (γ で吸収)'],
      ['Rᵢ(t)', '政策言及数', 'Atlas policy_mention_count'],
      ['τ', '過去参照窓 (24ヶ月)', 'グローバル定数'],
      ['λᵢ', '政策効果の減衰率', 'macro_lane_weights.lambda']
    ],
    '積分項は「過去の政策シグナルが指数的に減衰しながら現在に累積効果を与える」式。\n\n• λ が小さい (life = 0.10) → AMED 予算は数年効く\n• λ が大きい (materials = 0.22) → 経済安保政策は風化が早い\n\n重み α + β + γ + δ = 1.00 ± 0.02 の制約。Sonnet 4.6 が日次で再推定。',
    { h: 0.9 });
  footer(s, 3);
}

// ============================================================
// === 4: 数式② 事業化適温度 (v0.1) ===
// ============================================================
{
  const s = pres.addSlide();
  mathSlide(s, 3, 'EQUATION 2 (v0.1)  ／  数式②',
    '事業化適温度  Tᵢ(t) — シーズ成熟度と競合密度を畳み込む', 'eq2',
    [
      ['Tᵢ(t)', '事業化適温度 (0–1)', 'View B 「総合温度」の基底'],
      ['Sᵢ', 'シーズ成熟度 (定数)', '未実装 (κ = 0.7 で固定)'],
      ['κ', 'シーズ成熟度の効き方 (0.7)', 'グローバル定数'],
      ['Cᵢ(t)', '競合密度', '未投入 (当面 0)'],
      ['ηᵢ', '競合密度の効き方', 'macro_lane_weights.eta']
    ],
    'マクロトレンド M に、シーズの仕込み度合い S^κ を掛け、競合に削られる項 (1 − C)^η で減衰させる。\n\n• robo レーンは競合多数 → η を高め\n• 失敗 SU があったレーンは過去のボトルネックを反映して η を上げる\n\n「マクロが熱くてもシーズが弱ければ温度は上がらない」を表現。',
    { h: 0.9 });
  footer(s, 4);
}

// ============================================================
// === 5: 数式③ 論文-政策乖離 (v0.1) ===
// ============================================================
{
  const s = pres.addSlide();
  s.background = { color: C.white };
  logo(s);
  header(s, 4, 'EQUATION 3 (v0.1)  ／  数式③', '論文-政策乖離 D, D′ — 微分・二階微分による変曲点検出');

  const eqH = 1.5;
  s.addShape(pres.shapes.RECTANGLE, { x: 0.6, y: 1.55, w: 6.0, h: eqH, fill: { color: C.blueLight }, line: { type: 'none' } });
  s.addShape(pres.shapes.RECTANGLE, { x: 0.6, y: 1.55, w: 0.12, h: eqH, fill: { color: C.blue }, line: { type: 'none' } });
  eqImg(s, 'eq3a', { cx: 3.6, cy: 1.55 + eqH / 2, h: 1.0 });

  s.addShape(pres.shapes.RECTANGLE, { x: 6.7, y: 1.55, w: 6.0, h: eqH, fill: { color: C.blueLight }, line: { type: 'none' } });
  s.addShape(pres.shapes.RECTANGLE, { x: 6.7, y: 1.55, w: 0.12, h: eqH, fill: { color: C.blueDark }, line: { type: 'none' } });
  eqImg(s, 'eq3b', { cx: 9.7, cy: 1.55 + eqH / 2, h: 1.0 });

  s.addText('一階微分 D : 論文と政策の「速度差」', { x: 0.6, y: 3.15, w: 6.0, h: 0.35, fontSize: 11, fontFace: FT, color: C.blue, bold: true, align: 'center', margin: 0 });
  s.addText('二階微分 D′: 論文と政策の「加速度差」', { x: 6.7, y: 3.15, w: 6.0, h: 0.35, fontSize: 11, fontFace: FT, color: C.blueDark, bold: true, align: 'center', margin: 0 });

  const tHeader = [
    { text: '条件', options: { fill: { color: C.gray }, color: C.white, bold: true, fontSize: 11, valign: 'middle' } },
    { text: '意味', options: { fill: { color: C.gray }, color: C.white, bold: true, fontSize: 11, valign: 'middle' } },
    { text: 'AMD の行動', options: { fill: { color: C.gray }, color: C.white, bold: true, fontSize: 11, valign: 'middle' } }
  ];
  const tRows = [tHeader,
    [
      { text: 'D > 0', options: { fill: { color: C.white }, color: C.blueDark, bold: true, fontSize: 11, italic: true, align: 'center', valign: 'middle' } },
      { text: '論文先行 (研究が政策より進んでいる)', options: { fill: { color: C.white }, color: C.text, fontSize: 11, valign: 'middle' } },
      { text: 'シーズ仕込み期 → スカウト強化', options: { fill: { color: C.white }, color: C.text, fontSize: 11, valign: 'middle' } }
    ],
    [
      { text: 'D < 0', options: { fill: { color: C.graySoft }, color: C.blueDark, bold: true, fontSize: 11, italic: true, align: 'center', valign: 'middle' } },
      { text: '政策先行 (政策が研究を引っ張っている)', options: { fill: { color: C.graySoft }, color: C.text, fontSize: 11, valign: 'middle' } },
      { text: '研究集中要請 → 大学連携強化', options: { fill: { color: C.graySoft }, color: C.text, fontSize: 11, valign: 'middle' } }
    ],
    [
      { text: 'D′ 極大', options: { fill: { color: C.blueLight }, color: C.blueDark, bold: true, fontSize: 11, italic: true, align: 'center', valign: 'middle' } },
      { text: '加速度差が最大 = 領域転換点接近', options: { fill: { color: C.blueLight }, color: C.text, bold: true, fontSize: 11, valign: 'middle' } },
      { text: '投下シグナル (極大が最適か議論余地)', options: { fill: { color: C.blueLight }, color: C.text, bold: true, fontSize: 11, valign: 'middle' } }
    ]
  ];
  s.addTable(tRows, { x: 0.6, y: 3.65, w: 12.1, colW: [1.7, 5.5, 4.9], rowH: 0.65, border: { pt: 0.5, color: C.grayBorder }, fontFace: FT });

  s.addShape(pres.shapes.RECTANGLE, { x: 0.6, y: 6.3, w: 12.1, h: 0.55, fill: { color: C.graySoft }, line: { type: 'none' } });
  s.addText('▶  Nᵢ(t) は OpenAlex 論文数 (年次)、Mᵢ(t) はマクロトレンド指数 (月次)。微分は View A 上で視覚的に検出。',
    { x: 0.8, y: 6.3, w: 11.7, h: 0.55, fontSize: 10.5, fontFace: FT, color: C.gray, italic: true, valign: 'middle', margin: 0 });

  footer(s, 5);
}

// ============================================================
// === 6: 数式④ 投入シグナル (v0.1) ===
// ============================================================
{
  const s = pres.addSlide();
  mathSlide(s, 5, 'EQUATION 4 (v0.1)  ／  数式④',
    '設立タイミングシグナル  σ_SU — 積分平均 + 加速度ボーナス', 'eq4',
    [
      ['σ_SU', 'SU 投入シグナル強度', '未実装 (View B 総合温度が代替)'],
      ['Δt', '統合窓 (固定 6ヶ月)', 'グローバル定数'],
      ['μ', '加速度ボーナスの重み (0.15)', 'グローバル定数'],
      ['Tᵢ(s)', '事業化適温度 (式②)', '計算済み'],
      ['M″', 'マクロトレンドの二階微分', 'View A で確認']
    ],
    '「波の積分平均が高い期間 + マクロが加速中 (二階微分プラス)」のタイミングが最適投入点というアイデア。\n\n• 第1項: 直近 Δt の T 平均 → 波が安定して熱いか\n• 第2項: M″ → 波が加速しているか (失速していないか)\n\nD′ 極大との関係は要議論 (極大か、極大より少し後か)。',
    { h: 1.05 });
  footer(s, 6);
}

// ============================================================
// === 7: NEW — Critique Summary (18 個) ===
// ============================================================
{
  const s = pres.addSlide();
  s.background = { color: C.white };
  logo(s);
  header(s, 6, 'CRITIQUE SUMMARY  ／  v0.1 への批判 18 点', 'モデルを精査した結果見えた、各式・全体構造の改善ポイント');

  const cards = [
    {
      title: '式① マクロトレンド指数', items: [
        ['1.1', '線形結合の前提が壊れてる (P→B→V→R 因果連鎖あり)', '各項に独立ラグ・減衰を導入'],
        ['1.2', '政策だけ過去履歴の不整合', 'B/V/R も指数減衰積分に統一'],
        ['1.3', '閾値・飽和効果が抜けてる', 'シグモイド σ で包む'],
        ['1.4', 'レーン間波及が抜けてる', '主要ペアに相互作用項 ω_ij'],
      ]
    },
    {
      title: '式② 事業化期待値', items: [
        ['2.1', 'S が時定数で時間変化なし', 'S(t) を時間関数化 (累積論文の S 字)'],
        ['2.2', '各項の単位・レンジが不明確', '全項を [0,1] に正規化を明記'],
        ['2.3', '競合密度 η の意味づけが弱い', '同質競合度 d_i を分離して導入'],
        ['2.4', '「適温度」メタファーが曖昧', '「事業化期待値」E[launch] に再定義'],
      ]
    },
    {
      title: '式③ 論文-政策乖離', items: [
        ['3.1', '単位不整合 (致命的)', '対数微分 (相対成長率) で単位を揃える'],
        ['3.2', '二階微分のノイズが爆発', 'スムージング後に微分 (~ 表記)'],
        ['3.3', '論文先行の判定材料が弱い', '論文質 q, 政策コミット強度 c で加重'],
        ['3.4', 'D′ 極大 = 投入点ではない', 'D′ 極大は先行指標、σ_SU 最大が実行点'],
      ]
    },
    {
      title: '式④ 投入シグナル σ_SU', items: [
        ['4.1', '二項の単位が違うまま足し算', 'M″ を典型値で正規化'],
        ['4.2', 'Δt 6 ヶ月固定はレーンに不適', 'Δt_i をレーン依存に'],
        ['4.3', 'D′ がシグナルに入ってない', '3 軸 (T平均, M″, D′) を独立合成'],
        ['4.4', 'リスク項が抜けてる', '平均-分散最適化 (-ρ·Var[T])'],
      ]
    },
    {
      title: '全体構造', items: [
        ['5.1', 'フィードバックがない (フィードフォワード一直線)', '動的システム ODE 化 (中長期)'],
        ['5.2', '「Sonnet 推定」のままでは学術的に弱い', 'Bayesian system identification 化'],
      ]
    }
  ];

  // Layout: 2 columns × 3 rows
  cards.forEach((c, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = 0.6 + col * 6.15, y = 1.55 + row * 1.78;
    const w = 6.0, h = 1.65;
    s.addShape(pres.shapes.RECTANGLE, { x, y, w, h, fill: { color: C.white }, line: { color: C.grayBorder, width: 0.5 } });
    s.addShape(pres.shapes.RECTANGLE, { x, y, w, h: 0.05, fill: { color: C.blue }, line: { type: 'none' } });
    s.addText(c.title, { x: x + 0.2, y: y + 0.1, w: w - 0.4, h: 0.32, fontSize: 12, fontFace: FT, color: C.blueDark, bold: true, margin: 0 });
    c.items.forEach((item, j) => {
      const yy = y + 0.45 + j * 0.28;
      s.addText(item[0], { x: x + 0.2, y: yy, w: 0.5, h: 0.22, fontSize: 9, fontFace: FT, color: C.blue, bold: true, valign: 'middle', margin: 0 });
      s.addText(item[1], { x: x + 0.7, y: yy, w: 2.9, h: 0.22, fontSize: 8.5, fontFace: FT, color: C.text, valign: 'middle', margin: 0 });
      s.addText('→', { x: x + 3.6, y: yy, w: 0.2, h: 0.22, fontSize: 9, fontFace: FT, color: C.blue, valign: 'middle', align: 'center', margin: 0 });
      s.addText(item[2], { x: x + 3.85, y: yy, w: w - 4.05, h: 0.22, fontSize: 8.5, fontFace: FT, color: C.blueDark, bold: true, valign: 'middle', margin: 0 });
    });
  });

  // Bottom note (last slot empty, fill with summary)
  const bx = 6.75, by = 5.11, bw = 6.0, bh = 1.65;
  s.addShape(pres.shapes.RECTANGLE, { x: bx, y: by, w: bw, h: bh, fill: { color: C.blueLight }, line: { type: 'none' } });
  s.addShape(pres.shapes.RECTANGLE, { x: bx, y: by, w: 0.12, h: bh, fill: { color: C.blue }, line: { type: 'none' } });
  s.addText('改訂方針', { x: bx + 0.3, y: by + 0.15, w: bw - 0.5, h: 0.3, fontSize: 11, fontFace: FT, color: C.blueDark, bold: true, charSpacing: 3, margin: 0 });
  s.addText([
    { text: '18 点 すべて採用 ', options: { color: C.blueDark, fontSize: 13, bold: true, breakLine: true } },
    { text: '式①〜④ それぞれを v0.1 → ', options: { color: C.text, fontSize: 11 } },
    { text: 'v0.2 改訂版', options: { color: C.blueDark, fontSize: 11, bold: true } },
    { text: ' に書き直す。', options: { color: C.text, fontSize: 11, breakLine: true } },
    { text: '次の 4 枚で各式について元の式 → 改訂式 → 修正項目を順に示す。', options: { color: C.text, fontSize: 11 } }
  ], { x: bx + 0.3, y: by + 0.5, w: bw - 0.5, h: bh - 0.6, fontFace: FT, margin: 0 });

  footer(s, 7);
}

// ============================================================
// === Revised equation slide template ===
// 各 row: [番号, 批判, 修正, その修正で批判に対応できる理由]
// ============================================================
function revisedSlide(s, num, title, eqOldName, eqNewName, critiquePoints, rows, opts = {}) {
  s.background = { color: C.white };
  logo(s);
  header(s, num, 'REVISED EQUATION  ／  改訂版', title);

  // v0.1 (top, compact)
  const oldY = 1.5, oldH = 0.85;
  s.addShape(pres.shapes.RECTANGLE, { x: 0.6, y: oldY, w: 12.1, h: oldH, fill: { color: C.graySoft }, line: { type: 'none' } });
  s.addText('v0.1 元の式', { x: 0.8, y: oldY + 0.05, w: 2.5, h: 0.28, fontSize: 10, fontFace: FT, color: C.textMuted, charSpacing: 3, bold: true, margin: 0 });
  eqImg(s, eqOldName, { cx: 6.6667, cy: oldY + oldH/2 + 0.06, h: opts.oldH || 0.5 });

  // Down arrow + critique pointer
  s.addText(`↓  批判 ${critiquePoints}  ↓`, {
    x: 0.6, y: oldY + oldH + 0.02, w: 12.1, h: 0.25,
    fontSize: 10, fontFace: FT, color: C.blue, bold: true, align: 'center', margin: 0
  });

  // v0.2 (middle, highlighted, compact)
  const newY = oldY + oldH + 0.32, newH = 1.2;
  s.addShape(pres.shapes.RECTANGLE, { x: 0.6, y: newY, w: 12.1, h: newH, fill: { color: C.blueLight }, line: { type: 'none' } });
  s.addShape(pres.shapes.RECTANGLE, { x: 0.6, y: newY, w: 0.12, h: newH, fill: { color: C.blue }, line: { type: 'none' } });
  s.addText('v0.2 改訂式', { x: 0.85, y: newY + 0.05, w: 3.0, h: 0.28, fontSize: 10, fontFace: FT, color: C.blueDark, charSpacing: 3, bold: true, margin: 0 });
  eqImg(s, eqNewName, { cx: 6.6667, cy: newY + newH/2 + 0.08, h: opts.newH || 0.8 });

  // Bottom: 批判 × 修正 × 対応理由 テーブル
  const tY = newY + newH + 0.18;
  const tHeaderRow = [
    { text: '#', options: { fill: { color: C.gray }, color: C.white, bold: true, fontSize: 10, align: 'center', valign: 'middle' } },
    { text: '批判', options: { fill: { color: C.gray }, color: C.white, bold: true, fontSize: 10, valign: 'middle' } },
    { text: '修正', options: { fill: { color: C.gray }, color: C.white, bold: true, fontSize: 10, valign: 'middle' } },
    { text: 'その修正で批判に対応できる理由', options: { fill: { color: C.gray }, color: C.white, bold: true, fontSize: 10, valign: 'middle' } }
  ];
  const tableData = [tHeaderRow];
  rows.forEach((r, i) => {
    const fillColor = i % 2 ? C.graySoft : C.white;
    tableData.push([
      { text: r[0], options: { fill: { color: fillColor }, color: C.blue, bold: true, fontSize: 9, align: 'center', valign: 'middle' } },
      { text: r[1], options: { fill: { color: fillColor }, color: C.text, fontSize: 8.5, valign: 'middle' } },
      { text: r[2], options: { fill: { color: fillColor }, color: C.blueDark, bold: true, fontSize: 8.5, valign: 'middle' } },
      { text: r[3], options: { fill: { color: fillColor }, color: C.text, fontSize: 8.5, valign: 'middle' } }
    ]);
  });
  s.addTable(tableData, {
    x: 0.6, y: tY, w: 12.1,
    colW: [0.55, 3.0, 3.55, 5.0],
    rowH: 0.55,
    border: { pt: 0.5, color: C.grayBorder },
    fontFace: FT
  });
}

// ============================================================
// === 8: 改訂式① ===
// ============================================================
{
  const s = pres.addSlide();
  revisedSlide(s, 7,
    'マクロトレンド指数  Mᵢ(t) — v0.1 → v0.2',
    'eq1', 'eq1_v2',
    '1.1〜1.4',
    [
      ['1.1',
        '線形結合の前提崩壊 (P→B→V→R の因果連鎖がある)',
        '各変数 X ∈ {P,B,V,R} に独立ラグ・独立減衰率 λᵢˣ',
        'P→B→V→R の時間遅れ伝播を式の中で明示できる。「同時瞬時値の合計」という非現実的前提を排除し、現実の波及構造を反映'],
      ['1.2',
        '政策のみ過去履歴の不整合',
        '4 変数すべてを指数減衰積分に統一',
        'AMED 5年プログラム・VC 投資 SU 寿命 など、B/V も実際は数年効く。「効果が時間とともに薄れる」現実を全変数で表現'],
      ['1.3',
        '閾値・飽和効果が抜けてる',
        '内側の合計をシグモイド σ で包み M ∈ [0,1] を保証',
        '法制化前は予算が出ない・予算が一定額未満なら VC が来ない、等の閾値超え現象を非線形で表現。M が無次元 [0,1] スコアになる'],
      ['1.4',
        'レーン間波及が抜けてる',
        '主要ペアに相互作用項 Σ ωᵢⱼ Mⱼ(t−τᵢⱼ) を加算',
        'GX_energy → materials のような業界波及を係数 ω で明示。レーン独立の前提を崩し、クロス・レーン伝播を取り込む'],
    ],
    { oldH: 0.5, newH: 0.85 }
  );
  footer(s, 8);
}

// ============================================================
// === 9: 改訂式② ===
// ============================================================
{
  const s = pres.addSlide();
  revisedSlide(s, 8,
    '事業化期待値  𝔼[launchᵢ](t) — v0.1 → v0.2',
    'eq2', 'eq2_v2',
    '2.1〜2.4',
    [
      ['2.1',
        'Sᵢ が時定数で、研究の進展に追随しない',
        'Sᵢ(t) を時間関数化 (累積論文数の S 字フィット等)',
        'シーズが時間とともに成熟する物理現実を素直に表現。「定数」前提では研究の進展がモデルに反映されず、長期予測が破綻する'],
      ['2.2',
        '各項の単位・レンジが不明確で乗法形が破綻',
        '全項 (M, S, C) を [0,1] に正規化を明記',
        '乗法形 M·S^κ·(1−C)^η が物理的に意味を持つには、各因子が無次元 [0,1] である必要。明記することで運用上の解釈不一致を防ぐ'],
      ['2.3',
        '競合密度 ηᵢ の意味づけが曖昧',
        '同質競合度 dᵢ ∈ [0,1] を分離して導入',
        '競合の質 (substitute vs alternative) は密度と独立な変数。dᵢ で同質性を分離することで、同じ競合数でも質が違えば影響が違う、を表現'],
      ['2.4',
        '「適温度」メタファーが統計的に曖昧',
        '𝔼[launch] (事業化期待値) に概念再定義',
        '期待値という統計的解釈に置き換えることで、後の検証で「予測値 vs 実績値」の比較が成立し、反証可能性 (= 学術モデル要件) を獲得'],
    ],
    { oldH: 0.5, newH: 0.65 }
  );
  footer(s, 9);
}

// ============================================================
// === 10: 改訂式③ ===
// ============================================================
{
  const s = pres.addSlide();
  revisedSlide(s, 9,
    '論文-政策乖離  Dᵢ(t) — v0.1 → v0.2',
    'eq3_combined', 'eq3_v2',
    '3.1〜3.4',
    [
      ['3.1',
        '単位不整合 (致命的、引き算が次元的に成立しない)',
        '対数微分化: d log Ñ / dt − d log M̃ / dt',
        '対数微分は両者とも年率の無次元成長率になり、引き算が物理的に意味を持つ。元の式は次元解析が成立せず数学的に破綻していた'],
      ['3.2',
        '二階微分のノイズが指数増幅される',
        'Ñ, M̃ はカーネルスムージング後の信号',
        '離散観測の数値微分は誤差が増幅される性質。低周波成分のみ抽出するスムージング (LOESS / kernel) を介在させてノイズロバスト性を担保'],
      ['3.3',
        '論文先行の判定材料が「数」だけで弱い',
        '論文質 qᵢ (Top-10% 引用) × 政策コミット強度 cᵢ で加重',
        '論文数だけでは hype バブルと真の進展を区別できない。質と政策強度 (法律 > 戦略 > 提言) で重み付けし、シグナルの信頼性を高める'],
      ['3.4',
        'D′ 極大が「最適投入点」と扱われていた',
        'D′ 極大は先行指標、σ_SU 最大が実行点',
        '時間順序: D′ 極大 (= N″−M″ 極大) → M″ 単独極大 → σ_SU 最大。D′ は準備サイン、σ_SU は実行サインと役割分担で運用上の誤判断を防ぐ'],
    ],
    { oldH: 0.45, newH: 0.75 }
  );
  footer(s, 10);
}

// ============================================================
// === 11: 改訂式④ ===
// ============================================================
{
  const s = pres.addSlide();
  revisedSlide(s, 10,
    '投入シグナル  σ_SU,ᵢ(t₀) — v0.1 → v0.2',
    'eq4', 'eq4_v2',
    '4.1〜4.4',
    [
      ['4.1',
        '二項の単位が違うまま μ で吸収していた',
        '各項を典型値 (M̈ᵢ*, D′ᵢ*) で正規化',
        'T (無次元) と M̈ (時間⁻²) は単位が違う。典型値で割って無次元化すれば純粋な比較尺度として正しく加算でき、不整合が解消'],
      ['4.2',
        'Δt 6ヶ月固定はレーン特性を無視',
        '統合窓 Δtᵢ をレーン依存に',
        '規制 2年・エネルギー 5年など波長スケールが違うため、固定 Δt は短すぎ or 長すぎ。レーン依存で波の半周期を捉える適切な平均化窓に'],
      ['4.3',
        'D′ がシグナルに入っていない',
        '3 軸 (T 平均・M″・D′) を独立に重ね合わせ',
        'D′ は M″ や T 平均と独立に「研究と政策の乖離トレンド」を担う。別個の項として加えることで複数視点から合成されるロバストな指標になる'],
      ['4.4',
        '期待値だけ見て、リスクを評価していない',
        'リスク項 −ρ · Var[T]_Δt を追加',
        '期待値だけでは「平均的に良いがハズレるとティエムのように炎上」を識別できない。Var を引くことで実物オプション平均-分散最適化が成立'],
    ],
    { oldH: 0.6, newH: 0.75 }
  );
  footer(s, 11);
}

// ============================================================
// === 12: Operation Map ===
// ============================================================
{
  const s = pres.addSlide();
  s.background = { color: C.white };
  logo(s);
  header(s, 11, 'OPERATION MAP  ／  オペレーション全体の理論化マップ', 'AMD の活動を 7 領域に分解。それぞれ独立した理論化対象');

  const headerRow = [
    { text: '#', options: { fill: { color: C.gray }, color: C.white, bold: true, fontSize: 11, align: 'center', valign: 'middle' } },
    { text: '領域', options: { fill: { color: C.gray }, color: C.white, bold: true, fontSize: 11, valign: 'middle' } },
    { text: '内生変数', options: { fill: { color: C.gray }, color: C.white, bold: true, fontSize: 11, valign: 'middle' } },
    { text: '隣接学問', options: { fill: { color: C.gray }, color: C.white, bold: true, fontSize: 11, valign: 'middle' } },
    { text: '着手しやすさ', options: { fill: { color: C.gray }, color: C.white, bold: true, fontSize: 11, align: 'center', valign: 'middle' } },
    { text: '新規性', options: { fill: { color: C.gray }, color: C.white, bold: true, fontSize: 11, align: 'center', valign: 'middle' } }
  ];
  const rows = [
    ['1', 'マクロトレンド・タイミング (現モデル)', 'M, T, σ_SU', 'Innovation Diffusion / Real Options', '◎ 実装中', '○'],
    ['2', 'Before 0 価値注入関数', 'I(t), m(t)', 'Coaching econ / 実物オプション', '○', '◎'],
    ['3', 'シーズ-CEO-AMD マッチング', 'A_seed, A_CEO, AMD関与', 'Matching theory (Roth)', '○', '○'],
    ['4', 'XRL ボトルネック動学', 'TRL, BRL, HRL ベクトル', '多軸 readiness 理論', '○ XRLログあり', '◎'],
    ['5', '卒業 (フェードアウト) 動学', 'R(t), exit timing', 'Optimal control', '△ データ薄い', '◎'],
    ['6', '契約モデル選択', 'CX/SX/JC type × phase', 'Contract / Mechanism', '○', '○'],
    ['7', '失敗パターン分類器', 'outcome ∈ {bo, uf, dp, ex}', 'Survival analysis', '◎ 9社あり', '○'],
  ];
  const tableRows = [headerRow];
  rows.forEach((r, i) => {
    const isCurrent = i === 0;
    const fillColor = isCurrent ? C.blueLight : (i % 2 ? C.graySoft : C.white);
    tableRows.push(r.map((c, j) => ({
      text: c,
      options: {
        fill: { color: fillColor },
        color: isCurrent ? C.blueDark : C.text,
        bold: j === 0 || j === 1 || isCurrent,
        fontSize: 11,
        align: (j === 0 || j === 4 || j === 5) ? 'center' : 'left',
        valign: 'middle'
      }
    })));
  });
  s.addTable(tableRows, { x: 0.6, y: 1.5, w: 12.1, colW: [0.5, 3.4, 2.3, 2.7, 1.7, 1.5], rowH: 0.42, border: { pt: 0.5, color: C.grayBorder }, fontFace: FT });

  s.addShape(pres.shapes.RECTANGLE, { x: 0.6, y: 6.2, w: 12.1, h: 0.65, fill: { color: C.blueLight }, line: { type: 'none' } });
  s.addText('▶ まさの判断: 1〜5・7 はすべて理論として構築する。中でも 1 は世界共通の悩みなので最優先。',
    { x: 0.8, y: 6.2, w: 11.7, h: 0.65, fontSize: 12, fontFace: FT, color: C.blueDark, bold: true, valign: 'middle', margin: 0 });

  footer(s, 12);
}

// ============================================================
// === 13: Three-actor finding ===
// ============================================================
{
  const s = pres.addSlide();
  s.background = { color: C.white };
  logo(s);
  header(s, 12, 'KEY FINDING  ／  C 修正で見えた発見', 'Before 0 の主体は「PI × 別 CEO × AMD」の三者構造');

  const cx = 4.0, cy = 4.2;
  const r = 1.5;
  const nodes = [
    { x: cx, y: cy - r * 1.1, label: 'PI / 研究者', sub: 'シーズ提供\n研究の深化', color: C.blueDark },
    { x: cx - r, y: cy + r * 0.65, label: '別 CEO', sub: '事業推進\n株主対応', color: C.gray },
    { x: cx + r, y: cy + r * 0.65, label: 'AMD', sub: 'Before 0 触媒\nビジョン注入', color: C.blue }
  ];
  for (let i = 0; i < 3; i++) {
    const a = nodes[i], b = nodes[(i + 1) % 3];
    s.addShape(pres.shapes.LINE, { x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y, line: { color: C.grayBorder, width: 1.5, dashType: 'dash' } });
  }
  nodes.forEach(n => {
    const sz = 1.55;
    s.addShape(pres.shapes.OVAL, { x: n.x - sz/2, y: n.y - sz/2, w: sz, h: sz, fill: { color: n.color }, line: { color: C.white, width: 3 } });
    s.addText(n.label, { x: n.x - sz/2, y: n.y - sz/2 + 0.3, w: sz, h: 0.4, fontSize: 13, fontFace: FT, color: C.white, bold: true, align: 'center', valign: 'middle', margin: 0 });
    s.addText(n.sub, { x: n.x - sz/2, y: n.y - sz/2 + 0.7, w: sz, h: 0.7, fontSize: 9, fontFace: FT, color: C.white, align: 'center', valign: 'top', margin: 0 });
  });

  const rx = 7.5;
  s.addShape(pres.shapes.RECTANGLE, { x: rx, y: 1.55, w: 5.2, h: 5.3, fill: { color: C.graySoft }, line: { color: C.grayBorder, width: 0.75 } });
  s.addText('発見', { x: rx + 0.3, y: 1.7, w: 4.5, h: 0.35, fontSize: 11, fontFace: FT, color: C.blue, bold: true, charSpacing: 4, margin: 0 });
  s.addText('研究者 → 起業家 ではない', { x: rx + 0.3, y: 2.05, w: 4.7, h: 0.6, fontSize: 20, fontFace: FT, color: C.gray, bold: true, margin: 0 });
  s.addShape(pres.shapes.LINE, { x: rx + 0.3, y: 2.75, w: 1.0, h: 0, line: { color: C.blue, width: 1.5 } });
  s.addText([
    { text: 'PI が CEO になるケースは少数派', options: { breakLine: true, bullet: true } },
    { text: '別の人材が CEO に就くことのが多い', options: { breakLine: true, bullet: true } },
    { text: 'AMD は PI と CEO の橋渡し ＋ ビジョン注入の触媒', options: { bullet: true } }
  ], { x: rx + 0.3, y: 2.95, w: 4.7, h: 1.8, fontSize: 12, fontFace: FT, color: C.text, paraSpaceAfter: 6, margin: 0 });
  s.addText('モデルへの帰結', { x: rx + 0.3, y: 4.85, w: 4.5, h: 0.35, fontSize: 11, fontFace: FT, color: C.blue, bold: true, charSpacing: 4, margin: 0 });
  s.addText('Before 0 の数学は「研究者の状態遷移」ではなく、3 主体の availability の同期問題として書く必要がある。',
    { x: rx + 0.3, y: 5.2, w: 4.7, h: 1.6, fontSize: 12, fontFace: FT, color: C.text, italic: true, margin: 0 });

  footer(s, 13);
}

// ============================================================
// === 14: Composite probability ===
// ============================================================
{
  const s = pres.addSlide();
  s.background = { color: C.white };
  logo(s);
  header(s, 13, 'CORE EQUATION  ／  立ち上げ実現確率の合成', '3 つの独立な確率過程の積として書ける');

  s.addShape(pres.shapes.RECTANGLE, { x: 0.6, y: 1.55, w: 12.1, h: 1.4, fill: { color: C.blueLight }, line: { type: 'none' } });
  s.addShape(pres.shapes.RECTANGLE, { x: 0.6, y: 1.55, w: 0.12, h: 1.4, fill: { color: C.blue }, line: { type: 'none' } });
  eqImg(s, 'eq_composite', { cx: 6.6667, cy: 2.25, h: 0.9 });

  const cards = [
    { title: 'σ_SU(t)', sub: 'マクロトレンド・タイミング', body: '政策・予算・VC・言及から合成される投入シグナル (式①〜④)。\n領域 1 の現モデルが算出する。', color: C.blue },
    { title: 'A_CEO(t)', sub: 'CEO 候補プール', body: 'AMD が声をかけられる、当該レーンに張れる CEO 候補の存在密度。\n人材の波。', color: C.blueDark },
    { title: 'A_seed(t)', sub: 'シーズ availability', body: 'AMD がアクセスできる大学シーズの状態。\n成熟度・公開タイミング・先生のスタンスで決まる。', color: C.gray }
  ];
  cards.forEach((c, i) => {
    const cx = 0.6 + i * 4.2, cy = 3.2, cw = 3.95, ch = 3.3;
    s.addShape(pres.shapes.RECTANGLE, { x: cx, y: cy, w: cw, h: ch, fill: { color: C.graySoft }, line: { color: C.grayBorder, width: 0.75 } });
    s.addShape(pres.shapes.RECTANGLE, { x: cx, y: cy, w: cw, h: 0.12, fill: { color: c.color }, line: { type: 'none' } });
    s.addText(c.title, { x: cx + 0.3, y: cy + 0.25, w: cw - 0.6, h: 0.6, fontSize: 22, italic: true, color: c.color, bold: true, margin: 0 });
    s.addText(c.sub, { x: cx + 0.3, y: cy + 0.9, w: cw - 0.6, h: 0.4, fontSize: 13, fontFace: FT, color: C.gray, bold: true, margin: 0 });
    s.addText(c.body, { x: cx + 0.3, y: cy + 1.4, w: cw - 0.6, h: 1.7, fontSize: 11, fontFace: FT, color: C.text, paraSpaceAfter: 4, margin: 0 });
  });

  s.addText('▶  Before 0 ボトルネックの本質 = 3 つの過程の 非同期。領域 2・3 は領域 1 の中に内包される。',
    { x: 0.6, y: 6.65, w: 12.1, h: 0.35, fontSize: 12, fontFace: FT, color: C.blueDark, bold: true, italic: true, margin: 0 });

  footer(s, 14);
}

// ============================================================
// === 15: Goal structure (3-stage) ===
// ============================================================
{
  const s = pres.addSlide();
  s.background = { color: C.white };
  logo(s);
  header(s, 14, 'GOAL STRUCTURE  ／  直近ゴールの 3 段構造', '実用書 → 理論武装 → 学会発表 のパイプライン');

  const stages = [
    { num: 'STEP 1', title: 'URA 向け教科書', subtitle: '実用書として現場で使う', color: C.blue, audience: 'NIMS・愛媛大ほかの URA / EIR', period: '2026 Q2 — 2027 Q1', kpi: '初稿 PDF / Notion 公開' },
    { num: 'STEP 2', title: 'AMDプロトコル理論武装', subtitle: '営業資料・対外説明の数理基盤', color: C.blueDark, audience: 'VC・CVC・連携機関・行政', period: '教科書と並行', kpi: 'プロトコル v1 + 数式付録' },
    { num: 'STEP 3', title: '学会発表', subtitle: '社会的インパクト・査読を通す', color: C.gray, audience: '研究・イノベーション学会 ほか', period: '2027 Q2 以降', kpi: '国内 → R&D Mgmt → ジャーナル' }
  ];
  stages.forEach((st, i) => {
    const x = 0.6 + i * 4.2, y = 1.6, w = 4.0, h = 5.1;
    s.addShape(pres.shapes.RECTANGLE, { x, y, w, h, fill: { color: C.white }, line: { color: C.grayBorder, width: 0.75 }, shadow: { type: 'outer', color: '000000', blur: 8, offset: 2, angle: 90, opacity: 0.06 } });
    s.addShape(pres.shapes.RECTANGLE, { x, y, w, h: 0.7, fill: { color: st.color }, line: { type: 'none' } });
    s.addText(st.num, { x: x + 0.3, y: y + 0.18, w: w - 0.6, h: 0.4, fontSize: 12, fontFace: FT, color: C.white, charSpacing: 4, bold: true, margin: 0 });
    s.addText(st.title, { x: x + 0.3, y: y + 0.95, w: w - 0.6, h: 0.65, fontSize: 19, fontFace: FT, color: C.gray, bold: true, margin: 0 });
    s.addText(st.subtitle, { x: x + 0.3, y: y + 1.65, w: w - 0.6, h: 0.4, fontSize: 12, fontFace: FT, color: C.textMuted, italic: true, margin: 0 });
    s.addShape(pres.shapes.LINE, { x: x + 0.3, y: y + 2.25, w: w - 0.6, h: 0, line: { color: C.grayBorder, width: 0.5 } });
    s.addText('読者', { x: x + 0.3, y: y + 2.4, w: w - 0.6, h: 0.3, fontSize: 9, fontFace: FT, color: C.blue, bold: true, charSpacing: 3, margin: 0 });
    s.addText(st.audience, { x: x + 0.3, y: y + 2.65, w: w - 0.6, h: 0.5, fontSize: 11, fontFace: FT, color: C.text, margin: 0 });
    s.addText('時期', { x: x + 0.3, y: y + 3.3, w: w - 0.6, h: 0.3, fontSize: 9, fontFace: FT, color: C.blue, bold: true, charSpacing: 3, margin: 0 });
    s.addText(st.period, { x: x + 0.3, y: y + 3.55, w: w - 0.6, h: 0.4, fontSize: 11, fontFace: FT, color: C.text, margin: 0 });
    s.addText('アウトプット', { x: x + 0.3, y: y + 4.15, w: w - 0.6, h: 0.3, fontSize: 9, fontFace: FT, color: C.blue, bold: true, charSpacing: 3, margin: 0 });
    s.addText(st.kpi, { x: x + 0.3, y: y + 4.4, w: w - 0.6, h: 0.5, fontSize: 11, fontFace: FT, color: C.text, margin: 0 });
  });
  s.addShape(pres.shapes.LINE, { x: 4.6, y: 4.2, w: 0.2, h: 0, line: { color: C.blue, width: 2.5, endArrowType: 'triangle' } });
  s.addShape(pres.shapes.LINE, { x: 8.8, y: 4.2, w: 0.2, h: 0, line: { color: C.blue, width: 2.5, endArrowType: 'triangle' } });

  footer(s, 15);
}

// ============================================================
// === 16: Textbook chapters ===
// ============================================================
{
  const s = pres.addSlide();
  s.background = { color: C.white };
  logo(s);
  header(s, 15, 'TEXTBOOK  ／  URA 向け教科書 章立て案', '研究者・URA・EIR が現場で使える形に落とす');

  const chapters = [
    { idx: '序', title: 'なぜ理論化するのか', body: 'Before 0 の経営判断を属人化させない理由。AMD の 9 社経験を起点。', color: C.gray },
    { idx: 'I', title: 'マクロトレンド・タイミング論', body: '式①〜④: 合成指数 M, 適温度 T, 微分・二階微分による D/D′, 投入シグナル σ_SU。', color: C.blue },
    { idx: 'II', title: 'Before 0 三者構造論', body: 'PI × 別 CEO × AMD の同期問題。A_CEO, A_seed の数学。', color: C.blueDark },
    { idx: 'III', title: 'XRL ボトルネック動学', body: 'TRL/BRL/HRL ベクトルの整合性と最小成分ギャップ G(t)。', color: C.blue },
    { idx: 'IV', title: '卒業フェードアウト動学', body: 'AMD 関与度 R(t) の最適制御。先手力低下とガバナンス成熟度。', color: C.blueDark },
    { idx: 'V', title: 'ケーススタディ (9 社)', body: 'ティエム / Yellow Duck / JOYCLE / CTB / SX / CX / BWE で実証。', color: C.gray }
  ];
  chapters.forEach((ch, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = 0.6 + col * 6.15, y = 1.55 + row * 1.7;
    const w = 6.0, h = 1.55;
    s.addShape(pres.shapes.RECTANGLE, { x, y, w, h, fill: { color: C.white }, line: { color: C.grayBorder, width: 0.5 } });
    s.addShape(pres.shapes.RECTANGLE, { x, y, w: 0.95, h, fill: { color: ch.color }, line: { type: 'none' } });
    s.addText(ch.idx, { x, y, w: 0.95, h, fontSize: 30, fontFace: FT, color: C.white, bold: true, align: 'center', valign: 'middle', margin: 0 });
    s.addText(ch.title, { x: x + 1.15, y: y + 0.25, w: w - 1.3, h: 0.5, fontSize: 16, fontFace: FT, color: C.gray, bold: true, margin: 0 });
    s.addText(ch.body, { x: x + 1.15, y: y + 0.78, w: w - 1.3, h: 0.7, fontSize: 11, fontFace: FT, color: C.text, margin: 0 });
  });

  footer(s, 16);
}

// ============================================================
// === 17: Protocol armor ===
// ============================================================
{
  const s = pres.addSlide();
  s.background = { color: C.white };
  logo(s);
  header(s, 16, 'PROTOCOL ARMOR  ／  AMDプロトコル × 各領域', '4 要素 (分岐点 / 判断材料 / アクション / 結果) を全領域に適用');

  const protocolHeader = [
    { text: '領域', options: { fill: { color: C.gray }, color: C.white, bold: true, fontSize: 11, valign: 'middle' } },
    { text: '分岐点 (What)', options: { fill: { color: C.gray }, color: C.white, bold: true, fontSize: 11, valign: 'middle' } },
    { text: '判断材料 (Why)', options: { fill: { color: C.gray }, color: C.white, bold: true, fontSize: 11, valign: 'middle' } },
    { text: 'アクション (How)', options: { fill: { color: C.gray }, color: C.white, bold: true, fontSize: 11, valign: 'middle' } },
    { text: '結果 (Result)', options: { fill: { color: C.gray }, color: C.white, bold: true, fontSize: 11, valign: 'middle' } }
  ];
  const protocolRows = [
    ['1 マクロトレンド・タイミング', 'いつ立ち上げるか', 'σ_SU, M(t), D′(t)', 'GO / WAIT / SCOUT', 'SU outcome (生存・失敗)'],
    ['2 三者構造マッチング', '誰と組むか', 'A_CEO, A_seed, 信頼度', 'マッチング・紹介・見送り', '信頼の安定 (CX) / 崩壊 (JC)'],
    ['3 XRL ボトルネック', 'どの軸を伸ばすか', 'TRL/BRL/HRL ベクトル, G(t)', 'HRL 強化 / BRL 強化 / 一旦停止', 'burnout / ue_fail 回避'],
    ['4 卒業動学', 'いつ手を引くか', 'ガバナンス, 自走, 先手力', '縮小 / 維持 / 再関与', '卒業成功 (CX) / トラブル (BWE)'],
    ['5 失敗パターン', '撤退・ピボット', '兆候パターン, 信頼スコア', 'deep_pivot / 受容 / 継続', '学習データの蓄積']
  ];
  const tRows = [protocolHeader];
  protocolRows.forEach((r, i) => {
    const fillColor = i % 2 ? C.graySoft : C.white;
    tRows.push(r.map((c, j) => ({ text: c, options: { fill: { color: fillColor }, color: C.text, bold: j === 0, fontSize: 10.5, valign: 'middle' } })));
  });
  s.addTable(tRows, { x: 0.6, y: 1.55, w: 12.1, colW: [2.7, 2.4, 2.5, 2.3, 2.2], rowH: 0.65, border: { pt: 0.5, color: C.grayBorder }, fontFace: FT });

  s.addShape(pres.shapes.RECTANGLE, { x: 0.6, y: 5.65, w: 12.1, h: 1.25, fill: { color: C.blueLight }, line: { color: C.grayBorder, width: 0.5 } });
  s.addText('プロトコル理論武装の意義', { x: 0.8, y: 5.75, w: 11.7, h: 0.35, fontSize: 11, fontFace: FT, color: C.blueDark, bold: true, charSpacing: 3, margin: 0 });
  s.addText('• AMD OS の中核に位置づけられている 4 要素を、各領域の数式・変数・観測量に対応づける。\n• URA・EIR が「いま自分は何を判断しているのか」を構造化して認識できるようになる。\n• 営業資料・対外説明でも「経験則 → 数理化 → 反証可能な命題」までの距離が短くなる。',
    { x: 0.8, y: 6.05, w: 11.7, h: 0.85, fontSize: 11, fontFace: FT, color: C.text, paraSpaceAfter: 2, margin: 0 });

  footer(s, 17);
}

// ============================================================
// === 18: Roadmap ===
// ============================================================
{
  const s = pres.addSlide();
  s.background = { color: C.white };
  logo(s);
  header(s, 17, 'ROADMAP  ／  ロードマップ', '教科書 v0.1 → 国内学会 → 国際投稿 までの想定線');

  const tlY = 3.4;
  s.addShape(pres.shapes.LINE, { x: 0.8, y: tlY, w: 11.7, h: 0, line: { color: C.gray, width: 1.5 } });

  const milestones = [
    { x: 1.2, y: tlY, label: '2026 Q2', title: '教科書 v0.1', desc: '骨子と第 I 部', color: C.blue, top: true },
    { x: 3.0, y: tlY, label: '2026 Q3', title: '9 社 retro-fit', desc: '実証パターン抽出', color: C.blueDark, top: false },
    { x: 4.8, y: tlY, label: '2026 Q4', title: '教科書 v0.5', desc: '三者構造・XRL 章', color: C.blue, top: true },
    { x: 6.6, y: tlY, label: '2027 Q1', title: '教科書 v1.0', desc: '全章揃う / NIMS 試用', color: C.blueDark, top: false },
    { x: 8.4, y: tlY, label: '2027 Q2', title: '国内学会発表', desc: '研究・イノベーション学会', color: C.blue, top: true },
    { x: 10.2, y: tlY, label: '2027 Q4', title: 'R&D Mgmt 投稿', desc: '国際カンファ準備', color: C.blueDark, top: false },
    { x: 12.0, y: tlY, label: '2028+', title: '国際ジャーナル', desc: 'Research Policy 等', color: C.gray, top: true }
  ];
  milestones.forEach(m => {
    s.addShape(pres.shapes.OVAL, { x: m.x - 0.13, y: m.y - 0.13, w: 0.26, h: 0.26, fill: { color: m.color }, line: { color: C.white, width: 2 } });
    if (m.top) {
      s.addShape(pres.shapes.LINE, { x: m.x, y: m.y - 0.15, w: 0, h: -0.7, line: { color: m.color, width: 1 } });
      s.addText(m.label, { x: m.x - 1.0, y: m.y - 1.6, w: 2.0, h: 0.3, fontSize: 11, fontFace: FT, color: m.color, bold: true, align: 'center', margin: 0 });
      s.addText(m.title, { x: m.x - 1.0, y: m.y - 1.25, w: 2.0, h: 0.35, fontSize: 12, fontFace: FT, color: C.gray, bold: true, align: 'center', margin: 0 });
      s.addText(m.desc, { x: m.x - 1.0, y: m.y - 0.9, w: 2.0, h: 0.3, fontSize: 9, fontFace: FT, color: C.textMuted, align: 'center', margin: 0 });
    } else {
      s.addShape(pres.shapes.LINE, { x: m.x, y: m.y + 0.15, w: 0, h: 0.7, line: { color: m.color, width: 1 } });
      s.addText(m.label, { x: m.x - 1.0, y: m.y + 0.85, w: 2.0, h: 0.3, fontSize: 11, fontFace: FT, color: m.color, bold: true, align: 'center', margin: 0 });
      s.addText(m.title, { x: m.x - 1.0, y: m.y + 1.2, w: 2.0, h: 0.35, fontSize: 12, fontFace: FT, color: C.gray, bold: true, align: 'center', margin: 0 });
      s.addText(m.desc, { x: m.x - 1.0, y: m.y + 1.55, w: 2.0, h: 0.3, fontSize: 9, fontFace: FT, color: C.textMuted, align: 'center', margin: 0 });
    }
  });

  s.addShape(pres.shapes.RECTANGLE, { x: 0.6, y: 5.85, w: 12.1, h: 1.05, fill: { color: C.graySoft }, line: { type: 'none' } });
  s.addText('並行トラック', { x: 0.8, y: 5.95, w: 11.7, h: 0.3, fontSize: 11, fontFace: FT, color: C.blue, bold: true, charSpacing: 3, margin: 0 });
  s.addText('• AMD OS への実装 (cron / Supabase): 数式が落ちる度に View に反映\n• NIMS 試験導入 (2026 Q2-) ＝ 教科書のテストケース\n• まさDB / Personal OS との連携: 設計判断を逐次蓄積',
    { x: 0.8, y: 6.2, w: 11.7, h: 0.7, fontSize: 10.5, fontFace: FT, color: C.text, paraSpaceAfter: 2, margin: 0 });

  footer(s, 18);
}

// ============================================================
// === 19: Open questions ===
// ============================================================
{
  const s = pres.addSlide();
  s.background = { color: C.white };
  logo(s);
  header(s, 18, 'OPEN QUESTIONS  ／  次のディスカッション論点', 'まさと詰めたい意思決定ポイント');

  const questions = [
    { id: 'A', title: '読者の解像度', body: 'URA 向け教科書の想定読者は NIMS の URA / EIR で良いか？ 愛媛大・科学大の研究者まで広げるか？\n読者像で章の難易度・記法・前提知識が変わる。', color: C.blue },
    { id: 'B', title: '初稿の置き場', body: 'PDF / Notion / GitBook / Zenn book のどれにするか。\n原稿管理 (Markdown 正本 + 数式) と公開フォーマットを分離する設計が良さそう。', color: C.blueDark },
    { id: 'C', title: 'A_CEO / A_seed の観測', body: '「CEO 候補プールの availability」「シーズ availability」を AMD 内部でどうデータ化するか。\nまさの頭の中にある人材リスト・大学訪問ログがソースになる？', color: C.gray },
    { id: 'D', title: '理論先行 vs データ先行', body: '9 社 retro-fit を先にやる (motivating empirical pattern) か、理論を先に書く (deductive) か。\nまさの好みで進め方が大きく変わる。', color: C.blue },
    { id: 'E', title: 'プロトコル既存資料との接続', body: '`amd_os_vision.md` の 4 要素・3 ステップとの整合性。\n既存の営業ストーリーを壊さず、数理化の層を上に重ねる方が安全。', color: C.blueDark },
    { id: 'F', title: '卒業動学と BWE の教訓', body: 'BWE の取締役解任議案問題 (ガバナンス成熟度不足) を、卒業動学 R(t) の制約条件としてどう埋め込むか。', color: C.gray }
  ];
  questions.forEach((q, i) => {
    const col = i % 3, row = Math.floor(i / 3);
    const x = 0.6 + col * 4.05, y = 1.55 + row * 2.65;
    const w = 3.9, h = 2.45;
    s.addShape(pres.shapes.RECTANGLE, { x, y, w, h, fill: { color: C.white }, line: { color: C.grayBorder, width: 0.75 } });
    s.addShape(pres.shapes.RECTANGLE, { x, y, w, h: 0.08, fill: { color: q.color }, line: { type: 'none' } });
    s.addShape(pres.shapes.OVAL, { x: x + 0.25, y: y + 0.25, w: 0.55, h: 0.55, fill: { color: q.color }, line: { type: 'none' } });
    s.addText(q.id, { x: x + 0.25, y: y + 0.25, w: 0.55, h: 0.55, fontSize: 16, fontFace: FT, color: C.white, bold: true, align: 'center', valign: 'middle', margin: 0 });
    s.addText(q.title, { x: x + 0.95, y: y + 0.3, w: w - 1.1, h: 0.5, fontSize: 14, fontFace: FT, color: C.gray, bold: true, valign: 'middle', margin: 0 });
    s.addText(q.body, { x: x + 0.25, y: y + 0.95, w: w - 0.5, h: 1.4, fontSize: 10.5, fontFace: FT, color: C.text, margin: 0 });
  });

  footer(s, 19);
}

pres.writeFile({ fileName: OUT_PPTX })
  .then(() => console.log(`OK ${TOTAL} slides written (${VERSION}) → ${OUT_PPTX}`))
  .catch(e => { console.error(e); process.exit(1); });
