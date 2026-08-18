import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [cockpit, types, labels, migration] = await Promise.all([
  readFile(new URL("../src/components/cockpit/CockpitKuteSeeds.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/types/seeds.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/seeds-data.ts", import.meta.url), "utf8"),
  readFile(new URL("./migrations/286_ehm_seed_intake_and_contact_history.sql", import.meta.url), "utf8"),
]);

assert.match(cockpit, /scope === "all"[\s\S]*SeedDetailModal/);
assert.match(cockpit, /KuteSeedDetailModal/);
assert.match(cockpit, /新規シーズ/);
for (const method of ["slack", "teams", "meeting"]) {
  assert.match(types, new RegExp(`\\| "${method}"`));
  assert.match(labels, new RegExp(`${method}:`));
}
assert.match(migration, /植物種子による高価値タンパク質・ラビット抗体の低コスト生産/);
assert.match(migration, /Rejuvida：介護AI実装・定着プラットフォーム/);
assert.match(migration, /ON CONFLICT \(workspace_id, seed_id\) DO NOTHING/);

console.log("seed contact history contract: OK");
