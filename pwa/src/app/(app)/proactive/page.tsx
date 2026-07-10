import type { Metadata } from "next";
export const metadata: Metadata = { title: { absolute: "先手 TODO - AMD OS" } };

import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProactiveTodoBoard } from "@/components/proactive-todo/ProactiveTodoBoard";

export const dynamic = "force-dynamic";

/**
 * /proactive — 先手 TODO リスト (admin 専用)
 *
 * 仕様正本: pwa/spec/2-4-proactive-todo-current-spec.md
 *
 * 全PJ横断・期限順の TODO 1画面。
 * ボタンは ✅完了 / ⏸ブロック / 🗑関係ない の 3 種。
 * 元 MTG と元 next_action テキストを各行で展開可能。
 * 旧 /loop (5段ループ盤面) の白紙やり直し版 (2026-06-27)。
 */
export default async function ProactivePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user?.email?.toLowerCase() ?? "";
  if (!email) notFound();
  const { data: member } = await supabase
    .from("members")
    .select("is_admin")
    .eq("email", email)
    .maybeSingle();
  if (!member?.is_admin) notFound();

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="mb-3">
        <h1 className="text-lg font-semibold">先手 TODO</h1>
        <p className="text-xs text-muted-foreground mt-1">
          全 PJ 横断・期限順。過去14日のMTG議事録の next_actions と、7日以内に開催される予定MTGから毎朝自動抽出。AMDボール or 主語不明のものだけが表示される。
        </p>
      </div>
      <ProactiveTodoBoard />
    </div>
  );
}
