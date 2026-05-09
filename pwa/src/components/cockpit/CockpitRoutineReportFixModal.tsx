"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { notifyPlReview } from "@/lib/notify-pl";

interface Props {
  projectId: string;
  ym: string;
  isDone: boolean;
  open: boolean;
  onClose: () => void;
}

interface ReportContent {
  reportId: string | null;
  draftContent: string | null;
  finalContent: string | null;
  status: string | null;
  generatedAt: string | null;
}

const supabase = createClient();

function ymLabel(ym: string) {
  if (ym.length !== 6) return ym;
  return `${ym.slice(0, 4)}年${Number(ym.slice(4))}月`;
}

function fmtJstShort(iso: string | null): string {
  if (!iso) return "—";
  if (iso.length >= 10) {
    const parts = iso.slice(0, 10).split("-");
    if (parts.length === 3) {
      return `${Number(parts[1])}/${Number(parts[2])}`;
    }
  }
  return iso;
}

function statusColor(s: string | null): string {
  if (!s) return "bg-muted-foreground";
  if (s === "draft") return "bg-orange-500";
  if (s === "approved") return "bg-blue-500";
  if (s === "submitted") return "bg-emerald-500";
  return "bg-muted-foreground";
}

function statusLabel(s: string | null): string {
  if (!s) return "—";
  if (s === "draft") return "ドラフト";
  if (s === "approved") return "承認済み";
  if (s === "submitted") return "提出済み";
  return s;
}

type Mode = "view" | "tsukuyomi" | "manual";

