"use client";

/**
 * 沿革修正依頼モーダル: 個別項目 (or 全体) に対する「ここが間違ってる」を投げる。
 * 保存先: narrative_feedbacks。次回の沿革 cron が open feedbacks を読んで反映 + applied 化 + lesson 抽出 (学習)。
 */

import { useState } from "react";
import { submitNarrativeFeedback, regenerateNarrativeNow } from "@/lib/venture-status-data";

interface Props {
  projectId: string;
  itemDate: string | null;
  itemTitle: string | null;
  onClose: () => void;
  onSubmitted: () => void;
}

export function CockpitNarrativeFeedbackModal({
  projectId,
  itemDate,
  itemTitle,
  onClose,
  onSubmitted,
}: Props) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [phase, setPhase] = useState<"idle" | "saving" | "regenerating" | "done">("idle");
  const [result, setResult] = useState<{ count: number; lessons: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    if (!text.trim()) return;
    setSaving(true);
    setPhase("saving");
    setError(null);
    const r = await submitNarrativeFeedback(projectId, {
      item_date: itemDate,
      item_title: itemTitle,
      feedback: text.trim(),
    });
    if (!r) {
      setSaving(false);
      setPhase("idle");
      setError("送信に失敗しました");
      return;
    }
    // 即時再生成 (cron を待たない)
    setPhase("regenerating");
    const regen = await regenerateNarrativeNow(projectId);
    setSaving(false);
    if (!regen || !regen.ok) {
      setError("沿革の即時反映に失敗しました。次の 03:45 cron で反映されます。");
      setPhase("done");
      // フィードバック自体は保存できているので onSubmitted は呼ばない (モーダルは開いたまま)
      return;
    }
    setResult({ count: regen.count, lessons: regen.lessons });
    setPhase("done");
    onSubmitted();
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-[520px] max-w-[92vw]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-[#e5e5e7] flex items-center justify-between">
          <h3 className="text-sm font-semibold">✏ つくよみへの修正依頼</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-sm">
            ✕
          </button>
        </div>

        <div className="px-4 py-3 flex flex-col gap-2">
          {itemDate && itemTitle && (
            <div className="text-[11px] text-muted-foreground border-l-2 border-[#cbd5e1] pl-2">
              <span className="font-mono">{itemDate}</span> · {itemTitle}
            </div>
          )}
          {(!itemDate || !itemTitle) && (
            <div className="text-[11px] text-muted-foreground italic">
              沿革全体に対する修正依頼として送信されます。
            </div>
          )}

          <label className="flex flex-col gap-1 text-[12px]">
            <span className="text-muted-foreground">どこが、どう間違っていますか?</span>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={6}
              autoFocus
              placeholder={
                "例: 設立日が 2019-04 になってるけど正しくは 2019-04-28。\nまた「TRL4 で設立」は誤りで、設立時点では TRL3。"
              }
              className="border border-[#e5e5e7] rounded-md px-2 py-1.5 text-[13px]"
            />
          </label>

          <p className="text-[10px] text-muted-foreground">
            送信したら すぐに つくよみが沿革を直して、学んだルールは admin/tsukuyomi に残ります。
            一般化できるルールは他 PJ の沿革生成にも反映されます。
          </p>

          {phase === "regenerating" && (
            <p className="text-[12px] text-purple-600">つくよみが沿革を書き直しています…</p>
          )}
          {phase === "done" && result && (
            <p className="text-[12px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-1">
              ✓ 沿革を {result.count} 件で再生成しました
              {result.lessons > 0 && ` / 学習ルールを ${result.lessons} 件抽出`}
            </p>
          )}
          {error && <p className="text-[12px] text-red-600">{error}</p>}
        </div>

        <div className="px-4 py-3 border-t border-[#e5e5e7] flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={saving}
            className="text-[12px] px-3 py-1.5 rounded-md border border-[#e5e5e7] hover:bg-[#fafafa] disabled:opacity-50"
          >
            {phase === "done" ? "閉じる" : "キャンセル"}
          </button>
          {phase !== "done" && (
            <button
              onClick={onSubmit}
              disabled={saving || !text.trim()}
              className="text-[12px] px-3 py-1.5 rounded-md bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50"
            >
              {phase === "saving"
                ? "送信中…"
                : phase === "regenerating"
                ? "再生成中…"
                : "つくよみに送る"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
