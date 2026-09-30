import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { recordWorkspaceAuditEvent } from "@/lib/workspace-access-audit";
import {
  DD_SECTIONS,
  isDdSectionKey,
  normalizeDdCapabilities,
  type DdCapability,
  type DdGrantStatus,
  type DdPackageStatus,
  type DdSectionKey,
  type DdViewerAccess,
} from "@/lib/dd-package-core";
import { isDdItemKind, type DdItemKind, type DdSourceRef } from "@/lib/dd-payload";
import {
  DD_PUBLICATION_BUCKET,
  buildDdPublicationDraft,
  ddPublicationFilePath,
  mergeDdUnverifiedNotes,
} from "@/lib/dd-sources";

// DD の公開版・掲載項目・閲覧権限の読み書き（service_role）。
// 閲覧者向けの読み取りは「公開版があり、項目が有効」なものだけを返す。未公開の項目・内部の選択・版履歴は返さない。

export type DdPackageRow = {
  id: string;
  project_id: string;
  slug: string;
  title: string;
  notice_text: string | null;
  status: DdPackageStatus;
  updated_at: string;
};

export type DdItemRow = {
  id: string;
  package_id: string;
  project_id: string;
  section_key: DdSectionKey;
  item_kind: DdItemKind;
  source_key: string;
  source_options: Record<string, unknown>;
  title: string;
  summary: string | null;
  unverified_notes: unknown;
  evidence_item_ids: string[];
  sort_order: number;
  status: "active" | "archived";
  published_publication_id: string | null;
  created_at: string;
  updated_at: string;
};

/** 閲覧者に返してよい公開版の列だけ。確認メモ・公開した人・元データの内部参照・添付の保存先は含めない。 */
export type DdPublicationRow = {
  id: string;
  item_id: string;
  package_id: string;
  revision: number;
  item_kind: DdItemKind;
  section_key: DdSectionKey;
  title: string;
  summary: string | null;
  payload: Record<string, unknown>;
  source_as_of: string | null;
  unverified_notes: string[];
  evidence_item_ids: string[];
  file_name: string | null;
  file_mime_type: string | null;
  file_size_bytes: number | null;
  published_at: string;
};

const PACKAGE_FIELDS = "id,project_id,slug,title,notice_text,status,updated_at";
const ITEM_FIELDS =
  "id,package_id,project_id,section_key,item_kind,source_key,source_options,title,summary,unverified_notes,evidence_item_ids,sort_order,status,published_publication_id,created_at,updated_at";
/** 閲覧者に返す公開版の列。DdPublicationRow と同じ集合で、社内向けの列は select しない。 */
export const DD_PUBLICATION_VIEW_FIELDS =
  "id,item_id,package_id,revision,item_kind,section_key,title,summary,payload,source_as_of,unverified_notes,evidence_item_ids,file_name,file_mime_type,file_size_bytes,published_at";

// --- 閲覧者向け（公開版だけ） -------------------------------------------------------

export type DdPublishedItem = {
  itemId: string;
  sectionKey: DdSectionKey;
  sortOrder: number;
  publication: DdPublicationRow;
};

export type DdPackageView = {
  package: DdPackageRow;
  sections: Array<{ key: DdSectionKey; label: string; description: string; items: DdPublishedItem[] }>;
  lastPublishedAt: string | null;
};

async function loadPackage(packageId: string): Promise<DdPackageRow | null> {
  const db = createAdminClient();
  const { data, error } = await db.from("dd_packages").select(PACKAGE_FIELDS).eq("id", packageId).maybeSingle<DdPackageRow>();
  if (error) throw new Error(`dd package load: ${error.message}`);
  return data ?? null;
}

/** 公開中の項目と、その公開版。外部に見せてよいのはこの関数の戻り値だけ。 */
export async function loadDdPublishedItems(packageId: string): Promise<DdPublishedItem[]> {
  const db = createAdminClient();
  const { data: items, error } = await db
    .from("dd_package_items")
    .select("id,section_key,sort_order,status,published_publication_id")
    .eq("package_id", packageId)
    .eq("status", "active")
    .not("published_publication_id", "is", null);
  if (error) throw new Error(`dd published items: ${error.message}`);
  const rows = (items ?? []) as Array<{ id: string; section_key: string; sort_order: number; published_publication_id: string }>;
  if (rows.length === 0) return [];
  const { data: publications, error: publicationError } = await db
    .from("dd_item_publications")
    .select(DD_PUBLICATION_VIEW_FIELDS)
    .in("id", rows.map((row) => row.published_publication_id));
  if (publicationError) throw new Error(`dd publications: ${publicationError.message}`);
  const byId = new Map(((publications ?? []) as unknown as DdPublicationRow[]).map((row) => [row.id, row]));
  return rows
    .map((row) => {
      const publication = byId.get(row.published_publication_id);
      // 指している公開版が同じ項目・同じパッケージのものか、二重に確かめる（FK でも保証している）。
      if (!publication || publication.item_id !== row.id || publication.package_id !== packageId) return null;
      if (!isDdSectionKey(row.section_key)) return null;
      return { itemId: row.id, sectionKey: row.section_key, sortOrder: row.sort_order, publication };
    })
    .filter((item): item is DdPublishedItem => item !== null)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.publication.title.localeCompare(b.publication.title, "ja"));
}

