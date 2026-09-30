// DDの閲覧画面に渡す表示データ（ワークスペースと同じ部品が読む形）と、未確認事項の自動抽出。純関数。
// DB・ネットワークには触れない。scripts/check_dd_payload.mts から直接検査する。
//
// ここでの約束（弱めるときは pwa/spec/5-17-dd-package-current-spec.md を先に直す）:
//   - 中身はワークスペースと同じ。部品が表示に使う値は削らない
//     （2026-09-30 まさ「コックピット、ワークスペース、DDパッケのどこから見ても同じ内容が見えるようにしてほしい」）。
//   - 公開した時点で固定しない。閲覧のたびに元データの最新からこの形を作る（「中身を変えたらちゃんと変わるように」）。
//   - 部品が表示しない社内の値（作成者・更新者、資本政策のメモ、資金計画の月の行に重複して入っている summary）は
//     ブラウザへ送らない（送ってから隠す方式にしない）。
//   - 未確認事項は、元データの「要確認」「未定」「未解決の確認事項」から自動で拾い、管理者が書いた分と合わせる。

import type { TechEntry, TechTopic } from "@/lib/project-tech";
import type { FundingPlan } from "@/lib/project-funding-plan";
import { deriveCapitalPlan, type CapitalEventType, type CapitalPlan } from "@/lib/capital-plan";
import type { CostModelBundle } from "@/lib/project-cost-model";

// 種類の定義は画面側からも読むので、軽い dd-package-core に置いてここから再公開する。
export { DD_ITEM_KINDS, DD_ITEM_KIND_LABEL, isDdItemKind, type DdItemKind } from "@/lib/dd-package-core";

// --- 資料 -------------------------------------------------------------------------

export type DdDocumentPreview = "html" | "pdf" | "image" | null;

export type DdLiveDocument = {
  kind: "document";
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  preview: DdDocumentPreview;
};

export function ddDocumentPreview(mimeType: string, fileName: string): DdDocumentPreview {
  const mime = mimeType.toLowerCase();
  const name = fileName.toLowerCase();
  if (mime === "text/html" || name.endsWith(".html") || name.endsWith(".htm")) return "html";
  if (mime === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  if (/^image\/(png|jpeg|gif|webp)$/.test(mime)) return "image";
  return null;
}

export function shapeDdDocument(input: { fileName: string; mimeType: string; sizeBytes: number }): DdLiveDocument {
  return {
    kind: "document",
    fileName: input.fileName,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
    preview: ddDocumentPreview(input.mimeType, input.fileName),
  };
}

// --- 技術台帳のページ ---------------------------------------------------------------

/** ワークスペースの技術台帳と同じ1ページ（TopicCard が読む形）。作成者・更新者は画面に出ないので送らない。 */
export type DdLiveTechTopic = {
  kind: "tech_topic";
  projectId: string;
  topic: TechTopic;
  entries: TechEntry[];
};

export function shapeDdTechTopic(projectId: string, topic: TechTopic, entries: TechEntry[]): DdLiveTechTopic {
  const own = entries
    .filter((entry) => entry.tech_topic_id === topic.tech_topic_id)
    .sort((a, b) => a.sort_order - b.sort_order || a.row_label.localeCompare(b.row_label, "ja"))
    .map((entry) => ({ ...entry, created_by: null, updated_by: null }));
  return {
    kind: "tech_topic",
    projectId,
    topic: { ...topic, created_by: null, updated_by: null },
    entries: own,
  };
}

/** 技術台帳のページの未確認事項。ページと行の「要確認」を理由つきで拾う。 */
export function ddTechTopicUnverified(data: DdLiveTechTopic): string[] {
  const notes: string[] = [];
  if (data.topic.needs_check) {
    notes.push(data.topic.check_reason ? `このページ全体：${data.topic.check_reason}` : "このページ全体に要確認の記載がある");
  }
  for (const entry of data.entries) {
    if (!entry.needs_check) continue;
    const place = entry.col_label ? `${entry.row_label}（${entry.col_label}）` : entry.row_label;
    notes.push(entry.check_reason ? `${place}：${entry.check_reason}` : `${place}：要確認`);
  }
  return notes;
}

// --- 資金計画 -------------------------------------------------------------------

/** ワークスペースの試算表タブと同じ資金計画（CockpitFundingPlan が読む形）。 */
export type DdLiveFundingPlan = {
  kind: "funding_plan";
  plan: FundingPlan;
};

export function shapeDdFundingPlan(plan: FundingPlan): DdLiveFundingPlan {
  const copy = JSON.parse(JSON.stringify(plan)) as FundingPlan;
  // 月の行（初月）には summary の全文がもう1つ入っている。表示部品は月の scenarios しか読まないので送らない。
  copy.months = copy.months.map((month) => ({
    ...month,
    planning_details_json: { ...month.planning_details_json, summary: null },
  }));
  return { kind: "funding_plan", plan: copy };
}

export function ddFundingPlanUnverified(data: DdLiveFundingPlan): string[] {
  const summary = data.plan.summary;
  const notes: string[] = [];
  if (summary.nextRoundAmountYen === null) notes.push("シリーズAの新規調達額は未確定（必要額を再精査中）");
  notes.push(`融資相談枠の目安${Math.round(summary.loanFacilityTargetYen / 1e4).toLocaleString("ja-JP")}万円は未合意`);
  if (summary.improvementTargetYen > 0) {
    notes.push(`純改善目標${Math.round(summary.improvementTargetYen / 1e4).toLocaleString("ja-JP")}万円は実行月未定で、月次の残高に入れていない`);
  }
  return notes;
}

// --- 資本政策 -------------------------------------------------------------------

/** ワークスペースの資本政策表と同じ表（CapitalPlanMatrix が読む形）。メモは画面に出ないので送らない。 */
export type DdLiveCapitalPolicy = {
  kind: "capital_policy";
  basis: "working" | "frozen";
  planRevision: number | null;
  frozenVersion: number | null;
  plan: CapitalPlan;
};

/** 資本政策の JSON から、株主・ラウンド・配分・値の「note」（社内のメモ）をすべて外す。 */
function withoutNotes<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => withoutNotes(item)) as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (key === "note") continue;
      out[key] = withoutNotes(item);
    }
    return out as T;
  }
  return value;
}

