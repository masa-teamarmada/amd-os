"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MarkdownView } from "@/components/cockpit/MarkdownView";
import {
  BLOCK_KIND_HINT,
  BLOCK_KIND_LABEL,
  CONFIDENCE_LABEL,
  CONFIDENTIALITY_LABEL,
  RATING_FULL_LABEL,
  RATING_LABEL,
  SOURCE_KIND_LABEL,
  countNeedsCheck,
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

/** 要確認の理由。値の下に赤字で出し、何を確かめるのかを本文を読まずに分かるようにする。 */
function CheckNote({ reason }: { reason: string | null }) {
  return (
    <div className="mt-0.5 text-[11px] leading-4 text-[#b71c1c]">⚠ 要確認{reason ? `: ${reason}` : ""}</div>
  );
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
            <tr key={e.tech_entry_id} className={`align-top ${e.needs_check ? "bg-[#fffaf0] hover:bg-[#fff5e6]" : "hover:bg-[#fafafa]"}`}>
              <td className="border-b border-[#f0f0f2] px-2 py-1.5 font-medium text-[#1d1d1f]">
                {e.needs_check && <span className="mr-1 text-[#b71c1c]">⚠</span>}
                {e.row_label}
              </td>
              <td className="border-b border-[#f0f0f2] px-2 py-1.5 tabular-nums text-[#1d1d1f]">
                {formatTechValue(e)}
                {e.note && <div className="mt-0.5 text-[11px] leading-4 text-[#86868b]">{e.note}</div>}
                {e.needs_check && <CheckNote reason={e.check_reason} />}
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
      <table className="w-auto min-w-[520px] max-w-full border-collapse text-[12px]">
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
                // 記号を持たないセル (条文の要件を並べる表など) は記号を出さず値だけを出す。
                // 「調べていない」は rating='unknown' を明示して入れる (null を「?」扱いしない)。
                const rating = e.rating;
                const tip = [
                  rating ? RATING_FULL_LABEL[rating] : "",
                  e.note || "",
                  e.source_ref ? `出典: ${SOURCE_KIND_LABEL[e.source_kind]} ${e.source_ref}` : SOURCE_KIND_LABEL[e.source_kind],
                ]
                  .filter(Boolean)
                  .join(" / ");
                return (
                  <td
                    key={c}
                    className={`border-b border-[#f0f0f2] px-2 py-1.5 align-top ${rating ? "text-center" : "text-left"}`}
                    title={tip}
                  >
                    {rating && <div className={`text-[15px] font-semibold leading-5 ${RATING_STYLE[rating]}`}>{RATING_LABEL[rating]}</div>}
                    {(e.value_text || e.value_min !== null || e.value_max !== null) && (
                      <div className={`${rating ? "mt-0.5" : ""} text-[11px] leading-4 tabular-nums text-[#1d1d1f]`}>{formatTechValue(e)}</div>
                    )}
                    {e.note && <div className="mt-0.5 text-[10px] leading-4 text-[#86868b]">{e.note}</div>}
                    {e.needs_check && <CheckNote reason={e.check_reason} />}
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
              <tr key={e.tech_entry_id} className={`align-top ${e.needs_check ? "bg-[#fffaf0] hover:bg-[#fff5e6]" : "hover:bg-[#fafafa]"}`}>
                <td className="border-b border-[#f0f0f2] px-2 py-1.5 font-medium text-[#1d1d1f]">
                  {e.needs_check && <span className="mr-1 text-[#b71c1c]">⚠</span>}
                  {i === 0 ? label : <span className="text-[#c7c7cc]">〃</span>}
                </td>
                <td className="border-b border-[#f0f0f2] px-2 py-1.5 tabular-nums text-[#1d1d1f]">
                  {formatTechValue(e)}
                  {e.needs_check && <CheckNote reason={e.check_reason} />}
                </td>
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
  const [needsCheck, setNeedsCheck] = useState(initial?.needs_check ?? false);
  const [checkReason, setCheckReason] = useState(initial?.check_reason ?? "");
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
        needs_check: needsCheck,
        check_reason: needsCheck ? textOrNull(checkReason) : null,
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
      <div className="flex flex-col gap-1 rounded border border-[#ffcdd2] bg-[#fff8f8] p-2">
        <label className="flex items-center gap-2 text-[11px] text-[#b71c1c]">
          <input type="checkbox" checked={needsCheck} onChange={(e) => setNeedsCheck(e.target.checked)} />
          ⚠ このトピック全体を要確認にする
        </label>
        {needsCheck && (
          <input className={INPUT} value={checkReason} onChange={(e) => setCheckReason(e.target.value)} placeholder="何を確かめるか" />
        )}
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
  const [needsCheck, setNeedsCheck] = useState(initial?.needs_check ?? false);
  const [checkReason, setCheckReason] = useState(initial?.check_reason ?? "");
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
        needs_check: needsCheck,
        check_reason: needsCheck ? textOrNull(checkReason) : null,
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
      <div className="flex flex-col gap-1 rounded border border-[#ffcdd2] bg-[#fff8f8] p-2">
        <label className="flex items-center gap-2 text-[11px] text-[#b71c1c]">
          <input type="checkbox" checked={needsCheck} onChange={(e) => setNeedsCheck(e.target.checked)} />
          ⚠ 要確認にする (資料で値が食い違う / 実測が無い / 根拠が弱い)
        </label>
        {needsCheck && (
          <input
            className={INPUT}
            value={checkReason}
            onChange={(e) => setCheckReason(e.target.value)}
            placeholder="何を、誰に確かめるか。例: 30と50のどちらを採るかを次のSX定例で確定"
          />
        )}
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

/* ------------------------------------------------------------------ *
 * トピック1枚
 * ------------------------------------------------------------------ */

function TopicCard({
  topic,
  entries,
  canEdit,
  projectId,
  onChanged,
  flash = false,
}: {
  topic: TechTopic;
  entries: TechEntry[];
  canEdit: boolean;
  projectId: string;
  onChanged: () => void;
  /** 全体像・目次から移動してきた直後だけ true。どこに着いたかを一瞬示す。 */
  flash?: boolean;
}) {
  const [editingTopic, setEditingTopic] = useState(false);
  const [addingEntry, setAddingEntry] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [rowPicker, setRowPicker] = useState(false);

  const editingEntry = entries.find((e) => e.tech_entry_id === editingEntryId);

  return (
    <section
      id={topicAnchorId(topic)}
      data-tech-anchor=""
      className={`scroll-mt-20 rounded-xl border bg-white p-4 transition-shadow duration-500 xl:scroll-mt-4 ${
        flash ? "border-[#027FDC] shadow-[0_0_0_3px_rgba(2,127,220,0.18)]" : "border-[#e5e5e7]"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge className="border-[#d2d2d7] bg-[#f5f5f7] text-[#6e6e73]">{BLOCK_KIND_LABEL[topic.block_kind]}</Badge>
            <h4 className="text-[13px] font-semibold text-[#1d1d1f]">{topic.title}</h4>
            <Badge className={CONFIDENTIALITY_STYLE[topic.confidentiality]}>{CONFIDENTIALITY_LABEL[topic.confidentiality]}</Badge>
            {(topic.needs_check || countNeedsCheck(entries) > 0) && (
              <Badge className="border-[#ffcdd2] bg-[#ffebee] text-[#b71c1c]">
                ⚠ 要確認 {countNeedsCheck(entries) || ""}
              </Badge>
            )}
          </div>
          {topic.needs_check && topic.check_reason && (
            <p className="mt-1 text-[11px] leading-5 text-[#b71c1c]">⚠ {topic.check_reason}</p>
          )}
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
            <button
              onClick={() => setRowPicker((v) => !v)}
              className="rounded border border-[#d2d2d7] px-2 py-0.5 text-[11px] text-[#6e6e73] hover:bg-[#f5f5f7]"
            >
              {rowPicker ? "行の編集を閉じる" : `行を編集 (${entries.length})`}
            </button>
          )}
          {entries.length > 0 && rowPicker && (
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

/* ------------------------------------------------------------------ *
 * 全体像と目次 (2026-09-14 まさ依頼)
 *
 * 「コンテンツが増えてきて、何がどこにあるのか分からない。全体感も見えるように、
 *  それぞれのコンテンツへのアクセスもしやすく」。トピックが20件を超えたSXで起きた。
 * 上に全体像 (区分ごとのトピック・行数・要確認)、広い画面は左に固定の目次、
 * 狭い画面は上に固定の「いま読んでいる場所」と目次を置く。本文は畳まない。
 * ------------------------------------------------------------------ */

type TechGroup = {
  domain: string;
  anchorId: string;
  topics: TechTopic[];
  rows: number;
  checks: number;
};

const TECH_TOP_ANCHOR = "tech-top";
const TECH_FRAGMENTS_ANCHOR = "tech-fragments";
/** 画面上端からこの距離より上へ抜けた見出しを「いま読んでいる場所」とみなす。狭い画面の固定バーの高さを含む。 */
const TECH_SPY_OFFSET = 120;

function topicAnchorId(topic: Pick<TechTopic, "tech_topic_id">): string {
  return `tech-topic-${topic.tech_topic_id}`;
}

/** 目次では「 — 」より後ろの補足を落として短く出す。全文はホバーで見える。 */
function shortTopicTitle(title: string): string {
  return title.split(" — ")[0];
}

function compareTopics(a: TechTopic, b: TechTopic): number {
  return (
    a.sort_order - b.sort_order ||
    BLOCK_ORDER.indexOf(a.block_kind) - BLOCK_ORDER.indexOf(b.block_kind) ||
    a.title.localeCompare(b.title, "ja")
  );
}

function topicCheckCount(topic: TechTopic, entries: TechEntry[]): number {
  return countNeedsCheck(entries) + (topic.needs_check ? 1 : 0);
}

function TechOverview({
  groups,
  entriesByTopic,
  fragmentsCount,
  domainFilter,
  onFilter,
  onJump,
}: {
  groups: TechGroup[];
  entriesByTopic: Map<string, TechEntry[]>;
  fragmentsCount: number;
  domainFilter: string;
  onFilter: (domain: string) => void;
  onJump: (anchorId: string, domain?: string) => void;
}) {
  const totalTopics = groups.reduce((s, g) => s + g.topics.length, 0);
  const totalRows = groups.reduce((s, g) => s + g.rows, 0);
  const totalChecks = groups.reduce((s, g) => s + g.checks, 0);
  if (totalTopics === 0) return null;
  const chip = (active: boolean) =>
    `rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
      active ? "border-[#1d1d1f] bg-[#1d1d1f] text-white" : "border-[#d2d2d7] bg-white text-[#4b4b52] hover:bg-[#f5f5f7]"
    }`;

  return (
    <section id={TECH_TOP_ANCHOR} data-testid="tech-overview" className="scroll-mt-4 rounded-xl border border-[#e5e5e7] bg-white p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="text-[13px] font-semibold text-[#1d1d1f]">全体像</h3>
        <p className="text-[11px] text-[#86868b]">
          区分 {groups.length} ・ トピック {totalTopics} ・ 行 {totalRows}
          {totalChecks > 0 && <span className="text-[#b71c1c]"> ・ ⚠ 要確認 {totalChecks}</span>}
          <span className="hidden sm:inline"> — タイトルを押すと、その位置へ移動する</span>
        </p>
      </div>

      {groups.length > 1 && (
        <div role="group" aria-label="区分で絞る" className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[11px] text-[#86868b]">区分で絞る</span>
          <button type="button" aria-pressed={domainFilter === "all"} onClick={() => onFilter("all")} className={chip(domainFilter === "all")}>
            すべて
          </button>
          {groups.map((g) => (
            <button
              key={g.domain}
              type="button"
              aria-pressed={domainFilter === g.domain}
              onClick={() => onFilter(domainFilter === g.domain ? "all" : g.domain)}
              className={chip(domainFilter === g.domain)}
            >
              {g.domain}
            </button>
          ))}
        </div>
      )}

      <div className="mt-3 grid items-start gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {groups.map((g) => (
          <div key={g.domain} className="min-w-0 rounded-lg border border-[#e5e5e7] bg-[#fafafa] p-3">
            <button
              type="button"
              onClick={() => onJump(g.anchorId, g.domain)}
              className="flex w-full items-baseline justify-between gap-2 text-left"
            >
              <span className="text-[12px] font-semibold text-[#1d1d1f] hover:text-[#027FDC]">{g.domain}</span>
              <span className="shrink-0 text-[10px] tabular-nums text-[#86868b]">
                {g.topics.length}件{g.rows > 0 && ` ・ ${g.rows}行`}
                {g.checks > 0 && <span className="text-[#b71c1c]"> ・ ⚠{g.checks}</span>}
              </span>
            </button>
            <ul className="mt-2 space-y-0.5">
              {g.topics.map((t) => {
                const entries = entriesByTopic.get(t.tech_topic_id) ?? [];
                const checks = topicCheckCount(t, entries);
                return (
                  <li key={t.tech_topic_id}>
                    <button
                      type="button"
                      onClick={() => onJump(topicAnchorId(t), g.domain)}
                      title={t.summary ?? t.title}
                      className="group flex w-full items-start gap-1.5 rounded px-1 py-1 text-left hover:bg-white"
                    >
                      <span className="mt-[2px] shrink-0 rounded border border-[#d2d2d7] bg-white px-1 text-[9px] leading-[14px] text-[#6e6e73]">
                        {BLOCK_KIND_LABEL[t.block_kind]}
                      </span>
                      <span className="min-w-0 flex-1 text-[11px] leading-[18px] text-[#1d1d1f] group-hover:text-[#027FDC]">{t.title}</span>
                      <span className="shrink-0 text-[10px] leading-[18px] tabular-nums text-[#86868b]">
                        {entries.length > 0 ? `${entries.length}行` : ""}
                        {checks > 0 && <span className="ml-1 text-[#b71c1c]">⚠{checks}</span>}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
        {fragmentsCount > 0 && (
          <button
            type="button"
            onClick={() => onJump(TECH_FRAGMENTS_ANCHOR)}
            className="rounded-lg border border-dashed border-[#d2d2d7] bg-white p-3 text-left hover:bg-[#fafafa]"
          >
            <span className="block text-[12px] font-semibold text-[#1d1d1f]">まだ整理していない技術の断片</span>
            <span className="mt-1 block text-[11px] leading-5 text-[#86868b]">
              自動抽出で拾った事実 {fragmentsCount}件。ここから上のトピックへ写して整理する。
            </span>
          </button>
        )}
      </div>
    </section>
  );
}

function TechTocList({
  groups,
  entriesByTopic,
  activeAnchor,
  fragmentsCount,
  onJump,
}: {
  groups: TechGroup[];
  entriesByTopic: Map<string, TechEntry[]>;
  activeAnchor: string | null;
  fragmentsCount: number;
  onJump: (anchorId: string, domain?: string) => void;
}) {
  return (
    <ul className="space-y-2.5">
      {groups.map((g) => {
        const inGroup = g.anchorId === activeAnchor || g.topics.some((t) => topicAnchorId(t) === activeAnchor);
        return (
          <li key={g.domain}>
            <button
              type="button"
              onClick={() => onJump(g.anchorId, g.domain)}
              className={`block w-full text-left text-[11px] font-semibold ${inGroup ? "text-[#1d1d1f]" : "text-[#6e6e73]"} hover:text-[#1d1d1f]`}
            >
              {g.domain}
            </button>
            <ul className="mt-1 border-l border-[#e5e5e7]">
              {g.topics.map((t) => {
                const a = topicAnchorId(t);
                const on = a === activeAnchor;
                const checks = topicCheckCount(t, entriesByTopic.get(t.tech_topic_id) ?? []);
                return (
                  <li key={t.tech_topic_id}>
                    <button
                      type="button"
                      onClick={() => onJump(a, g.domain)}
                      aria-current={on ? "location" : undefined}
                      title={t.title}
                      className={`-ml-px block w-full border-l-2 py-1 pl-2 pr-1 text-left text-[11px] leading-4 ${
                        on
                          ? "border-[#027FDC] bg-[#eef6fd] font-medium text-[#1d1d1f]"
                          : "border-transparent text-[#4b4b52] hover:border-[#c7c7cc] hover:text-[#1d1d1f]"
                      }`}
                    >
                      {shortTopicTitle(t.title)}
                      {checks > 0 && <span className="ml-1 whitespace-nowrap text-[10px] text-[#b71c1c]">⚠{checks}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </li>
        );
      })}
      {fragmentsCount > 0 && (
        <li>
          <button
            type="button"
            onClick={() => onJump(TECH_FRAGMENTS_ANCHOR)}
            aria-current={activeAnchor === TECH_FRAGMENTS_ANCHOR ? "location" : undefined}
            className={`block w-full text-left text-[11px] font-semibold ${
              activeAnchor === TECH_FRAGMENTS_ANCHOR ? "text-[#1d1d1f]" : "text-[#6e6e73]"
            } hover:text-[#1d1d1f]`}
          >
            まだ整理していない断片 {fragmentsCount}
          </button>
        </li>
      )}
    </ul>
  );
}

/** 広い画面 (xl) だけ。左に固定し、読んでいる場所を光らせる。 */
function TechToc(props: Parameters<typeof TechTocList>[0]) {
  return (
    <nav aria-label="技術タブの目次" data-testid="tech-toc" className="hidden xl:block">
      <div className="sticky top-3 max-h-[calc(100vh-1.5rem)] overflow-y-auto rounded-xl border border-[#e5e5e7] bg-white p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold text-[#86868b]">目次</p>
          <button type="button" onClick={() => props.onJump(TECH_TOP_ANCHOR)} className="text-[10px] font-medium text-[#027FDC]">
            全体像へ
          </button>
        </div>
        <TechTocList {...props} />
      </div>
    </nav>
  );
}

/** 狭い画面 (xl 未満) だけ。上に固定し、いま読んでいる場所と目次を出す。 */
function TechJumpBar(props: Parameters<typeof TechTocList>[0]) {
  const [open, setOpen] = useState(false);
  const { groups, activeAnchor } = props;
  let current = "全体像";
  for (const g of groups) {
    if (g.anchorId === activeAnchor) current = g.domain;
    const hit = g.topics.find((t) => topicAnchorId(t) === activeAnchor);
    if (hit) current = `${g.domain} › ${shortTopicTitle(hit.title)}`;
  }
  if (activeAnchor === TECH_FRAGMENTS_ANCHOR) current = "まだ整理していない断片";

  return (
    <div data-testid="tech-jump-bar" className="sticky top-0 z-40 xl:hidden">
      <div className="relative rounded-lg border border-[#e5e5e7] bg-white/95 px-3 py-2 shadow-[0_2px_8px_rgba(0,0,0,0.06)] backdrop-blur">
        <div className="flex items-center gap-2">
          <p className="min-w-0 flex-1 truncate text-[11px] text-[#1d1d1f]">
            <span className="mr-1 text-[#86868b]">いま</span>
            {current}
          </p>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="min-h-[32px] shrink-0 rounded-md border border-[#d2d2d7] px-3 text-[12px] font-medium text-[#1d1d1f] hover:bg-[#f5f5f7]"
          >
            {open ? "閉じる" : "目次"}
          </button>
        </div>
        {/* 本文を押し下げないよう、目次は重ねて開く。押し下げると、閉じた瞬間に着地位置がずれる。 */}
        {open && (
          <div className="absolute inset-x-0 top-full z-40 mt-1 max-h-[60vh] overflow-y-auto rounded-lg border border-[#e5e5e7] bg-white p-3 shadow-[0_8px_24px_rgba(0,0,0,0.12)]">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                window.setTimeout(() => props.onJump(TECH_TOP_ANCHOR), 0);
              }}
              className="mb-2 text-[11px] font-medium text-[#027FDC]"
            >
              全体像へ戻る
            </button>
            <TechTocList
              {...props}
              onJump={(a, d) => {
                setOpen(false);
                window.setTimeout(() => props.onJump(a, d), 0);
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

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
  const [activeAnchor, setActiveAnchor] = useState<string | null>(null);
  const [flashAnchor, setFlashAnchor] = useState<string | null>(null);
  const [pendingJump, setPendingJump] = useState<string | null>(null);
  const flashTimer = useRef<number | null>(null);
  const realignTimer = useRef<number | null>(null);

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

  // 区分の並びは五十音ではなく、その区分に入っているトピックの sort_order の小さい順。
  // 「培養 → 排水処理」のように、PJが読ませたい順を data 側で決められるようにする。
  const domains = useMemo(() => {
    if (!data) return [];
    const minOrder = new Map<string, number>();
    for (const t of data.topics) {
      const d = t.tech_domain || "未分類";
      const cur = minOrder.get(d);
      if (cur === undefined || t.sort_order < cur) minOrder.set(d, t.sort_order);
    }
    return [...minOrder.keys()].sort((a, b) => {
      if (a === "未分類") return 1;
      if (b === "未分類") return -1;
      return (minOrder.get(a) ?? 0) - (minOrder.get(b) ?? 0) || a.localeCompare(b, "ja");
    });
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

  const groups = useMemo<TechGroup[]>(
    () =>
      domains.map((domain, i) => {
        const topics = (data?.topics ?? []).filter((t) => (t.tech_domain || "未分類") === domain).sort(compareTopics);
        return {
          domain,
          anchorId: `tech-domain-${i}`,
          topics,
          rows: topics.reduce((s, t) => s + (entriesByTopic.get(t.tech_topic_id)?.length ?? 0), 0),
          checks: topics.reduce((s, t) => s + topicCheckCount(t, entriesByTopic.get(t.tech_topic_id) ?? []), 0),
        };
      }),
    [domains, data, entriesByTopic]
  );

  const scrollToAnchor = useCallback((anchorId: string) => {
    const el = document.getElementById(anchorId);
    if (!el) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    // 上にある図 (mermaid) は描画が遅れて高さが変わる。移動し終えたころに着地位置がずれていたら合わせ直す。
    if (realignTimer.current) window.clearTimeout(realignTimer.current);
    const realign = (remaining: number) => {
      realignTimer.current = window.setTimeout(() => {
        const target = document.getElementById(anchorId);
        if (!target) return;
        const margin = parseFloat(window.getComputedStyle(target).scrollMarginTop) || 0;
        if (Math.abs(target.getBoundingClientRect().top - margin) > 24) target.scrollIntoView({ behavior: "auto", block: "start" });
        if (remaining > 1) realign(remaining - 1);
      }, 900);
    };
    realign(2);
    setFlashAnchor(anchorId);
    if (flashTimer.current) window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlashAnchor(null), 1600);
  }, []);

  // 区分で絞っている最中に、ほかの区分のトピックを目次から押したら、絞り込みを外してから移動する。
  const jumpTo = useCallback(
    (anchorId: string, domain?: string) => {
      if (domain && domainFilter !== "all" && domainFilter !== domain) {
        setDomainFilter("all");
        setPendingJump(anchorId);
        return;
      }
      if (anchorId === TECH_FRAGMENTS_ANCHOR && domainFilter !== "all") {
        setDomainFilter("all");
        setPendingJump(anchorId);
        return;
      }
      scrollToAnchor(anchorId);
    },
    [domainFilter, scrollToAnchor]
  );

  // 絞り込みを外した描画が終わってから移動する。描画の間引きに左右されないよう、アニメーションフレームではなくタイマーで待つ。
  useEffect(() => {
    if (!pendingJump) return;
    const timer = window.setTimeout(() => {
      scrollToAnchor(pendingJump);
      setPendingJump(null);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [pendingJump, domainFilter, scrollToAnchor]);

  // いま読んでいる場所。ページ全体のスクロールに追従し、画面上端を越えた最後の見出しを選ぶ。
  useEffect(() => {
    if (!data) return;
    let frame = 0;
    const compute = () => {
      frame = 0;
      let current: string | null = null;
      for (const node of document.querySelectorAll<HTMLElement>("[data-tech-anchor]")) {
        if (node.getBoundingClientRect().top - TECH_SPY_OFFSET <= 0) current = node.id;
        else break;
      }
      setActiveAnchor((prev) => (prev === current ? prev : current));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(compute);
    };
    frame = requestAnimationFrame(compute);
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("scroll", onScroll, { capture: true });
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [data, domainFilter]);

  useEffect(
    () => () => {
      if (flashTimer.current) window.clearTimeout(flashTimer.current);
      if (realignTimer.current) window.clearTimeout(realignTimer.current);
    },
    []
  );

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

  const countByKind = BLOCK_ORDER.map((k) => ({ kind: k, n: data.topics.filter((t) => t.block_kind === k).length }));
  const needsCheckTotal = countNeedsCheck(data.entries) + data.topics.filter((t) => t.needs_check).length;

  return (
    <div className="space-y-4" data-testid="cockpit-technology-tab">
      <section className="rounded-xl border border-[#e5e5e7] bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-[13px] font-semibold text-[#1d1d1f]">技術</h3>
            <p className="mt-1 text-[11px] leading-5 text-[#86868b]">
              この技術が「どの範囲で成立するか」「何がどう違うか」「競合とどこで差がつくか」「今どこまで行っているか」を貯める場所。
              数値は出典と確度を必ず添える。資料によって値が食い違うものは<span className="text-[#b71c1c]">⚠ 要確認</span>を付け、両方の値を出典つきで残す。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {countByKind.map(({ kind, n }) => (
              <Badge key={kind} className="border-[#d2d2d7] bg-[#f5f5f7] text-[#6e6e73]">
                {BLOCK_KIND_LABEL[kind]} {n}
              </Badge>
            ))}
            {needsCheckTotal > 0 && (
              <Badge className="border-[#ffcdd2] bg-[#ffebee] text-[#b71c1c]">⚠ 要確認 {needsCheckTotal}</Badge>
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

      <TechOverview
        groups={groups}
        entriesByTopic={entriesByTopic}
        fragmentsCount={data.fragments.length}
        domainFilter={domainFilter}
        onFilter={setDomainFilter}
        onJump={jumpTo}
      />

      {data.topics.length > 0 ? (
        <div className="xl:grid xl:grid-cols-[228px_minmax(0,1fr)] xl:gap-4">
          <TechToc
            groups={groups}
            entriesByTopic={entriesByTopic}
            activeAnchor={activeAnchor}
            fragmentsCount={data.fragments.length}
            onJump={jumpTo}
          />
          <div className="min-w-0 space-y-4">
            <TechJumpBar
              groups={groups}
              entriesByTopic={entriesByTopic}
              activeAnchor={activeAnchor}
              fragmentsCount={data.fragments.length}
              onJump={jumpTo}
            />
            {domainFilter !== "all" && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[#d2d2d7] bg-[#f5f5f7] px-3 py-2 text-[11px] text-[#4b4b52]">
                <span>
                  「{domainFilter}」だけを表示中
                </span>
                <button type="button" onClick={() => setDomainFilter("all")} className="font-medium text-[#027FDC]">
                  すべて表示する
                </button>
              </div>
            )}
            {groups
              .filter((g) => domainFilter === "all" || g.domain === domainFilter)
              .map((g) => (
                <div key={g.domain} className="space-y-3">
                  <h3
                    id={g.anchorId}
                    data-tech-anchor=""
                    className="flex scroll-mt-20 items-baseline justify-between gap-2 border-b border-[#e5e5e7] pb-1 text-[12px] font-semibold text-[#6e6e73] xl:scroll-mt-4"
                  >
                    <span>{g.domain}</span>
                    <span className="text-[10px] font-normal tabular-nums text-[#86868b]">
                      {g.topics.length}件{g.rows > 0 && ` ・ ${g.rows}行`}
                      {g.checks > 0 && <span className="text-[#b71c1c]"> ・ ⚠{g.checks}</span>}
                    </span>
                  </h3>
                  {g.topics.map((t) => (
                    <TopicCard
                      key={t.tech_topic_id}
                      topic={t}
                      entries={entriesByTopic.get(t.tech_topic_id) ?? []}
                      canEdit={data.canEdit}
                      projectId={projectId}
                      onChanged={() => reload(true)}
                      flash={flashAnchor === topicAnchorId(t)}
                    />
                  ))}
                </div>
              ))}
            {domainFilter === "all" && data.fragments.length > 0 && (
              <div id={TECH_FRAGMENTS_ANCHOR} data-tech-anchor="" className="scroll-mt-20 xl:scroll-mt-4">
                <FragmentTable fragments={data.fragments} />
              </div>
            )}
          </div>
        </div>
      ) : (
        <FragmentTable fragments={data.fragments} />
      )}
    </div>
  );
}
