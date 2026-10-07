import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const compile = (source) => ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const loadPure = (file, require) => {
  const exports = {};
  vm.runInNewContext(compile(fs.readFileSync(file, "utf8")), { exports, require });
  return exports;
};
const emailCore = loadPure("src/lib/workspace-email.ts");
const { resolveLoginEntry } = loadPure("src/lib/login-entry.ts", () => emailCore);
assert.equal(resolveLoginEntry(" USER@TEAM-ARMADA.JP ").method, "google");
assert.equal(resolveLoginEntry(" USER@TEAM-ARMADA.JP ").email, "user@team-armada.jp");
for (const email of ["reader@example.com", "reader@gmail.com", "reader@sub.team-armada.jp", "reader@team-armada.jp.example.com", "reader@not-team-armada.jp"]) {
  assert.equal(resolveLoginEntry(email).method, "email", email);
}
for (const email of [null, "", "team-armada.jp", "a@@team-armada.jp", "a @team-armada.jp"]) assert.equal(resolveLoginEntry(email), null);

// Execute the actual page handlers with transport doubles; never send mail or start real OAuth.
const source = fs.readFileSync("src/app/auth/login/page.tsx", "utf8");
const ast = ts.createSourceFile("page.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const handlers = [];
const printer = ts.createPrinter();
const visit = (node) => {
  if (ts.isVariableDeclaration(node) && ["PORTFOLIO_GOOGLE_SCOPES", "handleLogin", "handleEmailSubmit"].includes(node.name.getText(ast))) {
    handlers.push(`const ${node.name.getText(ast)} = ${printer.printNode(ts.EmitHint.Expression, node.initializer, ast)};`);
  }
  ts.forEachChild(node, visit);
};
visit(ast);
const build = ({ email, oauthError = null, failNetwork = false, httpOk = true, submitting = false }) => {
  const calls = [], errors = [], busy = [], sent = [];
  const context = {
    email, next: "/dd/sample?page=company", submitting, resolveLoginEntry,
    window: { location: { origin: "https://amd-os-pwa.vercel.app" } },
    setSubmitting: (value) => busy.push(value), setError: (value) => errors.push(value), setEmailSent: (value) => sent.push(value),
    createClient: () => ({ auth: { signInWithOAuth: async (options) => { calls.push({ kind: "google", options }); return { error: oauthError }; } } }),
    fetch: async (url, options) => { calls.push({ kind: "email", url, body: JSON.parse(options.body) }); if (failNetwork) throw new Error("offline"); return { ok: httpOk }; },
  };
  const actual = vm.runInNewContext(compile(handlers.join("\n")) + "\n({handleLogin,handleEmailSubmit});", context);
  return { ...actual, calls, errors, busy, sent };
};
const submit = async (fixture) => { let prevented = false; await fixture.handleEmailSubmit({ preventDefault() { prevented = true; } }); assert.equal(prevented, true); };
const internal = build({ email: " PERSON@TEAM-ARMADA.JP " });
await submit(internal);
assert.equal(internal.calls.length, 1);
assert.equal(internal.calls[0].kind, "google");
const options = internal.calls[0].options.options;
assert.equal(options.queryParams.login_hint, "person@team-armada.jp");
assert.equal(options.queryParams.hd, "team-armada.jp");
assert.equal(options.queryParams.prompt, "consent");
assert.match(options.scopes, /calendar\.readonly/);
assert.match(options.scopes, /gmail\.readonly/);
assert.equal(new URL(options.redirectTo).searchParams.get("next"), "/dd/sample?page=company");
assert.equal(new URL(options.redirectTo).searchParams.get("login_scope"), "portfolio");
assert.equal(internal.sent.length, 0);
const external = build({ email: " READER@EXAMPLE.COM " });
await submit(external);
assert.equal(external.calls.length, 1);
assert.equal(external.calls[0].kind, "email");
assert.equal(external.calls[0].url, "/api/auth/email-start");
assert.equal(external.calls[0].body.email, "reader@example.com");
assert.equal(external.calls[0].body.next, "/dd/sample?page=company");
assert.equal(external.sent[0], true);
for (const fixture of [build({ email: "invalid" }), build({ email: "reader@example.com", submitting: true })]) { await submit(fixture); assert.equal(fixture.calls.length, 0); }
const offline = build({ email: "reader@example.com", failNetwork: true });
await submit(offline);
assert.equal(offline.errors.at(-1), "connection_failed");
assert.equal(offline.sent.length, 0);
assert.equal(offline.busy.at(-1), false);
const serverFailure = build({ email: "reader@example.com", httpOk: false });
await submit(serverFailure);
assert.equal(serverFailure.errors.at(-1), "connection_failed");
assert.equal(serverFailure.sent.length, 0);
const denied = build({ email: "person@team-armada.jp", oauthError: { message: "failed" } });
await submit(denied);
assert.equal(denied.errors.at(-1), "auth_failed");
assert.equal(denied.sent.length, 0);
const shosai = build({ email: "" });
await shosai.handleLogin();
assert.equal(shosai.calls[0].kind, "google");
assert.equal(shosai.calls[0].options.options.queryParams.login_hint, undefined);
console.log("Login entry: domain boundaries, actual submit routing, OAuth scope/return path, double-submit and failures passed (no live transports)");