export async function loadDdPackageView(access: DdViewerAccess): Promise<DdPackageView | null> {
  const pkg = await loadPackage(access.packageId);
  if (!pkg) return null;
  const items = await loadDdPublishedItems(pkg.id);
  return {
    package: pkg,
    sections: DD_SECTIONS.map((section) => ({
      key: section.key,
      label: section.label,
      description: section.description,
      items: items.filter((item) => item.sectionKey === section.key),
    })),
    lastPublishedAt: items.reduce<string | null>(
      (latest, item) => (!latest || item.publication.published_at > latest ? item.publication.published_at : latest),
      null,
    ),
  };
}

export type DdEvidenceLink = { itemId: string; title: string; fileName: string | null; revision: number };

/** 公開中の項目1件。根拠資料は「いま公開中の資料項目」だけを返す（取り下げた資料へのリンクは出さない）。 */
export async function loadDdPublishedItem(
  packageId: string,
  itemId: string,
): Promise<{ item: DdPublishedItem; evidence: DdEvidenceLink[] } | null> {
  const items = await loadDdPublishedItems(packageId);
  const item = items.find((candidate) => candidate.itemId === itemId);
  if (!item) return null;
  const evidence = item.publication.evidence_item_ids
    .map((evidenceId) => items.find((candidate) => candidate.itemId === evidenceId))
    .filter((candidate): candidate is DdPublishedItem => Boolean(candidate && candidate.publication.item_kind === "document"))
    .map((candidate) => ({
      itemId: candidate.itemId,
      title: candidate.publication.title,
      fileName: candidate.publication.file_name,
      revision: candidate.publication.revision,
    }));
  return { item, evidence };
}

/** 添付の保存先だけを読む（配信 route 専用。閲覧 DTO には含めない）。 */
export async function loadDdPublicationFile(publicationId: string): Promise<{
  storagePath: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
} | null> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("dd_item_publications")
    .select("file_storage_path,file_name,file_mime_type,file_size_bytes")
    .eq("id", publicationId)
    .maybeSingle();
  if (error) throw new Error(`dd publication file: ${error.message}`);
  if (!data?.file_storage_path || !data.file_name || !data.file_mime_type) return null;
  return {
    storagePath: String(data.file_storage_path),
    fileName: String(data.file_name),
    mimeType: String(data.file_mime_type),
    sizeBytes: Number(data.file_size_bytes ?? 0),
  };
}

export type DdAccessEvent = "dd_package_viewed" | "dd_item_viewed" | "dd_file_opened" | "dd_file_downloaded";

/** 外部アカウントの閲覧・ダウンロードを記録する（管理者プレビューは記録しない）。detail に URL・ファイル名は入れない。 */
export async function recordDdAccessEvent(
  access: DdViewerAccess,
  eventType: DdAccessEvent,
  detail: { itemId?: string; publicationId?: string; revision?: number } = {},
): Promise<void> {
  if (access.principal !== "workspace_account") return;
  await recordWorkspaceAuditEvent(createAdminClient(), {
    eventType,
    userAccountId: access.accountId,
    email: access.email,
    projectId: access.projectId,
    detail: {
      package_id: access.packageId,
      grant_id: access.grantId,
      item_id: detail.itemId ?? null,
      publication_id: detail.publicationId ?? null,
      revision: detail.revision ?? null,
    },
  });
}

// --- 管理（admin） ------------------------------------------------------------------

export type DdAdminGrant = {
  id: string;
  accountId: string;
  email: string;
  accountStatus: string;
  status: DdGrantStatus;
  capabilities: DdCapability[];
  organizationName: string | null;
  note: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
};

export type DdAdminPublication = {
  id: string;
  revision: number;
  publishedAt: string;
  publishedByMemberId: string;
  sourceAsOf: string | null;
  sourceRefs: DdSourceRef[];
  contentHash: string;
  note: string | null;
  unverifiedCount: number;
};

export type DdAdminItem = DdItemRow & {
  publications: DdAdminPublication[];
  sourceChanged: boolean | null;
  sourceError: string | null;
  draftAutoUnverified: string[];
  capitalEvents: Array<{ id: string; label: string }>;
};

