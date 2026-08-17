"use client";

import { useEffect, useState } from "react";
import { HudControlCenterDashboard, type HudManagementScoreSnapshot } from "@/components/hud/HudControlCenterDashboard";
import type { CurrentSpsProjectAssessment } from "@/lib/current-sps-model";
import { createClient } from "@/lib/supabase/client";
import {
  fetchBillingStatusFromSupabase,
  fetchProjectsFromSupabase,
  type DashBillingStatus,
  type DashProject,
} from "@/lib/supabase-data";

type HudUser = {
  codeName: string;
  memberId: string | null;
  email: string | null;
};

function getCurrentYm() {
  const now = new Date();
  return String(now.getFullYear()) + String(now.getMonth() + 1).padStart(2, "0");
}

export default function HudDashboardPage() {
  const [projects, setProjects] = useState<DashProject[]>([]);
  const [billingStatus, setBillingStatus] = useState<Record<string, DashBillingStatus>>({});
  const [hudUser, setHudUser] = useState<HudUser>({ codeName: "ONLINE", memberId: null, email: null });
  const [currentSps, setCurrentSps] = useState<Record<string, CurrentSpsProjectAssessment>>({});
  const [managementScore, setManagementScore] = useState<HudManagementScoreSnapshot | null>(null);
  const [managementHistory, setManagementHistory] = useState<HudManagementScoreSnapshot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    Promise.allSettled([
      fetchProjectsFromSupabase(),
      fetchBillingStatusFromSupabase(getCurrentYm()),
      supabase.auth.getUser().then(async ({ data }) => {
        const email = data.user?.email ?? null;
        if (!email) return { codeName: "ONLINE", memberId: null, email };
        const { data: member } = await supabase
          .from("members")
          .select("member_id, code_name, email")
          .eq("email", email)
          .maybeSingle();
        return {
          codeName: member?.code_name || data.user?.user_metadata?.name || email.split("@")[0] || "ONLINE",
          memberId: member?.member_id ?? null,
          email,
        };
      }),
      fetch("/api/sps/current", { cache: "no-store" }).then(async (response) => {
        const payload = await response.json();
        if (!response.ok || !payload.ok) throw new Error(payload.error || "現行SPSの取得に失敗");
        return Object.fromEntries((payload.assessments as CurrentSpsProjectAssessment[]).map((assessment) => [assessment.project_id, assessment]));
      }),
      fetchManagementScoreHistory(supabase),
    ]).then(([projRes, billRes, userRes, scoreRes, managementRes]) => {
      if (projRes.status === "fulfilled") setProjects(projRes.value);
      if (billRes.status === "fulfilled") setBillingStatus(billRes.value);
      if (userRes.status === "fulfilled") setHudUser(userRes.value);
      if (scoreRes.status === "fulfilled") setCurrentSps(scoreRes.value);
      if (managementRes?.status === "fulfilled") {
        setManagementHistory(managementRes.value);
        setManagementScore(managementRes.value[managementRes.value.length - 1] ?? null);
      }
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="grid h-[calc(100vh-6.25rem)] place-items-center">
        <div className="space-y-3 text-center">
          <div className="mx-auto h-9 w-9 rounded-full border-2 border-cyan-300 border-t-transparent animate-spin shadow-[0_0_18px_rgba(34,211,238,.5)]" />
          <p className="font-mono text-xs font-black uppercase tracking-[0.18em] text-cyan-100/75">Loading HUD client</p>
        </div>
      </div>
    );
  }

  return <HudControlCenterDashboard projects={projects} billingStatus={billingStatus} user={hudUser} actionItems={[]} currentSps={currentSps} managementScore={managementScore} managementHistory={managementHistory} />;
}

async function fetchManagementScoreHistory(supabase: ReturnType<typeof createClient>): Promise<HudManagementScoreSnapshot[]> {
  const { data, error } = await supabase
    .from("amd_management_score_snapshots")
    .select("ym,total_score,initiative_score,finance_score,retention_score,pipeline_score,direction_score,confidence")
    .order("ym", { ascending: true })
    .order("updated_at", { ascending: true });

  if (error || !data) return [];
  const latestByYm = new Map<string, HudManagementScoreSnapshot>();
  for (const row of data) {
    latestByYm.set(row.ym ?? "", normalizeManagementScore(row));
  }
  return Array.from(latestByYm.values()).filter((row) => row.ym);
}

function normalizeManagementScore(data: {
  ym: string | null;
  total_score: number | string | null;
  initiative_score: number | string | null;
  finance_score: number | string | null;
  retention_score: number | string | null;
  pipeline_score: number | string | null;
  direction_score: number | string | null;
  confidence: number | string | null;
}): HudManagementScoreSnapshot {
  return {
    ym: data.ym ?? null,
    total_score: data.total_score == null ? null : Number(data.total_score),
    initiative_score: data.initiative_score == null ? null : Number(data.initiative_score),
    finance_score: data.finance_score == null ? null : Number(data.finance_score),
    retention_score: data.retention_score == null ? null : Number(data.retention_score),
    pipeline_score: data.pipeline_score == null ? null : Number(data.pipeline_score),
    direction_score: data.direction_score == null ? null : Number(data.direction_score),
    confidence: data.confidence == null ? null : Number(data.confidence),
  };
}
