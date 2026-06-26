import crypto from "crypto";

export type GuardrailSeverity = "low" | "medium" | "high" | "critical";
export type GuardrailTagSet = Record<string, string[]>;

export type GuardrailCardRow = {
  card_id: string;
  title: string;
  summary: string;
  rationale?: string | null;
  severity: GuardrailSeverity | string;
  trigger_tags: unknown;
  negative_tags?: unknown;
  check_items?: unknown;
  recommended_actions?: unknown;
  output_template?: string | null;
};

export type GuardrailEvaluateInput = {
  project_id?: string | null;
  target_type: string;
  target_id: string;
  target_title?: string | null;
  target_date?: string | null;
  due_at?: string | null;
  project_tags?: unknown;
  action_tags?: unknown;
  evidence_refs_json?: unknown;
};

export type GuardrailEvaluation = {
  card: GuardrailCardRow;
  projectTags: GuardrailTagSet;
  actionTags: GuardrailTagSet;
  combinedTags: GuardrailTagSet;
  matchedTags: GuardrailTagSet;
  matchScore: number;
  severity: GuardrailSeverity;
  sourceHash: string;
  matchId: string;
};

const VALID_SEVERITIES = new Set<GuardrailSeverity>(["low", "medium", "high", "critical"]);

export function normalizeTagSet(value: unknown): GuardrailTagSet {
  const out: GuardrailTagSet = {};
  if (Array.isArray(value)) {
    for (const raw of value) {
      const text = normalizeTagValue(raw);
      if (!text) continue;
      const idx = text.indexOf(":");
      if (idx > 0) addTag(out, text.slice(0, idx), text.slice(idx + 1));
      else addTag(out, "generic", text);
    }
    return sortTagSet(out);
  }

  if (!isPlainObject(value)) return {};

  for (const [axisRaw, tagsRaw] of Object.entries(value)) {
    const axis = normalizeTagValue(axisRaw);
    if (!axis) continue;
    const values = Array.isArray(tagsRaw) ? tagsRaw : [tagsRaw];
    for (const raw of values) {
      const tag = normalizeTagValue(raw);
      if (!tag) continue;
      addTag(out, axis, tag);
    }
  }
  return sortTagSet(out);
}

export function mergeTagSets(...sets: GuardrailTagSet[]): GuardrailTagSet {
  const out: GuardrailTagSet = {};
  for (const set of sets) {
    for (const [axis, tags] of Object.entries(set)) {
      for (const tag of tags) addTag(out, axis, tag);
    }
  }
  return sortTagSet(out);
}

export function evaluateGuardrailCards(
  cards: GuardrailCardRow[],
  input: GuardrailEvaluateInput,
): GuardrailEvaluation[] {
  const projectTags = normalizeTagSet(input.project_tags);
  const actionTags = normalizeTagSet(input.action_tags);
  const combinedTags = mergeTagSets(projectTags, actionTags);
  const evaluations: GuardrailEvaluation[] = [];

  for (const card of cards) {
    const triggerTags = normalizeTagSet(card.trigger_tags);
    const requiredAxes = Object.keys(triggerTags).filter((axis) => triggerTags[axis]?.length > 0);
    if (requiredAxes.length === 0) continue;
    if (hasBlockedTags(card.negative_tags, combinedTags)) continue;

    const matchedTags: GuardrailTagSet = {};
    let matchedTagCount = 0;
    let requiredTagCount = 0;

    for (const axis of requiredAxes) {
      const required = triggerTags[axis] ?? [];
      const actual = combinedTags[axis] ?? [];
      requiredTagCount += required.length;
      const matches = required.filter((tag) => actual.includes(tag));
      if (matches.length === 0) {
        matchedTagCount = -1;
        break;
      }
      matchedTags[axis] = matches;
      matchedTagCount += matches.length;
    }
    if (matchedTagCount < 0) continue;

    const severity = normalizeSeverity(card.severity);
    const matchScore = requiredTagCount > 0
      ? round2(requiredAxes.length / requiredAxes.length + matchedTagCount / Math.max(1, requiredTagCount) * 0.25)
      : 1;
    const sourceHash = guardrailSourceHash(card.card_id, input, projectTags, actionTags);
    evaluations.push({
      card,
      projectTags,
      actionTags,
      combinedTags,
      matchedTags: sortTagSet(matchedTags),
      matchScore,
      severity,
      sourceHash,
      matchId: `gm:${sourceHash.slice(0, 40)}`,
    });
  }

  return evaluations.sort((a, b) => (
    severityRank(b.severity) - severityRank(a.severity)
    || b.matchScore - a.matchScore
    || a.card.card_id.localeCompare(b.card.card_id)
  ));
}

