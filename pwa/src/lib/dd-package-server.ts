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
import { isDdItemKind, type DdItemKind } from "@/lib/dd-payload";
import { loadDdItemLive, mergeDdUnverifiedNotes, type DdItemLive } from "@/lib/dd-sources";
import { ddPageForItem, type DdPageKey } from "@/lib/dd-pages";
import type { DdLiveData } from "@/lib/dd-payload";

// DD の掲載項目・公開の切り替え・閲覧権限の読み書き（service_role）。
// 公開中（is_published）の項目は、閲覧のたびに元データの最新をワークスペースと同じ形で返す（公開した時点で固定しない）。
// 閲覧者に返すのは「公開中で、有効な項目」だけ。未公開の項目は管理者のプレビューにだけ返す。

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
  is_published: boolean;
  published_at: string | null;
  published_by_member_id: string | null;
  created_at: string;
  updated_at: string;
};

const PACKAGE_FIELDS = "id,project_id,slug,title,notice_text,status,updated_at";
const ITEM_FIELDS =
  "id,package_id,project_id,section_key,item_kind,source_key,source_options,title,summary,unverified_notes,evidence_item_ids,sort_order,status,is_published,published_at,published_by_member_id,created_at,updated_at";

// PJの表示名だけは参照系。認可を終えた後に使い、権限や公開状態はキャッシュしない。
const projectNames = new Map<string, { expiresAt: number; value: Promise<string | null> }>();
function ddProjectName(projectId: string) {
  const cached = projectNames.get(projectId);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  if (projectNames.size >= 256) projectNames.clear();
  const value = Promise.resolve(createAdminClient().from("projects").select("project_name,display_name").eq("project_id", projectId).maybeSingle())
    .then(({ data, error }) => { if (error) throw new Error(error.message); return data?.display_name || data?.project_name || null; })
    .catch((error) => { projectNames.delete(projectId); throw error; });
  projectNames.set(projectId, { expiresAt: Date.now() + 60_000, value });
  return value;
}

async function loadPackage(packageId: string): Promise<DdPackageRow | null> {
  const db = createAdminClient();
  const { data, error } = await db.from("dd_packages").select(PACKAGE_FIELDS).eq("id", packageId).maybeSingle<DdPackageRow>();
  if (error) throw new Error(`dd package load: ${error.message}`);
  return data ?? null;
}

export async function loadDdItem(itemId: string): Promise<DdItemRow | null> {
  const db = createAdminClient();
  const { data, error } = await db.from("dd_package_items").select(ITEM_FIELDS).eq("id", itemId).maybeSingle();
  if (error) throw new Error(`dd item load: ${error.message}`);
  const row = data as unknown as DdItemRow | null;
  if (!row || !isDdItemKind(row.item_kind) || !isDdSectionKey(row.section_key)) return null;
  return row;
}

async function loadActiveItems(packageId: string, options: { includeUnpublished: boolean }): Promise<DdItemRow[]> {
  const db = createAdminClient();
  let query = db.from("dd_package_items").select(ITEM_FIELDS).eq("package_id", packageId).eq("status", "active");
  if (!options.includeUnpublished) query = query.eq("is_published", true);
  const { data, error } = await query.order("sort_order");
  if (error) throw new Error(`dd items: ${error.message}`);
  return ((data ?? []) as unknown as DdItemRow[]).filter((row) => isDdItemKind(row.item_kind) && isDdSectionKey(row.section_key));
}

function includeAutoUnverified(row: DdItemRow): boolean {
  return row.source_options?.autoUnverified !== false;
}

type ItemLiveMeta = { sourceAsOf: string | null; unverifiedNotes: string[]; autoUnverified: string[]; error: string | null };

