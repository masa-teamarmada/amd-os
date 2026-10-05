import { loadProjectGovernance } from "./project-governance-server";
import "server-only";
import { createAdminClient } from "./supabase/admin";
import { buildDagHealth } from "./project-management-logic";
import { getQuestionTreeBundle } from "./question-tree";
import { getSxManagementBundle, computeSxJudgment } from "./sx-management";
import { loadProjectBusinessPlan } from "./project-business-plan-server";
import { normalizeBzm22AcquisitionRow } from "./bzm-2-2-acquisitions";
import { buildAmdContributionsPayload, normalizeActivityRow, normalizeMeetingRow, type AmdContributionItem } from "./amd-contributions";
import { projectFormatTypeOf } from "./project-formats";
import { DD_PAGE_KEYS } from "./dd-pages";
import { loadProjectTechData } from "./project-tech-server";
import { loadProjectFinancePage } from "./project-finance-page-server";
import { loadCapitalPlanPage } from "./project-capital-plan-server";
import { loadCostModelBundle } from "@/app/api/project-cost-model/route";
import type { DdLiveProjectPage } from "./dd-project-page-types";
import type { IpPortfolioBundle } from "@/components/cockpit/CockpitIpPortfolio";
import type { Grant } from "@/components/cockpit/CockpitGrants";

/** 呼び出す前に当該DDへの入場権限を確認する。ページは共通定義の全内容を読む。 */
export async function loadDdProjectPage(projectId: string, page: string): Promise<DdLiveProjectPage> {
  if (!DD_PAGE_KEYS.includes(page) || page === "documents") throw new Error("Unsupported DD page");
  const db = createAdminClient();
  const identity = await db.from("projects").select("project_name,display_name,project_category").eq("project_id", projectId).single();
  if (identity.error) throw new Error(identity.error.message);
  const base = { kind: "project_page" as const, projectId, projectName: identity.data.display_name || identity.data.project_name };
  if (page === "technology" || page === "competition" || page === "business-model") return { ...base, page, tech: await loadProjectTechData(db, projectId) };
  if (page === "financial-projection") return { ...base, page, finance: await loadProjectFinancePage(db, projectId) };
  if (page === "capital-plan") return { ...base, page, capital: await loadCapitalPlanPage(db, projectId) };
  if (page === "cost-model") {
    const [main, fuel] = await Promise.all([loadCostModelBundle(projectId, "default"), loadCostModelBundle(projectId, "fuel")]);
    return { ...base, page, costs: { main: { canEdit: false, bundle: main }, fuel: { canEdit: false, bundle: fuel } } };
  }
  if (page === "gantt") return { ...base, page, tree: await getQuestionTreeBundle(projectId, false, false) };
  if (page === "partners") {
    const all = await getSxManagementBundle(projectId, false);
    // 関係先ページに使わない内部判断・週次差分・監査・資金スナップショットは送らない。
    const management = { ...all, horizonMonths: [], objectives: [], objective: null, outcomes: [], kpis: [], dependencies: [], scheduleDependencies: [],
      dag: buildDagHealth([], [], all.asOf), judgment: computeSxJudgment([], [], [], all.asOf),
      tracks: [], issues: [], hypotheses: [], evidence: [], validationRuns: [], decisions: [], actions: [], tasks: [],
      partnerInteractions: [], partnerRoles: [], technicalTests: [], fundingSnapshots: [], organizationRoles: [], raci: [], capacity: [], history: [], fieldAudit: [], canManage: false };
    return { ...base, page, management };
  }
  if (page === "business-plan") return { ...base, page, plan: await loadProjectBusinessPlan(projectId) };
  if (page === "company" || page === "capital-policy") {
    // キラー要素の状態・根拠・集計は社内コックピット専用。DDでは取得もしない。
    const [governance, business] = await Promise.all([
      loadProjectGovernance(db, projectId),
      page === "company" ? db.from("project_business_summaries").select("summary,detail,updated_at").eq("project_id", projectId).maybeSingle() : Promise.resolve({ data: null, error: null }),
    ]);
    if (business.error) throw new Error(business.error.message);
    return { ...base, page, governance, businessSummary: {ok: true, business: business.data ? {summary:business.data.summary, detail:business.data.detail, updatedAt:business.data.updated_at, updatedBy:null} : null, viewer:{canEdit:false}} };
  }
  if (page === "ip") {
    const [assets, deadlines, events] = await Promise.all([
      db.from("project_ip_assets").select("*").eq("project_id", projectId).order("importance", {ascending:false}).order("application_date", {ascending:false,nullsFirst:false}),
      db.from("project_ip_deadlines").select("*").eq("project_id", projectId).order("due_on"),
      db.from("project_ip_events").select("*").eq("project_id", projectId).order("event_date", {ascending:false}),
    ]);
    const error = [assets, deadlines, events].find(r=>r.error)?.error;
    if (error) throw new Error(error.message);
    const ids = (assets.data ?? []).map(a=>a.ip_asset_id);
    const rights = ids.length ? await db.from("project_ip_rights").select("*").in("ip_asset_id", ids) : {data:[],error:null};
    if (rights.error) throw new Error(rights.error.message);
    return { ...base, page, portfolio: { canEdit:false, assets:assets.data??[], deadlines:deadlines.data??[], events:events.data??[], rights:rights.data??[] } as IpPortfolioBundle };
  }
  const [grants, acquisitions, activities, meetings, members] = await Promise.all([
    db.from("project_grants").select("id,grant_name,agency,grant_type,amount_yen,disbursed_yen,status,is_current,adopted_date,period_start_ym,period_end_ym,notes").eq("project_id",projectId).order("is_current",{ascending:false}).order("adopted_date",{ascending:false,nullsFirst:false}),
    db.from("project_bzm_2_2_acquisitions").select("*").eq("project_id",projectId).eq("status","active").order("occurred_on",{ascending:false}).order("created_at",{ascending:false}),
    db.from("member_activities").select("id,member_id,ym,source,title,content_preview,item_date,extracted_at").eq("project_id",projectId).order("item_date",{ascending:false,nullsFirst:false}).limit(400),
    db.from("project_meeting_summaries").select("meeting_id,ym,meeting_date,title,summary_short,decided,source_kinds").eq("project_id",projectId).lte("meeting_date",new Date().toISOString().slice(0,10)).order("meeting_date",{ascending:false}).limit(400),
    db.from("members").select("member_id,code_name"),
  ]);
  const error = [grants,acquisitions,activities,meetings,members].find(r=>r.error)?.error;
  if (error) throw new Error(error.message);
  const names = new Map((members.data??[]).map(r=>[r.member_id,r.code_name||r.member_id]));
  const items = [...(activities.data??[]).map(r=>normalizeActivityRow(r,id=>names.get(id)||id)), ...(meetings.data??[]).filter(r=>r.source_kinds!=="upcoming").map(r=>normalizeMeetingRow(r))].filter((item):item is AmdContributionItem=>item!==null);
  const rows = (acquisitions.data??[]).map(normalizeBzm22AcquisitionRow);
  return { ...base, page:"activity", grants:grants.data as Grant[] ?? [], acquisitions:{projectId,displayOnly:rows.every(r=>r.numericBinding==="display_only"),acquisitions:rows}, contributions:buildAmdContributionsPayload({projectId,items,truncated:(activities.data??[]).length>=400||(meetings.data??[]).length>=400}), showAcquisitions:["su","new_business"].includes(projectFormatTypeOf({projectId,projectCategory:identity.data.project_category})) };
}
