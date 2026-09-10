#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import {
  assertProposalLimit,
  buildQuestionTreeClientToken,
  isUuid,
  proposalCount,
} from "./question_tree_outbox_contract.mjs";

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function tokenize(payload) {
  const projectId = cleanText(payload.projectId);
  const defaultSourceRef = cleanText(payload.sourceRef);
  if (!projectId) throw new Error("projectId が無い");
  assertProposalLimit(payload);
  if (proposalCount(payload) === 0) throw new Error("候補が0件のoutboxは作れない");

  const groups = [
    { key: "questions", kind: "question", contentKey: "title" },
    { key: "actions", kind: "action", contentKey: "title" },
    { key: "findings", kind: "finding", contentKey: "summary" },
  ];
  for (const group of groups) {
    if (!Array.isArray(payload[group.key])) continue;
    for (const item of payload[group.key]) {
      const reason = cleanText(item.proposalReason);
      const originRef = cleanText(item.originRef) || defaultSourceRef;
      const proposedId = cleanText(
        group.kind === "question" ? item.proposedParentId : item.proposedQuestionId,
      );
      if (!reason) throw new Error(`${group.kind} に proposalReason が無い`);
      if (!originRef) throw new Error(`${group.kind} に originRef が無い`);
      if (!isUuid(proposedId)) throw new Error(`${group.kind} の親候補が UUID ではない`);
      if (
        group.kind === "question" &&
        !["required", "alternative"].includes(item.proposedContribution)
      ) {
        throw new Error("question に proposedContribution が無い");
      }
      if (isUuid(item.clientToken)) continue;
      item.clientToken = buildQuestionTreeClientToken({
        projectId,
        sourceRef: originRef,
        kind: group.kind,
        content: item[group.contentKey],
      });
    }
  }
  return payload;
}

const file = process.argv[2];
if (!file) {
  console.error("使い方: node scripts/question_tree_outbox_tokenize.mjs <outbox.json>");
  process.exit(1);
}

const absolute = path.resolve(file);
const payload = tokenize(JSON.parse(fs.readFileSync(absolute, "utf8")));
const temporary = `${absolute}.tmp-${process.pid}`;
fs.writeFileSync(temporary, `${JSON.stringify(payload, null, 2)}\n`, { mode: 0o600 });
fs.renameSync(temporary, absolute);
console.log(`client token を確定: ${absolute}`);
