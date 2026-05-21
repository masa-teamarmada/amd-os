export type RawDataSource = {
  id: string;
  label: string;
  owner: string;
  refresh: string;
  landsIn: string[];
  notes: string;
};

export type L2Dataset = {
  id: string;
  label: string;
  table: string;
  source: string;
  cadence: string;
  purpose: string;
};

export type CronOperation = {
  id: string;
  label: string;
  layer: "GAS" | "PWA" | "Codex";
  cadence: string;
  trigger: string;
  defaultParams: string;
  input: string;
  output: string;
  run:
    | { type: "gas"; functionName: string; defaultArgs: unknown[] }
    | { type: "pwa"; path: string; defaultQuery?: Record<string, string | number | boolean> }
    | { type: "manual"; reason: string };
};

export const rawDataSources: RawDataSource[] = [
  {
    id: "calendar",
    label: "Google Calendar",
    owner: "GAS",
    refresh: "毎時0分",
    landsIn: ["project_meeting_summaries", "meeting_notifications"],
    notes: "会議eventを主軸に、終了60-180分後のPJ関連MTGを拾う。",
  },
  {
    id: "notion-minutes",
    label: "Notion AI 議事録",
    owner: "GAS",
    refresh: "Calendar polling時 / 03:00 fallback",
    landsIn: ["project_meeting_summaries"],
    notes: "eventId / 日付 / PJ relation が空でも、title+date fallbackで拾ってself-healする。",
  },
  {
    id: "gmail",
    label: "Gmail / CircleBack / Meet",
    owner: "GAS + PWA",
    refresh: "MTG抽出時 / source collect時",
    landsIn: ["project_meeting_summaries", "source_cache", "member_activities"],
    notes: "reportEmails と会議日付周辺で議事録メール・録画通知・関係先往復を拾う。",
  },
  {
    id: "slack",
    label: "Slack",
    owner: "GAS/PWA connectors",
    refresh: "backfill / L2 source collect",
    landsIn: ["project_meeting_summaries", "member_activities", "source_cache"],
    notes: "PJ channel / thread から進捗・論点・メンバー活動を抽出する。",
  },
  {
    id: "drive",
    label: "Google Drive",
    owner: "GAS/PWA",
    refresh: "monthly / backfill / source collect",
    landsIn: ["project_meeting_summaries", "monthly_reports", "source_cache"],
    notes: "議事録doc、月次資料、PJ関連ファイルを情報源にする。",
  },
  {
    id: "web-external",
    label: "Web / 外部シグナル",
    owner: "PWA + Codex automation",
    refresh: "daily / weekly / monthly",
    landsIn: ["atlas_stories", "atlas_signals", "macro_index_log", "vc_news"],
    notes: "Atlas、政策、VC、Macrotrend系の外部観測。L2とは別系統。",
  },
];

