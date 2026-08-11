"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, AlertTriangle, ListTodo } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

/**
 * ProactiveTodoBadge — dashboard 上段の先手TODOバッジ
 *
 * 仕様正本: pwa/spec/2-4-proactive-todo-current-spec.md
 *
 * admin のみ表示 (非adminは null)。/proactive へのリンクと open件数 + 期限超過件数だけを出す。
 * 旧 LoopKernelBoard (5段ループ盤面) の置き換え (2026-06-27 白紙やり直し)。
 */
export function ProactiveTodoBadge() {
  const [counts, setCounts] = useState<{ open: number; overdue: number; red: number } | null>(null);
  const [noAccess, setNoAccess] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const email = user?.email?.toLowerCase() ?? "";
      if (!email) {
        if (!cancelled) setNoAccess(true);
        return;
      }
      const { data: member } = await supabase
        .from("members")
        .select("is_admin")
        .eq("email", email)
        .maybeSingle();
      if (!member?.is_admin) {
        if (!cancelled) setNoAccess(true);
        return;
      }
      const [openRes, overdueRes, redRes] = await Promise.all([
        supabase.from("proactive_todos").select("id", { count: "exact", head: true }).eq("status", "open").eq("attention_state", "approved").in("attention_type", ["decision", "masa_action"]),
        supabase
          .from("proactive_todos")
          .select("id", { count: "exact", head: true })
          .eq("status", "open")
          .eq("attention_state", "approved")
          .in("attention_type", ["decision", "masa_action"])
          .eq("due_basis", "explicit")
          .lt("due_at", new Date().toISOString()),
        supabase
          .from("proactive_todos")
          .select("id", { count: "exact", head: true })
          .eq("status", "open")
          .eq("attention_state", "approved")
          .in("attention_type", ["decision", "masa_action"])
          .eq("due_basis", "explicit")
          .eq("priority", "red"),
      ]);
      if (!cancelled) {
        setCounts({
          open: openRes.count ?? 0,
          overdue: overdueRes.count ?? 0,
          red: redRes.count ?? 0,
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (noAccess) return null;
  if (!counts) {
    return <div className="h-12 rounded-md border border-border bg-muted/20 animate-pulse" />;
  }

  const hasUrgent = counts.overdue > 0 || counts.red > 0;
  return (
    <Link
      href="/proactive"
      className={`flex items-center gap-3 rounded-md border px-4 py-3 transition-colors hover:bg-muted/30 ${
        hasUrgent
          ? "border-red-300 bg-red-50/40"
          : counts.open > 0
            ? "border-amber-200 bg-amber-50/30"
            : "border-border bg-card"
      }`}
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
          hasUrgent ? "bg-red-100 text-red-700" : counts.open > 0 ? "bg-amber-100 text-amber-700" : "bg-muted text-muted-foreground"
        }`}
      >
        {hasUrgent ? <AlertTriangle className="h-5 w-5" /> : <ListTodo className="h-5 w-5" />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-foreground">先手 TODO</div>
        <div className="text-xs text-muted-foreground">
          {counts.open === 0 ? (
            <span>いま、まさが判断・対応する対象はないよ。</span>
          ) : (
            <>
              <span className="font-medium text-foreground">{counts.open}件</span> 未対応
              {counts.overdue > 0 ? (
                <span className="ml-2 text-red-700 font-medium">期限超過 {counts.overdue}件</span>
              ) : null}
              {counts.red > 0 && counts.red !== counts.overdue ? (
                <span className="ml-2 text-red-700 font-medium">🔴 {counts.red}件</span>
              ) : null}
            </>
          )}
        </div>
      </div>
      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}
