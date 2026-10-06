import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

// Inspect the actual production traces, not just the configuration text.
const root = process.cwd();
const app = path.join(root, ".next/server/app");
function filesFor(route) {
  const trace = path.join(app, `${route}.js.nft.json`);
  assert(fs.existsSync(trace), `Missing production trace: ${route}`);
  return [...new Set(JSON.parse(fs.readFileSync(trace, "utf8")).files.map(file => path.resolve(path.dirname(trace), file)))];
}
function check(route, limitMb, required = [], forbidden = []) {
  const files = filesFor(route);
  const bytes = files.reduce((sum, file) => sum + fs.statSync(file).size, 0);
  assert(bytes <= limitMb * 1e6, `${route}: ${(bytes / 1e6).toFixed(2)} MB exceeds ${limitMb} MB`);
  for (const file of required) assert(files.includes(path.resolve(root, file)), `${route}: missing ${file}`);
  for (const fragment of forbidden) assert(!files.some(file => file.includes(fragment)), `${route}: unrelated ${fragment} was bundled`);
  console.log(`${route}: ${(bytes / 1e6).toFixed(2)} MB`);
}
check("api/macos/document/route", 40, ["manual/1-1-intro.md", "spec/1-1-overview.md", "../bzm/bzm-3-0-textbook-coefficients.md"], ["/pwa/output/", "/pwa/design/", "/pwa/design_log/", "/pwa/scripts/", "/bzm/pilot/"]);
check("(app)/model/page", 50, ["../model/CURRENT.json", "../model/LOCK.json"], ["/bzm/pilot/"]);
for (const route of ["history", "edit-by-tsukuyomi"]) check(`api/monthly-report/${route}/route`, 8, [], ["/@sparticuz/chromium/bin/", "/@fontsource-variable/noto-sans-jp/"]);
for (const route of ["api/monthly-report/pdf/route", "api/monthly-report/manual-update/route", "api/monthly-report/external-manual-update/route", "api/report/fix/route", "api/workspace-documents/[documentId]/pdf/route"]) {
  check(route, 120, ["node_modules/@sparticuz/chromium/bin/chromium.br", "node_modules/@fontsource-variable/noto-sans-jp/wght.css"]);
  assert(filesFor(route).some(file => /noto-sans-jp\/files\/.*\.woff2$/.test(file)), `${route}: missing Japanese font files`);
}
console.log("function bundle storage: ok");
