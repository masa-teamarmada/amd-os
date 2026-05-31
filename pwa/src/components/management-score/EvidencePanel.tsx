"use client";

import { useMemo, useState } from "react";

export type EvidenceAxis = "initiative" | "finance" | "retention" | "pipeline" | "direction";

export type EvidenceRow = {
  id: string;
  axis: EvidenceAxis | string;
  evidence_kind: string;
  summary: string;
  source_type: string | null;
  source_ref: string | null;
  impact: number;
  confidence: number;
  payload: Record<string, unknown> | null;
};

export type DialogueConfirmedSignal = {
  signal_id: string;
  project_id: string;
  ym: string | null;
  signal_type: string;
  decision_state: string;
  impact_level: string;
  title: string;
  summary: string | null;
  signal_date: string | null;
  confirmed_at: string | null;
  polarity: string | null;
  score_impact_summary: string | null;
  source_refs_json: unknown;
};

const AXIS_LABEL: Record<EvidenceAxis, string> = {
  initiative: "先手",
  finance: "財務",
  retention: "継続",
  pipeline: "新規",
  direction: "方向",
};

const AXIS_TONE: Record<EvidenceAxis, string> = {
  initiative: "bg-sky-50 text-sky-700 border-sky-200",
  finance: "bg-emerald-50 text-emerald-700 border-emerald-200",
  retention: "bg-amber-50 text-amber-700 border-amber-200",
  pipeline: "bg-violet-50 text-violet-700 border-violet-200",
  direction: "bg-rose-50 text-rose-700 border-rose-200",
};

const AXIS_ORDER: EvidenceAxis[] = ["initiative", "finance", "retention", "pipeline", "direction"];

function axisLabel(axis: string): string {
  return AXIS_LABEL[axis as EvidenceAxis] ?? axis;
}

function axisTone(axis: string): string {
  return AXIS_TONE[axis as EvidenceAxis] ?? "bg-muted text-foreground border-border";
}

