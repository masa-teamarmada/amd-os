"use client";

/**
 * /institutions/assess — ERS 評価入力マトリクス (admin)
 * 設計正本: pwa/design/institution_readiness.md
 *
 * 各サブ軸を Lv1-5 の 5 行 + メモ行に展開。各レベル行に基準 (rubric) をフル表示し、
 * 右側の各機関列はチェックボックスのみ。Lv1-5 のどれか 1 つにチェックでそのレベル。
 * どれにもチェックしなければ N/A (軸平均から除外)。列 = 機関、ヘッダ行・左列 sticky 固定。
 * 変更は 1 セルずつ即保存 (楽観更新)、ERS はリアルタイム再計算。
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
const EMPTY_CELL: CellState = { level: null, na: false, note: null };

export default function AssessMatrixPage() {
  const [bundle, setBundle] = useState<ErsBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [edits, setEdits] = useState<EditMap>({});
  const [saving, setSaving] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

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
        const s = edits[cellKey(inst.institutionId, c.criterionId)] ?? EMPTY_CELL;
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
        const prev = m[k] ?? EMPTY_CELL;
        const next: CellState = { ...prev, ...patch };
        if (next.na) next.level = null;
        void persist(instId, critId, next, prev);
        return { ...m, [k]: next };
      });
    },
    [persist],
  );

  // Lv チェックボックス: 既にそのLvならOFF(→N/A)、そうでなければそのLvをON
  const toggleLevel = useCallback(
    (instId: string, critId: string, lv: number) => {
      const cell = edits[cellKey(instId, critId)] ?? EMPTY_CELL;
      const isChecked = cell.level === lv && !cell.na;
      if (isChecked) updateCell(instId, critId, { na: true, level: null });
      else updateCell(instId, critId, { level: lv, na: false });
    },
    [edits, updateCell],
  );

  // メモ: 入力中はローカルのみ、blur で保存
  const setNoteLocal = useCallback((instId: string, critId: string, note: string) => {
    const k = cellKey(instId, critId);
    setEdits((m) => ({ ...m, [k]: { ...(m[k] ?? EMPTY_CELL), note: note || null } }));
  }, []);
  const saveNote = useCallback(
    (instId: string, critId: string) => {
      const k = cellKey(instId, critId);
      setEdits((m) => {
        const cell = m[k] ?? EMPTY_CELL;
        void persist(instId, critId, cell, cell);
        return m;
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
          各サブ軸の Lv1–5 の基準を読み、機関ごとに到達レベルへチェックを 1 つ入れる。
          <span className="font-medium text-foreground">どのレベルにもチェックしなければ N/A</span>（軸平均から除外）。
          変更は自動保存・ERS はリアルタイム再計算。
        </p>
        {error && (
          <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">⚠️ {error}</div>
        )}
      </header>

      <div className="overflow-auto rounded-lg border border-border max-h-[80vh]">
        <table className="text-xs border-collapse w-full">
          <thead>
            <tr>
              <th className="sticky top-0 left-0 z-30 bg-muted px-3 py-2 text-left font-medium border-b border-r border-border min-w-[340px] w-[42%]">
                サブ軸 / レベル基準
              </th>
              {insts.map((inst) => {
                const ers = ersByInst[inst.institutionId]?.ers ?? null;
                return (
                  <th
                    key={inst.institutionId}
                    className="sticky top-0 z-20 bg-muted px-2 py-2 text-center font-medium border-b border-r border-border min-w-[110px] align-bottom"
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
                    <th className="sticky left-0 z-10 bg-indigo-100 px-3 py-1.5 text-left border-y border-r border-border">
                      <span className="font-mono font-bold text-indigo-900">{axis.axisNo}</span>
                      <span className="ml-1.5 font-semibold text-indigo-900">{axis.name}</span>
                      {axis.correspondsXrl && (
                        <span className="ml-1 text-[10px] font-normal text-indigo-700/70">（{axis.correspondsXrl}）</span>
                      )}
                    </th>
                    {insts.map((inst) => {
                      const a = ersByInst[inst.institutionId]?.axisScores.find((s) => s.axisId === axis.axisId);
                      return (
                        <td key={inst.institutionId} className="bg-indigo-50 text-center border-y border-r border-border px-1 py-1.5">
                          <span className="font-mono text-[11px] text-indigo-900/80">
                            {a?.score != null ? `${Math.round(a.score * 100)}%` : "—"}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                  {/* 各サブ軸 = 名前行 + Lv1-5 行 + メモ行 */}
                  {crits.map((c) => (
                    <Fragment key={c.criterionId}>
                      {/* サブ軸名 */}
                      <tr className="border-t-2 border-border">
                        <th className="sticky left-0 z-10 bg-card px-3 pt-2 pb-1 text-left font-semibold border-r border-border">
                          <span className="text-[10px] font-mono text-muted-foreground mr-1.5">{c.code}</span>
                          <span className="text-xs">{c.name}</span>
                        </th>
                        {insts.map((inst) => {
                          const cell = edits[cellKey(inst.institutionId, c.criterionId)] ?? EMPTY_CELL;
                          const lvl = cell.na ? null : cell.level;
                          return (
                            <td key={inst.institutionId} className="bg-card text-center border-r border-border px-1 pt-2 pb-1">
                              <span
                                className="inline-block text-[9px] font-mono rounded px-1 py-0.5 text-white/95"
                                style={{ background: lvl != null ? ersScoreColor(normalizeLevel(lvl)) : "#d4d4d8" }}
                              >
                                {lvl != null ? `Lv${lvl}` : "N/A"}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                      {/* Lv1-5 */}
                      {LEVELS.map((lv) => (
                        <tr key={lv} className="hover:bg-muted/10">
                          <td className="sticky left-0 z-10 bg-card px-3 py-1 text-left border-r border-border align-top">
                            <span className="flex gap-1.5">
                              <span
                                className="font-mono text-[10px] font-bold rounded px-1 h-4 leading-4 text-white/95 shrink-0"
                                style={{ background: ersScoreColor(normalizeLevel(lv)) }}
                              >
                                Lv{lv}
                              </span>
                              <span className="text-[11px] text-foreground/85 leading-snug">
                                {c.rubric[String(lv)] ?? "—"}
                              </span>
                            </span>
                          </td>
                          {insts.map((inst) => {
                            const k = cellKey(inst.institutionId, c.criterionId);
                            const cell = edits[k] ?? EMPTY_CELL;
                            const checked = cell.level === lv && !cell.na;
                            const isSaving = saving.has(k);
                            return (
                              <td key={inst.institutionId} className="text-center border-r border-border px-1 py-1 align-middle">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleLevel(inst.institutionId, c.criterionId, lv)}
                                  className="w-4 h-4 cursor-pointer align-middle"
                                  style={{ accentColor: ersScoreColor(normalizeLevel(lv)) }}
                                  aria-label={`${inst.name} ${c.code} Lv${lv}`}
                                />
                                {isSaving && checked && (
                                  <span className="ml-1 w-2 h-2 border border-primary border-t-transparent rounded-full animate-spin inline-block align-middle" />
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                      {/* メモ */}
                      <tr className="bg-amber-50/40">
                        <td className="sticky left-0 z-10 bg-amber-50/60 px-3 py-1 text-left border-r border-border text-[10px] text-amber-800/80 align-middle">
                          📝 根拠メモ
                        </td>
                        {insts.map((inst) => {
                          const k = cellKey(inst.institutionId, c.criterionId);
                          const cell = edits[k] ?? EMPTY_CELL;
                          return (
                            <td key={inst.institutionId} className="border-r border-border px-1 py-1 align-middle">
                              <input
                                type="text"
                                value={cell.note ?? ""}
                                onChange={(e) => setNoteLocal(inst.institutionId, c.criterionId, e.target.value)}
                                onBlur={() => saveNote(inst.institutionId, c.criterionId)}
                                placeholder="根拠…"
                                className="w-full text-[10px] rounded border border-amber-200 bg-white/70 px-1 py-0.5 focus:outline-none focus:border-amber-400"
                              />
                            </td>
                          );
                        })}
                      </tr>
                    </Fragment>
                  ))}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
