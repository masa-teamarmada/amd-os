"use client";

/**
 * XRL 観測チェックリスト パネル — スコア詳細ページに設置。
 *
 * 内閣府 SIP 2023公募要領 図2-6 の原典定義に完全準拠 (xrl-level-definitions.ts)。
 * 各軸 (TRL/BRL/GRL/SRL/HRL) のレベルごとに「観測可能な達成項目」をチェックして判定する。
 *
 * 運用 (まさ確定 2026-05-30): えいみが全 PJ に初期チェックを入力 → まさが画面で修正。
 *   - チェック状態は amd_score_inputs.xrl_checklist (JSONB) に保存。
 *   - 達成レベル = 下から見て「全項目チェック済みの連続最大レベル」(積み上げ式)。
 *   - 保存すると同じ行 (最新 evaluated_at) を upsert。XRL の生値 (trl..hrl) も達成レベルで上書きする。
 */

import { useMemo, useState } from "react";
import {
  ALL_XRL_DEFINITIONS,
  type XrlAxisKey,
} from "@/lib/xrl-level-definitions";
import {
  upsertAmdScoreInput,
  type AmdScoreInputRow,
  type XrlChecklist,
  type XrlChecklistAxis,
} from "@/lib/amd-score-data";

const AXES: XrlAxisKey[] = ["trl", "brl", "grl", "srl", "hrl"];
const AXIS_COLOR: Record<XrlAxisKey, string> = {
  trl: "#0ea5e9",
  brl: "#f59e0b",
  grl: "#475569",
  srl: "#9333ea",
  hrl: "#16a34a",
};

/** 達成レベル = 下から見て「全項目 true の連続最大レベル」。Lv1 が未充足なら 0。 */
export function deriveLevelFromChecklist(axis: XrlAxisKey, axisState: XrlChecklistAxis | undefined): number {
  const def = ALL_XRL_DEFINITIONS[axis];
  let achieved = 0;
  for (const lv of def.levels) {
    const arr = axisState?.[String(lv.level)];
    const allChecked = lv.checklist.length > 0 && lv.checklist.every((_, i) => arr?.[i] === true);
    if (allChecked) achieved = lv.level;
    else break; // 積み上げ式: 途中が欠けたら止める
  }
  return achieved;
}

interface Props {
  projectId: string;
  /** 最新の評価行 (xrl_checklist を含む)。null なら未評価。 */
  latestInput: AmdScoreInputRow | null;
  onSaved?: () => void;
}

