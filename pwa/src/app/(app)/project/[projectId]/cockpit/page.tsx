"use client";

import { useEffect, useState } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { CockpitView, type CockpitTab } from "@/components/cockpit/CockpitView";
import { fetchCockpitFromSupabase, type CockpitData } from "@/lib/supabase-data";

interface CockpitLoadState {
  projectId: string;
  cockpit: CockpitData | null;
  error: string | null;
}

export default function CockpitPage() {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = params.projectId as string;

  const [loadState, setLoadState] = useState<CockpitLoadState>(() => ({
    projectId,
    cockpit: null,
    error: null,
  }));

  useEffect(() => {
    let cancelled = false;

    fetchCockpitFromSupabase(projectId)
      .then((data) => {
        if (cancelled) return;
        setLoadState({ projectId, cockpit: data, error: null });
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadState({
          projectId,
          cockpit: null,
          error: err instanceof Error ? err.message : "データ取得に失敗",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const isCurrentProject = loadState.projectId === projectId;
  const cockpit = isCurrentProject ? loadState.cockpit : null;
  const error = isCurrentProject ? loadState.error : null;
  const loading = !isCurrentProject || (!cockpit && !error);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-2.75rem)]">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (error || !cockpit) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-2.75rem)]">
        <div className="text-center space-y-2">
          <p className="text-sm text-destructive">{error || "データ取得に失敗しました"}</p>
          <button onClick={() => window.location.reload()} className="text-xs text-primary underline">
            再読み込み
          </button>
        </div>
      </div>
    );
  }

  const ymParam = searchParams.get("ym");
  const meetingParam = searchParams.get("meeting");
  const activeTab: CockpitTab = searchParams.get("tab") === "score-detail" ? "score-detail" : "progress";
  // ?meeting= がある場合は MTG詳細モーダルを優先し、月次モーダルとの二重起動を避ける。

  function handleTabChange(tab: CockpitTab) {
    const nextParams = new URLSearchParams(searchParams.toString());
    if (tab === "score-detail") {
      nextParams.set("tab", "score-detail");
    } else {
      nextParams.delete("tab");
    }
    const query = nextParams.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  return (
    <CockpitView
      cockpit={cockpit}
      tasks={cockpit.tasks || []}
      initialModalYm={meetingParam ? null : ymParam}
      activeTab={activeTab}
      onTabChange={handleTabChange}
    />
  );
}
