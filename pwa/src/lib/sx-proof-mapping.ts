import type { SxManagementBundle } from "./sx-management";

/**
 * Centralized typed slug → proof mapping for the SX 実証スパイン.
 * SX_COO_DASHBOARD_SPEC_20260719.md 3.3.2: each of the 7 development themes must
 * connect to at least one of the three onsite-PoC proofs, and unassessed themes
 * must never be rendered/counted as 0% achievement.
 */

export type SxProofId = "reactor_spec" | "operation_verification" | "unit_economics";

export const SX_PROOF_THEME_SLUGS = [
  "tech-reactor-recheck",
  "tech-performance-test",
  "tech-reproducibility-test",
  "tech-scale-test",
  "tech-containment-test",
  "tech-recovery-test",
  "tech-poc-gate",
] as const;

export type SxProofThemeSlug = (typeof SX_PROOF_THEME_SLUGS)[number];

export const SX_THEME_LABELS: Record<SxProofThemeSlug, string> = {
  "tech-reactor-recheck": "リアクター構成",
  "tech-performance-test": "処理性能",
  "tech-reproducibility-test": "再現性",
  "tech-scale-test": "スケール成立性",
  "tech-containment-test": "封じ込め",
  "tech-recovery-test": "回収",
  "tech-poc-gate": "オンサイトPoC",
};

export const SX_PROOF_DEFINITIONS: Array<{ id: SxProofId; label: string; completionCriteria: string }> = [
  {
    id: "reactor_spec",
    label: "PoC用リアクター仕様確定",
    completionCriteria: "処理対象・処理量・構成・スケール・封じ込め・回収交換・設置条件・運転条件が、PoC受入条件と原価前提を含めて版管理された仕様として確定していること",
  },
  {
    id: "operation_verification",
    label: "確定仕様での動作確認",
    completionCriteria: "確定仕様のリアクターで、性能・再現性・安全性・連続運転・回収交換を含む合格条件を満たし、再現可能な証拠があること",
  },
  {
    id: "unit_economics",
    label: "ユニットエコノミクス証明",
    completionCriteria: "PoC条件の処理量・回収率・交換頻度・材料運転保守費・導入対価を用いて、成立条件と感度を説明できること",
  },
];

/** Every theme slug must map to at least one proof id — enforced by scripts/test_sx_proof_mapping.mjs. */
export const SX_THEME_PROOF_MAP: Record<SxProofThemeSlug, SxProofId[]> = {
  "tech-reactor-recheck": ["reactor_spec"],
  "tech-performance-test": ["operation_verification", "unit_economics"],
  "tech-reproducibility-test": ["operation_verification"],
  "tech-scale-test": ["reactor_spec", "operation_verification"],
  "tech-containment-test": ["reactor_spec", "operation_verification"],
  "tech-recovery-test": ["reactor_spec", "operation_verification", "unit_economics"],
  "tech-poc-gate": ["operation_verification", "unit_economics"],
};

function sxIsMissingOwnerLocal(value: string | null | undefined) {
  const trimmed = (value || "").trim();
  return !trimmed || trimmed.includes("未確認") || trimmed.includes("未設定") || trimmed.includes("未登録");
}

function normalizeThemeStatus(raw: string): "unassessed" | "on_track" | "attention" | "blocked" {
  if (raw === "passed" || raw === "completed" || raw === "on_track" || raw === "running") return "on_track";
  if (raw === "planned" || raw === "attention") return "attention";
  if (raw === "failed" || raw === "blocked" || raw === "at_risk") return "blocked";
  return "unassessed";
}

export type SxThemeStatusInfo = {
  slug: SxProofThemeSlug;
  label: string;
  status: "unassessed" | "on_track" | "attention" | "blocked";
  hasEvidence: boolean;
  ownerMissing: boolean;
  /** Deadline recorded for this theme itself. Never borrow a parent milestone date. */
  deadline: string | null;
};

