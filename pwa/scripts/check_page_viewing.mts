import assert from "node:assert/strict";
import { parsePageViewingInput, allowedProjectPageLabel, deduplicatePageViewers } from "../src/lib/page-viewing-core.ts";

const project = { projectId: "fixture", projectCategory: "dtsu" };
assert.equal(parsePageViewingInput({ pathname: "https://example.com", pageLabel: "" }), null);
for (const path of ["/dashboard?token=secret", "/dashboard#secret", "/../admin", "//example.com", "/project/%2f/cockpit"]) assert.equal(parsePageViewingInput({ pathname: path, pageLabel: "" }), null);
assert.deepEqual(parsePageViewingInput({ pathname: "/project/fixture/workspace/", pageLabel: "技術" }), { pathname: "/project/fixture/workspace", pageLabel: "技術" });
assert.equal(allowedProjectPageLabel("cockpit", "技術", project), "技術");
assert.equal(allowedProjectPageLabel("workspace", "週次差分", project, true), null, "外部にないページを履歴経由で開かない");
assert.equal(allowedProjectPageLabel("workspace", "技術", project, true), "技術");
assert.equal(allowedProjectPageLabel("dd", "開示資料一覧", project, true), "開示資料一覧");
assert.equal(allowedProjectPageLabel("workspace", "社内の秘密", project), null);
const viewers = deduplicatePageViewers([
  { actor_key: "other", actor_label: "共同メンバー" },
  { actor_key: "self", actor_label: "自分" },
  { actor_key: "self", actor_label: "自分" },
], "self");
assert.equal(viewers.length, 2);
assert.equal(viewers[0].self, true);
console.log("page viewing: safe page identities, surface labels, external boundary, duplicate tabs passed");
