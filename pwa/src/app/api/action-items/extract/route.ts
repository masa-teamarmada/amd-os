import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CONTRACT_STATUSES } from "@/lib/contracts";

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
  // 契約台帳を更新する通知は、推測ではなくこの exact ID を上流が渡した場合だけ作る。
  contract_id?: string | null;
  contract_status_after?: string | null;
};
const ALLOWED_SOURCES = new Set(["gmail", "drive", "calendar", "slack", "notion"]);
const CONTRACT_STATUS_SET = new Set<string>(CONTRACT_STATUSES);

function normalizeSource(source: string | null | undefined) {
  if (!source) return "gmail";
  const normalized = source.trim().toLowerCase();
  return ALLOWED_SOURCES.has(normalized) ? normalized : null;
}

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
  let suppressed = 0;
  const notifications: Record<string, unknown>[] = [];

  for (const it of items) {
    if (!it.title || !it.source_hash) { skipped++; continue; }
    if (known.has(it.source_hash)) { skipped++; continue; }
    const source = normalizeSource(it.source);
    if (!source) { skipped++; continue; }

    const actionId = `ai:${it.source_hash}`.slice(0, 120);
    const projectId = it.project_id ?? null;
    const scope = it.scope || (projectId ? "project" : "personal");
    const requestedContractId = String(it.contract_id ?? "").trim();
    const requestedNextStatus = String(it.contract_status_after ?? "").trim();
    const isContractAction = it.category === "contract" || /契約|DocuSign/i.test(`${it.title}\n${it.summary ?? ""}`);
    let contractMeta: Record<string, string> | null = null;
    // project/date/title から契約を類推しない。実在する contract_id と許可済みの次状態が
    // 同時に渡された場合だけ、通知へ契約台帳の変更契約を載せる。
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestedContractId)
      && CONTRACT_STATUS_SET.has(requestedNextStatus)) {
      let contractQuery = db
        .from("contracts")
        .select("contract_id, project_id, contract_title, counterparty_name, contract_type, status")
        .eq("contract_id", requestedContractId);
      if (projectId) contractQuery = contractQuery.eq("project_id", projectId);
      const { data: contract } = await contractQuery.maybeSingle();
      if (contract) {
        contractMeta = {
          contract_id: String(contract.contract_id),
          contract_title: String(contract.contract_title),
          counterparty_name: String(contract.counterparty_name ?? "未登録"),
          contract_type: String(contract.contract_type),
          contract_status: String(contract.status),
          contract_status_after: requestedNextStatus,
        };
      }
    }
    const metadataJson = {
      category: it.category ?? "other",
      due_at: it.due_at ?? null,
      action_url: it.action_url ?? null,
      ...(isContractAction && !contractMeta ? {
        notification_suppressed_reason: "missing_contract_identity",
        missing_contract_fields: ["contract_id", "contract_title", "counterparty_name", "contract_status", "contract_status_after"],
      } : {}),
      ...(contractMeta ?? {}),
    };

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
      source,
      source_ref: it.source_ref ?? null,
      source_hash: it.source_hash,
      detected_at: nowIso,
      // 契約を特定できないものは、まさの判断待ちにせず生成側の要補完として残す。
      review_status: isContractAction && !contractMeta ? "needs_source" : "candidate",
      metadata_json: metadataJson,
    });
    if (error) { skipped++; continue; }
    inserted++;
    known.add(it.source_hash);

    if (isContractAction && !contractMeta) {
      suppressed++;
      continue;
    }

    // 期日が近いほど importance を上げて通知化。
    // notification_id は uuid default (gen_random_uuid)。dedup は action_items の source_hash
    // で上流担保済 (= 既存 action_item は skip され、ここに到達しない) ので重複通知は出ない。
    const days = it.due_at ? Math.floor((new Date(it.due_at).getTime() - Date.now()) / 86400000) : null;
    const importance = days != null && days <= 3 ? 9 : days != null && days <= 7 ? 7 : 5;
    notifications.push({
      l2_kind: "action_item",
      target_id: projectId ?? scope,
      scope_key: actionId,
      title: `要対応: ${String(it.title).slice(0, 120)}`,
      summary: it.summary ?? null,
      saved_count: 1,
      total_count: 1,
      importance,
      notified_at: nowIso,
      metadata_json: metadataJson,
    });
  }

  let notified = 0;
  if (notifications.length > 0) {
    const { error: notifyErr } = await db.from("l2_notifications").insert(notifications);
    if (!notifyErr) notified = notifications.length;
  }

  return NextResponse.json({ ok: true, inserted, skipped, suppressed, notified });
}
