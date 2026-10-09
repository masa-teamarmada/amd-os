import { deepStrictEqual, strictEqual } from "node:assert";
import { handleTallySync } from "./handler.ts";
import { parsePayload, type Payload } from "./payload.ts";

function fixture(): Payload {
  return { memberID: "ID001", windowStart: "2026-10-05", windowEnd: "2026-10-26", projects: [
    { projectID: "test-a", displayName: "Test A", meetingSearchTerms: ["test"], weeklyEffort: [
      { weekStart: "2026-10-05", developmentHours: 10, meetingHours: 2 },
      { weekStart: "2026-10-26", developmentHours: 0, meetingHours: 0 },
    ] },
  ] };
}

function request(body: unknown, key = "fixture-key") {
  return new Request("https://fixture.invalid/tally-sync", {
    method: "POST", headers: { "x-tally-sync-key": key }, body: JSON.stringify(body),
  });
}

Deno.test("accepts inclusive boundaries, zero hours, and existing two-decimal rounding", () => {
  const payload = fixture();
  payload.projects[0].weeklyEffort[0].developmentHours = 10.123;
  const parsed = parsePayload(payload)!;
  strictEqual(parsed.projects[0].weeklyEffort[0].developmentHours, 10.12);
  strictEqual(parsed.projects[0].weeklyEffort[1].developmentHours, 0);
});

Deno.test("normalizes strings before detecting duplicate owners and weeks", () => {
  const payload = fixture();
  payload.projects[0].projectID = " test-a ";
  payload.projects[0].displayName = " Test A ";
  payload.projects[0].meetingSearchTerms = [" test "];
  deepStrictEqual(parsePayload(payload)?.projects[0], fixture().projects[0]);
  payload.projects.push(fixture().projects[0]);
  strictEqual(parsePayload(payload), null);
});

Deno.test("empty week list is authoritative, omitted list is invalid, omitted PJ stays absent", () => {
  const payload = fixture();
  payload.projects[0].weeklyEffort = [];
  deepStrictEqual(parsePayload(payload), payload);
  const omitted = JSON.parse(JSON.stringify(payload));
  delete omitted.projects[0].weeklyEffort;
  strictEqual(parsePayload(omitted), null);
  deepStrictEqual(parsePayload({ ...payload, projects: [] })?.projects, []);
  strictEqual(parsePayload({ ...payload, projects: undefined }), null);
});

Deno.test("rejects missing owner or window, wrong owner, and reversed scope", () => {
  for (const key of ["memberID", "windowStart", "windowEnd"]) {
    strictEqual(parsePayload({ ...fixture(), [key]: undefined }), null);
  }
  strictEqual(parsePayload({ ...fixture(), memberID: "ID002" }), null);
  strictEqual(parsePayload({ ...fixture(), windowStart: "2026-11-01" }), null);
});

Deno.test("rejects invalid calendar dates while preserving arbitrary valid day boundaries", () => {
  for (const date of ["2026-02-29", "2026-04-31", "2026-13-01", "0000-01-01", "2026-1-01", "2026-10-05T00:00:00Z"]) {
    strictEqual(parsePayload({ ...fixture(), windowStart: date }), null, date);
    const payload = fixture();
    payload.projects[0].weeklyEffort[0].weekStart = date;
    strictEqual(parsePayload(payload), null, date);
  }
  strictEqual(parsePayload({ ...fixture(), windowStart: "2024-02-29" })?.windowStart, "2024-02-29");
  const payload = fixture();
  payload.projects[0].weeklyEffort[0].weekStart = "2026-10-06";
  strictEqual(parsePayload(payload)?.projects[0].weeklyEffort[0].weekStart, "2026-10-06");
});

Deno.test("rejects duplicate/out-of-window weeks, nonnumeric and out-of-bounds hours", () => {
  const duplicate = fixture();
  duplicate.projects[0].weeklyEffort.push(duplicate.projects[0].weeklyEffort[0]);
  strictEqual(parsePayload(duplicate), null);
  for (const date of ["2026-10-04", "2026-10-27"]) {
    const payload = fixture();
    payload.projects[0].weeklyEffort[0].weekStart = date;
    strictEqual(parsePayload(payload), null);
  }
  for (const value of [-1, 168.001, NaN, Infinity, "1", null, undefined]) {
    for (const key of ["developmentHours", "meetingHours"]) {
      const payload = fixture();
      Object.assign(payload.projects[0].weeklyEffort[0], { [key]: value });
      strictEqual(parsePayload(payload), null);
    }
  }
});

