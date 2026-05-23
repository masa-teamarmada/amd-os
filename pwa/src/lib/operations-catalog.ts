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
    source: "Codex automation / legacy AMD-Report GAS R313",
    cadence: "停止中",
    purpose: "PJ月次レポート本文。後続L2の二次集約ソース。",
  },
  {
    id: "protocols",
    label: "② AMDプロトコル",
    table: "protocols / protocol_examples",
    source: "Codex automation / legacy GAS 155",
    cadence: "停止中",
    purpose: "経営判断を、分岐点・判断材料・アクション・結果学習に構造化する。",
  },
  {
    id: "ms_progress",
    label: "③ MS進捗",
    table: "milestone_monthly_progress",
    source: "Codex automation / manual sync (GAS 154 stopped)",
    cadence: "停止中",
    purpose: "5生データとMS設計から月次進捗%を推定する。",
  },
  {
    id: "project_knowledge",
    label: "④ PJナレッジ",
    table: "project_knowledge",
    source: "Codex automation / legacy GAS 155",
    cadence: "停止中",
    purpose: "PJの人物・組織・事実・進行中事項を更新する。",
  },
  {
    id: "member_knowledge",
    label: "⑤ メンバーナレッジ",
    table: "member_knowledge",
    source: "Codex automation / legacy GAS 155",
    cadence: "停止中",
    purpose: "メンバーごとの強み・スキル・関心・最近の活動を抽出する。",
  },
  {
    id: "meeting_summaries",
    label: "⑥ MTGサマリ",
    table: "project_meeting_summaries",
    source: "Codex automation / legacy GAS 153 + 074",
    cadence: "停止中",
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
    source: "Codex automation / manual review",
    cadence: "停止中",
    purpose: "AMD ScoreのXRL/FRL/Triple Helix根拠を構造化する。",
  },
  {
    id: "amd_score_inputs",
    label: "⑨ AMD Score Inputs",
    table: "amd_score_inputs",
    source: "manual evidence / Codex automation",
    cadence: "停止中",
    purpose: "PJごとのM/X/F入力値と根拠。HUD/PJ signal boardのスコア正本。",
  },
];

const DISABLED_REASON = "停止中。Codex automation / 明示的な手動review batchへ移管済み。Run Nowで直接起動しない。";

function disabledCron({
  id,
  label,
  layer,
  cadence,
  trigger,
  input,
  output,
}: {
  id: string;
  label: string;
  layer: CronOperation["layer"];
  cadence: string;
  trigger: string;
  input: string;
  output: string;
}): CronOperation {
  return {
    id,
    label,
    layer,
    cadence: `停止中 / 旧頻度: ${cadence}`,
    trigger: `disabled: ${trigger}`,
    defaultParams: "{\"disabled\":true}",
    input,
    output,
    run: { type: "manual", reason: DISABLED_REASON },
  };
}

