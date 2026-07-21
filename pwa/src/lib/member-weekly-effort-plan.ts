/**
 * member_activities の evidence_refs (Calendar/meeting_summary の稼働時間) から
 * project_weekly_effort_entries (source_kind='inferred') の upsert/delete plan を
 * 純関数として算出する。DB アクセスは一切しない。
 */

export type EffortWorkCategory = "basic" | "applied" | "development" | "su" | "coordination";
export type EffortManagementTrack =
  | "funding"
  | "technology_development"
  | "organizational_building"
  | "business_development";
export type EffortSourceKind = "manual" | "imported" | "inferred";

export type MemberActivityEvidenceRef = {
  source_kind?: string | null;
  event_id?: string | null;
  evidence_id?: string | null;
  duration_minutes?: number | null;
  all_day?: boolean | null;
  start_at?: string | null;
  title?: string | null;
};

export type MemberActivityRow = {
  member_id: string;
  project_id: string;
  item_date: string;
  title?: string | null;
  content_preview?: string | null;
  raw_metadata?: {
    evidence_refs?: MemberActivityEvidenceRef[] | null;
  } | null;
};

export type ExistingEffortRow = {
  id: string;
  member_id: string;
  project_id: string;
  week_start: string;
  work_category: EffortWorkCategory;
  source_kind: EffortSourceKind;
};

export type EffortEntryUpsert = {
  id: string | null;
  member_id: string;
  project_id: string;
  week_start: string;
  work_category: EffortWorkCategory;
  planned_hours: number;
  actual_hours: number;
  management_track: EffortManagementTrack | null;
  source_kind: "inferred";
  note: string;
};

export type MemberWeeklyEffortPlan = {
  upserts: EffortEntryUpsert[];
  deleteIds: string[];
};

const CALENDAR_EVIDENCE_SOURCE_KINDS = new Set(["calendar", "meeting_summary"]);

const SU_FUNDING_WORDS = ["資金", "投資家", "VC", "BNV", "SMBC"];
const SU_BIZ_WORDS = ["営業", "事業化", "顧客", "PoC", "SX"];
const DEVELOPMENT_WORDS = ["開発", "実装", "試作", "設計", "技術"];
const APPLIED_WORDS = ["応用"];
const BASIC_WORDS = ["基礎", "研究", "実験"];
const ORGANIZATIONAL_WORDS = ["採用", "体制", "組織"];

function matchesAny(text: string, words: string[]): boolean {
  return words.some((w) => text.includes(w));
}

/**
 * カテゴリ分類。具体語優先: 応用 > 開発/実装/試作/設計/技術 > 基礎/研究/実験 > 資金/事業化等SU > coordination。
 * "SX 技術開発" は development、"SX 応用研究" は applied、"🛠 SX" 単独は su になる。
 */
export function classifyWorkCategory(text: string): EffortWorkCategory {
  if (matchesAny(text, APPLIED_WORDS)) return "applied";
  if (matchesAny(text, DEVELOPMENT_WORDS)) return "development";
  if (matchesAny(text, BASIC_WORDS)) return "basic";
  if (matchesAny(text, SU_FUNDING_WORDS) || matchesAny(text, SU_BIZ_WORDS)) return "su";
  return "coordination";
}

/**
 * track 分類。カテゴリとは独立に判定する
 * (coordination category の予定でも「採用面談」等は organizational_building になり得る)。
 * 優先順位: technology_development > funding > organizational_building > business_development > null
 */
export function classifyManagementTrack(text: string): EffortManagementTrack | null {
  if (matchesAny(text, DEVELOPMENT_WORDS)) return "technology_development";
  if (matchesAny(text, SU_FUNDING_WORDS)) return "funding";
  if (matchesAny(text, ORGANIZATIONAL_WORDS)) return "organizational_building";
  if (matchesAny(text, SU_BIZ_WORDS)) return "business_development";
  return null;
}

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/**
 * ISO日時 (UTC/offset付き) または YYYY-MM-DD から、その週の Asia/Tokyo 月曜日 (YYYY-MM-DD) を返す。
 * YYYY-MM-DD のみの入力は既に JST の暦日として扱う (再変換しない)。
 * それ以外の ISO 日時は +9h して JST の壁時計時刻に変換してから曜日を判定する。
 */