export const l2Datasets: L2Dataset[] = [
  {
    id: "monthly_reports",
    label: "① monthly report",
    table: "monthly_reports",
    source: "AMD-Report GAS R313",
    cadence: "05:00 daily",
    purpose: "PJ月次レポート本文。後続L2の二次集約ソース。",
  },
  {
    id: "protocols",
    label: "② AMDプロトコル",
    table: "protocols / protocol_examples",
    source: "GAS 155 nav_protocol_pollAll",
    cadence: "毎時",
    purpose: "経営判断を、分岐点・判断材料・アクション・結果学習に構造化する。",
  },
  {
    id: "ms_progress",
    label: "③ MS進捗",
    table: "milestone_monthly_progress",
    source: "GAS 154 → PWA hourly-estimate",
    cadence: "毎時0分",
    purpose: "5生データとMS設計から月次進捗%を推定する。",
  },
  {
    id: "project_knowledge",
    label: "④ PJナレッジ",
    table: "project_knowledge",
    source: "GAS 155 nav_project_knowledge_pollAll",
    cadence: "毎時",
    purpose: "PJの人物・組織・事実・進行中事項を更新する。",
  },
  {
    id: "member_knowledge",
    label: "⑤ メンバーナレッジ",
    table: "member_knowledge",
    source: "GAS 155 nav_member_knowledge_pollAll",
    cadence: "毎時",
    purpose: "メンバーごとの強み・スキル・関心・最近の活動を抽出する。",
  },
  {
    id: "meeting_summaries",
    label: "⑥ MTGサマリ",
    table: "project_meeting_summaries",
    source: "GAS 153 + 074",
    cadence: "毎時0分 + 03:00 fallback",
    purpose: "calendar event単位で決定・進捗・next action・riskを残す。",
  },
  {
    id: "registry_diffs",
    label: "⑦ OS台帳差分",
    table: "project_registry_diffs",
    source: "Codex automation / future cron",
    cadence: "review batch",
    purpose: "5生データとOS台帳を突合し、反映候補を通知で採否する。",
  },
  {
    id: "xrl_evidence",
    label: "⑧ XRL根拠",
    table: "project_xrl_evidence / project_xrl_log",
    source: "PWA cron + Codex automation",
    cadence: "daily / weekly / monthly",
    purpose: "AMD ScoreのXRL/FRL/Triple Helix根拠を構造化する。",
  },
  {
    id: "amd_score_inputs",
    label: "⑨ AMD Score Inputs",
    table: "amd_score_inputs",
    source: "PWA amd-score-l2-refresh + manual evidence",
    cadence: "weekly / manual",
    purpose: "PJごとのM/X/F入力値と根拠。HUD/PJ signal boardのスコア正本。",
  },
];

