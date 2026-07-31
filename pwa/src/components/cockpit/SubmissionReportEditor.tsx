"use client";

import { useEffect, useState } from "react";

type SubmissionReport = {
  bodyMd: string;
  generatedAt: string | null;
  updatedAt: string | null;
  jargonCheckStatus: "clean" | "warning" | "failed" | null;
};

function dateLabel(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleString("ja-JP", { dateStyle: "short", timeStyle: "short" });
}

export function SubmissionReportEditor({ projectId, ym }: { projectId: string; ym: string }) {
  const [report, setReport] = useState<SubmissionReport | null>(null);
  const [content, setContent] = useState("");
  const [originalContent, setOriginalContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedMessage, setSavedMessage] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch(`/api/monthly-report/external-manual-update?projectId=${encodeURIComponent(projectId)}&ym=${encodeURIComponent(ym)}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "提出版の読み込みに失敗しました");
        if (!active) return;
        const loaded = (data.report || null) as SubmissionReport | null;
        setReport(loaded);
        setContent(loaded?.bodyMd || "");
        setOriginalContent(loaded?.bodyMd || "");
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "提出版の読み込みに失敗しました");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [projectId, ym]);

  const isDirty = content !== originalContent;
  const save = async () => {
    setSaving(true);
    setError("");
    setSavedMessage("");
    try {
      const res = await fetch("/api/monthly-report/external-manual-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, ym, content }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "提出版の保存に失敗しました");
      const saved = data.report as SubmissionReport;
      setReport(saved);
      setContent(saved.bodyMd);
      setOriginalContent(saved.bodyMd);
      setSavedMessage("保存したよ。提出版PDFを開いて最終確認してね。");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "提出版の保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="py-5 text-sm text-muted-foreground">提出版を読み込み中...</p>;

  return (
    <div className="min-w-0 space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className={`rounded px-2 py-1 ${report ? "bg-sky-100 text-sky-900" : "bg-muted text-muted-foreground"}`}>
          {report ? "提出版を編集中" : "提出版は未作成"}
        </span>
        {dateLabel(report?.updatedAt || null) && <span className="text-muted-foreground">最終保存: {dateLabel(report?.updatedAt || null)}</span>}
        {report?.jargonCheckStatus === "warning" && <span className="text-amber-700">要表記確認</span>}
      </div>

      {!report && (
        <p className="text-xs leading-5 text-muted-foreground">
          月末の自動生成前でも、提出版の形式に沿った本文をここから作成できる。保存時に章構成・表・内部用語を確認する。
        </p>
      )}

      <textarea
        value={content}
        onChange={(event) => {
          setContent(event.target.value);
          setSavedMessage("");
        }}
        aria-label="提出版のMarkdown本文"
        className="min-h-[420px] w-full resize-y rounded-md border border-sky-200 bg-background p-3 font-mono text-sm leading-6 outline-none focus-visible:ring-2 focus-visible:ring-sky-600"
        placeholder="# 月次業務報告書\n\n提出版の本文を入力"
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={`text-xs ${isDirty ? "text-amber-700" : "text-muted-foreground"}`}>
          {isDirty ? "未保存の変更あり" : "保存済みの本文"}
        </p>
        <div className="flex flex-wrap gap-2">
          <a
            href={`/project/${projectId}/report/${ym}/print?template=submission`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center rounded-md border border-border px-3 py-2 text-xs text-foreground transition-colors hover:bg-accent"
          >
            提出版PDFを開く
          </a>
          <button
            onClick={save}
            disabled={!content.trim() || !isDirty || saving}
            className="min-h-11 rounded-md bg-sky-700 px-3 py-2 text-xs text-white transition-colors hover:bg-sky-800 disabled:opacity-50"
          >
            {saving ? "保存中..." : "保存"}
          </button>
        </div>
      </div>

      {error && <div role="alert" className="whitespace-pre-wrap rounded-md bg-red-50 p-3 text-xs leading-5 text-red-700">{error}</div>}
      {savedMessage && <div className="rounded-md bg-emerald-50 p-3 text-xs text-emerald-800">{savedMessage}</div>}
    </div>
  );
}