export function mondayWeekStartJst(itemDate: string): string {
  let jstDate: Date;
  if (DATE_ONLY_RE.test(itemDate)) {
    const [y, m, d] = itemDate.split("-").map((v) => Number.parseInt(v, 10));
    jstDate = new Date(Date.UTC(y, m - 1, d));
  } else {
    const ms = new Date(itemDate).getTime();
    jstDate = new Date(ms + JST_OFFSET_MS);
  }
  const dow = jstDate.getUTCDay(); // 0=Sun..6=Sat (JST wall-clock day)
  const diffToMonday = dow === 0 ? -6 : 1 - dow;
  jstDate.setUTCDate(jstDate.getUTCDate() + diffToMonday);
  const yy = jstDate.getUTCFullYear();
  const mm = String(jstDate.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(jstDate.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function isCountableEvidence(ref: MemberActivityEvidenceRef): boolean {
  if (!ref.source_kind || !CALENDAR_EVIDENCE_SOURCE_KINDS.has(ref.source_kind)) return false;
  if (ref.all_day === true) return false;
  const minutes = typeof ref.duration_minutes === "number" ? ref.duration_minutes : 0;
  return minutes > 0;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

type AggregateEntry = {
  member_id: string;
  project_id: string;
  week_start: string;
  work_category: EffortWorkCategory;
  totalMinutes: number;
  trackMinutes: Map<EffortManagementTrack, number>;
};

export function computeMemberWeeklyEffortPlan(
  activities: MemberActivityRow[],
  existingEffort: ExistingEffortRow[]
): MemberWeeklyEffortPlan {
  const aggregates = new Map<string, AggregateEntry>();
  const seenEventKeys = new Set<string>();

  for (const activity of activities) {
    const refs = activity.raw_metadata?.evidence_refs ?? [];

    for (const ref of refs) {
      if (!isCountableEvidence(ref)) continue;

      const weekStart = mondayWeekStartJst(ref.start_at || activity.item_date);
      const text = `${activity.title ?? ""} ${activity.content_preview ?? ""} ${ref.title ?? ""}`;
      const category = classifyWorkCategory(text);
      const track = classifyManagementTrack(text);

      const eventKey = ref.event_id || ref.evidence_id;
      if (!eventKey) continue;
      const dedupeKey = `${activity.member_id}|${activity.project_id}|${weekStart}|${eventKey}`;
      if (seenEventKeys.has(dedupeKey)) continue;
      seenEventKeys.add(dedupeKey);

      const minutes = ref.duration_minutes ?? 0;
      const aggKey = `${activity.member_id}|${activity.project_id}|${weekStart}|${category}`;
      let entry = aggregates.get(aggKey);
      if (!entry) {
        entry = {
          member_id: activity.member_id,
          project_id: activity.project_id,
          week_start: weekStart,
          work_category: category,
          totalMinutes: 0,
          trackMinutes: new Map(),
        };
        aggregates.set(aggKey, entry);
      }
      entry.totalMinutes += minutes;
      if (track) {
        entry.trackMinutes.set(track, (entry.trackMinutes.get(track) ?? 0) + minutes);
      }
    }
  }

  const existingByKey = new Map<string, ExistingEffortRow>();
  for (const row of existingEffort) {
    const key = `${row.member_id}|${row.project_id}|${row.week_start}|${row.work_category}`;
    existingByKey.set(key, row);
  }

  const upserts: EffortEntryUpsert[] = [];
  for (const [key, entry] of aggregates) {
    const existing = existingByKey.get(key);
    if (existing && existing.source_kind !== "inferred") continue;

    let bestTrack: EffortManagementTrack | null = null;
    let bestMinutes = -1;
    for (const [track, minutes] of entry.trackMinutes) {
      if (minutes > bestMinutes) {
        bestTrack = track;
        bestMinutes = minutes;
      }
    }

    const actualHours = Math.min(168, round2(entry.totalMinutes / 60));
    upserts.push({
      id: existing?.id ?? null,
      member_id: entry.member_id,
      project_id: entry.project_id,
      week_start: entry.week_start,
      work_category: entry.work_category,
      planned_hours: 0,
      actual_hours: actualHours,
      management_track: bestTrack,
      source_kind: "inferred",
      note: "Calendar実時間から自動集計",
    });
  }

  const deleteIds: string[] = [];
  for (const row of existingEffort) {
    if (row.source_kind !== "inferred") continue;
    const key = `${row.member_id}|${row.project_id}|${row.week_start}|${row.work_category}`;
    if (!aggregates.has(key)) deleteIds.push(row.id);
  }

  return { upserts, deleteIds };
}
