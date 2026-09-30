import "server-only";

import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { google } from "googleapis";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { canonicalJson, normalizeDdUnverifiedNotes, readDdIncludedParts, type DdPart } from "@/lib/dd-package-core";
import {
  ddCapitalPolicyUnverified,
  ddCostModelUnverified,
  ddFundingPlanUnverified,
  ddTechTopicUnverified,
  listDdCostModelParts,
  listDdFundingPlanParts,
  listDdTechTopicParts,
  projectDdCapitalPolicy,
  projectDdCostModel,
  projectDdDocument,
  projectDdFundingPlan,
  projectDdTechTopic,
  type DdItemKind,
  type DdSourceRef,
} from "@/lib/dd-payload";
import { resolveFundingPlan, type FundingPlanningDetails } from "@/lib/project-funding-plan";
import type { TechEntry, TechTopic } from "@/lib/project-tech";
import type { CapitalEvent, CapitalPlan, Holder } from "@/lib/capital-plan";
import { mapBundle } from "@/app/api/project-cost-model/route";
import { getGoogleAuthAsync } from "@/lib/sources/google";
import { workspaceDocumentDriveFileId } from "@/lib/workspace-document-text";
import { WORKSPACE_DOCUMENT_FIELDS, type WorkspaceDocumentRow } from "@/lib/workspace-documents-server";

// DDに載せられる元データの一覧と、公開版の下書き（payload / 元データの参照 / 自動の未確認事項 / 添付の実体）を作る。
// 呼び出せるのは AMD admin の管理画面と公開 API だけ（呼び出し側で requireAdmin 済み）。外部アカウントの経路からは呼ばない。

/** 公開版に複製する添付の上限。Storage の bucket 上限（100MB）と同じ。 */
export const DD_FILE_MAX_BYTES = 100 * 1024 * 1024;

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
  sourceOptions: Record<string, unknown>;
};

export type DdPublicationDraft = {
  payload: Record<string, unknown>;
  sourceRefs: DdSourceRef[];
  sourceAsOf: string | null;
  autoUnverified: string[];
  file: { bytes: Buffer; name: string; mimeType: string; sha256: string } | null;
  /** 管理画面の選択肢（資本政策のラウンド一覧、載せる範囲の候補）。公開版には入らない。 */
  optionChoices?: { capitalEvents?: Array<{ id: string; label: string }>; parts?: DdPart[] };
};

export class DdSourceError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

function sha256Hex(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function splitSourceKey(sourceKey: string): { prefix: string; id: string } {
  const index = sourceKey.indexOf(":");
  if (index <= 0) throw new DdSourceError("invalid_source_key", "元データの指定が読めない");
  return { prefix: sourceKey.slice(0, index), id: sourceKey.slice(index + 1) };
}

const SOURCE_PREFIX: Record<DdItemKind, string[]> = {
  document: ["workspace_document"],
  tech_topic: ["project_tech_topic"],
  funding_plan: ["project_funding_plan"],
  capital_policy: ["project_capital_plan", "project_capital_plan_version"],
  cost_model: ["project_cost_model"],
};

export function isSourceKeyForKind(itemKind: DdItemKind, sourceKey: string): boolean {
  try {
    const { prefix, id } = splitSourceKey(sourceKey);
    return SOURCE_PREFIX[itemKind].includes(prefix) && id.length > 0 && id.length <= 200;
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
      ? "Googleドライブ以外のリンクは実体を固定できないため追加できない"
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
      detail: "試算表 / 月次の入出金と残高・4ケース",
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
      detail: `資本政策表 / 作業中の案（第${row.revision}版）`,
      updatedAt: (row.updated_at as string) ?? null,
      caution: "作業中の案。公開すると、その時点の版を固定して見せる",
      blockedReason: null,
    });
  }
  for (const row of (versions.data ?? []) as Array<Record<string, unknown>>) {
    candidates.push({
      itemKind: "capital_policy",
      sourceKey: `project_capital_plan_version:${row.id}`,
      title: `資本政策（提出版 v${row.version}）`,
      detail: "資本政策表 / 凍結済みの提出版",
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
      detail: `コスト試算${row.version_label ? ` / ${row.version_label}` : ""}`,
      updatedAt: (row.updated_at as string) ?? null,
      caution: null,
      blockedReason: fuel ? "燃料の試算は計算の形が違うため、まだDDに対応していない" : null,
    });
  }

  return candidates;
}

