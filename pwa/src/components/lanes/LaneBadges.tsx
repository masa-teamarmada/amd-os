"use client";

/**
 * ASPI 8 domain × weighted lanes JSONB を表示・編集する共通コンポーネント。
 *
 * 正本: pwa/design/aspi_lanes.md
 * 形式: [{"domain": "<aspi_id>", "weight": 0.0-1.0}]、合計 = 1.0
 */

import { useEffect, useState } from "react";
import {
  ASPI_DOMAIN_IDS,
  ASPI_DOMAIN_LABEL_JP,
  ASPI_DOMAIN_SHORT_LABEL,
  type AspiDomainId,
  type LaneWeight,
} from "@/lib/aspi-lanes";

/** 読み取り専用 badge 表示。lanes が null なら fallback (= 旧 lane TEXT) を muted で出す。 */
export function LaneBadges({
  lanes,
  fallback,
  size = "sm",
}: {
  lanes: LaneWeight[] | null | undefined;
  fallback?: string | null;
  size?: "xs" | "sm";
}) {
  if (!lanes || lanes.length === 0) {
    return <span className="text-[10px] text-muted-foreground font-mono">{fallback ?? "—"}</span>;
  }
  const cls = size === "xs"
    ? "px-1 py-0 text-[9px]"
    : "px-1.5 py-0.5 text-[10px]";
  return (
    <div className="flex flex-wrap gap-1">
      {lanes.map((lw) => (
        <span
          key={lw.domain}
          className={`inline-flex items-center gap-1 rounded border border-cyan-200 bg-cyan-50 text-cyan-800 ${cls}`}
          title={ASPI_DOMAIN_LABEL_JP[lw.domain] ?? lw.domain}
        >
          <span>{ASPI_DOMAIN_SHORT_LABEL[lw.domain] ?? lw.domain}</span>
          {lanes.length > 1 && (
            <span className="font-mono text-[9px] text-cyan-600">{Math.round(lw.weight * 100)}%</span>
          )}
        </span>
      ))}
    </div>
  );
}

/**
 * lanes 編集 popover (各 domain checkbox + weight input + 等分ボタン + 保存)。
 *
 * onSave は親が supabase update を呼ぶ。weight 合計 = 1.0 (±0.001) でないと保存ボタン無効。
 */
export function LaneEditor({
  initial,
  onCancel,
  onSave,
  saving,
}: {
  initial: LaneWeight[] | null;
  onCancel: () => void;
  onSave: (lanes: LaneWeight[]) => void | Promise<void>;
  saving: boolean;
}) {
  const initMap = new Map<AspiDomainId, number>();
  for (const lw of initial ?? []) initMap.set(lw.domain, lw.weight);

  const [selected, setSelected] = useState<Map<AspiDomainId, number>>(initMap);

  useEffect(() => {
    const m = new Map<AspiDomainId, number>();
    for (const lw of initial ?? []) m.set(lw.domain, lw.weight);
    setSelected(m);
  }, [initial]);

  const total = Array.from(selected.values()).reduce((a, b) => a + b, 0);
  const validTotal = Math.abs(total - 1.0) < 0.001;
  const validCount = selected.size >= 1 && selected.size <= 3;
  const canSave = validTotal && validCount && !saving;

  const toggleDomain = (d: AspiDomainId) => {
    const next = new Map(selected);
    if (next.has(d)) {
      next.delete(d);
    } else {
      next.set(d, next.size === 0 ? 1.0 : 0); // 初回は 1.0、以降は 0 で追加
    }
    setSelected(next);
  };

  const setWeight = (d: AspiDomainId, w: number) => {
    const next = new Map(selected);
    next.set(d, Math.max(0, Math.min(1, w)));
    setSelected(next);
  };

  const evenly = () => {
    if (selected.size === 0) return;
    const next = new Map<AspiDomainId, number>();
    const w = 1 / selected.size;
    for (const d of selected.keys()) next.set(d, Math.round(w * 1000) / 1000);
    // 端数を 1 つ目に乗せて合計を 1.0 に
    const sum = Array.from(next.values()).reduce((a, b) => a + b, 0);
    const diff = 1 - sum;
    const firstKey = Array.from(next.keys())[0];
    if (firstKey) next.set(firstKey, (next.get(firstKey) ?? 0) + diff);
    setSelected(next);
  };

  const save = () => {
    const lanes: LaneWeight[] = Array.from(selected.entries()).map(([domain, weight]) => ({ domain, weight }));
    onSave(lanes);
  };

  return (
    <div className="space-y-2 bg-white border border-border rounded p-2 shadow-md min-w-[280px]">
      <div className="text-[10px] text-muted-foreground">ASPI 8 domains から選択。weight 合計 = 1.0 (1〜3 個)。</div>
      <div className="space-y-1 max-h-[260px] overflow-y-auto">
        {ASPI_DOMAIN_IDS.map((d) => {
          const checked = selected.has(d);
          return (
            <label key={d} className="flex items-center gap-2 text-[11px] cursor-pointer hover:bg-slate-50 px-1 py-0.5 rounded">
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggleDomain(d)}
                className="cursor-pointer"
              />
              <span className="flex-1">{ASPI_DOMAIN_LABEL_JP[d]}</span>
              {checked && (
                <input
                  type="number"
                  step="0.05"
                  min="0"
                  max="1"
                  value={selected.get(d) ?? 0}
                  onChange={(e) => setWeight(d, Number(e.target.value))}
                  onClick={(e) => e.stopPropagation()}
                  className="w-14 border border-border rounded px-1 py-0.5 text-[10px] font-mono"
                />
              )}
            </label>
          );
        })}
      </div>
      <div className="flex items-center gap-2 text-[10px]">
        <button
          type="button"
          onClick={evenly}
          disabled={selected.size === 0}
          className="text-[10px] px-2 py-0.5 border border-border rounded disabled:opacity-50"
        >
          等分
        </button>
        <span className={`ml-auto font-mono ${validTotal ? "text-emerald-600" : "text-red-600"}`}>
          合計: {total.toFixed(3)}
        </span>
      </div>
      <div className="flex gap-1 justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="text-[10px] text-muted-foreground border border-border px-2 py-0.5 rounded"
        >
          取消
        </button>
        <button
          type="button"
          onClick={save}
          disabled={!canSave}
          className="text-[10px] bg-foreground text-background px-2 py-0.5 rounded disabled:opacity-50"
        >
          {saving ? "…" : "保存"}
        </button>
      </div>
    </div>
  );
}
