import { notFound, redirect } from "next/navigation";
import { getCurrentMemberAccess } from "@/lib/project-workspace";
import { isUuid } from "@/lib/dd-package-core";
import { loadDdItem } from "@/lib/dd-package-server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// 旧・下書きのプレビュー。DDは固定した版を作らず最新をそのまま見せる形にしたので、
// 管理者は投資家と同じ項目の画面（/dd/[slug]/items/[itemId]）で、未公開の項目もそのまま確認する。
export default async function DdDraftPreviewPage({ params }: { params: Promise<{ projectId: string; itemId: string }> }) {
  const { projectId, itemId } = await params;
  const member = await getCurrentMemberAccess();
  if (!member?.isAdmin || member.scope !== "portfolio") notFound();
  if (!isUuid(itemId)) notFound();
  const item = await loadDdItem(itemId);
  if (!item || item.project_id !== projectId) notFound();
  const { data: pkg } = await createAdminClient().from("dd_packages").select("slug").eq("id", item.package_id).maybeSingle();
  if (!pkg?.slug) notFound();
  redirect(`/dd/${encodeURIComponent(String(pkg.slug))}/items/${itemId}`);
}
