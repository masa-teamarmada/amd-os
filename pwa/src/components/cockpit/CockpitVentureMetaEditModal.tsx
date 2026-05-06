"use client";

/**
 * PJ Status のヘッダー (PJ 名 / lane / outcome / 設立日 / origin / short_description)
 * を直接編集するモーダル。`project_ventures` テーブルを直接更新する。
 */

import { useState } from "react";
import { updateProjectVenture, type ProjectVentureRow } from "@/lib/venture-status-data";
import type { LaneId, OutcomePattern } from "@/lib/venture-map-data";

const LANE_OPTIONS: { value: LaneId; label: string }[] = [
  { value: "gx_energy", label: "GX / エネルギー" },
  { value: "gx_circular", label: "GX / サーキュラー" },
  { value: "materials", label: "素材 / ナノマテリアル" },
  { value: "life", label: "ライフ / 医療" },
  { value: "robo", label: "ロボ / 農・モビリティ" },
];

const OUTCOME_OPTIONS: { value: OutcomePattern; label: string }[] = [
  { value: "rocket", label: "🚀 離陸中" },
  { value: "lifted", label: "✈️ 離陸完了" },
  { value: "deep_pivot", label: "🔄 後付けdeep化" },
  { value: "burnout", label: "🔥 燃え尽き" },
  { value: "ue_fail", label: "💀 UE 失敗" },
];

const AMD_ROLE_OPTIONS = [
  { value: "studio", label: "studio (スタジオモデル)" },
  { value: "founder_studio", label: "founder_studio (ファウンダースタジオ)" },
  { value: "support", label: "support (サポート参画)" },
];

interface Props {
  venture: ProjectVentureRow;
  /** どのフィールドにフォーカスするか (UI ヒント) */
  focus?: "outcome" | "founded_at" | "origin_pi" | "origin_org" | "lane" | "name" | "description";
  onClose: () => void;
  onSaved: () => void;
}

