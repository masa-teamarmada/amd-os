// ビジネスモデルのピクト図 (```pictogram) の契約チェック。
// 定義の検査・矢印の並び・添え書きの重なりを確かめ、SOL の本番の図 (migration 443) が重ならずに並ぶことを確かめる。
// 仕様: pwa/spec/3-20-project-technology-current-spec.md §5.6
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  PICTOGRAM_HEIGHT,
  PICTOGRAM_MIN_SCALE,
  PICTOGRAM_WIDTH,
  describePictogramFlow,
  estimateLabelBox,
  layoutPictogram,
  parsePictogram,
  pictogramFitScale,
  rectsOverlap,
  segmentHitsRect,
} from "../src/lib/pictogram.ts";

const pwaDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel: string) => fs.readFileSync(path.join(pwaDir, rel), "utf8");

function parseOk(source: unknown) {
  const r = parsePictogram(typeof source === "string" ? source : JSON.stringify(source));
  assert.ok(r.ok, r.ok ? "" : r.error);
  return r.pictogram;
}
function parseNg(source: unknown, pattern: RegExp) {
  const r = parsePictogram(typeof source === "string" ? source : JSON.stringify(source));
  assert.equal(r.ok, false, `読めてはいけない定義が読めた: ${String(source).slice(0, 80)}`);
  if (!r.ok) assert.match(r.error, pattern);
}

// ---- 定義の検査
const two = (extra: Record<string, unknown> = {}) => ({
  nodes: [
    { id: "a", cell: "c", icon: "self", label: "自社" },
    { id: "b", cell: "r", icon: "factory", label: "顧客" },
  ],
  flows: [
    { from: "a", to: "b", kind: "goods", label: "装置" },
    { from: "b", to: "a", kind: "money", label: "代金" },
  ],
  ...extra,
});
parseOk(two());
parseNg("{", /JSON/);
parseNg([], /nodes/);
parseNg({ nodes: [] }, /nodes/);
parseNg({ nodes: [{ id: "a", cell: "x", label: "A" }] }, /cell/);
parseNg({ nodes: [{ id: "a", cell: "c", label: "A" }, { id: "b", cell: "c", label: "B" }] }, /cell「c」/);
parseNg({ nodes: [{ id: "a", cell: "c", label: "A" }, { id: "a", cell: "r", label: "B" }] }, /重なって/);
parseNg({ nodes: [{ id: "a", cell: "c", label: "A", icon: "robot" }] }, /icon/);
parseNg({ nodes: [{ id: "a", cell: "c", label: "とても長いヒトの名前です" }] }, /10 字まで/);
parseNg(two({ flows: [{ from: "a", to: "z", kind: "goods", label: "装置" }] }), /to「z」/);
parseNg(two({ flows: [{ from: "a", to: "a", kind: "goods", label: "装置" }] }), /同じヒト/);
parseNg(two({ flows: [{ from: "a", to: "b", kind: "info", label: "装置" }] }), /goods/);
parseNg(two({ flows: [{ from: "a", to: "b", kind: "goods" }] }), /label/);
parseNg(
  two({ flows: Array.from({ length: 4 }, (_, i) => ({ from: "a", to: "b", kind: "goods", label: `装置${i}` })) }),
  /3 本まで/,
);

// 計画中のヒトにつながる流れは、書かなくても計画中（破線）になる
{
  const p = parseOk({
    nodes: [
      { id: "a", cell: "c", icon: "self", label: "自社" },
      { id: "b", cell: "tr", label: "将来の顧客", planned: true },
    ],
    flows: [{ from: "a", to: "b", kind: "goods", label: "燃料" }],
  });
  assert.equal(p.flows[0].planned, true);
  assert.equal(p.nodes[0].icon, "self");
  assert.equal(describePictogramFlow(p, p.flows[0]), "自社 → 将来の顧客：燃料（これから）");
}

// ---- 配置: 先に書いた流れほど上（縦並びは左）。id の並びに左右されない
{
  for (const ids of [["a", "b"], ["z", "b"]]) {
    const [self, other] = ids;
    const p = parseOk({
      nodes: [
        { id: self, cell: "c", icon: "self", label: "自社" },
        { id: other, cell: "r", label: "顧客" },
        { id: "t1", cell: "t", label: "上" },
      ],
      flows: [
        { from: self, to: other, kind: "goods", label: "装置" },
        { from: other, to: self, kind: "money", label: "代金" },
        { from: "t1", to: self, kind: "goods", label: "部品" },
        { from: self, to: "t1", kind: "money", label: "支払い" },
      ],
    });
    const l = layoutPictogram(p);
    const [goods, money, parts, pay] = l.flows;
    assert.ok(goods.y1 < money.y1, `横並びの1本目が上に来ない (${ids})`);
    assert.ok(goods.x1 < goods.x2 && money.x1 > money.x2, "矢印の向きが from → to になっていない");
    assert.ok(parts.x1 < pay.x1, `縦並びの1本目が左に来ない (${ids})`);
    assert.ok(parts.y1 < parts.y2 && pay.y1 > pay.y2, "縦の矢印の向きが from → to になっていない");
  }
}

