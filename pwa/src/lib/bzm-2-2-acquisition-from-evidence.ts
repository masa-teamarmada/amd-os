/**
 * 重要情報の正本化 (通知で採用) から BZM 2.2 獲得台帳の行を導出する非LLM mapper。
 * 正本: pwa/spec/4-6-bzm-22-acquisition-ledger-current-spec.md §6
 *       pwa/spec/3-18-important-document-extraction-current-spec.md §9
 *
 * 守ること:
 *   - 採用された候補からしか導出しない (候補のまま台帳へ入れない)
 *   - 1つの正規化事象 = 1行。同じ content_sha256 は同じ canonical_event_key へ畳む
 *   - closed_constraints / consumed / action_delta は抽出では埋めない。
 *     どの制約が 不明/違反 → 充足 へ動いたかは意味判断であり、
 *     allowlist の非LLM写像で埋めると「未取得」を「無し」に見せてしまう。
 *     空配列 = 未取得であり 0 ではない (UI は「記録なし（未取得）」と描く)。
 *   - numeric_binding は必ず display_only。計算へ入れるのは spec 4-6 §2 の第2段。
 *   - 原文・URL・連絡先は台帳へ持ち込まない (sanitize 済み短文のみ)
 */

import {
  BZM22_AUDIT_TAG_LABELS,
  BZM22_STATE_LAYERS,
  type Bzm22StateLayer,
} from "@/lib/bzm-2-2-acquisitions";
import { sanitizeImportantEvidenceText } from "@/lib/important-evidence-text";

type Bzm22AuditTag = keyof typeof BZM22_AUDIT_TAG_LABELS;

/** DB 列そのままの形 (jsonb は snake_case で保存する)。 */
type AcquisitionEvidenceRefRow = {
  source: string;
  source_ref: string;
  important_evidence_id: string | null;
  note: string;
};

type AcquisitionStateEffectRow = {
  layer: Bzm22StateLayer;
  effect: string;
  note: string;
};

/** 抽出側の重要度カテゴリ (scripts/lib/important_evidence_extraction.mts の ImportanceCategory)。 */
const CATEGORY_LABELS: Readonly<Record<string, string>> = {
  financial: "決算・財務",
  governance: "統治・株主総会",
  contract: "契約",
  funding: "資金調達",
  grant: "補助金・助成金",
  technical: "技術",
  project_plan: "事業計画",
  commercial: "商談・受注",
  risk_compliance: "リスク・法令",
  personnel: "人・体制",
  deadline: "期限",
  other: "その他",
};

/** カテゴリ → 監査タグ (2.2 §3 の多重付与。排他分類にしない)。 */
const CATEGORY_AUDIT_TAGS: Readonly<Record<string, Bzm22AuditTag[]>> = {
  financial: ["financial"],
  funding: ["financial"],
  grant: ["financial", "legal-regulatory"],
  governance: ["organization-governance", "legitimacy"],
  contract: ["legal-regulatory", "relational"],
  technical: ["technical-information"],
  project_plan: ["organization-governance"],
  commercial: ["relational"],
  risk_compliance: ["legal-regulatory"],
  personnel: ["human-attention"],
  deadline: [],
  other: [],
};

/** カテゴリ → 状態8層 (2.2 §4)。どの層の証拠が増えたかだけを記録し、量へ変換しない。 */
const CATEGORY_STATE_LAYERS: Readonly<Record<string, Bzm22StateLayer[]>> = {
  financial: ["r"],
  funding: ["r"],
  grant: ["r", "k"],
  governance: ["k", "l"],
  contract: ["k", "n"],
  technical: ["x"],
  project_plan: ["b"],
  commercial: ["n"],
  risk_compliance: ["e"],
  personnel: ["r"],
  deadline: ["e"],
  other: [],
};

const AUDIT_TAG_SET = new Set<string>(Object.keys(BZM22_AUDIT_TAG_LABELS));
const STATE_LAYER_SET = new Set<string>(BZM22_STATE_LAYERS);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SHA256_RE = /^[0-9a-f]{64}$/;

function asDate(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  if (DATE_RE.test(raw)) return raw;
  if (raw.length >= 10 && DATE_RE.test(raw.slice(0, 10))) return raw.slice(0, 10);
  return null;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item ?? "").trim()).filter(Boolean) : [];
}

/** 事象日の解決順。どこから採ったかで evidence_stage が変わるので origin も返す。 */
function resolveOccurredOn(candidate: Record<string, unknown>, fallbackOn: string): {
  occurredOn: string;
  origin: "document" | "material" | "system";
} {
  const documentDate =
    asDate(candidate.audit_signed_on)
    || asDate(candidate.balance_sheet_date)
    || asDate(candidate.effective_period_end);
  if (documentDate) return { occurredOn: documentDate, origin: "document" };

  const lineage = Array.isArray(candidate.lineage) ? candidate.lineage : [];
  for (const entry of lineage) {
    const row = (entry ?? {}) as Record<string, unknown>;
    const materialDate = asDate(row.modified_at) || asDate(row.created_at);
    if (materialDate) return { occurredOn: materialDate, origin: "material" };
  }

  const detected = asDate(candidate.detected_at);
  if (detected) return { occurredOn: detected, origin: "material" };
  return { occurredOn: fallbackOn, origin: "system" };
}

