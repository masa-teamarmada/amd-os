"use client";
import { usePathname } from "next/navigation";
export function DdShortTermPlan({ available }: { available: boolean }) {
  const pathname = usePathname();
  return available ? <iframe title="短期計画・15か月計画のガント" src={`${pathname}/short-term-plan-document`} sandbox="" className="h-[1100px] w-full rounded-xl border border-slate-200 bg-white" /> : <p className="py-4 text-sm text-slate-500">短期計画は未登録。</p>;
}
