import { redirect } from "next/navigation";
import { GlobalNav } from "@/components/nav/GlobalNav";
import { PageTitleSetter } from "@/components/nav/PageTitleSetter";
import TsukuyomiMascot from "@/components/tsukuyomi/Mascot";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/auth/login");
  }

  let userCodeName = "Guest";
  let isAdmin = false;
  let memberId: string | null = null;
  if (user.email) {
    const { data: member } = await supabase
      .from("members")
      .select("code_name, is_admin, member_id")
      .eq("email", user.email)
      .single();
    if (member?.code_name) userCodeName = member.code_name;
    if (member?.is_admin) isAdmin = true;
    if (member?.member_id) memberId = member.member_id;
  }

  return (
    <>
      <PageTitleSetter />
      <GlobalNav userCodeName={userCodeName} isAdmin={isAdmin} memberId={memberId} />
      <main className="flex-1">{children}</main>
      <TsukuyomiMascot />
    </>
  );
}
