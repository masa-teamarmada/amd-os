"use client";

import { useEffect, useState } from "react";
import { HudControlCenterDashboard } from "@/components/hud/HudControlCenterDashboard";
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
    ]).then(([projRes, billRes, userRes]) => {
      if (projRes.status === "fulfilled") setProjects(projRes.value);
      if (billRes.status === "fulfilled") setBillingStatus(billRes.value);
      if (userRes.status === "fulfilled") setHudUser(userRes.value);
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

  return <HudControlCenterDashboard projects={projects} billingStatus={billingStatus} user={hudUser} />;
}