export function sxThemeStatusInfos(management: SxManagementBundle): SxThemeStatusInfo[] {
  const reactor = management.milestones.find((item) => item.slug === "tech-reactor-recheck");
  const poc = management.milestones.find((item) => item.slug === "tech-poc-gate");
  const testBySlug = new Map(management.technicalTests.map((test) => [test.testSlug, test]));
  return SX_PROOF_THEME_SLUGS.map((slug) => {
    if (slug === "tech-reactor-recheck") {
      return {
        slug, label: SX_THEME_LABELS[slug], status: normalizeThemeStatus(reactor?.status || "unassessed"),
        hasEvidence: Boolean(reactor?.completionEvidence), ownerMissing: !reactor || sxIsMissingOwnerLocal(reactor.ownerLabel),
        deadline: reactor?.forecastEnd || reactor?.plannedEnd || null,
      };
    }
    if (slug === "tech-poc-gate") {
      return {
        slug, label: SX_THEME_LABELS[slug], status: normalizeThemeStatus(poc?.status || "unassessed"),
        hasEvidence: Boolean(poc?.completionEvidence), ownerMissing: !poc || sxIsMissingOwnerLocal(poc.ownerLabel),
        deadline: poc?.forecastEnd || poc?.plannedEnd || null,
      };
    }
    const test = testBySlug.get(slug);
    return {
      slug, label: SX_THEME_LABELS[slug], status: normalizeThemeStatus(test?.status || "unassessed"),
      hasEvidence: Boolean(test?.evidence || test?.actual != null), ownerMissing: !test || sxIsMissingOwnerLocal(test.ownerLabel),
      deadline: null,
    };
  });
}

export type SxProofOutcome = {
  id: SxProofId;
  label: string;
  completionCriteria: string;
  themeSlugs: SxProofThemeSlug[];
  themeLabels: string[];
  statusCounts: Record<string, number>;
  assessedCount: number;
  totalCount: number;
  /** null = すべてのテーマが未評価。0%と混同しないため描画側は必ず「未評価」と表示する。 */
  evidenceCoveragePct: number | null;
  deadline: string | null;
  missingInfo: string[];
};

export function computeSxProofOutcomes(management: SxManagementBundle): SxProofOutcome[] {
  const infos = sxThemeStatusInfos(management);
  return SX_PROOF_DEFINITIONS.map((definition) => {
    const themeSlugs = SX_PROOF_THEME_SLUGS.filter((slug) => SX_THEME_PROOF_MAP[slug].includes(definition.id));
    const rows = infos.filter((info) => themeSlugs.includes(info.slug));
    const statusCounts: Record<string, number> = {};
    rows.forEach((row) => { statusCounts[row.status] = (statusCounts[row.status] || 0) + 1; });
    const assessedCount = rows.filter((row) => row.status !== "unassessed").length;
    const evidenceCoveragePct = assessedCount === 0 ? null : Math.round((rows.filter((row) => row.hasEvidence).length / rows.length) * 100);
    const missingInfo: string[] = [];
    if (rows.some((row) => !row.hasEvidence)) missingInfo.push("証拠 未登録のテーマあり");
    if (rows.some((row) => row.ownerMissing)) missingInfo.push("担当 未確認のテーマあり");
    if (assessedCount === 0) missingInfo.push("関連テーマがすべて未評価");
    const deadlines = rows.map((row) => row.deadline).filter((value): value is string => Boolean(value));
    const deadline = deadlines.length > 0 ? [...deadlines].sort()[0] : null;
    return {
      id: definition.id, label: definition.label, completionCriteria: definition.completionCriteria,
      themeSlugs, themeLabels: themeSlugs.map((slug) => SX_THEME_LABELS[slug]),
      statusCounts, assessedCount, totalCount: rows.length,
      evidenceCoveragePct, deadline, missingInfo,
    };
  });
}

export type SxProofMatrixRow = { slug: SxProofThemeSlug; label: string; proofs: Record<SxProofId, boolean> };

export function sxProofThemeMatrix(): SxProofMatrixRow[] {
  return SX_PROOF_THEME_SLUGS.map((slug) => ({
    slug,
    label: SX_THEME_LABELS[slug],
    proofs: Object.fromEntries(SX_PROOF_DEFINITIONS.map((definition) => [definition.id, SX_THEME_PROOF_MAP[slug].includes(definition.id)])) as Record<SxProofId, boolean>,
  }));
}
