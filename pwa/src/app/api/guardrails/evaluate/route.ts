import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  evaluateGuardrailCards,
  guardrailImportance,
  guardrailNotificationSummary,
  notificationClassForSeverity,
  safeEvidenceRefs,
  type GuardrailCardRow,
  type GuardrailEvaluateInput,
} from "@/lib/management-guardrails";

export const runtime = "nodejs";

type Authz =
  | { ok: true; createdBy: string }
  | { ok: false; response: NextResponse };

async function authorize(req: NextRequest): Promise<Authz> {
  const auth = req.headers.get("authorization") || "";
  const cronSecret = process.env.CRON_SECRET || "";
  if (cronSecret && auth === `Bearer ${cronSecret}`) return { ok: true, createdBy: "guardrail_evaluator" };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) {
    return { ok: false, response: NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 }) };
  }

  const { data: member } = await supabase
    .from("members")
    .select("code_name, is_admin")
    .eq("email", user.email.toLowerCase())
    .maybeSingle();
  if (!member?.is_admin) {
    return { ok: false, response: NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 }) };
  }

  return { ok: true, createdBy: String(member.code_name || user.email) };
}

export async function POST(req: NextRequest) {
  const authz = await authorize(req);
  if (!authz.ok) return authz.response;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ ok: false, error: "json body required" }, { status: 400 });

  const dryRun = body.dry_run === true;
  const items = normalizeItems(body);
  if (items.length === 0) {
    return NextResponse.json({ ok: false, error: "items[] or target_type/target_id required" }, { status: 400 });
  }

  const db = createAdminClient();
  const { data: cardRows, error: cardError } = await db
    .from("guardrail_cards")
    .select("card_id,title,summary,rationale,severity,trigger_tags,negative_tags,check_items,recommended_actions,output_template")
    .eq("status", "active");
  if (cardError) return NextResponse.json({ ok: false, error: cardError.message }, { status: 500 });

  const cards = (cardRows ?? []) as GuardrailCardRow[];
  const evaluations = items.flatMap((item) => (
    evaluateGuardrailCards(cards, item).map((evaluation) => ({ item, evaluation }))
  ));

  if (dryRun) {
    return NextResponse.json({
      ok: true,
      dry_run: true,
      matched: evaluations.length,
      matches: evaluations.map(({ item, evaluation }) => responseMatch(item, evaluation, "dry_run")),
    });
  }

  const sourceHashes = Array.from(new Set(evaluations.map(({ evaluation }) => evaluation.sourceHash)));
  const existingHashes = new Set<string>();
  if (sourceHashes.length > 0) {
    const { data: existing, error: existingError } = await db
      .from("guardrail_matches")
      .select("source_hash")
      .in("source_hash", sourceHashes);
    if (existingError) return NextResponse.json({ ok: false, error: existingError.message }, { status: 500 });
    for (const row of existing ?? []) existingHashes.add(String(row.source_hash));
  }

  const now = new Date().toISOString();
  const results: Array<Record<string, unknown>> = [];
  const errors: Array<Record<string, unknown>> = [];
  let inserted = 0;
  let skipped = 0;
  let notified = 0;

  for (const { item, evaluation } of evaluations) {
    if (existingHashes.has(evaluation.sourceHash)) {
      skipped += 1;
      results.push(responseMatch(item, evaluation, "skipped_duplicate"));
      continue;
    }

    const matchRow = {
      match_id: evaluation.matchId,
      card_id: evaluation.card.card_id,
      project_id: item.project_id ?? null,
      target_type: item.target_type,
      target_id: item.target_id,
      target_title: item.target_title ?? null,
      target_date: item.target_date ?? null,
      project_tags: evaluation.projectTags,
      action_tags: evaluation.actionTags,
      matched_tags: evaluation.matchedTags,
      match_score: evaluation.matchScore,
      severity: evaluation.severity,
      status: "open",
      due_at: item.due_at ?? null,
      source_hash: evaluation.sourceHash,
      evidence_refs_json: safeEvidenceRefs(item.evidence_refs_json),
      created_by: authz.createdBy,
      detected_at: now,
    };

    const { error: matchError } = await db.from("guardrail_matches").insert(matchRow);
    if (matchError) {
      if (String(matchError.code || "") === "23505") {
        skipped += 1;
        existingHashes.add(evaluation.sourceHash);
        results.push(responseMatch(item, evaluation, "skipped_duplicate"));
        continue;
      }
      errors.push({ match_id: evaluation.matchId, card_id: evaluation.card.card_id, error: matchError.message });
      continue;
    }

    inserted += 1;
    existingHashes.add(evaluation.sourceHash);

    const targetForNotification = item.project_id ?? item.target_id ?? item.target_type;
    const notificationRow = {
      l2_kind: "guardrail_match",
      target_id: targetForNotification,
      scope_key: evaluation.matchId,
      title: `経営ガードレール: ${evaluation.card.title}`,
      summary: guardrailNotificationSummary(evaluation),
      saved_count: 1,
      total_count: 1,
      importance: guardrailImportance(evaluation.severity),
      notified_at: now,
      metadata_json: {
        guardrail_kind: "management_guardrail",
        guardrail_card_id: evaluation.card.card_id,
        match_id: evaluation.matchId,
        severity: evaluation.severity,
        notification_priority: notificationClassForSeverity(evaluation.severity),
        target_type: item.target_type,
        target_id: item.target_id,
        target_title: item.target_title ?? null,
        target_date: item.target_date ?? null,
        due_at: item.due_at ?? null,
        match_score: evaluation.matchScore,
        matched_tags: evaluation.matchedTags,
        project_tags: evaluation.projectTags,
        action_tags: evaluation.actionTags,
        check_items: evaluation.card.check_items ?? [],
        recommended_actions: evaluation.card.recommended_actions ?? [],
      },
    };

    const { data: notification, error: notificationError } = await db
      .from("l2_notifications")
      .upsert(notificationRow, { onConflict: "l2_kind,target_id,scope_key" })
      .select("notification_id")
      .single();
    if (notificationError) {
      errors.push({ match_id: evaluation.matchId, card_id: evaluation.card.card_id, error: notificationError.message });
      results.push(responseMatch(item, evaluation, "inserted_without_notification"));
      continue;
    }

    notified += 1;
    await db
      .from("guardrail_matches")
      .update({ notification_id: notification.notification_id, updated_at: now })
      .eq("match_id", evaluation.matchId);
    results.push(responseMatch(item, evaluation, "inserted"));
  }

  return NextResponse.json({
    ok: errors.length === 0,
    matched: evaluations.length,
    inserted,
    skipped,
    notified,
    errors,
    matches: results,
  }, { status: errors.length === 0 ? 200 : 207 });
}

