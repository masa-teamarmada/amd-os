"use client";

import { loadWorkspaceMeetings } from "@/lib/workspace-meetings-client";
import { useEffect, useState } from "react";
import type { ProjectStrategySignal } from "@/lib/supabase-data";
import { CockpitStrategySignals } from "@/components/cockpit/CockpitStrategySignals";
import { CockpitMeetingSummary } from "@/components/cockpit/CockpitMeetingSummary";

export function WorkspaceMeetings({ projectId, readOnly }: { projectId: string; readOnly: boolean }) {
  const [signals, setSignals] = useState<ProjectStrategySignal[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadWorkspaceMeetings(projectId)
      .then((payload) => { if (!cancelled) setSignals(payload.signals); })
      .catch(() => {
        if (!cancelled) setError("動向を読み込めない。再読み込みして。");
      });
    return () => { cancelled = true; };
  }, [projectId]);

  return (
    <div className="grid min-w-0 gap-3 lg:grid-cols-2">
      {error ? <p role="alert" className="rounded-lg border p-3 text-sm text-red-700">{error}</p>
        : signals ? <CockpitStrategySignals projectId={projectId} signals={signals} readOnly={readOnly} />
          : <p role="status" className="rounded-lg border p-3 text-sm text-muted-foreground">動向を読み込んでるよ…</p>}
      <CockpitMeetingSummary projectId={projectId} sharedWorkspace readOnly={readOnly} />
    </div>
  );
}
