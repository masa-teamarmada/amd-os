"use client";

/**
 * 会社情報 > 会社概要「事業の概要」（事業の一言と詳しい説明）。spec 3-23 §9。
 *
 * 2026-10-04 まさ確定: 事業の一言は会社の話なので、PJ概要から会社概要へ移した。PJを作るときに書いて、めったに変えない。
 * 直せるのは管理者だけ（正本 project_business_summaries）。Venture Map・沿革・XRL判定などが読む
 * project_ventures の2列へは DB のトリガーが写す。つくよみの追記マージや、チャットからの書き換えの入口は無い。
 * 共有ワークスペースの会社概要でも読み取りで出す。
 */

import { useEffect, useState, type FormEvent } from "react";
import { Loader2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Field, Section } from "@/components/cockpit/company-overview-ui";
import { loadBusinessSummary, peekBusinessSummary, saveBusinessSummary } from "@/lib/business-summary-client";
import type { BusinessSummaryResponse } from "@/lib/project-overview";

const RULE = "技術、製品、用途、顧客および事業の背景を記載。";

export function CompanyBusinessSummarySection({ projectId, readOnly = false, initialData }: { projectId: string; readOnly?: boolean; initialData?: BusinessSummaryResponse }) {
  const [data, setData] = useState<BusinessSummaryResponse | null>(() => initialData ?? peekBusinessSummary(projectId) ?? null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (initialData) return;
    let cancelled = false;
    loadBusinessSummary(projectId)
      .then((value) => !cancelled && setData(value))
      .catch((cause) => !cancelled && setError(cause instanceof Error ? cause.message : "事業概要を取得できません。"));
    return () => {
      cancelled = true;
    };
  }, [projectId, initialData]);

  const business = data?.business ?? null;
  const canEdit = !readOnly && Boolean(data?.viewer.canEdit);

  return (
    <div data-testid="company-business-summary">
      <Section
        title="事業の概要"
        action={canEdit ? <Button variant="outline" className="h-11" onClick={() => setEditing(true)}><Pencil />編集</Button> : undefined}
      >
        <div className="grid">
          <div className="min-w-0 border-b border-slate-100 px-4 py-3 sm:px-5">
            <div className="text-[11px] font-medium text-slate-500">事業概要</div>
            <div className="mt-1 whitespace-pre-wrap break-words text-[13px] leading-5 text-slate-900">
              {!data ? (error ? <span className="text-rose-600">{error}</span> : <span className="inline-block h-3 w-2/3 animate-pulse rounded bg-slate-100" aria-hidden="true" />) : business?.summary || <span className="text-slate-400">未登録</span>}
            </div>
          </div>
          <div className="min-w-0 px-4 py-3 sm:px-5">
            <div className="text-[11px] font-medium text-slate-500">事業詳細</div>
            <div className="mt-1 whitespace-pre-wrap break-words text-[13px] leading-6 text-slate-900">
              {!data ? (error ? null : <span className="inline-block h-3 w-1/2 animate-pulse rounded bg-slate-100" aria-hidden="true" />) : business?.detail || <span className="text-slate-400">未登録</span>}
            </div>
          </div>
        </div>
      </Section>

      {editing && (
        <BusinessSummaryDialog
          initialSummary={business?.summary ?? ""}
          initialDetail={business?.detail ?? ""}
          onClose={() => setEditing(false)}
          onSave={async (input) => {
            setData(await saveBusinessSummary(projectId, input));
            setEditing(false);
          }}
        />
      )}
    </div>
  );
}

function BusinessSummaryDialog({
  initialSummary,
  initialDetail,
  onClose,
  onSave,
}: {
  initialSummary: string;
  initialDetail: string;
  onClose: () => void;
  onSave: (input: { summary: string | null; detail: string | null }) => Promise<void>;
}) {
  const [summary, setSummary] = useState(initialSummary);
  const [detail, setDetail] = useState(initialDetail);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onSave({ summary: summary.trim() || null, detail: detail.trim() || null });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存に失敗しました。");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:!max-w-2xl">
        <form onSubmit={(event) => void submit(event)}>
          <DialogHeader>
            <DialogTitle>事業の概要を編集</DialogTitle>
            <DialogDescription>{RULE}</DialogDescription>
          </DialogHeader>
          <div className="my-5 grid gap-4">
            <Field label="事業概要" name="business-summary" hint="300文字以内">
              <Textarea id="business-summary" value={summary} onChange={(event) => setSummary(event.target.value)} rows={2} maxLength={300} />
            </Field>
            <Field label="事業詳細" name="business-detail">
              <Textarea id="business-detail" value={detail} onChange={(event) => setDetail(event.target.value)} rows={8} maxLength={4000} />
            </Field>
            {error && <p role="alert" className="text-[12px] text-rose-600">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" className="h-11" onClick={onClose}>閉じる</Button>
            <Button type="submit" className="h-11" disabled={saving}>{saving && <Loader2 className="animate-spin" />}保存</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