export function CockpitVentureMetaEditModal({ venture, focus, onClose, onSaved }: Props) {
  const [displayName, setDisplayName] = useState(venture.display_name);
  const [shortLabel, setShortLabel] = useState(venture.short_label ?? "");
  const [lane, setLane] = useState<LaneId>(venture.lane);
  const [foundedAt, setFoundedAt] = useState(venture.founded_at ?? "");
  const [outcome, setOutcome] = useState<OutcomePattern>(venture.outcome_pattern);
  const [originOrg, setOriginOrg] = useState(venture.origin_org ?? "");
  const [originPi, setOriginPi] = useState(venture.origin_pi ?? "");
  const [amdRole, setAmdRole] = useState(venture.amd_role ?? "");
  const [shortDescription, setShortDescription] = useState(venture.short_description ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSave = async () => {
    if (!displayName.trim()) {
      setError("PJ 名は必須");
      return;
    }
    setSaving(true);
    setError(null);
    const r = await updateProjectVenture(venture.project_id, {
      display_name: displayName.trim(),
      short_label: shortLabel.trim() || null,
      lane,
      founded_at: foundedAt || null,
      outcome_pattern: outcome,
      origin_org: originOrg.trim() || null,
      origin_pi: originPi.trim() || null,
      amd_role: amdRole.trim() || null,
      short_description: shortDescription.trim() || null,
    });
    setSaving(false);
    if (!r) {
      setError("更新に失敗");
      return;
    }
    onSaved();
  };

  const focusRing = (key: NonNullable<Props["focus"]>) =>
    focus === key ? "ring-2 ring-blue-300" : "";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-[520px] max-w-[92vw] max-h-[88vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-[#e5e5e7] flex items-center justify-between">
          <h3 className="text-sm font-semibold">PJ 基本情報の編集</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-sm">
            ✕
          </button>
        </div>
        <div className="px-4 py-3 grid grid-cols-2 gap-3">
          <label className={`flex flex-col gap-1 text-[12px] col-span-2 ${focusRing("name")} rounded`}>
            <span className="text-muted-foreground">PJ 名 (display_name)</span>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              autoFocus={focus === "name"}
              className="border border-[#e5e5e7] rounded-md px-2 py-1.5 text-[13px]"
            />
          </label>

          <label className="flex flex-col gap-1 text-[12px]">
            <span className="text-muted-foreground">短縮名 (short_label)</span>
            <input
              type="text"
              value={shortLabel}
              onChange={(e) => setShortLabel(e.target.value)}
              className="border border-[#e5e5e7] rounded-md px-2 py-1.5 text-[13px]"
            />
          </label>

          <label className={`flex flex-col gap-1 text-[12px] ${focusRing("lane")} rounded`}>
            <span className="text-muted-foreground">レーン</span>
            <select
              value={lane}
              onChange={(e) => setLane(e.target.value as LaneId)}
              autoFocus={focus === "lane"}
              className="border border-[#e5e5e7] rounded-md px-2 py-1.5 text-[13px]"
            >
              {LANE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <label className={`flex flex-col gap-1 text-[12px] ${focusRing("founded_at")} rounded`}>
            <span className="text-muted-foreground">設立日 (空 = 未設立)</span>
            <input
              type="date"
              value={foundedAt ? foundedAt.slice(0, 10) : ""}
              onChange={(e) => setFoundedAt(e.target.value)}
              autoFocus={focus === "founded_at"}
              className="border border-[#e5e5e7] rounded-md px-2 py-1.5 text-[13px]"
            />
          </label>

          <label className={`flex flex-col gap-1 text-[12px] ${focusRing("outcome")} rounded`}>
            <span className="text-muted-foreground">アウトカム</span>
            <select
              value={outcome}
              onChange={(e) => setOutcome(e.target.value as OutcomePattern)}
              autoFocus={focus === "outcome"}
              className="border border-[#e5e5e7] rounded-md px-2 py-1.5 text-[13px]"
            >
              {OUTCOME_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <label className={`flex flex-col gap-1 text-[12px] ${focusRing("origin_org")} rounded`}>
            <span className="text-muted-foreground">起源機関 (大学名等)</span>
            <input
              type="text"
              value={originOrg}
              onChange={(e) => setOriginOrg(e.target.value)}
              autoFocus={focus === "origin_org"}
              className="border border-[#e5e5e7] rounded-md px-2 py-1.5 text-[13px]"
            />
          </label>

          <label className={`flex flex-col gap-1 text-[12px] ${focusRing("origin_pi")} rounded`}>
            <span className="text-muted-foreground">代表者 / PI 名</span>
            <input
              type="text"
              value={originPi}
              onChange={(e) => setOriginPi(e.target.value)}
              autoFocus={focus === "origin_pi"}
              className="border border-[#e5e5e7] rounded-md px-2 py-1.5 text-[13px]"
            />
          </label>

          <label className="flex flex-col gap-1 text-[12px] col-span-2">
            <span className="text-muted-foreground">AMD の関わり方</span>
            <select
              value={amdRole}
              onChange={(e) => setAmdRole(e.target.value)}
              className="border border-[#e5e5e7] rounded-md px-2 py-1.5 text-[13px]"
            >
              <option value="">(未設定)</option>
              {AMD_ROLE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <label className={`flex flex-col gap-1 text-[12px] col-span-2 ${focusRing("description")} rounded`}>
            <span className="text-muted-foreground">概要 (1〜2 行)</span>
            <textarea
              value={shortDescription}
              onChange={(e) => setShortDescription(e.target.value)}
              autoFocus={focus === "description"}
              rows={2}
              className="border border-[#e5e5e7] rounded-md px-2 py-1.5 text-[12px]"
            />
          </label>

          {error && <p className="text-[12px] text-red-600 col-span-2">{error}</p>}
        </div>
        <div className="px-4 py-3 border-t border-[#e5e5e7] flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={saving}
            className="text-[12px] px-3 py-1.5 rounded-md border border-[#e5e5e7] hover:bg-[#fafafa] disabled:opacity-50"
          >
            キャンセル
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="text-[12px] px-3 py-1.5 rounded-md bg-black text-white hover:bg-[#222] disabled:opacity-50"
          >
            {saving ? "保存中…" : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
}