// ---- 添え書きの箱の見積もり
{
  const one = estimateLabelBox("回収した金属", 150);
  assert.equal(one.lines, 1);
  const wrapped = estimateLabelBox("装置代・定期利用料・保守料", 124);
  assert.equal(wrapped.lines, 2);
  assert.equal(wrapped.w, 124);
  assert.ok(segmentHitsRect(0, 0, 10, 10, { x: 4, y: 4, w: 2, h: 2 }));
  assert.ok(!segmentHitsRect(0, 0, 10, 0, { x: 4, y: 1, w: 2, h: 2 }));
}

// ---- 枠の幅に合わせた縮尺: ノートPC (枠 約800px) では全体が収まる。スマホは実寸で横に動かす
{
  assert.equal(pictogramFitScale(null), 1, "測る前は実寸");
  assert.equal(pictogramFitScale(1099), 1, "枠が広ければ実寸");
  assert.equal(pictogramFitScale(953), 0.953);
  const laptop = pictogramFitScale(792);
  assert.ok(laptop < 1 && PICTOGRAM_WIDTH * laptop <= 792, "ノートPCの枠 (792px) に図の幅が収まる");
  assert.equal(pictogramFitScale(660), PICTOGRAM_MIN_SCALE, "縮めすぎない");
  assert.equal(pictogramFitScale(343), 1, "スマホは縮めずに横に動かす");
  for (const w of [640, 700, 777.7, 800, 999]) {
    const s = pictogramFitScale(w);
    assert.ok(PICTOGRAM_WIDTH * s <= Math.max(w, PICTOGRAM_WIDTH * PICTOGRAM_MIN_SCALE), `縮めた図が枠 ${w}px を超えない`);
  }
}

// ---- SOL の本番の図: migration の本文から ```pictogram を取り出して並べる
{
  const migrations = fs.readdirSync(path.join(pwaDir, "scripts/migrations")).filter((f) => /_sol_business_model_pictogram\.sql$/.test(f));
  assert.equal(migrations.length, 1, "SOL のピクト図の migration が見つからない");
  const sql = read(`scripts/migrations/${migrations[0]}`);
  const block = sql.match(/```pictogram\n([\s\S]*?)\n```/);
  assert.ok(block, "migration の本文に ```pictogram がない");
  const p = parseOk(block[1]);
  assert.equal(p.nodes.find((n) => n.cell === "c")?.icon, "self", "真ん中は自社");
  assert.ok(p.flows.some((f) => f.kind === "money") && p.flows.some((f) => f.kind === "goods"));
  const l = layoutPictogram(p);
  assert.equal(l.laneCrossings, 0, "矢印がほかのヒトの枠を横切っている");
  const cards = l.nodes.map((n) => n.rect);
  for (const [i, f] of l.flows.entries()) {
    const name = describePictogramFlow(p, f.flow);
    assert.equal(f.collisions, 0, `添え書きが重なっている: ${name}`);
    const b = f.label;
    assert.ok(b.x >= 0 && b.y >= 0 && b.x + b.w <= PICTOGRAM_WIDTH && b.y + b.h <= PICTOGRAM_HEIGHT, `添え書きが図の外: ${name}`);
    for (const c of cards) assert.ok(!rectsOverlap(b, c), `添え書きがヒトの枠に重なる: ${name}`);
    for (const [j, g] of l.flows.entries()) {
      if (i !== j) assert.ok(!rectsOverlap(b, g.label), `添え書き同士が重なる: ${name} / ${describePictogramFlow(p, g.flow)}`);
    }
  }
  // 書き換え後の本文に、旧い mermaid の図と「菌の工程」の言い回しを残さない
  const body = sql.match(/body_md = \$ov\$([\s\S]*?)\$ov\$/);
  assert.ok(body, "migration に概要の本文 ($ov$) がない");
  assert.ok(body[1].includes(block[0]), "ピクト図は概要の本文の中に置く");
  assert.doesNotMatch(body[1], /```mermaid|菌の工程/);
}

// ---- 画面の配線
{
  const md = read("src/components/cockpit/MarkdownView.tsx");
  assert.match(md, /language-pictogram/);
  assert.match(md, /<PictogramDiagram code=\{plainText\(children\)\} tone=\{tone\} \/>/);
  assert.match(md, /language-\(\?:mermaid\|pictogram\)/);
  const view = read("src/components/cockpit/PictogramDiagram.tsx");
  for (const anchor of [
    'data-testid="pictogram-diagram"',
    'data-testid="pictogram-flow-list"',
    "JapaneseYen",
    'goods: "#2a78d6"',
    'money: "#eb6834"',
    "strokeDasharray={f.flow.planned",
    "ピクト図の定義を読めない",
    "pictogramFitScale(avail, layout.width)",
    'data-testid="pictogram-size-toggle"',
    "new ResizeObserver(update)",
  ]) {
    assert.ok(view.includes(anchor), `PictogramDiagram.tsx に ${anchor} がない`);
  }
}

console.log("pictogram contract: ok");
