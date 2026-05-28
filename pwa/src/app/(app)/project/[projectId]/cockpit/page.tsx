"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { CockpitView } from "@/components/cockpit/CockpitView";
import { fetchCockpitFromSupabase, type CockpitData } from "@/lib/supabase-data";
import { createClient } from "@/lib/supabase/client";

export default function CockpitPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const projectId = params.projectId as string;

  const [cockpit, setCockpit] = useState<CockpitData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // 月次ルーティン操作権限 (PM 以外は表示のみ、まさ要望 2026-05-11)
  // is_admin (= まさ) OR project_members.is_pm = TRUE の場合のみ true
  const [canEditRoutine, setCanEditRoutine] = useState(false);

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

    // PM 判定
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
        // ignore — default: false (表示のみ)
      }
    })();
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

  const stepParam = searchParams.get("step");
  const ymParam = searchParams.get("ym");
  const meetingParam = searchParams.get("meeting");
  // ?step=xxx&ym=YYYYMM が両方あれば、stepId 別の専用モーダルを起動時に開く。
  // 月次モーダルを開きたいときは ?ym だけ。
  // ?meeting= がある場合は MTG詳細モーダルを優先し、月次系モーダルとの二重起動を避ける。
  const initialStep = !meetingParam && stepParam && ymParam ? { ym: ymParam, stepId: stepParam } : null;

  return (
    <CockpitView
      cockpit={cockpit}
      nudges={cockpit.nudges || []}
      tasks={cockpit.tasks || []}
      initialModalYm={meetingParam || initialStep ? null : ymParam}
      initialStep={initialStep}
      canEditRoutine={canEditRoutine}
    />
  );
}
