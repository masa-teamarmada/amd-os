"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MarkdownView } from "@/components/cockpit/MarkdownView";
import {
  BLOCK_KIND_HINT,
  BLOCK_KIND_LABEL,
  CONFIDENCE_LABEL,
  CONFIDENTIALITY_LABEL,
  RATING_FULL_LABEL,
  RATING_LABEL,
  SOURCE_KIND_LABEL,
  formatTechValue,
  matrixColumns,
  matrixRows,
  type TechBlockKind,
  type TechConfidence,
  type TechConfidentiality,
  type TechEntry,
  type TechKnowledgeFragment,
  type TechRating,
  type TechSourceKind,
  type TechTopic,
} from "@/lib/project-tech";
import {
  createTechRow,
  deleteTechRow,
  loadProjectTech,
  peekProjectTech,
  updateTechRow,
  type ProjectTechResponse,
} from "@/lib/project-tech-client";

// PJコックピット「技術」タブ。全PJ共通の雛形 (2026-08-29 まさ依頼)。
//
// 何を置く場所か:
//   SX なら「シアノがどの温度帯・pH で使えるか、どの元素を取り込めるか」、
//   CX なら「磁気冷凍と気体冷凍の違い、今どこまで冷やせるか、kiutra との星取り表」。
//
// PJごとにフォーマットは違うが、形は4種類しかない (成立条件 / 解説 / 星取り表 / 到達実績)。
// PJ専用のコンポーネントは作らない。PJごとに違うのは並べるトピックと項目名だけで、
// それはデータ (project_tech_topics.block_kind と tech_domain) が持つ。
//
// 正本は project_tech_* (migration 339)。仕様は pwa/spec/3-20-project-technology-current-spec.md。

const BLOCK_ORDER: TechBlockKind[] = ["condition", "matrix", "record", "article"];

const CONFIDENTIALITY_STYLE: Record<TechConfidentiality, string> = {
  public: "bg-[#e8f5e9] text-[#1b5e20] border-[#a5d6a7]",
  internal: "bg-[#f2f2f4] text-[#6e6e73] border-[#d2d2d7]",
  confidential: "bg-[#ffebee] text-[#b71c1c] border-[#ffcdd2]",
};

const CONFIDENCE_STYLE: Record<TechConfidence, string> = {
  high: "text-[#1b5e20]",
  medium: "text-[#6e6e73]",
  low: "text-[#8d6e00]",
  unverified: "text-[#b71c1c]",
};

const RATING_STYLE: Record<TechRating, string> = {
  excellent: "text-[#1b5e20]",
  good: "text-[#2e7d32]",
  fair: "text-[#8d6e00]",
  poor: "text-[#b71c1c]",
  na: "text-[#c7c7cc]",
  unknown: "text-[#86868b]",
};

const FRAGMENT_CATEGORY_LABEL: Record<string, string> = {
  tech: "技術",
  term: "用語",
  competitor: "競合",
};

const BLOCK_KINDS: TechBlockKind[] = ["condition", "article", "matrix", "record"];
const CONFIDENTIALITIES: TechConfidentiality[] = ["public", "internal", "confidential"];
const SOURCE_KINDS: TechSourceKind[] = [
  "manual",
  "meeting",
  "literature",
  "vendor_spec",
  "measurement",
  "estimate",
  "l2_extraction",
];
const CONFIDENCES: TechConfidence[] = ["high", "medium", "low", "unverified"];
const RATINGS: TechRating[] = ["excellent", "good", "fair", "poor", "na", "unknown"];

