import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/supabase/api-auth";
import {
  decideBudgetApproval,
  verifyBudgetApprovalToken,
  type BudgetApprovalDecision,
} from "@/lib/budget-approval";

export const runtime = "nodejs";

function yen(value: number): string {
  return `¥${Math.round(value).toLocaleString()}`;
}

function esc(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch] || ch));
}

function ymLabel(ym: string): string {
  if (!/^\d{6}$/.test(ym)) return ym;
  return `${ym.slice(0, 4)}年${Number(ym.slice(4, 6))}月`;
}

function html(title: string, body: string, status = 200) {
  return new NextResponse(
    `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#f5f5f7;margin:0;display:grid;min-height:100vh;place-items:center;color:#1d1d1f}.box{width:min(520px,calc(100vw - 32px));background:#fff;border:1px solid #d2d2d7;border-radius:12px;padding:24px;box-shadow:0 16px 50px rgba(0,0,0,.08)}h1{font-size:20px;margin:0 0 12px}.meta{font-size:13px;color:#6e6e73;line-height:1.7}.ok{color:#047857;font-weight:700}.warn{color:#b45309;font-weight:700}.err{color:#b91c1c;font-weight:700}a{color:#0f766e}</style></head><body><main class="box">${body}</main></body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

function normalizeDecision(value: string | null | undefined): BudgetApprovalDecision | null {
  if (value === "approve" || value === "reject") return value;
  return null;
}

async function projectLabel(projectId: string) {
  const db = createAdminClient();
  const { data } = await db
    .from("projects")
    .select("project_name")
    .eq("project_id", projectId)
    .maybeSingle();
  return data?.project_name || projectId;
}

async function canApproveBudget(db: ReturnType<typeof createAdminClient>, email: string, projectId: string): Promise<boolean> {
  const normalizedEmail = email.toLowerCase();
  const { data: member, error: memberError } = await db
    .from("members")
    .select("member_id, is_admin")
    .eq("email", normalizedEmail)
    .maybeSingle();
  if (memberError) throw memberError;
  if (!member) return false;
  if (member.is_admin) return true;

  const { data: projectMember, error: projectMemberError } = await db
    .from("project_members")
    .select("member_id")
    .eq("project_id", projectId)
    .eq("member_id", member.member_id)
    .eq("is_pl", true)
    .eq("is_active", true)
    .maybeSingle();
  if (projectMemberError) throw projectMemberError;
  return Boolean(projectMember);
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") || "";
  const decision = normalizeDecision(req.nextUrl.searchParams.get("mode"));
  try {
    if (!decision) throw new Error("invalid mode");
    const payload = verifyBudgetApprovalToken(token);
    const projectName = await projectLabel(payload.projectId);
    const db = createAdminClient();
    const result = await decideBudgetApproval(db, {
      projectId: payload.projectId,
      ym: payload.ym,
      decision,
      actor: payload.recipientSlackId ? `slack:${payload.recipientSlackId}` : "slack:budget-approval",
      note: decision === "approve" ? "Slack button: approved" : "Slack button: rejected",
    });
    if (decision === "approve") {
      return html(
        "予算承認完了 - AMD OS",
        `<h1 class="ok">予算を確定してOSへ反映したよ</h1><p class="meta">PJ: <strong>${esc(projectName)}</strong><br>稼働月: ${esc(ymLabel(payload.ym))}<br>請求額: ${yen(result.invoiceYen)}<br>バッファ: ${yen(result.bufferYen)}<br>PJ予算: ${yen(result.budgetYen)}</p>`
      );
    }
    return html(
      "予算差し戻し完了 - AMD OS",
      `<h1 class="warn">請求額確定を差し戻したよ</h1><p class="meta">PJ: <strong>${esc(projectName)}</strong><br>稼働月: ${esc(ymLabel(payload.ym))}<br>請求額: ${yen(result.invoiceYen)}<br>バッファ: ${yen(result.bufferYen)}<br>PJ予算: ${yen(result.budgetYen)}</p>`
    );
  } catch (e) {
    return html("予算承認エラー - AMD OS", `<h1 class="err">反映できなかった</h1><p class="meta">${esc(e instanceof Error ? e.message : String(e))}</p>`, 400);
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.errorResponse;

  try {
    const body = (await req.json()) as { projectId?: string; ym?: string; decision?: string; note?: string | null };
    const decision = normalizeDecision(body.decision);
    if (!body.projectId || !/^\d{6}$/.test(body.ym || "") || !decision) {
      return NextResponse.json({ ok: false, error: "missing or invalid fields" }, { status: 400 });
    }
    const projectId = body.projectId;
    const ym = body.ym as string;

    const db = createAdminClient();
    const allowed = await canApproveBudget(db, auth.user.email, projectId);
    if (!allowed) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

    const result = await decideBudgetApproval(db, {
      projectId,
      ym,
      decision,
      actor: auth.user.email.toLowerCase(),
      note: body.note ?? null,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
