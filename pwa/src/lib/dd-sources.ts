import "server-only";

import { loadDdProjectPage } from "@/lib/dd-project-pages-server";
import { DD_SHARED_PAGE_KEYS, isDdSharedPageKey } from "@/lib/dd-package-core";
import { PROJECT_PAGE_LABELS } from "@/lib/project-formats";
import { Buffer } from "node:buffer";
import { google } from "googleapis";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeDdUnverifiedNotes } from "@/lib/dd-package-core";
import {
  ddCapitalPolicyUnverified,
  ddCostModelUnverified,
  ddFundingPlanUnverified,
  ddTechTopicUnverified,
  shapeDdCapitalPolicy,
  shapeDdCostModel,
  shapeDdDocument,
  shapeDdFundingPlan,
  shapeDdTechTopic,
  type DdItemKind,
  type DdLiveData,
} from "@/lib/dd-payload";
import { resolveFundingPlan, type FundingPlanningDetails } from "@/lib/project-funding-plan";
import type { TechEntry, TechTopic } from "@/lib/project-tech";
import type { CapitalEvent, CapitalPlan, Holder } from "@/lib/capital-plan";
import { loadCostModelBundle } from "@/app/api/project-cost-model/route";
import { getGoogleAuthAsync } from "@/lib/sources/google";
import { loadWorkspaceDocumentText, workspaceDocumentDriveFileId } from "@/lib/workspace-document-text";
import { WORKSPACE_DOCUMENT_FIELDS, type WorkspaceDocumentRow } from "@/lib/workspace-documents-server";

// DDに載せられる元データの一覧と、DDの項目の中身（閲覧のたびに元データの最新から作る）。
// 呼び出し側で権限を確かめてから使う（管理画面・管理 API は requireAdmin、閲覧画面は resolveDdPackageAccess と公開中の確認）。

/** 添付として開ける大きさの上限。Storage の bucket 上限（100MB）と同じ。 */
export const DD_FILE_MAX_BYTES = 100 * 1024 * 1024;
/** HTML の資料をその場で表示する上限（資料室のプレビューと同じ）。 */
export const DD_HTML_INLINE_MAX_BYTES = 5 * 1024 * 1024;
/** Google ドライブの資料を投資家へ渡すための写しの置き場（private）。ドライブの版ごとに置くので同じ実体を二重に置かない。 */
export const DD_FILE_CACHE_BUCKET = "dd-publication-files";

export type DdSourceCandidate = {
  itemKind: DdItemKind;
  sourceKey: string;
  title: string;
  detail: string;
  updatedAt: string | null;
  /** 機密区分など、追加前に確かめてほしい注意。 */
  caution: string | null;
  /** 追加できない理由（元データの形が DD に対応していない等）。 */
  blockedReason: string | null;
  /** 技術台帳の機密区分（confidential は明示の確認なしに追加しない）。 */
  confidentiality?: "public" | "internal" | "confidential";
};

type ItemSourceInput = {
  projectId: string;
  itemKind: DdItemKind;
  sourceKey: string;
};

/** DDの項目1件の、いまの中身。 */
export type DdItemLive = {
  data: DdLiveData;
  /** 元データの更新日時（画面の「元データの更新」）。 */
  sourceAsOf: string | null;
  /** 元データの要確認・未定から自動で拾った未確認事項。 */
  autoUnverified: string[];
};

export class DdSourceError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

function splitSourceKey(sourceKey: string): { prefix: string; id: string } {
  const index = sourceKey.indexOf(":");
  if (index <= 0) throw new DdSourceError("invalid_source_key", "元データの指定が読めない");
  return { prefix: sourceKey.slice(0, index), id: sourceKey.slice(index + 1) };
}

const SOURCE_PREFIX: Record<DdItemKind, string[]> = {
  project_page: ["project_page"],
  document: ["workspace_document"],
  tech_topic: ["project_tech_topic"],
  funding_plan: ["project_funding_plan"],
  capital_policy: ["project_capital_plan", "project_capital_plan_version"],
  cost_model: ["project_cost_model"],
};

