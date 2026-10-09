const MAX_PROJECTS = 100;
const MAX_WEEKS = 5_000;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export type Week = { weekStart: string; developmentHours: number; meetingHours: number };
export type Project = { projectID: string; displayName: string; meetingSearchTerms: string[]; weeklyEffort: Week[] };
export type Payload = { memberID: string; windowStart: string; windowEnd: string; projects: Project[] };

function text(value: unknown, max: number) {
  if (typeof value !== "string") return null;
  const result = value.trim();
  return result.length > 0 && result.length <= max ? result : null;
}

function day(value: unknown) {
  const result = text(value, 10);
  if (!result || !DAY.test(result) || result.startsWith("0000")) return null;
  const date = new Date(`${result}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === result ? result : null;
}

function hours(value: unknown) {
  const result = typeof value === "number" ? value : Number.NaN;
  return Number.isFinite(result) && result >= 0 && result <= 168 ? Math.round(result * 100) / 100 : null;
}

export function parsePayload(value: unknown): Payload | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const memberID = text(raw.memberID, 80);
  const windowStart = day(raw.windowStart);
  const windowEnd = day(raw.windowEnd);
  if (memberID !== "ID001" || !windowStart || !windowEnd || !DAY.test(windowStart) || !DAY.test(windowEnd) || windowStart > windowEnd || !Array.isArray(raw.projects) || raw.projects.length > MAX_PROJECTS) return null;

  const projectIDs = new Set<string>();
  const projects: Project[] = [];
  let weekCount = 0;
  for (const rawProject of raw.projects) {
    if (!rawProject || typeof rawProject !== "object") return null;
    const project = rawProject as Record<string, unknown>;
    const projectID = text(project.projectID, 80);
    const displayName = text(project.displayName, 160);
    if (!projectID || !displayName || projectIDs.has(projectID) || !Array.isArray(project.meetingSearchTerms) || !Array.isArray(project.weeklyEffort)) return null;
    projectIDs.add(projectID);
    const terms = project.meetingSearchTerms.map((term) => text(term, 100)).filter((term): term is string => Boolean(term));
    if (terms.length !== project.meetingSearchTerms.length || terms.length > 20) return null;
    const weeks = new Set<string>();
    const weeklyEffort: Week[] = [];
    for (const rawWeek of project.weeklyEffort) {
      if (!rawWeek || typeof rawWeek !== "object") return null;
      const week = rawWeek as Record<string, unknown>;
      const weekStart = day(week.weekStart);
      const developmentHours = hours(week.developmentHours);
      const meetingHours = hours(week.meetingHours);
      if (!weekStart || !DAY.test(weekStart) || weekStart < windowStart || weekStart > windowEnd || weeks.has(weekStart) || developmentHours === null || meetingHours === null) return null;
      weeks.add(weekStart);
      weeklyEffort.push({ weekStart, developmentHours, meetingHours });
    }
    weekCount += weeklyEffort.length;
    if (weekCount > MAX_WEEKS) return null;
    projects.push({ projectID, displayName, meetingSearchTerms: terms, weeklyEffort });
  }
  return { memberID, windowStart, windowEnd, projects };
}