export type DdAdminState = {
  package: DdPackageRow;
  items: DdAdminItem[];
  grants: DdAdminGrant[];
  events: Array<{ id: string; eventType: string; email: string | null; createdAt: string; itemId: string | null; revision: number | null }>;
};

function sameSourceRefs(a: DdSourceRef[], b: DdSourceRef[]): boolean {
  const key = (refs: DdSourceRef[]) =>
    JSON.stringify(refs.map((ref) => [ref.table, ref.id, ref.version ?? null, ref.sha256 ?? null, ref.updatedAt ?? null]));
  return key(a) === key(b);
}

export async function loadDdAdminState(projectId: string): Promise<DdAdminState | null> {
  const db = createAdminClient();
  const { data: pkg, error: packageError } = await db
    .from("dd_packages")
    .select(PACKAGE_FIELDS)
    .eq("project_id", projectId)
    .order("created_at")
    .limit(1)
    .maybeSingle<DdPackageRow>();
  if (packageError) throw new Error(`dd admin package: ${packageError.message}`);
  if (!pkg) return null;

  const [itemsRes, publicationsRes, grantsRes, eventsRes] = await Promise.all([
    db.from("dd_package_items").select(ITEM_FIELDS).eq("package_id", pkg.id).order("sort_order"),
    db
      .from("dd_item_publications")
      .select("id,item_id,revision,published_at,published_by_member_id,source_as_of,source_refs,content_hash,note,unverified_notes")
      .eq("package_id", pkg.id)
      .order("revision", { ascending: false }),
    db
      .from("dd_package_grants")
      .select("id,user_account_id,status,capabilities,organization_name,note,expires_at,created_at,updated_at")
      .eq("package_id", pkg.id)
      .order("created_at"),
    db
      .from("workspace_access_audit_logs")
      .select("id,event_type,email,created_at,detail")
      .eq("project_id", projectId)
      // 同じPJに別のパッケージ（動作確認用など）があっても混ぜないよう、パッケージで絞る。
      .eq("detail->>package_id", pkg.id)
      .in("event_type", ["dd_package_viewed", "dd_item_viewed", "dd_file_opened", "dd_file_downloaded"])
      .order("created_at", { ascending: false })
      .limit(200),
  ]);
  for (const result of [itemsRes, publicationsRes, grantsRes, eventsRes]) {
    if (result.error) throw new Error(`dd admin state: ${result.error.message}`);
  }

  const grantRows = (grantsRes.data ?? []) as Array<Record<string, unknown>>;
  const accountIds = Array.from(new Set(grantRows.map((row) => String(row.user_account_id))));
  const accounts = accountIds.length > 0
    ? await db.from("workspace_user_accounts").select("id,email,status,last_login_at").in("id", accountIds)
    : { data: [], error: null };
  if (accounts.error) throw new Error(`dd admin accounts: ${accounts.error.message}`);
  const accountById = new Map(((accounts.data ?? []) as Array<Record<string, unknown>>).map((row) => [String(row.id), row]));

  const publicationsByItem = new Map<string, DdAdminPublication[]>();
  for (const row of (publicationsRes.data ?? []) as Array<Record<string, unknown>>) {
    const list = publicationsByItem.get(String(row.item_id)) ?? [];
    list.push({
      id: String(row.id),
      revision: Number(row.revision),
      publishedAt: String(row.published_at),
      publishedByMemberId: String(row.published_by_member_id),
      sourceAsOf: (row.source_as_of as string) ?? null,
      sourceRefs: (row.source_refs as DdSourceRef[]) ?? [],
      contentHash: String(row.content_hash),
      note: (row.note as string) ?? null,
      unverifiedCount: Array.isArray(row.unverified_notes) ? row.unverified_notes.length : 0,
    });
    publicationsByItem.set(String(row.item_id), list);
  }

  const itemRows = (itemsRes.data ?? []) as unknown as DdItemRow[];
  const items: DdAdminItem[] = await Promise.all(
    itemRows.map(async (item) => {
      const publications = publicationsByItem.get(item.id) ?? [];
      const current = publications.find((publication) => publication.id === item.published_publication_id) ?? null;
      if (item.status !== "active") {
        return { ...item, publications, sourceChanged: null, sourceError: null, draftAutoUnverified: [], capitalEvents: [] };
      }
      try {
        const draft = await buildDdPublicationDraft(
          { projectId, itemKind: item.item_kind, sourceKey: item.source_key, sourceOptions: item.source_options ?? {} },
          { withFile: false },
        );
        return {
          ...item,
          publications,
          sourceChanged: current ? !sameSourceRefs(current.sourceRefs, draft.sourceRefs) : null,
          sourceError: null,
          draftAutoUnverified: draft.autoUnverified,
          capitalEvents: draft.optionChoices?.capitalEvents ?? [],
        };
      } catch (error) {
        return {
          ...item,
          publications,
          sourceChanged: null,
          sourceError: error instanceof Error ? error.message : String(error),
          draftAutoUnverified: [],
          capitalEvents: [],
        };
      }
    }),
  );

  return {
    package: pkg,
    items,
    grants: grantRows.map((row) => {
      const account = accountById.get(String(row.user_account_id));
      return {
        id: String(row.id),
        accountId: String(row.user_account_id),
        email: String(account?.email ?? ""),
        accountStatus: String(account?.status ?? "unknown"),
        status: row.status as DdGrantStatus,
        capabilities: normalizeDdCapabilities(row.capabilities),
        organizationName: (row.organization_name as string) ?? null,
        note: (row.note as string) ?? null,
        expiresAt: (row.expires_at as string) ?? null,
        createdAt: String(row.created_at),
        updatedAt: String(row.updated_at),
        lastLoginAt: (account?.last_login_at as string) ?? null,
      };
    }),
    events: ((eventsRes.data ?? []) as Array<Record<string, unknown>>).map((row) => {
      const detail = (row.detail ?? {}) as Record<string, unknown>;
      return {
        id: String(row.id),
        eventType: String(row.event_type),
        email: (row.email as string) ?? null,
        createdAt: String(row.created_at),
        itemId: typeof detail.item_id === "string" ? detail.item_id : null,
        revision: typeof detail.revision === "number" ? detail.revision : null,
      };
    }),
  };
}

