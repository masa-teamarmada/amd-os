import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  BusinessCard,
  BusinessCardProject,
  BusinessCardProjectOption,
  BusinessCardStatus,
} from "@/lib/business-card-types";

type AdminClient = SupabaseClient;

export type BusinessCardRow = {
  id: string;
  full_name: string | null;
  full_name_kana: string | null;
  company_name: string | null;
  department: string | null;
  job_title: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  postal_code: string | null;
  address: string | null;
  website: string | null;
  relationship_note: string | null;
  met_on: string | null;
  raw_ocr_text: string | null;
  field_confidence: unknown;
  ocr_confidence: number | string | null;
  ocr_model: string | null;
  ocr_error: string | null;
  status: string;
  original_file_name: string | null;
  mime_type: string;
  file_size_bytes: number | string;
  captured_at: string;
  created_by_email: string;
  confirmed_at: string | null;
  updated_at: string;
};

type LinkRow = {
  business_card_id: string;
  project_id: string;
  project_knowledge_id: string | null;
};

type ProjectRow = {
  project_id: string;
  project_name: string | null;
};

export function cleanText(value: unknown, maxLength = 500): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

export function nullableText(value: unknown, maxLength = 500): string | null {
  const text = cleanText(value, maxLength);
  return text || null;
}

export function normalizeEmail(value: unknown): string | null {
  const text = cleanText(value, 320).toLowerCase();
  return text && text.includes("@") ? text : null;
}

export function normalizePhone(value: unknown): string | null {
  const digits = cleanText(value, 80).replace(/[^0-9+]/g, "");
  return digits.length >= 7 ? digits : null;
}

export function clampConfidence(value: unknown): number | null {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.max(0, Math.min(1, number));
}

export function sanitizeFieldConfidence(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result: Record<string, number> = {};
  for (const [key, raw] of Object.entries(value)) {
    const confidence = clampConfidence(raw);
    if (confidence !== null) result[key.slice(0, 80)] = confidence;
  }
  return result;
}

export async function requireAmdMember(admin: AdminClient, email: string) {
  const normalizedEmail = email.toLowerCase();
  const { data, error } = await admin
    .from("members")
    .select("member_id,is_admin")
    .eq("email", normalizedEmail)
    .maybeSingle();
  if (error) throw error;
  if (!data?.member_id) return null;
  return {
    memberId: String(data.member_id),
    isAdmin: Boolean(data.is_admin),
    email: normalizedEmail,
  };
}

export async function loadBusinessCardProjects(
  admin: AdminClient,
): Promise<BusinessCardProjectOption[]> {
  const { data, error } = await admin
    .from("projects")
    .select("project_id,project_name")
    .eq("status", "active")
    .order("project_name", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as ProjectRow[])
    .filter((row) => row.project_id && row.project_name)
    .map((row) => ({
      projectId: row.project_id,
      projectName: row.project_name || row.project_id,
    }));
}

export async function mapBusinessCards(
  admin: AdminClient,
  rows: BusinessCardRow[],
): Promise<BusinessCard[]> {
  if (rows.length === 0) return [];
  const cardIds = rows.map((row) => row.id);
  const { data: links, error: linkError } = await admin
    .from("business_card_project_links")
    .select("business_card_id,project_id,project_knowledge_id")
    .in("business_card_id", cardIds);
  if (linkError) throw linkError;

  const projectIds = Array.from(
    new Set(((links ?? []) as LinkRow[]).map((row) => row.project_id)),
  );
  const projectNameById = new Map<string, string>();
  if (projectIds.length > 0) {
    const { data: projects, error: projectError } = await admin
      .from("projects")
      .select("project_id,project_name")
      .in("project_id", projectIds);
    if (projectError) throw projectError;
    for (const row of (projects ?? []) as ProjectRow[]) {
      projectNameById.set(row.project_id, row.project_name || row.project_id);
    }
  }

  const projectsByCard = new Map<string, BusinessCardProject[]>();
  for (const link of (links ?? []) as LinkRow[]) {
    const items = projectsByCard.get(link.business_card_id) ?? [];
    items.push({
      projectId: link.project_id,
      projectName: projectNameById.get(link.project_id) || link.project_id,
      projectKnowledgeId: link.project_knowledge_id,
    });
    projectsByCard.set(link.business_card_id, items);
  }

  return rows.map((row) => ({
    id: row.id,
    fullName: row.full_name || "",
    fullNameKana: row.full_name_kana || "",
    companyName: row.company_name || "",
    department: row.department || "",
    jobTitle: row.job_title || "",
    email: row.email || "",
    phone: row.phone || "",
    mobile: row.mobile || "",
    postalCode: row.postal_code || "",
    address: row.address || "",
    website: row.website || "",
    relationshipNote: row.relationship_note || "",
    metOn: row.met_on || "",
    rawOcrText: row.raw_ocr_text || "",
    fieldConfidence: sanitizeFieldConfidence(row.field_confidence),
    ocrConfidence: clampConfidence(row.ocr_confidence),
    ocrModel: row.ocr_model || "",
    ocrError: row.ocr_error || "",
    status: row.status as BusinessCardStatus,
    imageUrl: `/api/business-cards/${encodeURIComponent(row.id)}/image`,
    originalFileName: row.original_file_name || "",
    mimeType: row.mime_type,
    fileSizeBytes: Number(row.file_size_bytes) || 0,
    capturedAt: row.captured_at,
    createdByEmail: row.created_by_email,
    confirmedAt: row.confirmed_at,
    updatedAt: row.updated_at,
    projects: (projectsByCard.get(row.id) ?? []).sort((a, b) =>
      a.projectName.localeCompare(b.projectName, "ja"),
    ),
  }));
}

