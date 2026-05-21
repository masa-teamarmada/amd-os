"use client";

import { useEffect, useRef, useState } from "react";
import {
  fetchAtlasDecisions,
  addAtlasDecision,
  updateAtlasDecision,
  type AtlasDecision,
} from "@/lib/supabase-data";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ACTIONS: AtlasDecision["action"][] = ["起業", "スタジオ", "支援", "スルー", "保留"];

const actionBadge: Record<string, string> = {
  起業: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  スタジオ: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  支援: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  スルー: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
  保留: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
};

function formatDate(ts: string) {
  return new Date(ts).toLocaleDateString("ja-JP", { year: "numeric", month: "numeric", day: "numeric" });
}

function isoToDateInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dateInputToIso(s: string): string | null {
  if (!s) return null;
  return new Date(s + "T00:00:00").toISOString();
}

export default function AtlasDecisionsPage() {
  const pathname = usePathname();
  const atlasBase = pathname.startsWith("/hud/") ? "/hud/atlas" : "/atlas";
  const [decisions, setDecisions] = useState<AtlasDecision[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const reload = () =>
    fetchAtlasDecisions().then((ds) => {
      setDecisions(ds);
      setLoading(false);
    });

  useEffect(() => {
    reload();
  }, []);

  const editingDecision = decisions.find((d) => d.id === editingId) || null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-2.75rem)]">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    );
  }

  return (
    <>
      <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <Link href={atlasBase} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              ← Atlas
            </Link>
            <h1 className="text-lg font-bold mt-1">判断ログ</h1>
            <p className="text-xs text-muted-foreground">AMDの事業判断の記録と振り返り</p>
          </div>
          <button
            onClick={() => setCreating(true)}
            className="text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium"
          >
            + 判断を記録
          </button>
        </div>

        {decisions.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground text-sm space-y-1">
            <p>判断ログがまだありません</p>
            <p className="text-xs">「+ 判断を記録」から最初の判断を残してください</p>
          </div>
        ) : (
          <div className="space-y-3">
            {decisions.map((d) => (
              <DecisionCard
                key={d.id}
                decision={d}
                onEdit={() => setEditingId(d.id)}
              />
            ))}
          </div>
        )}
      </div>

      {creating && (
        <DecisionFormModal
          mode="create"
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            reload();
          }}
        />
      )}

      {editingDecision && (
        <DecisionFormModal
          mode="edit"
          initial={editingDecision}
          onClose={() => setEditingId(null)}
          onSaved={() => {
            setEditingId(null);
            reload();
          }}
        />
      )}
    </>
  );
}

function DecisionCard({
  decision,
  onEdit,
}: {
  decision: AtlasDecision;
  onEdit: () => void;
}) {
  const isEvalDue =
    decision.outcome_eval_at && new Date(decision.outcome_eval_at) <= new Date() && !decision.outcome;

  return (
    <button
      onClick={onEdit}
      className={cn(
        "w-full text-left p-3.5 rounded-lg border bg-card space-y-2 hover:border-primary/40 transition-colors",
        isEvalDue ? "border-amber-400" : "border-border"
      )}
    >
      <div className="flex items-start gap-2">
        <span className={cn("shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded mt-0.5", actionBadge[decision.action])}>
          {decision.action}
        </span>
        <div className="flex-1 min-w-0">
          {decision.rationale && (
            <p className="text-sm leading-relaxed">{decision.rationale}</p>
          )}
          <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground/60">
            <span>{formatDate(decision.decided_at)}</span>
            {decision.outcome_eval_at && (
              <span className={isEvalDue ? "text-amber-500 font-medium" : ""}>
                振り返り: {formatDate(decision.outcome_eval_at)}{isEvalDue ? " ⚠️" : ""}
              </span>
            )}
          </div>
        </div>
      </div>
      {decision.outcome && (
        <div className="p-2.5 rounded bg-muted/50 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">結果: </span>
          {decision.outcome}
        </div>
      )}
    </button>
  );
}

