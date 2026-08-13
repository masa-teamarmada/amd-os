const INTEGER_FORMATTER = new Intl.NumberFormat("ja-JP", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function formatMillionJpy(value: number) {
  const normalized = Math.abs(value) < 0.5 ? 0 : value;
  const sign = normalized < 0 ? "-" : "";
  return `${sign}¥${INTEGER_FORMATTER.format(Math.abs(normalized))}M`;
}

export type Bzm22Scenario<T> = {
  low: T;
  base: T;
  high: T;
};

export interface Bzm22PilotClaimBoundary {
  status: string;
  calibratedPrediction: boolean;
  causalEffect: boolean;
  allocationUse: string;
  crossProjectRankingUse: string;
  forwardValidationCount: number;
  currentControlStatus: string;
  qGateProductProxyStatus: string;
  qStressProxyStatus: string;
}

export interface Bzm22PilotSourceCoverage {
  allComplete: boolean;
  sources: Array<{
    key: string;
    paginationComplete: boolean;
    fetchedItems: number;
    uniqueItems: number;
  }>;
}

export interface Bzm22PilotParameter {
  index: number;
  id: string;
  section: string;
  key: string;
  value: unknown;
  observedStatus: string;
  imputed: Bzm22Scenario<unknown>;
  unit: string;
  rule: string;
  sourceRefs: string[];
  confidenceDriver: string | null;
  usedInCalculation: boolean;
  precisionLossContribution: string | number | boolean | null;
  cutoff: string | null;
}

export interface Bzm22PilotParameterGroup {
  key: string;
  label: string;
  count: number;
  parameters: Bzm22PilotParameter[];
}

export type Bzm22TimelineLaneKey =
  | "confirmed_decisions"
  | "registered_policy"
  | "future_decisions"
  | "business_events"
  | "external_events";

export type Bzm22TimelineItemKind =
  | "confirmed_decision"
  | "registered_current_control_shadow"
  | "future_decision_point"
  | "planned_or_assumed_event"
  | "confirmed_external_event";

export interface Bzm22TimelineItem {
  id: string;
  kind: Bzm22TimelineItemKind;
  label: string;
  category: "registered_policy" | "technical" | "facility" | "commercial" | "funding_external";
  startDate: string | null;
  endDate: string | null;
  dateRole: string;
  datePrecision: string;
  dateLabel: string;
  status: string;
  precision: string;
  sourceStatus?: string;
  sourceRefCount: number;
  description: string;
  authorityStatus?: string;
  occurrenceRole?: "occurred" | "available" | "recorded" | "conditional" | "imputed" | "unknown";
  commitmentStatus?: string;
  availabilityStatus?: string;
  amountMillionJpy?: number | null;
  probability?: number | null;
}

export interface Bzm22TimelineLane {
  key: Bzm22TimelineLaneKey;
  label: string;
  emptyMessage: string | null;
  items: Bzm22TimelineItem[];
}

export interface Bzm22PilotTimeline {
  axis: {
    startDate: string;
    endDate: string;
    valuationDate: string;
    dateRole: "shared_calendar_axis";
  };
  lanes: Bzm22TimelineLane[];
}

export interface Bzm22PilotProject {
  schemaVersion: "bzm2.2-pilot-ui/v1";
  artifactSha256: string;
  projectId: string;
  projectName: string;
  modelVersion: string;
  valuationDate: string;
  informationCutoff: string;
  claimBoundary: Bzm22PilotClaimBoundary;
  sourceCoverage: Bzm22PilotSourceCoverage;
  summary: {
    registeredCurrentControl: string | null;
    controlRegistrationStatus: string | null;
    qGateProductProxy: Bzm22Scenario<number | null>;
    qStressProxy: Bzm22Scenario<number | null>;
    jValueMillionJpy: Bzm22Scenario<number | null>;
    conditionalSuccessValueMillionJpy: Bzm22Scenario<number | null>;
    conditionalSuccessValueStatus: string;
    firstPathLossMonth: string | number | null;
    actionBoundaryCounts: {
      authorityApproved: number;
      shadow: number;
    };
    precisionStatus: string;
  };
  timeline: Bzm22PilotTimeline;
  groups: Bzm22PilotParameterGroup[];
}

export interface Bzm22PilotApiPayload {
  pilot: Bzm22PilotProject;
}

export type Bzm22PilotSummary = Pick<
  Bzm22PilotProject,
  "projectId" | "projectName" | "modelVersion" | "valuationDate" | "claimBoundary" | "summary"
>;

export interface Bzm22PilotSummaryApiPayload {
  pilot: Bzm22PilotSummary;
}

export const BZM22_FIXED_POLICY = {
  formula: String.raw`a\equiv\pi_{\mathrm{reg}}`,
  label: "a = 登録済み固定方針（shadow・最適化なし）",
} as const;

export const BZM22_TOP_METRICS = {
  J: {
    title: "全分岐込み現在価値",
    formula: String.raw`J(\pi_{\mathrm{reg}})\equiv J(a)=\sum_t d_t s_t(a)CF_t(a)+d_HQ(a)\,TV(a)+\sum_i d_i s_{i^-}(a)(1-p_i(a))RV_i(a)`,
    description: "この方針を続けた場合の、成功・途中失敗・毎月の収支を起こりやすさで重み付けし、今日の金額に直した合計。",
  },
  P: {
    title: "全条件通過時の現在価値",
    formula: String.raw`P(\pi_{\mathrm{reg}})\equiv P(a)=\operatorname E[V_{\mathrm{net}}\mid G,a]=\sum_t d_tCF_t(a)+d_H TV(a)`,
    description: "同じ方針のまま、登録した条件を全部通過した場合の、毎月の収支と将来価値を今日の金額に直した合計。",
  },
  Q: {
    title: "基準到達指数",
    formula: String.raw`Q(a)=\prod_{i\in G}p_i(a)`,
    description: "通常の想定で、登録した条件を最後まで通り切れる強さをまとめた指数。",
  },
  S: {
    title: "逆風耐久指数",
    formula: String.raw`S(a)=\min_{\delta\in\Delta_{reg}}\prod_{i\in G}(p_i(a)m_{i\delta}(a))`,
    description: "厳しい想定ごとに同じ計算をし、その中で最も低かった指数。",
  },
} as const;
