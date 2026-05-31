"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CockpitView } from "@/components/cockpit/CockpitView";
import { computeErs, INSTITUTION_TYPE_LABEL, type ErsAssessment } from "@/lib/ers";
import { fetchErsBundle, type ErsBundle } from "@/lib/ers-data";
import { getInstitutionProjectLink, type InstitutionProjectLink } from "@/lib/institution-projects";
import { createClient } from "@/lib/supabase/client";
import {
  fetchCockpitFromSupabase,
  fetchProjectMeetingSummaries,
  type CockpitData,
  type ProjectMeetingSummary,
} from "@/lib/supabase-data";

type LoadingState = "loading" | "ready" | "error";

export default function InstitutionCockpitPage() {
  const params = useParams<{ institutionId: string }>();
  const institutionId = params.institutionId;
  const projectLink = getInstitutionProjectLink(institutionId);
  const [bundle, setBundle] = useState<ErsBundle | null>(null);
  const [cockpit, setCockpit] = useState<CockpitData | null>(null);
  const [meetings, setMeetings] = useState<ProjectMeetingSummary[]>([]);
  const [canEditRoutine, setCanEditRoutine] = useState(false);
  const [state, setState] = useState<LoadingState>("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!projectLink) {
        setState("error");
        setError("この研究機関には、まだ関連PJコックピットが設定されていません。");
        return;
      }
      setState("loading");
      setError(null);
      try {
        const [nextBundle, nextCockpit, nextMeetings] = await Promise.all([
          fetchErsBundle(),
          fetchCockpitFromSupabase(projectLink.projectId),
          fetchProjectMeetingSummaries(projectLink.projectId, { limit: 80 }),
        ]);
        if (cancelled) return;
        setBundle(nextBundle);
        setCockpit(nextCockpit);
        setMeetings(nextMeetings);
        setState("ready");
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "データ取得に失敗しました。");
        setState("error");
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [projectLink]);

  useEffect(() => {
    if (!projectLink) return;
    (async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.email) return;
        const { data: member } = await supabase
          .from("members")
          .select("member_id, is_admin")
          .eq("email", user.email)
          .single();
        if (!member) return;
        if (member.is_admin) {
          setCanEditRoutine(true);
          return;
        }
        const { data: pm } = await supabase
          .from("project_members")
          .select("is_pm")
          .eq("project_id", projectLink.projectId)
          .eq("member_id", member.member_id)
          .eq("is_active", true)
          .maybeSingle();
        setCanEditRoutine(Boolean(pm?.is_pm));
      } catch {
        setCanEditRoutine(false);
      }
    })();
  }, [projectLink]);

  const institution = useMemo(
    () => bundle?.institutions.find((item) => item.institutionId === institutionId) ?? null,
    [bundle, institutionId],
  );
  const assessments = useMemo<ErsAssessment[]>(
    () => (bundle ? bundle.assessmentsByInstitution[institutionId] ?? [] : []),
    [bundle, institutionId],
  );
  const ersResult = useMemo(
    () => (bundle && institution ? computeErs(bundle.axes, bundle.criteria, assessments) : null),
    [bundle, institution, assessments],
  );

  if (!projectLink) {
    return <InstitutionCockpitError message="この研究機関には、まだ関連PJコックピットが設定されていません。" />;
  }

  if (state === "loading") {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="space-y-2 text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">NIMSコックピットを読み込み中...</p>
        </div>
      </div>
    );
  }

  if (state === "error" || !cockpit || !institution || !ersResult) {
    return <InstitutionCockpitError message={error || "NIMSコックピットの読み込みに失敗しました。"} />;
  }

  return (
    <div className="p-4 max-w-[1700px] mx-auto space-y-4">
      <InstitutionCockpitHeader
        projectLink={projectLink}
        institutionName={institution.name}
        institutionType={INSTITUTION_TYPE_LABEL[institution.type] ?? institution.type}
        institutionMeta={[institution.region, institution.description].filter(Boolean).join(" · ")}
        ersPercent={ersResult.ers}
        assessed={`${ersResult.assessedCriteria}/${ersResult.totalCriteria}`}
        cockpit={cockpit}
        meetings={meetings}
      />

      <NimsMeetingTree projectLink={projectLink} meetings={meetings} />

      <section className="rounded-xl border border-sky-200 bg-sky-50/50 px-4 py-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-sm font-semibold text-sky-950">関連PJコックピット</h2>
            <p className="text-xs text-sky-800/80 mt-0.5">
              NIMSの箱はこの画面に残し、進捗・月次・MTG履歴は既存の関連PJデータをそのまま使う。
            </p>
          </div>
          <Link
            href={`/project/${projectLink.projectId}/cockpit`}
            className="text-xs rounded-md border border-sky-300 bg-white px-3 py-1.5 text-sky-800 hover:bg-sky-50"
          >
            通常PJコックピットを開く
          </Link>
        </div>
      </section>

      <CockpitView
        cockpit={cockpit}
        nudges={cockpit.nudges || []}
        tasks={cockpit.tasks || []}
        canEditRoutine={canEditRoutine}
      />
    </div>
  );
}

