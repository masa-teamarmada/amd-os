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

interface Props {
  projectId: string;
  row: ProjectXrlRow;
  onClose: () => void;
  onUpdated: () => void;
}

const AXIS_COLORS = { TRL: "#0ea5e9", BRL: "#f59e0b", HRL: "#16a34a" };

export function CockpitXrlDetailModal({ projectId, row, onClose, onUpdated }: Props) {
  const [feedback, setFeedback] = useState("");
  const [phase, setPhase] = useState<"idle" | "saving" | "regenerating" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

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
        body: JSON.stringify({ xrl_log_id: row.id, feedback: feedback.trim() }),
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
          <h3 className="text-sm font-semibold">XRL 観測の詳細</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-sm">
            ✕
          </button>
        </div>

        <div className="px-4 py-3 flex flex-col gap-3 text-[12px]">
          <div className="flex items-center gap-2">
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
          </div>

          <div className="flex gap-3">
            {(["trl", "brl", "hrl"] as const).map((k) => {
              const v = row[k] as number | null;
              const color = AXIS_COLORS[k.toUpperCase() as keyof typeof AXIS_COLORS];
              return (
                <div key={k} className="flex-1 border border-[#e5e5e7] rounded-md px-3 py-2">
                  <div className="text-[10px] uppercase font-mono" style={{ color }}>
                    {k}
                  </div>
                  <div className="text-2xl font-bold" style={{ color }}>
                    {v ?? "—"}
                  </div>
                </div>
              );
            })}
          </div>

          {row.bottleneck && (
            <div className="text-[12px]">
              <span className="text-muted-foreground">ボトルネック: </span>
              <span className="font-mono font-bold" style={{ color: AXIS_COLORS[row.bottleneck as keyof typeof AXIS_COLORS] }}>
                {row.bottleneck}
              </span>
            </div>
          )}

          {row.milestone_label && (
            <div className="text-[12px]">
              <span className="text-muted-foreground">マイルストーン: </span>
              <span className="text-slate-800">{row.milestone_label}</span>
            </div>
          )}

          {row.source_note && (
            <div className="border border-blue-100 bg-blue-50/40 rounded-md px-3 py-2">
              <div className="text-[10px] text-blue-700 mb-1">評価理由</div>
              <div className="text-[12px] whitespace-pre-wrap text-slate-800">{row.source_note}</div>
            </div>
          )}

          <div className="border-t border-[#e5e5e7] pt-3 flex flex-col gap-1">
            <span className="text-[11px] text-muted-foreground">✨ つくよみに修正依頼</span>
            <MentionTextarea
              projectId={projectId}
              value={feedback}
              onChange={setFeedback}
              placeholder="例: ここはもっと TRL 高いよ。理由は @まさ が再現実験を確認し、ロット品質も安定してきたから"
              rows={4}
              className="w-full border border-[#e5e5e7] rounded-md px-2 py-1.5 text-[12px]"
            />
            <p className="text-[10px] text-muted-foreground">
              送信したらすぐに つくよみが TRL/BRL/HRL を再評価します。
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
