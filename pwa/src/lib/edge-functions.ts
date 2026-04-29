import { createClient } from "@/lib/supabase/client";

/** Edge Function を呼び出す共通ラッパー */
async function invokeFunction<T = unknown>(
  name: string,
  body: Record<string, unknown>
): Promise<{ ok: boolean; data?: T; error?: string }> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) return { ok: false, error: "Not authenticated" };

  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/${name}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    },
    body: JSON.stringify(body),
  });

  const json = await res.json();

  if (!res.ok || json.ok === false) {
    return { ok: false, error: json.error || `HTTP ${res.status}` };
  }

  return { ok: true, data: json as T };
}

/** Billing状態遷移 */
export function invokeBillingAction(payload: {
  action: string;
  project_id: string;
  ym: string;
  note?: string;
  budget_reported_amount?: number;
}) {
  return invokeFunction("billing-action", payload);
}

/** freee請求書操作 */
export function invokeFreeeInvoice(payload: {
  action: string;
  project_id: string;
  ym: string;
  issue_date?: string;
  due_date?: string;
  base_lines?: { description: string; quantity?: number; unit_price: number }[];
  subject?: string;
  remark?: string;
  template_id?: string;
  extra_lines?: { description: string; quantity?: number; unit_price: number }[];
}) {
  return invokeFunction("freee-invoice", payload);
}

/** 立替精算操作 */
export function invokeReimburse(payload: {
  action: string;
  project_id?: string;
  id?: string;
  ym?: string;
  [key: string]: unknown;
}) {
  return invokeFunction("reimburse-action", payload);
}
