const DEFAULT_TEXTBOOK_TARGET_SLUG = "8-1-amd-os-operations";

export const VALID_TEXTBOOK_PRACTICE_KINDS = new Set([
  "decision_branch",
  "failure_learning",
  "cross_project_pattern",
  "theory_case",
  "reusable_question",
  "relationship_playbook",
  "field_transition",
]);

const PRACTICE_KIND_ROUTES = {
  decision_branch: {
    slug: "8-2-field-decisions-and-branches",
    proposedSection: "現場判断と分岐",
    reason: "第8部の意思決定章へ寄せる",
  },
  failure_learning: {
    slug: "8-3-failures-pivots-and-revisions",
    proposedSection: "失敗・ピボット・仮説修正",
    reason: "失敗から次回の判断へ変換する章へ寄せる",
  },
  relationship_playbook: {
    slug: "8-4-relationship-playbook",
    proposedSection: "関係構築プレイブック",
    reason: "相手別の関係構築章へ寄せる",
  },
  reusable_question: {
    slug: "8-5-before-zero-checkpoints",
    proposedSection: "再利用できる問い",
    reason: "次回PJで使う問い・チェックポイント章へ寄せる",
  },
  field_transition: {
    slug: "8-5-before-zero-checkpoints",
    proposedSection: "現場から事業化への移行チェック",
    reason: "研究現場から会社化へ移る確認項目として扱う",
  },
  cross_project_pattern: {
    slug: DEFAULT_TEXTBOOK_TARGET_SLUG,
    proposedSection: "PJ横断パターン",
    reason: "明確な retrofit 検証ケースでない横断傾向は、AMD OS運用知として8-1へ置く",
    warning: "cross_project_pattern routed to 8-1; set target_bzm_slug=6-1-retrofit-verification explicitly for concrete retrofit/case validation",
  },
  theory_case: {
    slug: "6-1-retrofit-verification",
    proposedSection: "BZMレビュー対象ケース",
    reason: "理論の式・rubric・定義は変えず、BZM review 前提の検証ケースとして6-1へ置く",
    warning: "theory_case routed to 6-1 and requires BZM review before local append",
  },
};

export function resolveTextbookInsightRouting({ practiceKind, targetBzmSlug, proposedSection } = {}) {
  const rawPracticeKind = String(practiceKind || "").trim();
  const rawTargetSlug = String(targetBzmSlug || "").trim();
  const explicitNonDefaultTarget = rawTargetSlug && rawTargetSlug !== DEFAULT_TEXTBOOK_TARGET_SLUG;

  if (!rawPracticeKind) {
    return {
      targetBzmSlug: rawTargetSlug || DEFAULT_TEXTBOOK_TARGET_SLUG,
      proposedSection: proposedSection || null,
      source: rawTargetSlug ? "explicit" : "fallback",
      reason: "practice_kind missing; keeping explicit/default target",
      warnings: ["missing practice_kind; target routing fell back to explicit/default slug"],
    };
  }

  if (!VALID_TEXTBOOK_PRACTICE_KINDS.has(rawPracticeKind)) {
    return {
      targetBzmSlug: rawTargetSlug || DEFAULT_TEXTBOOK_TARGET_SLUG,
      proposedSection: proposedSection || null,
      source: rawTargetSlug ? "explicit" : "fallback",
      reason: `unknown practice_kind ${rawPracticeKind}; keeping explicit/default target`,
      warnings: [`unknown practice_kind: ${rawPracticeKind}`],
    };
  }

  if (explicitNonDefaultTarget) {
    return {
      targetBzmSlug: rawTargetSlug,
      proposedSection: proposedSection || PRACTICE_KIND_ROUTES[rawPracticeKind]?.proposedSection || null,
      source: "explicit",
      reason: "explicit non-default target_bzm_slug kept",
      warnings: [],
    };
  }

  const route = PRACTICE_KIND_ROUTES[rawPracticeKind];
  return {
    targetBzmSlug: route.slug,
    proposedSection: proposedSection || route.proposedSection,
    source: "practice_kind",
    reason: route.reason,
    warnings: route.warning ? [route.warning] : [],
  };
}

export function previewTextbookInsightRouting(items) {
  return (Array.isArray(items) ? items : []).map((item) => {
    const metadata = item?.metadata_json || item?.metadataJson || item?.metadata || {};
    const practiceKind = item?.practice_kind || item?.practiceKind || metadata.practice_kind;
    return {
      title: item?.title || item?.topic || "",
      practice_kind: practiceKind || null,
      ...resolveTextbookInsightRouting({
        practiceKind,
        targetBzmSlug: item?.target_bzm_slug || item?.targetBzmSlug,
        proposedSection: item?.proposed_section || item?.proposedSection,
      }),
    };
  });
}
