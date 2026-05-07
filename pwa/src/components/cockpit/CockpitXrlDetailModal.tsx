"use client";

/**
 * XRL ドットクリックで開く詳細モーダル。
 *
 * 表示:
 *   - 観測日 / source (manual / llm_proposal / pm_confirmed) / TRL/BRL/HRL / bottleneck / milestone_label
 *   - 評価理由 (source_note)
 *
 * 操作:
 *   - つくよみへの修正依頼 textarea + 送信
 *     送信 → xrl_feedbacks に保存 + Sonnet で再評価して project_xrl_log を更新 + sonnet feedback log
 */

import { useState } from "react";
import { MentionTextarea } from "./MentionTextarea";
import { submitXrlFeedback, type ProjectXrlRow } from "@/lib/venture-status-data";

type Axis = "TRL" | "BRL" | "GRL" | "SRL" | "HRL";
type AxisLower = "trl" | "brl" | "grl" | "srl" | "hrl";

interface Props {
  projectId: string;
  row: ProjectXrlRow;
  axis: Axis;                      // クリックされた軸
  onClose: () => void;
  onUpdated: () => void;
}

const AXIS_COLORS: Record<Axis, string> = {
  TRL: "#0ea5e9",
  BRL: "#f59e0b",
  GRL: "#475569",
  SRL: "#9333ea",
  HRL: "#16a34a",
};
const AXIS_DESC: Record<Axis, string> = {
  TRL: "Technology Readiness Level — 技術成熟度",
  BRL: "Business Readiness Level — 事業化成熟度",
  GRL: "Governance Readiness Level — 制度・規制適合性",
  SRL: "Social Readiness Level — 社会受容性",
  HRL: "Human Readiness Level — 人材・市場成熟度",
};

/** source_note を { trl_reason, brl_reason, grl_reason, srl_reason, hrl_reason } の JSON として読む。
 *  parse 失敗 (旧 plain text or null) のときは null を返す。 */
function parseAxisReasons(text: string | null | undefined): Partial<Record<AxisLower, string>> | null {
  if (!text) return null;
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === "object") {
      const out: Partial<Record<AxisLower, string>> = {};
      const axes: AxisLower[] = ["trl", "brl", "grl", "srl", "hrl"];
      for (const a of axes) {
        const v = (parsed as Record<string, unknown>)[`${a}_reason`];
        if (typeof v === "string") out[a] = v;
      }
      if (Object.keys(out).length > 0) return out;
    }
  } catch {
    // not JSON
  }
  return null;
}

