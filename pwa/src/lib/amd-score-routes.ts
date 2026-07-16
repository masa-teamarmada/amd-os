const STANDALONE_SCORE_DEMO_PROJECT_ID = "p99";

export function amdScoreDetailHref(projectId: string) {
  return projectId === STANDALONE_SCORE_DEMO_PROJECT_ID
    ? `/venture-map/amd-score/${projectId}`
    : `/project/${projectId}/cockpit?tab=score-detail`;
}
