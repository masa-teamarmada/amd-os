import assert from "node:assert/strict";
import fs from "node:fs";
import { parseThemeHistory } from "../src/lib/project-theme-history.ts";
import { upsertThemeProfile, ThemeHubError } from "@/lib/project-theme-hub";

const row = { id: "19000000-2026-4000-8000-000000000501", topic: "応募", initial: "準備", developments: "申請書作成", current: "提出・採否は未確認", next: "受付を確認", asOf: "2026-07-01", sourceNote: "資料室の版を確認", sources: [] };
assert.deepEqual(parseThemeHistory([row]), [row]);
assert.deepEqual(parseThemeHistory([]), []);
for (const bad of [null, {}, [{ ...row, asOf: "2026-02-30" }], [{ ...row, asOf: "yesterday" }], [{ ...row, topic: "" }], [row, row], Array(41).fill(row), [{ ...row, developments: "x".repeat(1601) }], [{ ...row, sources: [{ kind: "url", id: "https://invalid" }] }], [{ ...row, sources: [{ kind: "document", id: "wrong" }] }]]) assert.throws(() => parseThemeHistory(bad));
assert.equal(parseThemeHistory([{ ...row, asOf: null }])[0].asOf, null);
const source = { kind: "meeting", id: "a".repeat(190) };
assert.equal(parseThemeHistory([{ ...row, sources: [source] }])[0].sources[0].id.length, 190);
assert.throws(() => parseThemeHistory([{ ...row, sources: [source, source] }]));

function fakeDb(found = true, conflict = false) {
  const calls: {table: string; op: string; args: unknown[]}[] = [];
  return { calls, from(table: string) {
    let writes = false;
    const result = () => table === "project_theme_meetings"
      ? { data: found ? [{ meeting_id: source.id }] : [], error: null }
      : { data: writes && conflict ? null : { id: row.id, version: 2 }, error: null };
    const chain: Record<string, unknown> = {};
    for (const op of ["select", "eq", "in", "is", "update", "insert"]) chain[op] = (...args: unknown[]) => {
      calls.push({table, op, args}); if (op === "update" || op === "insert") writes = true; return chain;
    };
    chain.maybeSingle = () => Promise.resolve(result());
    chain.then = (fn: (value: unknown) => unknown) => Promise.resolve(result()).then(fn);
    return chain;
  }} as unknown as Parameters<typeof upsertThemeProfile>[0] & { calls: typeof calls };
}
const db = fakeDb();
await upsertThemeProfile(db, "p19", "katsushika_hydrogen", "ID001", { historyRows: [{ ...row, sources: [source] }] }, 2);
const patch = db.calls.find(call => call.op === "update")!.args[0] as Record<string, unknown>;
assert.deepEqual(Object.keys(patch).sort(), ["history_rows", "updated_by_member_id"]);
assert.ok(db.calls.some(call => call.op === "eq" && call.args[0] === "project_id" && call.args[1] === "p19"));
assert.ok(db.calls.some(call => call.op === "eq" && call.args[0] === "track_key" && call.args[1] === "katsushika_hydrogen"));
assert.ok(db.calls.some(call => call.op === "eq" && call.args[0] === "version" && call.args[1] === 2));
await assert.rejects(() => upsertThemeProfile(fakeDb(false), "p19", "katsushika_hydrogen", "ID001", { historyRows: [{ ...row, sources: [source] }] }, 2), (e: unknown) => e instanceof ThemeHubError && e.status === 400);
await assert.rejects(() => upsertThemeProfile(fakeDb(true, true), "p19", "katsushika_hydrogen", "ID001", { historyRows: [row] }, 2), (e: unknown) => e instanceof ThemeHubError && e.status === 409);
const onlyPurpose = fakeDb();
await upsertThemeProfile(onlyPurpose, "p19", "katsushika_hydrogen", "ID001", { purposeMd: "目的" }, 2);
assert.ok(!("history_rows" in (onlyPurpose.calls.find(call => call.op === "update")!.args[0] as object)));

const seed = fs.readFileSync("../ios/supabase/migrations/20260901004500_seed_zmp_hydrogen_history.sql", "utf8");
const seeded = parseThemeHistory(JSON.parse(seed.split("$history$")[1]));
assert.equal(seeded.length, 7);
assert.ok(seeded.every(row => row.sources.length > 0));
assert.ok(seeded.filter(row => /補助|助成|技術開発事業/.test(row.topic)).every(row => row.current.includes("未確認")));
const cockpit = fs.readFileSync("src/components/cockpit/CockpitView.tsx", "utf8");
assert.equal((cockpit.match(/themes: "themes"/g) ?? []).length, 2);
assert.ok(cockpit.includes('project.projectId === "p19" ? [{ key: "themes"'));
const page = fs.readFileSync("src/app/(app)/project/[projectId]/cockpit/page.tsx", "utf8");
assert.ok(page.includes('rawTab === "themes" && projectId !== "p19"'));
const editor = fs.readFileSync("src/components/project-workspace/SxWeeklyControlDashboard.tsx", "utf8");
assert.ok(editor.includes('data-editor-density={WIDE_EDITOR_KINDS.has(editor.kind) ? "compact" : undefined}'));
assert.ok(editor.includes('data-field-group={group.key}'));
const history = fs.readFileSync("src/components/project-workspace/ThemeHistory.tsx", "utf8");
assert.match(history, /if \(!saved\)\s*\{\s*await onSave\(next\);/);
assert.ok(history.includes('await onRefresh()'));
assert.ok(history.includes('saved ? "最新を読み込む" : "保存"'));
assert.ok(history.includes('canManage && editing'));
console.log("Theme history validation, scoped partial saves, conflicts, seed provenance, cockpit and compact editor contracts OK");
