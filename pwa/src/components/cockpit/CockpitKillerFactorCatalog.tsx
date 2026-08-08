"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Circle,
  FileWarning,
  Loader2,
  Pencil,
  Plus,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type KillerFactorItem = {
  killerFactorId: string;
  factorType: string;
  eventDescription: string;
  observationClues: string;
  status: "not_occurred" | "occurred";
  occurredOn: string | null;
  evidenceNote: string | null;
  recordedByMemberId: string | null;
  recordedByLabel: string | null;
  recordedAt: string | null;
};

function formatDate(value: string | null) {
  if (!value) return "—";
  return value.replaceAll("-", "/");
}

function Field({ label, name, children, hint }: { label: string; name: string; children: ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name} className="text-xs text-slate-700">{label}</Label>
      {children}
      {hint && <p className="text-[11px] leading-5 text-slate-500">{hint}</p>}
    </div>
  );
}

export function CockpitKillerFactorCatalog({ projectId }: { projectId: string }) {
  const [items, setItems] = useState<KillerFactorItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [occurrenceFactor, setOccurrenceFactor] = useState<KillerFactorItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/governance/killer-factors?projectId=${encodeURIComponent(projectId)}`);
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error(json.error || "キラー要素カタログを読み込めなかったよ");
      setItems(Array.isArray(json.items) ? json.items : []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "キラー要素カタログを読み込めなかったよ");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { void load(); }, [load]);

  const occurredCount = useMemo(() => items.filter((item) => item.status === "occurred").length, [items]);

  async function post(body: Record<string, unknown>) {
    const response = await fetch("/api/governance/killer-factors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await response.json();
    if (!response.ok || !json.ok) throw new Error(json.error || "保存できなかったよ");
  }

  function showNotice(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3600);
  }

  async function saveFactor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    setError("");
    try {
      await post({
        action: "create_factor",
        factorType: String(form.get("factor_type") || ""),
        eventDescription: String(form.get("event_description") || ""),
        observationClues: String(form.get("observation_clues") || ""),
      });
      setAddOpen(false);
      await load();
      showNotice("共通カタログへ要素を追加したよ。全PJに反映されてる");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "要素を追加できなかったよ");
    } finally {
      setSaving(false);
    }
  }

  async function saveOccurrence(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!occurrenceFactor) return;
    const form = new FormData(event.currentTarget);
    setSaving(true);
    setError("");
    try {
      await post({
        action: "mark_occurred",
        projectId,
        killerFactorId: occurrenceFactor.killerFactorId,
        occurredOn: String(form.get("occurred_on") || ""),
        evidenceNote: String(form.get("evidence_note") || ""),
      });
      setOccurrenceFactor(null);
      await load();
      showNotice("このPJの発生記録を保存したよ");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "発生記録を保存できなかったよ");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
      data-testid="killer-factor-catalog"
    >
      <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 sm:flex-row sm:items-start sm:px-5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <ShieldAlert className="size-4 text-slate-500" />
            <h2 className="text-[15px] font-semibold tracking-tight text-slate-950">キラー要素カタログ</h2>
            <span className={`rounded-md border px-2 py-1 text-[10px] font-medium ${occurredCount > 0 ? "border-rose-200 bg-rose-50 text-rose-700" : "border-slate-200 bg-slate-50 text-slate-600"}`}>
              発生 {occurredCount} / {items.length}
            </span>
          </div>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500">
            工程失敗や資金切れとは別に、事業化見込みを大きく削る事象を確認する共通台帳。発生時は記録・文書の根拠を残す。
          </p>
        </div>
        <Button
          variant="outline"
          className="h-11 w-full sm:w-auto sm:shrink-0"
          onClick={() => setAddOpen(true)}
          data-html2canvas-ignore="true"
        >
          <Plus />要素を追加
        </Button>
      </div>

      {error && (
        <div role="alert" className="m-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 sm:m-5">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />{error}
        </div>
      )}
      {notice && (
        <div role="status" className="m-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 sm:m-5">
          <Check className="size-4 shrink-0" />{notice}
        </div>
      )}

      {loading && items.length === 0 ? (
        <div className="flex min-h-40 items-center justify-center text-sm text-slate-500">
          <Loader2 className="mr-2 size-4 animate-spin" />カタログを読み込み中…
        </div>
      ) : items.length === 0 ? (
        <div className="px-5 py-8 text-center text-sm leading-6 text-slate-500">
          共通要素はまだないよ。「要素を追加」から最初の型を登録できる。
        </div>
      ) : (
        <div role="table" aria-label="キラー要素カタログ">
          <div role="row" className="hidden grid-cols-[9rem_minmax(16rem,1.15fr)_minmax(18rem,1.35fr)_15rem] gap-4 bg-slate-50 px-5 py-3 text-[11px] font-medium text-slate-500 lg:grid">
            <div role="columnheader">型</div>
            <div role="columnheader">事象</div>
            <div role="columnheader">観測の手がかり</div>
            <div role="columnheader">このPJでの状態</div>
          </div>
          <div className="divide-y divide-slate-100">
            {items.map((item) => {
              const occurred = item.status === "occurred";
              return (
                <div
                  key={item.killerFactorId}
                  role="row"
                  className={`grid gap-3 px-4 py-4 sm:px-5 lg:grid-cols-[9rem_minmax(16rem,1.15fr)_minmax(18rem,1.35fr)_15rem] lg:gap-4 ${occurred ? "bg-rose-50/40" : "bg-white"}`}
                >
                  <div role="cell" className="min-w-0">
                    <div className="mb-1 text-[10px] font-medium text-slate-400 lg:hidden">型</div>
                    <span className="inline-flex rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700">
                      {item.factorType}
                    </span>
                  </div>
                  <div role="cell" className="min-w-0">
                    <div className="mb-1 text-[10px] font-medium text-slate-400 lg:hidden">事象</div>
                    <p className="text-[13px] font-medium leading-5 text-slate-900">{item.eventDescription}</p>
                  </div>
                  <div role="cell" className="min-w-0">
                    <div className="mb-1 text-[10px] font-medium text-slate-400 lg:hidden">観測の手がかり</div>
                    <p className="text-xs leading-5 text-slate-600">{item.observationClues}</p>
                  </div>
                  <div role="cell" className="min-w-0">
                    <div className="mb-1 text-[10px] font-medium text-slate-400 lg:hidden">このPJでの状態</div>
                    {occurred ? (
                      <div className="rounded-xl border border-rose-200 bg-white p-3">
                        <div className="flex items-center gap-2 text-xs font-semibold text-rose-700">
                          <CheckCircle2 className="size-4 shrink-0" />発生
                        </div>
                        <dl className="mt-2 space-y-1 text-[11px] leading-5 text-slate-600">
                          <div><dt className="inline text-slate-400">発生日 </dt><dd className="inline tabular-nums">{formatDate(item.occurredOn)}</dd></div>
                          <div><dt className="inline text-slate-400">記録者 </dt><dd className="inline">{item.recordedByLabel || "—"}</dd></div>
                        </dl>
                        <p className="mt-2 whitespace-pre-wrap break-words border-t border-rose-100 pt-2 text-[11px] leading-5 text-slate-700">{item.evidenceNote}</p>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-2 min-h-11 w-full justify-start text-slate-600"
                          onClick={() => setOccurrenceFactor(item)}
                          data-html2canvas-ignore="true"
                        >
                          <Pencil />記録を修正
                        </Button>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <div className="flex min-h-8 items-center gap-2 text-xs font-medium text-slate-500">
                          <Circle className="size-4 shrink-0" />未発生
                        </div>
                        <Button
                          variant="outline"
                          className="h-11 w-full border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                          onClick={() => setOccurrenceFactor(item)}
                          data-html2canvas-ignore="true"
                        >
                          <FileWarning />発生を記録
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:!max-w-2xl">
          <form onSubmit={(event) => void saveFactor(event)}>
            <DialogHeader>
              <DialogTitle>共通カタログへ要素を追加</DialogTitle>
              <DialogDescription>ここで追加した要素は、すべてのPJの会社概要に同じ雛形として現れるよ。</DialogDescription>
            </DialogHeader>
            <div className="my-5 grid gap-4">
              <Field label="型" name="factor_type" hint="既存の型に収まらないときは、新しい型名で追加する">
                <Input id="factor_type" name="factor_type" required maxLength={80} className="h-11" placeholder="例: 規制適合" />
              </Field>
              <Field label="事象" name="event_description">
                <Input id="event_description" name="event_description" required maxLength={300} className="h-11" placeholder="事業化見込みを大きく削る事象" />
              </Field>
              <Field label="観測の手がかり" name="observation_clues" hint="記録・文書で確かめられる具体的な兆候を書く">
                <Textarea id="observation_clues" name="observation_clues" required maxLength={1200} rows={4} placeholder="契約、議事録、定款、報道などで確認できる兆候" />
              </Field>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" className="h-11" onClick={() => setAddOpen(false)}>閉じる</Button>
              <Button type="submit" className="h-11" disabled={saving}>{saving && <Loader2 className="animate-spin" />}全PJへ追加</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(occurrenceFactor)} onOpenChange={(open) => !open && setOccurrenceFactor(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:!max-w-2xl">
          {occurrenceFactor && (
            <form key={occurrenceFactor.killerFactorId} onSubmit={(event) => void saveOccurrence(event)}>
              <DialogHeader>
                <DialogTitle>{occurrenceFactor.status === "occurred" ? "発生記録を修正" : "このPJでの発生を記録"}</DialogTitle>
                <DialogDescription>{occurrenceFactor.factorType} — {occurrenceFactor.eventDescription}</DialogDescription>
              </DialogHeader>
              <div className="my-5 grid gap-4">
                <Field label="発生日" name="occurred_on">
                  <Input
                    id="occurred_on"
                    name="occurred_on"
                    type="date"
                    required
                    defaultValue={occurrenceFactor.occurredOn || new Date().toISOString().slice(0, 10)}
                    className="h-11"
                  />
                </Field>
                <Field
                  label="根拠メモ"
                  name="evidence_note"
                  hint="CEO本人の自己申告は発生判定の根拠に使わない"
                >
                  <Textarea
                    id="evidence_note"
                    name="evidence_note"
                    required
                    maxLength={2000}
                    rows={6}
                    defaultValue={occurrenceFactor.evidenceNote || ""}
                    placeholder="議事録・契約書・定款・報道など、何が記録・文書で観測されたか"
                  />
                </Field>
                <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[11px] leading-5 text-slate-600">
                  今回は記録と表示まで。保存しても自動通知・成功確率の再計算・LLM呼び出しは行わない。
                </p>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" className="h-11" onClick={() => setOccurrenceFactor(null)}>閉じる</Button>
                <Button type="submit" className="h-11 bg-rose-700 text-white hover:bg-rose-800" disabled={saving}>{saving && <Loader2 className="animate-spin" />}発生として保存</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
