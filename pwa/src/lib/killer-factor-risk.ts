export const KILLER_FACTOR_OPERATING_MODES = ["monitoring", "prevention"] as const;
export type KillerFactorOperatingMode = typeof KILLER_FACTOR_OPERATING_MODES[number];

export const KILLER_FACTOR_STATUSES = [
  "unchecked",
  "clear",
  "watch",
  "warning",
  "occurred",
  "not_started",
  "in_progress",
  "implemented",
  "controlled",
  "breached",
] as const;
export type KillerFactorStatus = typeof KILLER_FACTOR_STATUSES[number];

export const MONITORING_STATUSES = ["unchecked", "clear", "watch", "warning", "occurred"] as const;
export const PREVENTION_STATUSES = ["unchecked", "not_started", "in_progress", "implemented", "controlled", "breached"] as const;

export type KillerFactorRiskInput = {
  operatingMode: KillerFactorOperatingMode;
  status: KillerFactorStatus;
};

export type KillerFactorOverallLevel = "critical" | "attention" | "watch" | "unknown" | "stable";

export type KillerFactorRiskSummary = {
  level: KillerFactorOverallLevel;
  totalCount: number;
  criticalCount: number;
  actionCount: number;
  watchCount: number;
  unknownCount: number;
  safeCount: number;
};

export function isKillerFactorStatus(value: string): value is KillerFactorStatus {
  return (KILLER_FACTOR_STATUSES as readonly string[]).includes(value);
}

export function isKillerFactorOperatingMode(value: string): value is KillerFactorOperatingMode {
  return (KILLER_FACTOR_OPERATING_MODES as readonly string[]).includes(value);
}

export function isKillerFactorStatusAllowed(
  operatingMode: KillerFactorOperatingMode,
  status: KillerFactorStatus,
) {
  const allowed = operatingMode === "monitoring" ? MONITORING_STATUSES : PREVENTION_STATUSES;
  return (allowed as readonly string[]).includes(status);
}

export function summarizeKillerFactorRisk(items: KillerFactorRiskInput[]): KillerFactorRiskSummary {
  let criticalCount = 0;
  let actionCount = 0;
  let watchCount = 0;
  let unknownCount = 0;
  let safeCount = 0;

  for (const item of items) {
    if (item.status === "occurred" || item.status === "breached") {
      criticalCount += 1;
    } else if (item.status === "warning" || item.status === "not_started" || item.status === "in_progress") {
      actionCount += 1;
    } else if (item.status === "watch" || item.status === "implemented") {
      watchCount += 1;
    } else if (item.status === "unchecked") {
      unknownCount += 1;
    } else if (item.status === "clear" || item.status === "controlled") {
      safeCount += 1;
    }
  }

  const level: KillerFactorOverallLevel = criticalCount > 0
    ? "critical"
    : actionCount > 0
      ? "attention"
      : unknownCount > 0 || items.length === 0
        ? "unknown"
        : watchCount > 0
          ? "watch"
          : "stable";

  return {
    level,
    totalCount: items.length,
    criticalCount,
    actionCount,
    watchCount,
    unknownCount,
    safeCount,
  };
}