export function CockpitRoutineReportFixModal({ projectId, ym, isDone, open, onClose }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ReportContent | null>(null);
  const [exists, setExists] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [mode, setMode] = useState<Mode>("view");
  const [tsukuyomiInstruction, setTsukuyomiInstruction] = useState("");
  const [tsukuyomiBusy, setTsukuyomiBusy] = useState(false);
  const [manualDraft, setManualDraft] = useState("");
  const [manualBusy, setManualBusy] = useState(false);
  const [toast, setToast] = useState<{ msg: string; isError: boolean } | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setToast(null);
    setMode("view");
    setTsukuyomiInstruction("");

    (async () => {
      try {
        const { data, error: dbError } = await supabase
          .from("monthly_reports")
          .select("report_id, project_id, ym, draft_content, final_content, status, generated_at")
          .eq("project_id", projectId)
          .eq("ym", ym)
          .maybeSingle();
        if (cancelled) return;
        if (dbError && dbError.code !== "PGRST116") throw dbError;
        if (!data) {
          setExists(false);
          setReport(null);
        } else {
          setExists(true);
          setReport({
            reportId: data.report_id ?? null,
            draftContent: data.draft_content ?? null,
            finalContent: data.final_content ?? null,
            status: data.status ?? null,
            generatedAt: data.generated_at ?? null,
          });
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, projectId, ym]);

  async function reloadReport() {
    const { data } = await supabase
      .from("monthly_reports")
      .select("report_id, draft_content, final_content, status, generated_at")
      .eq("project_id", projectId)
      .eq("ym", ym)
      .maybeSingle();
    if (data) {
      setReport({
        reportId: data.report_id ?? null,
        draftContent: data.draft_content ?? null,
        finalContent: data.final_content ?? null,
        status: data.status ?? null,
        generatedAt: data.generated_at ?? null,
      });
    }
  }

  async function runTsukuyomi() {
    if (!tsukuyomiInstruction.trim()) return;
    setTsukuyomiBusy(true);
    setToast(null);
    try {
      const res = await fetch("/api/monthly-report/edit-by-tsukuyomi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, ym, instruction: tsukuyomiInstruction.trim() }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.message || `HTTP ${res.status}`);
      await reloadReport();
      setToast({ msg: "つくよみが修正したよ", isError: false });
      setTsukuyomiInstruction("");
      setMode("view");
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : String(e), isError: true });
    } finally {
      setTsukuyomiBusy(false);
    }
  }

  async function saveManual() {
    setManualBusy(true);
    setToast(null);
    try {
      const res = await fetch("/api/monthly-report/manual-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, ym, content: manualDraft }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.message || `HTTP ${res.status}`);
      await reloadReport();
      setToast({ msg: "保存したよ", isError: false });
      setMode("view");
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : String(e), isError: true });
    } finally {
      setManualBusy(false);
    }
  }

  async function fixReport() {
    setFixing(true);
    setToast(null);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const fixedBy = userData.user?.email || "unknown";
      const { error: updateError } = await supabase
        .from("billing_cycles")
        .update({
          report_fixed_at: new Date().toISOString(),
          report_fixed_by: fixedBy,
        })
        .eq("project_id", projectId)
        .eq("ym", ym);
      if (updateError) throw updateError;
      const plRes = await notifyPlReview({ projectId, ym, taskKind: "reportFix", taskLabel: "月次報告書FIX" });
      setToast({
        msg: plRes.sent > 0 ? `FIXしました (PL ${plRes.sent} 名に通知)` : "FIXしました",
        isError: false,
      });
      setTimeout(() => onClose(), 1300);
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : String(e), isError: true });
    } finally {
      setFixing(false);
    }
  }

  const content = report?.finalContent || report?.draftContent || "";
  const busyAny = fixing || tsukuyomiBusy || manualBusy;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>月次報告書FIX</DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold">{ymLabel(ym)}</span>
          {isDone && <span className="text-xs text-emerald-700">✓ 確定済み</span>}
        </div>

        {loading && <p className="text-sm text-muted-foreground py-6 text-center">読み込み中...</p>}

        {error && (
          <div className="py-6 text-center space-y-2">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {!loading && !error && (!exists || !report) && (
          <div className="py-8 text-center space-y-2">
            <div className="text-4xl">📄</div>
            <p className="text-sm text-muted-foreground">まだレポートが生成されていません</p>
            <p className="text-xs text-muted-foreground/70">
              コックピットから月次報告書を生成してください
            </p>
          </div>
        )}

        {!loading && !error && exists && report && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs">
              <span className={`size-2 rounded-full ${statusColor(report.status)}`} />
              <span className="text-muted-foreground">{statusLabel(report.status)}</span>
              {report.generatedAt && (
                <span className="text-muted-foreground/70 text-[10px]">
                  生成: {fmtJstShort(report.generatedAt)}
                </span>
              )}
            </div>

            {mode === "view" && (
              content ? (
                <div className="rounded-lg bg-muted/50 p-3 max-h-[40vh] overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed">
                  {content}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">レポート本文がありません</p>
              )
            )}

            {mode === "tsukuyomi" && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  つくよみへの修正指示を書いてね。指示通りに本文を改訂するよ。
                </p>
                <textarea
                  value={tsukuyomiInstruction}
                  onChange={(e) => setTsukuyomiInstruction(e.target.value)}
                  rows={6}
                  placeholder="例: 「ビジネス進捗」セクションに、4/15 の高砂とのMTG結果を 1 行追加して。プランBの非公開方針を強調しつつ、CryoX への影響を明記して。"
                  className="w-full border border-border rounded-md p-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-foreground/30"
                  disabled={tsukuyomiBusy}
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => { setMode("view"); setTsukuyomiInstruction(""); }}
                    disabled={tsukuyomiBusy}
                  >
                    キャンセル
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={runTsukuyomi}
                    disabled={tsukuyomiBusy || !tsukuyomiInstruction.trim()}
                  >
                    {tsukuyomiBusy ? "つくよみが書き直し中…" : "✨ 修正させる"}
                  </Button>
                </div>
              </div>
            )}

            {mode === "manual" && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  本文を直接編集して「保存」を押してね。
                </p>
                <textarea
                  value={manualDraft}
                  onChange={(e) => setManualDraft(e.target.value)}
                  rows={16}
                  className="w-full border border-border rounded-md p-2 text-sm bg-background font-mono focus:outline-none focus:ring-1 focus:ring-foreground/30"
                  disabled={manualBusy}
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setMode("view")}
                    disabled={manualBusy}
                  >
                    キャンセル
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={saveManual}
                    disabled={manualBusy || manualDraft === content}
                  >
                    {manualBusy ? "保存中…" : "💾 保存"}
                  </Button>
                </div>
              </div>
            )}

            {mode === "view" && !isDone && (
              <div className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setMode("tsukuyomi")}
                  disabled={busyAny || !content}
                >
                  ✨ つくよみに修正させる
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => { setManualDraft(content); setMode("manual"); }}
                  disabled={busyAny}
                >
                  📝 手動で修正する
                </Button>
                <Button
                  className="w-full"
                  onClick={fixReport}
                  disabled={busyAny || !content}
                >
                  {fixing ? "処理中..." : "📨 PLに確認依頼する"}
                </Button>
              </div>
            )}
          </div>
        )}

        {toast && (
          <div
            className={`rounded-md px-3 py-2 text-xs mt-2 ${
              toast.isError ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"
            }`}
          >
            {toast.msg}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