export function isSourceKeyForKind(itemKind: DdItemKind, sourceKey: string): boolean {
  try {
    const { prefix, id } = splitSourceKey(sourceKey);
    return (itemKind !== "project_page" || isDdSharedPageKey(id)) && SOURCE_PREFIX[itemKind].includes(prefix) && id.length > 0 && id.length <= 200;
  } catch {
    return false;
  }
}

function maxIso(values: Array<string | null | undefined>): string | null {
  const times = values.filter((value): value is string => Boolean(value)).sort();
  return times.length > 0 ? times[times.length - 1] : null;
}

const GOOGLE_NATIVE_MIME = /^application\/vnd\.google-apps\./;

// --- 候補の一覧 --------------------------------------------------------------------

export async function listDdSourceCandidates(projectId: string): Promise<DdSourceCandidate[]> {
  const db = createAdminClient();
  const [docs, topics, cashflow, plans, versions, costModels] = await Promise.all([
    db
      .from("workspace_documents")
      .select("document_id,entry_kind,visibility,folder_path,display_name,mime_type,file_size_bytes,external_url,source_ref,updated_at")
      .eq("scope_kind", "project")
      .eq("project_id", projectId)
      .eq("upload_status", "active")
      .in("entry_kind", ["file", "link"])
      .order("folder_path")
      .order("display_name"),
    db
      .from("project_tech_topics")
      .select("tech_topic_id,title,tech_domain,block_kind,confidentiality,needs_check,updated_at")
      .eq("project_id", projectId)
      .neq("status", "archived")
      .order("tech_domain")
      .order("sort_order"),
    db
      .from("project_monthly_cashflow")
      .select("ym,updated_at")
      .eq("project_id", projectId)
      .not("planning_details_json", "is", null)
      .order("ym")
      .limit(1),
    db
      .from("project_capital_plans")
      .select("id,name,revision,updated_at")
      .eq("project_id", projectId)
      .eq("status", "active")
      .order("updated_at", { ascending: false }),
    db
      .from("project_capital_plan_versions")
      .select("id,plan_id,version,published_at")
      .eq("project_id", projectId)
      .order("published_at", { ascending: false }),
    db
      .from("project_cost_models")
      .select("cost_model_id,title,case_kind,version_label,updated_at")
      .eq("project_id", projectId)
      .eq("status", "active")
      .order("updated_at", { ascending: false }),
  ]);
  for (const result of [docs, topics, cashflow, plans, versions, costModels]) {
    if (result.error) throw new Error(`dd source list: ${result.error.message}`);
  }

  const candidates: DdSourceCandidate[] = [];

  for (const row of (docs.data ?? []) as Array<Record<string, unknown>>) {
    const entryKind = String(row.entry_kind);
    const mime = String(row.mime_type ?? "");
    const driveId = entryKind === "link"
      ? workspaceDocumentDriveFileId({ source_ref: (row.source_ref as string) ?? null, external_url: (row.external_url as string) ?? null })
      : null;
    const blockedReason = entryKind === "link" && !driveId
      ? "Googleドライブ以外のリンクは、投資家が開けないため追加できない"
      : entryKind === "link" && GOOGLE_NATIVE_MIME.test(mime)
        ? "Googleドキュメント・スプレッドシートは、PDF等に書き出して資料室へ置いてから追加する"
        : null;
    candidates.push({
      itemKind: "document",
      sourceKey: `workspace_document:${row.document_id}`,
      title: String(row.display_name),
      detail: [row.folder_path ? `資料室 / ${row.folder_path}` : "資料室", row.visibility === "amd_internal" ? "社内限定" : "ワークスペース共有", entryKind === "link" ? "ドライブのリンク" : null]
        .filter(Boolean)
        .join("・"),
      updatedAt: (row.updated_at as string) ?? null,
      caution: row.visibility === "amd_internal" ? "資料室では社内限定の資料。DDで開示してよいか確認してから公開する" : null,
      blockedReason,
    });
  }

  for (const row of (topics.data ?? []) as Array<Record<string, unknown>>) {
    const confidentiality = String(row.confidentiality) as "public" | "internal" | "confidential";
    candidates.push({
      itemKind: "tech_topic",
      sourceKey: `project_tech_topic:${row.tech_topic_id}`,
      title: String(row.title),
      detail: [`技術台帳 / ${row.tech_domain ?? "未分類"}`, confidentiality === "public" ? "公開可" : confidentiality === "internal" ? "社内" : "要秘匿", row.needs_check ? "要確認あり" : null]
        .filter(Boolean)
        .join("・"),
      updatedAt: (row.updated_at as string) ?? null,
      caution: confidentiality === "confidential"
        ? "技術台帳で「要秘匿」の項目。追加には開示してよいことの明示の確認が要る"
        : confidentiality === "internal"
          ? "技術台帳で「社内」の項目。DDで開示してよいか確認してから公開する"
          : null,
      blockedReason: null,
      confidentiality,
    });
  }

  if ((cashflow.data ?? []).length > 0) {
    candidates.push({
      itemKind: "funding_plan",
      sourceKey: `project_funding_plan:${projectId}`,
      title: "シードからシリーズAまでの資金計画",
      detail: "試算表タブの資金計画 / 月次の入出金と残高・4ケース",
      updatedAt: null,
      caution: null,
      blockedReason: null,
    });
  }

  for (const row of (plans.data ?? []) as Array<Record<string, unknown>>) {
    candidates.push({
      itemKind: "capital_policy",
      sourceKey: `project_capital_plan:${row.id}`,
      title: String(row.name),
      detail: "資本政策表タブ / 作業中の案（最新を表示する）",
      updatedAt: (row.updated_at as string) ?? null,
      caution: "作業中の案。資本政策表を直すと、DDの表示もそのまま変わる",
      blockedReason: null,
    });
  }
  for (const row of (versions.data ?? []) as Array<Record<string, unknown>>) {
    candidates.push({
      itemKind: "capital_policy",
      sourceKey: `project_capital_plan_version:${row.id}`,
      title: `資本政策（提出版 v${row.version}）`,
      detail: "資本政策表タブ / 凍結済みの提出版",
      updatedAt: (row.published_at as string) ?? null,
      caution: null,
      blockedReason: null,
    });
  }

  for (const row of (costModels.data ?? []) as Array<Record<string, unknown>>) {
    const fuel = row.case_kind === "biodiesel";
    candidates.push({
      itemKind: "cost_model",
      sourceKey: `project_cost_model:${row.cost_model_id}`,
      title: String(row.title),
      detail: `${fuel ? "コスト試算（燃料）タブ" : "コスト試算タブ"}${row.version_label ? ` / ${row.version_label}` : ""}（タブと同じ最新の試算を表示する）`,
      updatedAt: (row.updated_at as string) ?? null,
      caution: "明細・単価・確認事項まで、ワークスペースのコスト試算と同じ中身が見える",
      blockedReason: null,
    });
  }

  candidates.push(...DD_SHARED_PAGE_KEYS.map(page=>({itemKind:"project_page" as const,sourceKey:`project_page:${page}`,title:PROJECT_PAGE_LABELS[page],detail:"他の領域と同じページ。公開中は元データの更新も反映する。",updatedAt:null,caution:"このページ全体が開示対象になる。内容を確認してから公開する。",blockedReason:null})));
  return candidates;
}

