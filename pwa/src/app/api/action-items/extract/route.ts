import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

// 要対応スイープの取り込み口。daily consolidated routine (cloud Claude) が Gmail 等を
// 読んで分類した「要対応候補」を POST し、action_items に candidate として upsert + 通知化する。
// dedup は source_hash。confirmed/rejected 済みは上書きしない。
// 設計: pwa/design/governance_action_items.md

type Candidate = {
  title: string;
  summary?: string | null;
  due_at?: string | null;
  category?: string | null;       // governance/legal/finance/contract/hr/tax/admin/other
  priority?: string | null;       // critical/high/medium/low
  action_url?: string | null;
  source?: string | null;         // gmail/drive/calendar/slack/notion
  source_ref?: string | null;
  source_hash: string;            // 必須 (dedup)
  project_id?: string | null;
  scope?: string | null;          // project/company/personal
};

async function authorize(req: NextRequest): Promise<boolean> {
  const auth = req.headers.get("authorization") || "";
  const cronSecret = process.env.CRON_SECRET || "";
  if (cronSecret && auth === `Bearer ${cronSecret}`) return true;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return false;
  const { data: member } = await supabase.from("members").select("is_admin").eq("email", user.email.toLowerCase()).maybeSingle();
  return !!member?.is_admin;
}

export async function POST(req: NextRequest) {
  if (!(await authorize(req))) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const items: Candidate[] = Array.isArray(body?.items) ? body.items : [];
  if (items.length === 0) return NextResponse.json({ ok: false, error: "items[] required" }, { status: 400 });

  const db = createAdminClient();

  // 既存 source_hash を引いて、新規だけ insert (confirmed/rejected を壊さない)
  const hashes = items.map((i) => i.source_hash).filter(Boolean);
  const { data: existing } = await db.from("action_items").select("source_hash").in("source_hash", hashes);
  const known = new Set((existing ?? []).map((r) => r.source_hash as string));

  const nowIso = new Date().toISOString();
  let inserted = 0;
  let skipped = 0;
  const notifications: Record<string, unknown>[] = [];

  for (const it of items) {
    if (!it.title || !it.source_hash) { skipped++; continue; }
    if (known.has(it.source_hash)) { skipped++; continue; }

    const actionId = `ai:${it.source_hash}`.slice(0, 120);
    const projectId = it.project_id ?? null;
    const scope = it.scope || (projectId ? "project" : "personal");

    const { error } = await db.from("action_items").insert({
      action_id: actionId,
      project_id: projectId,
      scope,
      category: it.category ?? "other",
      title: String(it.title).slice(0, 300),
      summary: it.summary ?? null,
      due_at: it.due_at ?? null,
      status: "open",
      priority: it.priority ?? null,
      action_url: it.action_url ?? null,
      assignee_member_id: "ID001",
      source: it.source ?? "gmail",
      source_ref: it.source_ref ?? null,
      source_hash: it.source_hash,
      detected_at: nowIso,
      review_status: "candidate",
    });
    if (error) { skipped++; continue; }
    inserted++;
    known.add(it.source_hash);

    // 期日が近いほど importance を上げて通知化
    const days = it.due_at ? Math.floor((new Date(it.due_at).getTime() - Date.now()) / 86400000) : null;
    const importance = days != null && days <= 3 ? 9 : days != null && days <= 7 ? 7 : 5;
    notifications.push({
      notification_id: `n:${actionId}`.slice(0, 120),
      l2_kind: "action_item",
      target_id: projectId ?? scope,
      scope_key: actionId,
      title: `要対応: ${String(it.title).slice(0, 120)}`,
      summary: it.summary ?? null,
      saved_count: 1,
      total_count: 1,
      importance,
      notified_at: nowIso,
      metadata_json: { due_at: it.due_at ?? null, action_url: it.action_url ?? null, category: it.category ?? "other" },
    });
  }

  if (notifications.length > 0) {
    await db.from("l2_notifications").upsert(notifications, { onConflict: "notification_id" });
  }

  return NextResponse.json({ ok: true, inserted, skipped, notified: notifications.length });
}
