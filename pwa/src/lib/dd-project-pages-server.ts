import "server-only";
import { createAdminClient } from "./supabase/admin";
import { buildDagHealth } from "./project-management-logic";
import { getQuestionTreeBundle } from "./question-tree";
import { getSxManagementBundle, computeSxJudgment } from "./sx-management";
import { loadProjectBusinessPlan } from "./project-business-plan-server";
import { normalizeBzm22AcquisitionRow } from "./bzm-2-2-acquisitions";
import { buildAmdContributionsPayload, normalizeActivityRow, normalizeMeetingRow, type AmdContributionItem } from "./amd-contributions";
import { projectFormatTypeOf } from "./project-formats";
import { isDdSharedPageKey } from "./dd-package-core";
import type { DdLiveProjectPage } from "./dd-project-page-types";
import type { CompanyOverviewData } from "./company-overview";
import type { IpPortfolioBundle } from "@/components/cockpit/CockpitIpPortfolio";
import type { Grant } from "@/components/cockpit/CockpitGrants";

/** 呼び出す前にDDの付与と項目の公開を確認する。汎用APIの権限をDDへ広げない。 */
export async function loadDdProjectPage(projectId: string, page: string): Promise<DdLiveProjectPage> {
  if (!isDdSharedPageKey(page)) throw new Error("Unsupported DD page");
  const db = createAdminClient();
  const identity = await db.from("projects").select("project_name,display_name,project_category").eq("project_id", projectId).single();
  if (identity.error) throw new Error(identity.error.message);
  const base = { kind: "project_page" as const, projectId, projectName: identity.data.display_name || identity.data.project_name };
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
    const [profile, shareholders, transactions, convertibles, rounds] = await Promise.all([
      page === "company" ? db.from("project_company_profiles").select("id,project_id,legal_status,legal_name,legal_name_en,corporate_number,entity_type,incorporated_on,head_office,business_purpose,representative_name,capital_yen,authorized_shares,registered_issued_shares,board_structure,has_board,has_auditor,fiscal_year_end_month,public_notice_method,invoice_registration_number,source_ref,source_verified_on").eq("project_id", projectId).maybeSingle() : Promise.resolve({ data: null, error: null }),
      db.from("project_shareholders").select("id,holder_type,holder_name,share_class,shares,ownership_pct,invested_yen,as_of_ym,is_current").eq("project_id", projectId).order("holder_type"),
      db.from("project_equity_transactions").select("id,project_id,round_id,effective_on,transaction_type,description,status,source_ref,notes,project_equity_entries(id,holder_type,holder_name,security_class,outstanding_delta,diluted_delta,paid_in_yen_delta)").eq("project_id", projectId).order("effective_on").order("created_at"),
      db.from("project_convertible_instruments").select("id,holder_name,instrument_type,issued_on,principal_yen,valuation_cap_yen,discount_rate,conversion_trigger,maturity_on,estimated_conversion_price,estimated_conversion_shares,status,notes").eq("project_id", projectId).order("issued_on", {ascending:false,nullsFirst:false}),
      db.from("project_valuation_rounds").select("id,round_name,round_date,round_ym,pre_money_yen,post_money_yen,raised_yen,price_per_share_yen,lead_investor,source_ref,notes").eq("project_id", projectId).order("round_date", {ascending:false,nullsFirst:false}),
    ]);
    const error = [profile, shareholders, transactions, convertibles, rounds].find(r=>r.error)?.error;
    if (error) throw new Error(error.message);
    const governance = { profile: profile.data, shareholders: shareholders.data ?? [], transactions: transactions.data ?? [], convertibles: convertibles.data ?? [], rounds: rounds.data ?? [], financialPeriods: [], meetings: [], actionItems: [] } as CompanyOverviewData;
    return { ...base, page, governance };
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