// --- 項目の中身（最新） -----------------------------------------------------------

async function loadDocumentRow(db: SupabaseClient, projectId: string, documentId: string): Promise<WorkspaceDocumentRow> {
  const { data, error } = await db
    .from("workspace_documents")
    .select(WORKSPACE_DOCUMENT_FIELDS)
    .eq("document_id", documentId)
    .maybeSingle();
  if (error) throw new Error(`dd document lookup: ${error.message}`);
  const row = data as unknown as WorkspaceDocumentRow | null;
  if (!row || row.scope_kind !== "project" || row.project_id !== projectId || row.upload_status !== "active") {
    throw new DdSourceError("source_not_found", "元の資料が見つからない（削除・移動された可能性がある）");
  }
  if (row.entry_kind !== "file" && row.entry_kind !== "link") {
    throw new DdSourceError("unsupported_source", "フォルダはDDに載せられない");
  }
  return row;
}

function toCapitalPlan(row: { id: string; name: string; document_json: unknown }): CapitalPlan {
  const doc = row.document_json && typeof row.document_json === "object" && !Array.isArray(row.document_json)
    ? (row.document_json as Record<string, unknown>)
    : {};
  return {
    id: row.id,
    name: row.name,
    holders: Array.isArray(doc.holders) ? (doc.holders as Holder[]) : [],
    events: Array.isArray(doc.events) ? (doc.events as CapitalEvent[]) : [],
  };
}

