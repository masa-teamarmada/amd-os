"use client";
import { usePathname } from "next/navigation";
export function DdShortTermPlan({ available, term = "short" }: { available: boolean; term?: "short" | "long" }) {
  const pathname = usePathname();
  const label = term === "short" ? "短期計画" : "長期計画";
  return available ? <iframe title={term === "short" ? "短期計画・15か月計画のガント" : "長期計画・IPOまでのガント"} src={`${pathname}/${term}-term-plan-document`} sandbox="" className="h-[1100px] w-full rounded-xl border border-slate-200 bg-white" /> : <p className="py-4 text-sm text-slate-500">{label}は未登録。</p>;
}
