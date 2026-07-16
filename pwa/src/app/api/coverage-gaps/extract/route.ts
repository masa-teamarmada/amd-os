import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

// OS Coverage Scanner (不在検知 / negative space) の取り込み口。
// daily consolidated routine (cloud Claude) の Phase M が、5生データを ungated にスイープし、
// 「重要そうなのに既存L2のどれにも構造化されていない」候補を POST する。
// dedup は source_hash。confirmed/rejected 済みは上書きしない。
// 設計: pwa/design/coverage_gap_scanner.md
// 「これはもう1個の抽出器ではない」= 来た生データ × 既存L2カバレッジ の差分(補集合)を貯める。

type GapCandidate = {
  source: string;                       // gmail/drive/calendar/slack/notion (必須)
  source_ref?: string | null;
  source_hash: string;                  // 必須 (dedup)
  title?: string | null;
  summary?: string | null;
  salience_score?: number | null;       // 0-1
  matched_patterns?: unknown;           // jsonb
  proposed_target_l2?: string | null;   // action_item/registry_diff/strategy_signal/shareholder_meeting/... or null(未確定)
  gap_class?: string | null;            // extractor_miss / structural_gap / uncertain
  project_id?: string | null;
  scope?: string | null;                // project/company/personal/unknown
  due_at?: string | null;
  evidence_refs_json?: unknown;
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

const VALID_GAP_CLASS = new Set(["extractor_miss", "structural_gap", "uncertain"]);

function normalizeTarget(value: string | null | undefined): string {
  const v = String(value ?? "").trim().toLowerCase();
  if (v === "project_strategy_signal") return "strategy_signal";
  if (v === "registry_diff" || v === "project_registry_diff") return "registry_diff";
  return v;
}

function coverageNotificationSubject(raw: string | null | undefined, fallback: string): string {
  let s = String(raw || fallback || "").trim();
  s = s
    .replace(/^未OS化(?:の可能性|候補)?[:：]\s*/, "")
    .replace(/^(?:D-6\s*)?経営ハイライトに残す[？?][:：]\s*/, "")
    .replace(/^OSに残す[？?][:：]\s*/, "")
    .trim();
  const h1Match = s.match(/^H-1\s*要約で(.+?)が(?:薄まった|弱まった)可能性[:：]\s*(.+)$/);
  if (h1Match) return `${h1Match[1].trim()} / ${h1Match[2].trim()}`;
  return s || fallback;
}

function coverageNotificationTitle(it: GapCandidate): string {
  const target = normalizeTarget(it.proposed_target_l2);
  const prefix = target === "strategy_signal" ? "経営ハイライトに残す？" : "OSに残す？";
  return `${prefix}: ${coverageNotificationSubject(it.title, it.source)}`.slice(0, 300);
}

export async function POST(req: NextRequest) {
  if (!(await authorize(req))) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const items: GapCandidate[] = Array.isArray(body?.items) ? body.items : [];
  if (items.length === 0) return NextResponse.json({ ok: false, error: "items[] required" }, { status: 400 });

  const db = createAdminClient();

  // 既存 source_hash を引いて、新規だけ insert (confirmed/rejected を壊さない)
  const hashes = items.map((i) => i.source_hash).filter(Boolean);
  const { data: existing } = await db.from("l2_coverage_gaps").select("source_hash").in("source_hash", hashes);
  const known = new Set((existing ?? []).map((r) => r.source_hash as string));

  const nowIso = new Date().toISOString();
  let inserted = 0;
  let skipped = 0;
  const notifications: Record<string, unknown>[] = [];

  for (const it of items) {
    if (!it.source || !it.source_hash) { skipped++; continue; }
    if (known.has(it.source_hash)) { skipped++; continue; }

    const gapId = `cg:${it.source_hash}`.slice(0, 120);
    const projectId = it.project_id ?? null;
    const scope = it.scope || (projectId ? "project" : "unknown");
    // gap_class が未指定/不正なら、target 提案の有無から推定する。
    const gapClass = it.gap_class && VALID_GAP_CLASS.has(it.gap_class)
      ? it.gap_class
      : (it.proposed_target_l2 ? "extractor_miss" : "uncertain");

    const { error } = await db.from("l2_coverage_gaps").insert({
      gap_id: gapId,
      source: it.source,
      source_ref: it.source_ref ?? null,
      source_hash: it.source_hash,
      title: it.title ? String(it.title).slice(0, 300) : null,
      summary: it.summary ?? null,
      salience_score: it.salience_score ?? null,
      matched_patterns: it.matched_patterns ?? null,
      proposed_target_l2: it.proposed_target_l2 ?? null,
      gap_class: gapClass,
      project_id: projectId,
      scope,
      due_at: it.due_at ?? null,
      evidence_refs_json: it.evidence_refs_json ?? null,
      review_status: "candidate",
      created_by: "coverage_scanner",
      detected_at: nowIso,
    });
    if (error) { skipped++; continue; }
    inserted++;
    known.add(it.source_hash);

    // 期日があれば近いほど、無くても structural_gap は埋もれさせないため importance を上げる。
    const days = it.due_at ? Math.floor((new Date(it.due_at).getTime() - Date.now()) / 86400000) : null;
    const importance = days != null && days <= 3 ? 9
      : days != null && days <= 7 ? 8
      : gapClass === "structural_gap" ? 7
      : 5;
    notifications.push({
      l2_kind: "coverage_gap",
      target_id: projectId ?? scope,
      scope_key: gapId,
      title: coverageNotificationTitle(it),
      summary: it.summary ?? null,
      saved_count: 0,
      total_count: 1,
      importance,
      notified_at: nowIso,
      metadata_json: {
        due_at: it.due_at ?? null,
        gap_class: gapClass,
        proposed_target_l2: it.proposed_target_l2 ?? null,
        salience_score: it.salience_score ?? null,
        source: it.source,
      },
    });
  }

  let notified = 0;
  if (notifications.length > 0) {
    const { error: notifyErr } = await db.from("l2_notifications").insert(notifications);
    if (!notifyErr) notified = notifications.length;
  }

  return NextResponse.json({ ok: true, inserted, skipped, notified });
}
