import assert from "node:assert/strict";
import { splitMemberLinkedText } from "../src/lib/member-linking.ts";

const members = [
  { memberId: "ID001", codeName: "まさ" },
  { memberId: "ID006", codeName: "りり" },
  { memberId: "ID020", codeName: "かる" },
  { memberId: "ID021", codeName: "こう" },
];

function marker(input: string) {
  return splitMemberLinkedText(input, members)
    .map((part) => (typeof part === "string" ? part : `[${part.codeName}->${part.memberId}]`))
    .join("");
}

assert.equal(marker("しかるべきタイミング"), "しかるべきタイミング");
assert.equal(marker("こうして進める"), "こうして進める");
assert.equal(marker("こう修正する"), "こう修正する");
assert.equal(marker("AかるB"), "AかるB");
assert.equal(marker("りり、まさが進める"), "[りり->ID006]、[まさ->ID001]が進める");
assert.equal(marker("かるさんに共有"), "[かる->ID020]さんに共有");
assert.equal(marker("こう / りり"), "[こう->ID021] / [りり->ID006]");

console.log("[member-link-boundaries] ok");
