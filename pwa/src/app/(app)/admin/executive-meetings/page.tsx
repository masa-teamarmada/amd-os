import type { Metadata } from "next";
import { ExecutiveMeetingAdminPanel } from "@/components/admin/ExecutiveMeetingAdminPanel";

export const metadata: Metadata = { title: { absolute: "経営会議の設定 - AMD OS" } };

export default function ExecutiveMeetingsAdminPage() {
  return <div className="min-w-0 space-y-2"><h1 className="text-lg font-semibold">経営会議の設定</h1><p className="text-sm text-muted-foreground">ユーザーの経営陣属性、PJごとの参加者、経営会議規程を設定する。</p><ExecutiveMeetingAdminPanel /></div>;
}
