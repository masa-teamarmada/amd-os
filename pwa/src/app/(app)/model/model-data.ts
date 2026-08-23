import fs from "node:fs";
import path from "node:path";
import { readModelCanonFile } from "@/lib/model-canon-source";

/**
 * /model — モデル版数台帳セクションのデータ層。
 *
 * 内容正本は `amd-os/model/CURRENT.json` (機械可読サマリ) と
 * `amd-os/model/MODEL_VERSION_LEDGER.md` ほかの md (人が読む正本本文)。
 * このファイルはそれらを読むだけで、新しい概念・数式を生成しない。
 */

export type ModelStatusTone = "ok" | "warn" | "muted";

export interface ModelFormulaPart {
  type: "var" | "op";
  text?: string;
  symbol?: string;
  sup?: string;
  anchor?: string;
}

export interface ModelFormula {
  display: string;
  parts: ModelFormulaPart[];
}

export interface ModelCanonicalDoc {
  slug: string;
  title: string;
  path: string;
  status?: string;
  series?: "sps" | "bzm" | "common";
}

export interface ModelProposalDoc {
  slug: string;
  title: string;
  path: string;
  date?: string;
}

export interface ModelWithdrawnDoc {
  slug: string;
  title: string;
  path: string;
  date?: string;
  reason?: string;
}

export interface ModelTimelineEntry {
  date: string;
  title: string;
  formula?: string;
  note?: string;
  anchor?: string;
}

export interface ModelSeries {
  key: string;
  title: string;
  status: { label: string; tone: ModelStatusTone };
  formula: ModelFormula;
  summary: string;
  versions: Record<string, string>;
  canonical: ModelCanonicalDoc[];
  timeline: ModelTimelineEntry[];
}

export interface ModelCurrent {
  updated: string;
  ledger_slug: string;
  series: ModelSeries[];
  documents: {
    canonical: ModelCanonicalDoc[];
    proposals: ModelProposalDoc[];
    withdrawn: ModelWithdrawnDoc[];
  };
}

/**
 * model/CURRENT.json を読む。
 *
 * 既定パスは amd-os/model/CURRENT.json。台帳担当の作業と並行して画面側だけ先に
 * 検証できるよう、環境変数 MODEL_CURRENT_JSON_PATH でパスを上書きできる
 * (本番コードの既定挙動は変えない — 未設定なら常に既定パスを使う)。
 * ファイルが無い/壊れている場合は null を返し、呼び出し側は「台帳準備中」を出して落ちない。
 */
export function loadModelCurrent(): ModelCurrent | null {
  const overridePath = process.env.MODEL_CURRENT_JSON_PATH;
  const useOverride = Boolean(overridePath && overridePath.trim().length > 0);

  // 既定パスは参照系スナップショット (プロセス内キャッシュ) を通す。
  // 上書きパスは検証用なので毎回素で読む。
  let raw: string | null;
  if (useOverride) {
    const filePath = overridePath as string;
    raw = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : null;
  } else {
    raw = readModelCanonFile("model", "CURRENT.json");
  }

  if (raw === null) return null;
  try {
    return JSON.parse(raw) as ModelCurrent;
  } catch (err) {
    console.error("[model] CURRENT.json の読み込みに失敗しました:", err);
    return null;
  }
}

// slug は URL から decode してそのまま fs パスへ使うため、ディレクトリトラバーサル
// (`..` や `/`) を含むものは弾く。model/spec/manual の既存 slug はどれもこの形。
const SAFE_SLUG_RE = /^[A-Za-z0-9._-]+$/;

const MODEL_MD_SUBDIRS = ["", "proposals", "withdrawn"];

/**
 * slug から md 本文を読む。探索順:
 *   1. model/<slug>.md
 *   2. model/proposals/<slug>.md
 *   3. model/withdrawn/<slug>.md
 *   4. bzm/<slug>.md — ただし CURRENT.json の documents.canonical に
 *      `path: "bzm/<slug>.md"` として列挙されている slug だけ許可する。
 *      bzm/ 配下は別セッションの正本であり、台帳に載っていない md を
 *      無条件で外部公開しない。
 * どれにも当たらなければ null。
 */
export function getModelMarkdownSource(slug: string): string | null {
  if (!SAFE_SLUG_RE.test(slug)) return null;

  for (const sub of MODEL_MD_SUBDIRS) {
    const relPath = sub ? path.join(sub, `${slug}.md`) : `${slug}.md`;
    const source = readModelCanonFile("model", relPath);
    if (source !== null) return source;
  }

  const current = loadModelCurrent();
  const bzmRelPath = `bzm/${slug}.md`;
  const isListedBzmDoc = current?.documents.canonical.some(
    (doc) => doc.slug === slug && doc.path === bzmRelPath,
  );
  if (isListedBzmDoc) {
    return readModelCanonFile("bzm", `${slug}.md`);
  }

  return null;
}

export interface ModelSideNavGroup {
  key: string;
  label: string;
  items: { slug: string; title: string }[];
}

/**
 * CURRENT.json からサイドナビのグループを組み立てる。
 * 台帳 (固定3件) → 確定文書(SPS/BZM/共通) → 提案中 → 撤回済み、の順。
 */
export function buildModelSideNavGroups(current: ModelCurrent): ModelSideNavGroup[] {
  const canonicalBySeries = (series: "sps" | "bzm" | "common") =>
    current.documents.canonical
      .filter((doc) => doc.series === series)
      .map((doc) => ({ slug: doc.slug, title: doc.title }));

  const groups: ModelSideNavGroup[] = [
    {
      key: "ledger",
      label: "台帳",
      items: [
        // /model/formulas は [slug] より優先される静的 route (= 現行の式の一覧)。
        // 台帳の先頭に置くのは、モデルへ来る用のほとんどが「いまの式はどれか」だから。
        { slug: "formulas", title: "現行の式（BZM 2.2）" },
        { slug: current.ledger_slug, title: "版数台帳（MODEL_VERSION_LEDGER）" },
        { slug: "APPROVALS", title: "承認台帳（APPROVALS）" },
        { slug: "README", title: "運用規約（README）" },
      ],
    },
    { key: "canonical-sps", label: "確定文書 — SPS", items: canonicalBySeries("sps") },
    { key: "canonical-bzm", label: "確定文書 — BZM", items: canonicalBySeries("bzm") },
    { key: "canonical-common", label: "共通", items: canonicalBySeries("common") },
    {
      key: "proposals",
      label: "提案中",
      items: current.documents.proposals.map((doc) => ({ slug: doc.slug, title: doc.title })),
    },
    {
      key: "withdrawn",
      label: "撤回済み",
      items: current.documents.withdrawn.map((doc) => ({ slug: doc.slug, title: doc.title })),
    },
  ];

  return groups.filter((group) => group.items.length > 0);
}
