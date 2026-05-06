"use client";

/**
 * 月次試算表ヒアリングモード:
 *   つくよみが「いつ採用?」「賃料は?」みたいな質問を 1 つずつ投げて、
 *   ユーザーが文章で答えていく。十分情報が揃ったら 12〜36 ヶ月分の月次 PL を生成して
 *   project_pl_monthly に upsert する。
 *
 *   ベース情報 (events / members / partners / xrl / 既存 PL) は API 側で勝手に集約し、
 *   ヒアリングは「他で得られなかった情報のみ」に絞る。
 */

import { useEffect, useRef, useState } from "react";
import { plHearingTurn } from "@/lib/venture-status-data";

interface Props {
  projectId: string;
  onClose: () => void;
  onApplied: () => void;
}

interface Turn {
  q: string;
  a: string;
}

export function CockpitPlHearingModal({ projectId, onClose, onApplied }: Props) {
  const [history, setHistory] = useState<Turn[]>([]);
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState(false);
  const [summary, setSummary] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 初回ターン: 質問なし、空 history で API を叩く
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await plHearingTurn(projectId, []);
      if (cancelled) return;
      if (!r) {
        setError("ヒアリングを開始できませんでした");
        setLoading(false);
        return;
      }
      if (r.done) {
        setDone(true);
        setSummary(r.summary ?? "");
        setLoading(false);
        return;
      }
      setPendingQuestion(r.question ?? null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [history, pendingQuestion, done]);

  const sendAnswer = async () => {
    if (!pendingQuestion || !answer.trim()) return;
    const newHistory: Turn[] = [...history, { q: pendingQuestion, a: answer.trim() }];
    setHistory(newHistory);
    setAnswer("");
    setPendingQuestion(null);
    setLoading(true);
    setError(null);

    const r = await plHearingTurn(projectId, newHistory, answer.trim());
    setLoading(false);
    if (!r) {
      setError("ヒアリングが進められませんでした");
      return;
    }
    if (r.done) {
      setDone(true);
      setSummary(r.summary ?? "");
      onApplied();
      return;
    }
    setPendingQuestion(r.question ?? null);
  };

  const skipToGenerate = async () => {
    setLoading(true);
    setError(null);
    // ヒアリング打ち切り = 「もう答えられないからこのデータで作って」
    const r = await plHearingTurn(projectId, history, "(これ以上の回答はできません。これまでの情報で試算表を作成してください)");
    setLoading(false);
    if (!r) {
      setError("生成できませんでした");
      return;
    }
    if (r.done) {
      setDone(true);
      setSummary(r.summary ?? "");
      onApplied();
    } else if (r.question) {
      setPendingQuestion(r.question);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-[640px] max-w-[92vw] max-h-[88vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-[#e5e5e7] flex items-center justify-between">
          <h3 className="text-sm font-semibold">✨ つくよみとヒアリング (月次試算表)</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-sm">
            ✕
          </button>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">
          <p className="text-[11px] text-muted-foreground">
            既存の events / メンバー / 顧客 / XRL からつくよみが情報を集めて、足りない部分だけ質問します。
            「もう情報がない」「これで作って」と言えばその場で試算表を出力します。
          </p>

          {history.map((t, i) => (
            <div key={i} className="flex flex-col gap-2">
              <div className="self-start max-w-[88%] bg-purple-50 text-purple-900 text-[12.5px] px-3 py-2 rounded-2xl rounded-bl-sm whitespace-pre-wrap">
                <span className="text-[10px] text-purple-500 mr-1">つくよみ</span>
                {t.q}
              </div>
              <div className="self-end max-w-[88%] bg-slate-100 text-slate-900 text-[12.5px] px-3 py-2 rounded-2xl rounded-br-sm whitespace-pre-wrap">
                <span className="text-[10px] text-slate-500 mr-1">まさ</span>
                {t.a}
              </div>
            </div>
          ))}

          {pendingQuestion && !done && (
            <div className="self-start max-w-[88%] bg-purple-50 text-purple-900 text-[12.5px] px-3 py-2 rounded-2xl rounded-bl-sm whitespace-pre-wrap">
              <span className="text-[10px] text-purple-500 mr-1">つくよみ</span>
              {pendingQuestion}
            </div>
          )}

          {loading && (
            <div className="self-start text-[11px] text-muted-foreground italic">つくよみが考えてます…</div>
          )}

          {done && (
            <div className="self-start max-w-[92%] bg-emerald-50 text-emerald-900 text-[12.5px] px-3 py-2 rounded-md whitespace-pre-wrap">
              <div className="text-[10px] text-emerald-700 mb-1">✓ ヒアリング完了 — 試算表を更新しました</div>
              {summary}
            </div>
          )}

          {error && <p className="text-[12px] text-red-600">{error}</p>}
        </div>

        {!done && (
          <div className="px-4 py-3 border-t border-[#e5e5e7] flex flex-col gap-2">
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  void sendAnswer();
                }
              }}
              placeholder={pendingQuestion ? "回答を文章で…" : "つくよみが質問を準備中…"}
              rows={3}
              disabled={!pendingQuestion || loading}
              className="border border-[#e5e5e7] rounded-md px-2 py-1.5 text-[13px] disabled:bg-[#fafafa]"
            />
            <div className="flex justify-between items-center">
              <button
                onClick={skipToGenerate}
                disabled={loading}
                className="text-[11px] text-muted-foreground hover:underline disabled:opacity-40"
              >
                これ以上情報なし → このまま試算表生成
              </button>
              <button
                onClick={sendAnswer}
                disabled={loading || !answer.trim() || !pendingQuestion}
                className="text-[12px] px-3 py-1.5 rounded-md bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-40"
              >
                送信 (⌘+Enter)
              </button>
            </div>
          </div>
        )}

        {done && (
          <div className="px-4 py-3 border-t border-[#e5e5e7] flex justify-end">
            <button
              onClick={onClose}
              className="text-[12px] px-3 py-1.5 rounded-md bg-slate-700 text-white hover:bg-slate-800"
            >
              閉じる
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
