// DDの公開版 payload（投資家に見せる表示用データ）を元データから組み立てる純関数。
// DB・ネットワークには触れない。scripts/check_dd_payload.mts から直接検査する。
//
// ここでの約束（弱めるときは pwa/spec/5-17-dd-package-current-spec.md を先に直す）:
//   - 元データの行をそのまま渡さない。種類ごとに許可した項目だけを新しいオブジェクトへ写す（許可リスト方式）。
//   - 社内の出典メモ（source_ref / source_url）、作成者、内部メモ（資本政策のラウンドのメモ等）は写さない。
//   - コスト試算は明細・単価を写さず、計算結果の集計値だけを写す。
//   - 未確認事項は、元データの「要確認」「未定」「未解決の確認事項」から自動で拾い、管理者が書いた分と合わせる。
//   - 載せる範囲（includedParts）が選ばれていれば、選ばれた節・行・注意書き・段落だけを写す。選ばれなかった部分は
//     payload に入れない（ブラウザへ送ってから隠さない）。範囲が未選択（null）なら、元データの節・行をすべて写す。

import { canonicalJson, ddShortHash, type DdPart } from "@/lib/dd-package-core";
import type { TechBlockKind, TechConfidence, TechEntry, TechRating, TechSourceKind, TechTopic } from "@/lib/project-tech";
import { readTechPresentation } from "@/lib/project-tech";
import type { FundingPlan } from "@/lib/project-funding-plan";
import {
  deriveCapitalPlan,
  recalculateCapTable,
  resolvedValue,
  type CapitalEventType,
  type CapitalPlan,
  type EditableValue,
  type HolderKind,
} from "@/lib/capital-plan";
import {
  APPLICATION_LABEL,
  BREAKDOWN_ORDER,
  STRAIN_LABEL,
  biomassOf,
  computeCostModel,
  listApplications,
  listStrains,
  scenarioFullLabelOf,
  type CostModelBundle,
} from "@/lib/project-cost-model";

// 種類の定義は画面側からも読むので、軽い dd-package-core に置いてここから再公開する。
export { DD_ITEM_KINDS, DD_ITEM_KIND_LABEL, isDdItemKind, type DdItemKind } from "@/lib/dd-package-core";

/** 公開版がどの元データのどの版から作られたか。版を持たない元データは更新日時と内容の hash で追う。 */
export type DdSourceRef = {
  table: string;
  id: string;
  version?: string | number | null;
  updatedAt?: string | null;
  sha256?: string | null;
};

// --- 載せる範囲 ---------------------------------------------------------------------

type IncludedParts = ReadonlySet<string> | null;

function isIncluded(included: IncludedParts, key: string): boolean {
  return included === null || included.has(key);
}

/** 同じ内容の段落・見出しが並んでも key が重ならないよう、2つ目以降に -2, -3 … を付ける。 */
function uniqueKeys(baseKeys: string[]): string[] {
  const seen = new Map<string, number>();
  return baseKeys.map((key) => {
    const count = (seen.get(key) ?? 0) + 1;
    seen.set(key, count);
    return count === 1 ? key : `${key}-${count}`;
  });
}

