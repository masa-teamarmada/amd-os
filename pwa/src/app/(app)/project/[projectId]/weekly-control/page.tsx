import { redirect } from "next/navigation";

export default async function ProjectWeeklyControlPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  redirect(`/project/${encodeURIComponent(projectId)}/workspace`);
}
