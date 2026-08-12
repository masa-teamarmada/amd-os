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