/**
 * DDの項目1件の、いまの中身を元データから作る。公開した時点で固定しない（閲覧のたびに最新）。
 * 中身はワークスペースの同じタブと同じ（部品が表示しない社内の値だけは dd-payload の shape* が外す）。
 */
export async function loadDdItemLive(input: ItemSourceInput): Promise<DdItemLive> {
  const db = createAdminClient();
  const { prefix, id } = splitSourceKey(input.sourceKey);
  if (!isSourceKeyForKind(input.itemKind, input.sourceKey)) {
    throw new DdSourceError("invalid_source_key", "元データの種類と指定が合わない");
  }

  if (input.itemKind === "project_page") {
    const data = await loadDdProjectPage(input.projectId, id);
    return {data,sourceAsOf:data.page === "business-plan" ? data.plan?.updatedAt ?? null : null,autoUnverified:[]};
  }

  if (input.itemKind === "document") {
    const row = await loadDocumentRow(db, input.projectId, id);
    return {
      data: shapeDdDocument({ fileName: row.display_name, mimeType: row.mime_type, sizeBytes: row.file_size_bytes }),
      sourceAsOf: row.updated_at,
      autoUnverified: [],
    };
  }

  if (input.itemKind === "tech_topic") {
    const [{ data: topic, error: topicError }, { data: entries, error: entryError }] = await Promise.all([
      db.from("project_tech_topics").select("*").eq("tech_topic_id", id).eq("project_id", input.projectId).maybeSingle(),
      db.from("project_tech_entries").select("*").eq("tech_topic_id", id).eq("project_id", input.projectId),
    ]);
    if (topicError) throw new Error(`dd tech topic lookup: ${topicError.message}`);
    if (entryError) throw new Error(`dd tech entry lookup: ${entryError.message}`);
    const topicRow = topic as TechTopic | null;
    if (!topicRow || topicRow.status === "archived") throw new DdSourceError("source_not_found", "技術台帳のページが見つからない");
    const entryRows = (entries ?? []) as TechEntry[];
    const data = shapeDdTechTopic(input.projectId, topicRow, entryRows);
    return {
      data,
      sourceAsOf: maxIso([topicRow.updated_at, ...entryRows.map((entry) => entry.updated_at)]),
      autoUnverified: ddTechTopicUnverified(data),
    };
  }

  if (input.itemKind === "funding_plan") {
    if (id !== input.projectId) throw new DdSourceError("invalid_source_key", "別PJの資金計画は指定できない");
    const rows: Array<{ ym: string; planning_details_json: FundingPlanningDetails | null; updated_at: string | null }> = [];
    for (let from = 0; ; from += 500) {
      const { data, error } = await db
        .from("project_monthly_cashflow")
        .select("ym,planning_details_json,updated_at")
        .eq("project_id", input.projectId)
        .not("planning_details_json", "is", null)
        .order("ym")
        .range(from, from + 499);
      if (error) throw new Error(`dd funding plan lookup: ${error.message}`);
      rows.push(...((data ?? []) as typeof rows));
      if ((data?.length ?? 0) < 500) break;
    }
    const plan = resolveFundingPlan(rows);
    if (!plan) throw new DdSourceError("source_not_found", "資金計画が登録されていない");
    const data = shapeDdFundingPlan(plan);
    const used = rows.filter((row) => plan.months.some((month) => month.ym === row.ym));
    return {
      data,
      sourceAsOf: maxIso(used.map((row) => row.updated_at)) ?? plan.summary.asOf,
      autoUnverified: ddFundingPlanUnverified(data),
    };
  }

  if (input.itemKind === "capital_policy") {
    if (prefix === "project_capital_plan") {
      const { data, error } = await db
        .from("project_capital_plans")
        .select("id,project_id,name,status,revision,document_json,updated_at")
        .eq("id", id)
        .maybeSingle();
      if (error) throw new Error(`dd capital plan lookup: ${error.message}`);
      if (!data || data.project_id !== input.projectId || data.status !== "active") {
        throw new DdSourceError("source_not_found", "資本政策の作業中の案が見つからない");
      }
      const live = shapeDdCapitalPolicy(toCapitalPlan(data), { basis: "working", planRevision: Number(data.revision), frozenVersion: null });
      return { data: live, sourceAsOf: String(data.updated_at), autoUnverified: ddCapitalPolicyUnverified(live) };
    }
    const { data, error } = await db
      .from("project_capital_plan_versions")
      .select("id,plan_id,project_id,version,source_revision,document_json,published_at")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(`dd capital plan version lookup: ${error.message}`);
    if (!data || data.project_id !== input.projectId) throw new DdSourceError("source_not_found", "資本政策の提出版が見つからない");
    const { data: planRow } = await db.from("project_capital_plans").select("name").eq("id", data.plan_id).maybeSingle();
    const live = shapeDdCapitalPolicy(
      toCapitalPlan({ id: String(data.plan_id), name: String(planRow?.name ?? "資本政策"), document_json: data.document_json }),
      { basis: "frozen", planRevision: Number(data.source_revision), frozenVersion: Number(data.version) },
    );
    return { data: live, sourceAsOf: String(data.published_at), autoUnverified: ddCapitalPolicyUnverified(live) };
  }

  // cost_model: 指定した試算の種類（廃液 / 燃料）について、ワークスペースのコスト試算タブと同じ「いまの試算」を出す。
  const { data: model, error: modelError } = await db
    .from("project_cost_models")
    .select("cost_model_id,project_id,case_kind")
    .eq("cost_model_id", id)
    .eq("project_id", input.projectId)
    .maybeSingle();
  if (modelError) throw new Error(`dd cost model lookup: ${modelError.message}`);
  if (!model) throw new DdSourceError("source_not_found", "コスト試算が見つからない");
  const costKind = model.case_kind === "biodiesel" ? "fuel" : "default";
  const bundle = await loadCostModelBundle(input.projectId, costKind);
  if (!bundle) throw new DdSourceError("source_not_found", "コスト試算が登録されていない");
  return {
    data: shapeDdCostModel(input.projectId, costKind, bundle),
    sourceAsOf: bundle.model.updatedAt,
    autoUnverified: ddCostModelUnverified(bundle),
  };
}

