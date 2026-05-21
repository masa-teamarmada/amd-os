"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { HudCockpitView } from "@/components/hud/HudCockpitView";
import { AAA_PROJECT_ID, aaaCockpitData } from "@/lib/demo-aaa-data";
import { createClient } from "@/lib/supabase/client";
import { fetchCockpitFromSupabase, type CockpitData } from "@/lib/supabase-data";

export default function HudCockpitPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const projectId = params.projectId as string;
  const [cockpit, setCockpit] = useState<CockpitData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [canEditRoutine, setCanEditRoutine] = useState(false);

  useEffect(() => {
    if (projectId === AAA_PROJECT_ID) {
      setCockpit(aaaCockpitData);
      setCanEditRoutine(false);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    fetchCockpitFromSupabase(projectId)
      .then((data) => {
        setCockpit(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "データ取得に失敗");
        setLoading(false);
      });

    (async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.email) return;
        const { data: m } = await supabase
          .from("members")
          .select("member_id, is_admin")
          .eq("email", user.email)
          .single();
        if (!m) return;
        if (m.is_admin) {
          setCanEditRoutine(true);
          return;
        }
        const { data: pm } = await supabase
          .from("project_members")
          .select("is_pm")
          .eq("project_id", projectId)
          .eq("member_id", m.member_id)
          .eq("is_active", true)
          .maybeSingle();
        if (pm?.is_pm) setCanEditRoutine(true);
      } catch {
        // default: read-only routine
      }
    })();
  }, [projectId]);

  if (loading) {
    return (
      <div className="grid h-[calc(100vh-6.25rem)] place-items-center">
        <div className="space-y-3 text-center">
          <div className="mx-auto h-9 w-9 rounded-full border-2 border-cyan-300 border-t-transparent animate-spin shadow-[0_0_18px_rgba(34,211,238,.5)]" />
          <p className="font-mono text-xs font-black uppercase tracking-[0.18em] text-cyan-100/75">Loading PJ cockpit</p>
        </div>
      </div>
    );
  }

  if (error || !cockpit) {
    return (
      <div className="grid h-[calc(100vh-6.25rem)] place-items-center px-5">
        <div className="border border-rose-300/40 bg-rose-950/25 p-5 text-center">
          <p className="text-sm font-bold text-rose-100">{error || "データ取得に失敗しました"}</p>
          <button onClick={() => window.location.reload()} className="mt-3 text-xs text-cyan-100 underline">
            再読み込み
          </button>
        </div>
      </div>
    );
  }

  const stepParam = searchParams.get("step");
  const ymParam = searchParams.get("ym");
  const initialStep = stepParam && ymParam ? { ym: ymParam, stepId: stepParam } : null;

  return (
    <div className="px-3 py-4">
      <HudCockpitView
        cockpit={cockpit}
        initialModalYm={initialStep ? null : ymParam}
        initialStep={initialStep}
        canEditRoutine={canEditRoutine}
      />
    </div>
  );
}
