"use client";

/**
 * /institutions/assess — ECR 評価入力マトリクス (admin)
 * 設計正本: pwa/design/institution_readiness.md
 *
 * 各サブ軸を Lv1-5 の 5 行 + メモ行に展開。各レベル行に基準 (rubric) をフル表示し、
 * 右側の各機関列はチェックボックスのみ。Lv1-5 のどれか 1 つにチェックでそのレベル。
 * どれにもチェックしなければ N/A (軸平均から除外)。列 = 機関、ヘッダ行・左列 sticky 固定。
 * 変更は 1 セルずつ即保存 (楽観更新)、ECR はリアルタイム再計算。
 */
import { Fragment, useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { fetchErsBundle, type ErsBundle } from "@/lib/ers-data";
import { fetchInstitutionPolicyBundle } from "@/lib/institution-policy-data";
import {
  POLICY_SOURCE_LABEL,
  POLICY_SOURCE_TYPES,
  POLICY_STATUS_LABEL,
  POLICY_STATUS_TONE,
  POLICY_STATUSES,
  type InstitutionPolicyBundle,
  type InstitutionPolicyItem,
  type InstitutionPolicySourceType,
  type InstitutionPolicyStatus,
} from "@/lib/institution-policy";
import {
  computeErs,
  ersScoreColor,
  normalizeLevel,
  INSTITUTION_TYPE_LABEL,
  type ErsAssessment,
} from "@/lib/ers";

type CellState = { level: number | null; na: boolean; note: string | null };
type EditMap = Record<string, CellState>; // key = `${institutionId}::${criterionId}`
type PolicyCellState = {
  status: InstitutionPolicyStatus;
  attributeValue: string | null;
  evidenceNote: string | null;
  sourceType: InstitutionPolicySourceType;
  sourceUrl: string | null;
  sourcePath: string | null;
  confirmedAt: string | null;
};
type PolicyEditMap = Record<string, PolicyCellState>;
type ActiveTab = "ers" | "policy-status" | "policy-attributes" | "evidence";

const cellKey = (instId: string, critId: string) => `${instId}::${critId}`;
const policyCellKey = (instId: string, itemId: string) => `${instId}::${itemId}`;
const LEVELS = [1, 2, 3, 4, 5] as const;
const EMPTY_CELL: CellState = { level: null, na: false, note: null };
const EMPTY_POLICY_CELL: PolicyCellState = {
  status: "unknown",
  attributeValue: null,
  evidenceNote: null,
  sourceType: "unknown",
  sourceUrl: null,
  sourcePath: null,
  confirmedAt: null,
};

export default function AssessMatrixPage() {
  const [bundle, setBundle] = useState<ErsBundle | null>(null);
  const [policyBundle, setPolicyBundle] = useState<InstitutionPolicyBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>("ers");
  const [edits, setEdits] = useState<EditMap>({});
  const [policyEdits, setPolicyEdits] = useState<PolicyEditMap>({});
  const [saving, setSaving] = useState<Set<string>>(new Set());
  const [policySaving, setPolicySaving] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchErsBundle(), fetchInstitutionPolicyBundle()])
      .then(([b, p]) => {
        setBundle(b);
        setPolicyBundle(p);
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
        const policyMap: PolicyEditMap = {};
        for (const inst of b.institutions) {
          const list = p.assessmentsByInstitution[inst.institutionId] ?? [];
          const byItem = new Map(list.map((a) => [a.policyItemId, a]));
          for (const item of p.items) {
            const a = byItem.get(item.policyItemId);
            policyMap[policyCellKey(inst.institutionId, item.policyItemId)] = {
              status: a?.status ?? "unknown",
              attributeValue: a?.attributeValue ?? null,
              evidenceNote: a?.evidenceNote ?? null,
              sourceType: a?.sourceType ?? "unknown",
              sourceUrl: a?.sourceUrl ?? null,
              sourcePath: a?.sourcePath ?? null,
              confirmedAt: a?.confirmedAt ?? null,
            };
          }
        }
        setPolicyEdits(policyMap);
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
  const statusPolicyItems = useMemo(
    () => (policyBundle?.items ?? []).filter((item) => item.itemKind === "status"),
    [policyBundle],
  );
  const attributePolicyItems = useMemo(
    () => (policyBundle?.items ?? []).filter((item) => item.itemKind === "attribute"),
    [policyBundle],
  );
  const policyCategories = useMemo(() => {
    const out: string[] = [];
    for (const item of policyBundle?.items ?? []) {
      if (!out.includes(item.category)) out.push(item.category);
    }
    return out;
  }, [policyBundle]);

  // 機関ごと ECR をリアルタイム計算
  const ersByInst = useMemo(() => {
    const out: Record<string, ReturnType<typeof computeErs>> = {};
    if (!bundle) return out;
    for (const inst of bundle.institutions) {
      const list: ErsAssessment[] = bundle.criteria.map((c) => {
        const s = edits[cellKey(inst.institutionId, c.criterionId)] ?? EMPTY_CELL;
        return {
          criterionId: c.criterionId,
          level: s.level,
          na: s.na,
          note: s.note,
          evaluatedAt: "",
          evaluationVersion: "v1",
        };
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

  const persistPolicy = useCallback(
    async (instId: string, itemId: string, next: PolicyCellState, prev: PolicyCellState) => {
      const k = policyCellKey(instId, itemId);
      setPolicySaving((s) => new Set(s).add(k));
      setError(null);
      try {
        const res = await fetch("/api/institutions/policies", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            institution_id: instId,
            policy_item_id: itemId,
            status: next.status,
            attribute_value: next.attributeValue,
            evidence_note: next.evidenceNote,
            source_type: next.sourceType,
            source_url: next.sourceUrl,
            source_path: next.sourcePath,
            confirmed_at: next.confirmedAt,
          }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error || `保存失敗 (${res.status})`);
        }
      } catch (e) {
        setPolicyEdits((m) => ({ ...m, [k]: prev }));
        setError(e instanceof Error ? e.message : "保存に失敗しました");
      } finally {
        setPolicySaving((s) => {
          const n = new Set(s);
          n.delete(k);
          return n;
        });
      }
    },
    [],
  );

  const updatePolicyCell = useCallback(
    (instId: string, itemId: string, patch: Partial<PolicyCellState>) => {
      const k = policyCellKey(instId, itemId);
      setPolicyEdits((m) => {
        const prev = m[k] ?? EMPTY_POLICY_CELL;
        const next: PolicyCellState = { ...prev, ...patch };
        void persistPolicy(instId, itemId, next, prev);
        return { ...m, [k]: next };
      });
    },
    [persistPolicy],
  );

  const setPolicyLocal = useCallback((instId: string, itemId: string, patch: Partial<PolicyCellState>) => {
    const k = policyCellKey(instId, itemId);
    setPolicyEdits((m) => ({ ...m, [k]: { ...(m[k] ?? EMPTY_POLICY_CELL), ...patch } }));
  }, []);

  const savePolicyCell = useCallback(
    (instId: string, itemId: string) => {
      const k = policyCellKey(instId, itemId);
      setPolicyEdits((m) => {
        const cell = m[k] ?? EMPTY_POLICY_CELL;
        void persistPolicy(instId, itemId, cell, cell);
        return m;
      });
    },
    [persistPolicy],
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
          <h1 className="text-xl font-bold">ECR 評価入力マトリクス</h1>
          <Link href="/institutions" className="text-xs text-primary hover:underline shrink-0">
            ← ヒートマップ比較へ
          </Link>
        </div>
        <p className="text-xs text-muted-foreground">
          各サブ軸の Lv1–5 の基準を読み、機関ごとに到達レベルへチェックを 1 つ入れる。
          <span className="font-medium text-foreground">どのレベルにもチェックしなければ N/A</span>（軸平均から除外）。
          変更は自動保存・ECR はリアルタイム再計算。
        </p>
        {error && (
          <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">⚠️ {error}</div>
        )}
        <nav className="flex flex-wrap gap-1 border-b border-border pt-2">
          {[
            ["ers", "ECR評価"],
            ["policy-status", "制度整備"],
            ["policy-attributes", "規程比較"],
            ["evidence", "根拠資料"],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key as ActiveTab)}
              className={[
                "px-3 py-1.5 text-xs font-medium border border-b-0 rounded-t-md",
                activeTab === key
                  ? "bg-card text-foreground border-border"
                  : "bg-muted/40 text-muted-foreground border-transparent hover:bg-muted",
              ].join(" ")}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>

      {activeTab === "ers" && (
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
                      <span className="text-[9px] text-muted-foreground/70">ECR</span>
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
      )}

      {activeTab === "policy-status" && (
        <PolicyStatusTable
          items={statusPolicyItems}
          insts={insts}
          policyEdits={policyEdits}
          policySaving={policySaving}
          onStatusChange={(instId, itemId, status) => updatePolicyCell(instId, itemId, { status })}
          onNoteLocal={(instId, itemId, evidenceNote) => setPolicyLocal(instId, itemId, { evidenceNote })}
          onSave={(instId, itemId) => savePolicyCell(instId, itemId)}
        />
      )}

      {activeTab === "policy-attributes" && (
        <PolicyAttributeTable
          items={attributePolicyItems}
          insts={insts}
          policyEdits={policyEdits}
          policySaving={policySaving}
          onValueLocal={(instId, itemId, attributeValue) => setPolicyLocal(instId, itemId, { attributeValue })}
          onStatusChange={(instId, itemId, status) => updatePolicyCell(instId, itemId, { status })}
          onSave={(instId, itemId) => savePolicyCell(instId, itemId)}
        />
      )}

      {activeTab === "evidence" && (
        <PolicyEvidenceTable
          categories={policyCategories}
          items={policyBundle?.items ?? []}
          insts={insts}
          policyEdits={policyEdits}
          policySaving={policySaving}
          onLocal={(instId, itemId, patch) => setPolicyLocal(instId, itemId, patch)}
          onSourceChange={(instId, itemId, sourceType) => updatePolicyCell(instId, itemId, { sourceType })}
          onSave={(instId, itemId) => savePolicyCell(instId, itemId)}
        />
      )}
    </div>
  );
}

function PolicyCategoryRow({ label, colSpan }: { label: string; colSpan: number }) {
  return (
    <tr>
      <th
        colSpan={colSpan}
        className="sticky left-0 z-10 bg-indigo-100 px-3 py-1.5 text-left border-y border-border text-xs font-semibold text-indigo-900"
      >
        {label}
      </th>
    </tr>
  );
}

function PolicyStatusBadge({ status }: { status: InstitutionPolicyStatus }) {
  return (
    <span className={`inline-block rounded border px-1.5 py-0.5 text-[10px] font-medium ${POLICY_STATUS_TONE[status]}`}>
      {POLICY_STATUS_LABEL[status]}
    </span>
  );
}

function PolicyStatusTable({
  items,
  insts,
  policyEdits,
  policySaving,
  onStatusChange,
  onNoteLocal,
  onSave,
}: {
  items: InstitutionPolicyItem[];
  insts: ErsBundle["institutions"];
  policyEdits: PolicyEditMap;
  policySaving: Set<string>;
  onStatusChange: (instId: string, itemId: string, status: InstitutionPolicyStatus) => void;
  onNoteLocal: (instId: string, itemId: string, evidenceNote: string | null) => void;
  onSave: (instId: string, itemId: string) => void;
}) {
  return (
    <div className="overflow-auto rounded-lg border border-border max-h-[80vh]">
      <table className="text-xs border-collapse w-full">
        <thead>
          <tr>
            <th className="sticky top-0 left-0 z-30 bg-muted px-3 py-2 text-left font-medium border-b border-r border-border min-w-[300px]">
              制度項目
            </th>
            {insts.map((inst) => (
              <th key={inst.institutionId} className="sticky top-0 z-20 bg-muted px-2 py-2 text-center font-medium border-b border-r border-border min-w-[220px]">
                {inst.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => {
            const showCategory = index === 0 || item.category !== items[index - 1]?.category;
            return (
              <Fragment key={item.policyItemId}>
                {showCategory && <PolicyCategoryRow label={item.category} colSpan={insts.length + 1} />}
                <tr className="border-t border-border">
                  <th className="sticky left-0 z-10 bg-card px-3 py-2 text-left border-r border-border align-top">
                    <div className="font-semibold text-foreground">{item.label}</div>
                    {item.description && <div className="mt-0.5 text-[10px] leading-snug text-muted-foreground">{item.description}</div>}
                  </th>
                  {insts.map((inst) => {
                    const k = policyCellKey(inst.institutionId, item.policyItemId);
                    const cell = policyEdits[k] ?? EMPTY_POLICY_CELL;
                    const isSaving = policySaving.has(k);
                    return (
                      <td key={inst.institutionId} className="border-r border-border px-2 py-2 align-top">
                        <div className="flex items-center gap-1.5">
                          <select
                            value={cell.status}
                            onChange={(e) => onStatusChange(inst.institutionId, item.policyItemId, e.target.value as InstitutionPolicyStatus)}
                            className="w-full rounded border border-border bg-background px-1.5 py-1 text-[11px] focus:outline-none focus:border-primary"
                          >
                            {POLICY_STATUSES.map((status) => (
                              <option key={status} value={status}>
                                {POLICY_STATUS_LABEL[status]}
                              </option>
                            ))}
                          </select>
                          {isSaving && <span className="w-2 h-2 border border-primary border-t-transparent rounded-full animate-spin shrink-0" />}
                        </div>
                        <div className="mt-1">
                          <PolicyStatusBadge status={cell.status} />
                        </div>
                        <input
                          type="text"
                          value={cell.evidenceNote ?? ""}
                          onChange={(e) => onNoteLocal(inst.institutionId, item.policyItemId, e.target.value || null)}
                          onBlur={() => onSave(inst.institutionId, item.policyItemId)}
                          placeholder="根拠・未確認メモ"
                          className="mt-1 w-full rounded border border-border bg-background px-1.5 py-1 text-[10px] focus:outline-none focus:border-primary"
                        />
                      </td>
                    );
                  })}
                </tr>
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PolicyAttributeTable({
  items,
  insts,
  policyEdits,
  policySaving,
  onValueLocal,
  onStatusChange,
  onSave,
}: {
  items: InstitutionPolicyItem[];
  insts: ErsBundle["institutions"];
  policyEdits: PolicyEditMap;
  policySaving: Set<string>;
  onValueLocal: (instId: string, itemId: string, attributeValue: string | null) => void;
  onStatusChange: (instId: string, itemId: string, status: InstitutionPolicyStatus) => void;
  onSave: (instId: string, itemId: string) => void;
}) {
  return (
    <div className="overflow-auto rounded-lg border border-border max-h-[80vh]">
      <table className="text-xs border-collapse w-full">
        <thead>
          <tr>
            <th className="sticky top-0 left-0 z-30 bg-muted px-3 py-2 text-left font-medium border-b border-r border-border min-w-[300px]">
              属性項目
            </th>
            {insts.map((inst) => (
              <th key={inst.institutionId} className="sticky top-0 z-20 bg-muted px-2 py-2 text-center font-medium border-b border-r border-border min-w-[240px]">
                {inst.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => {
            const showCategory = index === 0 || item.category !== items[index - 1]?.category;
            return (
              <Fragment key={item.policyItemId}>
                {showCategory && <PolicyCategoryRow label={item.category} colSpan={insts.length + 1} />}
                <tr className="border-t border-border">
                  <th className="sticky left-0 z-10 bg-card px-3 py-2 text-left border-r border-border align-top">
                    <div className="font-semibold text-foreground">{item.label}</div>
                    {item.description && <div className="mt-0.5 text-[10px] leading-snug text-muted-foreground">{item.description}</div>}
                  </th>
                  {insts.map((inst) => {
                    const k = policyCellKey(inst.institutionId, item.policyItemId);
                    const cell = policyEdits[k] ?? EMPTY_POLICY_CELL;
                    const isSaving = policySaving.has(k);
                    return (
                      <td key={inst.institutionId} className="border-r border-border px-2 py-2 align-top">
                        <input
                          type="text"
                          value={cell.attributeValue ?? ""}
                          onChange={(e) => onValueLocal(inst.institutionId, item.policyItemId, e.target.value || null)}
                          onBlur={() => onSave(inst.institutionId, item.policyItemId)}
                          placeholder="値を入力"
                          className="w-full rounded border border-border bg-background px-1.5 py-1 text-[11px] focus:outline-none focus:border-primary"
                        />
                        <div className="mt-1 flex items-center gap-1.5">
                          <select
                            value={cell.status}
                            onChange={(e) => onStatusChange(inst.institutionId, item.policyItemId, e.target.value as InstitutionPolicyStatus)}
                            className="min-w-20 rounded border border-border bg-background px-1 py-0.5 text-[10px] focus:outline-none focus:border-primary"
                          >
                            {POLICY_STATUSES.map((status) => (
                              <option key={status} value={status}>
                                {POLICY_STATUS_LABEL[status]}
                              </option>
                            ))}
                          </select>
                          <PolicyStatusBadge status={cell.status} />
                          {isSaving && <span className="w-2 h-2 border border-primary border-t-transparent rounded-full animate-spin shrink-0" />}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PolicyEvidenceTable({
  categories,
  items,
  insts,
  policyEdits,
  policySaving,
  onLocal,
  onSourceChange,
  onSave,
}: {
  categories: string[];
  items: InstitutionPolicyItem[];
  insts: ErsBundle["institutions"];
  policyEdits: PolicyEditMap;
  policySaving: Set<string>;
  onLocal: (instId: string, itemId: string, patch: Partial<PolicyCellState>) => void;
  onSourceChange: (instId: string, itemId: string, sourceType: InstitutionPolicySourceType) => void;
  onSave: (instId: string, itemId: string) => void;
}) {
  return (
    <div className="overflow-auto rounded-lg border border-border max-h-[80vh]">
      <table className="text-xs border-collapse w-full">
        <thead>
          <tr>
            <th className="sticky top-0 left-0 z-30 bg-muted px-3 py-2 text-left font-medium border-b border-r border-border min-w-[280px]">
              根拠項目
            </th>
            {insts.map((inst) => (
              <th key={inst.institutionId} className="sticky top-0 z-20 bg-muted px-2 py-2 text-center font-medium border-b border-r border-border min-w-[300px]">
                {inst.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {categories.map((category) => (
            <Fragment key={category}>
              <PolicyCategoryRow label={category} colSpan={insts.length + 1} />
              {items.filter((item) => item.category === category).map((item) => (
                <tr key={item.policyItemId} className="border-t border-border">
                  <th className="sticky left-0 z-10 bg-card px-3 py-2 text-left border-r border-border align-top">
                    <div className="font-semibold text-foreground">{item.label}</div>
                    <div className="mt-0.5 text-[10px] text-muted-foreground">{item.key}</div>
                  </th>
                  {insts.map((inst) => {
                    const k = policyCellKey(inst.institutionId, item.policyItemId);
                    const cell = policyEdits[k] ?? EMPTY_POLICY_CELL;
                    const isSaving = policySaving.has(k);
                    return (
                      <td key={inst.institutionId} className="border-r border-border px-2 py-2 align-top space-y-1">
                        <div className="flex items-center gap-1.5">
                          <select
                            value={cell.sourceType}
                            onChange={(e) => onSourceChange(inst.institutionId, item.policyItemId, e.target.value as InstitutionPolicySourceType)}
                            className="min-w-24 rounded border border-border bg-background px-1 py-0.5 text-[10px] focus:outline-none focus:border-primary"
                          >
                            {POLICY_SOURCE_TYPES.map((type) => (
                              <option key={type} value={type}>
                                {POLICY_SOURCE_LABEL[type]}
                              </option>
                            ))}
                          </select>
                          <input
                            type="date"
                            value={cell.confirmedAt ?? ""}
                            onChange={(e) => onLocal(inst.institutionId, item.policyItemId, { confirmedAt: e.target.value || null })}
                            onBlur={() => onSave(inst.institutionId, item.policyItemId)}
                            className="rounded border border-border bg-background px-1 py-0.5 text-[10px] focus:outline-none focus:border-primary"
                          />
                          {isSaving && <span className="w-2 h-2 border border-primary border-t-transparent rounded-full animate-spin shrink-0" />}
                        </div>
                        <input
                          type="text"
                          value={cell.sourceUrl ?? ""}
                          onChange={(e) => onLocal(inst.institutionId, item.policyItemId, { sourceUrl: e.target.value || null })}
                          onBlur={() => onSave(inst.institutionId, item.policyItemId)}
                          placeholder="公式URL"
                          className="w-full rounded border border-border bg-background px-1.5 py-1 text-[10px] focus:outline-none focus:border-primary"
                        />
                        <input
                          type="text"
                          value={cell.sourcePath ?? ""}
                          onChange={(e) => onLocal(inst.institutionId, item.policyItemId, { sourcePath: e.target.value || null })}
                          onBlur={() => onSave(inst.institutionId, item.policyItemId)}
                          placeholder="OS内資料パス"
                          className="w-full rounded border border-border bg-background px-1.5 py-1 text-[10px] focus:outline-none focus:border-primary"
                        />
                        <textarea
                          value={cell.evidenceNote ?? ""}
                          onChange={(e) => onLocal(inst.institutionId, item.policyItemId, { evidenceNote: e.target.value || null })}
                          onBlur={() => onSave(inst.institutionId, item.policyItemId)}
                          placeholder="根拠メモ・未確認メモ"
                          rows={2}
                          className="w-full resize-y rounded border border-border bg-background px-1.5 py-1 text-[10px] focus:outline-none focus:border-primary"
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