Deno.test("rejects invalid project/settings shapes and oversized arrays", () => {
  for (const value of [null, [], 1, {}, { ...fixture().projects[0], projectID: "" },
    { ...fixture().projects[0], displayName: "x".repeat(161) },
    { ...fixture().projects[0], meetingSearchTerms: [null] },
    { ...fixture().projects[0], meetingSearchTerms: [" "] },
    { ...fixture().projects[0], meetingSearchTerms: Array(21).fill("test") }]) {
    strictEqual(parsePayload({ ...fixture(), projects: [value] }), null);
  }
  const projects = Array.from({ length: 101 }, (_, i) => ({ ...fixture().projects[0], projectID: `test-${i}` }));
  strictEqual(parsePayload({ ...fixture(), projects }), null);
});

Deno.test("5000-week cap is across all submitted projects", () => {
  const weeks = Array.from({ length: 2501 }, (_, i) => ({
    weekStart: new Date(Date.UTC(2020, 0, i + 1)).toISOString().slice(0, 10), developmentHours: 1, meetingHours: 0,
  }));
  const payload = { ...fixture(), windowStart: "2020-01-01", windowEnd: "2030-01-01", projects: [
    { ...fixture().projects[0], projectID: "test-a", weeklyEffort: weeks.slice(0, 2500) },
    { ...fixture().projects[0], projectID: "test-b", weeklyEffort: weeks.slice(0, 2500) },
  ] };
  strictEqual(parsePayload(payload)?.projects.length, 2);
  payload.projects[1].weeklyEffort = weeks;
  strictEqual(parsePayload(payload), null);
});

Deno.test("successful sync issues exactly one atomic RPC for every submitted project", async () => {
  const payload = fixture();
  payload.projects.push({ ...fixture().projects[0], projectID: "test-b", weeklyEffort: [] });
  const calls: unknown[] = [];
  const response = await handleTallySync(request(payload), { syncKey: "fixture-key", database: () => ({
    rpc: (name, args) => { calls.push({ name, args }); return Promise.resolve({ error: null }); },
  }) });
  deepStrictEqual(calls, [{ name: "amie_sync_tally_effort", args: {
    p_member_id: "ID001", p_window_start: payload.windowStart, p_window_end: payload.windowEnd, p_projects: payload.projects,
  } }]);
  strictEqual(response.status, 200);
  deepStrictEqual(await response.json(), { ok: true, projectCount: 2, weekCount: 2 });
});

Deno.test("authentication, methods, malformed JSON and invalid scope never create a DB client", async () => {
  let clients = 0;
  const dependencies = { syncKey: "fixture-key", database: () => { clients++; throw new Error("must not connect"); } };
  strictEqual((await handleTallySync(request(fixture(), "wrong"), dependencies)).status, 401);
  strictEqual((await handleTallySync(request(fixture()), { ...dependencies, syncKey: "" })).status, 401);
  strictEqual((await handleTallySync(new Request("https://fixture.invalid", { method: "GET" }), dependencies)).status, 405);
  strictEqual((await handleTallySync(new Request("https://fixture.invalid", { method: "OPTIONS" }), dependencies)).status, 200);
  strictEqual((await handleTallySync(request({}), dependencies)).status, 400);
  strictEqual((await handleTallySync(new Request("https://fixture.invalid", { method: "POST", headers: { "x-tally-sync-key": "fixture-key" }, body: "{" }), dependencies)).status, 400);
  strictEqual(clients, 0);
});

Deno.test("database validation and transaction failures are never acknowledged as success", async () => {
  for (const code of ["22023", "22007", "22008", "22P02", "23503", "P0001", "40001", "42883"]) {
    const response = await handleTallySync(request(fixture()), { syncKey: "fixture-key", database: () => ({ rpc: () => Promise.resolve({ error: { code } }) }) });
    strictEqual(response.status, ["22023", "22007", "22008", "22P02", "23503"].includes(code) ? 400 : 500);
    strictEqual((await response.json()).ok, false);
  }
  const response = await handleTallySync(request(fixture()), { syncKey: "fixture-key", database: () => ({ rpc: () => Promise.reject(new Error("fixture transport failure")) }) });
  strictEqual(response.status, 500);
});
