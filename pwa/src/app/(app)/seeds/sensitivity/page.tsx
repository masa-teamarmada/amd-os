"use client";

import Link from "next/link";
import { Bzm30SensitivityBoard } from "@/components/bzm30/Bzm30SensitivityBoard";

/**
 * 入力を動かして見る — BZM 3.0 の産業創出価値が、入力を変えるとどう動くかを見る画面。
 * 曲線は `model/tools/bzm30_sensitivity.cjs` が先に計算して置いてある。ここは読むだけ。
 */
export default function SeedsSensitivityPage() {
  return (
    <div className="mx-auto w-full max-w-[1800px] px-4 py-6">
      <div className="mb-3 text-xs text-slate-500">
        <Link href="/seeds" className="hover:text-slate-900">
          ← シーズリスト
        </Link>
      </div>
      <Bzm30SensitivityBoard />
    </div>
  );
}
