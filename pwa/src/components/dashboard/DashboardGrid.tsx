"use client";

import Link from "next/link";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { DashProject as GasProject, DashBillingStatus as GasBillingStatus } from "@/lib/supabase-data";
import { AllPjIntroductionModal } from "./AllPjIntroductionModal";

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
  projectHrefPrefix?: string;
  variant?: "default" | "hud";
}

// 2026-05-12 まさ指摘 3: アラート (MTG未設定 / Report未確定 / 支払待ち) 表示は削除済。
// getAlerts は廃止。billing 有無は ProjectCard が直接判定する。

export function DashboardGrid({ projects, billingStatus, projectHrefPrefix = "/project", variant = "default" }: DashboardGridProps) {
  const [introOpen, setIntroOpen] = useState(false);

  // Group by status
  const active = projects.filter((p) => p.status === "active");
  const sales = projects.filter((p) => p.status === "sales" || p.status === "draft");
  const other = projects.filter(
    (p) => !["active", "sales", "draft"].includes(p.status)
  );

  return (
    <div className="space-y-6">
      {/* === ツールバー (= まさ指摘 5: 「全PJ紹介資料作成」ボタン) === */}
      <div className="flex items-center justify-end">
        <button
          onClick={() => setIntroOpen(true)}
          className={`text-sm px-3 py-1.5 rounded-md border transition-colors ${
            variant === "hud"
              ? "border-cyan-300/35 bg-cyan-300/10 text-cyan-50 hover:bg-cyan-300/15"
              : "border-border bg-white hover:bg-muted/40"
          }`}
          title="チェックを入れた PJ のエグゼクティブサマリーを 1 つの HTML として出力"
        >
          📑 全 PJ 紹介資料作成
        </button>
      </div>

      {introOpen && (
        <AllPjIntroductionModal projects={projects} onClose={() => setIntroOpen(false)} />
      )}

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
                hrefPrefix={projectHrefPrefix}
                variant={variant}
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
                hrefPrefix={projectHrefPrefix}
                variant={variant}
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
                hrefPrefix={projectHrefPrefix}
                variant={variant}
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
  hrefPrefix,
  variant,
}: {
  project: GasProject;
  billing?: GasBillingStatus;
  hrefPrefix: string;
  variant: "default" | "hud";
}) {
  // 2026-05-12 まさ指摘 3: アラート表示 (MTG未設定 / Report未確定 / 支払待ち / 正常) を削除。
  // クリックで cockpit に遷移する以外、本カードは PJ 名 + status バッジだけのシンプル UI に。

  return (
    <Link href={`${hrefPrefix}/${project.projectId}/cockpit`}>
      <Card
        className={`transition-colors cursor-pointer h-full ${
          variant === "hud"
            ? "border-cyan-300/20 bg-slate-950/72 text-cyan-50 shadow-[inset_0_0_24px_rgba(34,211,238,0.08)] hover:border-cyan-200/60 hover:bg-cyan-950/45"
            : "hover:border-primary/30"
        }`}
      >
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
      </Card>
    </Link>
  );
}
