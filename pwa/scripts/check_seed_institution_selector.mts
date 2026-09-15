import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  applySeedInstitutionSelection,
  seedOrgTypeFromInstitutionType,
  type SeedInstitutionOption,
} from "../src/lib/seed-institution-form.ts";

const institutions: SeedInstitutionOption[] = [
  {
    institution_id: "inst_kute",
    name: "工学院大学",
    type: "university",
    region: "東京都",
  },
  {
    institution_id: "inst_national",
    name: "国立研究開発法人テスト研究所",
    type: "research_institute",
    region: "茨城県",
  },
];

const selected = applySeedInstitutionSelection(
  { org_name: "旧名称", org_type: "other", org_region: null },
  institutions,
  "inst_kute",
);
assert.deepEqual(selected, {
  org_name: "工学院大学",
  org_type: "university",
  org_region: "東京都",
  institution_id: "inst_kute",
});

const unlinked = applySeedInstitutionSelection(
  { institution_id: "inst_kute", org_name: "工学院大学" },
  institutions,
  null,
);
assert.equal(unlinked.institution_id, null);
assert.equal(unlinked.org_name, "工学院大学");

assert.equal(seedOrgTypeFromInstitutionType("research_institute"), "national_lab");
assert.equal(seedOrgTypeFromInstitutionType("unknown"), "other");
assert.deepEqual(
  applySeedInstitutionSelection({}, institutions, "missing"),
  {},
  "unknown institution IDs must not be written from the UI",
);

const modal = await readFile(
  new URL("../src/components/seeds/SeedDetailModal.tsx", import.meta.url),
  "utf8",
);
assert.match(modal, /fetchSeedInstitutionOptions/);
assert.match(modal, /aria-label="研究機関カタログ"/);
assert.match(modal, /value=\{draft\.institution_id \?\? ""\}/);
assert.match(modal, /applySeedInstitutionSelection\(/);
assert.match(modal, /readOnly=\{Boolean\(draft\.institution_id\)\}/);
assert.match(modal, /institution_id: draft\.institution_id \?\? null/);

console.log("seed institution selector contract: OK");