export function shapeDdCapitalPolicy(
  plan: CapitalPlan,
  meta: { basis: "working" | "frozen"; planRevision: number | null; frozenVersion: number | null },
): DdLiveCapitalPolicy {
  return {
    kind: "capital_policy",
    basis: meta.basis,
    planRevision: meta.planRevision,
    frozenVersion: meta.frozenVersion,
    plan: withoutNotes(plan),
  };
}

const FINANCING_TYPES = new Set<CapitalEventType>(["equity_issue", "convertible_issue", "convertible_conversion", "ipo"]);

export function ddCapitalPolicyUnverified(data: DdLiveCapitalPolicy): string[] {
  const notes: string[] = [];
  if (data.basis === "working") {
    notes.push(`凍結した提出版ではなく、作業中の案（第${data.planRevision ?? "?"}版）の最新を表示している`);
  }
  let events: CapitalPlan["events"];
  try {
    events = deriveCapitalPlan(data.plan).events;
  } catch {
    events = data.plan.events;
  }
  for (const event of [...events].sort((a, b) => a.order - b.order)) {
    if (!FINANCING_TYPES.has(event.type)) continue;
    if (event.allocations.length === 0) {
      notes.push(`${event.label}：調達額・評価額・投資家配分は未定`);
      continue;
    }
    if (event.status === "planned") notes.push(`${event.label}：計画値（未実行）`);
    if (event.type === "convertible_issue") {
      notes.push(`${event.label}：株式数・持株比率は、転換上限（キャップ）で転換したと仮定した試算で、実際に発行する株式数ではない`);
    }
  }
  return notes;
}

// --- 採算（コスト試算） ----------------------------------------------------------

/** ワークスペースのコスト試算タブと同じ試算（CockpitCostModel / CockpitFuelCostModel が読む形）。 */
export type DdLiveCostModel = {
  kind: "cost_model";
  projectId: string;
  /** default はコスト試算（廃液）タブ、fuel はコスト試算（燃料）タブと同じ試算。 */
  costKind: "default" | "fuel";
  bundle: CostModelBundle;
};

export function shapeDdCostModel(projectId: string, costKind: "default" | "fuel", bundle: CostModelBundle): DdLiveCostModel {
  return { kind: "cost_model", projectId, costKind, bundle };
}

/** 採算の未確認事項。未解決の確認事項の問いだけを拾う（宛先・影響額・回答は未確認事項には入れない）。 */
export function ddCostModelUnverified(bundle: CostModelBundle): string[] {
  return bundle.questions
    .filter((question) => question.status === "open")
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((question) => question.question.trim())
    .filter((question) => question.length > 0)
    .slice(0, 20);
}

// --- まとめ -------------------------------------------------------------------

export type DdLiveData = DdLiveDocument | DdLiveTechTopic | DdLiveFundingPlan | DdLiveCapitalPolicy | DdLiveCostModel;
