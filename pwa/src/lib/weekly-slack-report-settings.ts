export const WEEKLY_SLACK_REPORT_PROJECTS = [
  {
    id: "ctb",
    label: "CTB",
    projectId: "p06",
    settingKey: "weekly_slack_report.ctb.enabled",
  },
  {
    id: "se",
    label: "SE",
    projectId: "p10",
    settingKey: "weekly_slack_report.se.enabled",
  },
] as const;

export type WeeklySlackReportProjectId = (typeof WEEKLY_SLACK_REPORT_PROJECTS)[number]["id"];

export type WeeklySlackReportSettingRow = {
  key?: unknown;
  value?: unknown;
  updated_at?: unknown;
  updated_by?: unknown;
};

export type WeeklySlackReportStatus = {
  id: WeeklySlackReportProjectId;
  label: string;
  projectId: string;
  enabled: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
};

export function isWeeklySlackReportProjectId(value: unknown): value is WeeklySlackReportProjectId {
  return WEEKLY_SLACK_REPORT_PROJECTS.some((project) => project.id === value);
}

export function weeklySlackReportSettingKey(projectId: WeeklySlackReportProjectId): string {
  return WEEKLY_SLACK_REPORT_PROJECTS.find((project) => project.id === projectId)!.settingKey;
}

/**
 * 外部送信の既定は停止。設定行がない、または壊れているときに送信を許可しない。
 */
export function weeklySlackReportStatuses(rows: readonly WeeklySlackReportSettingRow[]): WeeklySlackReportStatus[] {
  const rowsByKey = new Map(
    rows
      .filter((row) => typeof row.key === "string")
      .map((row) => [row.key as string, row]),
  );

  return WEEKLY_SLACK_REPORT_PROJECTS.map((project) => {
    const row = rowsByKey.get(project.settingKey);
    return {
      id: project.id,
      label: project.label,
      projectId: project.projectId,
      enabled: row?.value === "true",
      updatedAt: typeof row?.updated_at === "string" ? row.updated_at : null,
      updatedBy: typeof row?.updated_by === "string" ? row.updated_by : null,
    };
  });
}