function shortLabel(text: string, max = 48): string {
  // 見出し・段落の太字記号とコード記号だけを落とす（行の名前の _ や | はそのまま残す）。
  const flat = text.replace(/\s+/g, " ").replace(/\*\*|`/g, "").trim();
  return flat.length > max ? `${flat.slice(0, max)}…` : flat;
}

export type DdMarkdownSection = {
  /** body:lead（最初の見出しより前）または body:<見出しの hash>。空白だけの冒頭は null（常に残す）。 */
  key: string | null;
  label: string;
  /** 元の本文の切り出し（見出しの行を含む）。全節をつなげると元の本文に戻る。 */
  text: string;
};

/**
 * 本文（Markdown）を見出しで節に分ける。本文で一番上の階層の見出しだけで切り、下位の見出しは親の節に含める
 * （親を外したのに子の節だけ残ることが無いように）。コードブロックの中の # は見出しとみなさない。
 */
export function splitDdMarkdownSections(markdown: string): DdMarkdownSection[] {
  const lines = markdown.match(/[^\n]*\n|[^\n]+$/g) ?? [];
  type Line = { raw: string; level: number | null; heading: string | null };
  const parsed: Line[] = [];
  let fence: { char: string; length: number } | null = null;
  for (const raw of lines) {
    const line = raw.replace(/\r?\n$/, "");
    if (fence) {
      if (new RegExp(`^\\s{0,3}\\${fence.char}{${fence.length},}\\s*$`).test(line)) fence = null;
      parsed.push({ raw, level: null, heading: null });
      continue;
    }
    const open = /^\s{0,3}(`{3,}|~{3,})/.exec(line);
    if (open) {
      fence = { char: open[1][0], length: open[1].length };
      parsed.push({ raw, level: null, heading: null });
      continue;
    }
    const heading = /^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    parsed.push(heading ? { raw, level: heading[1].length, heading: heading[2].trim() } : { raw, level: null, heading: null });
  }
  const topLevel = parsed.reduce<number | null>(
    (min, line) => (line.level !== null && (min === null || line.level < min) ? line.level : min),
    null,
  );

  const sections: Array<{ heading: string | null; text: string }> = [{ heading: null, text: "" }];
  for (const line of parsed) {
    if (topLevel !== null && line.level === topLevel) {
      sections.push({ heading: line.heading, text: line.raw });
    } else {
      sections[sections.length - 1].text += line.raw;
    }
  }
  const headingKeys = uniqueKeys(
    sections.filter((section) => section.heading !== null).map((section) => `body:${ddShortHash(section.heading as string)}`),
  );
  let headingIndex = 0;
  return sections
    .map((section, index) => {
      if (section.heading !== null) {
        return { key: headingKeys[headingIndex++], label: shortLabel(section.heading, 60), text: section.text };
      }
      if (index === 0 && section.text.trim().length === 0) return { key: null, label: "", text: section.text };
      return {
        key: "body:lead",
        label: topLevel === null ? "本文" : "冒頭（最初の見出しより前）",
        text: section.text,
      };
    })
    .filter((section) => section.text.length > 0);
}

/** 本文のうち、選ばれた節だけをつなげる。すべて選ばれていれば元の本文と同じ文字列に戻る。 */
function pickMarkdownSections(markdown: string | null, included: IncludedParts): string | null {
  if (markdown === null) return null;
  if (included === null) return markdown;
  const picked = splitDdMarkdownSections(markdown)
    .filter((section) => section.key === null || included.has(section.key))
    .map((section) => section.text)
    .join("");
  return picked.trim().length > 0 ? picked : null;
}

function markdownParts(markdown: string | null, group: string): DdPart[] {
  if (!markdown || markdown.trim().length === 0) return [];
  return splitDdMarkdownSections(markdown)
    .filter((section): section is DdMarkdownSection & { key: string } => section.key !== null)
    .map((section) => ({ key: section.key, label: section.label, group }));
}

// --- 資料 -------------------------------------------------------------------------

export type DdDocumentPreview = "html" | "pdf" | "image" | null;

