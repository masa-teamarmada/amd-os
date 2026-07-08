"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { CockpitView } from "@/components/cockpit/CockpitView";
import { fetchCockpitFromSupabase, type CockpitData } from "@/lib/supabase-data";

export default function CockpitPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const projectId = params.projectId as string;

  const [cockpit, setCockpit] = useState<CockpitData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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
  // ?meeting= がある場合は MTG詳細モーダルを優先し、月次モーダルとの二重起動を避ける。

  return (
    <CockpitView
      cockpit={cockpit}
      tasks={cockpit.tasks || []}
      initialModalYm={meetingParam ? null : ymParam}
    />
  );
}
