"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { DashboardGrid } from "@/components/dashboard/DashboardGrid";
import { PortfolioPulse } from "@/components/dashboard/PortfolioPulse";
import type { CompanyContentPreview } from "@/types/company-content";
import { loadCompanyContent, peekCompanyContent } from "@/lib/company-content-client";
import {
  DashboardScoreOverview,
  type DashboardManagementScoreSnapshot,
} from "@/components/dashboard/DashboardScoreOverview";
import type { CurrentSpsProjectAssessment } from "@/lib/current-sps-model";
import { createClient } from "@/lib/supabase/client";
import {
  fetchProjectsFromSupabase,
  fetchBillingStatusFromSupabase,
  type DashProject,
  type DashBillingStatus,
} from "@/lib/supabase-data";
import { ActionItemsPanel } from "@/components/governance/ActionItemsPanel";
import { FundingStatsCard } from "@/components/dashboard/FundingStatsCard";
import { ProactiveTodoBadge } from "@/components/proactive-todo/ProactiveTodoBadge";
import { ExtractionStatusCard } from "@/components/dashboard/ExtractionStatusCard";
import { FreeeConnectionStatusCard } from "@/components/dashboard/FreeeConnectionStatusCard";

const MyPageContent = dynamic(
  () => import("@/app/(app)/mypage/page").then((mod) => mod.MyPageContent),
  {
    ssr: false,
    loading: () => (
      <div className="text-sm text-muted-foreground py-8 text-center">マイページ読み込み中…</div>
    ),
  },
);

const CompanyContentShelf = dynamic(
  () => import("@/components/dashboard/CompanyContentShelf").then((mod) => mod.CompanyContentShelf),
  {
    ssr: false,
    loading: () => (
      <div className="text-sm text-muted-foreground py-8 text-center">会社の記録を読み込み中…</div>
    ),
  },
);

function getCurrentYm() {
  const now = new Date();
  return String(now.getFullYear()) + String(now.getMonth() + 1).padStart(2, "0");
}

