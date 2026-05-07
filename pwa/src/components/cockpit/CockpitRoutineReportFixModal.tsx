"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { callEdgeFunctionPOST } from "@/lib/supabase/edge-functions";

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

export function CockpitRoutineReportFixModal({ projectId, ym, isDone, open, onClose }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ReportContent | null>(null);
  const [exists, setExists] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [requestingEdit, setRequestingEdit] = useState(false);
  const [toast, setToast] = useState<{ msg: string; isError: boolean } | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setToast(null);

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

  async function requestEditOnPC() {
    setRequestingEdit(true);
    setToast(null);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const email = userData.user?.email;
      if (!email) throw new Error("ログイン情報が取得できません");

      const result = await callEdgeFunctionPOST<{ ok: boolean; message?: string }>("send-slack-dm", {
        projectId,
        ym,
        email,
      });
      if (result.ok) {
        setToast({ msg: result.message || "Slackに送ったよ！", isError: false });
      } else {
        setToast({ msg: result.message || "エラーが発生しました", isError: true });
      }
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : String(e), isError: true });
    } finally {
      setRequestingEdit(false);
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
      setToast({ msg: "レポートをFIXしました", isError: false });
      setTimeout(() => onClose(), 1300);
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : String(e), isError: true });
    } finally {
      setFixing(false);
    }
  }

  const content = report?.finalContent || report?.draftContent || "";

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

            {content ? (
              <div className="rounded-lg bg-muted/50 p-3 max-h-[40vh] overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed">
                {content}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">レポート本文がありません</p>
            )}

            {!isDone && (
              <div className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={requestEditOnPC}
                  disabled={requestingEdit || fixing}
                >
                  {requestingEdit ? "送信中..." : "🖥 PCで内容を編集する"}
                </Button>
                <Button
                  className="w-full"
                  onClick={fixReport}
                  disabled={fixing || requestingEdit || !content}
                >
                  {fixing ? "処理中..." : "✓ レポートをFIXする"}
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
