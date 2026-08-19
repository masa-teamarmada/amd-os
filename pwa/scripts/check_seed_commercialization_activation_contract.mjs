import assert from "node:assert/strict";
import fs from "node:fs";

const route = fs.readFileSync("src/app/api/seeds/[seedId]/commercialization/route.ts", "utf8");
const migration = fs.readFileSync("scripts/migrations/300_seed_commercialization_activation_rpc.sql", "utf8");

assert.match(route, /requireMember\(\)/);
assert.match(route, /activate_seed_commercialization/);
assert.match(route, /UUID_RE/);
assert.doesNotMatch(route, /from\("seed_projects"\)\.insert/);
assert.match(migration, /for update/);
assert.match(migration, /project_status text/);
assert.match(migration, /projects/);
assert.match(migration, /seed_projects/);
assert.match(migration, /project_members/);
assert.match(migration, /'draft'/);
assert.match(migration, /from public, anon, authenticated/);
assert.match(migration, /to service_role/);
assert.match(migration, /Asia\/Tokyo/);
console.log("seed commercialization activation contract: OK");
