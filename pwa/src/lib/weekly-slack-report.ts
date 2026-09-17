export type WeeklySlackReportProject = {
  project_id: string;
  slack_channel_id: string | null;
  slack_channel_not_required: boolean;
};

export type WeeklySlackReportSettingRow = {
  key?: unknown;
  value?: unknown;
};

export function weeklySlackReportSettingKey(projectId: string): string {
  return `weekly_slack_report.${projectId}.enabled`;
}

export function weeklySlackReportEnabled(
  projectId: string,
  rows: readonly WeeklySlackReportSettingRow[],
): boolean {
  return rows.some((row) => row.key === weeklySlackReportSettingKey(projectId) && row.value === "true");
}

/**
 * 外部送信の最終判定。配信を許可していても、宛先チャンネルがなければ送らない。
 * 将来の週次senderも、本文生成とSlack投稿の直前にこの判定を使う。
 */
export function canDeliverWeeklySlackReport(
  project: WeeklySlackReportProject,
  enabled: boolean,
): boolean {
  return enabled
    && Boolean(project.slack_channel_id?.trim())
    && !project.slack_channel_not_required;
}