export const cronOperations: CronOperation[] = [
  {
    id: "meeting-hourly",
    label: "MTGサマリ hourly polling",
    layer: "GAS",
    cadence: "毎時0分",
    trigger: "nav_meeting_pollRecentlyEndedEvents",
    defaultParams: "{\"args\":[{\"windowStartMinutesAgo\":180,\"windowEndMinutesAgo\":60}]}",
    input: "Google Calendar + Notion AI議事録 + Gmail",
    output: "project_meeting_summaries / meeting_notifications",
    run: { type: "gas", functionName: "nav_meeting_pollRecentlyEndedEvents", defaultArgs: [{ windowStartMinutesAgo: 180, windowEndMinutesAgo: 60 }] },
  },
  {
    id: "monthly-fallback",
    label: "MTGサマリ daily fallback",
    layer: "GAS",
    cadence: "03:00 daily",
    trigger: "nav_cronMonthlyExtractAt3",
    defaultParams: "{\"args\":[]}",
    input: "当月Notion/Gmail月次抽出",
    output: "project_meeting_summaries",
    run: { type: "gas", functionName: "nav_cronMonthlyExtractAt3", defaultArgs: [] },
  },
  {
    id: "ms-hourly",
    label: "MS進捗 hourly estimate",
    layer: "PWA",
    cadence: "毎時0分",
    trigger: "/api/cron/hourly-estimate",
    defaultParams: "{\"query\":{\"force\":1,\"maxItems\":14}}",
    input: "monthly_reports + meeting_summaries + MS設計",
    output: "milestone_monthly_progress / progress_estimate_state",
    run: { type: "pwa", path: "/api/cron/hourly-estimate", defaultQuery: { force: 1, maxItems: 14 } },
  },
  {
    id: "member-knowledge",
    label: "メンバーナレッジ抽出",
    layer: "GAS",
    cadence: "毎時",
    trigger: "nav_member_knowledge_pollAll",
    defaultParams: "{\"args\":[{\"force\":false}]}",
    input: "member_activities + project_meeting_summaries",
    output: "member_knowledge / l2_notifications",
    run: { type: "gas", functionName: "nav_member_knowledge_pollAll", defaultArgs: [{ force: false }] },
  },
  {
    id: "project-knowledge",
    label: "PJナレッジ抽出",
    layer: "GAS",
    cadence: "毎時",
    trigger: "nav_project_knowledge_pollAll",
    defaultParams: "{\"args\":[{\"force\":false}]}",
    input: "monthly_reports + project_meeting_summaries",
    output: "project_knowledge / l2_notifications",
    run: { type: "gas", functionName: "nav_project_knowledge_pollAll", defaultArgs: [{ force: false }] },
  },
  {
    id: "protocols",
    label: "AMDプロトコル抽出",
    layer: "GAS",
    cadence: "毎時",
    trigger: "nav_protocol_pollAll",
    defaultParams: "{\"args\":[{\"force\":false}]}",
    input: "project_meeting_summaries.decided / risks / next_actions",
    output: "protocols / protocol_examples / l2_notifications",
    run: { type: "gas", functionName: "nav_protocol_pollAll", defaultArgs: [{ force: false }] },
  },
  {
    id: "amd-score-l2",
    label: "AMD Score L2 refresh",
    layer: "PWA",
    cadence: "月曜03:00",
    trigger: "/api/cron/amd-score-l2-refresh",
    defaultParams: "{\"query\":{}}",
    input: "Slack / Drive / Notion / Gmail / Calendar / Web",
    output: "amd_score_inputs",
    run: { type: "pwa", path: "/api/cron/amd-score-l2-refresh", defaultQuery: {} },
  },
  {
    id: "frl-grit-resilience",
    label: "FRL grit/resilience",
    layer: "PWA",
    cadence: "月初03:00",
    trigger: "/api/cron/frl-grit-resilience-extract",
    defaultParams: "{\"query\":{\"projectId\":\"p07\"}}",
    input: "直近3ヶ月 monthly_reports + meeting_summaries",
    output: "amd_score_inputs.frl_grit / frl_resilience",
    run: { type: "pwa", path: "/api/cron/frl-grit-resilience-extract", defaultQuery: { projectId: "p07" } },
  },
  {
    id: "xrl-refresh",
    label: "Venture XRL refresh",
    layer: "PWA",
    cadence: "03:15 daily",
    trigger: "/api/cron/venture-xrl-refresh",
    defaultParams: "{\"query\":{}}",
    input: "project_events + venture_members + project_ventures",
    output: "project_xrl_log source=llm_proposal",
    run: { type: "pwa", path: "/api/cron/venture-xrl-refresh", defaultQuery: {} },
  },
  {
    id: "atlas-daily",
    label: "Atlas daily",
    layer: "PWA",
    cadence: "06:00 daily",
    trigger: "/api/cron/atlas-daily",
    defaultParams: "{\"query\":{}}",
    input: "atlas_signals / external sources",
    output: "atlas_stories",
    run: { type: "pwa", path: "/api/cron/atlas-daily", defaultQuery: {} },
  },
  {
    id: "management-score-raw",
    label: "Management Score raw data",
    layer: "PWA",
    cadence: "monthly / manual",
    trigger: "/api/cron/management-score-raw-data",
    defaultParams: "{\"query\":{\"includeFreee\":0}}",
    input: "member_activities + billing + PJ継続 + pipeline + freee(optional)",
    output: "amd_management_score_raw_signals / company_actual_monthly",
    run: { type: "pwa", path: "/api/cron/management-score-raw-data", defaultQuery: { includeFreee: 0 } },
  },
  {
    id: "management-score-calc",
    label: "Management Score calculate",
    layer: "PWA",
    cadence: "monthly / after raw",
    trigger: "/api/cron/management-score-calculate",
    defaultParams: "{\"query\":{}}",
    input: "amd_management_score_raw_signals",
    output: "amd_management_score_snapshots / evidence",
    run: { type: "pwa", path: "/api/cron/management-score-calculate", defaultQuery: {} },
  },
];

export function findCronOperation(id: string) {
  return cronOperations.find((op) => op.id === id) ?? null;
}
