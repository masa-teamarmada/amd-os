"use client";

/**
 * CockpitVentureStatus 用イベント編集モーダル。
 *
 * - 既存 event の更新 / 削除
 * - 新規 event 追加 (グラフ空白 tap 由来)
 *
 * フィールド: occurred_on (date), kind, label, meta (jsonb 自由入力)
 */

import { useEffect, useState } from "react";
import {
  insertProjectEvent,
  updateProjectEvent,
  deleteProjectEvent,
  type ProjectEventRow,
  type ProjectEventKind,
} from "@/lib/venture-status-data";

const KIND_OPTIONS: { value: ProjectEventKind; label: string }[] = [
  { value: "hire", label: "採用" },
  { value: "funding", label: "資金調達" },
  { value: "deal", label: "事業契約" },
  { value: "governance", label: "ガバナンス" },
  { value: "xrl_obs", label: "XRL 観測" },
  { value: "amd_score_override", label: "AMD スコア手動補正" },
  { value: "note", label: "メモ" },
];

interface Props {
  projectId: string;
  editing: ProjectEventRow | null;
  initialDate: string | null;
  onClose: () => void;
  onSaved: () => void;
}

function metaToText(meta: Record<string, unknown>): string {
  if (!meta || Object.keys(meta).length === 0) return "";
  try {
    return JSON.stringify(meta, null, 2);
  } catch {
    return "";
  }
}

function textToMeta(text: string): Record<string, unknown> {
  const trimmed = text.trim();
  if (!trimmed) return {};
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // ignore
  }
  return { _raw: text };
}

export function CockpitVentureStatusEditModal({
  projectId,
  editing,
  initialDate,
  onClose,
  onSaved,
}: Props) {
  const [date, setDate] = useState<string>(editing?.occurred_on || initialDate || "");
  const [kind, setKind] = useState<ProjectEventKind>(editing?.kind || "note");
  const [label, setLabel] = useState<string>(editing?.label || "");
  const [metaText, setMetaText] = useState<string>(metaToText(editing?.meta || {}));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDate(editing?.occurred_on || initialDate || "");
    setKind(editing?.kind || "note");
    setLabel(editing?.label || "");
    setMetaText(metaToText(editing?.meta || {}));
  }, [editing, initialDate]);

  const onSave = async () => {
    if (!date || !label.trim()) {
      setError("日付とラベルは必須");
      return;
    }
    setSaving(true);
    setError(null);
    const meta = textToMeta(metaText);
    if (editing) {
      const r = await updateProjectEvent(editing.id, { occurred_on: date, kind, label, meta });
      if (!r) setError("更新に失敗");
      else onSaved();
    } else {
      const r = await insertProjectEvent(projectId, { occurred_on: date, kind, label, meta });
      if (!r) setError("追加に失敗");
      else onSaved();
    }
    setSaving(false);
  };

  const onDelete = async () => {
    if (!editing) return;
    if (!confirm("このイベントを削除しますか?")) return;
    setSaving(true);
    const ok = await deleteProjectEvent(editing.id);
    if (!ok) {
      setError("削除に失敗");
      setSaving(false);
    } else {
      onSaved();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-[480px] max-w-[92vw] max-h-[88vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-[#e5e5e7] flex items-center justify-between">
          <h3 className="text-sm font-semibold">{editing ? "イベント編集" : "イベント追加"}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-sm">
            ✕
          </button>
        </div>
        <div className="px-4 py-3 flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-[12px]">
            <span className="text-muted-foreground">日付</span>
            <input
              type="date"
              value={date.slice(0, 10)}
              onChange={(e) => setDate(e.target.value)}
              className="border border-[#e5e5e7] rounded-md px-2 py-1.5 text-[13px]"
            />
          </label>

          <label className="flex flex-col gap-1 text-[12px]">
            <span className="text-muted-foreground">種別</span>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as ProjectEventKind)}
              className="border border-[#e5e5e7] rounded-md px-2 py-1.5 text-[13px]"
            >
              {KIND_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-[12px]">
            <span className="text-muted-foreground">ラベル (1 行サマリ)</span>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="例: シードラウンド ¥30M クローズ / 山田 (CTO) 入社 / 大学契約締結"
              className="border border-[#e5e5e7] rounded-md px-2 py-1.5 text-[13px]"
            />
          </label>

          <label className="flex flex-col gap-1 text-[12px]">
            <span className="text-muted-foreground">詳細 (JSON、任意)</span>
            <textarea
              value={metaText}
              onChange={(e) => setMetaText(e.target.value)}
              placeholder='例: {"amount_yen": 30000000, "lead": "Build VC"}'
              rows={5}
              className="border border-[#e5e5e7] rounded-md px-2 py-1.5 text-[12px] font-mono"
            />
            <span className="text-[10px] text-muted-foreground">
              valid JSON でないときは {"{ _raw: <文字列> }"} として保存
            </span>
          </label>

          {error && <p className="text-[12px] text-red-600">{error}</p>}
        </div>
        <div className="px-4 py-3 border-t border-[#e5e5e7] flex justify-between gap-2">
          {editing ? (
            <button
              onClick={onDelete}
              disabled={saving}
              className="text-[12px] text-red-600 hover:underline disabled:opacity-50"
            >
              削除
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
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
    </div>
  );
}
