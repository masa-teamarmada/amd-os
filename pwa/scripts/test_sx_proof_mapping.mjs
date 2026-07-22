import assert from "node:assert/strict";
import {
  SX_PROOF_THEME_SLUGS,
  SX_PROOF_DEFINITIONS,
  SX_THEME_PROOF_MAP,
  SX_THEME_LABELS,
  computeSxProofOutcomes,
  sxThemeStatusInfos,
  sxProofThemeMatrix,
} from "../src/lib/sx-proof-mapping.ts";

// Every theme slug must be mapped and connect to at least one proof (spec 3.3.2: "証明先 未接続" must be an explicit, not accidental, state).
for (const slug of SX_PROOF_THEME_SLUGS) {
  assert.ok(SX_THEME_PROOF_MAP[slug], `${slug} is missing from SX_THEME_PROOF_MAP`);
  assert.ok(SX_THEME_PROOF_MAP[slug].length > 0, `${slug} must connect to at least one proof`);
  assert.ok(SX_THEME_LABELS[slug], `${slug} is missing a display label`);
}

// The matrix must be exactly 7 rows x 3 columns and match the map 1:1.
const matrix = sxProofThemeMatrix();
assert.equal(matrix.length, 7, "proof theme matrix must have 7 rows");
for (const row of matrix) {
  const proofIds = SX_PROOF_DEFINITIONS.map((definition) => definition.id);
  assert.equal(Object.keys(row.proofs).length, 3, `${row.slug} matrix row must have exactly 3 proof columns`);
  for (const id of proofIds) {
    assert.equal(row.proofs[id], SX_THEME_PROOF_MAP[row.slug].includes(id), `${row.slug} x ${id} matrix cell must mirror SX_THEME_PROOF_MAP`);
  }
}

// Every proof must be reachable from at least one theme (no orphaned proof).
for (const definition of SX_PROOF_DEFINITIONS) {
  const connected = SX_PROOF_THEME_SLUGS.filter((slug) => SX_THEME_PROOF_MAP[slug].includes(definition.id));
  assert.ok(connected.length > 0, `${definition.id} has no connected theme`);
}

const emptyBundle = { milestones: [], technicalTests: [] };

// All-unassessed input must never render as 0% evidence coverage — it must be null (displayed as 未評価).
{
  const outcomes = computeSxProofOutcomes(emptyBundle);
  assert.equal(outcomes.length, 3);
  for (const outcome of outcomes) {
    assert.equal(outcome.assessedCount, 0, `${outcome.id} should have 0 assessed themes with an empty bundle`);
    assert.equal(outcome.evidenceCoveragePct, null, `${outcome.id} evidence coverage must be null (not 0) when every theme is unassessed`);
    assert.ok(outcome.missingInfo.includes("関連テーマがすべて未評価"), `${outcome.id} must flag that every related theme is unassessed`);
  }
}

// A fully-assessed, fully-evidenced bundle must report 100% coverage, not null.
{
  const bundle = {
    milestones: [
      { slug: "tech-reactor-recheck", status: "completed", ownerLabel: "研究責任者", completionEvidence: "評価記録あり", forecastEnd: "2026-09-30", plannedEnd: "2026-09-30" },
      { slug: "tech-poc-gate", status: "completed", ownerLabel: "SX経営担当", completionEvidence: "PoC完了記録", forecastEnd: "2027-01-15", plannedEnd: "2026-12-18" },
    ],
    technicalTests: [
      { testSlug: "tech-performance-test", status: "passed", ownerLabel: "研究側", evidence: "性能試験記録", actual: "0.9" },
      { testSlug: "tech-reproducibility-test", status: "passed", ownerLabel: "研究側", evidence: "再現性試験記録", actual: "95%" },
      { testSlug: "tech-scale-test", status: "passed", ownerLabel: "研究側", evidence: "スケール試験記録", actual: "ok" },
      { testSlug: "tech-containment-test", status: "passed", ownerLabel: "研究側", evidence: "封じ込め試験記録", actual: "99%" },
      { testSlug: "tech-recovery-test", status: "passed", ownerLabel: "研究側", evidence: "回収試験記録", actual: "90%" },
    ],
  };
  const outcomes = computeSxProofOutcomes(bundle);
  for (const outcome of outcomes) {
    assert.equal(outcome.evidenceCoveragePct, 100, `${outcome.id} should be 100% evidence coverage when all connected themes have evidence`);
    assert.equal(outcome.assessedCount, outcome.totalCount, `${outcome.id} should have all connected themes assessed`);
    assert.deepEqual(outcome.missingInfo, [], `${outcome.id} should have no missing info when fully evidenced`);
  }
  const themeInfos = sxThemeStatusInfos(bundle);
  for (const theme of themeInfos.filter((item) => item.slug !== "tech-reactor-recheck" && item.slug !== "tech-poc-gate")) {
    assert.equal(theme.deadline, null, `${theme.slug} must not borrow the parent reactor milestone deadline`);
  }
}

console.log("sx-proof-mapping tests passed");
