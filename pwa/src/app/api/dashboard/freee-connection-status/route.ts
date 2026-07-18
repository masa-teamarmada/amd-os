import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/api-auth";

export const runtime = "nodejs";

const FRESHNESS_WINDOW_MS = 24 * 60 * 60 * 1000;

type ConnectionState = "connected" | "attention" | "unlinked";

function isFresh(value: string | null) {
  if (!value) return false;
  const timestamp = Date.parse(value);
  const age = Date.now() - timestamp;
  return Number.isFinite(timestamp) && age >= 0 && age <= FRESHNESS_WINDOW_MS;
}

function statusResponse(
  state: ConnectionState,
  plImportedAt: string | null,
  cashBalanceImportedAt: string | null,
) {
  return NextResponse.json({
    ok: true,
    checkedAt: new Date().toISOString(),
    state,
    plImportedAt,
    cashBalanceImportedAt,
  });
}

/** Dashboard用のfreee連携状態。認可情報の中身は読まず、同期済み実績だけで判定する。 */
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.errorResponse;

  try {
    const db = createAdminClient();
    const [connectionRes, plRes, cashBalanceRes] = await Promise.all([
      db
        .from("freee_oauth_tokens")
        .select("token_key,updated_at")
        .eq("token_key", "default")
        .maybeSingle(),
      db
        .from("company_actual_monthly")
        .select("imported_at")
        .like("source_ref", "freee:trial_pl:%")
        .order("imported_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      db
        .from("company_actual_monthly")
        .select("imported_at")
        .like("source_ref", "freee:wallet_txns_balance:%")
        .order("imported_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (connectionRes.error || plRes.error || cashBalanceRes.error)
      return statusResponse("attention", null, null);

    const plImportedAt = plRes.data?.imported_at ?? null;
    const cashBalanceImportedAt = cashBalanceRes.data?.imported_at ?? null;
    const connectionConfigured =
      Boolean(connectionRes.data) || Boolean(process.env.FREEE_REFRESH_TOKEN);

    if (!connectionConfigured)
      return statusResponse("unlinked", plImportedAt, cashBalanceImportedAt);

    return statusResponse(
      isFresh(plImportedAt) && isFresh(cashBalanceImportedAt)
        ? "connected"
        : "attention",
      plImportedAt,
      cashBalanceImportedAt,
    );
  } catch {
    return statusResponse("attention", null, null);
  }
}
