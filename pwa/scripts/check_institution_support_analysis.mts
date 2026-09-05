// /institutions「分析」タブの集計契約。未確認を安全側へ数えないこと、分母が確認済みであること、地域寄せを検査する。
import assert from "node:assert/strict";
import {
  addStatus,
  buildStatusLookup,
  bucketAttribute,
  computeColumnRates,
  computeRegionMatrix,
  emptyCounts,
  rankGaps,
  rankInstitutions,
  regionBlockOf,
} from "../src/lib/institution-support-analysis.ts";

const column = (id: string, label: string) => ({
  policyItemId: id, key: id, label, fullLabel: label, description: null, group: "g", compareSort: 1, itemKind: "status" as const,
});
const columns = [column("a", "A"), column("b", "B")];
const institutions = [
  { institutionId: "i1", name: "香川大学", type: "university", region: "香川" },
  { institutionId: "i2", name: "筑波大学", type: "university", region: "茨城県つくば市" },
  { institutionId: "i3", name: "NIMS", type: "research_institute", region: null },
];
const cell = (institutionId: string, policyItemId: string, status: "established" | "drafting" | "not_started" | "unknown", value: string | null = null) => ({
  institutionId, policyItemId, status, value, note: null, sourceUrl: null, sourceType: "unknown" as const, confirmedAt: null,
});
const cells = [
  cell("i1", "a", "established"), cell("i1", "b", "not_started"),
  cell("i2", "a", "drafting"),    // i2:b は行なし = 未確認
  cell("i3", "a", "unknown"), cell("i3", "b", "established"),
];
const lookup = buildStatusLookup(cells);

// 1. 分母は確認済み。未確認は整備率に入らない
const rates = computeColumnRates(columns, institutions, lookup);
const a = rates.find((r) => r.column.policyItemId === "a")!.counts;
assert.equal(a.total, 3); assert.equal(a.unknown, 1); assert.equal(a.confirmed, 2); assert.equal(a.established, 1); assert.equal(a.rate, 0.5);
const b = rates.find((r) => r.column.policyItemId === "b")!.counts;
assert.equal(b.unknown, 1, "行が無いセルは未確認");
assert.equal(b.rate, 0.5);

// 2. 確認済み 0 なら率は null (0% と偽らない)
const c = emptyCounts(); addStatus(c, undefined); addStatus(c, "unknown");
assert.equal(c.rate, null);

// 3. 地域寄せ
assert.equal(regionBlockOf("香川"), "中国・四国");
assert.equal(regionBlockOf("茨城県つくば市"), "関東");
assert.equal(regionBlockOf(null), "不明");
const matrix = computeRegionMatrix(columns, institutions, lookup);
assert.deepEqual(matrix.map((r) => r.block), ["関東", "中国・四国", "不明"]);

// 4. 充実度は整備済みだけ。ギャップは未整備・検討中だけで、未確認を含めない
const ranked = rankInstitutions(columns, institutions, lookup);
assert.equal(ranked[0].institution.institutionId, "i1", "整備済み1 + 未整備1 の香川が先頭 (確認済み数で NIMS に勝つ)");
const i2 = ranked.find((r) => r.institution.institutionId === "i2")!;
assert.deepEqual(i2.gapColumns.map((x) => x.policyItemId), ["a"]);
assert.deepEqual(i2.unknownColumns.map((x) => x.policyItemId), ["b"]);
const gaps = rankGaps(ranked);
assert.ok(gaps.every((g) => g.gapColumns.length > 0));
assert.equal(gaps[0].institution.institutionId, "i1");

// 5. 属性の束ね方: 語彙の先頭一致、未確認は別集計
const item = { policyItemId: "p", key: "post_graduation_limit", label: "退職・卒業後期限", category: "c", itemKind: "attribute" as const, compareSort: null };
const values = new Map([["i1:p", { status: "established" as const, value: "3年以内（原則）" }], ["i2:p", { status: "established" as const, value: "3年以内" }], ["i3:p", { status: "unknown" as const, value: null }]]);
const bucketed = bucketAttribute(item, institutions, (i, p) => values.get(`${i}:${p}`), ["1年以内", "3年以内"]);
assert.equal(bucketed.confirmed, 2); assert.equal(bucketed.unknown, 1);
assert.deepEqual(bucketed.buckets, [{ label: "3年以内", count: 2, examples: ["香川大学", "筑波大学"] }]);

console.log("institution support analysis contract ok");
