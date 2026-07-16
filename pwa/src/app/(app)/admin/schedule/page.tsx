import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminScheduleClient } from "@/components/admin/AdminScheduleClient";
import { annualRange, todayJst } from "@/lib/admin-schedule/date";
import { loadScheduleView } from "@/lib/admin-schedule/read";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { absolute: "運営カレンダー - AMD OS" } };

export default async function AdminSchedulePage() {
  const supabase = await createClient();
  const year = Number(todayJst().slice(0, 4));
  const data = await loadScheduleView(supabase, annualRange(year));
  return <Suspense fallback={<div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">運営カレンダーを読み込み中…</div>}><AdminScheduleClient initialData={data} /></Suspense>;
}
