// 参照系データのキャッシュ契約チェック (静的解析のみ、DB接続なし)。
// Run: npm run test:reference-data-cache
//
// 【なぜこの guard があるか】
// まさから何度も指摘されている「モーダルやタブを開くたびに待たされる」の原因は、
// めったに変わらない参照系データを、画面が開くたびに素の fetch で読み直していること。
// 一度直しても、次の画面を作るときに同じ書き方が復活するので、機械で止める。
//
// 規範: /Users/masa/projects/AGENTS.common.md「参照系データの体感速度」節
// PWA での適用: pwa/spec/5-10-reference-data-caching-current-spec.md
//
// --- 契約 ---
// 1. REFERENCE_DATA_ENDPOINTS に登録した参照系エンドポイントは、
//    専用のクライアント層 (キャッシュ経由) からしか fetch してはいけない。
// 2. その API route は Cache-Control を明示していること (既定 no-store を使わない)。
// 3. そのクライアント層は @/lib/reference-data-cache を通していること。
// 4. 【ラチェット】クライアントコンポーネントからの素の /api fetch は、
//    baseline に載っている既存分だけ許す。新しく増えたら失敗する。
//    増やしたい場合の正しい選択肢は2つ:
//      a. 参照系なら reference-data-cache 経由のクライアント層を作る (推奨)
//      b. 可変系 (残高・進行中タスク・通知・下書き) なら baseline へ理由付きで追加する

import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const pwaDir = path.join(scriptDir, "..");
const srcDir = path.join(pwaDir, "src");
const BASELINE_PATH = path.join(scriptDir, "reference_data_cache_baseline.json");

/** 参照系として確定済みのエンドポイント。新しい参照系データを足したらここへ登録する。 */
const REFERENCE_DATA_ENDPOINTS = [
  {
    endpoint: "/api/seeds/screening-bands",
    label: "一次選別スクリーニング帯 (SPS)",
    routeFile: "src/app/api/seeds/screening-bands/route.ts",
    clientModule: "src/lib/seed-screening-bands-client.ts",
  },
  {
    endpoint: "/api/project/:p/season-budget",
    label: "シーズン予算と消化 (PJコックピット PJ概要)",
    routeFile: "src/app/api/project/[projectId]/season-budget/route.ts",
    clientModule: "src/lib/season-budget-client.ts",
  },
  {
    endpoint: "/api/project/:p/amd-contributions",
    label: "AMDの貢献記録 (進捗タブ末尾)",
    routeFile: "src/app/api/project/[projectId]/amd-contributions/route.ts",
    clientModule: "src/lib/amd-contributions-client.ts",
  },
  {
    endpoint: "/api/project/:p/org",
    label: "組織 (スコア詳細タブの担い手・観測・メンバー)",
    routeFile: "src/app/api/project/[projectId]/org/route.ts",
    clientModule: "src/lib/project-org-client.ts",
  },
  {
    endpoint: "/api/project-cost-model",
    label: "コスト試算 (PJコックピット / PJワークスペース)",
    routeFile: "src/app/api/project-cost-model/route.ts",
    clientModule: "src/lib/project-cost-model-client.ts",
  },
  {
    endpoint: "/api/project-tech",
    label: "技術台帳 (PJコックピット 技術タブ)",
    routeFile: "src/app/api/project-tech/route.ts",
    clientModule: "src/lib/project-tech-client.ts",
  },
  {
    endpoint: "/api/model/sections",
    label: "モデル正本の節一覧 (左ナビ)",
    routeFile: "src/app/api/model/sections/route.ts",
    clientModule: "src/lib/model-sections-client.ts",
  },
  {
    endpoint: "/api/model/bzm30",
    label: "BZM 3.0 の式・係数・計算結果 (シーズ詳細のスコアパネル)",
    routeFile: "src/app/api/model/bzm30/route.ts",
    clientModule: "src/lib/bzm30-model-client.ts",
  },
  {
    endpoint: "/api/seeds/bzm30",
    label: "シーズごとの BZM 3.0 の入力とスコア",
    routeFile: "src/app/api/seeds/bzm30/route.ts",
    clientModule: "src/lib/bzm30-seed-client.ts",
  },
  {
    endpoint: "/api/project/:p/sps-current",
    label: "現行SPS｜産業創出価値の凍結評価 (PJコックピット)",
    routeFile: "src/app/api/project/[projectId]/sps-current/route.ts",
    clientModule: "src/lib/current-sps-client.ts",
  },
  {
    endpoint: "/api/dashboard/company-content",
    label: "会社の記録 (ホーム下段のメンバー / 沿革 / メディア掲載 / 写真)",
    routeFile: "src/app/api/dashboard/company-content/route.ts",
    clientModule: "src/lib/company-content-client.ts",
  },
  {
    endpoint: "/api/admin/project-profitability",
    label: "PJ別 利益構造ダッシュボード",
    routeFile: "src/app/api/admin/project-profitability/route.ts",
    clientModule: "src/lib/project-profitability-client.ts",
  },
];