/** 表示する未確認事項 = 管理者が書いた分 + 元データから自動で拾った分（autoUnverified=false の項目は管理者の分だけ）。 */
export function mergeDdUnverifiedNotes(adminNotes: unknown, autoNotes: string[], includeAuto: boolean): string[] {
  const merged = [...normalizeDdUnverifiedNotes(adminNotes), ...(includeAuto ? normalizeDdUnverifiedNotes(autoNotes) : [])];
  return Array.from(new Set(merged)).slice(0, 60);
}

// --- 資料の実体（最新）を渡す ---------------------------------------------------------

export type DdDocumentDelivery =
  | { mode: "html"; html: string; fileName: string }
  | { mode: "signed_url"; url: string; fileName: string; mimeType: string }
  | { mode: "error"; status: number; message: string };

/**
 * 資料の最新の実体を渡す。HTML は本文をその場で返し（呼び出し側がサンドボックスの CSP を付ける）、
 * それ以外は60秒の署名URL。Google ドライブの資料は、投資家がドライブを開けないので、
 * ドライブの版（md5）ごとの置き場へ写してから署名URLを出す（同じ版なら写しを使い回す）。
 */
export async function deliverDdDocument(input: {
  projectId: string;
  sourceKey: string;
  packageId: string;
  download: boolean;
}): Promise<DdDocumentDelivery> {
  const db = createAdminClient();
  const { id } = splitSourceKey(input.sourceKey);
  const row = await loadDocumentRow(db, input.projectId, id);
  const isHtml = shapeDdDocument({ fileName: row.display_name, mimeType: row.mime_type, sizeBytes: row.file_size_bytes }).preview === "html";

  if (isHtml && !input.download) {
    const loaded = await loadWorkspaceDocumentText(db, row, DD_HTML_INLINE_MAX_BYTES);
    if (!loaded.ok) return { mode: "error", status: loaded.status, message: loaded.error };
    return { mode: "html", html: loaded.text, fileName: row.display_name };
  }

  const signOptions = input.download ? { download: row.display_name } : undefined;
  if (row.entry_kind === "file") {
    if (!row.storage_bucket || !row.storage_path) return { mode: "error", status: 500, message: "資料の保存先を確認できない" };
    const { data, error } = await db.storage.from(row.storage_bucket).createSignedUrl(row.storage_path, 60, signOptions);
    if (error || !data?.signedUrl) return { mode: "error", status: 500, message: "資料を開けない" };
    return { mode: "signed_url", url: data.signedUrl, fileName: row.display_name, mimeType: row.mime_type };
  }

  const fileId = workspaceDocumentDriveFileId(row);
  if (!fileId) return { mode: "error", status: 400, message: "Googleドライブ以外のリンクは開けない" };
  const auth = await getGoogleAuthAsync();
  if (!auth) return { mode: "error", status: 500, message: "Googleドライブへ接続できない" };
  const drive = google.drive({ version: "v3", auth });
  const metadata = await drive.files.get({ fileId, fields: "id,name,mimeType,size,md5Checksum,modifiedTime", supportsAllDrives: true });
  const mimeType = metadata.data.mimeType ?? row.mime_type;
  if (GOOGLE_NATIVE_MIME.test(mimeType)) return { mode: "error", status: 400, message: "Googleドキュメント等は、PDF等に書き出して資料室へ置く" };
  if (Number(metadata.data.size || 0) > DD_FILE_MAX_BYTES) return { mode: "error", status: 413, message: "100MBを超える資料は開けない" };

  // 同じ版（ドライブの md5）の写しがあれば使い回す。無ければ実体を読んで写す。
  const versionTag = (metadata.data.md5Checksum ?? metadata.data.modifiedTime ?? "latest").replace(/[^A-Za-z0-9._-]/g, "_");
  const copyPath = `cache/${input.packageId}/${row.document_id}/${versionTag}`;
  const existing = await db.storage.from(DD_FILE_CACHE_BUCKET).createSignedUrl(copyPath, 60, signOptions);
  if (!existing.error && existing.data?.signedUrl) {
    return { mode: "signed_url", url: existing.data.signedUrl, fileName: row.display_name, mimeType };
  }
  const media = await drive.files.get({ fileId, alt: "media", supportsAllDrives: true }, { responseType: "arraybuffer" });
  const bytes = Buffer.from(media.data as ArrayBuffer);
  if (bytes.byteLength > DD_FILE_MAX_BYTES) return { mode: "error", status: 413, message: "100MBを超える資料は開けない" };
  const upload = await db.storage.from(DD_FILE_CACHE_BUCKET).upload(copyPath, bytes, { contentType: mimeType, upsert: false });
  if (upload.error && !/exists|duplicate/i.test(upload.error.message)) {
    return { mode: "error", status: 500, message: "資料の写しを置けない" };
  }
  const signed = await db.storage.from(DD_FILE_CACHE_BUCKET).createSignedUrl(copyPath, 60, signOptions);
  if (signed.error || !signed.data?.signedUrl) return { mode: "error", status: 500, message: "資料を開けない" };
  return { mode: "signed_url", url: signed.data.signedUrl, fileName: row.display_name, mimeType };
}
