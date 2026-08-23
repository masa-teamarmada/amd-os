/**
 * 「AMDがこのPJへ行ってきたこと」の正規化。
 * 正本: pwa/spec/4-7-amd-contributions-current-spec.md
 *
 * 守ること:
 *   - 生データ (member_activities / project_meeting_summaries) から自動で組む。手入力欄を作らない
 *   - 日付順に並べる。件数や impact で並べ替えて「大きい貢献」を上へ出さない
 *   - 件数を貢献度の指標として大きく出さない (数えたものを成果に見せない)
 *   - 拾えた記録は貢献の全量ではない。「記録から拾えた分」と明示し、無記録を「やっていない」に見せない
 *   - source が inferred の行は推定として明示し、観測へ昇格させない
 */

export type AmdContributionKind = "activity" | "meeting";

export type AmdContributionEvidenceStage = "observed" | "inferred";

export type AmdContributionItem = {
  key: string;
  kind: AmdContributionKind;
  occurredOn: string;
  ym: string;
  memberIds: string[];
  memberNames: string[];
  title: string;
  detail: string;
  sourceLabel: string;
  evidenceStage: AmdContributionEvidenceStage;
};

export type AmdContributionMember = {
  memberId: string;
  codeName: string;
  months: string[];
};

export type AmdContributionsPayload = {
  projectId: string;
  firstOn: string | null;
  lastOn: string | null;
  activeMonths: number;
  members: AmdContributionMember[];
  items: AmdContributionItem[];
  recordedCount: number;
  truncated: boolean;
};

/** member_activities.source → 人が読むラベルと証拠段階。 */
const SOURCE_LABELS: Readonly<Record<string, { label: string; stage: AmdContributionEvidenceStage }>> = {
  member_weekly: { label: "週次の活動記録", stage: "observed" },
  calendar: { label: "カレンダー", stage: "observed" },
  gmail: { label: "メール", stage: "observed" },
  slack: { label: "Slack", stage: "observed" },
  notion: { label: "Notion", stage: "observed" },
  drive: { label: "Drive", stage: "observed" },
  inferred: { label: "記録からの推定", stage: "inferred" },
};

function asYmd(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  if (raw.length >= 10 && /^\d{4}-\d{2}-\d{2}$/.test(raw.slice(0, 10))) return raw.slice(0, 10);
  return null;
}

function ymOf(ymd: string): string {
  return `${ymd.slice(0, 4)}${ymd.slice(5, 7)}`;
}

function clip(value: unknown, max: number): string {
  const raw = String(value ?? "").replace(/\s+/g, " ").trim();
  return raw.length > max ? `${raw.slice(0, max)}…` : raw;
}

/** member_activities の1行 → 貢献の1件。日付が採れない行は捨てる (捏造しない)。 */
export function normalizeActivityRow(
  row: Record<string, unknown>,
  codeNameOf: (memberId: string) => string,
): AmdContributionItem | null {
  const occurredOn = asYmd(row.item_date) || asYmd(row.extracted_at);
  if (!occurredOn) return null;

  const memberId = String(row.member_id ?? "").trim();
  const source = String(row.source ?? "").trim();
  const mapped = SOURCE_LABELS[source] ?? { label: source || "出所不明", stage: "inferred" as const };

  return {
    key: `activity:${String(row.id ?? `${memberId}:${occurredOn}`)}`,
    kind: "activity",
    occurredOn,
    ym: String(row.ym ?? "").trim() || ymOf(occurredOn),
    memberIds: memberId ? [memberId] : [],
    memberNames: memberId ? [codeNameOf(memberId)] : [],
    title: clip(row.title, 120) || "（表題なし）",
    detail: clip(row.content_preview, 220),
    sourceLabel: mapped.label,
    evidenceStage: mapped.stage,
  };
}

/**
 * project_meeting_summaries の1行 → 貢献の1件。
 * 予定 (source_kinds='upcoming') は「行ってきたこと」ではないので呼び出し側で除く。
 */
export function normalizeMeetingRow(row: Record<string, unknown>): AmdContributionItem | null {
  const occurredOn = asYmd(row.meeting_date);
  if (!occurredOn) return null;

  const decided = Array.isArray(row.decided) ? row.decided : [];
  const detailSource = clip(row.summary_short, 220)
    || clip(decided.map((entry) => (typeof entry === "string" ? entry : "")).filter(Boolean).join(" / "), 220);

  return {
    key: `meeting:${String(row.meeting_id ?? occurredOn)}`,
    kind: "meeting",
    occurredOn,
    ym: String(row.ym ?? "").trim() || ymOf(occurredOn),
    memberIds: [],
    memberNames: [],
    title: clip(row.title, 120) || "打ち合わせ",
    detail: detailSource,
    sourceLabel: "MTGサマリ",
    evidenceStage: "observed",
  };
}

/** 日付の新しい順。同日は会議を先に置く (その日の意思決定が先に読めるように)。 */
export function sortContributions(items: AmdContributionItem[]): AmdContributionItem[] {
  return [...items].sort((a, b) => {
    if (a.occurredOn !== b.occurredOn) return a.occurredOn < b.occurredOn ? 1 : -1;
    if (a.kind !== b.kind) return a.kind === "meeting" ? -1 : 1;
    return a.key < b.key ? -1 : 1;
  });
}

/** 関与メンバーを、活動が記録された月とともに集める。件数では並べない (登場月の新しい順)。 */
export function collectMembers(items: AmdContributionItem[]): AmdContributionMember[] {
  const byMember = new Map<string, { codeName: string; months: Set<string> }>();
  for (const item of items) {
    item.memberIds.forEach((memberId, index) => {
      const current = byMember.get(memberId) ?? {
        codeName: item.memberNames[index] || memberId,
        months: new Set<string>(),
      };
      current.months.add(item.ym);
      byMember.set(memberId, current);
    });
  }
  return [...byMember.entries()]
    .map(([memberId, value]) => ({
      memberId,
      codeName: value.codeName,
      months: [...value.months].sort(),
    }))
    .sort((a, b) => (a.months[a.months.length - 1] < b.months[b.months.length - 1] ? 1 : -1));
}

export function buildAmdContributionsPayload(input: {
  projectId: string;
  items: AmdContributionItem[];
  truncated: boolean;
}): AmdContributionsPayload {
  const items = sortContributions(input.items);
  const months = new Set(items.map((item) => item.ym));
  return {
    projectId: input.projectId,
    firstOn: items.length > 0 ? items[items.length - 1].occurredOn : null,
    lastOn: items.length > 0 ? items[0].occurredOn : null,
    activeMonths: months.size,
    members: collectMembers(items),
    items,
    recordedCount: items.length,
    truncated: input.truncated,
  };
}
