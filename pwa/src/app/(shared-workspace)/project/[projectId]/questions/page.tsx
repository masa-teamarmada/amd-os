import { notFound } from "next/navigation";

import { QuestionTreeView } from "@/components/question-tree/QuestionTreeView";
import { SharedWorkspaceScopeRibbon } from "@/components/project-workspace/SharedWorkspaceScopeRibbon";
import { resolveSharedWorkspaceAccess } from "@/lib/project-shared-workspace-access";
import { getProjectWorkspaceBundle } from "@/lib/project-workspace";
import { getQuestionTreeBundle } from "@/lib/question-tree";
import { externalWorkspaceRoleCapabilityLabel } from "@/lib/workspace-capabilities";

/**
 * 問いの木。正本は pwa/spec/3-21-question-tree-current-spec.md。
 * 目的→成立条件→工程の3階層を置き換える計画の背骨。
 */
export default async function ProjectQuestionsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  // 存在しないPJと、見る権限が無いPJを呼び出し側から区別させない。
  const access = await resolveSharedWorkspaceAccess(projectId);
  if (!access) notFound();

  const workspace = await getProjectWorkspaceBundle(projectId, access);
  if (!workspace) notFound();

  const canManage = access.principal === "member" && (access.scope === "portfolio" || access.isAdmin);
  const bundle = await getQuestionTreeBundle(projectId, canManage);

  return (
    <>
      {access.principal === "workspace_account" && (
        <SharedWorkspaceScopeRibbon
          projectName={workspace.project.projectName}
          roleLabel={externalWorkspaceRoleCapabilityLabel(access.role)}
          principal="workspace_account"
          projectId={projectId}
        />
      )}
      <QuestionTreeView
        initialBundle={bundle}
        projectId={projectId}
        projectName={workspace.project.projectName}
      />
    </>
  );
}