export function CockpitXrlDetailModal({ projectId, row, axis, onClose, onUpdated }: Props) {
  const [feedback, setFeedback] = useState("");
  const [phase, setPhase] = useState<"idle" | "saving" | "regenerating" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  const axisLower = axis.toLowerCase() as AxisLower;
  const value = row[axisLower] as number | null;
  const color = AXIS_COLORS[axis];
  const reasons = parseAxisReasons(row.source_note);
  const axisReason = reasons?.[axisLower] ?? null;
  const isBottleneck = row.bottleneck === axis;

  const onSubmit = async () => {
    if (!feedback.trim()) return;
    setPhase("saving");
    setError(null);
    const r = await submitXrlFeedback(projectId, {
      xrl_log_id: row.id,
      feedback: feedback.trim(),
    });
    if (!r) {
      setError("送信に失敗しました");
      setPhase("idle");
      return;
    }
    setPhase("regenerating");
    // 即時に Sonnet で再評価する API を叩く (新規)
    try {
      const res = await fetch(`/api/project-ventures/${projectId}/xrl-revise`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ xrl_log_id: row.id, axis, feedback: feedback.trim() }),
      });
      if (!res.ok) {
        setError("再評価に失敗。次の 03:15 cron で再評価されます。");
        setPhase("done");
        return;
      }
    } catch (e) {
      console.error("[CockpitXrlDetailModal]", e);
      setError("再評価リクエスト失敗");
      setPhase("done");
      return;
    }
    setPhase("done");
    onUpdated();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-[560px] max-w-[92vw] max-h-[88vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-[#e5e5e7] flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <span className="font-mono text-base" style={{ color }}>
              {axis}
            </span>
            <span>観測の詳細</span>
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-sm">
            ✕
          </button>
        </div>

        <div className="px-4 py-3 flex flex-col gap-3 text-[12px]">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-[11px] text-muted-foreground">{row.observed_at}</span>
            {row.source && (
              <span
                className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                  row.source === "llm_proposal"
                    ? "bg-blue-50 text-blue-700"
                    : row.source === "pm_confirmed"
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-slate-100 text-slate-700"
                }`}
              >
                {row.source}
              </span>
            )}
            {isBottleneck && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-red-50 text-red-700">
                ⚠ この軸がボトルネック
              </span>
            )}
          </div>

          {/* クリックされた軸の値だけ大きく */}
          <div className="border-2 rounded-md px-4 py-3 flex items-center gap-4" style={{ borderColor: color }}>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-mono uppercase" style={{ color }}>
                {axis}
              </div>
              <div className="text-[10px] text-muted-foreground">{AXIS_DESC[axis]}</div>
            </div>
            <div className="text-5xl font-bold leading-none" style={{ color }}>
              {value ?? "—"}
            </div>
            <div className="text-[10px] text-muted-foreground self-end">/ 9</div>
          </div>

          {row.milestone_label && (
            <div className="text-[12px]">
              <span className="text-muted-foreground">マイルストーン: </span>
              <span className="text-slate-800">{row.milestone_label}</span>
            </div>
          )}

          {/* 軸別の評価理由 */}
          <div
            className="border rounded-md px-3 py-2"
            style={{ borderColor: color + "40", backgroundColor: color + "0d" }}
          >
            <div className="text-[10px] mb-1" style={{ color }}>
              {axis} をこのレベルにした理由
            </div>
            {axisReason ? (
              <div className="text-[12px] whitespace-pre-wrap text-slate-800">{axisReason}</div>
            ) : reasons ? (
              <div className="text-[12px] text-amber-700 italic">
                情報不足 — つくよみがこの軸の評価理由を書いていません。
                下のフィードバック欄に「{axis} はもっと高い、理由は〜」と書けば再評価します。
              </div>
            ) : row.source_note ? (
              <div>
                <div className="text-[12px] whitespace-pre-wrap text-slate-800">{row.source_note}</div>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  (旧形式の理由 — 軸別に分かれていません。次回の再評価で軸別になります)
                </p>
              </div>
            ) : (
              <div className="text-[12px] text-amber-700 italic">
                情報不足 — 評価理由が記録されていません。
              </div>
            )}
          </div>

          <div className="border-t border-[#e5e5e7] pt-3 flex flex-col gap-1">
            <span className="text-[11px] text-muted-foreground">
              ✨ つくよみに {axis} の修正依頼
            </span>
            <MentionTextarea
              projectId={projectId}
              value={feedback}
              onChange={setFeedback}
              placeholder={`例: ${axis} はもっと高いはず。理由は @まさ が${
                axis === "TRL"
                  ? "再現実験を確認し、ロット品質も安定"
                  : axis === "BRL"
                  ? "PoC 契約 2 件まとまったので事業化が進んだ"
                  : axis === "GRL"
                  ? "規制当局のヒアリングをパスし、許認可の見通しが立った"
                  : axis === "SRL"
                  ? "業界団体・消費者団体の前向き反応を得た"
                  : "コアメンバー 3 名揃って人材成熟度が上がった"
              }`}
              rows={4}
              className="w-full border border-[#e5e5e7] rounded-md px-2 py-1.5 text-[12px]"
            />
            <p className="text-[10px] text-muted-foreground">
              送信したらすぐに つくよみが TRL/BRL/GRL/SRL/HRL を再評価します。
            </p>
            {phase === "regenerating" && (
              <p className="text-[12px] text-purple-600">つくよみが再評価しています…</p>
            )}
            {phase === "done" && !error && (
              <p className="text-[12px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-1">
                ✓ 再評価完了
              </p>
            )}
            {error && <p className="text-[12px] text-red-600">{error}</p>}
          </div>
        </div>

        <div className="px-4 py-3 border-t border-[#e5e5e7] flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={phase === "saving" || phase === "regenerating"}
            className="text-[12px] px-3 py-1.5 rounded-md border border-[#e5e5e7] hover:bg-[#fafafa] disabled:opacity-50"
          >
            {phase === "done" ? "閉じる" : "キャンセル"}
          </button>
          {phase !== "done" && (
            <button
              onClick={onSubmit}
              disabled={phase !== "idle" || !feedback.trim()}
              className="text-[12px] px-3 py-1.5 rounded-md bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50"
            >
              {phase === "saving" ? "送信中…" : phase === "regenerating" ? "再評価中…" : "つくよみに送る"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
