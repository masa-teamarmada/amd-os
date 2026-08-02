/**
 * BZM 理論マップのデータ層。
 *
 * DB (bzm_theory_nodes / bzm_theory_edges) だけを正とする。
 * このマップは利用者が自分で育てるため、DB障害時も過去のMarkdownや
 * 初期データを自動表示しない。API route と /bzm/map ページの両方が
 * このモジュールを通して読み書きする。
 */

import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  THEORY_MEMO_TYPES,
  THEORY_NODE_KINDS,
  THEORY_NODE_LAYERS,
  THEORY_NODE_STATUSES,
  THEORY_RELATION_TYPES,
  type TheoryMemoType,
  type TheoryNodeKind,
  type TheoryNodeLayer,
  type TheoryNodeStatus,
  type TheoryRelationType,
} from "@/lib/bzm-theory-graph";

export type TheoryMapStorageMode = "db" | "unavailable";

export interface TheoryMapNodeDTO {
  id: string;
  title: string;
  kind: TheoryNodeKind;
  layer: TheoryNodeLayer;
  status: TheoryNodeStatus;
  summary: string;
  sourceRef: string;
  sourceHref: string | null;
  body: string;
  editable: boolean;
}

export interface TheoryMapEdgeDTO {
  from: string;
  to: string;
  type: TheoryRelationType;
  id: string | null;
  note: string | null;
  editable: boolean;
}

export interface TheoryMapMemoDTO {
  id: string;
  nodeId: string;
  memoType: TheoryMemoType;
  body: string;
  createdAt: string;
}

export interface TheoryMapResult {
  storageMode: TheoryMapStorageMode;
  nodes: TheoryMapNodeDTO[];
  edges: TheoryMapEdgeDTO[];
  memos: TheoryMapMemoDTO[];
  errors: string[];
}

export const TITLE_MAX = 220;
export const SUMMARY_MAX = 2000;
export const BODY_MD_MAX = 30000;
export const SOURCE_REF_MAX = 1000;
export const NOTE_MAX = 2000;
export const NODE_ID_MAX = 160;
export const MEMO_BODY_MAX = 2000;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const NODES_TABLE = "bzm_theory_nodes";
const EDGES_TABLE = "bzm_theory_edges";
const MEMOS_TABLE = "bzm_theory_node_memos";

function bzmDir() {
  return path.join(process.cwd(), "bzm");
}