export default function DashboardPage() {
  const [projects, setProjects] = useState<DashProject[]>([]);
  const [billingStatus, setBillingStatus] = useState<Record<string, DashBillingStatus>>({});
  const [currentSps, setCurrentSps] = useState<Record<string, CurrentSpsProjectAssessment>>({});
  const [managementScore, setManagementScore] = useState<DashboardManagementScoreSnapshot | null>(null);
  const [managementHistory, setManagementHistory] = useState<DashboardManagementScoreSnapshot[]>([]);
  const [myProjectIds, setMyProjectIds] = useState<Set<string>>(new Set());
  const [projectLoadFailed, setProjectLoadFailed] = useState(false);
  const [companyContent, setCompanyContent] = useState<CompanyContentPreview | null>(null);
  const [companyLoading, setCompanyLoading] = useState(false);
  const companyAnchorRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    Promise.allSettled([
      fetchProjectsFromSupabase(),
      fetchBillingStatusFromSupabase(getCurrentYm()),
      fetch("/api/sps/current", { cache: "no-store" }).then(async (response) => {
        const payload = await response.json();
        if (!response.ok || !payload.ok) throw new Error(payload.error || "現行SPSの取得に失敗");
        return Object.fromEntries((payload.assessments as CurrentSpsProjectAssessment[]).map((assessment) => [assessment.project_id, assessment]));
      }),
      fetchManagementScoreHistory(supabase),
      fetchMyProjectIds(supabase),
    ]).then(([projRes, billRes, scoreRes, mgmtRes, myProjRes]) => {
      const projectsValue = projRes.status === "fulfilled" ? projRes.value : [];
      const billingValue = billRes.status === "fulfilled" ? billRes.value : {};
      setProjects(projectsValue);
      setProjectLoadFailed(projRes.status === "rejected");
      setBillingStatus(billingValue);

      if (scoreRes.status === "fulfilled") setCurrentSps(scoreRes.value);

      if (mgmtRes.status === "fulfilled") {
        setManagementHistory(mgmtRes.value);
        setManagementScore(mgmtRes.value[mgmtRes.value.length - 1] ?? null);
      }

      if (myProjRes.status === "fulfilled") {
        setMyProjectIds(myProjRes.value);
      }

      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // 会社の記録 (名簿・沿革・メディア掲載・写真) は参照系なので、一度読んだらキャッシュから配る。
  // 同じセッションで2回目以降にホームを開いたときは待ち時間ゼロで節が埋まる。
  useEffect(() => {
    if (companyContent || companyLoading) return;
    const node = companyAnchorRef.current;
    if (!node) return;

    // 同じセッションで読み込み済みなら、画面下まで来るのを待たずにそのまま描く。
    // loadCompanyContent はキャッシュ済みなら往復せずに解決する。
    if (peekCompanyContent()) {
      let cancelled = false;
      loadCompanyContent().then((value) => {
        if (!cancelled) setCompanyContent(value);
      }).catch(() => undefined);
      return () => { cancelled = true; };
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        setCompanyLoading(true);
        loadCompanyContent()
          .then((value) => setCompanyContent(value))
          .catch(() => setCompanyContent({ members: [], history: [], photos: [], mediaMentions: [] }))
          .finally(() => setCompanyLoading(false));
      },
      { rootMargin: "600px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [loading, companyContent, companyLoading]);

  const projectLabels = useMemo(() => {
    return Object.fromEntries(
      projects.map((project) => [
        project.projectId,
        project.projectName || project.projectId,
      ])
    );
  }, [projects]);
  const dashboardProjects = useMemo(
    () => projects.filter((project) => project.projectId !== "p00"),
    [projects],
  );

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

  return (
    <div className="amd-home-page-skin p-3 sm:p-4">
      <div className="max-w-[1700px] mx-auto space-y-4">
        {/* この grid の高さが、右カラム (マイページ) の sticky 追従が止まる位置になる。
            sticky の可動域は「自分の行」ではなく grid コンテナ全体なので、全幅で敷きたい節を
            この grid の中へ入れてはいけない。入れた瞬間、右カラムがその節の右側を覆い隠す
            (2026-08-27: 会社の記録の写真列が読めなくなっていた不具合の原因)。 */}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(600px,1fr)_minmax(360px,400px)]">
          <div className="space-y-4 min-w-0">
            <ProactiveTodoBadge />
            {/* 研究ポートフォリオ優先キュー (= 研究機関・シーズが母集団、PJは契約成立後の運用レイヤー)。
                旧 /portfolio-preview を2026-08-02にホームへ正式採用 (まさ確定)。 */}
            <PortfolioPulse projects={dashboardProjects} />
            <div id="pj-operations" className="scroll-mt-4 space-y-4">
              {projectLoadFailed ? (
                <section className="dashboard-desk-section border-amber-300 bg-amber-50/80 px-4 py-5 text-sm text-amber-950">
                  <p className="font-semibold">PJ台帳を読み込めなかった</p>
                  <p className="mt-1 text-amber-900">認証状態を更新するため、ページを再読み込みしてね。</p>
                  <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="mt-3 min-h-11 rounded-[7px] border border-amber-400 bg-white px-4 font-semibold hover:bg-amber-100"
                  >
                    再読み込み
                  </button>
                </section>
              ) : (
                <DashboardGrid
                  projects={dashboardProjects}
                  billingStatus={billingStatus}
                  currentSps={currentSps}
                  myProjectIds={myProjectIds}
                />
              )}
            </div>
            <ActionItemsPanel projectLabels={projectLabels} variant="dashboard" limit={5} />
            <details className="dashboard-desk-section group" open>
              <summary className="dashboard-desk-section-title cursor-pointer">
                経営指標・接続状況
              </summary>
              {/* 縦積みだと1枚あたり幅900px超を捨てて空白になるので2列で敷く。 */}
              <div className="mt-2 grid grid-cols-1 gap-3 lg:grid-cols-2">
                <DashboardScoreOverview
                  managementScore={managementScore}
                  managementHistory={managementHistory}
                />
                <FundingStatsCard />
                <ExtractionStatusCard />
                <FreeeConnectionStatusCard />
              </div>
            </details>
          </div>
          {/* /mypage の中身そっくり embed (= まさ #71 v3 確定、MyPageContent を再利用)。
              desktopはsticky + 独立scroll、mobile/tabletは明示カードで /mypage へ導線を出す
              (2026-08-02 まさ追加監査反映: mobileで消さない)。 */}
          <aside className="min-w-0 xl:sticky xl:top-3 xl:max-h-[calc(100vh-1.5rem)] xl:self-start xl:overflow-y-auto xl:border-l xl:border-border/50 xl:pl-4">
            <Link
              href="/mypage"
              className="dashboard-desk-section mb-3 flex items-center justify-between gap-2 px-3 py-3 text-[13px] font-medium text-[var(--desk-ink)] xl:hidden"
            >
              <span>マイページを開く — 今週の活動・報酬・PJ</span>
              <ArrowRight className="h-4 w-4 shrink-0 text-[var(--desk-blue)]" aria-hidden="true" />
            </Link>
            <div className="hidden xl:block">
              <MyPageContent embedded showMonthlyProjects={false} />
            </div>
          </aside>
        </div>
        <div id="company-content" ref={companyAnchorRef} className="scroll-mt-4">
            {companyContent ? (
              <CompanyContentShelf
                members={companyContent.members}
                history={companyContent.history}
                photos={companyContent.photos}
                mediaMentions={companyContent.mediaMentions}
              />
            ) : (
              <div className="text-sm text-muted-foreground py-8 text-center">会社の記録を読み込み中…</div>
            )}
        </div>
      </div>
    </div>
  );
}

async function fetchManagementScoreHistory(supabase: ReturnType<typeof createClient>): Promise<DashboardManagementScoreSnapshot[]> {
  const { data, error } = await supabase
    .from("amd_management_score_snapshots")
    .select("ym,total_score,initiative_score,finance_score,retention_score,pipeline_score,direction_score,confidence")
    .order("ym", { ascending: true })
    .order("updated_at", { ascending: true });
  if (error || !data) return [];
  const latestByYm = new Map<string, DashboardManagementScoreSnapshot>();
  for (const row of data) {
    latestByYm.set(row.ym ?? "", {
      ym: row.ym ?? null,
      total_score: row.total_score == null ? null : Number(row.total_score),
      initiative_score: row.initiative_score == null ? null : Number(row.initiative_score),
      finance_score: row.finance_score == null ? null : Number(row.finance_score),
      retention_score: row.retention_score == null ? null : Number(row.retention_score),
      pipeline_score: row.pipeline_score == null ? null : Number(row.pipeline_score),
      direction_score: row.direction_score == null ? null : Number(row.direction_score),
      confidence: row.confidence == null ? null : Number(row.confidence),
    });
  }
  return Array.from(latestByYm.values()).filter((row) => row.ym);
}

/** 自分が参画してる active PJ id Set (= ProjectStripe ソート優先用、軽量 fetch) */
async function fetchMyProjectIds(supabase: ReturnType<typeof createClient>): Promise<Set<string>> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const email = user?.email?.toLowerCase() || "";
    if (!email) return new Set();
    const { data: member } = await supabase.from("members").select("member_id").eq("email", email).maybeSingle();
    if (!member?.member_id) return new Set();
    const { data: pmRows } = await supabase
      .from("project_members")
      .select("project_id")
      .eq("member_id", member.member_id)
      .eq("is_active", true);
    return new Set((pmRows ?? []).map((r) => String(r.project_id)));
  } catch {
    return new Set();
  }
}