export function buildBusinessCardKnowledgeFact(card: {
  fullName: string;
  companyName: string;
  department: string;
  jobTitle: string;
  relationshipNote: string;
  metOn: string;
}): string {
  const affiliation = [card.companyName, card.department, card.jobTitle]
    .filter(Boolean)
    .join(" / ");
  const lines = [
    affiliation ? `${card.fullName} — ${affiliation}` : card.fullName,
    card.relationshipNote ? `接点: ${card.relationshipNote}` : "",
    card.metOn ? `接点日: ${card.metOn}` : "",
    "名刺確認済み。連絡先は名刺管理で確認できる。",
  ].filter(Boolean);
  return lines.join("。 ").slice(0, 500);
}

export async function syncBusinessCardKnowledge(params: {
  admin: AdminClient;
  cardId: string;
  projectIds: string[];
  editorEmail: string;
  card: {
    fullName: string;
    companyName: string;
    department: string;
    jobTitle: string;
    relationshipNote: string;
    metOn: string;
  };
}) {
  const { admin, cardId, editorEmail, card } = params;
  const projectIds = Array.from(new Set(params.projectIds.filter(Boolean)));
  const validProjects = await loadBusinessCardProjects(admin);
  const validProjectIds = new Set(validProjects.map((project) => project.projectId));
  if (projectIds.some((projectId) => !validProjectIds.has(projectId))) {
    throw new Error("active ではないPJが含まれてるよ");
  }

  const { data: currentLinks, error: currentError } = await admin
    .from("business_card_project_links")
    .select("business_card_id,project_id,project_knowledge_id")
    .eq("business_card_id", cardId);
  if (currentError) throw currentError;
  const current = (currentLinks ?? []) as LinkRow[];
  const target = new Set(projectIds);
  const removed = current.filter((link) => !target.has(link.project_id));

  for (const link of removed) {
    if (link.project_knowledge_id) {
      const { count, error: countError } = await admin
        .from("business_card_project_links")
        .select("business_card_id", { count: "exact", head: true })
        .eq("project_knowledge_id", link.project_knowledge_id)
        .neq("business_card_id", cardId);
      if (countError) throw countError;
      if ((count ?? 0) === 0) {
        const { error: knowledgeError } = await admin
          .from("project_knowledge")
          .update({ status: "inactive", updated_at: new Date().toISOString() })
          .eq("id", link.project_knowledge_id);
        if (knowledgeError) throw knowledgeError;
      }
    }
  }
  if (removed.length > 0) {
    const { error: deleteError } = await admin
      .from("business_card_project_links")
      .delete()
      .eq("business_card_id", cardId)
      .in(
        "project_id",
        removed.map((link) => link.project_id),
      );
    if (deleteError) throw deleteError;
  }

  const currentByProject = new Map(current.map((link) => [link.project_id, link]));
  const factText = buildBusinessCardKnowledgeFact(card);
  const now = new Date().toISOString();

  for (const projectId of projectIds) {
    const currentLink = currentByProject.get(projectId);
    let knowledgeId = currentLink?.project_knowledge_id || null;

    if (!knowledgeId) {
      const { data: matching, error: matchingError } = await admin
        .from("project_knowledge")
        .select("id")
        .eq("project_id", projectId)
        .eq("category", "people")
        .eq("entity_name", card.fullName)
        .eq("source", "business_card")
        .limit(1)
        .maybeSingle();
      if (matchingError) throw matchingError;
      knowledgeId = matching?.id ? String(matching.id) : null;
    }

    if (knowledgeId) {
      const { error: updateError } = await admin
        .from("project_knowledge")
        .update({
          entity_name: card.fullName,
          fact_text: factText,
          confidence: "high",
          source: "business_card",
          status: "active",
          updated_at: now,
        })
        .eq("id", knowledgeId);
      if (updateError) throw updateError;
    } else {
      const { data: inserted, error: insertError } = await admin
        .from("project_knowledge")
        .insert({
          project_id: projectId,
          category: "people",
          entity_name: card.fullName,
          fact_text: factText,
          confidence: "high",
          source: "business_card",
          status: "active",
          updated_at: now,
        })
        .select("id")
        .single();
      if (insertError || !inserted?.id) {
        throw insertError || new Error("PJ knowledge の作成に失敗したよ");
      }
      knowledgeId = String(inserted.id);
    }

    const { error: linkError } = await admin
      .from("business_card_project_links")
      .upsert(
        {
          business_card_id: cardId,
          project_id: projectId,
          project_knowledge_id: knowledgeId,
          created_by_email: editorEmail,
          updated_at: now,
        },
        { onConflict: "business_card_id,project_id" },
      );
    if (linkError) throw linkError;
  }
}
