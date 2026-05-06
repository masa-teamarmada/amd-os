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

function fmt(n: number): string {
  if (n === 0) return "—";
  return n.toLocaleString();
}

function totalOpex(r: ProjectPlMonthly): number {
  return (
    Number(r.personnel_yen) +
    Number(r.rd_yen) +
    Number(r.marketing_yen) +
    Number(r.other_opex_yen)
  );
}

function grossProfit(r: ProjectPlMonthly): number {
  return Number(r.revenue_yen) - Number(r.cogs_yen);
}

function operatingProfit(r: ProjectPlMonthly): number {
  return grossProfit(r) - totalOpex(r);
}

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
            <div className="overflow-x-auto">
              {rows.length === 0 && (
                <p className="text-[11px] text-muted-foreground mb-2">
                  まだ実データなし。下表は設立日 (or 支援開始 or 今日) から 36 ヶ月のスケルトンです。
                  「✨ つくよみとヒアリング」で値を埋めるか、行をクリックして直接入力できます。
                </p>
              )}
              <table className="w-full text-[11px] border-collapse">
                <thead>
                  <tr className="text-left border-b border-[#e5e5e7] text-muted-foreground sticky top-0 bg-white">
                    <th className="py-1.5 pr-2 font-medium">月</th>
                    <th className="py-1.5 pr-2 font-medium text-right">売上</th>
                    <th className="py-1.5 pr-2 font-medium text-right">原価</th>
                    <th className="py-1.5 pr-2 font-medium text-right">粗利</th>
                    <th className="py-1.5 pr-2 font-medium text-right">人件費</th>
                    <th className="py-1.5 pr-2 font-medium text-right">R&D</th>
                    <th className="py-1.5 pr-2 font-medium text-right">マーケ</th>
                    <th className="py-1.5 pr-2 font-medium text-right">その他</th>
                    <th className="py-1.5 pr-2 font-medium text-right">営業利益</th>
                    <th className="py-1.5 pr-2 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {displayRows.map((r) => {
                    const isVirtual = r.id.startsWith("__virtual__");
                    const op = operatingProfit(r);
                    return (
                      <tr
                        key={r.id}
                        className={`border-b border-[#f1f5f9] hover:bg-[#fafafa] ${
                          isVirtual ? "text-muted-foreground/70" : ""
                        }`}
                      >
                        <td className="py-1.5 pr-2 font-mono">{r.ym}</td>
                        <td className="py-1.5 pr-2 font-mono text-right">{fmt(Number(r.revenue_yen))}</td>
                        <td className="py-1.5 pr-2 font-mono text-right">{fmt(Number(r.cogs_yen))}</td>
                        <td className="py-1.5 pr-2 font-mono text-right">{fmt(grossProfit(r))}</td>
                        <td className="py-1.5 pr-2 font-mono text-right">{fmt(Number(r.personnel_yen))}</td>
                        <td className="py-1.5 pr-2 font-mono text-right">{fmt(Number(r.rd_yen))}</td>
                        <td className="py-1.5 pr-2 font-mono text-right">{fmt(Number(r.marketing_yen))}</td>
                        <td className="py-1.5 pr-2 font-mono text-right">{fmt(Number(r.other_opex_yen))}</td>
                        <td
                          className="py-1.5 pr-2 font-mono text-right"
                          style={{ color: op >= 0 ? "#16a34a" : op < 0 ? "#ef4444" : undefined }}
                        >
                          {fmt(op)}
                        </td>
                        <td className="py-1.5 pr-2">
                          <div className="flex gap-1.5">
                            <button onClick={() => startEdit(r)} className="text-blue-600 hover:underline">
                              {isVirtual ? "入力" : "編集"}
                            </button>
                            {!isVirtual && (
                              <button onClick={() => onDelete(r.id)} className="text-red-600 hover:underline">
                                削除
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="border-t-2 border-[#cbd5e1] bg-[#fafafa] font-semibold">
                    <td className="py-1.5 pr-2 text-[12px]">累計</td>
                    <td className="py-1.5 pr-2 font-mono text-right">{fmt(totals.revenue)}</td>
                    <td className="py-1.5 pr-2 font-mono text-right">{fmt(totals.cogs)}</td>
                    <td className="py-1.5 pr-2 font-mono text-right">{fmt(gpAll)}</td>
                    <td className="py-1.5 pr-2 font-mono text-right">{fmt(totals.personnel)}</td>
                    <td className="py-1.5 pr-2 font-mono text-right">{fmt(totals.rd)}</td>
                    <td className="py-1.5 pr-2 font-mono text-right">{fmt(totals.marketing)}</td>
                    <td className="py-1.5 pr-2 font-mono text-right">{fmt(totals.other)}</td>
                    <td
                      className="py-1.5 pr-2 font-mono text-right"
                      style={{ color: opAll >= 0 ? "#16a34a" : "#ef4444" }}
                    >
                      {fmt(opAll)}
                    </td>
                    <td />
                  </tr>
                </tbody>
              </table>
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
