import assert from "node:assert/strict";

import {
  anchoredExpectedCumPctForYm,
  effectiveCumPctForYm,
} from "../src/lib/ms-schedule-shared.ts";

const preStartAnchor = { ym: "202604", pct: 0 };

assert.equal(
  anchoredExpectedCumPctForYm("202609", "202609", "202612", preStartAnchor),
  25,
  "pre-start 0% anchor should not make the start month 100%"
);
assert.equal(
  anchoredExpectedCumPctForYm("202610", "202609", "202612", preStartAnchor),
  50,
  "pre-start anchor should continue as normal pro-rata after start"
);
assert.equal(
  effectiveCumPctForYm("202609", "202609", "202612", preStartAnchor, null),
  25,
  "effective pct should keep the same pro-rata floor for pre-start anchors"
);
assert.equal(
  anchoredExpectedCumPctForYm("202607", "202605", "202610", { ym: "202606", pct: 20 }),
  36.7,
  "in-period anchors should keep their existing month-after-anchor behavior"
);

console.log("ok ms schedule anchor boundary");
