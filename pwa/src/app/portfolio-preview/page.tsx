import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PortfolioPreview } from "@/components/portfolio-preview/PortfolioPreview";
import { getCurrentMemberAccess, memberHome } from "@/lib/project-workspace";

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

  return <PortfolioPreview displayName={access.displayName} />;
}
