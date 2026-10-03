import { redirect } from "next/navigation";
import { getCurrentMemberAccess, type CurrentMemberAccess } from "@/lib/project-workspace";

/**
 * 書斎（/bzm/read）は管理者（members.is_admin）だけが開ける。
 * 棚には未投稿の論文と匿名化前の草稿が並ぶ。設計正本: pwa/design/bzm_reader.md §1
 *
 * layout は画面遷移のたびに再描画されず、他の segment の描画も止めない。
 * そのため layout だけでなく、3つの page と generateMetadata からも毎回呼ぶ。
 * getCurrentMemberAccess は同じリクエスト内で一度だけ引くので、呼び出しを重ねても問い合わせは増えない。
 */
export async function requireReaderAdmin(): Promise<CurrentMemberAccess> {
  const access = await getCurrentMemberAccess();
  if (!access) redirect("/auth/login");
  if (!access.isAdmin) redirect("/dashboard");
  return access;
}