export type DdDocumentPayload = {
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

export function projectDdDocument(input: { fileName: string; mimeType: string; sizeBytes: number }): DdDocumentPayload {
  return {
    kind: "document",
    fileName: input.fileName,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
    preview: ddDocumentPreview(input.mimeType, input.fileName),
  };
}

// --- 技術台帳のページ ---------------------------------------------------------------

/** 表示部品（tech-blocks）が読む TechEntry の形に合わせる。社内の出典・作成者は空にする。 */
export type DdTechEntry = TechEntry;

export type DdTechTopicPayload = {
  kind: "tech_topic";
  topic: {
    title: string;
    summary: string | null;
    bodyMd: string | null;
    blockKind: TechBlockKind;
    techDomain: string | null;
    presentation: Record<string, unknown> | null;
    needsCheck: boolean;
    checkReason: string | null;
  };
  entries: DdTechEntry[];
};

function ownEntries(topic: TechTopic, entries: TechEntry[]): TechEntry[] {
  return entries
    .filter((entry) => entry.tech_topic_id === topic.tech_topic_id)
    .sort((a, b) => a.sort_order - b.sort_order || a.row_label.localeCompare(b.row_label, "ja"));
}

/** 表の行の key。星取り表（matrix）は観点の行ごと（その行の全列）、ほかの表は1行ごと。 */
function techEntryPartKey(topic: TechTopic, entry: TechEntry): string {
  return topic.block_kind === "matrix" ? `row:${ddShortHash(entry.row_label)}` : `entry:${entry.tech_entry_id}`;
}

/** 技術台帳のページで選べる範囲: 本文の節と、表の行。 */
export function listDdTechTopicParts(topic: TechTopic, entries: TechEntry[]): DdPart[] {
  const parts = markdownParts(topic.body_md, topic.block_kind === "matrix" ? "表の補足" : "本文");
  const seen = new Set<string>();
  for (const entry of ownEntries(topic, entries)) {
    const key = techEntryPartKey(topic, entry);
    if (seen.has(key)) continue;
    seen.add(key);
    const label = topic.block_kind === "matrix" || !entry.col_label ? entry.row_label : `${entry.row_label}（${entry.col_label}）`;
    parts.push({ key, label: shortLabel(label, 60), group: "表の行" });
  }
  return parts;
}

export function projectDdTechTopic(topic: TechTopic, entries: TechEntry[], included: IncludedParts = null): DdTechTopicPayload {
  // 行の備考（note）は社内メモが混ざりやすい（例: 「外部へ公開するときは〜をぼかす」）。
  // 社外向けに作った「公開可」のページだけ写し、社内・要秘匿のページでは写さない。
  const keepNotes = topic.confidentiality === "public";
  const own = ownEntries(topic, entries).filter((entry) => isIncluded(included, techEntryPartKey(topic, entry)));
  const presentation = readTechPresentation(topic.presentation) ? (topic.presentation as Record<string, unknown>) : null;
  return {
    kind: "tech_topic",
    topic: {
      title: topic.title,
      // ページの要約は DD の画面に出さない（項目の一行説明は管理者が別に書く）ので写さない。
      summary: null,
      bodyMd: pickMarkdownSections(topic.body_md, included),
      blockKind: topic.block_kind,
      techDomain: topic.tech_domain,
      presentation: presentation
        ? {
            heading: presentation.heading ?? null,
            eyecatch: presentation.eyecatch ?? null,
            lead: presentation.lead ?? null,
            note: presentation.note ?? null,
            self_col: presentation.self_col ?? null,
            highlight_rows: presentation.highlight_rows ?? [],
          }
        : null,
      needsCheck: topic.needs_check,
      checkReason: topic.check_reason,
    },
    entries: own.map((entry, index) => ({
      tech_entry_id: `e${index + 1}`,
      tech_topic_id: "dd",
      project_id: "",
      row_label: entry.row_label,
      col_label: entry.col_label,
      value_min: entry.value_min,
      value_max: entry.value_max,
      value_text: entry.value_text,
      unit: entry.unit,
      rating: entry.rating as TechRating | null,
      condition_text: entry.condition_text,
      observed_on: entry.observed_on,
      confidence: entry.confidence as TechConfidence,
      source_kind: entry.source_kind as TechSourceKind,
      source_ref: null,
      source_url: null,
      note: keepNotes ? entry.note : null,
      needs_check: entry.needs_check,
      check_reason: entry.check_reason,
      sort_order: index,
      created_by: null,
      updated_by: null,
      created_at: "",
      updated_at: "",
    })),
  };
}

/** 技術台帳のページの未確認事項。ページと行の「要確認」を理由つきで拾う。 */
export function ddTechTopicUnverified(payload: DdTechTopicPayload): string[] {
  const notes: string[] = [];
  if (payload.topic.needsCheck) {
    notes.push(payload.topic.checkReason ? `このページ全体：${payload.topic.checkReason}` : "このページ全体に要確認の記載がある");
  }
  for (const entry of payload.entries) {
    if (!entry.needs_check) continue;
    const place = entry.col_label ? `${entry.row_label}（${entry.col_label}）` : entry.row_label;
    notes.push(entry.check_reason ? `${place}：${entry.check_reason}` : `${place}：要確認`);
  }
  return notes;
}

// --- 資金計画 -------------------------------------------------------------------

export type DdFundingPlanPayload = {
  kind: "funding_plan";
  plan: FundingPlan;
};

function paragraphKeys(prefix: "policy" | "assumption", paragraphs: string[]): string[] {
  return uniqueKeys(paragraphs.map((text) => `${prefix}:${ddShortHash(text)}`));
}

/** 資金計画で選べる範囲: 調達方針と前提の段落、採用資料の名前、設備予算の備考。月次の表・グラフ・費用の表は常に載せる。 */
export function listDdFundingPlanParts(plan: FundingPlan): DdPart[] {
  const summary = plan.summary;
  const policyKeys = paragraphKeys("policy", summary.bridgePolicy);
  const assumptionKeys = paragraphKeys("assumption", summary.assumptions);
  return [
    ...summary.bridgePolicy.map((text, index) => ({ key: policyKeys[index], label: shortLabel(text), group: "採択・不採択時の調達方針" })),
    ...summary.assumptions.map((text, index) => ({
      key: assumptionKeys[index],
      label: shortLabel(text),
      group: "STS対象経費・支払時期・未確定条件",
    })),
    ...(summary.source.adoptedMaterial ? [{ key: "source", label: `採用資料の名前（${shortLabel(summary.source.adoptedMaterial)}）`, group: "その他" }] : []),
    ...(summary.equipment.some((row) => row.note)
      ? [{ key: "equipmentNotes", label: "設備・初期費用の備考（表の項目名にマウスを重ねると出る）", group: "その他" }]
      : []),
  ];
}

export function projectDdFundingPlan(plan: FundingPlan, included: IncludedParts = null): DdFundingPlanPayload {
  // 表示部品 CockpitFundingPlan が読む形そのまま。月次の値は resolveFundingPlan で整合を検査済みのものだけを受け取る。
  const copy = JSON.parse(JSON.stringify(plan)) as FundingPlan;
  const summary = copy.summary;
  const policyKeys = paragraphKeys("policy", summary.bridgePolicy);
  const assumptionKeys = paragraphKeys("assumption", summary.assumptions);
  summary.bridgePolicy = summary.bridgePolicy.filter((_, index) => isIncluded(included, policyKeys[index]));
  summary.assumptions = summary.assumptions.filter((_, index) => isIncluded(included, assumptionKeys[index]));
  if (!isIncluded(included, "source")) summary.source = { ...summary.source, adoptedMaterial: "" };
  if (!isIncluded(included, "equipmentNotes")) summary.equipment = summary.equipment.map((row) => ({ ...row, note: "" }));
  // 元の試算表の hash は画面に出さず、公開版の元データ参照（source_refs）で追えるので写さない。
  summary.source = { ...summary.source, workbookSha256: "" };
  // 月の行（初月）にも同じ summary の全文が入っている。表示部品は月の scenarios しか読まないので、月の summary は写さない
  // （外した段落が、月の行の側からブラウザへ届かないように）。
  copy.months = copy.months.map((month) => ({
    ...month,
    planning_details_json: { ...month.planning_details_json, summary: null },
  }));
  return { kind: "funding_plan", plan: copy };
}

export function ddFundingPlanUnverified(payload: DdFundingPlanPayload): string[] {
  const summary = payload.plan.summary;
  const notes: string[] = [];
  if (summary.nextRoundAmountYen === null) notes.push("シリーズAの新規調達額は未確定（必要額を再精査中）");
  notes.push(`融資相談枠の目安${Math.round(summary.loanFacilityTargetYen / 1e4).toLocaleString("ja-JP")}万円は未合意`);
  if (summary.improvementTargetYen > 0) {
    notes.push(`純改善目標${Math.round(summary.improvementTargetYen / 1e4).toLocaleString("ja-JP")}万円は実行月未定で、月次の残高に入れていない`);
  }
  return notes;
}

// --- 資本政策 -------------------------------------------------------------------

export type DdCapitalPolicyOptions = {
  /** このラウンドまでを載せる（含む）。未指定なら全ラウンド。 */
  lastEventId?: string | null;
};

export type DdCapitalPolicyPayload = {
  kind: "capital_policy";
  basis: "working" | "frozen";
  planName: string;
  planRevision: number | null;
  frozenVersion: number | null;
  holders: Array<{ id: string; name: string; kind: HolderKind }>;
  events: Array<{
    id: string;
    label: string;
    type: CapitalEventType;
    status: "confirmed" | "planned";
    date: string | null;
    preMoneyValuation: number | null;
    postMoneyValuation: number | null;
    pricePerShare: number | null;
    primaryRaise: number | null;
    newShares: number | null;
    conversionCap: number | null;
    conversionDiscount: number | null;
    allocationCount: number;
  }>;
  standings: Array<{
    eventId: string;
    totalIssuedShares: number;
    totalFullyDilutedShares: number;
    holders: Array<{
      holderId: string;
      issuedShares: number;
      fullyDilutedShares: number;
      issuedPercentage: number;
      fullyDilutedPercentage: number;
    }>;
  }>;
};

function editableOrNull(value: EditableValue | undefined | null): number | null {
  if (!value) return null;
  const resolved = resolvedValue(value);
  return Number.isFinite(resolved) ? resolved : null;
}

/**
 * 資本政策の公開版。計算は既存エンジン（deriveCapitalPlan / recalculateCapTable）をそのまま使い、
 * ラウンドのメモ・配分ごとのメモ・株主のメモは写さない。
 */
export function projectDdCapitalPolicy(
  plan: CapitalPlan,
  meta: { basis: "working" | "frozen"; planRevision: number | null; frozenVersion: number | null },
  options: DdCapitalPolicyOptions = {},
): DdCapitalPolicyPayload {
  const derived = deriveCapitalPlan(plan);
  const ordered = [...derived.events].sort((a, b) => a.order - b.order);
  const lastIndex = options.lastEventId ? ordered.findIndex((event) => event.id === options.lastEventId) : -1;
  const included = lastIndex >= 0 ? ordered.slice(0, lastIndex + 1) : ordered;
  const includedIds = new Set(included.map((event) => event.id));
  const snapshots = recalculateCapTable(derived).filter((snapshot) => includedIds.has(snapshot.eventId));

  const holderIds = new Set<string>();
  for (const snapshot of snapshots) {
    for (const standing of snapshot.holders) {
      if (standing.fullyDilutedShares !== 0 || standing.issuedShares !== 0) holderIds.add(standing.holderId);
    }
  }

  return {
    kind: "capital_policy",
    basis: meta.basis,
    planName: plan.name,
    planRevision: meta.planRevision,
    frozenVersion: meta.frozenVersion,
    holders: derived.holders
      .filter((holder) => holderIds.has(holder.id))
      .map((holder) => ({ id: holder.id, name: holder.name, kind: holder.kind })),
    events: included.map((event) => ({
      id: event.id,
      label: event.label,
      type: event.type,
      status: event.status === "planned" ? "planned" : "confirmed",
      date: event.date ?? null,
      preMoneyValuation: editableOrNull(event.preMoneyValuation),
      postMoneyValuation: editableOrNull(event.postMoneyValuation),
      pricePerShare: editableOrNull(event.pricePerShare),
      primaryRaise: editableOrNull(event.primaryRaise),
      newShares: editableOrNull(event.newShares),
      conversionCap: editableOrNull(event.conversionCap),
      conversionDiscount: editableOrNull(event.conversionDiscount),
      allocationCount: event.allocations.length,
    })),
    standings: snapshots.map((snapshot) => ({
      eventId: snapshot.eventId,
      totalIssuedShares: snapshot.totalIssuedShares,
      totalFullyDilutedShares: snapshot.totalFullyDilutedShares,
      holders: snapshot.holders
        .filter((standing) => holderIds.has(standing.holderId))
        .map((standing) => ({
          holderId: standing.holderId,
          issuedShares: standing.issuedShares,
          fullyDilutedShares: standing.fullyDilutedShares,
          issuedPercentage: standing.issuedPercentage,
          fullyDilutedPercentage: standing.fullyDilutedPercentage,
        })),
    })),
  };
}

const FINANCING_TYPES = new Set<CapitalEventType>(["equity_issue", "convertible_issue", "convertible_conversion", "ipo"]);

export function ddCapitalPolicyUnverified(payload: DdCapitalPolicyPayload): string[] {
  const notes: string[] = [];
  if (payload.basis === "working") {
    notes.push(
      `凍結した提出版ではなく、作業中の案（第${payload.planRevision ?? "?"}版）を公開時点で固定したもの`,
    );
  }
  for (const event of payload.events) {
    if (!FINANCING_TYPES.has(event.type)) continue;
    if (event.allocationCount === 0) {
      notes.push(`${event.label}：調達額・評価額・投資家配分は未定`);
      continue;
    }
    if (event.status === "planned") {
      notes.push(`${event.label}：計画値（未実行）`);
    }
    if (event.type === "convertible_issue") {
      notes.push(`${event.label}：株式数・持株比率は、転換上限（キャップ）で転換したと仮定した試算で、実際に発行する株式数ではない`);
    }
  }
  return notes;
}

// --- 採算（コスト試算） ----------------------------------------------------------

export type DdCostModelPayload = {
  kind: "cost_model";
  model: {
    title: string;
    caseLabel: string;
    versionLabel: string | null;
    unitBasisLabel: string;
    summaryMd: string | null;
    systemScopeMd: string | null;
  };
  strains: Array<{
    strainLabel: string;
    biomass: Array<{ applicationLabel: string; perKg: number }>;
    scenarios: Array<{
      label: string;
      applicationLabel: string;
      totalPerUnit: number;
      salePricePerUnit: number;
      profitPerUnit: number;
      marginRate: number;
      breakdown: Array<{ label: string; perUnit: number }>;
    }>;
  }>;
  keyAssumptions: Array<{ groupLabel: string; label: string; value: string; confidence: string | null }>;
  caveats: Array<{ title: string; bodyMd: string | null }>;
};

function formatAssumptionValue(input: { value: number | null; valueText: string | null; unit: string | null }): string {
  if (input.valueText && input.valueText.trim()) return input.valueText.trim();
  if (input.value === null || !Number.isFinite(input.value)) return "未設定";
  const number = input.value.toLocaleString("ja-JP", { maximumFractionDigits: 4 });
  return input.unit ? `${number} ${input.unit}` : number;
}

function caveatNotes(bundle: CostModelBundle) {
  return bundle.notes.filter((note) => note.section === "caveat").sort((a, b) => a.sortOrder - b.sortOrder);
}

/** 採算で選べる範囲: 想定している系の説明文、主要な前提の表、注意書き1件ずつ。方式ごとの総コストの表は常に載せる。 */
export function listDdCostModelParts(bundle: CostModelBundle): DdPart[] {
  return [
    ...(bundle.model.systemScopeMd?.trim() ? [{ key: "scope", label: "想定している系（説明文）", group: "説明と前提" }] : []),
    ...(bundle.assumptions.some((assumption) => assumption.isKey)
      ? [{ key: "assumptions", label: "主要な前提の表", group: "説明と前提" }]
      : []),
    ...caveatNotes(bundle).map((note) => ({ key: `caveat:${note.costNoteId}`, label: shortLabel(note.title, 60), group: "試算の注意書き" })),
  ];
}

/**
 * 採算の公開版。既存の計算エンジン computeCostModel を株ごとに回し、方式ごとの1単位あたりの総コスト・売価・内訳と、
 * 菌体1kgあたりの原価だけを写す。明細・単価・作業の行、出典・担当・メモは写さない。
 */
export function projectDdCostModel(bundle: CostModelBundle, included: IncludedParts = null): DdCostModelPayload {
  const strains = listStrains(bundle);
  const applications = listApplications(bundle);
  const strainList = strains.length > 0 ? strains : [null];
  return {
    kind: "cost_model",
    model: {
      title: bundle.model.title,
      caseLabel: bundle.model.caseLabel,
      versionLabel: bundle.model.versionLabel,
      unitBasisLabel: bundle.model.unitBasisLabel,
      // 試算の要約は DD の画面に出さない（冒頭の説明は画面側で固定文を出す）ので写さない。
      summaryMd: null,
      systemScopeMd: isIncluded(included, "scope") ? bundle.model.systemScopeMd : null,
    },
    strains: strainList.map((strain) => {
      const computed = computeCostModel(bundle, { strain });
      const appList = applications.length > 0 ? applications : [null];
      return {
        strainLabel: strain ? STRAIN_LABEL[strain] : "標準",
        biomass: appList.map((application) => ({
          applicationLabel: application ? APPLICATION_LABEL[application] : "共通",
          perKg: biomassOf(computed, application).perKg,
        })),
        scenarios: computed.scenarios.map((scenario) => ({
          // オンサイトとオフサイトで同じ方式名が並ぶので、処理場所つきの名前にする（例: オンサイト・直接投入）。
          label: scenarioFullLabelOf(scenario.location, scenario.method, scenario.tankMode, computed.onsiteTankBearer),
          applicationLabel: scenario.applicationLabel,
          totalPerUnit: scenario.totalPerUnit,
          salePricePerUnit: scenario.salePricePerUnit,
          profitPerUnit: scenario.profitPerUnit,
          marginRate: scenario.marginRate,
          breakdown: BREAKDOWN_ORDER.map((key) => {
            const slice = scenario.breakdown.find((item) => item.key === key);
            return { label: slice?.label ?? key, perUnit: slice?.perUnit ?? 0 };
          }),
        })),
      };
    }),
    keyAssumptions: isIncluded(included, "assumptions")
      ? bundle.assumptions
          .filter((assumption) => assumption.isKey)
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((assumption) => ({
            groupLabel: assumption.groupLabel,
            label: assumption.label,
            value: formatAssumptionValue(assumption),
            confidence: assumption.confidence,
          }))
      : [],
    caveats: caveatNotes(bundle)
      .filter((note) => isIncluded(included, `caveat:${note.costNoteId}`))
      .map((note) => ({ title: note.title, bodyMd: note.bodyMd })),
  };
}

/** 採算の未確認事項。未解決の確認事項の問いだけを拾う（宛先・影響額・回答は写さない）。 */
export function ddCostModelUnverified(bundle: CostModelBundle): string[] {
  return bundle.questions
    .filter((question) => question.status === "open")
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((question) => question.question.trim())
    .filter((question) => question.length > 0)
    .slice(0, 20);
}

/** 公開版の内容 hash を TS 側で比べたいとき用（DB 側の hash とは別。表示の差分検出にだけ使う）。 */
export function ddPayloadFingerprint(payload: unknown): string {
  return canonicalJson(payload);
}