export type Bzm22AcquisitionInsert = {
  project_id: string;
  canonical_event_key: string;
  occurred_on: string;
  title: string;
  summary: string;
  audit_tags: Bzm22AuditTag[];
  evidence_stage: "observed" | "estimated";
  evidence_refs: AcquisitionEvidenceRefRow[];
  state_effects: AcquisitionStateEffectRow[];
  closed_constraints: never[];
  consumed: never[];
  action_delta: never[];
  numeric_binding: "display_only";
  bound_target: "";
  information_cutoff: string;
  model_version: string;
  source_origin: "extraction";
  status: "active";
};

/**
 * 採用済みの重要情報候補から獲得台帳の1行を作る。
 * 導出できない (project_id / content_sha256 が無い) 場合は null を返し、正本化自体は止めない。
 */
export function buildBzm22AcquisitionFromImportantEvidence(input: {
  candidate: Record<string, unknown>;
  projectId: string;
  importantEvidenceId: string | null;
  confirmedOn: string;
}): Bzm22AcquisitionInsert | null {
  const projectId = String(input.projectId ?? "").trim();
  const contentSha256 = String(input.candidate.content_sha256 ?? "").trim();
  const fallbackOn = asDate(input.confirmedOn);
  if (!projectId || !SHA256_RE.test(contentSha256) || !fallbackOn) return null;

  const categories = asStringArray(
    (input.candidate.importance as Record<string, unknown> | undefined)?.categories,
  ).filter((category) => category in CATEGORY_LABELS);

  const auditTags = [
    ...new Set(categories.flatMap((category) => CATEGORY_AUDIT_TAGS[category] ?? [])),
  ].filter((tag) => AUDIT_TAG_SET.has(tag));

  const stateEffects: AcquisitionStateEffectRow[] = [
    ...new Set(categories.flatMap((category) => CATEGORY_STATE_LAYERS[category] ?? [])),
  ]
    .filter((layer) => STATE_LAYER_SET.has(layer))
    .map((layer) => ({
      layer,
      effect: "この層の証拠が増えた",
      note: "抽出由来。どの制約が動いたかは未判定",
    }));

  const { occurredOn, origin } = resolveOccurredOn(input.candidate, fallbackOn);
  const textReadRequired = input.candidate.text_read_required === true;
  const evidenceStage = origin === "document" && !textReadRequired ? "observed" : "estimated";

  const documentClass = sanitizeImportantEvidenceText(input.candidate.document_class, 60);
  const categoryText = categories.map((category) => CATEGORY_LABELS[category]).join("・");
  const summary = sanitizeImportantEvidenceText(
    [
      `${documentClass || "資料"}を重要情報として正本化した。`,
      categoryText ? `分類: ${categoryText}。` : "",
      origin === "document" ? "" : "事象日は資料の日付から採った推定値。",
      textReadRequired ? "原文の全文確認が未了。" : "",
    ].filter(Boolean).join(""),
    500,
  );

  const lineage = Array.isArray(input.candidate.lineage) ? input.candidate.lineage : [];
  const evidenceRefs: AcquisitionEvidenceRefRow[] = lineage.map((entry) => {
    const row = (entry ?? {}) as Record<string, unknown>;
    return {
      source: sanitizeImportantEvidenceText(row.source, 30),
      source_ref: sanitizeImportantEvidenceText(row.source_ref, 200),
      important_evidence_id: input.importantEvidenceId,
      note: row.extraction_status === "available" ? "" : "原文の取得が未了",
    };
  });
  if (evidenceRefs.length === 0) {
    evidenceRefs.push({
      source: sanitizeImportantEvidenceText(input.candidate.source, 30),
      source_ref: sanitizeImportantEvidenceText(input.candidate.canonical_source_ref, 200),
      important_evidence_id: input.importantEvidenceId,
      note: "",
    });
  }

  return {
    project_id: projectId,
    canonical_event_key: `important_evidence:${contentSha256}`,
    occurred_on: occurredOn,
    title: sanitizeImportantEvidenceText(input.candidate.title, 200) || "重要情報（表題未取得）",
    summary,
    audit_tags: auditTags,
    evidence_stage: evidenceStage,
    evidence_refs: evidenceRefs,
    state_effects: stateEffects,
    closed_constraints: [],
    consumed: [],
    action_delta: [],
    numeric_binding: "display_only",
    bound_target: "",
    information_cutoff: fallbackOn,
    model_version: "bzm2.2-acquisition/v1",
    source_origin: "extraction",
    status: "active",
  };
}
