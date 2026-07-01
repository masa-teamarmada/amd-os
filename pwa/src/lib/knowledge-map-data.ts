import { createClient } from "@/lib/supabase/server";

export type KnowledgeNodeKind =
  | "root"
  | "domain"
  | "source"
  | "item"
  | "rule"
  | "pack";

export type KnowledgeNodeStatus =
  | "active"
  | "candidate"
  | "confirmed"
  | "review"
  | "gap"
  | "static";

export interface KnowledgeMapNode {
  id: string;
  label: string;
  kind: KnowledgeNodeKind;
  domain: string;
  depth: number;
  color: string;
  summary: string;
  count?: number;
  status?: KnowledgeNodeStatus;
  href?: string;
  sourceLabel?: string;
  evidenceLabel?: string;
  updatedAt?: string | null;
  val: number;
  x?: number;
  y?: number;
}

export interface KnowledgeMapLink {
  source: string;
  target: string;
  label?: string;
}

export interface KnowledgeMapStat {
  label: string;
  value: number;
  tone: "green" | "amber" | "blue" | "violet" | "rose" | "slate";
}

export interface KnowledgeMapData {
  nodes: KnowledgeMapNode[];
  links: KnowledgeMapLink[];
  stats: KnowledgeMapStat[];
  generatedAt: string;
  errors: string[];
}

type CountResult = {
  count: number | null;
  error: { message?: string } | null;
};

type ProtocolRow = {
  protocol_id: string;
  title: string;
  content: string | null;
  status: string | null;
  importance: number | null;
  updated_at: string | null;
};

type ProjectKnowledgeRow = {
  id: string;
  project_id: string;
  category: string;
  entity_name: string;
  fact_text: string | null;
  confidence: string | null;
  status: string | null;
  updated_at: string | null;
};

type MemberKnowledgeRow = {
  id: string;
  code_name: string;
  category: string;
  summary: string | null;
  status: string;
  updated_at: string | null;
};

type MeetingSummaryRow = {
  meeting_id: string;
  project_id: string;
  title: string;
  summary_short: string;
  meeting_date: string;
  updated_at: string | null;
};

type StrategySignalRow = {
  signal_id: string;
  project_id: string;
  title: string;
  summary: string;
  status: string;
  impact_level: string;
  updated_at: string | null;
};

type XrlEvidenceRow = {
  evidence_id: string;
  project_id: string;
  axis: string;
  evidence_kind: string;
  summary: string;
  status: string;
  updated_at: string | null;
};

type MonthlyReportRow = {
  report_id: string;
  project_id: string;
  ym: string;
  status: string | null;
  generated_at: string | null;
  fixed_at: string | null;
};

type TextbookInsightRow = {
  candidate_id: string;
  target_id: string;
  topic: string;
  title: string;
  status: string;
  priority: number;
  updated_at: string | null;
};

const COLORS = {
  root: "#1f2937",
  protocol: "#256c55",
  project: "#2c5f83",
  people: "#8a5a28",
  meeting: "#6d5275",
  signal: "#b4535a",
  readiness: "#4f46e5",
  monthly: "#0f766e",
  textbook: "#7c3aed",
  pack: "#374151",
};