export async function loadDdItem(itemId: string): Promise<DdItemRow | null> {
  const db = createAdminClient();
  const { data, error } = await db.from("dd_package_items").select(ITEM_FIELDS).eq("id", itemId).maybeSingle();
  if (error) throw new Error(`dd item load: ${error.message}`);
  const row = data as unknown as DdItemRow | null;
  if (!row || !isDdItemKind(row.item_kind)) return null;
  return row;
}

/**
 * 公開する。元データから下書きを作り直し（画面から送られた中身は使わない）、添付は内容の sha256 の置き場へ複製してから、
 * DB 関数 dd_publish_item が版番号と content hash を決めて1版を追記する。
 */
export async function publishDdItem(input: {
  itemId: string;
  actorMemberId: string;
  note: string | null;
}): Promise<{ publicationId: string; revision: number; unchanged: boolean }> {
  const item = await loadDdItem(input.itemId);
  if (!item || item.status !== "active") throw new Error("dd_item_not_found");
  const draft = await buildDdPublicationDraft(
    { projectId: item.project_id, itemKind: item.item_kind, sourceKey: item.source_key, sourceOptions: item.source_options ?? {} },
    { withFile: true },
  );
  const includeAuto = item.source_options?.autoUnverified !== false;
  const unverified = mergeDdUnverifiedNotes(item.unverified_notes, draft.autoUnverified, includeAuto);

  const db = createAdminClient();
  let file: Record<string, unknown> | null = null;
  if (draft.file) {
    const storagePath = ddPublicationFilePath(item.package_id, item.id, draft.file.sha256);
    const { error: uploadError } = await db.storage
      .from(DD_PUBLICATION_BUCKET)
      .upload(storagePath, draft.file.bytes, { contentType: draft.file.mimeType, upsert: false });
    // 同じ内容をすでに置いてある（再公開）場合は、その実体をそのまま使う。
    if (uploadError && !/exists|duplicate/i.test(uploadError.message)) {
      throw new Error(`dd publication upload: ${uploadError.message}`);
    }
    file = {
      storagePath,
      name: draft.file.name,
      mimeType: draft.file.mimeType,
      sizeBytes: String(draft.file.bytes.byteLength),
      sha256: draft.file.sha256,
    };
  }

  const { data, error } = await db.rpc("dd_publish_item", {
    p_item_id: item.id,
    p_actor_member_id: input.actorMemberId,
    p_payload: draft.payload,
    p_source_refs: draft.sourceRefs,
    p_source_as_of: draft.sourceAsOf,
    p_unverified_notes: unverified,
    p_file: file,
    p_note: input.note,
  });
  if (error) throw new Error(`dd publish: ${error.message}`);
  const result = data as { publicationId: string; revision: number; unchanged: boolean };
  return { publicationId: result.publicationId, revision: result.revision, unchanged: result.unchanged };
}

/** 取り下げる。外部に見せる版を無くすだけで、公開版の記録は消さない（追記のみ）。 */
export async function withdrawDdItem(itemId: string, actorMemberId: string): Promise<void> {
  const db = createAdminClient();
  const { error } = await db
    .from("dd_package_items")
    .update({ published_publication_id: null, updated_by_member_id: actorMemberId })
    .eq("id", itemId);
  if (error) throw new Error(`dd withdraw: ${error.message}`);
}

export function ddSectionOrder(key: DdSectionKey): number {
  return DD_SECTIONS.findIndex((section) => section.key === key);
}
