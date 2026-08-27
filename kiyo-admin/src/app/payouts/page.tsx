import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { currentYmJst } from "@/lib/ym";
import { PayoutNoticeClient } from "@/components/PayoutNoticeClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "支払通知書",
};

export default async function PayoutsPage() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user?.email) {
    redirect("/auth/login?next=/payouts");
  }

  const { data: member } = await supabase
    .from("members")
    .select("is_admin, member_name, code_name")
    .eq("email", user.email.toLowerCase())
    .single();

  if (!member?.is_admin) {
    return (
      <main className="mx-auto max-w-lg px-4 py-20 text-center">
        <h1 className="text-lg font-semibold">権限がない</h1>
        <p className="mt-2 text-sm text-slate-600">
          この画面は AMD OS の admin だけが見られる。{user.email} には admin 権限がついてない。
        </p>
      </main>
    );
  }

  const displayName = member.member_name || member.code_name || user.email;

  return <PayoutNoticeClient initialYm={currentYmJst()} userLabel={displayName} />;
}
