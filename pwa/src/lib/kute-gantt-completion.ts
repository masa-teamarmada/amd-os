/**
 * 完了した作業の行か。完了は作業の状態で明示し、日付や進捗%からは推定しない。
 * 全PJ同じ規則（2026-10-03 まさ「全部統一してないとだめ」、spec 3-23。以前は KUTE の試行だけ）。
 */
export function isCompletedTaskRow(
  row: { entity: string; state: string },
): boolean {
  return row.entity === "task" && row.state === "complete";
}

export const COMPLETED_TASK_COLOR = "#047857";
export const COMPLETED_TASK_BADGE =
  "border-[#6ee7b7] bg-[#ecfdf5] text-[#047857]";