// --- 公開版の下書き --------------------------------------------------------------

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

async function downloadDocumentBytes(
  db: SupabaseClient,
  row: WorkspaceDocumentRow,
): Promise<{ bytes: Buffer; name: string; mimeType: string }> {
  if (row.entry_kind === "file") {
    if (!row.storage_bucket || !row.storage_path) throw new DdSourceError("source_unavailable", "資料の保存先を確認できない");
    if (row.file_size_bytes > DD_FILE_MAX_BYTES) throw new DdSourceError("file_too_large", "100MBを超える資料は載せられない");
    const { data, error } = await db.storage.from(row.storage_bucket).download(row.storage_path);
    if (error || !data) throw new DdSourceError("source_unavailable", "資料の実体を読み込めない");
    const bytes = Buffer.from(await data.arrayBuffer());
    return { bytes, name: row.display_name, mimeType: row.mime_type };
  }

  const fileId = workspaceDocumentDriveFileId(row);
  if (!fileId) throw new DdSourceError("unsupported_source", "Googleドライブ以外のリンクは実体を固定できない");
  const auth = await getGoogleAuthAsync();
  if (!auth) throw new DdSourceError("source_unavailable", "Googleドライブへ接続できない");
  const drive = google.drive({ version: "v3", auth });
  const metadata = await drive.files.get({ fileId, fields: "id,name,mimeType,size", supportsAllDrives: true });
  const mimeType = metadata.data.mimeType ?? row.mime_type;
  if (GOOGLE_NATIVE_MIME.test(mimeType)) {
    throw new DdSourceError("unsupported_source", "Googleドキュメント・スプレッドシートは、PDF等に書き出して資料室へ置いてから追加する");
  }
  if (Number(metadata.data.size || 0) > DD_FILE_MAX_BYTES) throw new DdSourceError("file_too_large", "100MBを超える資料は載せられない");
  const media = await drive.files.get({ fileId, alt: "media", supportsAllDrives: true }, { responseType: "arraybuffer" });
  const bytes = Buffer.from(media.data as ArrayBuffer);
  if (bytes.byteLength > DD_FILE_MAX_BYTES) throw new DdSourceError("file_too_large", "100MBを超える資料は載せられない");
  return { bytes, name: row.display_name || metadata.data.name || "資料", mimeType };
}

