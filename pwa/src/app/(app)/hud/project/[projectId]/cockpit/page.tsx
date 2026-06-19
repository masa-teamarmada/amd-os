"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { HudCockpitView } from "@/components/hud/HudCockpitView";
import { AAA_PROJECT_ID, aaaCockpitData } from "@/lib/demo-aaa-data";
import { fetchCockpitFromSupabase, type CockpitData } from "@/lib/supabase-data";

export default function HudCockpitPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const projectId = params.projectId as string;
  const [cockpit, setCockpit] = useState<CockpitData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (projectId === AAA_PROJECT_ID) {
      setCockpit(aaaCockpitData);
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

  const ymParam = searchParams.get("ym");

  return (
    <div className="px-3 py-4">
      <HudCockpitView
        cockpit={cockpit}
        initialModalYm={ymParam}
      />
    </div>
  );
}
