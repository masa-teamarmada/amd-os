import { createHash } from "node:crypto";

const DEFAULT_SNIPPET_RADIUS = 95;

const SIGNAL_GROUPS = [
  {
    id: "leadership_commitment",
    label: "CEO/代表・就任合意",
    rawTerms: ["CEO", "CE O", "社長", "代表", "就任", "引き受け", "担う", "やってもらいたい", "なってほしい", "してもらいたい"],
    summaryTerms: ["CEO", "社長", "代表", "就任", "引き受け", "創業体制"],
    minRawHits: 2,
    minSummaryHits: 1,
  },
  {
    id: "vc_fit_break",
    label: "VC前提の破れ",
    rawTerms: ["VC", "V C", "フルコミット", "兼任", "出資", "調達", "投資家", "一人のCEO"],
    summaryTerms: ["VC", "フルコミット", "兼任", "出資", "調達", "資金調達"],
    minRawHits: 2,
    minSummaryHits: 1,
  },
  {
    id: "local_capital_poc",
    label: "地元勢・PoC・共同開発費",
    rawTerms: ["地元", "ダイキ", "大輝", "ダイキアクシス", "三浦", "三浦工業", "伊予銀", "いよぎん", "イオギン", "今治", "今治造船", "太陽石油", "共同開発費", "事業会社"],
    summaryTerms: ["地元", "ダイキ", "大輝", "ダイキアクシス", "三浦", "伊予銀", "いよぎん", "今治", "共同開発", "PoC", "POC"],
    minRawHits: 2,
    minSummaryHits: 1,
  },
  {
    id: "public_poc_push",
    label: "目立つPoC/PR",
    rawTerms: ["PoC", "POC", "導入", "プレス", "リリース", "発表", "派手", "ゴリゴリ", "巻き込む", "味方につける"],
    summaryTerms: ["PoC", "POC", "導入", "プレス", "リリース", "発表", "PR", "巻き込む"],
    minRawHits: 2,
    minSummaryHits: 1,
  },
];

function normalizeText(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .trim();
}

function buildSavedText(meeting) {
  const parts = [
    meeting.summary_short,
    meeting.summaryShort,
    meeting.narrative_md,
    meeting.narrativeMd,
    ...(Array.isArray(meeting.decided) ? meeting.decided : []),
    ...(Array.isArray(meeting.progress) ? meeting.progress : []),
    ...(Array.isArray(meeting.next_actions) ? meeting.next_actions : []),
    ...(Array.isArray(meeting.nextActions) ? meeting.nextActions : []),
    ...(Array.isArray(meeting.risks) ? meeting.risks : []),
  ];
  return normalizeText(parts.filter(Boolean).join("\n"));
}

function countTerms(text, terms) {
  const normalized = normalizeText(text).toLowerCase();
  const hits = [];
  for (const term of terms) {
    const t = normalizeText(term).toLowerCase();
    if (!t) continue;
    let index = normalized.indexOf(t);
    let count = 0;
    while (index !== -1) {
      count += 1;
      index = normalized.indexOf(t, index + t.length);
    }
    if (count > 0) hits.push({ term, count });
  }
  return hits;
}

function snippetsAroundTerms(text, terms, maxSnippets = 4) {
  const normalized = normalizeText(text);
  const lower = normalized.toLowerCase();
  const snippets = [];
  for (const term of terms) {
    const t = normalizeText(term).toLowerCase();
    if (!t) continue;
    const index = lower.indexOf(t);
    if (index === -1) continue;
    const start = Math.max(0, index - DEFAULT_SNIPPET_RADIUS);
    const end = Math.min(normalized.length, index + t.length + DEFAULT_SNIPPET_RADIUS);
    const snippet = normalized.slice(start, end);
    if (!snippets.some((s) => s.includes(snippet) || snippet.includes(s))) snippets.push(snippet);
    if (snippets.length >= maxSnippets) break;
  }
  return snippets;
}

