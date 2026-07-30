#!/usr/bin/env node
"use strict";
/**
 * Contract checks for pwa/bzm/theory-graph/*.md (BZM 2.0 theory graph nodes).
 * Deliberately re-implements a minimal frontmatter parser independent of
 * pwa/src/lib/bzm-theory-graph.ts so this script verifies the on-disk file
 * contract rather than trusting the same parsing code twice.
 */
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

const GRAPH_DIR = path.join(__dirname, "..", "bzm", "theory-graph");
const BZM_DIR = path.join(__dirname, "..", "bzm");

const NODE_KINDS = ["concept", "claim", "measure", "decision", "source", "question"];
const NODE_LAYERS = [
  "cross-layer",
  "evidence",
  "diagnosis",
  "prediction",
  "decision",
  "institution",
  "portfolio",
];
const NODE_STATUSES = [
  "established",
  "conditional",
  "design-choice",
  "hypothesis",
  "refuted",
  "unknown",
];
const RELATION_TYPES = [
  "defines",
  "supports",
  "challenges",
  "refutes",
  "depends_on",
  "supersedes",
  "operationalizes",
  "tests",
];

function stripQuotes(value) {
  const trimmed = value.trim();
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseNode(raw, file) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  assert.ok(match, `${file}: frontmatter delimiter (---) not found`);
  const [, frontmatter] = match;
  const lines = frontmatter.split(/\r?\n/);
  const scalars = {};
  const relations = [];
  let inRelations = false;
  let pendingType = null;

  for (const line of lines) {
    if (line.trim() === "") continue;
    if (/^relations:\s*$/.test(line)) {
      inRelations = true;
      continue;
    }
    if (inRelations) {
      const typeMatch = line.match(/^\s*-\s*type:\s*(\S+)\s*$/);
      const targetMatch = line.match(/^\s*target:\s*(\S+)\s*$/);
      if (typeMatch) {
        pendingType = typeMatch[1];
        continue;
      }
      if (targetMatch && pendingType) {
        relations.push({ type: pendingType, target: targetMatch[1] });
        pendingType = null;
        continue;
      }
      inRelations = false;
    }
    const scalarMatch = line.match(/^([A-Za-z_]+):\s*(.*)$/);
    if (scalarMatch) {
      scalars[scalarMatch[1]] = stripQuotes(scalarMatch[2]);
    }
  }

  return { scalars, relations };
}

assert.ok(fs.existsSync(GRAPH_DIR), `theory-graph directory not found: ${GRAPH_DIR}`);
const files = fs.readdirSync(GRAPH_DIR).filter((f) => f.endsWith(".md")).sort();
assert.ok(files.length >= 15, `expected at least 15 theory-graph nodes, found ${files.length}`);

const REQUIRED_FIELDS = ["id", "title", "kind", "layer", "status", "summary", "source_ref"];
const seenIds = new Set();
const parsedNodes = [];

