import {loadProjectBusinessSummary} from "@/lib/project-business-summary-server";
import { loadProjectManagementMinutes } from "@/lib/project-management-minutes-server";
import { loadProjectManagementBiographies } from "@/lib/project-management-biographies-server";
import { loadProjectProductDescription } from "@/lib/project-product-description-server";
import { loadProjectFoundingBackground } from "@/lib/project-founding-background-server";
import { loadProjectOrganizationChart } from "@/lib/project-organization-chart-server";
import { loadProjectGovernance } from "@/lib/project-governance-server";
import "server-only";
import { redactProjectPartnerNames } from "@/lib/project-partner-disclosure";
import { loadProjectPartnerDisclosure } from "@/lib/project-partner-disclosure-server";
import { loadProjectMarketResearch } from "@/lib/project-market-research-server";
import { loadShortTermPlanHtml, loadLongTermPlanHtml } from "@/lib/project-short-term-plan-server";
import { loadProjectTechnicalEvidence } from "@/lib/project-technical-evidence-server";
import { loadProjectDevelopmentIssues } from "@/lib/project-development-issues-server";
import { loadProjectContractList } from "@/lib/project-contract-list-server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildDagHealth } from "@/lib/project-management-logic";
import { getQuestionTreeBundle } from "@/lib/question-tree";
import { getSxManagementBundle, computeSxJudgment } from "@/lib/sx-management";
import { loadProjectBusinessPlan } from "@/lib/project-business-plan-server";
import { normalizeBzm22AcquisitionRow } from "@/lib/bzm-2-2-acquisitions";
import { buildAmdContributionsPayload, normalizeActivityRow, normalizeMeetingRow, type AmdContributionItem } from "@/lib/amd-contributions";
import { projectFormatTypeOf } from "@/lib/project-formats";
import { DD_PAGE_KEYS, isDdEmptyPageKey } from "@/lib/dd-pages";
import { loadProjectPocList } from "@/lib/project-poc-list-server";
import { loadProjectTechData } from "@/lib/project-tech-server";
import { loadProjectFinancePage } from "@/lib/project-finance-page-server";
import { loadCapitalPlanPage } from "@/lib/project-capital-plan-server";
import { loadCostModelBundle } from "@/app/api/project-cost-model/route";
import type { DdLiveProjectPage } from "@/lib/dd-project-page-types";
import type { IpPortfolioBundle } from "@/components/cockpit/CockpitIpPortfolio";
import type { Grant } from "@/components/cockpit/CockpitGrants";
import { createDdReferenceCache } from "@/lib/dd-reference-cache";


// 外部の既存開示範囲。どの入口から開いても本人の資格だけで決まる。
function ddOnlyPartnerRecords(all:Awaited<ReturnType<typeof getSxManagementBundle>>){
 return {...all,horizonMonths:[],objectives:[],objective:null,outcomes:[],kpis:[],dependencies:[],scheduleDependencies:[],
 dag:buildDagHealth([],[],all.asOf),judgment:computeSxJudgment([],[],[],all.asOf),
 tracks:[],issues:[],hypotheses:[],evidence:[],validationRuns:[],decisions:[],actions:[],tasks:[],
 partnerInteractions:[],partnerRoles:[],technicalTests:[],fundingSnapshots:[],organizationRoles:[],raci:[],capacity:[],history:[],fieldAudit:[],canManage:false};
}
// 開示選択・共有済み判定・資料の有効状態が関わる本文は毎回読む。
const uncachedPages = new Set(["poc-list", "technology", "competition", "business-model", "technical-evidence", "contracts", "governance", "partners", "activity", "gantt", "short-term-plan", "long-term-plan"]);

