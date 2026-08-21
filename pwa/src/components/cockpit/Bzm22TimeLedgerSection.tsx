"use client";

import { useEffect, useMemo, useState } from "react";
import { Bzm22TimeLedger } from "./Bzm22TimeLedger";
import { Bzm22PilotNotFoundError, getCachedBzm22Pilot, loadBzm22Pilot } from "./bzm-2-2-pilot-client";
import type { Bzm22PilotProject } from "@/lib/bzm-2-2-pilot-ui";

/**
 * 事業計画タブに置く「イベントと月次試算表」＋「年度別の事業・資金推移」。
 * 2026-08-21 まで `Bzm22ProvisionalObservatory` (スコア詳細タブ) の中にあったものを、
 * 事業計画の一部としてこちらへ移した。gate月はスコア詳細のシミュレーターではなく登録月を使う。
 */
export function Bzm22TimeLedgerSection({ projectId }: { projectId: string }) {
  const [pilot, setPilot] = useState<Bzm22PilotProject | null>(() => getCachedBzm22Pilot(projectId) ?? null);
  const [error, setError] = useState("");
  // 対象外PJでは表を丸ごと出さない (事業計画タブは全PJ常設なので、404を異常として見せない)。
  const [outOfScope, setOutOfScope] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const cached = getCachedBzm22Pilot(projectId);
    setPilot(cached ?? null);
    setError("");
    setOutOfScope(false);
    if (cached) return;
    loadBzm22Pilot(projectId)
      .then((loaded) => { if (!cancelled) setPilot(loaded); })
      .catch((cause) => {
        if (cancelled) return;
        if (cause instanceof Bzm22PilotNotFoundError) { setOutOfScope(true); return; }
        setError(cause instanceof Error ? cause.message : "月次試算表を読み出せていない");
      });
    return () => { cancelled = true; };
  }, [projectId]);

  const gateMonths = useMemo(
    () => pilot ? Object.fromEntries(pilot.calculationTrace.inputs.gates.map((gate) => [gate.id, gate.month])) : {},
    [pilot],
  );

  if (outOfScope) return null;
  if (error) {
    return (
      <section data-testid="bzm22-time-ledger-section" className="overflow-hidden rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-xs text-amber-900">
        <div className="font-semibold">月次試算表を読み出せていない</div>
        <div>{error}</div>
      </section>
    );
  }
  if (!pilot) {
    return (
      <section data-testid="bzm22-time-ledger-section" className="grid min-h-32 place-items-center overflow-hidden rounded-2xl border border-slate-200 bg-white text-xs text-slate-500 shadow-sm">
        月次試算表を読み込み中…
      </section>
    );
  }
  return (
    <section data-testid="bzm22-time-ledger-section" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <Bzm22TimeLedger pilot={pilot} gateMonths={gateMonths} />
    </section>
  );
}
