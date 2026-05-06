"use client";

/**
 * 月次試算表モーダル: 月別の売上 / 売上原価 / 各種販管費を入力 → P&L を組み立てて表示。
 *
 * 表示:
 *   - 月リスト (古→新)
 *   - 各月: 売上、原価、人件費、R&D、マーケ、その他、計、粗利、営業利益、利益率
 *   - 累計: 同上
 *
 * 入力モード:
 *   - 各月行クリックで編集
 *   - 「+ 新しい月」で新規行
 *   - 月は YYYY-MM のテキスト入力
 */

import { useEffect, useMemo, useState } from "react";
import {
  fetchPlMonthly,
  fetchVentureStatus,
  upsertPlMonthly,
  deletePlMonthly,
  type ProjectPlMonthly,
} from "@/lib/venture-status-data";
import { CockpitPlHearingModal } from "./CockpitPlHearingModal";

interface Props {
  projectId: string;
  onClose: () => void;
}

/** 設立日 (or 支援開始日 or 今日) から 36 ヶ月分の YYYY-MM 配列を返す */
function makeMonthGrid(startIso: string | null): string[] {
  const start = startIso ? new Date(startIso) : new Date();
  const out: string[] = [];
  for (let i = 0; i < 36; i += 1) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

/** 完全に空の P&L 行 (id なし、virtual) */
function emptyPlRow(projectId: string, ym: string): ProjectPlMonthly {
  return {
    id: `__virtual__${ym}`,
    project_id: projectId,
    ym,
    revenue_yen: 0,
    cogs_yen: 0,
    personnel_yen: 0,
    rd_yen: 0,
    marketing_yen: 0,
    other_opex_yen: 0,
    notes: null,
  };
}

// =====================================================================
// PL ピボットテーブル: 行 = 項目、列 = 月
// =====================================================================

interface PivotProps {
  rows: ProjectPlMonthly[];
  totals: { revenue: number; cogs: number; personnel: number; rd: number; marketing: number; other: number };
  gpAll: number;
  opAll: number;
  onCellClick: (row: ProjectPlMonthly) => void;
  onDelete: (id: string) => void;
}

interface ItemDef {
  key: keyof Pick<
    ProjectPlMonthly,
    "revenue_yen" | "cogs_yen" | "personnel_yen" | "rd_yen" | "marketing_yen" | "other_opex_yen"
  > | "gross_profit" | "operating_profit";
  label: string;
  variant: "input" | "calc";
  group: "revenue" | "calc" | "opex" | "result";
}

const ITEMS: ItemDef[] = [
  { key: "revenue_yen", label: "売上", variant: "input", group: "revenue" },
  { key: "cogs_yen", label: "売上原価", variant: "input", group: "revenue" },
  { key: "gross_profit", label: "粗利", variant: "calc", group: "calc" },
  { key: "personnel_yen", label: "人件費", variant: "input", group: "opex" },
  { key: "rd_yen", label: "R&D 費", variant: "input", group: "opex" },
  { key: "marketing_yen", label: "マーケ費", variant: "input", group: "opex" },
  { key: "other_opex_yen", label: "その他", variant: "input", group: "opex" },
  { key: "operating_profit", label: "営業利益", variant: "calc", group: "result" },
];

function valueOf(item: ItemDef, r: ProjectPlMonthly): number {
  if (item.key === "gross_profit") return Number(r.revenue_yen) - Number(r.cogs_yen);
  if (item.key === "operating_profit") {
    return (
      Number(r.revenue_yen) -
      Number(r.cogs_yen) -
      (Number(r.personnel_yen) + Number(r.rd_yen) + Number(r.marketing_yen) + Number(r.other_opex_yen))
    );
  }
  return Number(r[item.key as keyof ProjectPlMonthly] as number);
}

function totalOf(item: ItemDef, totals: PivotProps["totals"], gpAll: number, opAll: number): number {
  switch (item.key) {
    case "revenue_yen":
      return totals.revenue;
    case "cogs_yen":
      return totals.cogs;
    case "personnel_yen":
      return totals.personnel;
    case "rd_yen":
      return totals.rd;
    case "marketing_yen":
      return totals.marketing;
    case "other_opex_yen":
      return totals.other;
    case "gross_profit":
      return gpAll;
    case "operating_profit":
      return opAll;
  }
}

function PlPivotTable({ rows, totals, gpAll, opAll, onCellClick, onDelete }: PivotProps) {
  return (
    <div className="overflow-x-auto max-h-[60vh]">
      <table className="text-[11px] border-collapse">
        <thead>
          <tr className="bg-white">
            <th
              className="sticky left-0 top-0 bg-white z-20 px-2 py-1.5 text-left font-medium text-muted-foreground border-b border-r border-[#e5e5e7] min-w-[110px]"
            >
              項目
            </th>
            {rows.map((r) => {
              const isVirtual = r.id.startsWith("__virtual__");
              return (
                <th
                  key={r.id}
                  className="sticky top-0 bg-white px-2 py-1.5 text-right font-medium text-muted-foreground border-b border-[#e5e5e7] min-w-[88px] z-10"
                >
                  <button
                    onClick={() => onCellClick(r)}
                    className="font-mono hover:text-foreground hover:underline decoration-dotted"
                    title={isVirtual ? "値を入力" : "編集"}
                  >
                    {r.ym}
                  </button>
                  {!isVirtual && (
                    <button
                      onClick={() => onDelete(r.id)}
                      className="ml-1 text-red-500 hover:text-red-700 text-[9px]"
                      title="削除"
                    >
                      ×
                    </button>
                  )}
                </th>
              );
            })}
            <th className="sticky right-0 top-0 bg-[#fafafa] z-20 px-2 py-1.5 text-right font-semibold border-b border-l border-[#cbd5e1] min-w-[100px]">
              累計
            </th>
          </tr>
        </thead>
        <tbody>
          {ITEMS.map((item) => {
            const isResult = item.group === "result";
            const isCalc = item.variant === "calc";
            return (
              <tr
                key={item.key}
                className={`hover:bg-[#fafafa] ${isResult ? "border-t-2 border-[#cbd5e1] font-semibold" : ""}`}
              >
                <td
                  className={`sticky left-0 z-10 bg-white px-2 py-1.5 border-b border-r border-[#f1f5f9] ${
                    isCalc ? "text-slate-700 font-medium" : "text-muted-foreground"
                  }`}
                >
                  {item.label}
                </td>
                {rows.map((r) => {
                  const val = valueOf(item, r);
                  const isVirtual = r.id.startsWith("__virtual__");
                  const muted = isVirtual && val === 0;
                  let color: string | undefined;
                  if (isResult) color = val > 0 ? "#16a34a" : val < 0 ? "#ef4444" : undefined;
                  return (
                    <td
                      key={r.id}
                      className={`px-2 py-1.5 text-right font-mono border-b border-[#f1f5f9] ${
                        muted ? "text-muted-foreground/50" : ""
                      } ${isCalc ? "bg-[#f9fafb]" : ""}`}
                      style={{ color }}
                    >
                      {isCalc ? (
                        <span>{val === 0 ? "—" : val.toLocaleString()}</span>
                      ) : (
                        <button
                          onClick={() => onCellClick(r)}
                          className="hover:underline decoration-dotted"
                          title={`${r.ym} の ${item.label} を編集`}
                        >
                          {val === 0 ? "—" : val.toLocaleString()}
                        </button>
                      )}
                    </td>
                  );
                })}
                {(() => {
                  const tot = totalOf(item, totals, gpAll, opAll);
                  let color: string | undefined;
                  if (isResult) color = tot > 0 ? "#16a34a" : tot < 0 ? "#ef4444" : undefined;
                  return (
                    <td
                      className="sticky right-0 z-10 bg-[#fafafa] px-2 py-1.5 text-right font-mono font-semibold border-b border-l border-[#cbd5e1]"
                      style={{ color }}
                    >
                      {tot === 0 ? "—" : tot.toLocaleString()}
                    </td>
                  );
                })()}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

interface Draft {
  id?: string;
  ym: string;
  revenue_yen: string;
  cogs_yen: string;
  personnel_yen: string;
  rd_yen: string;
  marketing_yen: string;
  other_opex_yen: string;
  notes: string;
}

const emptyDraft = (defaultYm: string): Draft => ({
  ym: defaultYm,
  revenue_yen: "0",
  cogs_yen: "0",
  personnel_yen: "0",
  rd_yen: "0",
  marketing_yen: "0",
  other_opex_yen: "0",
  notes: "",
});

export function CockpitPlMonthlyModal({ projectId, onClose }: Props) {
  const [rows, setRows] = useState<ProjectPlMonthly[]>([]);
  const [gridStart, setGridStart] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [hearingOpen, setHearingOpen] = useState(false);

  const reload = async () => {
    setLoading(true);
    const [pl, status] = await Promise.all([
      fetchPlMonthly(projectId),
      fetchVentureStatus(projectId),
    ]);
    setRows(pl);
    setGridStart(
      status.venture?.founded_at ||
        status.venture?.amd_support_started_at ||
        new Date().toISOString().slice(0, 10)
    );
    setLoading(false);
  };
  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const startNew = () => {
    const today = new Date();
    const ym = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
    setDraft(emptyDraft(ym));
  };

  const startEdit = (r: ProjectPlMonthly) => {
    const isVirtual = r.id.startsWith("__virtual__");
    setDraft({
      id: isVirtual ? undefined : r.id,
      ym: r.ym,
      revenue_yen: String(r.revenue_yen),
      cogs_yen: String(r.cogs_yen),
      personnel_yen: String(r.personnel_yen),
      rd_yen: String(r.rd_yen),
      marketing_yen: String(r.marketing_yen),
      other_opex_yen: String(r.other_opex_yen),
      notes: r.notes ?? "",
    });
  };

  const onSave = async () => {
    if (!draft || !/^\d{4}-\d{2}$/.test(draft.ym)) return;
    setSaving(true);
    await upsertPlMonthly(projectId, {
      id: draft.id,
      ym: draft.ym,
      revenue_yen: Number(draft.revenue_yen) || 0,
      cogs_yen: Number(draft.cogs_yen) || 0,
      personnel_yen: Number(draft.personnel_yen) || 0,
      rd_yen: Number(draft.rd_yen) || 0,
      marketing_yen: Number(draft.marketing_yen) || 0,
      other_opex_yen: Number(draft.other_opex_yen) || 0,
      notes: draft.notes.trim() || null,
    });
    setSaving(false);
    setDraft(null);
    await reload();
  };

  const onDelete = async (id: string) => {
    if (!confirm("この月のデータを削除しますか?")) return;
    setSaving(true);
    await deletePlMonthly(projectId, id);
    setSaving(false);
    await reload();
  };

  // 表示行 = 実データ行 + 空グリッドを merge (実データ優先)。常に 36 ヶ月分は出す
  const displayRows = useMemo(() => {
    const grid = makeMonthGrid(gridStart);
    const byYm = new Map<string, ProjectPlMonthly>();
    for (const r of rows) byYm.set(r.ym, r);
    // 実データ行で grid に無い ym があれば前に置く
    const extraYms = rows.map((r) => r.ym).filter((ym) => !grid.includes(ym));
    const allYms = [...extraYms, ...grid].sort();
    return allYms.map((ym) => byYm.get(ym) ?? emptyPlRow(projectId, ym));
  }, [rows, gridStart, projectId]);

  const totals = useMemo(() => {
    const acc = {
      revenue: 0,
      cogs: 0,
      personnel: 0,
      rd: 0,
      marketing: 0,
      other: 0,
    };
    for (const r of rows) {
      acc.revenue += Number(r.revenue_yen);
      acc.cogs += Number(r.cogs_yen);
      acc.personnel += Number(r.personnel_yen);
      acc.rd += Number(r.rd_yen);
      acc.marketing += Number(r.marketing_yen);
      acc.other += Number(r.other_opex_yen);
    }
    return acc;
  }, [rows]);

  const gpAll = totals.revenue - totals.cogs;
  const opexAll = totals.personnel + totals.rd + totals.marketing + totals.other;
  const opAll = gpAll - opexAll;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-[860px] max-w-[96vw] max-h-[88vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-[#e5e5e7] flex items-center justify-between">
          <h3 className="text-sm font-semibold">月次試算表</h3>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setHearingOpen(true)}
              className="text-[11px] px-2 py-1 rounded-md bg-purple-600 text-white hover:bg-purple-700"
              title="つくよみが質問を投げて、回答から試算表を組み立てる"
            >
              ✨ つくよみとヒアリング
            </button>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-sm">
              ✕
            </button>
          </div>
        </div>

        <div className="px-4 py-3">
          {loading ? (
            <p className="text-[12px] text-muted-foreground">読み込み中…</p>
          ) : (
            <div>
              {rows.length === 0 && (
                <p className="text-[11px] text-muted-foreground mb-2">
                  まだ実データなし。下表は設立日 (or 支援開始 or 今日) から 36 ヶ月のスケルトンです。
                  「✨ つくよみとヒアリング」で値を埋めるか、列ヘッダーの月をクリックして直接入力できます。
                </p>
              )}
              <PlPivotTable
                rows={displayRows}
                totals={totals}
                gpAll={gpAll}
                opAll={opAll}
                onCellClick={(r) => startEdit(r)}
                onDelete={(id) => onDelete(id)}
              />
            </div>
          )}

          {draft && (
            <div className="mt-3 border border-blue-100 bg-blue-50/40 rounded-md p-3 grid grid-cols-3 gap-2">
              <label className="flex flex-col gap-0.5 text-[11px]">
                <span className="text-muted-foreground">月 (YYYY-MM)</span>
                <input
                  value={draft.ym}
                  onChange={(e) => setDraft({ ...draft, ym: e.target.value })}
                  placeholder="2026-05"
                  className="border border-[#e5e5e7] rounded-md px-2 py-1 text-[13px] font-mono"
                />
              </label>
              {(
                [
                  ["revenue_yen", "売上 (円)"],
                  ["cogs_yen", "売上原価 (円)"],
                  ["personnel_yen", "人件費 (円)"],
                  ["rd_yen", "R&D 費 (円)"],
                  ["marketing_yen", "マーケ費 (円)"],
                  ["other_opex_yen", "その他販管費 (円)"],
                ] as const
              ).map(([k, label]) => (
                <label key={k} className="flex flex-col gap-0.5 text-[11px]">
                  <span className="text-muted-foreground">{label}</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={draft[k]}
                    onChange={(e) => setDraft({ ...draft, [k]: e.target.value })}
                    onFocus={(e) => e.target.select()}
                    className="border border-[#e5e5e7] rounded-md px-2 py-1 text-[13px] font-mono text-right"
                  />
                </label>
              ))}
              <label className="flex flex-col gap-0.5 text-[11px] col-span-3">
                <span className="text-muted-foreground">メモ</span>
                <textarea
                  value={draft.notes}
                  onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                  rows={2}
                  className="border border-[#e5e5e7] rounded-md px-2 py-1 text-[12px]"
                />
              </label>
              <div className="col-span-3 flex justify-end gap-2 mt-1">
                <button
                  onClick={() => setDraft(null)}
                  className="text-[11px] px-2 py-1 rounded-md border border-[#e5e5e7] hover:bg-white"
                >
                  キャンセル
                </button>
                <button
                  onClick={onSave}
                  disabled={saving || !/^\d{4}-\d{2}$/.test(draft.ym)}
                  className="text-[11px] px-2 py-1 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? "保存中…" : "保存"}
                </button>
              </div>
            </div>
          )}

          {!draft && (
            <button
              onClick={startNew}
              className="mt-3 text-[12px] px-3 py-1.5 rounded-md border border-dashed border-[#cbd5e1] text-blue-700 hover:bg-blue-50"
            >
              + 月を追加
            </button>
          )}
        </div>
      </div>

      {hearingOpen && (
        <CockpitPlHearingModal
          projectId={projectId}
          onClose={() => setHearingOpen(false)}
          onApplied={async () => {
            await reload();
          }}
        />
      )}
    </div>
  );
}
