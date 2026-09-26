/** 参加月・終了月はいずれもその月を含む。履歴を保つため終了だけでは行を無効化しない。 */
export type ProjectParticipationRow = {
  member_id: string;
  is_active?: boolean | null;
  join_ym?: string | null;
  leave_ym?: string | null;
};

export function activeProjectMemberIdsForYm(rows: ProjectParticipationRow[], ym: string): Set<string> {
  return new Set(rows.filter((row) => row.is_active !== false
    && (!row.join_ym || ym >= row.join_ym)
    && (!row.leave_ym || ym <= row.leave_ym)).map((row) => row.member_id));
}
