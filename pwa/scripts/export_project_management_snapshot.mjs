import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

const projectId = process.argv[2];
const outputPath = process.argv[3];
if (!projectId || !outputPath) {
  throw new Error(
    "usage: node --env-file=.env.local scripts/export_project_management_snapshot.mjs <project-id> <output-path>",
  );
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) throw new Error("Supabase connection settings are missing");

const db = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const tables = [
  "project_management_objectives",
  "project_management_outcomes",
  "project_management_milestones",
  "project_management_tasks",
  "project_management_milestone_dependencies",
  "project_management_schedule_dependencies",
];
const records = {};
for (const table of tables) {
  const { data, error } = await db
    .from(table)
    .select("*")
    .eq("project_id", projectId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`${table}: ${error.message}`);
  records[table] = data ?? [];
}

const snapshot = {
  format: "amd-os-project-management-gantt-snapshot-v1",
  projectId,
  exportedAt: new Date().toISOString(),
  counts: Object.fromEntries(Object.entries(records).map(([table, rows]) => [table, rows.length])),
  records,
};
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ outputPath, counts: snapshot.counts }, null, 2));
