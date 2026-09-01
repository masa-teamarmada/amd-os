import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const pwaDir = path.resolve(scriptsDir, "..");
const read = (relativePath) => readFileSync(path.join(pwaDir, relativePath), "utf8");

const globals = read("src/app/globals.css");
const designCode = read("spec/2-7-ui-design-code-current-spec.md");
const objectiveMap = read("src/components/project-workspace/sx-objective-map.module.css");
const weeklyControl = read("src/components/project-workspace/weekly-control.module.css");
const themeRoutes = read("src/components/project-workspace/project-theme-routes.module.css");
const timeline = read("src/components/project-workspace/SxUnifiedTimeline.tsx");
const developmentThemes = read("src/components/project-workspace/SxDevelopmentThemeBoard.tsx");

for (const [token, value] of [
  ["--amd-action", "#027fdc"],
  ["--amd-action-strong", "#0267b2"],
  ["--amd-action-soft", "#e8f3fc"],
  ["--amd-action-line", "#7cbceb"],
  ["--amd-success", "#047857"],
  ["--amd-success-soft", "#ecfdf5"],
]) {
  assert.match(
    globals.toLowerCase(),
    new RegExp(`${token}:\\s*${value.replace("#", "\\#")}`),
    `${token}はPWA UIデザインコードの共通色役割へ固定する`,
  );
}

assert.match(designCode, /通常のOS業務画面の主色はsky/);
assert.match(designCode, /emeraldは、根拠確認済みの安全・完了・成功/);
assert.match(designCode, /test:ui-design-code/);

assert.match(objectiveMap, /--tree-accent:\s*var\(--amd-action,\s*#027fdc\)/);
assert.match(objectiveMap, /--tree-accent-soft:\s*var\(--amd-action-soft,\s*#e8f3fc\)/);
assert.match(
  objectiveMap,
  /\.nodeState\[data-state="completed"\][\s\S]*?var\(--amd-success-soft,\s*#ecfdf5\)[\s\S]*?var\(--amd-success,\s*#047857\)/,
  "目的構造のemeraldは完了状態だけに使う",
);
assert.doesNotMatch(weeklyControl, /--green(?:-soft)?:/, "役割不明のgreenトークンを復活させない");
assert.match(weeklyControl, /\.page\s*\{[\s\S]*?--amd-action:\s*#027fdc;/, "共有ワークスペースとcockpit埋込のmount rootへ共通色を固定する");
assert.match(weeklyControl, /--action:\s*var\(--amd-action\)/);
assert.match(weeklyControl, /\.sectionNav button\[aria-selected="true"\][\s\S]*?var\(--action\)/, "共有ワークスペースの選択タブはAMD Blueを使う");
assert.match(weeklyControl, /\.section\s*\{[\s\S]*?border-radius:\s*12px;[\s\S]*?background:\s*rgba\(255, 255, 255, \.98\)/, "共有ワークスペースは共通の高密度panel shellを使う");
assert.match(themeRoutes, /var\(--amd-action\)/);

const count = (text, pattern) => [...text.matchAll(pattern)].length;
assert.equal(count(timeline, /#047857/gi), 2, "ガントのemeraldはゲート充足表示だけに限定する");
assert.equal(count(timeline, /#ecfdf5/gi), 1, "ガントのemerald面はゲート充足表示だけに限定する");
assert.equal(count(timeline, /#059669/gi), 0, "ガントの操作・選択・focusへgreenを使わない");
assert.equal(count(developmentThemes, /#047857/gi), 2, "開発テーマのemeraldはpassed/completedだけに限定する");
assert.equal(count(developmentThemes, /#059669/gi), 0, "開発テーマの見出し・focusへgreenを使わない");

const workspaceDir = path.join(pwaDir, "src/components/project-workspace");
const sourceFiles = [];
function collect(dir) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) collect(full);
    else if (/\.(?:css|tsx|ts)$/.test(name)) sourceFiles.push(full);
  }
}
collect(workspaceDir);

// 2026-09-01に目的構造へ持ち込まれた、意味のないteal主色一式。
// PJ名や技術領域の連想で通常画面の主色を作らない。状態色のemeraldとは別物。
const retiredTealPalette = [
  "#0f766e", "#ecf8f5", "#036b50", "#0f675f", "#185e56",
  "#5ea49b", "#55a79c", "#6d8c86", "#86a49f", "#91aaa5", "#edf5f3",
];
for (const file of sourceFiles) {
  const source = readFileSync(file, "utf8").toLowerCase();
  for (const color of retiredTealPalette) {
    assert.ok(
      !source.includes(color),
      `${path.relative(pwaDir, file)}に退役済みteal主色 ${color} を持ち込まない`,
    );
  }
}

console.log("ui design code contract: ok");