const SOURCE_REF_PATTERN = /([A-Za-z0-9_./-]+\.md)(#[-\w]+)?/;

export function resolveSourceHref(sourceRef: string): string | null {
  const match = sourceRef.match(SOURCE_REF_PATTERN);
  if (!match) return null;
  const [, mdPath] = match;
  const fileName = mdPath.split("/").pop() ?? mdPath;
  if (!fileName.endsWith(".md")) return null;
  const slug = fileName.replace(/\.md$/, "");
  const filePath = path.join(bzmDir(), `${slug}.md`);
  if (!fs.existsSync(filePath)) return null;
  // BzmMarkdown does not currently emit stable heading ids, so source links
  // intentionally open the document rather than a misleading fragment URL.
  return `/bzm/${encodeURIComponent(slug)}`;
}

// -------------------------------------------------------------------------
// DB-backed load (canonical)
// -------------------------------------------------------------------------

interface NodeRow {
  id: string;
  title: string;
  kind: string;
  layer: string;
  status: string;
  summary: string;
  body_md: string;
  source_ref: string | null;
}

interface EdgeRow {
  id: string;
  from_node_id: string;
  to_node_id: string;
  relation_type: string;
  note: string | null;
}

interface MemoRow {
  id: string;
  node_id: string;
  memo_type: string;
  body: string;
  created_at: string;
}

/**
 * DB を正として理論マップを読み込む。空データは正常系として扱う。
 * 取得失敗時は過去データを混ぜず、空の unavailable 結果を返す。
 */
export async function loadTheoryMap(
  supabase: SupabaseClient
): Promise<TheoryMapResult> {
  const [nodesRes, edgesRes, memosRes] = await Promise.all([
    supabase
      .from(NODES_TABLE)
      .select("id,title,kind,layer,status,summary,body_md,source_ref")
      .is("archived_at", null),
    supabase.from(EDGES_TABLE).select("id,from_node_id,to_node_id,relation_type,note"),
    supabase
      .from(MEMOS_TABLE)
      .select("id,node_id,memo_type,body,created_at")
      .order("created_at", { ascending: true }),
  ]);

  if (nodesRes.error || edgesRes.error || memosRes.error) {
    console.error(
      "[bzm-theory-store] DB load failed",
      nodesRes.error ?? edgesRes.error ?? memosRes.error
    );
    return {
      storageMode: "unavailable",
      nodes: [],
      edges: [],
      memos: [],
      errors: ["理論マップを読み込めませんでした。時間をおいて再読み込みしてください。"],
    };
  }

  const nodeRows = (nodesRes.data ?? []) as NodeRow[];
  const edgeRows = (edgesRes.data ?? []) as EdgeRow[];
  const memoRows = (memosRes.data ?? []) as MemoRow[];
  const nodeIds = new Set(nodeRows.map((row) => row.id));

  const nodes: TheoryMapNodeDTO[] = nodeRows.map((row) => ({
    id: row.id,
    title: row.title,
    kind: row.kind as TheoryNodeKind,
    layer: row.layer as TheoryNodeLayer,
    status: row.status as TheoryNodeStatus,
    summary: row.summary,
    sourceRef: row.source_ref ?? "",
    sourceHref: row.source_ref ? resolveSourceHref(row.source_ref) : null,
    body: row.body_md ?? "",
    editable: true,
  }));

  const errors: string[] = [];
  const edges: TheoryMapEdgeDTO[] = [];
  for (const row of edgeRows) {
    if (!nodeIds.has(row.from_node_id) || !nodeIds.has(row.to_node_id)) {
      // Soft-deleted nodes keep their edges so a future restore can recover the
      // original graph. Hidden archived endpoints are therefore a normal case.
      continue;
    }
    edges.push({
      from: row.from_node_id,
      to: row.to_node_id,
      type: row.relation_type as TheoryRelationType,
      id: row.id,
      note: row.note ?? null,
      editable: true,
    });
  }

  const memos: TheoryMapMemoDTO[] = [];
  for (const row of memoRows) {
    if (!nodeIds.has(row.node_id)) {
      // Memos attached to a soft-deleted node stay stored for the same reason.
      continue;
    }
    memos.push({
      id: row.id,
      nodeId: row.node_id,
      memoType: row.memo_type as TheoryMemoType,
      body: row.body,
      createdAt: row.created_at,
    });
  }

  return { storageMode: "db", nodes, edges, memos, errors };
}

// -------------------------------------------------------------------------
// Validation helpers
// -------------------------------------------------------------------------

export interface FieldError {
  error: string;
}

function trimmed(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function requireText(value: unknown, max: number, label: string): { ok: true; value: string } | FieldError {
  const text = trimmed(value);
  if (!text) return { error: `${label}は必須です。` };
  if (text.length > max) return { error: `${label}は${max}文字以内で入力してください。` };
  return { ok: true, value: text };
}

function optionalText(value: unknown, max: number, label: string): { ok: true; value: string | null } | FieldError {
  if (value === undefined || value === null) return { ok: true, value: null };
  const text = trimmed(value);
  if (!text) return { ok: true, value: null };
  if (text.length > max) return { error: `${label}は${max}文字以内で入力してください。` };
  return { ok: true, value: text };
}

function isOneOf<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (values as readonly string[]).includes(value);
}

// -------------------------------------------------------------------------
// Mutations (DB only — callers must run these after requireAdmin, using
// createAdminClient())
// -------------------------------------------------------------------------

export interface CreateNodeInput {
  title: unknown;
  kind: unknown;
  layer: unknown;
  status: unknown;
  summary: unknown;
  bodyMd?: unknown;
  sourceRef?: unknown;
  relation?: {
    type: unknown;
    targetId: unknown;
    direction: unknown; // "outgoing" (new -> target) | "incoming" (target -> new)
    note?: unknown;
  };
}

export interface CreateEdgeInput {
  from: unknown;
  to: unknown;
  type: unknown;
  note?: unknown;
}

export interface CreateMemoInput {
  nodeId: unknown;
  memoType: unknown;
  body: unknown;
}

export interface UpdateNodeInput {
  nodeId: unknown;
  title?: unknown;
  kind?: unknown;
  layer?: unknown;
  status?: unknown;
  summary?: unknown;
  bodyMd?: unknown;
  sourceRef?: unknown;
  archived?: unknown;
}

export type StoreResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

function generateNodeId(kind: string): string {
  return `${kind}-${randomUUID()}`;
}

function isUniqueViolation(error: { code?: string } | null | undefined): boolean {
  return error?.code === "23505";
}

async function fetchActiveNodeKinds(
  db: SupabaseClient,
  ids: string[]
): Promise<Map<string, TheoryNodeKind>> {
  if (ids.length === 0) return new Map();
  const { data, error } = await db
    .from(NODES_TABLE)
    .select("id,kind")
    .in("id", ids)
    .is("archived_at", null);
  if (error) {
    console.error("[bzm-theory-store] fetchActiveNodeKinds failed", error);
    throw new Error("db_lookup_failed");
  }
  return new Map(
    (data ?? []).map((row) => {
      const typed = row as { id: string; kind: TheoryNodeKind };
      return [typed.id, typed.kind] as const;
    })
  );
}

function validateNodeFields(input: {
  title: unknown;
  kind: unknown;
  layer: unknown;
  status: unknown;
  summary: unknown;
  bodyMd?: unknown;
  sourceRef?: unknown;
}): StoreResult<{
  title: string;
  kind: TheoryNodeKind;
  layer: TheoryNodeLayer;
  status: TheoryNodeStatus;
  summary: string;
  bodyMd: string;
  sourceRef: string | null;
}> {
  const title = requireText(input.title, TITLE_MAX, "タイトル");
  if ("error" in title) return { ok: false, status: 400, error: title.error };

  const summary = requireText(input.summary, SUMMARY_MAX, "要約");
  if ("error" in summary) return { ok: false, status: 400, error: summary.error };

  const bodyMd = optionalText(input.bodyMd, BODY_MD_MAX, "本文");
  if ("error" in bodyMd) return { ok: false, status: 400, error: bodyMd.error };

  const sourceRef = optionalText(input.sourceRef, SOURCE_REF_MAX, "出典");
  if ("error" in sourceRef) return { ok: false, status: 400, error: sourceRef.error };

  if (!isOneOf(THEORY_NODE_KINDS, input.kind)) {
    return { ok: false, status: 400, error: "kind の値が不正です。" };
  }
  if (!isOneOf(THEORY_NODE_LAYERS, input.layer)) {
    return { ok: false, status: 400, error: "layer の値が不正です。" };
  }
  if (!isOneOf(THEORY_NODE_STATUSES, input.status)) {
    return { ok: false, status: 400, error: "status の値が不正です。" };
  }

  return {
    ok: true,
    data: {
      title: title.value,
      kind: input.kind,
      layer: input.layer,
      status: input.status,
      summary: summary.value,
      bodyMd: bodyMd.value ?? "",
      sourceRef: sourceRef.value,
    },
  };
}

/** create_node アクション。relation 指定時はエッジも作成し、失敗時は新規ノードを補償削除する。 */
export async function createNodeWithOptionalEdge(
  db: SupabaseClient,
  input: CreateNodeInput,
  actorEmail: string
): Promise<StoreResult<{ node: TheoryMapNodeDTO; edge: TheoryMapEdgeDTO | null }>> {
  const fields = validateNodeFields(input);
  if (!fields.ok) return fields;

  let relation: { type: TheoryRelationType; targetId: string; direction: "outgoing" | "incoming"; note: string | null } | null = null;
  if (input.relation) {
    if (!isOneOf(THEORY_RELATION_TYPES, input.relation.type)) {
      return { ok: false, status: 400, error: "relation.type の値が不正です。" };
    }
    const targetId = trimmed(input.relation.targetId);
    if (!targetId) return { ok: false, status: 400, error: "relation.targetId は必須です。" };
    if (targetId.length > NODE_ID_MAX) return { ok: false, status: 400, error: "relation.targetId が長すぎます。" };
    const direction = input.relation.direction === "incoming" ? "incoming" : input.relation.direction === "outgoing" ? "outgoing" : null;
    if (!direction) return { ok: false, status: 400, error: "relation.direction は outgoing か incoming を指定してください。" };
    const note = optionalText(input.relation.note, NOTE_MAX, "ノート");
    if ("error" in note) return { ok: false, status: 400, error: note.error };
    relation = { type: input.relation.type, targetId, direction, note: note.value };

    let activeTargets: Map<string, TheoryNodeKind>;
    try {
      activeTargets = await fetchActiveNodeKinds(db, [targetId]);
    } catch {
      return { ok: false, status: 500, error: "サーバーエラーが発生しました。時間をおいて再度お試しください。" };
    }
    if (!activeTargets.has(targetId)) {
      return { ok: false, status: 400, error: "関連先のノードが見つかりません。" };
    }
    const raisesTargetKind =
      direction === "incoming" ? fields.data.kind : activeTargets.get(targetId);
    if (input.relation.type === "raises" && raisesTargetKind !== "question") {
      return { ok: false, status: 400, error: "論点を残す関係の接続先は、未解決問いノードにしてください。" };
    }
  }

  const nodeId = generateNodeId(fields.data.kind);
  const nodeRow = {
    id: nodeId,
    title: fields.data.title,
    kind: fields.data.kind,
    layer: fields.data.layer,
    status: fields.data.status,
    summary: fields.data.summary,
    body_md: fields.data.bodyMd,
    source_ref: fields.data.sourceRef,
    origin: "editor",
    created_by: actorEmail,
    updated_by: actorEmail,
  };

  const { data: insertedNode, error: insertNodeError } = await db
    .from(NODES_TABLE)
    .insert(nodeRow)
    .select("id,title,kind,layer,status,summary,body_md,source_ref")
    .single();

  if (insertNodeError) {
    console.error("[bzm-theory-store] createNode insert failed", insertNodeError);
    return { ok: false, status: 500, error: "ノードの作成に失敗しました。" };
  }

  const nodeDto = rowToNodeDto(insertedNode as NodeRow);

  if (!relation) {
    return { ok: true, data: { node: nodeDto, edge: null } };
  }

  const fromNodeId = relation.direction === "outgoing" ? nodeId : relation.targetId;
  const toNodeId = relation.direction === "outgoing" ? relation.targetId : nodeId;

  if (fromNodeId === toNodeId) {
    await db.from(NODES_TABLE).delete().eq("id", nodeId);
    return { ok: false, status: 400, error: "同一ノードへの関係は作成できません。" };
  }

  const { data: insertedEdge, error: insertEdgeError } = await db
    .from(EDGES_TABLE)
    .insert({
      from_node_id: fromNodeId,
      to_node_id: toNodeId,
      relation_type: relation.type,
      note: relation.note,
      created_by: actorEmail,
    })
    .select("id,from_node_id,to_node_id,relation_type,note")
    .single();

  if (insertEdgeError) {
    // compensate: delete exactly the node we just created
    const { error: compensateError } = await db.from(NODES_TABLE).delete().eq("id", nodeId);
    if (compensateError) {
      console.error("[bzm-theory-store] compensation delete failed", compensateError, { nodeId });
    }
    console.error("[bzm-theory-store] createNode edge insert failed", insertEdgeError);
    if (isUniqueViolation(insertEdgeError)) {
      return { ok: false, status: 409, error: "同じ関係は既に存在するため、ノード作成を取り消しました。" };
    }
    return { ok: false, status: 500, error: "関係の作成に失敗したため、ノード作成を取り消しました。" };
  }

  return { ok: true, data: { node: nodeDto, edge: rowToEdgeDto(insertedEdge as EdgeRow) } };
}

/** create_edge アクション。 */
export async function createEdge(
  db: SupabaseClient,
  input: CreateEdgeInput,
  actorEmail: string
): Promise<StoreResult<TheoryMapEdgeDTO>> {
  const from = trimmed(input.from);
  const to = trimmed(input.to);
  if (!from || !to) return { ok: false, status: 400, error: "from と to は必須です。" };
  if (from.length > NODE_ID_MAX || to.length > NODE_ID_MAX) {
    return { ok: false, status: 400, error: "from または to が長すぎます。" };
  }
  if (from === to) return { ok: false, status: 400, error: "同一ノードへの関係は作成できません。" };
  if (!isOneOf(THEORY_RELATION_TYPES, input.type)) {
    return { ok: false, status: 400, error: "type の値が不正です。" };
  }
  const note = optionalText(input.note, NOTE_MAX, "ノート");
  if ("error" in note) return { ok: false, status: 400, error: note.error };

  let activeNodes: Map<string, TheoryNodeKind>;
  try {
    activeNodes = await fetchActiveNodeKinds(db, [from, to]);
  } catch {
    return { ok: false, status: 500, error: "サーバーエラーが発生しました。時間をおいて再度お試しください。" };
  }
  if (!activeNodes.has(from) || !activeNodes.has(to)) {
    return { ok: false, status: 400, error: "from または to のノードが見つかりません。" };
  }
  if (input.type === "raises" && activeNodes.get(to) !== "question") {
    return { ok: false, status: 400, error: "論点を残す関係の接続先は、未解決問いノードにしてください。" };
  }

  const { data, error } = await db
    .from(EDGES_TABLE)
    .insert({
      from_node_id: from,
      to_node_id: to,
      relation_type: input.type,
      note: note.value,
      created_by: actorEmail,
    })
    .select("id,from_node_id,to_node_id,relation_type,note")
    .single();

  if (error) {
    console.error("[bzm-theory-store] createEdge failed", error);
    if (isUniqueViolation(error)) {
      return { ok: false, status: 409, error: "同じ関係のエッジは既に存在します。" };
    }
    return { ok: false, status: 500, error: "関係の作成に失敗しました。" };
  }

  return { ok: true, data: rowToEdgeDto(data as EdgeRow) };
}

/**
 * create_memo アクション。選択ノードの内側へメモを1件積むだけで、
 * ノードもエッジも作らない (bzm_theory_node_memos だけへ書く)。
 */
export async function createMemo(
  db: SupabaseClient,
  input: CreateMemoInput,
  actorEmail: string
): Promise<StoreResult<TheoryMapMemoDTO>> {
  const nodeId = trimmed(input.nodeId);
  if (!nodeId) return { ok: false, status: 400, error: "nodeId は必須です。" };
  if (nodeId.length > NODE_ID_MAX) return { ok: false, status: 400, error: "nodeId が長すぎます。" };
  if (!isOneOf(THEORY_MEMO_TYPES, input.memoType)) {
    return { ok: false, status: 400, error: "memoType の値が不正です。" };
  }
  const body = requireText(input.body, MEMO_BODY_MAX, "メモ本文");
  if ("error" in body) return { ok: false, status: 400, error: body.error };

  let activeNodes: Map<string, TheoryNodeKind>;
  try {
    activeNodes = await fetchActiveNodeKinds(db, [nodeId]);
  } catch {
    return { ok: false, status: 500, error: "サーバーエラーが発生しました。時間をおいて再度お試しください。" };
  }
  if (!activeNodes.has(nodeId)) {
    return { ok: false, status: 400, error: "対象のノードが見つかりません。" };
  }

  const { data, error } = await db
    .from(MEMOS_TABLE)
    .insert({
      node_id: nodeId,
      memo_type: input.memoType,
      body: body.value,
      created_by: actorEmail,
    })
    .select("id,node_id,memo_type,body,created_at")
    .single();

  if (error) {
    console.error("[bzm-theory-store] createMemo failed", error);
    return { ok: false, status: 500, error: "メモの作成に失敗しました。" };
  }

  return { ok: true, data: rowToMemoDto(data as MemoRow) };
}

/** ノード更新 (PATCH)。指定されたフィールドのみ更新する。 */
export async function updateNode(
  db: SupabaseClient,
  input: UpdateNodeInput,
  actorEmail: string
): Promise<StoreResult<TheoryMapNodeDTO>> {
  const nodeId = trimmed(input.nodeId);
  if (!nodeId) return { ok: false, status: 400, error: "nodeId は必須です。" };
  if (nodeId.length > NODE_ID_MAX) return { ok: false, status: 400, error: "nodeId が長すぎます。" };

  const patch: Record<string, unknown> = {
    updated_by: actorEmail,
  };

  if (input.title !== undefined) {
    const title = requireText(input.title, TITLE_MAX, "タイトル");
    if ("error" in title) return { ok: false, status: 400, error: title.error };
    patch.title = title.value;
  }
  if (input.summary !== undefined) {
    const summary = requireText(input.summary, SUMMARY_MAX, "要約");
    if ("error" in summary) return { ok: false, status: 400, error: summary.error };
    patch.summary = summary.value;
  }
  if (input.bodyMd !== undefined) {
    const bodyMd = optionalText(input.bodyMd, BODY_MD_MAX, "本文");
    if ("error" in bodyMd) return { ok: false, status: 400, error: bodyMd.error };
    patch.body_md = bodyMd.value ?? "";
  }
  if (input.sourceRef !== undefined) {
    const sourceRef = optionalText(input.sourceRef, SOURCE_REF_MAX, "出典");
    if ("error" in sourceRef) return { ok: false, status: 400, error: sourceRef.error };
    patch.source_ref = sourceRef.value;
  }
  if (input.kind !== undefined) {
    if (!isOneOf(THEORY_NODE_KINDS, input.kind)) return { ok: false, status: 400, error: "kind の値が不正です。" };
    if (input.kind !== "question") {
      const { data: raisesEdges, error: raisesError } = await db
        .from(EDGES_TABLE)
        .select("id")
        .eq("to_node_id", nodeId)
        .eq("relation_type", "raises")
        .limit(1);
      if (raisesError) {
        console.error("[bzm-theory-store] raises edge lookup failed", raisesError);
        return { ok: false, status: 500, error: "ノードの更新前確認に失敗しました。" };
      }
      if ((raisesEdges ?? []).length > 0) {
        return { ok: false, status: 409, error: "論点として接続されているため、未解決問い以外の種別へ変更できません。" };
      }
    }
    patch.kind = input.kind;
  }
  if (input.layer !== undefined) {
    if (!isOneOf(THEORY_NODE_LAYERS, input.layer)) return { ok: false, status: 400, error: "layer の値が不正です。" };
    patch.layer = input.layer;
  }
  if (input.status !== undefined) {
    if (!isOneOf(THEORY_NODE_STATUSES, input.status)) return { ok: false, status: 400, error: "status の値が不正です。" };
    patch.status = input.status;
  }
  if (input.archived !== undefined) {
    patch.archived_at = input.archived === true ? new Date().toISOString() : null;
  }

  if (Object.keys(patch).length === 1) {
    return { ok: false, status: 400, error: "更新する項目を1つ以上指定してください。" };
  }

  const { data, error } = await db
    .from(NODES_TABLE)
    .update(patch)
    .eq("id", nodeId)
    .select("id,title,kind,layer,status,summary,body_md,source_ref")
    .maybeSingle();

  if (error) {
    console.error("[bzm-theory-store] updateNode failed", error);
    return { ok: false, status: 500, error: "ノードの更新に失敗しました。" };
  }
  if (!data) {
    return { ok: false, status: 404, error: "ノードが見つかりません。" };
  }

  return { ok: true, data: rowToNodeDto(data as NodeRow) };
}

/** 単一エッジの削除 (DELETE)。 */
export async function deleteEdge(db: SupabaseClient, edgeId: string): Promise<StoreResult<{ id: string }>> {
  const id = trimmed(edgeId);
  if (!id) return { ok: false, status: 400, error: "edgeId は必須です。" };
  if (!UUID_PATTERN.test(id)) return { ok: false, status: 400, error: "edgeId の形式が不正です。" };

  const { data, error } = await db
    .from(EDGES_TABLE)
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[bzm-theory-store] deleteEdge failed", error);
    return { ok: false, status: 500, error: "関係の削除に失敗しました。" };
  }
  if (!data) {
    return { ok: false, status: 404, error: "エッジが見つかりません。" };
  }

  return { ok: true, data: { id: (data as { id: string }).id } };
}

