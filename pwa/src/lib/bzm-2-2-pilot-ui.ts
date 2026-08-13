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

export const BZM22_TOP_METRICS = {
  J: {
    title: "動的正味PJ価値",
    formula: String.raw`J=\sum_t d_t s_t CF_t+d_HQ\,TV+\sum_i d_i s_{i^-}(1-p_i)RV_i`,
    description: "今の方針から生じる途中収支、成功時価値、失敗時残存価値をまとめた正味価値。",
  },
  P: {
    title: "成功時価値",
    formula: String.raw`P=\sum_t d_t CF_t+d_H TV`,
    description: "登録した条件をすべて通過した場合に、このPJから生じる途中収支と将来価値。",
  },
  Q: {
    title: "基準到達指数",
    formula: String.raw`Q=\prod_{i\in G}p_i`,
    description: "通常の想定で、目標までに登録した条件を順に通り切る強さをまとめた指数。",
  },
  S: {
    title: "逆風耐久指数",
    formula: String.raw`S=\min_{\delta\in\Delta_{reg}}\prod_{i\in G}(p_i m_{i\delta})`,
    description: "登録した逆風の中で最も厳しい状況でも、目標までの経路を保てる強さ。",
  },
} as const;
