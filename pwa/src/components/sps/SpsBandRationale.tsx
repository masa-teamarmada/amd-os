"use client";

// SPS帯 (産業創出価値) の判断根拠を表示する共通UI。
// シーズ詳細モーダル (/seeds) と PJコックピットのスコア詳細タブの両方から使う。
// 判断記録の md (pwa/bzm/SPS_IND_RETROFIT_EXISTING_PJ_2026-08-17.md 等) と同じ根拠を
// OS画面から読めるようにするのが目的。md だけに正本を置かない。
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { SeedScreeningQEvidenceItem } from "@/types/seeds";

const Q_EVIDENCE_DIRECTION_LABEL: Record<string, string> = {
  down: "下押し",
  up: "上振れ",
  widen: "帯を広げる",
  neutral: "中立",
};

export function SpsBandRationale({
  notes,
  qEvidence,
  className = "",
}: {
  /** 帯の総合判断 (seed_screening_bands.notes)。q上限側/下限側の理由とSPSの主因。 */
  notes: string | null;
  /** q評価ルーブリックの要因別評価 (seed_screening_bands.q_evidence)。 */
  qEvidence: SeedScreeningQEvidenceItem[] | null;
  className?: string;
}) {
  const [qEvidenceOpen, setQEvidenceOpen] = useState(false);
  const hasNotes = Boolean(notes && notes.trim());
  const hasEvidence = Boolean(qEvidence && qEvidence.length > 0);
  if (!hasNotes && !hasEvidence) return null;

  return (
    <div className={`space-y-2 ${className}`} data-testid="sps-band-rationale">
      {hasNotes && (
        <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
          <div className="text-[10px] font-semibold text-slate-500">総合判断</div>
          <p className="mt-1 whitespace-pre-wrap text-[11px] leading-relaxed text-slate-700">{notes}</p>
        </div>
      )}

      {hasEvidence && (
        <details
          className="rounded-md border border-slate-200 bg-slate-50"
          open={qEvidenceOpen}
          onToggle={(e) => setQEvidenceOpen(e.currentTarget.open)}
        >
          <summary className="flex cursor-pointer list-none items-center gap-1.5 px-3 py-2 text-[11px] font-semibold text-slate-700">
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${qEvidenceOpen ? "rotate-0" : "-rotate-90"}`}
              aria-hidden="true"
            />
            q帯の根拠 ({qEvidence!.length}要因)
          </summary>
          <ul className="space-y-2 border-t border-slate-200 px-3 py-2">
            {qEvidence!.map((item) => (
              <li key={item.id} className="text-[11px] leading-relaxed text-slate-700">
                <div className="flex flex-wrap items-baseline gap-1.5">
                  <span className="font-semibold text-slate-900">{item.name}</span>
                  <span className="rounded border border-slate-300 bg-white px-1 py-0.5 text-[9px] font-medium text-slate-500">
                    {Q_EVIDENCE_DIRECTION_LABEL[item.direction] ?? item.direction}
                  </span>
                </div>
                <div className="mt-0.5 text-slate-600">{item.evidence}</div>
                {item.assessment && <div className="mt-0.5 text-slate-400">{item.assessment}</div>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
