import assert from "node:assert/strict";
import { createProjectProperNounHandlers } from "../src/lib/project-proper-nouns-handlers.ts";
import { validateProperNounEntries, parseProperNounValue } from "../src/lib/project-proper-nouns.ts";
const entries = [{ canonical: "河尻", aliases: ["川尻"], kind: "person" }];
assert.deepEqual(validateProperNounEntries(entries), entries);
assert.throws(() => validateProperNounEntries([{ ...entries[0], canonical: "" }]));
assert.throws(() => validateProperNounEntries([...entries, { canonical: "川尻", aliases: [], kind: "person" }]));
assert.throws(() => validateProperNounEntries([{ ...entries[0], aliases: ["読み\n違い"] }]));
assert.throws(() => parseProperNounValue("broken"));
assert.deepEqual(parseProperNounValue(null).entries, []);

const rows = new Map<string, any>([["a", { value: JSON.stringify({ version: 1, confirmed_on: "2026-10-07", entries }), updated_at: "2026-10-07T00:00:00.000Z" }], ["b", { value: JSON.stringify({ entries: [{ canonical: "別の企業", aliases: [], kind: "organization" }] }), updated_at: "other" }]]);
let dbCalls = 0; let readable = true; let writable = true; let race = false;
const db = { from(table: string) {
  dbCalls++; assert.equal(table, "project_config");
  const filters: Record<string, unknown> = {}; let patch: any; let insert = false;
  const query = {
    select() { return query; }, eq(key: string, value: unknown) { filters[key] = value; return query; },
    update(value: any) { patch = value; return query; }, insert(value: any) { patch = value; insert = true; return query; },
    async maybeSingle() {
      const projectId = String(insert ? patch.project_id : filters.project_id);
      assert.equal(insert ? patch.key : filters.key, "proper_noun_spellings");
      const current = rows.get(projectId);
      if (!patch) return { data: current ?? null, error: null };
      if (insert && current) return { data: null, error: { code: "23505" } };
      if (race) { race = false; if (current) current.updated_at = "concurrent"; }
      if (!insert && current?.updated_at !== filters.updated_at) return { data: null, error: null };
      const next = { value: patch.value, updated_at: patch.updated_at }; rows.set(projectId, next);
      return { data: next, error: null };
    },
  }; return query;
}};
const handlers = createProjectProperNounHandlers({ createDb: () => db as any, readAccess: async () => readable ? { canEdit: writable } : null, writeAccess: async () => writable ? { ok: true, user: { email: "editor@example.test" } } : { ok: false, errorResponse: new Response(null, { status: 403 }) } });
const ctx = (projectId = "a") => ({ params: Promise.resolve({ projectId }) });
const patch = (body: unknown) => new Request("https://example.test/api/project/a/proper-nouns", { method: "PATCH", body: JSON.stringify(body) });
readable = false; assert.equal((await handlers.GET(new Request("https://example.test"), ctx())).status, 404); assert.equal(dbCalls, 0);
writable = false; assert.equal((await handlers.PATCH(patch({ entries, expectedUpdatedAt: "2026-10-07T00:00:00.000Z" }), ctx())).status, 403); assert.equal(dbCalls, 0);
readable = true; const readonly = await handlers.GET(new Request("https://example.test"), ctx()); assert.equal((await readonly.json()).canEdit, false);
writable = true; const response = await handlers.GET(new Request("https://example.test"), ctx()); assert.equal(response.headers.get("cache-control"), "private, no-store"); assert.equal((await response.json()).dictionary.entries[0].canonical, "河尻");
assert.equal((await handlers.PATCH(patch({ entries, expectedUpdatedAt: "stale" }), ctx())).status, 409);
const bad = await handlers.PATCH(patch({ entries: [{ ...entries[0], canonical: "" }], expectedUpdatedAt: "2026-10-07T00:00:00.000Z" }), ctx()); assert.equal(bad.status, 400); assert.equal((await bad.json()).row, 0);
const next = [{ canonical: "河尻", aliases: ["川尻", "かわじり"], kind: "person" }];
const saved = await handlers.PATCH(patch({ entries: next, expectedUpdatedAt: "2026-10-07T00:00:00.000Z" }), ctx()); assert.equal(saved.status, 200); assert.deepEqual((await saved.json()).dictionary.entries, next); assert.equal(JSON.parse(rows.get("a").value).confirmed_on, "2026-10-07"); assert.equal(JSON.parse(rows.get("b").value).entries[0].canonical, "別の企業");
race = true; const raced = await handlers.PATCH(patch({ entries, expectedUpdatedAt: rows.get("a").updated_at }), ctx()); assert.equal(raced.status, 409); assert.deepEqual(JSON.parse(rows.get("a").value).entries, next);
const created = await handlers.PATCH(patch({ entries: [], expectedUpdatedAt: null }), ctx("empty")); assert.equal(created.status, 200); assert.deepEqual(JSON.parse(rows.get("empty").value).entries, []);
rows.get("a").value = "broken"; assert.equal((await handlers.GET(new Request("https://example.test"), ctx())).status, 500); assert.equal((await handlers.PATCH(patch({ entries, expectedUpdatedAt: "concurrent" }), ctx())).status, 500);
console.log("Proper nouns: validation/ambiguity, authorization before DB, PJ scope, metadata preservation, optimistic concurrency, empty/save/readback and malformed-data protection OK");