function DecisionFormModal({
  mode,
  initial,
  onClose,
  onSaved,
}: {
  mode: "create" | "edit";
  initial?: AtlasDecision;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [action, setAction] = useState<AtlasDecision["action"]>(initial?.action || "保留");
  const [rationale, setRationale] = useState(initial?.rationale || "");
  const [decidedDate, setDecidedDate] = useState(isoToDateInput(initial?.decided_at) || isoToDateInput(new Date().toISOString()));
  const [evalDate, setEvalDate] = useState(isoToDateInput(initial?.outcome_eval_at));
  const [outcome, setOutcome] = useState(initial?.outcome || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);

  const handleBackdrop = (e: React.MouseEvent) => {
    if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleSave = async () => {
    setError("");
    setSaving(true);
    try {
      if (mode === "create") {
        const id = await addAtlasDecision({
          topicId: null,
          action,
          rationale: rationale.trim() || undefined,
          decidedAt: dateInputToIso(decidedDate) || undefined,
          outcomeEvalAt: dateInputToIso(evalDate) || undefined,
        });
        if (!id) {
          setError("保存に失敗しました（ログイン状況を確認してください）");
          setSaving(false);
          return;
        }
      } else if (initial) {
        const ok = await updateAtlasDecision(initial.id, {
          action,
          rationale: rationale.trim() || null,
          outcomeEvalAt: dateInputToIso(evalDate),
          outcome: outcome.trim() || null,
        });
        if (!ok) {
          setError("更新に失敗しました");
          setSaving(false);
          return;
        }
      }
      onSaved();
    } catch (e) {
      setError(String(e));
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={handleBackdrop}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        ref={panelRef}
        className="relative z-10 w-full max-w-md bg-background rounded-2xl shadow-2xl border border-border p-5 space-y-4 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-bold">
              {mode === "create" ? "判断を記録" : "判断を編集"}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {mode === "create"
                ? "AMDが何をどう判断したかを残す"
                : "outcome（結果）を追記して振り返りを完了させる"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors p-1 -mr-1 -mt-1"
            aria-label="閉じる"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* action */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-semibold text-foreground uppercase tracking-wider">
            アクション
          </label>
          <div className="flex flex-wrap gap-1.5">
            {ACTIONS.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setAction(a)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                  action === a
                    ? cn("border-transparent", actionBadge[a])
                    : "border-border text-muted-foreground hover:bg-accent"
                )}
              >
                {a}
              </button>
            ))}
          </div>
        </div>

        {/* rationale */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-semibold text-foreground uppercase tracking-wider">
            判断理由
          </label>
          <textarea
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
            rows={3}
            placeholder="この判断に至った文脈と前提を簡潔に"
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
          />
        </div>

        {/* dates */}
        <div className="flex gap-3">
          {mode === "create" && (
            <div className="flex-1 space-y-1.5">
              <label className="text-[10px] font-semibold text-foreground uppercase tracking-wider">
                判断日
              </label>
              <input
                type="date"
                value={decidedDate}
                onChange={(e) => setDecidedDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          )}
          <div className="flex-1 space-y-1.5">
            <label className="text-[10px] font-semibold text-foreground uppercase tracking-wider">
              振り返り予定日
            </label>
            <input
              type="date"
              value={evalDate}
              onChange={(e) => setEvalDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
        </div>

        {/* outcome (edit mode only) */}
        {mode === "edit" && (
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold text-foreground uppercase tracking-wider">
              結果（outcome）
            </label>
            <textarea
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              rows={3}
              placeholder="何が起きたか、当時の判断は妥当だったか"
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
          </div>
        )}

        {error && (
          <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
            {error}
          </p>
        )}

        <div className="flex gap-2 pt-1">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-accent transition-colors"
          >
            キャンセル
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {saving ? "保存中..." : mode === "create" ? "記録する" : "更新する"}
          </button>
        </div>
      </div>
    </div>
  );
}
