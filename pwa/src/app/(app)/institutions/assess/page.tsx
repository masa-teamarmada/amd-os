"use client";

/**
 * /institutions/assess — ERS 評価入力マトリクス (admin)
 * 設計正本: pwa/design/institution_readiness.md
 *
 * 行 = 28 サブ軸 (8 軸グループ)、列 = 各機関。各セルで Lv1-5 を選ぶ / N/A 切替 / note 編集。
 * ヘッダ行 (機関) と左ヘッダ列 (サブ軸) は sticky 固定。変更は 1 セルずつ即保存 (楽観更新)。
 * 各機関の ERS% は編集に応じてリアルタイム再計算。
 */
import { Fragment, useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { fetchErsBundle, type ErsBundle } from "@/lib/ers-data";
import {
  computeErs,
  ersScoreColor,
  normalizeLevel,
  INSTITUTION_TYPE_LABEL,
  type ErsAssessment,
} from "@/lib/ers";

type CellState = { level: number | null; na: boolean; note: string | null };
type EditMap = Record<string, CellState>; // key = `${institutionId}::${criterionId}`

const cellKey = (instId: string, critId: string) => `${instId}::${critId}`;
const LEVELS = [1, 2, 3, 4, 5] as const;

export default function AssessMatrixPage() {
  const [bundle, setBundle] = useState<ErsBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [edits, setEdits] = useState<EditMap>({});
  const [saving, setSaving] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [openNote, setOpenNote] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");

  useEffect(() => {
    fetchErsBundle()
      .then((b) => {
        setBundle(b);
        const map: EditMap = {};
        for (const inst of b.institutions) {
          const list = b.assessmentsByInstitution[inst.institutionId] ?? [];
          const byCrit = new Map(list.map((a) => [a.criterionId, a]));
          for (const c of b.criteria) {
            const a = byCrit.get(c.criterionId);
            map[cellKey(inst.institutionId, c.criterionId)] = {
              level: a?.level ?? null,
              na: Boolean(a?.na),
              note: a?.note ?? null,
            };
          }
        }
        setEdits(map);
      })
      .catch(() => setError("読み込みに失敗しました"))
      .finally(() => setLoading(false));
  }, []);

  const sortedAxes = useMemo(
    () => (bundle ? [...bundle.axes].sort((a, b) => a.sortOrder - b.sortOrder) : []),
    [bundle],
  );
  const critByAxis = useMemo(() => {
    const m = new Map<string, ErsBundle["criteria"]>();
    if (!bundle) return m;
    for (const axis of bundle.axes) {
      m.set(
        axis.axisId,
        bundle.criteria.filter((c) => c.axisId === axis.axisId).sort((a, b) => a.sortOrder - b.sortOrder),
      );
    }
    return m;
  }, [bundle]);

  // 機関ごと ERS をリアルタイム計算
  const ersByInst = useMemo(() => {
    const out: Record<string, ReturnType<typeof computeErs>> = {};
    if (!bundle) return out;
    for (const inst of bundle.institutions) {
      const list: ErsAssessment[] = bundle.criteria.map((c) => {
        const s = edits[cellKey(inst.institutionId, c.criterionId)] ?? { level: null, na: false, note: null };
        return { criterionId: c.criterionId, level: s.level, na: s.na, note: s.note, evaluatedAt: "" };
      });
      out[inst.institutionId] = computeErs(bundle.axes, bundle.criteria, list);
    }
    return out;
  }, [bundle, edits]);

  const persist = useCallback(
    async (instId: string, critId: string, next: CellState, prev: CellState) => {
      const k = cellKey(instId, critId);
      setSaving((s) => new Set(s).add(k));
      setError(null);
      try {
        const res = await fetch("/api/institutions/assess", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            institution_id: instId,
            criterion_id: critId,
            level: next.na ? null : next.level,
            na: next.na,
            note: next.note,
          }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error || `保存失敗 (${res.status})`);
        }
      } catch (e) {
        setEdits((m) => ({ ...m, [k]: prev })); // rollback
        setError(e instanceof Error ? e.message : "保存に失敗しました");
      } finally {
        setSaving((s) => {
          const n = new Set(s);
          n.delete(k);
          return n;
        });
      }
    },
    [],
  );

  const updateCell = useCallback(
    (instId: string, critId: string, patch: Partial<CellState>) => {
      const k = cellKey(instId, critId);
      setEdits((m) => {
        const prev = m[k] ?? { level: null, na: false, note: null };
        const next: CellState = { ...prev, ...patch };
        if (next.na) next.level = null;
        void persist(instId, critId, next, prev);
        return { ...m, [k]: next };
      });
    },
    [persist],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!bundle || bundle.institutions.length === 0) {
    return <div className="p-6 text-sm text-muted-foreground">登録された研究機関がありません。</div>;
  }

  const insts = bundle.institutions;

  return (
    <div className="p-4 max-w-[1600px] mx-auto space-y-3">
      <header className="space-y-1">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h1 className="text-xl font-bold">ERS 評価入力マトリクス</h1>
          <Link href="/institutions" className="text-xs text-primary hover:underline shrink-0">
            ← ヒートマップ比較へ
          </Link>
        </div>
        <p className="text-xs text-muted-foreground">
          各機関 × 各サブ軸の到達レベル (Lv1–5) を選ぶ。該当しない軸は <span className="font-mono">N/A</span> で軸平均から除外。
          各 Lv ボタンにカーソルを乗せると基準 (rubric) が出る。変更は自動保存・ERS はリアルタイム再計算。
        </p>
        {error && (
          <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">
            ⚠️ {error}
          </div>
        )}
      </header>

      <div className="overflow-auto rounded-lg border border-border max-h-[78vh]">
        <table className="text-xs border-collapse">
          <thead>
            <tr>
              <th className="sticky top-0 left-0 z-30 bg-muted px-3 py-2 text-left font-medium border-b border-r border-border min-w-[230px]">
                サブ軸 \ 機関
              </th>
              {insts.map((inst) => {
                const ers = ersByInst[inst.institutionId]?.ers ?? null;
                return (
                  <th
                    key={inst.institutionId}
                    className="sticky top-0 z-20 bg-muted px-3 py-2 text-center font-medium border-b border-r border-border min-w-[200px] align-bottom"
                  >
                    <Link href={`/institutions/${inst.institutionId}`} className="hover:underline">
                      {inst.name}
                    </Link>
                    <span className="ml-1 text-[9px] rounded border px-1 py-0.5 bg-indigo-50 text-indigo-800 border-indigo-300">
                      {INSTITUTION_TYPE_LABEL[inst.type] ?? inst.type}
                    </span>
                    <div className="mt-1 flex items-center justify-center gap-1.5">
                      <span
                        className="inline-block w-2.5 h-2.5 rounded-sm"
                        style={{ background: ersScoreColor(ers != null ? ers / 100 : null) }}
                      />
                      <span className="font-mono tabular-nums text-sm font-bold">
                        {ers != null ? `${Math.round(ers)}%` : "—"}
                      </span>
                      <span className="text-[9px] text-muted-foreground/70">ERS</span>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sortedAxes.map((axis) => {
              const crits = critByAxis.get(axis.axisId) ?? [];
              return (
                <Fragment key={axis.axisId}>
                  {/* 軸グループ見出し */}
                  <tr>
                    <th className="sticky left-0 z-10 bg-indigo-50/90 px-3 py-1.5 text-left border-b border-r border-border">
                      <span className="font-mono font-bold text-indigo-900">{axis.axisNo}</span>
                      <span className="ml-1.5 font-semibold text-indigo-900">{axis.name}</span>
                      {axis.correspondsXrl && (
                        <span className="ml-1 text-[10px] font-normal text-indigo-700/70">（{axis.correspondsXrl}）</span>
                      )}
                    </th>
                    {insts.map((inst) => {
                      const a = ersByInst[inst.institutionId]?.axisScores.find((s) => s.axisId === axis.axisId);
                      return (
                        <td key={inst.institutionId} className="bg-indigo-50/60 text-center border-b border-r border-border px-2 py-1.5">
                          <span className="font-mono text-[11px] text-indigo-900/80">
                            {a?.score != null ? `${Math.round(a.score * 100)}%` : "—"}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                  {/* サブ軸行 */}
                  {crits.map((c) => (
                    <tr key={c.criterionId} className="hover:bg-muted/10">
                      <th
                        className="sticky left-0 z-10 bg-card px-3 py-2 text-left font-normal border-b border-r border-border align-top"
                        title={LEVELS.map((lv) => `Lv${lv}: ${c.rubric[String(lv)] ?? "—"}`).join("\n")}
                      >
                        <span className="text-[10px] font-mono text-muted-foreground mr-1.5">{c.code}</span>
                        <span className="text-xs font-medium">{c.name}</span>
                      </th>
                      {insts.map((inst) => {
                        const k = cellKey(inst.institutionId, c.criterionId);
                        const cell = edits[k] ?? { level: null, na: false, note: null };
                        const isSaving = saving.has(k);
                        return (
                          <td
                            key={inst.institutionId}
                            className="border-b border-r border-border px-2 py-1.5 align-top"
                          >
                            <div className="flex flex-col items-center gap-1">
                              <div className={`flex items-center gap-0.5 ${cell.na ? "opacity-30 pointer-events-none" : ""}`}>
                                {LEVELS.map((lv) => {
                                  const active = cell.level === lv;
                                  return (
                                    <button
                                      key={lv}
                                      type="button"
                                      title={`Lv${lv}: ${c.rubric[String(lv)] ?? "—"}`}
                                      onClick={() => updateCell(inst.institutionId, c.criterionId, { level: active ? null : lv, na: false })}
                                      className="w-5 h-5 rounded text-[10px] font-mono font-semibold border transition-colors"
                                      style={
                                        active
                                          ? { background: ersScoreColor(normalizeLevel(lv)), color: "white", borderColor: "transparent" }
                                          : { background: "transparent", color: "var(--muted-foreground, #71717a)", borderColor: "var(--border, #e4e4e7)" }
                                      }
                                    >
                                      {lv}
                                    </button>
                                  );
                                })}
                              </div>
                              <div className="flex items-center gap-2 text-[9px]">
                                <button
                                  type="button"
                                  onClick={() => updateCell(inst.institutionId, c.criterionId, { na: !cell.na })}
                                  className={`rounded px-1 py-0.5 border ${
                                    cell.na
                                      ? "bg-zinc-200 text-zinc-700 border-zinc-300"
                                      : "bg-transparent text-muted-foreground/60 border-border hover:bg-muted"
                                  }`}
                                >
                                  N/A
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenNote(k);
                                    setNoteDraft(cell.note ?? "");
                                  }}
                                  className={`rounded px-1 py-0.5 border ${
                                    cell.note
                                      ? "bg-amber-50 text-amber-800 border-amber-300"
                                      : "bg-transparent text-muted-foreground/60 border-border hover:bg-muted"
                                  }`}
                                  title={cell.note ?? "根拠メモを追加"}
                                >
                                  📝{cell.note ? "✓" : ""}
                                </button>
                                {isSaving && (
                                  <span className="w-2.5 h-2.5 border border-primary border-t-transparent rounded-full animate-spin inline-block" />
                                )}
                              </div>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* note 編集モーダル */}
      {openNote && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpenNote(null)}
        >
          <div
            className="bg-card rounded-lg border border-border shadow-xl w-full max-w-md p-4 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold">評価根拠メモ</h3>
            <textarea
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              rows={4}
              className="w-full text-sm rounded border border-border bg-background px-2 py-1.5 resize-y"
              placeholder="この Lv と判断した根拠・出典・補足など"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpenNote(null)}
                className="text-xs px-3 py-1.5 rounded border border-border hover:bg-muted"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={() => {
                  const [instId, critId] = openNote.split("::");
                  updateCell(instId, critId, { note: noteDraft.trim() || null });
                  setOpenNote(null);
                }}
                className="text-xs px-3 py-1.5 rounded bg-primary text-primary-foreground hover:opacity-90"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