export const cronOperations: CronOperation[] = [
  disabledCron({
    id: "gas-meeting-hourly",
    label: "MTGサマリ hourly polling",
    layer: "GAS",
    cadence: "毎時0分",
    trigger: "nav_meeting_pollRecentlyEndedEvents",
    input: "Google Calendar + Notion AI議事録 + Gmail",
    output: "project_meeting_summaries / meeting_notifications",
  }),
  disabledCron({
    id: "gas-monthly-fallback",
    label: "MTGサマリ daily fallback",
    layer: "GAS",
    cadence: "03:00 daily",
    trigger: "nav_cronMonthlyExtractAt3",
    input: "当月Notion/Gmail月次抽出",
    output: "project_meeting_summaries",
  }),
  disabledCron({
    id: "gas-reward-v2-estimate",
    label: "Reward V2 progress estimate",
    layer: "GAS",
    cadence: "03:30 daily",
    trigger: "cron_progressEstimateDaily_",
    input: "DB_MonthlyReports + DB_ProgressEvents + 差分データ",
    output: "DB_MilestoneProgressPending / DB_MilestoneMonthlyProgress",
  }),
  disabledCron({
    id: "gas-reward-scoring-events",
    label: "進捗イベント差分抽出",
    layer: "GAS",
    cadence: "04:00 daily",
    trigger: "reward_trigger_dailyExtract",
    input: "過去24hで更新された月次報告書",
    output: "progress events / responsibilities draft",
  }),
  disabledCron({
    id: "gas-l2-member-knowledge",
    label: "メンバーナレッジ抽出",
    layer: "GAS",
    cadence: "毎時",
    trigger: "nav_member_knowledge_pollAll",
    input: "member_activities + project_meeting_summaries",
    output: "member_knowledge / l2_notifications",
  }),
  disabledCron({
    id: "gas-l2-project-knowledge",
    label: "PJナレッジ抽出",
    layer: "GAS",
    cadence: "毎時",
    trigger: "nav_project_knowledge_pollAll",
    input: "monthly_reports + project_meeting_summaries",
    output: "project_knowledge / l2_notifications",
  }),
  disabledCron({
    id: "gas-l2-protocols",
    label: "AMDプロトコル抽出",
    layer: "GAS",
    cadence: "毎時",
    trigger: "nav_protocol_pollAll",
    input: "project_meeting_summaries.decided / risks / next_actions",
    output: "protocols / protocol_examples / l2_notifications",
  }),
  disabledCron({
    id: "pwa-hourly-estimate",
    label: "MS進捗 hourly estimate",
    layer: "PWA",
    cadence: "毎時 (GAS 154から)",
    trigger: "/api/cron/hourly-estimate",
    input: "monthly_reports + meeting_summaries + MS設計",
    output: "milestone_monthly_progress / progress_estimate_state / reward_summary_json",
  }),
  disabledCron({
    id: "pwa-lane-suggest",
    label: "ASPI lane suggest",
    layer: "PWA",
    cadence: "週次 (GAS 154から)",
    trigger: "/api/cron/lane-suggest",
    input: "ASPI domains + source hints",
    output: "lane_suggestions",
  }),
  disabledCron({
    id: "pwa-kaken-ingest",
    label: "KAKEN ingest",
    layer: "PWA",
    cadence: "週次 (GAS 154から)",
    trigger: "/api/cron/kaken-ingest",
    input: "KAKEN OpenSearch + fallback LLM",
    output: "observation_log key=I_R",
  }),
  disabledCron({
    id: "pwa-grant-ingest",
    label: "Grant ingest",
    layer: "PWA",
    cadence: "週次 (GAS 154から)",
    trigger: "/api/cron/grant-ingest",
    input: "公募/助成金ソース + LLM抽出",
    output: "observation_log key=B",
  }),
  disabledCron({
    id: "pwa-vc-investment-ingest",
    label: "VC investment ingest",
    layer: "PWA",
    cadence: "週次 (GAS 154から)",
    trigger: "/api/cron/vc-investment-ingest",
    input: "VC投資ニュース + LLM抽出",
    output: "observation_log key=V",
  }),
  disabledCron({
    id: "pwa-atlas-daily",
    label: "Atlas daily report",
    layer: "PWA",
    cadence: "日次 21:00",
    trigger: "/api/cron/atlas-daily",
    input: "atlas_signals / atlas_stories",
    output: "atlas_reports daily",
  }),
  disabledCron({
    id: "pwa-atlas-weekly",
    label: "Atlas weekly report",
    layer: "PWA",
    cadence: "週次 金08:00",
    trigger: "/api/cron/atlas-weekly",
    input: "atlas_signals / atlas_stories",
    output: "atlas_reports weekly",
  }),
  disabledCron({
    id: "pwa-atlas-monthly",
    label: "Atlas monthly report",
    layer: "PWA",
    cadence: "月次 1日22:00",
    trigger: "/api/cron/atlas-monthly",
    input: "atlas_signals / atlas_stories",
    output: "atlas_reports monthly",
  }),
  disabledCron({
    id: "pwa-atlas-collect",
    label: "Atlas collect",
    layer: "PWA",
    cadence: "route only / 旧scheduled",
    trigger: "/api/cron/atlas-collect",
    input: "Anthropic web_search + auto tag",
    output: "atlas_signals / atlas_stories",
  }),
  disabledCron({
    id: "pwa-atlas-collect-policy",
    label: "Atlas policy collect",
    layer: "PWA",
    cadence: "日次 22:00",
    trigger: "/api/cron/atlas-collect-policy",
    input: "政策ソース大量fetch + LLM抽出",
    output: "atlas_signals / atlas_stories",
  }),
  disabledCron({
    id: "pwa-atlas-divergence",
    label: "Atlas divergence",
    layer: "PWA",
    cadence: "週次 日21:00",
    trigger: "/api/cron/atlas-divergence",
    input: "world/Japan atlas signals",
    output: "atlas_divergences",
  }),
  disabledCron({
    id: "pwa-member-activities",
    label: "PJメンバー活動抽出",
    layer: "PWA",
    cadence: "日次 19:00",
    trigger: "/api/cron/member-activities",
    input: "monthly_reports + meeting_summaries + source_cache",
    output: "member_activities",
  }),
  {
    id: "pwa-member-weekly-activities",
    label: "メンバー週次活動抽出",
    layer: "PWA",
    cadence: "日次 18:00 JST",
    trigger: "/api/cron/member-weekly-activities",
    defaultParams: "{\"query\":{\"save\":1}}",
    input: "Gmail + shared member calendars + source_cache",
    output: "member_activities(source=member_weekly)",
    run: { type: "pwa", path: "/api/cron/member-weekly-activities", defaultQuery: { save: 1 } },
  },
  disabledCron({
    id: "pwa-venture-narrative-refresh",
    label: "Venture narrative refresh",
    layer: "PWA",
    cadence: "日次 18:45",
    trigger: "/api/cron/venture-narrative-refresh",
    input: "project_ventures + feedbacks + project facts",
    output: "project_ventures narrative fields / learnings",
  }),
  disabledCron({
    id: "pwa-venture-xrl-refresh",
    label: "Venture XRL refresh",
    layer: "PWA",
    cadence: "日次 18:15",
    trigger: "/api/cron/venture-xrl-refresh",
    input: "project_events + venture_members + project_ventures",
    output: "project_xrl_log source=llm_proposal",
  }),
  disabledCron({
    id: "pwa-relearn-lane-weights",
    label: "ASPI lane weights relearn",
    layer: "PWA",
    cadence: "日次 18:30",
    trigger: "/api/cron/relearn-lane-weights",
    input: "macro outcomes + lane evidence",
    output: "macro_lane_weights",
  }),
  disabledCron({
    id: "pwa-founding-members-extract",
    label: "関連メンバー抽出",
    layer: "PWA",
    cadence: "週次 月18:30",
    trigger: "/api/cron/founding-members-extract",
    input: "project_ventures.master_md_text + AMD member aliases",
    output: "project_founding_members / l2_notifications",
  }),
  disabledCron({
    id: "pwa-seeds-ingest",
    label: "Seeds ingest",
    layer: "PWA",
    cadence: "週次 月00:00",
    trigger: "/api/cron/seeds-ingest",
    input: "研究シーズ/大学ソース + LLM抽出",
    output: "seeds / seed_news",
  }),
  disabledCron({
    id: "pwa-vc-discover",
    label: "VC discover",
    layer: "PWA",
    cadence: "週次 土00:00",
    trigger: "/api/cron/vc-discover",
    input: "国内deeptech VC探索 + web_search",
    output: "vcs / vc_funds / vc_news",
  }),
  {
    id: "pwa-papers-quarterly-ingest",
    label: "Papers quarterly ingest",
    layer: "PWA",
    cadence: "週次 火03:20 JST",
    trigger: "/api/cron/papers-quarterly-ingest",
    defaultParams: "{}",
    input: "研究論文ソース",
    output: "papers_log / seeds",
    run: { type: "pwa", path: "/api/cron/papers-quarterly-ingest" },
  },
  {
    id: "pwa-sync-pj-facts",
    label: "PJ facts sync",
    layer: "PWA",
    cadence: "日次 04:00 JST",
    trigger: "/api/cron/sync-pj-facts",
    defaultParams: "{}",
    input: "project registry / project_ventures",
    output: "project facts tables",
    run: { type: "pwa", path: "/api/cron/sync-pj-facts" },
  },
  {
    id: "pwa-macro-aggregate-indicators",
    label: "Macro aggregate indicators",
    layer: "PWA",
    cadence: "月次 2日04:00 JST",
    trigger: "/api/cron/macro-aggregate-indicators",
    defaultParams: "{\"query\":{\"since\":\"YYYY-MM\"}}",
    input: "observation_log + atlas_signals",
    output: "macro_index_log aggregates",
    run: { type: "pwa", path: "/api/cron/macro-aggregate-indicators" },
  },
  disabledCron({
    id: "pwa-macro-backfill-historical",
    label: "Macro historical backfill",
    layer: "PWA",
    cadence: "週次 日03:00",
    trigger: "/api/cron/macro-backfill-historical",
    input: "historical policy/investment milestones + LLM",
    output: "macro_index_log",
  }),
  disabledCron({
    id: "pwa-frl-grit-resilience",
    label: "FRL grit/resilience",
    layer: "PWA",
    cadence: "月次 1日18:00",
    trigger: "/api/cron/frl-grit-resilience-extract",
    input: "直近3ヶ月 monthly_reports + meeting_summaries",
    output: "amd_score_inputs.frl_grit / frl_resilience",
  }),
  disabledCron({
    id: "pwa-amd-score-l2",
    label: "AMD Score L2 refresh",
    layer: "PWA",
    cadence: "週次 日18:00",
    trigger: "/api/cron/amd-score-l2-refresh",
    input: "L2 evidence + project facts",
    output: "amd_score_inputs",
  }),
  {
    id: "pwa-freee-payment-sync",
    label: "freee入金同期",
    layer: "PWA",
    cadence: "日次 09:10 JST",
    trigger: "/api/cron/freee-payment-sync",
    defaultParams: "{\"query\":{\"ym\":\"YYYYMM\",\"dryRun\":0}}",
    input: "freee会計 income deals + projects.freee_partner_id + billing_cycles",
    output: "billing_cycles.payment_confirmed_at / billing_log",
    run: { type: "pwa", path: "/api/cron/freee-payment-sync", defaultQuery: { dryRun: 0 } },
  },
  {
    id: "pwa-payment-confirm-nudges",
    label: "入金確認nudge",
    layer: "PWA",
    cadence: "日次 09:30 JST",
    trigger: "/api/cron/payment-confirm-nudges",
    defaultParams: "{\"query\":{\"ym\":\"YYYYMM\",\"dryRun\":0}}",
    input: "billing_cycles + projects.payment_due_rule + members.is_admin",
    output: "Slack DM / billing_cycles.payment_confirmed_at",
    run: { type: "pwa", path: "/api/cron/payment-confirm-nudges", defaultQuery: { dryRun: 0 } },
  },
  {
    id: "manual-management-score-raw",
    label: "Management Score raw data",
    layer: "PWA",
    cadence: "manual",
    trigger: "/api/cron/management-score-raw-data",
    defaultParams: "{\"query\":{\"includeFreee\":0}}",
    input: "member_activities + billing + PJ継続 + pipeline + freee(optional)",
    output: "amd_management_score_raw_signals / company_actual_monthly",
    run: { type: "manual", reason: "手動実行はCodex automation側で対象月を明示して行う" },
  },
  {
    id: "manual-management-score-calc",
    label: "Management Score calculate",
    layer: "PWA",
    cadence: "manual / after raw",
    trigger: "/api/cron/management-score-calculate",
    defaultParams: "{\"query\":{}}",
    input: "amd_management_score_raw_signals",
    output: "amd_management_score_snapshots / evidence",
    run: { type: "manual", reason: "手動実行はCodex automation側でraw収集後に行う" },
  },
];

export function findCronOperation(id: string) {
  return cronOperations.find((op) => op.id === id) ?? null;
}
