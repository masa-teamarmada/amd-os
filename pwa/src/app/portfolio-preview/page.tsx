import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PortfolioPreview } from "@/components/portfolio-preview/PortfolioPreview";
import { fetchErsBundle } from "@/lib/ers-data";
import { getCurrentMemberAccess, memberHome } from "@/lib/project-workspace";
import { fetchAllResearchInstitutionSeeds } from "@/lib/seeds-data";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchProjectsFromSupabase } from "@/lib/supabase-data";

export const metadata: Metadata = {
  title: "研究ポートフォリオ仮設 - AMD OS",
};

export default async function PortfolioPreviewPage() {
  const access = await getCurrentMemberAccess();

  if (!access) {
    redirect("/auth/login?next=%2Fportfolio-preview");
  }
  if (access.scope !== "portfolio") {
    redirect(memberHome(access));
  }
  if (access.calendarStatus !== "connected") {
    redirect("/auth/login?next=%2Fportfolio-preview&error=calendar_required");
  }

  const readClient = createAdminClient();
  const [institutionBundle, seeds, projects] = await Promise.all([
    fetchErsBundle(readClient),
    fetchAllResearchInstitutionSeeds(readClient),
    fetchProjectsFromSupabase(readClient),
  ]);

  return (
    <PortfolioPreview
      displayName={access.displayName}
      initialData={{ institutionBundle, seeds, projects }}
    />
  );
}
