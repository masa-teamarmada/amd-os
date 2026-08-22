/**
 * BZM 2.2 獲得台帳 (「これまでのPJ活動のなかで得てきたもの」) の型とラベル。
 *
 * 正本: bzm/bzm-2-2-strategic-slack-and-propulsion.md
 *       pwa/spec/4-6-bzm-22-acquisition-ledger-current-spec.md
 *
 * 1行 = 1正規化事象 (§3)。三点セット = 閉じた条件 / 消費 / 開いた・閉じた行動。
 * 第1段は numeric_binding='display_only' 固定で、どの計算にも入らない。
 */

export const BZM22_STATE_LAYERS = ["x", "r", "c", "k", "n", "l", "e", "b"] as const;
export type Bzm22StateLayer = (typeof BZM22_STATE_LAYERS)[number];

/** §4 状態8層。異なる単位を足して一つの点数にしないため、層を必ず明示する。 */
export const BZM22_STATE_LAYER_LABELS: Record<Bzm22StateLayer, { short: string; label: string }> = {
  x: { short: "進捗", label: "進捗・技術知識の証拠" },
  r: { short: "資源", label: "資源 (現金・人・設備)" },
  c: { short: "能力", label: "能力の事後推定" },
  k: { short: "権利", label: "権利・契約・統治・規制" },
  n: { short: "関係", label: "相手方との関係・確約" },
  l: { short: "正当性", label: "受け手別の正当性" },
  e: { short: "外部", label: "外部環境・期限" },
  b: { short: "信念", label: "自分たちの信念" },
};

/** §3 監査用タグ。排他分類ではなく、1事象へ複数付与できる。 */
export const BZM22_AUDIT_TAG_LABELS: Record<string, string> = {
  financial: "資金",
  "human-attention": "人の注意",
  "organization-governance": "組織・統治",
  "technical-information": "技術情報",
  "physical-operations": "物理・operations",
  "legal-regulatory": "法務・規制",
  relational: "関係",
  legitimacy: "正当性",
};

/** §10 証拠段階。missing を 0 に読み替えない。 */
export const BZM22_EVIDENCE_STAGE_LABELS: Record<string, { label: string; className: string }> = {
  observed: { label: "観測", className: "border-cyan-200 bg-cyan-50 text-cyan-900" },
  calculated: { label: "計算結果", className: "border-emerald-200 bg-emerald-50 text-emerald-800" },
  estimated: { label: "推定", className: "border-amber-200 bg-amber-50 text-amber-900" },
  conditional: { label: "条件付き", className: "border-violet-200 bg-violet-50 text-violet-900" },
  missing: { label: "未取得", className: "border-slate-300 bg-slate-100 text-slate-600" },
  not_applicable: { label: "対象外", className: "border-slate-200 bg-slate-100 text-slate-500" },
};

/** §5 制約の証拠状態。 */
export const BZM22_CONSTRAINT_STATE_LABELS: Record<string, string> = {
  unknown: "不明",
  violated: "違反",
  met: "充足",
};

export const BZM22_CONSTRAINT_TYPE_LABELS: Record<string, string> = {
  quantity: "数量",
  time: "時間",
  authority: "権限",
  contract: "契約",
  relation: "関係",
  shared_resource: "共有資源",
};

export type Bzm22EvidenceRef = {
  source: string;
  sourceRef: string;
  importantEvidenceId: string | null;
  note: string;
};

export type Bzm22StateEffect = {
  layer: Bzm22StateLayer;
  effect: string;
  note: string;
};

export type Bzm22ClosedConstraint = {
  constraintKey: string;
  constraintType: string;
  actionKey: string;
  before: string;
  after: string;
  note: string;
};

export type Bzm22Consumed = {
  resourceKind: string;
  /** 未計測は null。null を 0 と読み替えない。 */
  amount: number | null;
  unit: string;
  irreversible: boolean;
  note: string;
};

export type Bzm22ActionDelta = {
  actionKey: string;
  direction: "opened" | "lost";
  note: string;
};

export type Bzm22Acquisition = {
  acquisitionId: string;
  projectId: string;
  canonicalEventKey: string;
  occurredOn: string;
  title: string;
  summary: string;
  auditTags: string[];
  evidenceStage: string;
  evidenceRefs: Bzm22EvidenceRef[];
  stateEffects: Bzm22StateEffect[];
  closedConstraints: Bzm22ClosedConstraint[];
  consumed: Bzm22Consumed[];
  actionDelta: Bzm22ActionDelta[];
  numericBinding: "display_only" | "bound";
  boundTarget: string;
  informationCutoff: string | null;
  modelVersion: string;
  sourceOrigin: string;
  status: string;
};

export type Bzm22AcquisitionApiPayload = {
  projectId: string;
  /** 第1段では常に true (どの計算にも入っていない)。 */
  displayOnly: boolean;
  acquisitions: Bzm22Acquisition[];
};

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asFiniteOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** DB row (snake_case / jsonb) を UI 型へ正規化する。壊れた要素は捨てず、空文字で残す。 */
export function normalizeBzm22AcquisitionRow(row: Record<string, unknown>): Bzm22Acquisition {
  return {
    acquisitionId: asText(row.acquisition_id),
    projectId: asText(row.project_id),
    canonicalEventKey: asText(row.canonical_event_key),
    occurredOn: asText(row.occurred_on),
    title: asText(row.title),
    summary: asText(row.summary),
    auditTags: asArray(row.audit_tags).map(asText).filter(Boolean),
    evidenceStage: asText(row.evidence_stage) || "missing",
    evidenceRefs: asArray(row.evidence_refs).map((item) => {
      const value = (item ?? {}) as Record<string, unknown>;
      return {
        source: asText(value.source),
        sourceRef: asText(value.source_ref),
        importantEvidenceId: asText(value.important_evidence_id) || null,
        note: asText(value.note),
      };
    }),
    stateEffects: asArray(row.state_effects).flatMap((item) => {
      const value = (item ?? {}) as Record<string, unknown>;
      const layer = asText(value.layer) as Bzm22StateLayer;
      if (!BZM22_STATE_LAYERS.includes(layer)) return [];
      return [{ layer, effect: asText(value.effect), note: asText(value.note) }];
    }),
    closedConstraints: asArray(row.closed_constraints).map((item) => {
      const value = (item ?? {}) as Record<string, unknown>;
      return {
        constraintKey: asText(value.constraint_key),
        constraintType: asText(value.constraint_type),
        actionKey: asText(value.action_key),
        before: asText(value.before) || "unknown",
        after: asText(value.after) || "unknown",
        note: asText(value.note),
      };
    }),
    consumed: asArray(row.consumed).map((item) => {
      const value = (item ?? {}) as Record<string, unknown>;
      return {
        resourceKind: asText(value.resource_kind),
        amount: asFiniteOrNull(value.amount),
        unit: asText(value.unit),
        irreversible: value.irreversible === true,
        note: asText(value.note),
      };
    }),
    actionDelta: asArray(row.action_delta).flatMap((item) => {
      const value = (item ?? {}) as Record<string, unknown>;
      const direction = asText(value.direction);
      if (direction !== "opened" && direction !== "lost") return [];
      return [{ actionKey: asText(value.action_key), direction, note: asText(value.note) }];
    }),
    numericBinding: asText(row.numeric_binding) === "bound" ? "bound" : "display_only",
    boundTarget: asText(row.bound_target),
    informationCutoff: asText(row.information_cutoff) || null,
    modelVersion: asText(row.model_version),
    sourceOrigin: asText(row.source_origin),
    status: asText(row.status) || "active",
  };
}