/**
 * ノードの recoverable soft-delete (DELETE ?nodeId=)。archived_at を設定するだけで
 * 物理削除しない。active なノードだけを対象にし、updated_by も記録する。
 */
export async function archiveNode(
  db: SupabaseClient,
  nodeId: string,
  actorEmail: string
): Promise<StoreResult<{ id: string }>> {
  const id = trimmed(nodeId);
  if (!id) return { ok: false, status: 400, error: "nodeId は必須です。" };
  if (id.length > NODE_ID_MAX) return { ok: false, status: 400, error: "nodeId が長すぎます。" };

  const { data, error } = await db
    .from(NODES_TABLE)
    .update({ archived_at: new Date().toISOString(), updated_by: actorEmail })
    .eq("id", id)
    .is("archived_at", null)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[bzm-theory-store] archiveNode failed", error);
    return { ok: false, status: 500, error: "ノードの削除に失敗しました。" };
  }
  if (!data) {
    return { ok: false, status: 404, error: "ノードが見つかりません。" };
  }

  return { ok: true, data: { id: (data as { id: string }).id } };
}

function rowToNodeDto(row: NodeRow): TheoryMapNodeDTO {
  return {
    id: row.id,
    title: row.title,
    kind: row.kind as TheoryNodeKind,
    layer: row.layer as TheoryNodeLayer,
    status: row.status as TheoryNodeStatus,
    summary: row.summary,
    sourceRef: row.source_ref ?? "",
    sourceHref: row.source_ref ? resolveSourceHref(row.source_ref) : null,
    body: row.body_md ?? "",
    editable: true,
  };
}

function rowToEdgeDto(row: EdgeRow): TheoryMapEdgeDTO {
  return {
    from: row.from_node_id,
    to: row.to_node_id,
    type: row.relation_type as TheoryRelationType,
    id: row.id,
    note: row.note ?? null,
    editable: true,
  };
}

function rowToMemoDto(row: MemoRow): TheoryMapMemoDTO {
  return {
    id: row.id,
    nodeId: row.node_id,
    memoType: row.memo_type as TheoryMemoType,
    body: row.body,
    createdAt: row.created_at,
  };
}