/** 空文字を null に落として、0 と未入力を区別する。 */
function numOrNull(v: string): number | null {
  const t = v.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
function textOrNull(v: string): string | null {
  const t = v.trim();
  return t ? t : null;
}

function Badge({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex shrink-0 items-center whitespace-nowrap rounded border px-1.5 py-[1px] text-[10px] font-semibold ${className}`}>
      {children}
    </span>
  );
}

/** 出典を1行で。根拠のない数値を作らないための表示 (出典が無ければ「出典なし」と赤で出す)。 */
function SourceCell({
  sourceKind,
  sourceRef,
  sourceUrl,
}: {
  sourceKind: TechSourceKind;
  sourceRef: string | null;
  sourceUrl: string | null;
}) {
  const label = SOURCE_KIND_LABEL[sourceKind] ?? sourceKind;
  const body = sourceRef ? `${label}: ${sourceRef}` : label;
  if (sourceUrl) {
    return (
      <a href={sourceUrl} target="_blank" rel="noreferrer" className="text-[#007aff] underline hover:opacity-80">
        {body}
      </a>
    );
  }
  return <span>{body}</span>;
}

/* ------------------------------------------------------------------ *
 * ブロック本体
 * ------------------------------------------------------------------ */

/** 成立条件 — 項目 × 値 × 条件 × 確度 × 出典。「どの範囲なら使えるか」を1枚で読む。 */
function ConditionBlock({ entries }: { entries: TechEntry[] }) {
  if (entries.length === 0) return <EmptyRows hint="項目・下限・上限・単位・条件を1行ずつ足す" />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-[12px]">
        <thead>
          <tr className="bg-[#f5f5f7] text-left text-[11px] text-[#6e6e73]">
            <th className="border-b border-[#e5e5e7] px-2 py-1.5 font-medium">項目</th>
            <th className="border-b border-[#e5e5e7] px-2 py-1.5 font-medium">値</th>
            <th className="border-b border-[#e5e5e7] px-2 py-1.5 font-medium">条件</th>
            <th className="border-b border-[#e5e5e7] px-2 py-1.5 font-medium">時点</th>
            <th className="border-b border-[#e5e5e7] px-2 py-1.5 font-medium">確度</th>
            <th className="border-b border-[#e5e5e7] px-2 py-1.5 font-medium">出典</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.tech_entry_id} className="align-top hover:bg-[#fafafa]">
              <td className="border-b border-[#f0f0f2] px-2 py-1.5 font-medium text-[#1d1d1f]">{e.row_label}</td>
              <td className="border-b border-[#f0f0f2] px-2 py-1.5 tabular-nums text-[#1d1d1f]">
                {formatTechValue(e)}
                {e.note && <div className="mt-0.5 text-[11px] leading-4 text-[#86868b]">{e.note}</div>}
              </td>
              <td className="border-b border-[#f0f0f2] px-2 py-1.5 text-[#6e6e73]">{e.condition_text || "—"}</td>
              <td className="border-b border-[#f0f0f2] px-2 py-1.5 whitespace-nowrap text-[#6e6e73]">{e.observed_on || "—"}</td>
              <td className={`border-b border-[#f0f0f2] px-2 py-1.5 whitespace-nowrap ${CONFIDENCE_STYLE[e.confidence]}`}>
                {CONFIDENCE_LABEL[e.confidence]}
              </td>
              <td className="border-b border-[#f0f0f2] px-2 py-1.5 text-[#6e6e73]">
                <SourceCell sourceKind={e.source_kind} sourceRef={e.source_ref} sourceUrl={e.source_url} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** 星取り表 — 比較軸 × 相手。セルは記号 + 実数値で、根拠はホバーで出す。 */
function MatrixBlock({ entries }: { entries: TechEntry[] }) {
  const cols = matrixColumns(entries);
  const rows = matrixRows(entries);
  if (cols.length === 0 || rows.length === 0) {
    return <EmptyRows hint="比較軸 (行) と相手 (列) を決めて、1マスずつ足す" />;
  }
  const cell = (row: string, col: string) => entries.find((e) => e.row_label === row && e.col_label === col);
  return (
    <div className="max-h-[70vh] overflow-auto">
      <table className="w-full min-w-[560px] border-collapse text-[12px]">
        <thead>
          <tr className="bg-[#f5f5f7] text-left text-[11px] text-[#6e6e73]">
            <th className="sticky left-0 top-0 z-30 border-b border-r border-[#e5e5e7] bg-[#f5f5f7] px-2 py-1.5 font-medium">
              比較軸
            </th>
            {cols.map((c) => (
              <th key={c} className="sticky top-0 z-20 border-b border-[#e5e5e7] bg-[#f5f5f7] px-2 py-1.5 text-center font-medium">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r} className="group hover:bg-[#fafafa]">
              <th className="sticky left-0 z-10 border-b border-r border-[#f0f0f2] bg-white px-2 py-1.5 text-left align-top font-medium text-[#1d1d1f] group-hover:bg-[#fafafa]">
                {r}
              </th>
              {cols.map((c) => {
                const e = cell(r, c);
                if (!e) {
                  return (
                    <td key={c} className="border-b border-[#f0f0f2] px-2 py-1.5 text-center text-[#c7c7cc]">
                      —
                    </td>
                  );
                }
                const rating = e.rating ?? "unknown";
                const tip = [
                  RATING_FULL_LABEL[rating],
                  e.note || "",
                  e.source_ref ? `出典: ${SOURCE_KIND_LABEL[e.source_kind]} ${e.source_ref}` : SOURCE_KIND_LABEL[e.source_kind],
                ]
                  .filter(Boolean)
                  .join(" / ");
                return (
                  <td key={c} className="border-b border-[#f0f0f2] px-2 py-1.5 text-center align-top" title={tip}>
                    <div className={`text-[15px] font-semibold leading-5 ${RATING_STYLE[rating]}`}>{RATING_LABEL[rating]}</div>
                    {(e.value_text || e.value_min !== null || e.value_max !== null) && (
                      <div className="mt-0.5 text-[11px] leading-4 tabular-nums text-[#1d1d1f]">{formatTechValue(e)}</div>
                    )}
                    {e.note && <div className="mt-0.5 text-[10px] leading-4 text-[#86868b]">{e.note}</div>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-[11px] text-[#86868b]">
        {RATINGS.filter((r) => r !== "unknown" && r !== "na")
          .map((r) => RATING_FULL_LABEL[r])
          .join(" ／ ")}
        。マスにマウスを乗せると根拠が出る。
      </p>
    </div>
  );
}

/** 到達実績 — 何を、いつ、どこまで。同じ項目が複数あれば古い順に並べて推移として読む。 */
function RecordBlock({ entries }: { entries: TechEntry[] }) {
  if (entries.length === 0) return <EmptyRows hint="測る対象・到達値・測定日・出典を1行ずつ足す" />;
  const grouped = new Map<string, TechEntry[]>();
  for (const e of entries) {
    const list = grouped.get(e.row_label) ?? [];
    list.push(e);
    grouped.set(e.row_label, list);
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[600px] border-collapse text-[12px]">
        <thead>
          <tr className="bg-[#f5f5f7] text-left text-[11px] text-[#6e6e73]">
            <th className="border-b border-[#e5e5e7] px-2 py-1.5 font-medium">測る対象</th>
            <th className="border-b border-[#e5e5e7] px-2 py-1.5 font-medium">到達値</th>
            <th className="border-b border-[#e5e5e7] px-2 py-1.5 font-medium">測定日</th>
            <th className="border-b border-[#e5e5e7] px-2 py-1.5 font-medium">条件・備考</th>
            <th className="border-b border-[#e5e5e7] px-2 py-1.5 font-medium">出典</th>
          </tr>
        </thead>
        <tbody>
          {[...grouped.entries()].map(([label, list]) => {
            const sorted = [...list].sort((a, b) => (a.observed_on || "").localeCompare(b.observed_on || ""));
            return sorted.map((e, i) => (
              <tr key={e.tech_entry_id} className="align-top hover:bg-[#fafafa]">
                <td className="border-b border-[#f0f0f2] px-2 py-1.5 font-medium text-[#1d1d1f]">
                  {i === 0 ? label : <span className="text-[#c7c7cc]">〃</span>}
                </td>
                <td className="border-b border-[#f0f0f2] px-2 py-1.5 tabular-nums text-[#1d1d1f]">{formatTechValue(e)}</td>
                <td className="border-b border-[#f0f0f2] px-2 py-1.5 whitespace-nowrap text-[#6e6e73]">{e.observed_on || "—"}</td>
                <td className="border-b border-[#f0f0f2] px-2 py-1.5 text-[#6e6e73]">
                  {[e.condition_text, e.note].filter(Boolean).join(" / ") || "—"}
                </td>
                <td className="border-b border-[#f0f0f2] px-2 py-1.5 text-[#6e6e73]">
                  <SourceCell sourceKind={e.source_kind} sourceRef={e.source_ref} sourceUrl={e.source_url} />
                </td>
              </tr>
            ));
          })}
        </tbody>
      </table>
    </div>
  );
}

function EmptyRows({ hint }: { hint: string }) {
  return <p className="rounded-lg border border-dashed border-[#d2d2d7] px-3 py-2 text-[11px] text-[#86868b]">{hint}</p>;
}

/* ------------------------------------------------------------------ *
 * 編集フォーム
 * ------------------------------------------------------------------ */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] text-[#6e6e73]">{label}</span>
      {children}
    </label>
  );
}

const INPUT = "rounded border border-[#d2d2d7] px-2 py-1 text-[12px] text-[#1d1d1f] outline-none focus:border-[#007aff]";

function TopicForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: TechTopic;
  onSubmit: (row: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
}) {
  const [kind, setKind] = useState<TechBlockKind>(initial?.block_kind ?? "condition");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [summary, setSummary] = useState(initial?.summary ?? "");
  const [domain, setDomain] = useState(initial?.tech_domain ?? "");
  const [body, setBody] = useState(initial?.body_md ?? "");
  const [conf, setConf] = useState<TechConfidentiality>(initial?.confidentiality ?? "internal");
  const [sourceKind, setSourceKind] = useState<TechSourceKind>(initial?.source_kind ?? "manual");
  const [sourceRef, setSourceRef] = useState(initial?.source_ref ?? "");
  const [sourceUrl, setSourceUrl] = useState(initial?.source_url ?? "");
  const [order, setOrder] = useState(String(initial?.sort_order ?? 100));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!title.trim()) {
      setError("タイトルは必須");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSubmit({
        block_kind: kind,
        title: title.trim(),
        summary: textOrNull(summary),
        tech_domain: textOrNull(domain),
        body_md: textOrNull(body),
        confidentiality: conf,
        source_kind: sourceKind,
        source_ref: textOrNull(sourceRef),
        source_url: textOrNull(sourceUrl),
        sort_order: numOrNull(order) ?? 100,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存に失敗");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-[#d2d2d7] bg-[#fafafa] p-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Field label="形式">
          <select className={INPUT} value={kind} onChange={(e) => setKind(e.target.value as TechBlockKind)}>
            {BLOCK_KINDS.map((k) => (
              <option key={k} value={k}>
                {BLOCK_KIND_LABEL[k]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="技術区分 (束ねる見出し)">
          <input className={INPUT} value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="培養 / 冷凍機 / 検出器" />
        </Field>
        <Field label="並び順 (小さいほど上)">
          <input className={INPUT} value={order} onChange={(e) => setOrder(e.target.value)} inputMode="numeric" />
        </Field>
      </div>
      <p className="text-[11px] text-[#86868b]">{BLOCK_KIND_HINT[kind]}</p>
      <Field label="タイトル">
        <input className={INPUT} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="シアノバクテリアの培養条件" />
      </Field>
      <Field label="1行説明 (開く前に何が書いてあるか判る文)">
        <input className={INPUT} value={summary} onChange={(e) => setSummary(e.target.value)} />
      </Field>
      <Field label={kind === "article" ? "本文 (Markdown)" : "補足の本文 (Markdown、任意)"}>
        <textarea className={`${INPUT} min-h-[120px] font-mono`} value={body} onChange={(e) => setBody(e.target.value)} />
      </Field>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
        <Field label="社外開示">
          <select className={INPUT} value={conf} onChange={(e) => setConf(e.target.value as TechConfidentiality)}>
            {CONFIDENTIALITIES.map((c) => (
              <option key={c} value={c}>
                {CONFIDENTIALITY_LABEL[c]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="出典の種類">
          <select className={INPUT} value={sourceKind} onChange={(e) => setSourceKind(e.target.value as TechSourceKind)}>
            {SOURCE_KINDS.map((s) => (
              <option key={s} value={s}>
                {SOURCE_KIND_LABEL[s]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="出典">
          <input className={INPUT} value={sourceRef} onChange={(e) => setSourceRef(e.target.value)} placeholder="2026-06-24 SX定例MTG" />
        </Field>
        <Field label="出典URL">
          <input className={INPUT} value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} />
        </Field>
      </div>
      {error && <p className="text-[11px] text-[#b71c1c]">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={submit}
          disabled={busy}
          className="rounded bg-[#027FDC] px-3 py-1 text-[12px] font-medium text-white disabled:opacity-50"
        >
          {busy ? "保存中…" : "保存"}
        </button>
        <button onClick={onCancel} className="rounded border border-[#d2d2d7] px-3 py-1 text-[12px] text-[#1d1d1f]">
          やめる
        </button>
      </div>
    </div>
  );
}

function EntryForm({
  kind,
  initial,
  onSubmit,
  onCancel,
}: {
  kind: TechBlockKind;
  initial?: TechEntry;
  onSubmit: (row: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
}) {
  const [rowLabel, setRowLabel] = useState(initial?.row_label ?? "");
  const [colLabel, setColLabel] = useState(initial?.col_label ?? "");
  const [vmin, setVmin] = useState(initial?.value_min !== null && initial?.value_min !== undefined ? String(initial.value_min) : "");
  const [vmax, setVmax] = useState(initial?.value_max !== null && initial?.value_max !== undefined ? String(initial.value_max) : "");
  const [vtext, setVtext] = useState(initial?.value_text ?? "");
  const [unit, setUnit] = useState(initial?.unit ?? "");
  const [rating, setRating] = useState<TechRating>(initial?.rating ?? "unknown");
  const [cond, setCond] = useState(initial?.condition_text ?? "");
  const [observed, setObserved] = useState(initial?.observed_on ?? "");
  const [confidence, setConfidence] = useState<TechConfidence>(initial?.confidence ?? "medium");
  const [sourceKind, setSourceKind] = useState<TechSourceKind>(initial?.source_kind ?? "manual");
  const [sourceRef, setSourceRef] = useState(initial?.source_ref ?? "");
  const [sourceUrl, setSourceUrl] = useState(initial?.source_url ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [order, setOrder] = useState(String(initial?.sort_order ?? 100));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rowLabelName = kind === "matrix" ? "比較軸" : kind === "record" ? "測る対象" : "項目";

  async function submit() {
    if (!rowLabel.trim()) {
      setError(`${rowLabelName}は必須`);
      return;
    }
    if (kind === "matrix" && !colLabel.trim()) {
      setError("比較相手 (列) は必須");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSubmit({
        row_label: rowLabel.trim(),
        col_label: kind === "matrix" ? colLabel.trim() : null,
        value_min: numOrNull(vmin),
        value_max: numOrNull(vmax),
        value_text: textOrNull(vtext),
        unit: textOrNull(unit),
        rating: kind === "matrix" ? rating : null,
        condition_text: textOrNull(cond),
        observed_on: textOrNull(observed),
        confidence,
        source_kind: sourceKind,
        source_ref: textOrNull(sourceRef),
        source_url: textOrNull(sourceUrl),
        note: textOrNull(note),
        sort_order: numOrNull(order) ?? 100,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存に失敗");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2 rounded-lg border border-[#d2d2d7] bg-[#fafafa] p-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
        <Field label={rowLabelName}>
          <input className={INPUT} value={rowLabel} onChange={(e) => setRowLabel(e.target.value)} placeholder={kind === "condition" ? "培養温度" : "到達温度"} />
        </Field>
        {kind === "matrix" && (
          <Field label="比較相手 (列)">
            <input className={INPUT} value={colLabel} onChange={(e) => setColLabel(e.target.value)} placeholder="自社 / kiutra" />
          </Field>
        )}
        {kind === "matrix" && (
          <Field label="評価">
            <select className={INPUT} value={rating} onChange={(e) => setRating(e.target.value as TechRating)}>
              {RATINGS.map((r) => (
                <option key={r} value={r}>
                  {RATING_FULL_LABEL[r]}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label="並び順">
          <input className={INPUT} value={order} onChange={(e) => setOrder(e.target.value)} inputMode="numeric" />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Field label="下限 (数値)">
          <input className={INPUT} value={vmin} onChange={(e) => setVmin(e.target.value)} inputMode="decimal" />
        </Field>
        <Field label="上限 (数値)">
          <input className={INPUT} value={vmax} onChange={(e) => setVmax(e.target.value)} inputMode="decimal" />
        </Field>
        <Field label="単位">
          <input className={INPUT} value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="℃ / K / mol/L" />
        </Field>
        <Field label="数値にならない値">
          <input className={INPUT} value={vtext} onChange={(e) => setVtext(e.target.value)} placeholder="Cd, Zn, Cu / 未測定" />
        </Field>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Field label="条件 (この条件下で成り立つ)">
          <input className={INPUT} value={cond} onChange={(e) => setCond(e.target.value)} placeholder="培養槽内 / 定格運転時" />
        </Field>
        <Field label="時点・測定日">
          <input className={INPUT} type="date" value={observed} onChange={(e) => setObserved(e.target.value)} />
        </Field>
        <Field label="確度">
          <select className={INPUT} value={confidence} onChange={(e) => setConfidence(e.target.value as TechConfidence)}>
            {CONFIDENCES.map((c) => (
              <option key={c} value={c}>
                {CONFIDENCE_LABEL[c]}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Field label="出典の種類">
          <select className={INPUT} value={sourceKind} onChange={(e) => setSourceKind(e.target.value as TechSourceKind)}>
            {SOURCE_KINDS.map((s) => (
              <option key={s} value={s}>
                {SOURCE_KIND_LABEL[s]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="出典">
          <input className={INPUT} value={sourceRef} onChange={(e) => setSourceRef(e.target.value)} />
        </Field>
        <Field label="出典URL">
          <input className={INPUT} value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} />
        </Field>
      </div>
      <Field label="備考">
        <input className={INPUT} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      {error && <p className="text-[11px] text-[#b71c1c]">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={submit}
          disabled={busy}
          className="rounded bg-[#027FDC] px-3 py-1 text-[12px] font-medium text-white disabled:opacity-50"
        >
          {busy ? "保存中…" : "保存"}
        </button>
        <button onClick={onCancel} className="rounded border border-[#d2d2d7] px-3 py-1 text-[12px] text-[#1d1d1f]">
          やめる
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * トピック1枚
 * ------------------------------------------------------------------ */

function TopicCard({
  topic,
  entries,
  canEdit,
  projectId,
  onChanged,
}: {
  topic: TechTopic;
  entries: TechEntry[];
  canEdit: boolean;
  projectId: string;
  onChanged: () => void;
}) {
  const [editingTopic, setEditingTopic] = useState(false);
  const [addingEntry, setAddingEntry] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);

  const editingEntry = entries.find((e) => e.tech_entry_id === editingEntryId);

  return (
    <section className="rounded-xl border border-[#e5e5e7] bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge className="border-[#d2d2d7] bg-[#f5f5f7] text-[#6e6e73]">{BLOCK_KIND_LABEL[topic.block_kind]}</Badge>
            <h4 className="text-[13px] font-semibold text-[#1d1d1f]">{topic.title}</h4>
            <Badge className={CONFIDENTIALITY_STYLE[topic.confidentiality]}>{CONFIDENTIALITY_LABEL[topic.confidentiality]}</Badge>
          </div>
          {topic.summary && <p className="mt-1 text-[11px] leading-5 text-[#86868b]">{topic.summary}</p>}
        </div>
        {canEdit && (
          <div className="flex shrink-0 gap-1">
            <button
              onClick={() => setEditingTopic((v) => !v)}
              className="rounded border border-[#d2d2d7] px-2 py-0.5 text-[11px] text-[#1d1d1f] hover:bg-[#f5f5f7]"
            >
              編集
            </button>
            <button
              onClick={async () => {
                if (!window.confirm(`「${topic.title}」を中身ごと消す。よい?`)) return;
                await deleteTechRow(projectId, "topic", topic.tech_topic_id);
                onChanged();
              }}
              className="rounded border border-[#d2d2d7] px-2 py-0.5 text-[11px] text-[#b71c1c] hover:bg-[#fff5f5]"
            >
              削除
            </button>
          </div>
        )}
      </div>

      {editingTopic && (
        <div className="mt-3">
          <TopicForm
            initial={topic}
            onCancel={() => setEditingTopic(false)}
            onSubmit={async (row) => {
              await updateTechRow(projectId, "topic", topic.tech_topic_id, row);
              setEditingTopic(false);
              onChanged();
            }}
          />
        </div>
      )}

      {topic.body_md && (
        <div className="mt-3 border-l-2 border-[#e5e5e7] pl-3">
          <MarkdownView source={topic.body_md} />
        </div>
      )}

      {topic.block_kind !== "article" && (
        <div className="mt-3">
          {topic.block_kind === "condition" && <ConditionBlock entries={entries} />}
          {topic.block_kind === "matrix" && <MatrixBlock entries={entries} />}
          {topic.block_kind === "record" && <RecordBlock entries={entries} />}
        </div>
      )}

      {canEdit && topic.block_kind !== "article" && (
        <div className="mt-3 space-y-2">
          {entries.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {entries.map((e) => (
                <button
                  key={e.tech_entry_id}
                  onClick={() => setEditingEntryId(e.tech_entry_id === editingEntryId ? null : e.tech_entry_id)}
                  className="rounded border border-[#d2d2d7] px-1.5 py-0.5 text-[10px] text-[#6e6e73] hover:bg-[#f5f5f7]"
                >
                  ✎ {e.row_label}
                  {e.col_label ? ` / ${e.col_label}` : ""}
                </button>
              ))}
            </div>
          )}
          {editingEntry && (
            <div className="space-y-2">
              <EntryForm
                kind={topic.block_kind}
                initial={editingEntry}
                onCancel={() => setEditingEntryId(null)}
                onSubmit={async (row) => {
                  await updateTechRow(projectId, "entry", editingEntry.tech_entry_id, row);
                  setEditingEntryId(null);
                  onChanged();
                }}
              />
              <button
                onClick={async () => {
                  if (!window.confirm(`「${editingEntry.row_label}」の行を消す。よい?`)) return;
                  await deleteTechRow(projectId, "entry", editingEntry.tech_entry_id);
                  setEditingEntryId(null);
                  onChanged();
                }}
                className="rounded border border-[#d2d2d7] px-2 py-0.5 text-[11px] text-[#b71c1c] hover:bg-[#fff5f5]"
              >
                この行を削除
              </button>
            </div>
          )}
          {addingEntry ? (
            <EntryForm
              kind={topic.block_kind}
              onCancel={() => setAddingEntry(false)}
              onSubmit={async (row) => {
                await createTechRow(projectId, "entry", { ...row, tech_topic_id: topic.tech_topic_id });
                setAddingEntry(false);
                onChanged();
              }}
            />
          ) : (
            <button
              onClick={() => setAddingEntry(true)}
              className="rounded border border-dashed border-[#d2d2d7] px-2 py-1 text-[11px] text-[#6e6e73] hover:bg-[#f5f5f7]"
            >
              ＋ 行を足す
            </button>
          )}
        </div>
      )}

      <p className="mt-3 text-[10px] text-[#86868b]">
        <SourceCell sourceKind={topic.source_kind} sourceRef={topic.source_ref} sourceUrl={topic.source_url} />
        {" ・ 更新 "}
        {topic.updated_at.slice(0, 10)}
      </p>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * 未整理の断片
 * ------------------------------------------------------------------ */

function FragmentTable({ fragments }: { fragments: TechKnowledgeFragment[] }) {
  const [category, setCategory] = useState<string>("all");
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return fragments.filter((f) => {
      if (category !== "all" && f.category !== category) return false;
      if (!q) return true;
      return `${f.entity_name} ${f.fact_text ?? ""}`.toLowerCase().includes(q);
    });
  }, [fragments, category, query]);

  const shown = expanded ? filtered : filtered.slice(0, 20);
  if (fragments.length === 0) return null;

  return (
    <section className="rounded-xl border border-[#e5e5e7] bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-[13px] font-semibold text-[#1d1d1f]">まだ整理していない技術の断片</h3>
          <p className="mt-1 text-[11px] leading-5 text-[#86868b]">
            毎朝の自動抽出が議事録と月報から拾った技術・用語・競合の事実。ここから上のトピックへ写して構造化する。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            className={INPUT}
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setExpanded(false);
            }}
          >
            <option value="all">すべて ({fragments.length})</option>
            {["tech", "term", "competitor"].map((c) => {
              const n = fragments.filter((f) => f.category === c).length;
              return (
                <option key={c} value={c}>
                  {FRAGMENT_CATEGORY_LABEL[c]} ({n})
                </option>
              );
            })}
          </select>
          <input className={INPUT} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="語で絞る" />
        </div>
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[600px] border-collapse text-[12px]">
          <thead>
            <tr className="bg-[#f5f5f7] text-left text-[11px] text-[#6e6e73]">
              <th className="border-b border-[#e5e5e7] px-2 py-1.5 font-medium">区分</th>
              <th className="border-b border-[#e5e5e7] px-2 py-1.5 font-medium">名前</th>
              <th className="border-b border-[#e5e5e7] px-2 py-1.5 font-medium">分かっていること</th>
              <th className="border-b border-[#e5e5e7] px-2 py-1.5 font-medium">出典</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((f) => (
              <tr key={f.id} className="align-top hover:bg-[#fafafa]">
                <td className="border-b border-[#f0f0f2] px-2 py-1.5 whitespace-nowrap text-[#6e6e73]">
                  {FRAGMENT_CATEGORY_LABEL[f.category] ?? f.category}
                </td>
                <td className="border-b border-[#f0f0f2] px-2 py-1.5 font-medium text-[#1d1d1f]">{f.entity_name}</td>
                <td className="border-b border-[#f0f0f2] px-2 py-1.5 leading-5 text-[#1d1d1f]">{f.fact_text}</td>
                <td className="border-b border-[#f0f0f2] px-2 py-1.5 whitespace-nowrap text-[#86868b]">{f.source || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filtered.length > shown.length && (
        <button onClick={() => setExpanded(true)} className="mt-2 text-[11px] text-[#007aff] underline">
          残り {filtered.length - shown.length} 件も出す
        </button>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * タブ本体
 * ------------------------------------------------------------------ */

interface Props {
  projectId: string;
}

export function CockpitTechnology({ projectId }: Props) {
  // 読み込み済みの PJ を state に持ち、PJ を切り替えた直後に前のPJのデータを出さない
  // (cockpit/page.tsx と同じ流儀)。キャッシュ済みなら peek で即描画する。
  const [loaded, setLoaded] = useState<{ projectId: string; data: ProjectTechResponse | null }>(() => ({
    projectId,
    data: peekProjectTech(projectId) ?? null,
  }));
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [domainFilter, setDomainFilter] = useState<string>("all");

  const reload = useCallback(
    (force = false) => {
      loadProjectTech(projectId, { force })
        .then((d) => setLoaded({ projectId, data: d }))
        .catch((e) => setError(e instanceof Error ? e.message : "読み込みに失敗"));
    },
    [projectId]
  );

  useEffect(() => {
    reload();
  }, [projectId, reload]);

  const data = loaded.projectId === projectId ? loaded.data : peekProjectTech(projectId) ?? null;

  const domains = useMemo(() => {
    if (!data) return [];
    const list: string[] = [];
    for (const t of data.topics) {
      const d = t.tech_domain || "未分類";
      if (!list.includes(d)) list.push(d);
    }
    return list.sort((a, b) => (a === "未分類" ? 1 : b === "未分類" ? -1 : a.localeCompare(b, "ja")));
  }, [data]);

  const entriesByTopic = useMemo(() => {
    const map = new Map<string, TechEntry[]>();
    for (const e of data?.entries ?? []) {
      const list = map.get(e.tech_topic_id) ?? [];
      list.push(e);
      map.set(e.tech_topic_id, list);
    }
    return map;
  }, [data]);

  if (error) {
    return (
      <div className="rounded-xl border border-[#ffcdd2] bg-[#fff5f5] p-4 text-[12px] text-[#b71c1c]">
        技術タブの読み込みに失敗した: {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-xl border border-[#e5e5e7] bg-[#fafafa]" />
        ))}
      </div>
    );
  }

  const visibleTopics = data.topics.filter((t) => domainFilter === "all" || (t.tech_domain || "未分類") === domainFilter);
  const countByKind = BLOCK_ORDER.map((k) => ({ kind: k, n: data.topics.filter((t) => t.block_kind === k).length }));

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-[#e5e5e7] bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-[13px] font-semibold text-[#1d1d1f]">技術</h3>
            <p className="mt-1 text-[11px] leading-5 text-[#86868b]">
              この技術が「どの範囲で成立するか」「何がどう違うか」「競合とどこで差がつくか」「今どこまで行っているか」を貯める場所。
              数値は出典と確度を必ず添える。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {countByKind.map(({ kind, n }) => (
              <Badge key={kind} className="border-[#d2d2d7] bg-[#f5f5f7] text-[#6e6e73]">
                {BLOCK_KIND_LABEL[kind]} {n}
              </Badge>
            ))}
            {domains.length > 1 && (
              <select className={INPUT} value={domainFilter} onChange={(e) => setDomainFilter(e.target.value)}>
                <option value="all">全区分</option>
                {domains.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            )}
            {data.canEdit && (
              <button
                onClick={() => setAdding((v) => !v)}
                className="rounded bg-[#027FDC] px-3 py-1 text-[12px] font-medium text-white"
              >
                ＋ トピック追加
              </button>
            )}
          </div>
        </div>
        {adding && (
          <div className="mt-3">
            <TopicForm
              onCancel={() => setAdding(false)}
              onSubmit={async (row) => {
                await createTechRow(projectId, "topic", row);
                setAdding(false);
                reload(true);
              }}
            />
          </div>
        )}
      </section>

      {data.topics.length === 0 && !adding && (
        <section className="rounded-xl border border-dashed border-[#d2d2d7] bg-white p-5">
          <p className="text-[12px] font-medium text-[#1d1d1f]">このPJの技術トピックはまだ1件もない。</p>
          <p className="mt-2 text-[11px] leading-5 text-[#86868b]">
            置ける形は4つ。
            {BLOCK_ORDER.map((k) => ` ${BLOCK_KIND_LABEL[k]} = ${BLOCK_KIND_HINT[k]}。`).join("")}
            下の「まだ整理していない技術の断片」に自動で拾った事実が並んでいるので、そこから写して作る。
          </p>
        </section>
      )}

      {domains
        .filter((d) => domainFilter === "all" || d === domainFilter)
        .map((domain) => {
          const topics = visibleTopics
            .filter((t) => (t.tech_domain || "未分類") === domain)
            .sort(
              (a, b) =>
                a.sort_order - b.sort_order ||
                BLOCK_ORDER.indexOf(a.block_kind) - BLOCK_ORDER.indexOf(b.block_kind) ||
                a.title.localeCompare(b.title, "ja")
            );
          if (topics.length === 0) return null;
          return (
            <div key={domain} className="space-y-3">
              <h3 className="border-b border-[#e5e5e7] pb-1 text-[12px] font-semibold text-[#6e6e73]">{domain}</h3>
              {topics.map((t) => (
                <TopicCard
                  key={t.tech_topic_id}
                  topic={t}
                  entries={entriesByTopic.get(t.tech_topic_id) ?? []}
                  canEdit={data.canEdit}
                  projectId={projectId}
                  onChanged={() => reload(true)}
                />
              ))}
            </div>
          );
        })}

      <FragmentTable fragments={data.fragments} />
    </div>
  );
}
