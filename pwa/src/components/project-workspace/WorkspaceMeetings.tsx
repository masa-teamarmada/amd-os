"use client";
import { useEffect, useState } from "react";
import type { ProjectStrategySignal } from "@/lib/supabase-data";
import { CockpitStrategySignals } from "@/components/cockpit/CockpitStrategySignals";
import { CockpitMeetingSummary } from "@/components/cockpit/CockpitMeetingSummary";

export function WorkspaceMeetings({projectId,readOnly}:{projectId:string;readOnly:boolean}) {
  const [signals,setSignals] = useState<ProjectStrategySignal[]>([]);
  const [error,setError] = useState<string|null>(null);
  useEffect(()=>{
    let cancelled=false;
    fetch(`/api/project/${encodeURIComponent(projectId)}/workspace-meetings`).then(async response=>{
      const json=await response.json();
      if(!response.ok||!json.ok) throw new Error("動向を読み込めない");
      if(!cancelled)setSignals(json.signals);
    }).catch(()=>{if(!cancelled)setError("動向を読み込めない。再読み込みして。");});
    return ()=>{cancelled=true;};
  },[projectId]);
  return <div className="grid min-w-0 gap-3 lg:grid-cols-2">{error?<p role="alert">{error}</p>:<CockpitStrategySignals projectId={projectId} signals={signals} readOnly={readOnly} />}<CockpitMeetingSummary projectId={projectId} sharedWorkspace readOnly={readOnly} /></div>;
}
