import assert from "node:assert/strict";
import { amieListStatus, amieListCategoryTone, amieListDelta } from "../src/lib/amie-list-signals.ts";

for (const state of ["active","on_track","running","in_progress","sales"]) {
  assert.equal(amieListStatus(state).tone,"progress",`${state}は進行であり完了ではない`);
  assert.notEqual(amieListStatus(state).mark,"✓");
}
for (const state of ["completed","signed","paid","verified"]) assert.equal(amieListStatus(state).tone,"complete");
for (const state of [null,undefined,"", "unassessed","unknown","new-domain-state"]) assert.equal(amieListStatus(state).tone,"neutral");
assert.equal(amieListStatus(null).mark,"?");
assert.equal(amieListStatus("invited").label,"初回ログイン待ち");
assert.equal(amieListStatus("invited").tone,"warning");
assert.equal(amieListStatus("released","締結版照合待ち","warning").tone,"warning");
assert.equal(amieListStatus("failed").tone,"critical");
assert.equal(amieListStatus("passed","見送り").tone,"neutral","VCの見送りを技術試験の合格と混同しない");
assert.equal(amieListStatus("pending","未合意").tone,"warning","必要な合意の未確認を中立の待機へ潰さない");
assert.equal(amieListStatus("payment_confirmed","着金確認").tone,"complete");
assert.equal(amieListCategoryTone("未分類"),"neutral");
assert.equal(amieListCategoryTone("大学"),amieListCategoryTone("大学"));
assert.equal(amieListCategoryTone("ＡＩ"),amieListCategoryTone("AI"));
for (const value of [null,undefined,NaN,Infinity]) assert.equal(amieListDelta(value).direction,"unknown");
assert.equal(amieListDelta(0).direction,"flat");
assert.equal(amieListDelta(10).direction,"up");
assert.equal(amieListDelta(-10).direction,"down");
assert.equal(amieListDelta(10).tone,"neutral","増加という事実だけでは改善扱いにしない");
assert.equal(amieListDelta(-10,"worsen").tone,"complete");
assert.equal(amieListDelta(10,"worsen").tone,"warning");
assert.equal(amieListDelta(10,"improve").tone,"complete");
console.log("一覧の分類・状態・変化の意味検証: PASS");
