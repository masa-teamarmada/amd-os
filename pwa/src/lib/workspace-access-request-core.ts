export type WorkspaceAccessRequestTarget = {
  targetKind: "institution" | "project" | "unspecified";
  workspaceSlug: string | null;
  projectId: string | null;
  requestedPath: string;
};

const SAFE_SEGMENT = /^[A-Za-z0-9_-]{1,80}$/;

function cleanSegment(value: string | undefined): string | null {
  if (!value) return null;
  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return null;
  }
  return SAFE_SEGMENT.test(decoded) ? decoded : null;
}

/**
 * Converts the already same-origin-sanitized `next` path into the narrowest
 * requested workspace scope. The path is evidence of intent, never authority.
 */
export function workspaceAccessRequestTarget(nextPath: string): WorkspaceAccessRequestTarget {
  const pathOnly = nextPath.split(/[?#]/, 1)[0] || "/";
  const institutionProject = pathOnly.match(/^\/workspace\/([^/]+)\/project\/([^/]+)(?:\/|$)/);
  if (institutionProject) {
    return {
      targetKind: "project",
      workspaceSlug: cleanSegment(institutionProject[1]),
      projectId: cleanSegment(institutionProject[2]),
      requestedPath: nextPath.slice(0, 500),
    };
  }

  const institution = pathOnly.match(/^\/workspace\/([^/]+)(?:\/|$)/);
  if (institution) {
    const workspaceSlug = cleanSegment(institution[1]);
    if (workspaceSlug) {
      return {
        targetKind: "institution",
        workspaceSlug,
        projectId: null,
        requestedPath: nextPath.slice(0, 500),
      };
    }
  }

  const project = pathOnly.match(/^\/project\/([^/]+)\/workspace(?:\/|$)/);
  if (project) {
    const projectId = cleanSegment(project[1]);
    if (projectId) {
      return {
        targetKind: "project",
        workspaceSlug: null,
        projectId,
        requestedPath: nextPath.slice(0, 500),
      };
    }
  }

  return {
    targetKind: "unspecified",
    workspaceSlug: null,
    projectId: null,
    requestedPath: nextPath.slice(0, 500),
  };
}