function capitalEventChoices(plan: CapitalPlan): Array<{ id: string; label: string }> {
  return [...plan.events].sort((a, b) => a.order - b.order).map((event) => ({ id: event.id, label: event.label }));
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
 * 公開版の下書きを作る。withFile=false のときは添付の実体を読まない（管理画面の「元データが公開後に変わったか」の判定用）。
 * 添付の変化は、資料室の content_sha256 / 更新日時 / サイズで判定する。
 */
export async function buildDdPublicationDraft(
  input: ItemSourceInput,
  options: { withFile: boolean } = { withFile: true },
): Promise<DdPublicationDraft> {
  const db = createAdminClient();
  const { prefix, id } = splitSourceKey(input.sourceKey);
  // 載せる範囲（管理者が選んだ節・行）。未選択なら null で、元データの節・行をすべて写す。
  const included = readDdIncludedParts(input.sourceOptions);
  if (!isSourceKeyForKind(input.itemKind, input.sourceKey)) {
    throw new DdSourceError("invalid_source_key", "元データの種類と指定が合わない");
  }

  if (input.itemKind === "document") {
    const row = await loadDocumentRow(db, input.projectId, id);
    const sourceRef: DdSourceRef = {
      table: "workspace_documents",
      id: row.document_id,
      updatedAt: row.updated_at,
      sha256: row.content_sha256,
      version: `${row.entry_kind}:${row.file_size_bytes}`,
    };
    if (!options.withFile) {
      return {
        payload: projectDdDocument({ fileName: row.display_name, mimeType: row.mime_type, sizeBytes: row.file_size_bytes }),
        sourceRefs: [sourceRef],
        sourceAsOf: row.updated_at,
        autoUnverified: [],
        file: null,
      };
    }
    const downloaded = await downloadDocumentBytes(db, row);
    const sha256 = sha256Hex(downloaded.bytes);
    return {
      payload: projectDdDocument({ fileName: downloaded.name, mimeType: downloaded.mimeType, sizeBytes: downloaded.bytes.byteLength }),
      sourceRefs: [{ ...sourceRef, sha256 }],
      sourceAsOf: row.updated_at,
      autoUnverified: [],
      file: { bytes: downloaded.bytes, name: downloaded.name, mimeType: downloaded.mimeType, sha256 },
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
    const payload = projectDdTechTopic(topicRow, entryRows, included);
    return {
      payload,
      sourceRefs: [{
        table: "project_tech_topics",
        id: topicRow.tech_topic_id,
        updatedAt: maxIso([topicRow.updated_at, ...entryRows.map((entry) => entry.updated_at)]),
        sha256: sha256Hex(canonicalJson({ topic: topicRow, entries: entryRows })),
      }],
      sourceAsOf: maxIso([topicRow.updated_at, ...entryRows.map((entry) => entry.updated_at)]),
      autoUnverified: ddTechTopicUnverified(payload),
      file: null,
      optionChoices: { parts: listDdTechTopicParts(topicRow, entryRows) },
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
    const used = rows.filter((row) => plan.months.some((month) => month.ym === row.ym));
    const payload = projectDdFundingPlan(plan, included);
    return {
      payload,
      sourceRefs: [{
        table: "project_monthly_cashflow",
        id: `${input.projectId}:${plan.summary.startYm}..${plan.summary.endYm}`,
        version: plan.summary.version,
        updatedAt: maxIso(used.map((row) => row.updated_at)),
        sha256: sha256Hex(canonicalJson(used.map((row) => ({ ym: row.ym, planning_details_json: row.planning_details_json })))),
      }],
      sourceAsOf: plan.summary.asOf,
      autoUnverified: ddFundingPlanUnverified(payload),
      file: null,
      optionChoices: { parts: listDdFundingPlanParts(plan) },
    };
  }

  if (input.itemKind === "capital_policy") {
    const lastEventId = typeof input.sourceOptions.lastEventId === "string" ? input.sourceOptions.lastEventId : null;
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
      const plan = toCapitalPlan(data);
      const payload = projectDdCapitalPolicy(
        plan,
        { basis: "working", planRevision: Number(data.revision), frozenVersion: null },
        { lastEventId },
      );
      return {
        payload,
        sourceRefs: [{
          table: "project_capital_plans",
          id: String(data.id),
          version: Number(data.revision),
          updatedAt: String(data.updated_at),
          sha256: sha256Hex(canonicalJson(data.document_json)),
        }],
        sourceAsOf: String(data.updated_at),
        autoUnverified: ddCapitalPolicyUnverified(payload),
        file: null,
        optionChoices: { capitalEvents: capitalEventChoices(plan) },
      };
    }
    const { data, error } = await db
      .from("project_capital_plan_versions")
      .select("id,plan_id,project_id,version,source_revision,document_json,published_at")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(`dd capital plan version lookup: ${error.message}`);
    if (!data || data.project_id !== input.projectId) throw new DdSourceError("source_not_found", "資本政策の提出版が見つからない");
    const { data: planRow } = await db.from("project_capital_plans").select("name").eq("id", data.plan_id).maybeSingle();
    const frozenPlan = toCapitalPlan({ id: String(data.plan_id), name: String(planRow?.name ?? "資本政策"), document_json: data.document_json });
    const payload = projectDdCapitalPolicy(
      frozenPlan,
      { basis: "frozen", planRevision: Number(data.source_revision), frozenVersion: Number(data.version) },
      { lastEventId },
    );
    return {
      payload,
      sourceRefs: [{
        table: "project_capital_plan_versions",
        id: String(data.id),
        version: Number(data.version),
        updatedAt: String(data.published_at),
        sha256: sha256Hex(canonicalJson(data.document_json)),
      }],
      sourceAsOf: String(data.published_at),
      autoUnverified: ddCapitalPolicyUnverified(payload),
      file: null,
      optionChoices: { capitalEvents: capitalEventChoices(frozenPlan) },
    };
  }

  // cost_model
  const { data: model, error: modelError } = await db
    .from("project_cost_models")
    .select("*")
    .eq("cost_model_id", id)
    .eq("project_id", input.projectId)
    .maybeSingle();
  if (modelError) throw new Error(`dd cost model lookup: ${modelError.message}`);
  if (!model || model.status !== "active") throw new DdSourceError("source_not_found", "コスト試算が見つからない");
  if (model.case_kind === "biodiesel") throw new DdSourceError("unsupported_source", "燃料の試算はまだDDに対応していない");
  const [a, i, q, n, t] = await Promise.all([
    db.from("project_cost_assumptions").select("*").eq("cost_model_id", id).order("sort_order"),
    db.from("project_cost_items").select("*").eq("cost_model_id", id).order("sort_order"),
    db.from("project_cost_questions").select("*").eq("cost_model_id", id).order("sort_order"),
    db.from("project_cost_notes").select("*").eq("cost_model_id", id).order("sort_order"),
    db.from("project_cost_tasks").select("*").eq("cost_model_id", id).order("sort_order"),
  ]);
  for (const result of [a, i, q, n, t]) {
    if (result.error) throw new Error(`dd cost model rows: ${result.error.message}`);
  }
  const bundle = mapBundle(model, a.data ?? [], i.data ?? [], q.data ?? [], n.data ?? [], t.data ?? []);
  const payload = projectDdCostModel(bundle, included);
  return {
    payload,
    sourceRefs: [{
      table: "project_cost_models",
      id,
      version: bundle.model.versionLabel,
      updatedAt: maxIso([
        model.updated_at as string,
        ...((a.data ?? []) as Array<{ updated_at?: string }>).map((row) => row.updated_at),
        ...((i.data ?? []) as Array<{ updated_at?: string }>).map((row) => row.updated_at),
        ...((t.data ?? []) as Array<{ updated_at?: string }>).map((row) => row.updated_at),
        ...((n.data ?? []) as Array<{ updated_at?: string }>).map((row) => row.updated_at),
        ...((q.data ?? []) as Array<{ updated_at?: string }>).map((row) => row.updated_at),
      ]),
      // 注意書き（notes）と確認事項（questions）も公開版・未確認事項に入るので、変化の判定に含める。
      sha256: sha256Hex(canonicalJson({ assumptions: a.data, items: i.data, tasks: t.data, notes: n.data, questions: q.data, model })),
    }],
    sourceAsOf: bundle.model.updatedAt,
    autoUnverified: ddCostModelUnverified(bundle),
    file: null,
    optionChoices: { parts: listDdCostModelParts(bundle) },
  };
}

/** 公開する未確認事項 = 管理者が書いた分 + 元データから自動で拾った分（autoUnverified=false の項目は管理者の分だけ）。 */
export function mergeDdUnverifiedNotes(adminNotes: unknown, autoNotes: string[], includeAuto: boolean): string[] {
  const merged = [...normalizeDdUnverifiedNotes(adminNotes), ...(includeAuto ? normalizeDdUnverifiedNotes(autoNotes) : [])];
  return Array.from(new Set(merged)).slice(0, 60);
}

/** 公開版の添付の置き場。内容の sha256 で決めるので、同じ実体を二重に置かない。 */
export function ddPublicationFilePath(packageId: string, itemId: string, sha256: string): string {
  return `${packageId}/${itemId}/${sha256}`;
}

export const DD_PUBLICATION_BUCKET = "dd-publication-files";
