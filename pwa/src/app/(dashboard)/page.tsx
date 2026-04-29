import { createClient } from "@/lib/supabase/server";
import { getDashboardData } from "@/lib/supabase/queries";
import {
  buildProjectSummaries,
  deriveActionItems,
  calculateKPIs,
} from "@/lib/utils/dashboard";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { ProjectStatusGrid } from "@/components/dashboard/ProjectStatusGrid";
import { BillingPipeline } from "@/components/dashboard/BillingPipeline";
import { ActionItems } from "@/components/dashboard/ActionItems";
import { MilestoneTracker } from "@/components/dashboard/MilestoneTracker";
import { RecentProtocols } from "@/components/dashboard/RecentProtocols";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { billing, milestones, protocols, currentYm } =
    await getDashboardData(supabase);

  const projects = buildProjectSummaries(billing, milestones, protocols);
  const actionItems = deriveActionItems(
    billing,
    milestones,
    protocols,
    currentYm
  );
  const kpis = calculateKPIs(billing, milestones, currentYm);

  return (
    <div>
      <DashboardHeader kpis={kpis} />

      <div className="px-5 py-4 space-y-3">
        <ProjectStatusGrid projects={projects} />

        <div className="grid grid-cols-5 gap-3">
          <div className="col-span-3">
            <BillingPipeline billing={billing} />
          </div>
          <div className="col-span-2">
            <ActionItems items={actionItems} />
          </div>
        </div>

        <MilestoneTracker milestones={milestones} currentYm={currentYm} />

        <RecentProtocols protocols={protocols} />
      </div>
    </div>
  );
}