import type {ProjectPageActor} from "@/lib/project-page-actor";
export async function loadProjectPageRecord(projectId:string,page:string,actor:Pick<ProjectPageActor,"external"|"canEditRecords"|"disclosures"|"memberId">):Promise<DdLiveProjectPage>{
  const db = createAdminClient();
  const identity = await db.from("projects").select("project_name,display_name,project_category").eq("project_id", projectId).single();
  if (identity.error) throw new Error(identity.error.message);
  const base = { kind: "project_page" as const, projectId, projectName: identity.data.display_name || identity.data.project_name };
  if(page==='poc-list'){
    const audiences=actor.external?[...(actor.disclosures.workspace?['shared' as const]:[]),...(actor.disclosures.dd?['dd' as const]:[])]:['internal' as const];
    const rows=await Promise.all(audiences.map(a=>loadProjectPocList(db,projectId,a,actor.canEditRecords)));
    const poc=rows[0];if(!poc)throw new Error('閲覧範囲がない');
    return {...base,page,poc:{...poc,topics:[...new Map(rows.flatMap(r=>r.topics).map(r=>[r.tech_topic_id,r])).values()],entries:[...new Map(rows.flatMap(r=>r.entries).map(r=>[r.tech_entry_id,r])).values()]}};
  }
  if (page === "technical-evidence") return { ...base, page, empty: true, technicalEvidence: await loadProjectTechnicalEvidence(db, projectId) };
  if (page === "development-issues") return { ...base, page, issues: await loadProjectDevelopmentIssues(db, projectId) };
  if (page === "market-research") return { ...base, page, empty: true, marketResearch: await loadProjectMarketResearch(db, projectId) };
  if (page === "contracts") return { ...base, page, contracts: await loadProjectContractList(db, projectId, actor.external, actor.canEditRecords) };
  if (page === "team") return { ...base, page, empty: true, biographies: await loadProjectManagementBiographies(db, projectId) };
  if (page === "product-description") return { ...base, page, empty: true, productDescription: await loadProjectProductDescription(db, projectId) };
  if (page === "founding-background") return { ...base, page, empty: true, foundingBackground: await loadProjectFoundingBackground(db, projectId) };
  if (page === "governance") return { ...base, page, empty: true, managementMinutes: await loadProjectManagementMinutes(db, projectId, actor.external) };
  if (isDdEmptyPageKey(page)) return { ...base, page, empty: true, ...(page === "organization-chart" ? { organizationChart: await loadProjectOrganizationChart(db, projectId) } : {}) };
  if (page === "technology" || page === "competition" || page === "business-model") return { ...base, page, tech: await loadProjectTechData(db, projectId, actor.canEditRecords, actor.external ? "shared" : "internal", page) };
  if (page === "financial-projection" || page === "monthly-trial") return { ...base, page, finance: await loadProjectFinancePage(db, projectId) };
  if (page === "capital-plan" || page === "next-round-overview") return { ...base, page, capital: await loadCapitalPlanPage(db, projectId) };
  if (page === "cost-model") {
    const [main, fuel] = await Promise.all([loadCostModelBundle(projectId, "default"), loadCostModelBundle(projectId, "fuel")]);
    return { ...base, page, costs: { main: { canEdit: actor.canEditRecords, bundle: main }, fuel: { canEdit: actor.canEditRecords, bundle: fuel } } };
  }
  if (page === "short-term-plan") {
    const html = await loadShortTermPlanHtml(db, projectId);
    return { ...base, page, available: Boolean(html), html };
  }
  if (page === "gantt") return { ...base, page, tree: await getQuestionTreeBundle(projectId, actor.canEditRecords, false) };
  if(page==="partners"){
    const all=await getSxManagementBundle(projectId,actor.canEditRecords);
    const management=actor.external&&!actor.disclosures.workspace?ddOnlyPartnerRecords(all):all;
    return {...base,page,management:actor.external?redactProjectPartnerNames(management,management.partners):management};
  }
  if (page === "long-term-plan") {
    const html = await loadLongTermPlanHtml(db, projectId);
    return { ...base, page, available: Boolean(html), html, plan: html ? null : await loadProjectBusinessPlan(projectId) };
  }
  if (page === "business-plan") return { ...base, page, plan: await loadProjectBusinessPlan(projectId) };
  if (page === "company" || page === "capital-policy") {
    const canReadBusiness=!actor.external||Boolean(actor.memberId)||actor.disclosures.workspace;
    const [governance,business]=await Promise.all([
      loadProjectGovernance(db,projectId),
      page==="company"&&canReadBusiness?loadProjectBusinessSummary(db,projectId):Promise.resolve(null),
    ]);
    return {...base,page,governance,businessSummary:{ok:true,business,viewer:{canEdit:actor.canEditRecords}}};
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
    return { ...base, page, portfolio: { canEdit:actor.canEditRecords, assets:assets.data??[], deadlines:deadlines.data??[], events:events.data??[], rights:rights.data??[] } as IpPortfolioBundle };
  }
  if(page!=='activity')throw new Error('管理記録が登録されていない');
  const activityQuery=db.from('member_activities').select('id,member_id,ym,source,title,content_preview,item_date,extracted_at').eq('project_id',projectId);
  const meetingQuery=db.from('project_meeting_summaries').select('meeting_id,ym,meeting_date,title,summary_short,decided,source_kinds').eq('project_id',projectId);
  if(actor.external){activityQuery.eq('workspace_shared',true);meetingQuery.eq('workspace_shared',true);}
  const grantsQuery = actor.external
    ? db.from("project_grants").select("id,grant_name,agency,grant_type,amount_yen,disbursed_yen,status,is_current,adopted_date,period_start_ym,period_end_ym")
    : db.from("project_grants").select("id,grant_name,agency,grant_type,amount_yen,disbursed_yen,status,is_current,adopted_date,period_start_ym,period_end_ym,notes,attachments_json");
  const [grants, acquisitions, activities, meetings, members] = await Promise.all([
    grantsQuery.eq("project_id",projectId).order("is_current",{ascending:false}).order("adopted_date",{ascending:false,nullsFirst:false}),
    db.from("project_bzm_2_2_acquisitions").select("*").eq("project_id",projectId).eq("status","active").order("occurred_on",{ascending:false}).order("created_at",{ascending:false}),
    activityQuery.order("item_date",{ascending:false,nullsFirst:false}).limit(400),
    meetingQuery.lte("meeting_date",new Date().toISOString().slice(0,10)).order("meeting_date",{ascending:false}).limit(400),
    db.from("members").select("member_id,code_name"),
  ]);
  const error = [grants,acquisitions,activities,meetings,members].find(r=>r.error)?.error;
  if (error) throw new Error(error.message);
  const names = new Map((members.data??[]).map(r=>[r.member_id,r.code_name||r.member_id]));
  const items = [...(activities.data??[]).map(r=>normalizeActivityRow(r,id=>names.get(id)||id)), ...(meetings.data??[]).filter(r=>r.source_kinds!=="upcoming").map(r=>normalizeMeetingRow(r))].filter((item):item is AmdContributionItem=>item!==null);
  const rows = (acquisitions.data??[]).map(normalizeBzm22AcquisitionRow);
  return { ...base, page:"activity", grants:(grants.data ?? []).map(row=>({...row,notes:!actor.external&&"notes" in row?row.notes??null:null})) as Grant[], acquisitions:{projectId,displayOnly:rows.every(r=>r.numericBinding==="display_only"),acquisitions:rows}, contributions:buildAmdContributionsPayload({projectId,items,truncated:(activities.data??[]).length>=400||(meetings.data??[]).length>=400}), showAcquisitions:["su","new_business"].includes(projectFormatTypeOf({projectId,projectCategory:identity.data.project_category})) };
}
