import assert from "node:assert/strict";
import { governanceDriveFolderForTitle, governanceDriveFolderForType } from "../src/lib/governance-drive-folder.ts";

assert.equal(governanceDriveFolderForTitle("SolvioraX経営会議"), "0_経営会議");
assert.equal(governanceDriveFolderForTitle("CLG 取締役会（書面決議）"), "0_取締役会");
assert.equal(governanceDriveFolderForTitle("第7回定時株主総会"), "0_株主総会");
assert.equal(governanceDriveFolderForTitle("CLG 株主総会・取締役会"), null);
assert.equal(governanceDriveFolderForTitle("定例研究会"), null);
assert.equal(governanceDriveFolderForType("shareholder_written_resolution"), "0_株主総会");
assert.equal(governanceDriveFolderForType("agm"), "0_株主総会");
assert.equal(governanceDriveFolderForType("board_written_resolution"), "0_取締役会");
assert.equal(governanceDriveFolderForType("取締役決定（署名未確認）"), "0_取締役会");

console.log("governance Drive folder routing passed");
