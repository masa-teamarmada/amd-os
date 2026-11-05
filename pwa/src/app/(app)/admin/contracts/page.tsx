import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContractsClient } from "@/components/contracts/ContractsClient";
import { todayJst } from "@/lib/admin-schedule/date";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { absolute: "Admin 契約 - AMD OS" } };

export default async function ContractsPage({ searchParams }: { searchParams: Promise<{ contractId?: string; projectId?: string; view?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) notFound();

  const { data: member } = await supabase
    .from("members")
    .select("is_admin")
    .eq("email", user.email.toLowerCase())
    .maybeSingle();

  if (!member?.is_admin) notFound();

  const { contractId, projectId, view } = await searchParams;
  return <ContractsClient initialContractId={contractId} initialProjectId={projectId} initialView={view === "terms" || view === "all" ? view : "basic"} today={todayJst()} />;
}