async function liveMeta(row: DdItemRow): Promise<{ live: DdItemLive | null; meta: ItemLiveMeta }> {
  try {
    const live = await loadDdItemLive({ projectId: row.project_id, itemKind: row.item_kind, sourceKey: row.source_key });
    return {
      live,
      meta: {
        sourceAsOf: live.sourceAsOf,
        unverifiedNotes: mergeDdUnverifiedNotes(row.unverified_notes, live.autoUnverified, includeAutoUnverified(row)),
        autoUnverified: live.autoUnverified,
        error: null,
      },
    };
  } catch (error) {
    return {
      live: null,
      meta: {
        sourceAsOf: null,
        unverifiedNotes: mergeDdUnverifiedNotes(row.unverified_notes, [], false),
        autoUnverified: [],
        error: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

// --- 閲覧者向け ---------------------------------------------------------------------

export type DdViewItem = {
  itemId: string;
  pageKey: DdPageKey;
  live: DdLiveData | null;
  sectionKey: DdSectionKey;
  sortOrder: number;
  itemKind: DdItemKind;
  title: string;
  summary: string | null;
  sourceAsOf: string | null;
  unverifiedNotes: string[];
  /** 元データを読めなかった（削除・移動など）。閲覧者には「いまは表示できない」と出す。 */
  unavailable: boolean;
};

export type DdPackageView = {
  package: DdPackageRow;
  projectName: string;
  sections: Array<{ key: DdSectionKey; label: string; description: string; items: DdViewItem[] }>;
  /** 公開中の項目の元データのうち、いちばん新しい更新日時。 */
  lastUpdatedAt: string | null;
};

/** 公開中の項目を、いまの元データ（更新日時・未確認事項・中身）と一緒に返す。DDトップと正式版（PDF）の出力で使う。 */
export async function loadDdPublishedLive(packageId: string): Promise<Array<{ row: DdItemRow; live: DdItemLive | null; meta: ItemLiveMeta }>> {
  const rows = await loadActiveItems(packageId, { includeUnpublished: false });
  const loaded = await Promise.all(rows.map((row) => liveMeta(row)));
  return rows
    .map((row, index) => ({ row, live: loaded[index].live, meta: loaded[index].meta }))
    .sort((a, b) =>
      ddSectionOrder(a.row.section_key) - ddSectionOrder(b.row.section_key)
      || a.row.sort_order - b.row.sort_order
      || a.row.title.localeCompare(b.row.title, "ja"));
}

/** DDトップ。公開中の項目だけを、いまの元データの更新日時と未確認事項つきで返す（管理者のプレビューでも同じ）。 */
export async function loadDdPackageView(access: DdViewerAccess): Promise<DdPackageView | null> {
  const pkg = await loadPackage(access.packageId);
  if (!pkg) return null;
  const [loaded, projectName] = await Promise.all([
    loadDdPublishedLive(pkg.id),
    ddProjectName(access.projectId),
  ]);
  const items: DdViewItem[] = loaded.map(({ row, meta, live }) => ({
    itemId: row.id,
    pageKey: ddPageForItem(row.item_kind, live?.data ?? null, row.source_key),
    live: live?.data ?? null,
    sectionKey: row.section_key,
    sortOrder: row.sort_order,
    itemKind: row.item_kind,
    title: row.title,
    summary: row.summary,
    sourceAsOf: meta.sourceAsOf,
    unverifiedNotes: meta.unverifiedNotes,
    unavailable: meta.error !== null,
  }));
  return {
    package: pkg,
    projectName: projectName || pkg.title,
    sections: DD_SECTIONS.map((section) => ({
      key: section.key,
      label: section.label,
      description: section.description,
      items: items.filter((item) => item.sectionKey === section.key),
    })),
    lastUpdatedAt: items.reduce<string | null>(
      (latest, item) => (item.sourceAsOf && (!latest || item.sourceAsOf > latest) ? item.sourceAsOf : latest),
      null,
    ),
  };
}

export async function loadDdPackageRow(packageId: string): Promise<DdPackageRow | null> {
  return loadPackage(packageId);
}

export type DdEvidenceLink = { itemId: string; title: string };

export type DdItemView = {
  item: DdItemRow;
  live: DdItemLive | null;
  liveError: string | null;
  unverifiedNotes: string[];
  evidence: DdEvidenceLink[];
};

/**
 * 項目1件の、いまの中身。閲覧者には公開中の有効な項目だけ、管理者のプレビューには未公開の項目も返す。
 * 別パッケージ・外した項目・（閲覧者にとっての）未公開は null（呼び出し側は「見つからない」で閉じる）。
 * 根拠資料は、いま公開中の資料項目だけを返す。
 */
export async function loadDdItemView(access: DdViewerAccess, itemId: string): Promise<DdItemView | null> {
  const row = await loadDdItem(itemId);
  if (!row || row.package_id !== access.packageId || row.status !== "active") return null;
  if (!row.is_published && access.principal !== "internal_admin") return null;
  const db = createAdminClient();
  const [{ live, meta }, evidenceRows] = await Promise.all([
    liveMeta(row),
    row.evidence_item_ids.length > 0
      ? db.from("dd_package_items").select("id,title,item_kind,status,is_published,package_id").in("id", row.evidence_item_ids)
      : Promise.resolve({ data: [] as Array<Record<string, unknown>>, error: null }),
  ]);
  if (evidenceRows.error) throw new Error(`dd evidence: ${evidenceRows.error.message}`);
  const evidence = ((evidenceRows.data ?? []) as Array<Record<string, unknown>>)
    .filter((candidate) =>
      candidate.package_id === access.packageId
      && candidate.item_kind === "document"
      && candidate.status === "active"
      && candidate.is_published === true)
    .map((candidate) => ({ itemId: String(candidate.id), title: String(candidate.title) }));
  return { item: row, live, liveError: meta.error, unverifiedNotes: meta.unverifiedNotes, evidence };
}

export type DdAccessEvent = "dd_package_viewed" | "dd_item_viewed" | "dd_file_opened" | "dd_file_downloaded";

/** 外部アカウントの閲覧・ダウンロードを記録する（管理者プレビューは記録しない）。detail に URL・ファイル名は入れない。 */
export async function recordDdAccessEvent(
  access: DdViewerAccess,
  eventType: DdAccessEvent,
  detail: { itemId?: string } = {},
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
    },
  });
}

// --- 正式版（PDF）の出力 -----------------------------------------------------------

export type DdExportItem = { itemId: string; sourceAsOf: string | null };

/** 正式版（PDF）の出力を記録する。どの項目を、いつの元データで出したかを残す（題名・ファイル名・本文は記録しない）。 */
export async function recordDdPackageExport(input: {
  pkg: DdPackageRow;
  actorEmail: string;
  items: DdExportItem[];
}): Promise<void> {
  await recordWorkspaceAuditEvent(createAdminClient(), {
    eventType: "dd_package_exported",
    email: input.actorEmail,
    projectId: input.pkg.project_id,
    detail: {
      package_id: input.pkg.id,
      item_count: input.items.length,
      items: JSON.stringify(input.items.map((item) => ({ i: item.itemId, a: item.sourceAsOf }))),
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

export type DdAdminItem = DdItemRow & {
  sourceAsOf: string | null;
  sourceError: string | null;
  autoUnverified: string[];
};

export type DdAdminEvent = { id: string; eventType: string; email: string | null; createdAt: string; itemId: string | null };
export type DdAdminExport = { id: string; email: string | null; createdAt: string; itemCount: number };

export type DdAdminState = {
  package: DdPackageRow;
  items: DdAdminItem[];
  grants: DdAdminGrant[];
  events: DdAdminEvent[];
  exports: DdAdminExport[];
};

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

  const [itemsRes, grantsRes, eventsRes] = await Promise.all([
    db.from("dd_package_items").select(ITEM_FIELDS).eq("package_id", pkg.id).order("sort_order"),
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
      .in("event_type", ["dd_package_viewed", "dd_item_viewed", "dd_file_opened", "dd_file_downloaded", "dd_package_exported"])
      .order("created_at", { ascending: false })
      .limit(200),
  ]);
  for (const result of [itemsRes, grantsRes, eventsRes]) {
    if (result.error) throw new Error(`dd admin state: ${result.error.message}`);
  }

  const grantRows = (grantsRes.data ?? []) as Array<Record<string, unknown>>;
  const accountIds = Array.from(new Set(grantRows.map((row) => String(row.user_account_id))));
  const accounts = accountIds.length > 0
    ? await db.from("workspace_user_accounts").select("id,email,status,last_login_at").in("id", accountIds)
    : { data: [], error: null };
  if (accounts.error) throw new Error(`dd admin accounts: ${accounts.error.message}`);
  const accountById = new Map(((accounts.data ?? []) as Array<Record<string, unknown>>).map((row) => [String(row.id), row]));

  const itemRows = ((itemsRes.data ?? []) as unknown as DdItemRow[]).filter((row) => isDdItemKind(row.item_kind) && isDdSectionKey(row.section_key));
  const items: DdAdminItem[] = await Promise.all(
    itemRows.map(async (item) => {
      if (item.status !== "active") return { ...item, sourceAsOf: null, sourceError: null, autoUnverified: [] };
      const { meta } = await liveMeta(item);
      return { ...item, sourceAsOf: meta.sourceAsOf, sourceError: meta.error, autoUnverified: meta.autoUnverified };
    }),
  );

  const eventRows = (eventsRes.data ?? []) as Array<Record<string, unknown>>;
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
    events: eventRows
      .filter((row) => row.event_type !== "dd_package_exported")
      .map((row) => {
        const detail = (row.detail ?? {}) as Record<string, unknown>;
        return {
          id: String(row.id),
          eventType: String(row.event_type),
          email: (row.email as string) ?? null,
          createdAt: String(row.created_at),
          itemId: typeof detail.item_id === "string" ? detail.item_id : null,
        };
      }),
    exports: eventRows
      .filter((row) => row.event_type === "dd_package_exported")
      .map((row) => {
        const detail = (row.detail ?? {}) as Record<string, unknown>;
        return {
          id: String(row.id),
          email: (row.email as string) ?? null,
          createdAt: String(row.created_at),
          itemCount: typeof detail.item_count === "number" ? detail.item_count : 0,
        };
      }),
  };
}

/** 公開する／公開をやめる。公開中の項目は、閲覧のたびに元データの最新を見せる。外した項目は公開できない（DB の制約）。 */
export async function setDdItemPublished(itemId: string, published: boolean, actorMemberId: string): Promise<void> {
  const db = createAdminClient();
  const { error } = await db
    .from("dd_package_items")
    .update(
      published
        ? { is_published: true, published_at: new Date().toISOString(), published_by_member_id: actorMemberId, updated_by_member_id: actorMemberId }
        : { is_published: false, updated_by_member_id: actorMemberId },
    )
    .eq("id", itemId);
  if (error) throw new Error(`dd publish toggle: ${error.message}`);
}

export function ddSectionOrder(key: DdSectionKey): number {
  return DD_SECTIONS.findIndex((section) => section.key === key);
}
