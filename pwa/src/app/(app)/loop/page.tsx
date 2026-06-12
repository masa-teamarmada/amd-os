import type { Metadata } from "next";
export const metadata: Metadata = { title: { absolute: "ループ - AMD OS" } };

import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LoopKernelBoard } from "@/components/loop/LoopKernelBoard";

export const dynamic = "force-dynamic";

/**
 * /loop — 経営レンズ Phase 1 (ループカーネルダッシュボード)
 *
 * 仕様正本: pwa/spec/2-4-loop-kernel-role-lenses-plan.md
 * 観測→評価→判断→実行→学習の 5 段ループを 1 画面で輪切りにする admin 専用ビュー。
 * 盤面本体は LoopKernelBoard (dashboard 最上段と共用)。アイテムクリックで詳細モーダル、
 * 判断段はモーダル内で採否まで完結する。
 */
export default async function LoopPage() {
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
    <div>
      <div className="flex items-baseline gap-3 mb-1">
        <h1 className="text-lg font-semibold">ループ</h1>
        <span className="text-sm text-muted-foreground">観測 → 評価 → 判断 → 実行 → 学習</span>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        経営レンズ Phase 1。アイテムをクリックすると詳細モーダル、判断段はその場で採否 (正本:{" "}
        <Link href="/spec/2-4-loop-kernel-role-lenses-plan" className="text-primary hover:underline">
          spec 2-4
        </Link>
        )。
      </p>

      <LoopKernelBoard />
    </div>
  );
}