export function guardrailImportance(severity: GuardrailSeverity): number {
  switch (severity) {
    case "critical": return 10;
    case "high": return 8;
    case "medium": return 5;
    case "low": return 2;
  }
}

export function notificationClassForSeverity(severity: GuardrailSeverity): "critical" | "normal" {
  return severity === "critical" || severity === "high" ? "critical" : "normal";
}

export function guardrailNotificationSummary(evaluation: GuardrailEvaluation): string {
  const actions = arrayOfStrings(evaluation.card.recommended_actions).slice(0, 3);
  const checks = arrayOfStrings(evaluation.card.check_items).slice(0, 3);
  return [
    evaluation.card.summary,
    checks.length > 0 ? `確認: ${checks.join(" / ")}` : "",
    actions.length > 0 ? `次アクション: ${actions.join(" / ")}` : "",
  ].filter(Boolean).join("\n");
}

export function safeEvidenceRefs(value: unknown): unknown[] {
  return Array.isArray(value) ? value.slice(0, 20) : [];
}

function hasBlockedTags(negativeTagsRaw: unknown, combinedTags: GuardrailTagSet): boolean {
  const negativeTags = normalizeTagSet(negativeTagsRaw);
  for (const [axis, tags] of Object.entries(negativeTags)) {
    const actual = combinedTags[axis] ?? [];
    if (tags.some((tag) => actual.includes(tag))) return true;
  }
  return false;
}

function guardrailSourceHash(
  cardId: string,
  input: GuardrailEvaluateInput,
  projectTags: GuardrailTagSet,
  actionTags: GuardrailTagSet,
): string {
  return sha256(stableStringify({
    v: 1,
    card_id: cardId,
    project_id: input.project_id ?? null,
    target_type: input.target_type,
    target_id: input.target_id,
    target_date: input.target_date ?? null,
    project_tags: projectTags,
    action_tags: actionTags,
  }));
}

function addTag(out: GuardrailTagSet, axisRaw: unknown, tagRaw: unknown) {
  const axis = normalizeTagValue(axisRaw);
  const tag = normalizeTagValue(tagRaw);
  if (!axis || !tag) return;
  out[axis] = out[axis] ?? [];
  if (!out[axis].includes(tag)) out[axis].push(tag);
}

function normalizeTagValue(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/：/g, ":")
    .replace(/[|,]/g, "_");
}

function sortTagSet(set: GuardrailTagSet): GuardrailTagSet {
  return Object.fromEntries(
    Object.entries(set)
      .filter(([, tags]) => tags.length > 0)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([axis, tags]) => [axis, Array.from(new Set(tags)).sort()]),
  );
}

function normalizeSeverity(value: string): GuardrailSeverity {
  return VALID_SEVERITIES.has(value as GuardrailSeverity) ? value as GuardrailSeverity : "medium";
}

function severityRank(value: GuardrailSeverity): number {
  switch (value) {
    case "critical": return 4;
    case "high": return 3;
    case "medium": return 2;
    case "low": return 1;
  }
}

function arrayOfStrings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => String(item ?? "").trim()).filter(Boolean)
    : [];
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (isPlainObject(value)) {
    return `{${Object.keys(value).sort().map((key) => (
      `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`
    )).join(",")}}`;
  }
  return JSON.stringify(value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
