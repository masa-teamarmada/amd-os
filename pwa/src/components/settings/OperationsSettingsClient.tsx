"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Database,
  Layers3,
  Loader2,
  Play,
  RotateCcw,
  Settings2,
} from "lucide-react";
import type { CronOperation, L2Dataset, RawDataSource } from "@/lib/operations-catalog";

type Props = {
  rawDataSources: RawDataSource[];
  l2Datasets: L2Dataset[];
  cronOperations: CronOperation[];
};

type RunResult = {
  ok: boolean;
  status: number;
  data: unknown;
  at: string;
};

export function OperationsSettingsClient({ rawDataSources, l2Datasets, cronOperations }: Props) {
  const [selectedId, setSelectedId] = useState(cronOperations[0]?.id ?? "");
  const [paramsById, setParamsById] = useState<Record<string, string>>(() =>
    Object.fromEntries(cronOperations.map((op) => [op.id, op.defaultParams]))
  );
  const [runningId, setRunningId] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, RunResult>>({});
  const [error, setError] = useState("");

  const selected = useMemo(
    () => cronOperations.find((op) => op.id === selectedId) ?? cronOperations[0] ?? null,
    [cronOperations, selectedId]
  );
  const paramsText = selected ? paramsById[selected.id] ?? selected.defaultParams : "";
  const selectedResult = selected ? results[selected.id] : null;
  const selectedManualReason = selected?.run.type === "manual" ? selected.run.reason : "";

  const updateParams = (value: string) => {
    if (!selected) return;
    setParamsById((prev) => ({ ...prev, [selected.id]: value }));
  };

  const resetParams = () => {
    if (!selected) return;
    updateParams(selected.defaultParams);
    setError("");
  };

  const formatParams = () => {
    try {
      updateParams(JSON.stringify(JSON.parse(paramsText), null, 2));
      setError("");
    } catch {
      setError("JSONが壊れてる");
    }
  };

  const runSelected = async () => {
    if (!selected || runningId || selected.run.type === "manual") return;
    setError("");
    try {
      JSON.parse(paramsText || "{}");
    } catch {
      setError("JSONが壊れてる");
      return;
    }

    setRunningId(selected.id);
    try {
      const response = await fetch("/api/settings/cron-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operationId: selected.id, paramsText }),
      });
      const data = await response.json().catch(() => ({ error: response.statusText }));
      setResults((prev) => ({
        ...prev,
        [selected.id]: {
          ok: response.ok && Boolean((data as { ok?: unknown }).ok),
          status: response.status,
          data,
          at: new Date().toLocaleString("ja-JP", { hour12: false }),
        },
      }));
    } catch (err) {
      setResults((prev) => ({
        ...prev,
        [selected.id]: {
          ok: false,
          status: 0,
          data: { error: err instanceof Error ? err.message : "unknown error" },
          at: new Date().toLocaleString("ja-JP", { hour12: false }),
        },
      }));
    } finally {
      setRunningId(null);
    }
  };

  return (
    <div className="flex w-full flex-col gap-5">
      <header className="flex flex-col gap-4 border-b border-border pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            <Settings2 className="h-3.5 w-3.5" />
            OS Runtime
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Operations Settings</h1>
        </div>
        <div className="grid grid-cols-3 gap-2 text-[12px]">
          <Stat icon={<Database className="h-4 w-4" />} label="Raw" value={rawDataSources.length} tone="text-cyan-700" />
          <Stat icon={<Layers3 className="h-4 w-4" />} label="L2" value={l2Datasets.length} tone="text-emerald-700" />
          <Stat icon={<Clock3 className="h-4 w-4" />} label="Cron" value={cronOperations.length} tone="text-amber-700" />
        </div>
      </header>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
        <div className="space-y-5">
          <PanelTitle icon={<Database className="h-4 w-4" />} title="Raw Data" meta={`${rawDataSources.length} sources`} />
          <div className="grid gap-3 md:grid-cols-2">
            {rawDataSources.map((source) => (
              <article key={source.id} className="border border-border bg-background p-4">
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-[14px] font-semibold">{source.label}</h2>
                    <div className="mt-1 text-[11px] text-muted-foreground">{source.owner} / {source.refresh}</div>
                  </div>
                  <Badge>{source.id}</Badge>
                </div>
                <p className="min-h-[42px] text-[12px] leading-relaxed text-muted-foreground">{source.notes}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {source.landsIn.map((table) => <MiniTag key={table}>{table}</MiniTag>)}
                </div>
              </article>
            ))}
          </div>

          <PanelTitle icon={<Layers3 className="h-4 w-4" />} title="L2 Data" meta={`${l2Datasets.length} datasets`} />
          <div className="overflow-hidden border border-border bg-background">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-[12px]">
                <thead className="border-b border-border bg-muted/35 text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Dataset</th>
                    <th className="px-3 py-2 font-medium">Table</th>
                    <th className="px-3 py-2 font-medium">Source</th>
                    <th className="px-3 py-2 font-medium">Cadence</th>
                    <th className="px-3 py-2 font-medium">Purpose</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {l2Datasets.map((dataset) => (
                    <tr key={dataset.id} className="align-top hover:bg-muted/20">
                      <td className="px-3 py-3 font-semibold">{dataset.label}</td>
                      <td className="px-3 py-3 font-mono text-[11px] text-muted-foreground">{dataset.table}</td>
                      <td className="px-3 py-3 text-muted-foreground">{dataset.source}</td>
                      <td className="px-3 py-3 whitespace-nowrap">{dataset.cadence}</td>
                      <td className="px-3 py-3 text-muted-foreground">{dataset.purpose}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
          <PanelTitle icon={<Clock3 className="h-4 w-4" />} title="Cron Control" meta="admin only" />
          <div className="grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-1">
            <div className="border border-border bg-background">
              {cronOperations.map((op) => {
                const isSelected = op.id === selected?.id;
                const result = results[op.id];
                return (
                  <button
                    key={op.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(op.id);
                      setError("");
                    }}
                    className={`flex w-full items-center justify-between gap-2 border-b border-border px-3 py-3 text-left text-[12px] transition last:border-b-0 ${isSelected ? "bg-foreground text-background" : "hover:bg-muted/35"}`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{op.label}</span>
                      <span className={`mt-0.5 block truncate text-[11px] ${isSelected ? "text-background/70" : "text-muted-foreground"}`}>
                        {op.layer} / {op.cadence}
                      </span>
                    </span>
                    {result ? (
                      result.ok ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" /> : <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
                    ) : null}
                  </button>
                );
              })}
            </div>

            {selected && (
              <div className="border border-border bg-background p-4">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-[15px] font-semibold">{selected.label}</h2>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                      <Badge>{selected.layer}</Badge>
                      <span>{selected.trigger}</span>
                    </div>
                  </div>
                </div>

                <div className="grid gap-2 text-[12px] text-muted-foreground sm:grid-cols-2">
                  <InfoLine label="Input" value={selected.input} />
                  <InfoLine label="Output" value={selected.output} />
                </div>

                <label className="mt-4 block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Run Params
                </label>
                <textarea
                  value={paramsText}
                  onChange={(event) => updateParams(event.target.value)}
                  spellCheck={false}
                  className="mt-1 h-36 w-full resize-y border border-border bg-muted/20 p-3 font-mono text-[12px] leading-relaxed outline-none focus:border-foreground"
                />
                {error ? <div className="mt-2 text-[12px] font-medium text-red-600">{error}</div> : null}
                {selectedManualReason ? (
                  <div className="mt-2 border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] font-medium text-amber-800">
                    {selectedManualReason}
                  </div>
                ) : null}

                <div className="mt-3 flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={resetParams}
                    className="inline-flex items-center gap-1.5 border border-border px-3 py-2 text-[12px] font-medium hover:bg-muted/35"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Default
                  </button>
                  <button
                    type="button"
                    onClick={formatParams}
                    className="inline-flex items-center gap-1.5 border border-border px-3 py-2 text-[12px] font-medium hover:bg-muted/35"
                  >
                    <Settings2 className="h-3.5 w-3.5" />
                    Format
                  </button>
                  <button
                    type="button"
                    onClick={runSelected}
                    disabled={Boolean(runningId) || selected.run.type === "manual"}
                    className="inline-flex items-center gap-1.5 bg-foreground px-4 py-2 text-[12px] font-semibold text-background disabled:opacity-50"
                  >
                    {runningId === selected.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                    {selected.run.type === "manual" ? "Stopped" : "Run Now"}
                  </button>
                </div>

                {selectedResult ? (
                  <div className="mt-4 border border-border bg-muted/20 p-3">
                    <div className="mb-2 flex items-center justify-between gap-2 text-[11px]">
                      <span className={selectedResult.ok ? "font-semibold text-emerald-700" : "font-semibold text-red-600"}>
                        {selectedResult.ok ? "OK" : "FAILED"} / HTTP {selectedResult.status}
                      </span>
                      <span className="text-muted-foreground">{selectedResult.at}</span>
                    </div>
                    <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-muted-foreground">
                      {JSON.stringify(selectedResult.data, null, 2)}
                    </pre>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </aside>
      </section>
    </div>
  );
}

function Stat({ icon, label, value, tone }: { icon: ReactNode; label: string; value: number; tone: string }) {
  return (
    <div className="flex min-w-[92px] items-center gap-2 border border-border bg-background px-3 py-2">
      <div className={tone}>{icon}</div>
      <div>
        <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{label}</div>
        <div className="text-lg font-semibold leading-none">{value}</div>
      </div>
    </div>
  );
}

function PanelTitle({ icon, title, meta }: { icon: ReactNode; title: string; meta: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <div className="text-muted-foreground">{icon}</div>
        <h2 className="text-[15px] font-semibold">{title}</h2>
      </div>
      <span className="text-[11px] text-muted-foreground">{meta}</span>
    </div>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex shrink-0 items-center border border-border bg-muted/35 px-1.5 py-0.5 font-mono text-[10px] leading-none text-muted-foreground">
      {children}
    </span>
  );
}

function MiniTag({ children }: { children: ReactNode }) {
  return (
    <span className="max-w-full truncate border border-border bg-muted/25 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
      {children}
    </span>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border bg-muted/20 p-2">
      <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{label}</div>
      <div className="mt-1 text-[12px] text-foreground">{value}</div>
    </div>
  );
}