function stableHash(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function inferTitle(meeting, presentGroups, missingGroups) {
  const title = String(meeting.title ?? meeting.meeting_title ?? "会議").slice(0, 90);
  const hasLeadership = presentGroups.some((g) => g.id === "leadership_commitment");
  const hasVc = presentGroups.some((g) => g.id === "vc_fit_break");
  const hasLocal = presentGroups.some((g) => g.id === "local_capital_poc");
  if (hasLeadership && hasVc && hasLocal) {
    return `H-1要約で創業体制/資金調達転換が薄まった可能性: ${title}`;
  }
  if (missingGroups.some((g) => g.id === "leadership_commitment")) {
    return `H-1要約でCEO/代表合意が落ちた可能性: ${title}`;
  }
  return `H-1要約で重要な経営判断が薄まった可能性: ${title}`;
}

function shouldFlag(presentGroups, missingGroups) {
  const ids = new Set(presentGroups.map((g) => g.id));
  const missingIds = new Set(missingGroups.map((g) => g.id));
  if (missingIds.has("leadership_commitment")) return true;
  if (ids.has("leadership_commitment") && ids.has("vc_fit_break") && missingGroups.length > 0) return true;
  if (ids.has("vc_fit_break") && ids.has("local_capital_poc") && missingGroups.length > 0) return true;
  return presentGroups.length >= 3 && missingGroups.length >= 1;
}

export function reviewMeetingSummary(meeting) {
  const rawText = normalizeText(meeting.raw_text ?? meeting.rawText ?? meeting.transcript_text ?? meeting.transcriptText ?? "");
  const savedText = buildSavedText(meeting);
  if (rawText.length < 80 || savedText.length < 20) return [];

  const groups = SIGNAL_GROUPS.map((group) => {
    const rawHits = countTerms(rawText, group.rawTerms);
    const summaryHits = countTerms(savedText, group.summaryTerms);
    return {
      ...group,
      rawHits,
      summaryHits,
      rawPresent: rawHits.length >= group.minRawHits,
      summaryPresent: summaryHits.length >= group.minSummaryHits,
    };
  });
  const presentGroups = groups.filter((g) => g.rawPresent);
  const missingGroups = presentGroups.filter((g) => !g.summaryPresent);
  if (!shouldFlag(presentGroups, missingGroups)) return [];

  const matchedTerms = presentGroups.flatMap((g) => g.rawHits.map((h) => h.term));
  const snippets = snippetsAroundTerms(rawText, matchedTerms);
  const meetingId = String(meeting.meeting_id ?? meeting.meetingId ?? meeting.calendar_event_id ?? "unknown");
  const sourceHash = stableHash({
    kind: "h1_meeting_summary_reviewer",
    meetingId,
    present: presentGroups.map((g) => g.id),
    missing: missingGroups.map((g) => g.id),
    snippets,
  });
  const salienceScore = Math.min(
    0.99,
    0.42 + presentGroups.length * 0.12 + missingGroups.length * 0.1 + (presentGroups.some((g) => g.id === "leadership_commitment") ? 0.12 : 0),
  );

  const missingLabel = missingGroups.length > 0 ? missingGroups.map((g) => g.label).join(" / ") : "重要文脈";
  const presentLabel = presentGroups.map((g) => g.label).join(" / ");

  return [{
    source: "notion",
    source_ref: meeting.notion_page_id ?? meeting.notionPageId ?? meeting.notion_url ?? meeting.notionUrl ?? meetingId,
    source_hash: `h1-review:${sourceHash}`,
    title: inferTitle(meeting, presentGroups, missingGroups),
    summary: `raw transcriptには ${presentLabel} が出ているが、H-1保存結果では ${missingLabel} が薄い/欠落している可能性がある。raw再読込とD-6経営ハイライト候補化を確認する。`,
    salience_score: Number(salienceScore.toFixed(2)),
    matched_patterns: {
      reviewer: "h1_meeting_summary_reviewer",
      present_groups: presentGroups.map((g) => ({ id: g.id, label: g.label, raw_terms: g.rawHits.map((h) => h.term) })),
      missing_groups: missingGroups.map((g) => ({ id: g.id, label: g.label })),
    },
    proposed_target_l2: "strategy_signal",
    gap_class: "extractor_miss",
    project_id: meeting.project_id ?? meeting.projectId ?? null,
    scope: meeting.project_id || meeting.projectId ? "project" : "unknown",
    evidence_refs_json: {
      meeting_id: meetingId,
      meeting_date: meeting.meeting_date ?? meeting.meetingDate ?? null,
      title: meeting.title ?? meeting.meeting_title ?? null,
      notion_url: meeting.notion_url ?? meeting.notionUrl ?? null,
      snippets,
      saved_summary_preview: savedText.slice(0, 260),
    },
  }];
}

export function reviewMeetingSummaries(meetings) {
  return (Array.isArray(meetings) ? meetings : [meetings]).flatMap((meeting) => reviewMeetingSummary(meeting));
}
