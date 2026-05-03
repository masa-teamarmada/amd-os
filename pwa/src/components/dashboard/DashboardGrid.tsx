"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { DashProject as GasProject, DashBillingStatus as GasBillingStatus } from "@/lib/supabase-data";

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  sales: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  draft: "bg-violet-500/10 text-violet-600 border-violet-500/20",
  ended: "bg-zinc-500/10 text-zinc-500 border-zinc-500/20",
  frozen: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  lost: "bg-red-500/10 text-red-500 border-red-500/20",
};

interface DashboardGridProps {
  projects: GasProject[];
  billingStatus: Record<string, GasBillingStatus>;
}

function getAlerts(bs: GasBillingStatus | undefined): string[] {
  if (!bs) return [];
  const alerts: string[] = [];
  if (!bs.meetingDone) alerts.push("MTG未設定");
  if (!bs.reportDone) alerts.push("Report未確定");
  if (bs.invoiceDone && !bs.paymentDone) alerts.push("支払待ち");
  return alerts;
}

export function DashboardGrid({ projects, billingStatus }: DashboardGridProps) {
  // Group by status
  const active = projects.filter((p) => p.status === "active");
  const sales = projects.filter((p) => p.status === "sales" || p.status === "draft");
  const other = projects.filter(
    (p) => !["active", "sales", "draft"].includes(p.status)
  );

  return (
    <div className="space-y-6">
      {/* Active projects */}
      {active.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-muted-foreground mb-3">
            Active ({active.length})
          </h2>
          <div className="grid grid-cols-3 gap-3">
            {active.map((pj) => (
              <ProjectCard
                key={pj.projectId}
                project={pj}
                billing={billingStatus[pj.projectId]}
              />
            ))}
          </div>
        </section>
      )}

      {/* Sales / Draft */}
      {sales.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-muted-foreground mb-3">
            Sales / Draft ({sales.length})
          </h2>
          <div className="grid grid-cols-3 gap-3">
            {sales.map((pj) => (
              <ProjectCard
                key={pj.projectId}
                project={pj}
                billing={billingStatus[pj.projectId]}
              />
            ))}
          </div>
        </section>
      )}

      {/* Ended / Frozen */}
      {other.length > 0 && (
        <details className="group">
          <summary className="text-sm font-medium text-muted-foreground mb-3 cursor-pointer">
            Ended / Frozen ({other.length})
          </summary>
          <div className="grid grid-cols-3 gap-3 mt-3">
            {other.map((pj) => (
              <ProjectCard
                key={pj.projectId}
                project={pj}
                billing={billingStatus[pj.projectId]}
              />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function ProjectCard({
  project,
  billing,
}: {
  project: GasProject;
  billing?: GasBillingStatus;
}) {
  const alerts = getAlerts(billing);

  return (
    <Link href={`/project/${project.projectId}/cockpit`}>
      <Card className="hover:border-primary/30 transition-colors cursor-pointer h-full">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium truncate">
              {project.projectName}
            </CardTitle>
            <Badge
              variant="outline"
              className={STATUS_COLORS[project.status] ?? ""}
            >
              {project.status}
            </Badge>
          </div>
          {project.clientName && (
            <p className="text-xs text-muted-foreground truncate">
              {project.clientName}
            </p>
          )}
        </CardHeader>
        <CardContent>
          {alerts.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {alerts.map((a) => (
                <span key={a} className="text-xs text-amber-500">
                  {a}
                </span>
              ))}
            </div>
          ) : billing ? (
            <span className="text-xs text-emerald-500">正常</span>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
