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
    const { data: pj } = await supabase
      .from("projects")
      .select("project_name")
      .eq("project_id", projectId)
      .maybeSingle();
    const pjName = (pj?.project_name as string | null) ?? null;
    if (pjName && pjName.trim().length > 0) name = pjName;
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
