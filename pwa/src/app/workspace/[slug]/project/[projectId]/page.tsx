import { notFound } from "next/navigation";
import { InstitutionProjectControlView } from "@/components/workspace/InstitutionProjectControlView";
import { getInstitutionProjectControl } from "@/lib/institution-project-control-server";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return { title: "研究機関PJ - AMD OS" };
}

export default async function InstitutionProjectPage({
  params,
}: {
  params: Promise<{ slug: string; projectId: string }>;
}) {
  const { slug, projectId } = await params;
  const result = await getInstitutionProjectControl(slug, projectId);
  if (!result) notFound();

  return (
    <InstitutionProjectControlView
      workspace={result.workspace}
      project={result.project}
      control={result.control}
    />
  );
}
