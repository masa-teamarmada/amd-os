import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * /spec — 設計書セクションは admin (= members.is_admin) 限定。
 * メンバー向けマニュアル (/manual) と分離し、確定仕様はまさ・実装者だけが見る。
 */
export default async function SpecLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user?.email) {
    redirect("/auth/login");
  }

  const { data: member } = await supabase
    .from("members")
    .select("is_admin")
    .eq("email", user.email.toLowerCase())
    .single();

  if (!member?.is_admin) {
    redirect("/dashboard");
  }

  return <>{children}</>;
}
