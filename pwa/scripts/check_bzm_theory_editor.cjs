#!/usr/bin/env node
"use strict";
/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

const root = path.join(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

const migration = read("scripts/migrations/203_bzm_theory_editor.sql");
const store = read("src/lib/bzm-theory-store.ts");
const api = read("src/app/api/bzm/theory-map/route.ts");
const view = read("src/components/bzm/BzmTheoryMapView.tsx");
const composer = read("src/components/bzm/BzmTheoryComposerDialog.tsx");

for (const value of [
  "concept", "claim", "measure", "decision", "source", "question",
  "cross-layer", "evidence", "diagnosis", "prediction", "institution", "portfolio",
  "established", "conditional", "design-choice", "hypothesis", "refuted", "unknown",
  "defines", "supports", "challenges", "refutes", "depends_on", "supersedes",
  "operationalizes", "tests", "raises",
]) {
  assert.ok(migration.includes(`'${value}'`), `migration allowlist missing ${value}`);
}

const nodeSeedSection = migration.split("-- Seed: 21 nodes")[1].split("-- Seed: 34 relations")[0];
const edgeSeedSection = migration.split("-- Seed: 34 relations")[1];
assert.equal((nodeSeedSection.match(/\n\(\n  '[^']+'/g) ?? []).length, 21, "migration must seed 21 nodes");
assert.equal((edgeSeedSection.match(/\('[^']+', '[^']+', '[^']+', 'seed'\)/g) ?? []).length, 34, "migration must seed 34 edges");
assert.match(nodeSeedSection, /ON CONFLICT \(id\) DO NOTHING/);
assert.match(edgeSeedSection, /ON CONFLICT \(from_node_id, relation_type, to_node_id\) DO NOTHING/);
assert.match(migration, /public\.is_admin\(\)/);
assert.match(migration, /ENABLE ROW LEVEL SECURITY/);
assert.match(migration, /bzm_theory_edges_value_limits/);
assert.match(migration, /from_node_id <> to_node_id/);
assert.match(migration, /validate_bzm_theory_edge/);
assert.match(migration, /raises edge target must be an active question node/);
assert.match(migration, /validate_bzm_theory_node_kind/);

assert.match(api, /requireMember\(\)/, "GET must authenticate an AMD member");
assert.equal((api.match(/requireAdmin\(\)/g) ?? []).length, 3, "all three mutation methods must require admin");
assert.match(api, /function isRecord\(value: unknown\)/, "mutation JSON bodies must reject null and arrays");
for (const contract of [
  "createNodeWithOptionalEdge", "createEdge", "updateNode", "deleteEdge",
  "compensation delete failed", "UUID_PATTERN", "THEORY_RELATION_TYPES",
]) {
  assert.ok(store.includes(contract), `store contract missing ${contract}`);
}

for (const label of [
  "理論を書く", "このノードを育てる", "根拠をつなぐ", "異論をつなぐ",
  "論点を残す", "既存ノードとつなぐ", "残っている論点",
]) {
  assert.ok(view.includes(label) || composer.includes(label), `editor UI missing ${label}`);
}
assert.match(composer, /接続のプレビュー/);
assert.match(composer, /showCloseButton=\{false\}/);
assert.match(composer, /sourceRef: form\.sourceRef,/);
assert.match(composer, /requiredTextMissing/);

console.log("ok - BZM theory editor migration, auth, mutation and UI contracts passed");
