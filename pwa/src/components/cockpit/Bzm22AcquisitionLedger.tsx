"use client";

/**
 * BZM 2.2 獲得台帳 —「これまでのPJ活動のなかで得てきたもの」。
 * 正本: pwa/spec/4-6-bzm-22-acquisition-ledger-current-spec.md
 *
 * 守ること (spec 4-6 §7):
 *   - 日付順に並べる。スコア順・重要度順にしない
 *   - 合計欄・件数バッジを出さない
 *   - display_only のあいだは「まだどの計算にも入っていない」と明示する
 *   - evidence_stage は行ごとにラベル表示し、missing を空欄や 0 に見せない
 *   - 三点セット (閉じた条件 / 消費 / 行動の増減) は同じ行の中で並べる
 */

import { useEffect, useState } from "react";
import {
  BZM22_AUDIT_TAG_LABELS,
  BZM22_CONSTRAINT_STATE_LABELS,
  BZM22_CONSTRAINT_TYPE_LABELS,
  BZM22_EVIDENCE_STAGE_LABELS,
  BZM22_STATE_LAYER_LABELS,
  type Bzm22Acquisition,
  type Bzm22AcquisitionApiPayload,
  type Bzm22StateLayer,
} from "@/lib/bzm-2-2-acquisitions";

const CACHE = new Map<string, Bzm22AcquisitionApiPayload>();

