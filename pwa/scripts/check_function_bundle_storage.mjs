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
// 本・論文の原稿は書斎へ移り、macOS の文書 API はマニュアルと設計書だけを返す（2026-10-31）。bzm/ を同梱しない。
check("api/macos/document/route", 40, ["manual/1-1-intro.md", "spec/1-1-overview.md"], ["/pwa/output/", "/pwa/design/", "/pwa/design_log/", "/pwa/scripts/", "/bzm/"]);
check("(app)/model/page", 50, ["../model/CURRENT.json", "../model/LOCK.json"], ["/bzm/pilot/"]);
for (const route of ["history", "edit-by-tsukuyomi"]) check(`api/monthly-report/${route}/route`, 8, [], ["/@sparticuz/chromium/bin/", "/@fontsource-variable/noto-sans-jp/"]);
for (const route of ["api/monthly-report/pdf/route", "api/monthly-report/manual-update/route", "api/monthly-report/external-manual-update/route", "api/admin/monthly-reports/download/route", "api/report/fix/route", "api/workspace-documents/[documentId]/pdf/route"]) {
  check(route, 120, ["node_modules/@sparticuz/chromium/bin/chromium.br", "node_modules/@fontsource-variable/noto-sans-jp/wght.css"]);
  assert(filesFor(route).some(file => /noto-sans-jp\/files\/.*\.woff2$/.test(file)), `${route}: missing Japanese font files`);
}

// 2026-10-17: モデル正本と、モデルが参照する bzm/ の設計文書を実行時に読む route は、読む可能性のある本文を全部持つこと。
// 読み手の fs 呼び出しは turbopackIgnore で自動追跡を止め、next.config.ts の outputFileTracingIncludes
// だけで同梱している。書き漏れは本番だけ ENOENT（ページの「準備中」や 404）になるので、ここで止める。
function filesUnder(dir, pattern) {
  const out = [];
  const walk = current => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.name.startsWith(".") || entry.name === "node_modules" || entry.name === "pilot") continue;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (pattern.test(entry.name)) out.push(full);
    }
  };
  walk(path.resolve(root, dir));
  return out;
}
function requireAll(route, dir, pattern) {
  const files = new Set(filesFor(route));
  const missing = filesUnder(dir, pattern).filter(file => !files.has(file));
  assert(missing.length === 0, `${route}: ${dir} の ${missing.length} 件が同梱されていない（例: ${path.relative(root, missing[0] ?? "")}）。next.config.ts の outputFileTracingIncludes を確認する`);
}
const modelReaders = ["(app)/model/page", "(app)/model/[slug]/page", "(app)/model/formulas/page", "api/model/bzm30/route", "api/model/sections/route", "api/project/[projectId]/org/route"];
for (const route of modelReaders) requireAll(route, "../bzm", /\.md$/);
for (const route of modelReaders) requireAll(route, "../model", /\.(md|json)$/);
for (const dir of ["manual", "spec"]) requireAll("api/macos/document/route", dir, /\.md$/);

// 2026-10-17: 全 route の実 trace を走査し、本番の関数に入れてはいけない物を止める。
// 動的な fs 読みで PWA 全体を拾う、画像処理ライブラリを抱える、といった同梱はデプロイごとに保存され、
// Functions Storage（Hobby 上限 10GB）を数十MB単位で押し上げる。
const FORBIDDEN_EVERYWHERE = [
  ["/node_modules/sharp/", "画像処理ライブラリ sharp（DDの画像の縦横は src/lib/image-dimensions.ts で読む）"],
  ["/node_modules/@img/", "sharp の実行ファイル"],
  ["/bzm/pilot/", "BZM の計算試行データ"],
  ["/pwa/design/", "設計メモ"],
  ["/pwa/design_log/", "開発記録"],
  ["/pwa/output/", "調査の出力"],
  ["/pwa/scripts/", "検査・移行の道具"],
  ["/pwa/scheduled-tasks/", "定期タスクの指示書"],
  ["/pwa/proposals/", "提案書の原稿"],
  ["/pwa/public/bzm/", "本の図（CDN から配る）"],
  ["/pwa/tsconfig.tsbuildinfo", "型検査の中間ファイル"],
];
const traces = [];
const walkTraces = dir => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkTraces(full);
    else if (entry.name.endsWith(".js.nft.json")) traces.push(path.relative(app, full).replace(/\.js\.nft\.json$/, ""));
  }
};
walkTraces(app);
for (const route of traces) {
  const files = filesFor(route);
  for (const [fragment, label] of FORBIDDEN_EVERYWHERE) {
    const hit = files.find(file => file.includes(fragment));
    assert(!hit, `${route}: ${label}が関数に同梱された（${path.relative(root, hit ?? "")}）。動的な fs 読みには turbopackIgnore を付け、必要な本文だけ outputFileTracingIncludes で同梱する`);
  }
  const source = files.find(file => file.includes("/pwa/src/") && /\.tsx?$/.test(file));
  assert(!source, `${route}: TypeScript の元ファイルが関数に同梱された（${path.relative(root, source ?? "")}）。PWA 全体の自動追跡を疑う`);
}
console.log(`function bundle storage: ok (${traces.length} traces scanned)`);