function shortText(value: string | null | undefined, max = 150) {
  const text = (value ?? "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function countOf(result: CountResult, label: string, errors: string[]) {
  if (result.error) {
    errors.push(`${label}: ${result.error.message ?? "read failed"}`);
    return 0;
  }
  return result.count ?? 0;
}

function statusOf(value: string | null | undefined): KnowledgeNodeStatus {
  if (value === "active") return "active";
  if (value === "confirmed" || value === "fixed") return "confirmed";
  if (value === "candidate" || value === "pending") return "candidate";
  if (value === "rejected") return "review";
  return "static";
}

function addNode(nodes: KnowledgeMapNode[], node: KnowledgeMapNode) {
  nodes.push(node);
}

function addLink(links: KnowledgeMapLink[], source: string, target: string, label?: string) {
  links.push({ source, target, label });
}

export async function fetchKnowledgeMapData(): Promise<KnowledgeMapData> {
  const supabase = await createClient();
  const errors: string[] = [];

  const [
    projectsCount,
    protocolsCount,
    activeProtocolsCount,
    projectKnowledgeCount,
    memberKnowledgeCount,
    meetingCount,
    strategySignalCount,
    candidateSignalCount,
    xrlEvidenceCount,
    monthlyReportCount,
    textbookInsightCount,
    protocols,
    projectKnowledge,
    memberKnowledge,
    meetings,
    strategySignals,
    xrlEvidence,
    monthlyReports,
    textbookInsights,
  ] = await Promise.all([
    supabase.from("projects").select("*", { count: "exact", head: true }),
    supabase.from("protocols").select("*", { count: "exact", head: true }),
    supabase.from("protocols").select("*", { count: "exact", head: true }).in("status", ["active", "confirmed"]),
    supabase.from("project_knowledge").select("*", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("member_knowledge").select("*", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("project_meeting_summaries").select("*", { count: "exact", head: true }),
    supabase.from("project_strategy_signals").select("*", { count: "exact", head: true }),
    supabase.from("project_strategy_signals").select("*", { count: "exact", head: true }).eq("status", "candidate"),
    supabase.from("project_xrl_evidence").select("*", { count: "exact", head: true }),
    supabase.from("monthly_reports").select("*", { count: "exact", head: true }),
    supabase.from("textbook_insight_candidates").select("*", { count: "exact", head: true }),
    supabase
      .from("protocols")
      .select("protocol_id,title,content,status,importance,updated_at")
      .order("updated_at", { ascending: false })
      .limit(4),
    supabase
      .from("project_knowledge")
      .select("id,project_id,category,entity_name,fact_text,confidence,status,updated_at")
      .eq("status", "active")
      .order("updated_at", { ascending: false })
      .limit(6),
    supabase
      .from("member_knowledge")
      .select("id,code_name,category,summary,status,updated_at")
      .eq("status", "active")
      .order("updated_at", { ascending: false })
      .limit(5),
    supabase
      .from("project_meeting_summaries")
      .select("meeting_id,project_id,title,summary_short,meeting_date,updated_at")
      .order("meeting_date", { ascending: false })
      .limit(5),
    supabase
      .from("project_strategy_signals")
      .select("signal_id,project_id,title,summary,status,impact_level,updated_at")
      .order("updated_at", { ascending: false })
      .limit(5),
    supabase
      .from("project_xrl_evidence")
      .select("evidence_id,project_id,axis,evidence_kind,summary,status,updated_at")
      .order("updated_at", { ascending: false })
      .limit(5),
    supabase
      .from("monthly_reports")
      .select("report_id,project_id,ym,status,generated_at,fixed_at")
      .order("ym", { ascending: false })
      .limit(5),
    supabase
      .from("textbook_insight_candidates")
      .select("candidate_id,target_id,topic,title,status,priority,updated_at")
      .order("updated_at", { ascending: false })
      .limit(5),
  ]);

  const counts = {
    projects: countOf(projectsCount as CountResult, "projects", errors),
    protocols: countOf(protocolsCount as CountResult, "protocols", errors),
    activeProtocols: countOf(activeProtocolsCount as CountResult, "active protocols", errors),
    projectKnowledge: countOf(projectKnowledgeCount as CountResult, "project_knowledge", errors),
    memberKnowledge: countOf(memberKnowledgeCount as CountResult, "member_knowledge", errors),
    meetings: countOf(meetingCount as CountResult, "project_meeting_summaries", errors),
    strategySignals: countOf(strategySignalCount as CountResult, "project_strategy_signals", errors),
    candidateSignals: countOf(candidateSignalCount as CountResult, "candidate strategy signals", errors),
    xrlEvidence: countOf(xrlEvidenceCount as CountResult, "project_xrl_evidence", errors),
    monthlyReports: countOf(monthlyReportCount as CountResult, "monthly_reports", errors),
    textbookInsights: countOf(textbookInsightCount as CountResult, "textbook_insight_candidates", errors),
  };

  for (const [label, result] of [
    ["recent protocols", protocols],
    ["recent project knowledge", projectKnowledge],
    ["recent member knowledge", memberKnowledge],
    ["recent meetings", meetings],
    ["recent strategy signals", strategySignals],
    ["recent XRL evidence", xrlEvidence],
    ["recent monthly reports", monthlyReports],
    ["recent textbook insights", textbookInsights],
  ] as const) {
    if (result.error) errors.push(`${label}: ${result.error.message}`);
  }

  const nodes: KnowledgeMapNode[] = [];
  const links: KnowledgeMapLink[] = [];

  addNode(nodes, {
    id: "amd-knowledge",
    label: "AMDノウハウ",
    kind: "root",
    domain: "root",
    depth: 0,
    color: COLORS.root,
    summary: "AMD OSにあるL2、manual/spec、BZM教科書化候補を横断して見る入口。",
    count:
      counts.protocols +
      counts.projectKnowledge +
      counts.memberKnowledge +
      counts.meetings +
      counts.strategySignals +
      counts.xrlEvidence +
      counts.monthlyReports +
      counts.textbookInsights,
    status: "active",
    href: "/manual/3-2-data-and-extraction",
    val: 34,
  });

  const domains = [
    {
      id: "domain-protocol",
      label: "判断プロトコル",
      color: COLORS.protocol,
      summary: "分岐点、判断材料、打ち手、結果観測を再利用できる形にしたAMD Protocol。",
      count: counts.protocols,
      href: "/admin/protocols",
    },
    {
      id: "domain-project",
      label: "PJ知識",
      color: COLORS.project,
      summary: "各PJの人物、技術、市場、組織、提案準備に使う構造化知識。",
      count: counts.projectKnowledge,
      href: "/manual/3-2-data-and-extraction",
    },
    {
      id: "domain-people",
      label: "人と実行力",
      color: COLORS.people,
      summary: "メンバーの強み、関心、働き方、配置判断に効く知識。",
      count: counts.memberKnowledge,
      href: "/mypage",
    },
    {
      id: "domain-meeting",
      label: "MTG記憶",
      color: COLORS.meeting,
      summary: "MTGサマリ、決定事項、進捗、次アクションをPJごとの記憶にする層。",
      count: counts.meetings,
      href: "/manual/3-3-notifications-and-tsukuyomi",
    },
    {
      id: "domain-signal",
      label: "経営ハイライト",
      color: COLORS.signal,
      summary: "事業・契約・外部環境の変化を、判断の候補として持つレイヤー。",
      count: counts.strategySignals,
      href: "/notifications",
    },
    {
      id: "domain-readiness",
      label: "Readiness根拠",
      color: COLORS.readiness,
      summary: "XRLやAMD Scoreの理由を、短いsource refsつきで説明する根拠。",
      count: counts.xrlEvidence,
      href: "/venture-map/amd-score",
    },
    {
      id: "domain-monthly",
      label: "月次断面",
      color: COLORS.monthly,
      summary: "月報とMS進捗を通じて、PJの時間断面を積み上げる層。",
      count: counts.monthlyReports,
      href: "/manual/4-8-ms-progress-monthly-report-revision-spec",
    },
    {
      id: "domain-textbook",
      label: "教科書化",
      color: COLORS.textbook,
      summary: "Before Zeroの実務知見をBZM教科書へ昇格させる候補。",
      count: counts.textbookInsights,
      href: "/bzm",
    },
    {
      id: "domain-pack",
      label: "Knowledge Pack",
      color: COLORS.pack,
      summary: "NotebookLMへ渡すコピー候補。OS正本から生成し、raw全文は入れない。",
      count: counts.projects,
      href: "/manual/1-1-intro",
    },
  ];

  for (const domain of domains) {
    addNode(nodes, {
      id: domain.id,
      label: domain.label,
      kind: "domain",
      domain: domain.id,
      depth: 1,
      color: domain.color,
      summary: domain.summary,
      count: domain.count,
      status: "active",
      href: domain.href,
      val: 18 + Math.min(22, Math.sqrt(Math.max(1, domain.count)) * 2.5),
    });
    addLink(links, "amd-knowledge", domain.id);
  }

  const sourceNodes: KnowledgeMapNode[] = [
    {
      id: "source-protocols",
      label: "protocols",
      kind: "source",
      domain: "domain-protocol",
      depth: 2,
      color: COLORS.protocol,
      summary: `${counts.activeProtocols}件が active / confirmed。判断パターンの正本候補。`,
      count: counts.protocols,
      status: "active",
      href: "/admin/protocols",
      sourceLabel: "D-1",
      val: 14,
    },
    {
      id: "source-project-knowledge",
      label: "project_knowledge",
      kind: "source",
      domain: "domain-project",
      depth: 2,
      color: COLORS.project,
      summary: "PJ単位の構造化ファクト。最新ステータスではなく、再利用できる知識の棚。",
      count: counts.projectKnowledge,
      status: "active",
      href: "/manual/3-2-data-and-extraction",
      sourceLabel: "D-3",
      val: 16,
    },
    {
      id: "source-member-knowledge",
      label: "member_knowledge",
      kind: "source",
      domain: "domain-people",
      depth: 2,
      color: COLORS.people,
      summary: "メンバーの強み・関心・活動傾向。配置とレビューの材料。",
      count: counts.memberKnowledge,
      status: "active",
      href: "/mypage",
      sourceLabel: "D-4",
      val: 13,
    },
    {
      id: "source-meetings",
      label: "project_meeting_summaries",
      kind: "source",
      domain: "domain-meeting",
      depth: 2,
      color: COLORS.meeting,
      summary: "MTGの決定・進捗・次アクション・リスクをPJ記憶にする。",
      count: counts.meetings,
      status: "active",
      href: "/manual/3-3-notifications-and-tsukuyomi",
      sourceLabel: "H-1",
      val: 15,
    },
    {
      id: "source-strategy-signals",
      label: "project_strategy_signals",
      kind: "source",
      domain: "domain-signal",
      depth: 2,
      color: COLORS.signal,
      summary: `${counts.candidateSignals}件が確認待ち。まさえいMTGや通知で採否する候補。`,
      count: counts.strategySignals,
      status: counts.candidateSignals > 0 ? "candidate" : "active",
      href: "/notifications",
      sourceLabel: "D-6",
      val: 15,
    },
    {
      id: "source-xrl-evidence",
      label: "project_xrl_evidence",
      kind: "source",
      domain: "domain-readiness",
      depth: 2,
      color: COLORS.readiness,
      summary: "TRL / BRL / HRL / GRL / SRL の説明責任を支える根拠。",
      count: counts.xrlEvidence,
      status: "active",
      href: "/venture-map/amd-score",
      sourceLabel: "M-2",
      val: 13,
    },
    {
      id: "source-monthly-reports",
      label: "monthly_reports",
      kind: "source",
      domain: "domain-monthly",
      depth: 2,
      color: COLORS.monthly,
      summary: "月次の進捗・成果・次月計画を蓄積する時間断面。",
      count: counts.monthlyReports,
      status: "active",
      href: "/manual/4-8-ms-progress-monthly-report-revision-spec",
      sourceLabel: "M-1",
      val: 14,
    },
    {
      id: "source-textbook-insights",
      label: "textbook_insight_candidates",
      kind: "source",
      domain: "domain-textbook",
      depth: 2,
      color: COLORS.textbook,
      summary: "現場の分岐点・失敗回避・再利用質問をBZMへ昇格させる候補。",
      count: counts.textbookInsights,
      status: "candidate",
      href: "/bzm",
      sourceLabel: "D-7",
      val: 13,
    },
    {
      id: "source-pack-policy",
      label: "raw全文は入れない",
      kind: "rule",
      domain: "domain-pack",
      depth: 2,
      color: COLORS.pack,
      summary: "NotebookLMへ渡すコピーも、OS正本の構造化情報・短い根拠・source ref中心にする。",
      count: 0,
      status: "static",
      href: "/manual/1-1-intro",
      sourceLabel: "policy",
      val: 12,
    },
  ];

  for (const node of sourceNodes) {
    addNode(nodes, node);
    addLink(links, node.domain, node.id);
  }

  for (const row of (protocols.data ?? []) as ProtocolRow[]) {
    const id = `protocol:${row.protocol_id}`;
    addNode(nodes, {
      id,
      label: row.title,
      kind: "item",
      domain: "domain-protocol",
      depth: 3,
      color: COLORS.protocol,
      summary: shortText(row.content, 180) || "AMD Protocol item",
      count: row.importance ?? undefined,
      status: statusOf(row.status),
      href: "/admin/protocols",
      sourceLabel: row.protocol_id,
      updatedAt: row.updated_at,
      val: 8 + Math.min(6, row.importance ?? 1),
    });
    addLink(links, "source-protocols", id);
  }

  for (const row of (projectKnowledge.data ?? []) as ProjectKnowledgeRow[]) {
    const id = `project-knowledge:${row.id}`;
    addNode(nodes, {
      id,
      label: `${row.project_id} / ${row.entity_name}`,
      kind: "item",
      domain: "domain-project",
      depth: 3,
      color: COLORS.project,
      summary: shortText(row.fact_text, 180) || row.category,
      status: statusOf(row.status),
      href: `/project/${encodeURIComponent(row.project_id)}/cockpit`,
      sourceLabel: row.category,
      evidenceLabel: row.confidence ?? undefined,
      updatedAt: row.updated_at,
      val: 7,
    });
    addLink(links, "source-project-knowledge", id);
  }

  for (const row of (memberKnowledge.data ?? []) as MemberKnowledgeRow[]) {
    const id = `member-knowledge:${row.id}`;
    addNode(nodes, {
      id,
      label: `${row.code_name} / ${row.category}`,
      kind: "item",
      domain: "domain-people",
      depth: 3,
      color: COLORS.people,
      summary: shortText(row.summary, 180) || "member knowledge",
      status: statusOf(row.status),
      href: "/mypage",
      sourceLabel: row.code_name,
      updatedAt: row.updated_at,
      val: 7,
    });
    addLink(links, "source-member-knowledge", id);
  }

  for (const row of (meetings.data ?? []) as MeetingSummaryRow[]) {
    const id = `meeting:${row.meeting_id}`;
    addNode(nodes, {
      id,
      label: `${row.project_id} / ${row.title}`,
      kind: "item",
      domain: "domain-meeting",
      depth: 3,
      color: COLORS.meeting,
      summary: shortText(row.summary_short, 180) || row.meeting_date,
      status: "active",
      href: `/project/${encodeURIComponent(row.project_id)}/cockpit`,
      sourceLabel: row.meeting_date,
      updatedAt: row.updated_at,
      val: 7,
    });
    addLink(links, "source-meetings", id);
  }

  for (const row of (strategySignals.data ?? []) as StrategySignalRow[]) {
    const id = `signal:${row.signal_id}`;
    addNode(nodes, {
      id,
      label: `${row.project_id} / ${row.title}`,
      kind: "item",
      domain: "domain-signal",
      depth: 3,
      color: COLORS.signal,
      summary: shortText(row.summary, 180),
      status: statusOf(row.status),
      href: "/notifications",
      sourceLabel: row.impact_level,
      updatedAt: row.updated_at,
      val: row.impact_level === "critical" ? 12 : row.impact_level === "high" ? 10 : 7,
    });
    addLink(links, "source-strategy-signals", id);
  }

  for (const row of (xrlEvidence.data ?? []) as XrlEvidenceRow[]) {
    const id = `xrl:${row.evidence_id}`;
    addNode(nodes, {
      id,
      label: `${row.project_id} / ${row.axis}`,
      kind: "item",
      domain: "domain-readiness",
      depth: 3,
      color: COLORS.readiness,
      summary: shortText(row.summary, 180),
      status: statusOf(row.status),
      href: `/project/${encodeURIComponent(row.project_id)}/cockpit`,
      sourceLabel: row.evidence_kind,
      updatedAt: row.updated_at,
      val: 7,
    });
    addLink(links, "source-xrl-evidence", id);
  }

  for (const row of (monthlyReports.data ?? []) as MonthlyReportRow[]) {
    const id = `monthly:${row.report_id}`;
    addNode(nodes, {
      id,
      label: `${row.project_id} / ${row.ym}`,
      kind: "item",
      domain: "domain-monthly",
      depth: 3,
      color: COLORS.monthly,
      summary: `月次レポート ${row.status ?? "pending"}。generated=${row.generated_at ?? "-"} / fixed=${row.fixed_at ?? "-"}`,
      status: statusOf(row.status),
      href: `/project/${encodeURIComponent(row.project_id)}/cockpit`,
      sourceLabel: row.ym,
      updatedAt: row.fixed_at ?? row.generated_at,
      val: 7,
    });
    addLink(links, "source-monthly-reports", id);
  }

  for (const row of (textbookInsights.data ?? []) as TextbookInsightRow[]) {
    const id = `textbook:${row.candidate_id}`;
    addNode(nodes, {
      id,
      label: row.title,
      kind: "item",
      domain: "domain-textbook",
      depth: 3,
      color: COLORS.textbook,
      summary: `${row.topic} / target=${row.target_id} / priority=${row.priority}`,
      status: statusOf(row.status),
      href: "/bzm",
      sourceLabel: row.topic,
      updatedAt: row.updated_at,
      val: 7 + Math.max(0, 4 - row.priority),
    });
    addLink(links, "source-textbook-insights", id);
  }

  addNode(nodes, {
    id: "pack-notebooklm",
    label: "NotebookLMコピー",
    kind: "pack",
    domain: "domain-pack",
    depth: 3,
    color: COLORS.pack,
    summary: "同じKnowledge PackをNotebookLMにも入れ、人間が引用つきで探索する副導線にする。",
    count: nodes.length,
    status: "gap",
    href: "/manual/1-1-intro",
    sourceLabel: "next",
    val: 10,
  });
  addLink(links, "source-pack-policy", "pack-notebooklm");

  return {
    nodes,
    links,
    generatedAt: new Date().toISOString(),
    errors,
    stats: [
      { label: "L2ノード", value: nodes.filter((n) => n.kind === "item").length, tone: "green" },
      { label: "PJ", value: counts.projects, tone: "blue" },
      { label: "PJ知識", value: counts.projectKnowledge, tone: "violet" },
      { label: "確認待ち", value: counts.candidateSignals, tone: "amber" },
    ],
  };
}
