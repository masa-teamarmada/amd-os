import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ projectId: string }>;
}): Promise<Metadata> {
  const { projectId } = await params;
  let name = projectId;
  try {
    const supabase = await createClient();
    // projects.project_name (全 PJ 必ず存在) → なければ project_ventures.display_name (SU 化済のみ)
    const [{ data: pj }, { data: pv }] = await Promise.all([
      supabase.from("projects").select("project_name").eq("project_id", projectId).maybeSingle(),
      supabase.from("project_ventures").select("display_name").eq("project_id", projectId).maybeSingle(),
    ]);
    const pjName = (pj?.project_name as string | null) ?? null;
    const pvName = (pv?.display_name as string | null) ?? null;
    if (pvName && pvName.trim().length > 0) name = pvName;
    else if (pjName && pjName.trim().length > 0) name = pjName;
  } catch { /* ignore */ }
  return { title: { absolute: `${name} - AMD OS` } };
}

export default function ProjectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Project validation is done in the cockpit page itself via GAS API
  return <>{children}</>;
}
