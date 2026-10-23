import assert from "node:assert/strict";
import { formatAgreementRevisionProposal } from "../src/lib/monthly-agreement-revision-proposal.ts";
import type { MonthlyWorkAgreementProject } from "../src/lib/monthly-work-agreement-types.ts";

const project = {
  projectId: "p19",
  projectName: "ZMP",
  expectedRewardYen: 23300,
  milestones: [{ milestoneId: "ms-hydrogen", title: "水素 助成金・補助金申請", plannedShare: 0.65 }],
} as MonthlyWorkAgreementProject;

const body = formatAgreementRevisionProposal({
  milestoneId: "ms-hydrogen",
  requestedSharePct: 100,
  additionalWork: "OkuDoor商品開発用の補助金申請を担当する",
  amountChoice: "recalculate",
  requestedAmountYen: null,
  detail: "水素関連とは別の業務として扱う",
}, project);
assert.match(body, /担当割合：65% → 100%/);
assert.match(body, /MSにない追加業務：OkuDoor/);
assert.match(body, /現在の合意予定額：23,300円/);
assert.match(body, /変更内容を反映した計算結果を確認したい/);
assert.throws(() => formatAgreementRevisionProposal({
  milestoneId: "ms-hydrogen", requestedSharePct: 65, additionalWork: "", amountChoice: "recalculate",
  requestedAmountYen: null, detail: "",
}, project), /同じ/);
assert.throws(() => formatAgreementRevisionProposal({
  milestoneId: null, requestedSharePct: null, additionalWork: "", amountChoice: "specific",
  requestedAmountYen: null, detail: "",
}, project), /希望する合意予定額/);
const amountOnly = formatAgreementRevisionProposal({
  milestoneId: null, requestedSharePct: null, additionalWork: "", amountChoice: "specific",
  requestedAmountYen: 25000, detail: "",
}, project);
assert.match(amountOnly, /希望する合意予定額：25,000円/);
console.log("monthly agreement revision proposal: ok");
