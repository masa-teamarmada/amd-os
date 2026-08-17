import { redirect } from "next/navigation";
import { amdScoreDetailHref } from "@/lib/amd-score-routes";

export default async function SpsProjectRedirect({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  redirect(amdScoreDetailHref(projectId));
}