// ---------------------------------------------------------------------------

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      out.push(...walk(full));
    } else if (/\.(ts|tsx)$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

/** コメント内の記述を契約違反と誤判定しないため、走査前に落とす。 */
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

/** fetch() の第1引数の文字列リテラル先頭を拾い、テンプレート変数は :p に潰す。 */
function fetchedApiPaths(source) {
  const paths = [];
  const re = /fetch\(\s*[`"']([^`"']*)/g;
  let match;
  while ((match = re.exec(source)) !== null) {
    const raw = match[1];
    if (!raw.startsWith("/api/")) continue;
    paths.push(raw.replace(/\$\{[^}]*\}/g, ":p").replace(/\?.*$/, ""));
  }
  return paths;
}

const files = walk(srcDir);
const relative = (full) => path.relative(pwaDir, full).split(path.sep).join("/");

const scanned = files.map((full) => {
  const source = readFileSync(full, "utf8");
  const stripped = stripComments(source);
  return {
    rel: relative(full),
    source,
    stripped,
    isClient: /^\s*["']use client["']/m.test(source),
    apiFetches: fetchedApiPaths(stripped),
  };
});

const failures = [];

// --- 1〜3. 登録済み参照系エンドポイントの契約 -------------------------------------------
for (const entry of REFERENCE_DATA_ENDPOINTS) {
  const route = scanned.find((f) => f.rel === entry.routeFile);
  assert.ok(route, `${entry.label}: route ${entry.routeFile} が見つからない`);
  if (!/Cache-Control/.test(route.source)) {
    failures.push(`${entry.routeFile}: 参照系 route は Cache-Control を明示すること (${entry.label})`);
  }

  const client = scanned.find((f) => f.rel === entry.clientModule);
  assert.ok(client, `${entry.label}: client 層 ${entry.clientModule} が見つからない`);
  if (!/@\/lib\/reference-data-cache/.test(client.source)) {
    failures.push(`${entry.clientModule}: 参照系のクライアント層は @/lib/reference-data-cache を通すこと`);
  }

  for (const file of scanned) {
    if (file.rel === entry.clientModule || file.rel === entry.routeFile) continue;
    if (!file.apiFetches.some((p) => p === entry.endpoint || p.startsWith(`${entry.endpoint}/`))) continue;
    failures.push(
      `${file.rel}: ${entry.endpoint} を直接 fetch している。` +
        `${entry.clientModule} のキャッシュ経由で読むこと (${entry.label})`,
    );
  }
}

// --- 4. ラチェット: クライアントからの素の /api fetch を増やさない ----------------------
const baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
const allowed = new Set();
for (const [file, endpoints] of Object.entries(baseline.allowed)) {
  for (const endpoint of endpoints) allowed.add(`${file} ${endpoint}`);
}

// 登録済み参照系の client 層は、その endpoint を実際に fetch するのが役目なので除く。
// (除かないと「キャッシュ層を作れ」と言われて作った層自身が違反になる)
const registeredClientFetches = new Set(
  REFERENCE_DATA_ENDPOINTS.map((entry) => `${entry.clientModule} ${entry.endpoint}`),
);

const current = new Set();
for (const file of scanned) {
  if (!file.isClient) continue;
  for (const endpoint of file.apiFetches) {
    const key = `${file.rel} ${endpoint}`;
    if (registeredClientFetches.has(key)) continue;
    current.add(key);
  }
}

const added = [...current].filter((key) => !allowed.has(key)).sort();
for (const key of added) {
  const [file, endpoint] = key.split(" ");
  failures.push(
    `${file}: クライアントから ${endpoint} を素の fetch で読んでいる (baseline 未登録)。` +
      " 参照系なら src/lib/reference-data-cache.ts 経由のクライアント層を作る。" +
      " 可変系 (残高・進行中タスク・通知・編集中の下書き) なら" +
      " scripts/reference_data_cache_baseline.json へ理由付きで追加する。",
  );
}

// baseline に残った幽霊エントリは、消し忘れを溜めないよう警告だけ出す
const stale = [...allowed].filter((key) => !current.has(key));
if (stale.length > 0) {
  const head = stale.slice(0, 10).map((k) => `  - ${k}`).join("\n");
  console.warn(`[warn] baseline に実体の無いエントリが ${stale.length} 件 (整理推奨):\n${head}`);
}

if (failures.length > 0) {
  console.error(`参照系データのキャッシュ契約違反:\n${failures.map((f) => `  - ${f}`).join("\n")}`);
  process.exit(1);
}

console.log(
  `参照系キャッシュ契約 OK (登録エンドポイント ${REFERENCE_DATA_ENDPOINTS.length} / ` +
    `クライアント直 fetch ${current.size} 件は baseline 内)`,
);
