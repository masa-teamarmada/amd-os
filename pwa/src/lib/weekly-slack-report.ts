export type WeeklySlackReportProject = {
  project_id: string;
  slack_channel_id: string | null;
  slack_channel_not_required: boolean;
};

export type WeeklySlackReportSettingRow = {
  key?: unknown;
  value?: unknown;
};

export type WeeklySlackReportSlackEvidence = {
  item_date?: string | null;
  collected_at?: string | null;
  content_text?: string | null;
  metadata_json?: unknown;
};

export type WeeklySlackReportDeliveryObservation = {
  state: "delivering" | "not_detected" | "unknown";
  latestReportAt: string | null;
  latestSlackAt: string | null;
};

export type WeeklySlackReportDeliveryDecision = {
  allowed: boolean;
  reason: "weekly_report_disabled" | "weekly_report_channel_not_required" | "weekly_report_channel_missing" | "weekly_report_enabled";
};

const WEEKLY_REPORT_OBSERVATION_WINDOW_DAYS = 10;

function parseEvidenceDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function textFromEvidence(evidence: WeeklySlackReportSlackEvidence): string {
  const metadata = evidence.metadata_json && typeof evidence.metadata_json === "object"
    ? evidence.metadata_json as Record<string, unknown>
    : {};
  return [
    evidence.content_text,
    typeof metadata.text_full === "string" ? metadata.text_full : "",
    typeof metadata.text_preview === "string" ? metadata.text_preview : "",
  ].join("\n");
}

/**
 * PJ名やチャンネル名に依存せず、Slack本文に週次レポートとして明示された投稿だけを証跡にする。
 * ここで扱うのは「実投稿を観測できたか」であり、配信設定や送信元の接続状態ではない。
 */
export function isWeeklySlackReportEvidence(evidence: WeeklySlackReportSlackEvidence): boolean {
  const text = textFromEvidence(evidence);
  return /(?:週次|今週).{0,24}(?:レポート|報告)|(?:レポート|報告).{0,24}(?:週次|今週)/u.test(text);
}

/**
 * 週次投稿は通常7日間隔なので、直近10日以内に証跡があれば「配信中」と表示する。
 * それより古い・証跡がない場合は、停止と断定せず検出状況だけを返す。
 */
export function observeWeeklySlackReportDelivery(
  evidenceRows: readonly WeeklySlackReportSlackEvidence[],
  now = new Date(),
): WeeklySlackReportDeliveryObservation {
  const latestSlackDate = evidenceRows
    .map((row) => parseEvidenceDate(row.item_date))
    .filter((date): date is Date => date !== null)
    .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
  const latestReportDate = evidenceRows
    .filter(isWeeklySlackReportEvidence)
    .map((row) => parseEvidenceDate(row.item_date))
    .filter((date): date is Date => date !== null)
    .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
  const cutoff = new Date(now.getTime() - WEEKLY_REPORT_OBSERVATION_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  return {
    state: latestReportDate && latestReportDate >= cutoff
      ? "delivering"
      : latestSlackDate
        ? "not_detected"
        : "unknown",
    latestReportAt: latestReportDate?.toISOString() ?? null,
    latestSlackAt: latestSlackDate?.toISOString() ?? null,
  };
}

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
  return weeklySlackReportDeliveryDecision(project, enabled).allowed;
}

/**
 * 週次レポートを生成・送信してよいかの唯一の判定。
 * 対象取得時とSlack投稿の直前に同じ関数を使い、設定変更との競合を防ぐ。
 */
export function weeklySlackReportDeliveryDecision(
  project: WeeklySlackReportProject,
  enabled: boolean,
): WeeklySlackReportDeliveryDecision {
  if (!enabled) return { allowed: false, reason: "weekly_report_disabled" };
  if (project.slack_channel_not_required) {
    return { allowed: false, reason: "weekly_report_channel_not_required" };
  }
  if (!project.slack_channel_id?.trim()) {
    return { allowed: false, reason: "weekly_report_channel_missing" };
  }
  return { allowed: true, reason: "weekly_report_enabled" };
}