function InstitutionCockpitHeader({
  projectLink,
  institutionName,
  institutionType,
  institutionMeta,
  ersPercent,
  assessed,
  cockpit,
  meetings,
}: {
  projectLink: InstitutionProjectLink;
  institutionName: string;
  institutionType: string;
  institutionMeta: string;
  ersPercent: number | null;
  assessed: string;
  cockpit: CockpitData;
  meetings: ProjectMeetingSummary[];
}) {
  const activeMilestones = cockpit.milestones.filter((milestone) => milestone.tag !== "buffer");
  const latestMeeting = meetings.find((meeting) => meeting.sourceKinds !== "upcoming_tentative");
  return (
    <header className="rounded-xl border border-border bg-white px-4 py-4 space-y-3">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold">{projectLink.cockpitTitle}</h1>
            <span className="text-[10px] rounded border px-1.5 py-0.5 bg-indigo-50 text-indigo-800 border-indigo-300">
              {institutionType}
            </span>
            <span className="text-[10px] rounded border px-1.5 py-0.5 bg-sky-50 text-sky-800 border-sky-300">
              {projectLink.relationLabel}
            </span>
          </div>
          <p className="text-sm text-foreground mt-1">{institutionName}</p>
          {institutionMeta && <p className="text-xs text-muted-foreground mt-1">{institutionMeta}</p>}
          <p className="text-xs text-muted-foreground mt-2 max-w-3xl">{projectLink.cockpitSummary}</p>
        </div>
        <div className="flex gap-2 shrink-0 flex-wrap justify-end">
          <Link
            href={`/institutions/${projectLink.institutionId}`}
            className="text-xs rounded-md border border-border bg-white px-3 py-1.5 hover:bg-muted/40"
          >
            ERS詳細
          </Link>
          <Link
            href={`/project/${projectLink.projectId}/cockpit`}
            className="text-xs rounded-md border border-primary/40 bg-primary/5 px-3 py-1.5 text-primary hover:bg-primary/10"
          >
            {projectLink.projectLabel}
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <HeaderMetric label="ERS充足率" value={ersPercent != null ? `${Math.round(ersPercent)}%` : "未評価"} sub={`評価済 ${assessed}`} />
        <HeaderMetric label="関連PJ" value={cockpit.project.projectName || projectLink.projectLabel} sub={cockpit.project.status || "status未設定"} />
        <HeaderMetric label="今期MS" value={activeMilestones.length ? `${activeMilestones.length}件` : "未設定"} sub={cockpit.planCycle ? `${formatYm(cockpit.planCycle.periodStartYm)}-${formatYm(cockpit.planCycle.periodEndYm)}` : "MS期間なし"} />
        <HeaderMetric label="MTG履歴" value={`${meetings.length}件`} sub={latestMeeting ? latestMeeting.title : "履歴なし"} />
      </div>
    </header>
  );
}

function HeaderMetric({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 px-3 py-2 min-w-0">
      <div className="text-[10px] font-mono uppercase text-muted-foreground">{label}</div>
      <div className="text-lg font-bold truncate">{value}</div>
      <div className="text-[10px] text-muted-foreground truncate">{sub}</div>
    </div>
  );
}

function NimsMeetingTree({ projectLink, meetings }: { projectLink: InstitutionProjectLink; meetings: ProjectMeetingSummary[] }) {
  const groups = useMemo(() => {
    const map = new Map<string, ProjectMeetingSummary[]>();
    for (const meeting of meetings) {
      const key = meeting.ym || meeting.meetingDate.slice(0, 4) + meeting.meetingDate.slice(5, 7);
      const label = formatYm(key);
      map.set(label, [...(map.get(label) ?? []), meeting]);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 8);
  }, [meetings]);

  return (
    <section className="rounded-xl border border-border bg-white px-4 py-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold">MTGツリー</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            NIMSに紐づく関連PJの会議履歴を月ごとに束ねる。各行から既存のMTG詳細へ遷移できる。
          </p>
        </div>
        <Link
          href={`/project/${projectLink.projectId}/cockpit`}
          className="text-xs rounded-md border border-border bg-white px-3 py-1.5 hover:bg-muted/40"
        >
          MTG一覧を開く
        </Link>
      </div>

      {groups.length === 0 ? (
        <div className="mt-3 rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
          まだMTG履歴がありません。関連PJ側に予定MTGカードまたは開催済み議事録が入ると、ここに月別で並びます。
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          {groups.map(([ym, items]) => (
            <details key={ym} open={groups[0]?.[0] === ym} className="rounded-lg border border-border bg-muted/10">
              <summary className="cursor-pointer px-3 py-2 text-sm font-medium">
                {ym} <span className="text-xs text-muted-foreground">({items.length}件)</span>
              </summary>
              <div className="border-t border-border divide-y divide-border/60">
                {items.map((meeting) => (
                  <Link
                    key={meeting.meetingId}
                    href={`/project/${projectLink.projectId}/cockpit?meeting=${encodeURIComponent(meeting.meetingId)}`}
                    className="block px-3 py-2 hover:bg-white"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-xs font-medium truncate">{meeting.title || "無題MTG"}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
                          {meeting.summaryShort || meeting.narrativeMd?.replace(/\s+/g, " ").slice(0, 120) || "サマリ未作成"}
                        </div>
                      </div>
                      <span className="shrink-0 text-[10px] rounded border border-border bg-white px-1.5 py-0.5 text-muted-foreground">
                        {meeting.sourceKinds === "upcoming" ? "予定" : meeting.sourceKinds === "dialogue" ? "提案整理" : "議事録"}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </details>
          ))}
        </div>
      )}
    </section>
  );
}

function InstitutionCockpitError({ message }: { message: string }) {
  return (
    <div className="p-6 space-y-3">
      <p className="text-sm text-destructive">{message}</p>
      <Link href="/dashboard" className="text-sm text-primary hover:underline">
        ダッシュボードへ戻る
      </Link>
    </div>
  );
}

function formatYm(ym: string) {
  if (!ym || ym.length < 6) return ym || "--";
  return `${ym.slice(0, 4)}/${ym.slice(4, 6)}`;
}