for (const file of files) {
  const filePath = path.join(GRAPH_DIR, file);
  const raw = fs.readFileSync(filePath, "utf8");
  const { scalars, relations } = parseNode(raw, file);

  for (const field of REQUIRED_FIELDS) {
    assert.ok(scalars[field], `${file}: missing required frontmatter field "${field}"`);
  }
  assert.equal(scalars.id, path.basename(file, ".md"), `${file}: frontmatter id must match filename`);
  assert.ok(!seenIds.has(scalars.id), `${file}: duplicate id "${scalars.id}"`);
  seenIds.add(scalars.id);

  assert.ok(NODE_KINDS.includes(scalars.kind), `${file}: invalid kind "${scalars.kind}"`);
  assert.ok(NODE_LAYERS.includes(scalars.layer), `${file}: invalid layer "${scalars.layer}"`);
  assert.ok(NODE_STATUSES.includes(scalars.status), `${file}: invalid status "${scalars.status}"`);
  for (const relation of relations) {
    assert.ok(
      RELATION_TYPES.includes(relation.type),
      `${file}: invalid relation type "${relation.type}" (target ${relation.target})`
    );
  }

  const relationKeys = new Set();
  for (const relation of relations) {
    const key = `${relation.type}\u0000${relation.target}`;
    assert.ok(!relationKeys.has(key), `${file}: duplicate relation "${relation.type}" -> "${relation.target}"`);
    relationKeys.add(key);
  }

  const internalSourcePaths = [...scalars.source_ref.matchAll(/([A-Za-z0-9_./-]+\.md)(?=[#;\s]|$)/g)]
    .map((match) => match[1]);
  assert.ok(internalSourcePaths.length > 0, `${file}: source_ref must include an in-repo BZM Markdown path`);
  for (const sourcePath of internalSourcePaths) {
    const resolvedSourcePath = path.resolve(BZM_DIR, sourcePath);
    assert.ok(
      resolvedSourcePath.startsWith(`${BZM_DIR}${path.sep}`),
      `${file}: source_ref escapes the BZM directory: "${sourcePath}"`
    );
    assert.ok(fs.existsSync(resolvedSourcePath), `${file}: source_ref does not exist: "${sourcePath}"`);
  }

  parsedNodes.push({ file, scalars, relations });
}

for (const node of parsedNodes) {
  for (const relation of node.relations) {
    assert.ok(
      seenIds.has(relation.target),
      `${node.file}: relation target "${relation.target}" does not exist among parsed nodes`
    );
  }
}

// Seed-content coverage: the requirements brief lists topics that must each
// have a dedicated node. Check by id substring rather than exact id so the
// contract survives minor renames.
const REQUIRED_ID_SUBSTRINGS = [
  "six-layer",
  "sps-ordinal",
  "measurement-separation",
  "old-two-layer-noncommutativity",
  "phi-gh",
  "p1-conditional",
  "purpose-specific-go",
  "wait-return",
  "time-fixed",
  "prospective",
  "ecr-three-layers",
  "amd-stakeholder",
  "rt-staged-deal",
  "portfolio-allocation",
  "jrc",
  "nist",
  "camuffo",
  "tto",
];
for (const substring of REQUIRED_ID_SUBSTRINGS) {
  assert.ok(
    [...seenIds].some((id) => id.includes(substring)),
    `missing required seed node covering "${substring}"`
  );
}

// The old Book A theorem must be recorded as refuted, and the P1 draft
// theorem must be recorded as conditional — these must not be collapsed
// into a single status (see BOOK_DECISIONS.md D-062).
const oldTheorem = parsedNodes.find((n) => n.scalars.id.includes("old-two-layer-noncommutativity"));
assert.ok(oldTheorem, "old two-layer non-commutativity theorem node missing");
assert.equal(
  oldTheorem.scalars.status,
  "refuted",
  'old two-layer non-commutativity theorem must have status "refuted"'
);

const p1 = parsedNodes.find((n) => n.scalars.id.includes("p1-conditional"));
assert.ok(p1, "P1 conditional theorem node missing");
assert.equal(p1.scalars.status, "conditional", 'P1 draft theorem must have status "conditional"');
assert.notEqual(
  p1.scalars.id,
  oldTheorem.scalars.id,
  "P1 draft theorem and the old Book A theorem must be distinct nodes"
);

// External academic sources must use an evidentiary relation such as
// supports/challenges/refutes, never "defines".
const sourceNodes = parsedNodes.filter((n) => n.scalars.kind === "source");
assert.ok(sourceNodes.length >= 4, `expected at least 4 source nodes, found ${sourceNodes.length}`);
for (const node of sourceNodes) {
  const hasDefines = node.relations.some((r) => r.type === "defines");
  assert.ok(!hasDefines, `${node.file}: external source node must not use "defines"`);
}

console.log(
  `ok - ${files.length} bzm theory-graph nodes validated (${seenIds.size} unique ids, ${
    parsedNodes.reduce((sum, n) => sum + n.relations.length, 0)
  } relations, contract checks passed)`
);
