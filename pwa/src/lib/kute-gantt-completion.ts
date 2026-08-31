/** KUTE pilot: completion is an explicit task state, never inferred from dates or %. */
export function isKuteCompletedTask(
  projectId: string | null | undefined,
  row: { entity: string; state: string },
): boolean {
  return projectId === "p25" && row.entity === "task" && row.state === "complete";
}

export const KUTE_COMPLETED_COLOR = "#047857";
export const KUTE_COMPLETED_BADGE =
  "border-[#6ee7b7] bg-[#ecfdf5] text-[#047857]";