function formatDate(value: string): string {
  if (!value) return "日付未取得";
  const parsed = new Date(`${value}T00:00:00+09:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
}

function EvidenceStageChip({ stage }: { stage: string }) {
  const meta = BZM22_EVIDENCE_STAGE_LABELS[stage] ?? BZM22_EVIDENCE_STAGE_LABELS.missing;
  return (
    <span className={`inline-flex shrink-0 items-center border px-1.5 py-0.5 text-[9px] font-semibold ${meta.className}`}>
      {meta.label}
    </span>
  );
}

/** 三点セットの1枠。空でも枠を残し「記録なし」と書く (空欄=0 に見せない)。 */
function TripleCell({ title, empty, children }: { title: string; empty: boolean; children: React.ReactNode }) {
  return (
    <div className="min-w-0 border-t border-slate-200 px-3 py-2 sm:border-l sm:border-t-0 sm:px-3">
      <div className="text-[9px] font-semibold text-[#376274]">{title}</div>
      {empty ? (
        <div className="mt-1 text-[10px] leading-4 text-slate-400">記録なし（未取得）</div>
      ) : (
        <div className="mt-1 space-y-1 text-[10px] leading-4 text-slate-700">{children}</div>
      )}
    </div>
  );
}

function AcquisitionRow({ item }: { item: Bzm22Acquisition }) {
  return (
    <li className="border-b border-slate-200 last:border-b-0">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 px-3 py-2 sm:px-4">
        <span className="font-mono text-[10px] text-slate-500">{formatDate(item.occurredOn)}</span>
        <span className="min-w-0 flex-1 text-[12px] font-semibold leading-5 text-slate-900">{item.title}</span>
        <EvidenceStageChip stage={item.evidenceStage} />
      </div>

      {item.summary ? (
        <p className="px-3 pb-2 text-[10px] leading-4 text-slate-600 sm:px-4">{item.summary}</p>
      ) : null}

      {item.stateEffects.length > 0 || item.auditTags.length > 0 ? (
        <div className="flex flex-wrap gap-1 px-3 pb-2 sm:px-4">
          {item.stateEffects.map((effect, index) => {
            const layer = BZM22_STATE_LAYER_LABELS[effect.layer as Bzm22StateLayer];
            return (
              <span
                key={`${item.acquisitionId}-state-${index}`}
                title={`${layer.label}｜${effect.effect}${effect.note ? `（${effect.note}）` : ""}`}
                className="inline-flex items-center gap-1 border border-[#b9cbd1] bg-white px-1.5 py-0.5 text-[9px] text-slate-700"
              >
                <span className="font-mono font-semibold text-[#1d4657]">{effect.layer}</span>
                <span>{layer.short}</span>
                {effect.effect ? <span className="text-slate-500">{effect.effect}</span> : null}
              </span>
            );
          })}
          {item.auditTags.map((tag) => (
            <span
              key={`${item.acquisitionId}-tag-${tag}`}
              className="inline-flex items-center border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[9px] text-slate-500"
            >
              {BZM22_AUDIT_TAG_LABELS[tag] ?? tag}
            </span>
          ))}
        </div>
      ) : null}

      <div className="grid bg-[#fbfcfc] sm:grid-cols-3">
        <TripleCell title="閉じた条件" empty={item.closedConstraints.length === 0}>
          {item.closedConstraints.map((constraint, index) => (
            <div key={`${item.acquisitionId}-constraint-${index}`}>
              <span className="text-slate-500">
                {BZM22_CONSTRAINT_TYPE_LABELS[constraint.constraintType] ?? constraint.constraintType}
              </span>
              {" "}
              {constraint.constraintKey}
              <span className="ml-1 font-mono text-[9px] text-slate-500">
                {BZM22_CONSTRAINT_STATE_LABELS[constraint.before] ?? constraint.before}
                {" → "}
                {BZM22_CONSTRAINT_STATE_LABELS[constraint.after] ?? constraint.after}
              </span>
            </div>
          ))}
        </TripleCell>

        <TripleCell title="消費" empty={item.consumed.length === 0}>
          {item.consumed.map((consumed, index) => (
            <div key={`${item.acquisitionId}-consumed-${index}`}>
              <span className="text-slate-500">{consumed.resourceKind}</span>{" "}
              {consumed.amount === null ? (
                <span className="text-slate-400">未計測</span>
              ) : (
                <span className="font-mono">
                  {consumed.amount.toLocaleString("ja-JP")}
                  {consumed.unit ? ` ${consumed.unit}` : ""}
                </span>
              )}
              {consumed.irreversible ? <span className="ml-1 text-rose-700">不可逆</span> : null}
            </div>
          ))}
        </TripleCell>

        <TripleCell title="行動の増減" empty={item.actionDelta.length === 0}>
          {item.actionDelta.map((delta, index) => (
            <div key={`${item.acquisitionId}-action-${index}`}>
              <span className={delta.direction === "opened" ? "text-emerald-700" : "text-rose-700"}>
                {delta.direction === "opened" ? "開いた" : "閉じた"}
              </span>{" "}
              {delta.actionKey}
            </div>
          ))}
        </TripleCell>
      </div>
    </li>
  );
}

export function Bzm22AcquisitionLedger({ projectId, active = true }: { projectId: string; active?: boolean }) {
  const [payload, setPayload] = useState<Bzm22AcquisitionApiPayload | null>(() => CACHE.get(projectId) ?? null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const cached = CACHE.get(projectId);
    if (cached) {
      setPayload(cached);
      setError(null);
      return;
    }
    setPayload(null);
    setError(null);
    fetch(`/api/project/${encodeURIComponent(projectId)}/bzm-2-2-acquisitions`, { cache: "no-store" })
      .then(async (response) => {
        const json = (await response.json().catch(() => null)) as Bzm22AcquisitionApiPayload | { error?: string } | null;
        if (!response.ok || !json || !("acquisitions" in json)) {
          throw new Error(json && "error" in json && json.error ? json.error : "獲得台帳の取得に失敗");
        }
        return json;
      })
      .then((json) => {
        CACHE.set(projectId, json);
        if (!cancelled) setPayload(json);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "獲得台帳の取得に失敗");
      });
    return () => {
      cancelled = true;
    };
  }, [active, projectId]);

  return (
    <details data-testid="bzm22-acquisition-ledger" className="border-t border-[#b9cbd1] bg-white">
      <summary className="cursor-pointer list-none px-3 py-2 text-[9px] font-semibold text-[#376274] marker:content-none sm:px-4">
        これまでに得てきたもの（獲得台帳）
      </summary>

      <div className="border-t border-slate-200 bg-[#f8fafb] px-3 py-2 text-[9px] leading-4 text-slate-600 sm:px-4">
        1行 = 1つの正規化事象。閉じた条件 / 消費 / 行動の増減を同じ行で読む。
        {payload && !payload.displayOnly ? null : (
          <>
            {" "}
            <span className="font-semibold text-slate-800">
              この台帳はまだどの計算にも入っていない（表示専用）。J / P / Q / S・SPS・戦略余力は現時点でこの内容を参照しない。
            </span>
          </>
        )}
      </div>

      {error ? (
        <div className="border-t border-red-200 bg-red-50 px-3 py-2 text-[10px] text-red-800 sm:px-4">{error}</div>
      ) : !payload ? (
        <div className="border-t border-slate-200 px-3 py-3 text-[10px] text-slate-500 sm:px-4">読み込み中…</div>
      ) : payload.acquisitions.length === 0 ? (
        <div className="border-t border-slate-200 px-3 py-3 text-[10px] leading-4 text-slate-500 sm:px-4">
          このPJの獲得事象はまだ登録されていない（未取得であり、得たものが無いという意味ではない）。
        </div>
      ) : (
        <ul className="border-t border-slate-200">
          {payload.acquisitions.map((item) => (
            <AcquisitionRow key={item.acquisitionId} item={item} />
          ))}
        </ul>
      )}
    </details>
  );
}
