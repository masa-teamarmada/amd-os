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
    const { data } = await supabase
      .from("project_ventures")
      .select("display_name")
      .eq("project_id", projectId)
      .maybeSingle();
    if (data?.display_name) name = data.display_name as string;
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
