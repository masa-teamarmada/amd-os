import type { SxManagementBundle, SxTrackKey } from "./sx-management";

export type SxCockpitDueState =
  | "overdue"
  | "due_soon"
  | "upcoming"
  | "unset";

export type SxCockpitIntervention = {
  id: string;
  rank: number;
  track: SxTrackKey;
  trackLabel: string;
  title: string;
  context: string | null;
  ownerLabel: string;
  dueDate: string | null;
  dueState: SxCockpitDueState;
  dueLabel: string;
  isThisWeek: boolean;
  workspaceHref: string;
};

export type SxCockpitInterventionSummary = {
  asOf: string;
  items: SxCockpitIntervention[];
  unlinkedDecisionCount: number;
};

const TRACK_LABELS: Record<SxTrackKey, string> = {
  business_development: "事業",
  technology_development: "技術",
  funding: "資金",
  organizational_building: "体制",
};

function addDays(date: string, days: number) {
  const parsed = new Date(`${date.slice(0, 10)}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime())) return date;
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

function shortDate(date: string) {
  const match = date.match(/^\d{4}-(\d{2})-(\d{2})$/);
  if (!match) return date;
  return `${Number(match[1])}/${Number(match[2])}`;
}

function dueState(
  dueDate: string | null,
  asOf: string,
): SxCockpitDueState {
  if (!dueDate) return "unset";
  if (dueDate < asOf) return "overdue";
  if (dueDate <= addDays(asOf, 7)) return "due_soon";
  return "upcoming";
}

function dueLabel(state: SxCockpitDueState, date: string | null) {
  if (!date) return "期限未設定";
  if (state === "overdue") return `期限超過 ${shortDate(date)}`;
  if (state === "due_soon") return `${shortDate(date)}まで`;
  return `${shortDate(date)}まで`;
}

function priority(state: SxCockpitDueState, isThisWeek: boolean) {
  if (isThisWeek) return 0;
  if (state === "overdue") return 1;
  if (state === "due_soon") return 2;
  if (state === "upcoming") return 3;
  return 4;
}

/**
 * SXワークスペースの判断正本を、AMDコックピットの「介入順」へ投影する。
 * 件数や4本柱を再評価せず、人が登録した今週フラグ・期限・並び順だけを使う。
 * 元レコードへ直接降りられない判断は一覧へ混ぜず、unlinkedDecisionCountで明示する。
 */
export function deriveSxCockpitInterventions(
  management: Pick<SxManagementBundle, "asOf" | "decisions">,
  projectId: string,
  limit = 4,
): SxCockpitInterventionSummary {
  const open = management.decisions.filter(
    (decision) => decision.status === "open" && decision.title.trim(),
  );
  const linked = open.filter((decision) => Boolean(decision.issueId));

  const items = linked
    .map((decision) => {
      const state = dueState(decision.dueDate, management.asOf);
      return {
        id: decision.id,
        rank: 0,
        track: decision.track,
        trackLabel: TRACK_LABELS[decision.track],
        title: decision.title.trim(),
        context: decision.context.trim() || null,
        ownerLabel: decision.ownerLabel.trim() || "判断主体未設定",
        dueDate: decision.dueDate,
        dueState: state,
        dueLabel: dueLabel(state, decision.dueDate),
        isThisWeek: decision.isThisWeek,
        workspaceHref: `/project/${encodeURIComponent(projectId)}/workspace?focusKind=decision&focusId=${encodeURIComponent(decision.id)}#issue-hypothesis`,
        sortOrder: decision.sortOrder,
      };
    })
    .sort(
      (left, right) =>
        priority(left.dueState, left.isThisWeek) -
          priority(right.dueState, right.isThisWeek) ||
        (left.dueDate || "9999").localeCompare(right.dueDate || "9999") ||
        left.sortOrder - right.sortOrder ||
        left.title.localeCompare(right.title, "ja"),
    )
    .slice(0, Math.max(0, limit))
    .map((item, index) => ({
      id: item.id,
      rank: index + 1,
      track: item.track,
      trackLabel: item.trackLabel,
      title: item.title,
      context: item.context,
      ownerLabel: item.ownerLabel,
      dueDate: item.dueDate,
      dueState: item.dueState,
      dueLabel: item.dueLabel,
      isThisWeek: item.isThisWeek,
      workspaceHref: item.workspaceHref,
    }));

  return {
    asOf: management.asOf,
    items,
    unlinkedDecisionCount: open.length - linked.length,
  };
}
