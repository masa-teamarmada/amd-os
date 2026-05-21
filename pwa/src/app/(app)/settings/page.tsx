import { notFound } from "next/navigation";
import { OperationsSettingsClient } from "@/components/settings/OperationsSettingsClient";
import { cronOperations, l2Datasets, rawDataSources } from "@/lib/operations-catalog";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const email = user?.email?.toLowerCase() ?? "";
  if (!email) notFound();

  const { data: member } = await supabase
    .from("members")
    .select("is_admin")
    .eq("email", email)
    .maybeSingle();
  if (!member?.is_admin) notFound();

  return (
    <OperationsSettingsClient
      rawDataSources={rawDataSources}
      l2Datasets={l2Datasets}
      cronOperations={cronOperations}
    />
  );
}