function normalizeItems(body: Record<string, unknown>): GuardrailEvaluateInput[] {
  const rawItems = Array.isArray(body.items) ? body.items : [body];
  return rawItems
    .map((raw) => normalizeItem(raw))
    .filter((item): item is GuardrailEvaluateInput => item != null);
}

function normalizeItem(raw: unknown): GuardrailEvaluateInput | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  const targetType = text(row.target_type);
  const targetId = text(row.target_id);
  if (!targetType || !targetId) return null;
  return {
    project_id: text(row.project_id) || null,
    target_type: targetType,
    target_id: targetId,
    target_title: text(row.target_title) || null,
    target_date: text(row.target_date) || null,
    due_at: text(row.due_at) || null,
    project_tags: row.project_tags ?? {},
    action_tags: row.action_tags ?? {},
    evidence_refs_json: row.evidence_refs_json ?? [],
  };
}

function responseMatch(
  item: GuardrailEvaluateInput,
  evaluation: ReturnType<typeof evaluateGuardrailCards>[number],
  status: string,
): Record<string, unknown> {
  return {
    status,
    match_id: evaluation.matchId,
    card_id: evaluation.card.card_id,
    title: evaluation.card.title,
    severity: evaluation.severity,
    target_type: item.target_type,
    target_id: item.target_id,
    project_id: item.project_id ?? null,
    matched_tags: evaluation.matchedTags,
    match_score: evaluation.matchScore,
  };
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