export function XrlChecklistPanel({ projectId, latestInput, onSaved }: Props) {
  const [activeAxis, setActiveAxis] = useState<XrlAxisKey>("trl");
  const [checklist, setChecklist] = useState<XrlChecklist>(
    () => (latestInput?.xrl_checklist as XrlChecklist) ?? {}
  );
  const [phase, setPhase] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [dirty, setDirty] = useState(false);

  const def = ALL_XRL_DEFINITIONS[activeAxis];
  const color = AXIS_COLOR[activeAxis];
  const axisState = checklist[activeAxis];

  const derivedLevels = useMemo(() => {
    const out = {} as Record<XrlAxisKey, number>;
    for (const a of AXES) out[a] = deriveLevelFromChecklist(a, checklist[a]);
    return out;
  }, [checklist]);

  function toggle(level: number, itemIdx: number) {
    setChecklist((prev) => {
      const next: XrlChecklist = { ...prev };
      const axisObj: XrlChecklistAxis = { ...(next[activeAxis] ?? {}) };
      const len = def.levels[level - 1].checklist.length;
      const arr = [...(axisObj[String(level)] ?? new Array(len).fill(false))];
      while (arr.length < len) arr.push(false);
      arr[itemIdx] = !arr[itemIdx];
      axisObj[String(level)] = arr;
      next[activeAxis] = axisObj;
      return next;
    });
    setDirty(true);
    setPhase("idle");
  }

  async function save() {
    if (!latestInput) {
      setPhase("error");
      return;
    }
    setPhase("saving");
    // 達成レベルを生値にも反映 (チェックリストが値の根拠になる)
    const r = await upsertAmdScoreInput({
      id: latestInput.id,
      project_id: projectId,
      evaluated_at: latestInput.evaluated_at,
      mu_A: latestInput.mu_A,
      mu_I: latestInput.mu_I,
      mu_G: latestInput.mu_G,
      trl: derivedLevels.trl,
      brl: derivedLevels.brl,
      grl: derivedLevels.grl,
      srl: derivedLevels.srl,
      hrl: derivedLevels.hrl,
      frl: latestInput.frl,
      alq_self_awareness: latestInput.alq_self_awareness,
      alq_relational_transparency: latestInput.alq_relational_transparency,
      alq_balanced_processing: latestInput.alq_balanced_processing,
      alq_internalized_moral: latestInput.alq_internalized_moral,
      frl_grit: latestInput.frl_grit,
      frl_resilience: latestInput.frl_resilience,
      frl_notes: latestInput.frl_notes,
      mu_notes: latestInput.mu_notes,
      xrl_notes: latestInput.xrl_notes,
      xrl_checklist: checklist,
      shallow_tech_mode: latestInput.shallow_tech_mode,
      evaluator: latestInput.evaluator,
      notes: latestInput.notes,
    });
    if (r) {
      setPhase("done");
      setDirty(false);
      onSaved?.();
    } else {
      setPhase("error");
    }
  }

  return (
    <section className="border border-[#e5e5e7] rounded-xl bg-white p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-sm font-semibold">XRL 観測チェックリスト</h3>
          <p className="text-[11px] text-muted-foreground">
            各レベルの観測項目をチェックして XRL を判定。達成レベル = 全項目チェック済みの連続最大レベル（積み上げ式）。
          </p>
        </div>
        <button
          onClick={save}
          disabled={!dirty || phase === "saving" || !latestInput}
          className="text-[12px] px-3 py-1.5 rounded-md bg-slate-900 text-white hover:bg-slate-700 disabled:opacity-40"
        >
          {phase === "saving" ? "保存中…" : phase === "done" && !dirty ? "保存済み ✓" : "チェックを保存"}
        </button>
      </div>

      {!latestInput && (
        <p className="text-[12px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
          評価行がまだありません。先に AMD Score を 1 度評価（行を作成）してからチェックリストを使えます。
        </p>
      )}
      {phase === "error" && latestInput && (
        <p className="text-[12px] text-red-600">保存に失敗しました。</p>
      )}

      {/* 軸タブ + 達成レベルチップ */}
      <div className="flex gap-1 flex-wrap">
        {AXES.map((a) => {
          const d = ALL_XRL_DEFINITIONS[a];
          const lv = derivedLevels[a];
          const on = a === activeAxis;
          return (
            <button
              key={a}
              onClick={() => setActiveAxis(a)}
              className={`text-[12px] px-2.5 py-1 rounded-md border font-mono ${
                on ? "text-white" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
              style={on ? { backgroundColor: AXIS_COLOR[a], borderColor: AXIS_COLOR[a] } : undefined}
            >
              {a.toUpperCase()} <span className="opacity-80">Lv.{lv}/{d.maxLevel}</span>
            </button>
          );
        })}
      </div>

      {/* 軸の説明 + 原典 */}
      <div className="text-[11px] text-slate-600">
        <span className="font-semibold" style={{ color }}>{def.axisName}</span>：{def.axisDescription}
        <div className="text-[10px] text-muted-foreground mt-0.5">出典: {def.source}</div>
      </div>

      {/* レベルごとのチェック項目 */}
      <div className="flex flex-col gap-2">
        {def.levels.map((lv) => {
          const arr = axisState?.[String(lv.level)];
          const allChecked = lv.checklist.every((_, i) => arr?.[i] === true);
          const achieved = derivedLevels[activeAxis] >= lv.level;
          return (
            <div
              key={lv.level}
              className={`border rounded-md px-3 py-2 ${
                achieved ? "border-emerald-300 bg-emerald-50/40" : "border-slate-200 bg-white"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded text-white shrink-0"
                  style={{ backgroundColor: achieved ? "#16a34a" : color }}
                >
                  Lv.{lv.level}
                </span>
                <span className="text-[12px] font-semibold">{lv.label}</span>
                {allChecked && <span className="text-[10px] text-emerald-700">✓ 達成</span>}
              </div>
              <p className="text-[10px] text-muted-foreground mb-1.5 leading-snug">{lv.description}</p>
              <ul className="flex flex-col gap-1">
                {lv.checklist.map((item, i) => (
                  <li key={i}>
                    <label className="flex items-start gap-2 text-[12px] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={arr?.[i] === true}
                        onChange={() => toggle(lv.level, i)}
                        className="mt-0.5 accent-emerald-600"
                      />
                      <span className="text-slate-800">{item}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}