function fmtImpact(value: number): string {
  if (!Number.isFinite(value)) return "-";
  if (value === 0) return "0";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}`;
}

function fmtConfidence(value: number): string {
  if (!Number.isFinite(value)) return "-";
  return `${Math.round(value * 100)}%`;
}

function EvidenceCard({ row }: { row: EvidenceRow }) {
  const [open, setOpen] = useState(false);
  const positive = row.impact >= 0;
  const hasPayload = row.payload && Object.keys(row.payload).length > 0;
  return (
    <div className="rounded-md border bg-card px-3 py-2.5">
      <div className="flex items-center gap-2 text-xs">
        <span className={`inline-flex h-5 items-center rounded-full border px-2 text-[11px] font-medium ${axisTone(row.axis)}`}>
          {axisLabel(row.axis)}
        </span>
        <span className="text-muted-foreground">{row.evidence_kind}</span>
        <span className="ml-auto inline-flex items-center gap-2 tabular-nums">
          <span className={positive ? "text-emerald-600 font-semibold" : "text-red-600 font-semibold"}>
            {fmtImpact(row.impact)}
          </span>
          <span className="text-muted-foreground">conf {fmtConfidence(row.confidence)}</span>
        </span>
      </div>
      <p className="mt-1.5 text-sm leading-snug text-foreground">{row.summary || "(空)"}</p>
      {(row.source_type || row.source_ref) && (
        <p className="mt-1 truncate text-[11px] text-muted-foreground" title={row.source_ref ?? undefined}>
          {row.source_type ?? "?"} {row.source_ref ? `· ${row.source_ref}` : ""}
        </p>
      )}
      {hasPayload && (
        <div className="mt-1">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="text-[11px] text-muted-foreground hover:text-foreground"
          >
            {open ? "閉じる" : "詳細"}
          </button>
          {open && (
            <pre className="mt-1 max-h-48 overflow-auto rounded bg-muted/40 p-2 text-[11px] leading-snug text-muted-foreground">
              {JSON.stringify(row.payload, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

function signalTypeToAxis(signalType: string): EvidenceAxis | "other" {
  if (signalType === "commercial_progress") return "pipeline";
  if (
    signalType === "funding" ||
    signalType === "partner_growth" ||
    signalType === "graduation" ||
    signalType === "next_move"
  )
    return "direction";
  return "other";
}

function signalTypeLabel(signalType: string): string {
  const labels: Record<string, string> = {
    commercial_progress: "案件",
    funding: "ファンド",
    partner_growth: "連携",
    graduation: "卒業",
    next_move: "次の一手",
  };
  return labels[signalType] ?? signalType;
}

function decisionStateLabel(state: string): string {
  const labels: Record<string, string> = {
    decided: "決定",
    executing: "実行中",
    revised: "完了",
    proposed: "提案",
    observed: "観察",
  };
  return labels[state] ?? state;
}

function impactLevelLabel(level: string): string {
  const labels: Record<string, string> = {
    critical: "最重要",
    high: "重要",
    medium: "通常",
    low: "低",
  };
  return labels[level] ?? level;
}

function signalSources(signal: DialogueConfirmedSignal): Array<Record<string, unknown>> {
  return Array.isArray(signal.source_refs_json)
    ? signal.source_refs_json.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    : [];
}

function sourceLabel(source: Record<string, unknown>, index: number): string {
  const sourceKind = typeof source.source === "string" ? source.source : typeof source.kind === "string" ? source.kind : `source ${index + 1}`;
  const date = typeof source.date === "string" ? source.date : null;
  const title = typeof source.title === "string" ? source.title : null;
  const snippet = typeof source.snippet === "string" ? source.snippet : null;
  return [sourceKind, date, title, snippet].filter(Boolean).join(" / ");
}

function SignalDetailCard({ signal }: { signal: DialogueConfirmedSignal }) {
  const axis = signalTypeToAxis(signal.signal_type);
  const tone = axis === "other" ? "bg-muted text-foreground border-border" : axisTone(axis);
  const axisName = axis === "other" ? "評価軸なし" : `${axisLabel(axis)}軸`;
  const confirmedAt = signal.confirmed_at ? new Date(signal.confirmed_at).toLocaleDateString("ja-JP") : "-";
  const sources = signalSources(signal);
  return (
    <article className="rounded-md border bg-card px-3 py-3">
      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
        <span className={`inline-flex min-h-5 items-center rounded-full border px-2 font-medium ${tone}`}>{axisName}</span>
        <span className="inline-flex min-h-5 items-center rounded-full border bg-background px-2 text-muted-foreground">{signal.project_id}</span>
        <span className="inline-flex min-h-5 items-center rounded-full border bg-background px-2 text-muted-foreground">{signalTypeLabel(signal.signal_type)}</span>
        <span className="inline-flex min-h-5 items-center rounded-full border bg-background px-2 text-muted-foreground">{decisionStateLabel(signal.decision_state)}</span>
        <span className="inline-flex min-h-5 items-center rounded-full border bg-background px-2 text-muted-foreground">{impactLevelLabel(signal.impact_level)}</span>
      </div>

      <h4 className="mt-2 text-sm font-semibold leading-snug break-words">{signal.title || "(無題)"}</h4>
      {signal.summary && <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground break-words">{signal.summary}</p>}

      <div className="mt-2 grid gap-1.5 text-[11px] text-muted-foreground sm:grid-cols-2">
        <div>確定: {confirmedAt}</div>
        <div>発生日: {signal.signal_date ?? signal.ym ?? "-"}</div>
      </div>

      {signal.score_impact_summary && (
        <p className="mt-2 rounded bg-primary/5 px-2 py-1.5 text-xs leading-relaxed text-primary break-words">
          {signal.score_impact_summary}
        </p>
      )}

      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
        {axis === "pipeline"
          ? "このsignalは新規軸で、商談・紹介・提案の前進としてpipeline_valueに効く。"
          : axis === "direction"
            ? "このsignalは方向軸で、ファンド・連携・卒業・次の一手などAMDの勝ち筋に近づく材料として効く。"
            : "このsignalは現行の新規/方向軸には直接入らず、経営ハイライトとして読む。"}
      </p>

      {sources.length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer text-[11px] font-medium text-muted-foreground hover:text-foreground">
            根拠 {sources.length}件
          </summary>
          <div className="mt-1.5 space-y-1.5">
            {sources.slice(0, 4).map((source, index) => (
              <div key={index} className="rounded bg-muted/30 px-2 py-1.5 text-[11px] leading-relaxed text-muted-foreground break-words">
                {sourceLabel(source, index)}
              </div>
            ))}
          </div>
        </details>
      )}
    </article>
  );
}

function DialogueConfirmedChips({ signals }: { signals: DialogueConfirmedSignal[] }) {
  const grouped = signals.reduce<Record<"pipeline" | "direction" | "other", DialogueConfirmedSignal[]>>(
    (acc, signal) => {
      const axis = signalTypeToAxis(signal.signal_type);
      if (axis === "pipeline") acc.pipeline.push(signal);
      else if (axis === "direction") acc.direction.push(signal);
      else acc.other.push(signal);
      return acc;
    },
    { pipeline: [], direction: [], other: [] }
  );

  if (signals.length === 0) {
    return (
      <div className="border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">まさえいMTG で確定したシグナル</h3>
          <span className="text-xs text-muted-foreground">該当なし</span>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          まさえいMTGで「チームへ出す提案として固まった材料」がここに並ぶ。 commercial_progress は新規軸、 funding / next_move / graduation などは方向軸に流れる。
        </p>
      </div>
    );
  }
  return (
    <div className="border-b bg-primary/[0.03] px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">まさえいMTG で確定したシグナル</h3>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">
            まさとえいみが議論して「次の経営判断に使える」と固めたsignal。1件を開くと、何が決まったか、どの評価軸に効くか、どのPJか、いつ確定したか、根拠を読める。
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
          <span className="rounded-full border bg-background px-2 py-1">全{signals.length}件</span>
          <span className="rounded-full border bg-background px-2 py-1">新規{grouped.pipeline.length}件</span>
          <span className="rounded-full border bg-background px-2 py-1">方向{grouped.direction.length}件</span>
        </div>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        {signals.slice(0, 12).map((signal) => (
          <SignalDetailCard key={signal.signal_id} signal={signal} />
        ))}
      </div>
      {signals.length > 12 && <p className="mt-2 text-[11px] text-muted-foreground">最新12件を表示中。古いsignalはDB上に残る。</p>}
    </div>
  );
}

export function EvidencePanel({
  rows,
  dialogueConfirmedSignals = [],
}: {
  rows: EvidenceRow[];
  dialogueConfirmedSignals?: DialogueConfirmedSignal[];
}) {
  const [axis, setAxis] = useState<EvidenceAxis | "all">("all");

  const filtered = useMemo(() => {
    return axis === "all" ? rows : rows.filter((row) => row.axis === axis);
  }, [rows, axis]);

  const positives = useMemo(
    () => filtered.filter((row) => row.impact > 0).sort((a, b) => b.impact - a.impact).slice(0, 8),
    [filtered]
  );
  const negatives = useMemo(
    () => filtered.filter((row) => row.impact < 0).sort((a, b) => a.impact - b.impact).slice(0, 8),
    [filtered]
  );
  const neutrals = useMemo(
    () => filtered.filter((row) => row.impact === 0).slice(0, 6),
    [filtered]
  );

  const counts = useMemo(() => {
    const counter: Record<string, number> = { all: rows.length };
    for (const ax of AXIS_ORDER) counter[ax] = rows.filter((row) => row.axis === ax).length;
    return counter;
  }, [rows]);

  return (
    <section className="rounded-md border bg-card">
      <DialogueConfirmedChips signals={dialogueConfirmedSignals} />

      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
        <h2 className="text-sm font-semibold">上げ要因 / 下げ要因</h2>
        <span className="text-xs text-muted-foreground">evidence {rows.length} 件</span>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <FilterChip label={`全て ${counts.all}`} active={axis === "all"} onClick={() => setAxis("all")} />
          {AXIS_ORDER.map((ax) => (
            <FilterChip
              key={ax}
              label={`${AXIS_LABEL[ax]} ${counts[ax] ?? 0}`}
              active={axis === ax}
              tone={AXIS_TONE[ax]}
              onClick={() => setAxis(ax)}
            />
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
          evidence データ待ち。 <code>amd_management_score_evidence</code> が空。
        </div>
      ) : (
        <div className="grid gap-4 px-4 py-4 md:grid-cols-2">
          <Column title="上げ要因" tone="text-emerald-600" rows={positives} emptyHint="該当 evidence なし" />
          <Column title="下げ要因" tone="text-red-600" rows={negatives} emptyHint="該当 evidence なし" />
          {neutrals.length > 0 && (
            <div className="md:col-span-2">
              <div className="mb-1.5 text-xs font-semibold text-muted-foreground">中立 (impact=0)</div>
              <div className="grid gap-2 md:grid-cols-2">
                {neutrals.map((row) => <EvidenceCard key={row.id} row={row} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function Column({ title, tone, rows, emptyHint }: { title: string; tone: string; rows: EvidenceRow[]; emptyHint: string }) {
  return (
    <div>
      <div className={`mb-1.5 text-xs font-semibold ${tone}`}>{title} ({rows.length})</div>
      <div className="grid gap-2">
        {rows.length === 0 ? (
          <div className="rounded-md border border-dashed bg-muted/20 px-3 py-4 text-center text-xs text-muted-foreground">
            {emptyHint}
          </div>
        ) : (
          rows.map((row) => <EvidenceCard key={row.id} row={row} />)
        )}
      </div>
    </div>
  );
}

function FilterChip({
  label,
  active,
  tone,
  onClick,
}: {
  label: string;
  active: boolean;
  tone?: string;
  onClick: () => void;
}) {
  const base = "inline-flex h-6 items-center rounded-full border px-2.5 text-[11px] font-medium transition";
  if (active) {
    return (
      <button type="button" onClick={onClick} className={`${base} ${tone ?? "bg-primary/10 text-primary border-primary/30"}`}>
        {label}
      </button>
    );
  }
  return (
    <button type="button" onClick={onClick} className={`${base} bg-card text-muted-foreground border-border hover:text-foreground`}>
      {label}
    </button>
  );
}
