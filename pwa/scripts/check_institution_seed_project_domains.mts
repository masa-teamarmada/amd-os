import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const read = (path: string) => readFileSync(join(scriptDir, path), "utf8");

const ddl = read("migrations/207_institution_seed_project_domains.sql");
const ddlWithoutComments = ddl.replace(/--.*$/gm, "");
const institutionsPage = read("../src/app/(app)/institutions/page.tsx");
const seedsTable = read("../src/components/cockpit/CockpitKuteSeeds.tsx");
const institutionData = read("../src/lib/ers-data.ts");
const seedData = read("../src/lib/seeds-data.ts");
const macParity = read("../../macos/AMDOSMac/Features/ExploreParityFeatureViews.swift");
const schema = read("../design/db_schema.md");

// 1. カタログと契約レイヤーを物理分離し、同じPJの二重分類をDBで防ぐ。
assert.match(ddl, /CREATE TABLE IF NOT EXISTS public\.institution_projects/);
assert.match(ddl, /CREATE TABLE IF NOT EXISTS public\.seed_projects/);
assert.match(ddl, /guard_project_domain_exclusivity/);
assert.match(ddl, /pg_advisory_xact_lock/);
assert.match(ddl, /INTERSECT\s+SELECT project_id FROM public\.seed_projects/);

// 2. 確認済みの関係だけ移行する。p30は愛媛大全体、p21は個別シーズ。
assert.match(ddl, /\('p30', 'inst_ehime', 'university_wide', '愛媛大学全体のエコシステム構築'\)/);
assert.match(ddl, /INSERT INTO public\.seed_projects[\s\S]*SELECT 'p21', id/);
assert.match(ddl, /未確認PJ p20\/p26 を自動分類してはいけない/);

// 3. ECRとSPSは移行で書き換えず、合算しない。
assert.doesNotMatch(ddlWithoutComments, /(?:INSERT INTO|UPDATE|DELETE FROM)\s+public\.institution_assessments/i);
assert.doesNotMatch(ddlWithoutComments, /(?:INSERT INTO|UPDATE|DELETE FROM)\s+public\.seed_sps_assessments/i);
assert.match(ddl, /ECR と SPS は別系列のまま保持し、ここでは合算・再計算しない/);

// 4. 画面は固定対応ではなく新しい関係表を読み、カタログを初期表示する。
assert.match(institutionData, /from\("institution_projects"\)/);
assert.match(seedData, /from\("seed_projects"\)/);
assert.match(institutionsPage, /useState<ViewMode>\("catalog"\)/);
assert.match(seedsTable, /AMD PJ 稼働中/);
assert.doesNotMatch(seedsTable, /status !== "spun_off"/);
assert.doesNotMatch(seedsTable, /status !== "declined"/);

// 5. macOSも固定KUTE/NIMS対応やPJ化除外に戻さない。
assert.match(macParity, /table: "institution_projects"/);
assert.match(macParity, /table: "seed_projects"/);
assert.match(macParity, /AMD PJ 稼働中/);
assert.doesNotMatch(macParity, /case "inst_kute"/);
assert.doesNotMatch(macParity, /アクティブ（PJ化\/見送りを除外）/);

// 6. 再構築用schemaにも両テーブルを残す。
assert.match(schema, /^## institution_projects$/m);
assert.match(schema, /^## seed_projects$/m);

console.log("institution/seed project domain contract: ok");
