"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
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
import { loadProjectFuelCostModel, peekProjectFuelCostModel } from "@/lib/project-cost-model-client";
import { CockpitFuelCostModel } from "@/components/cockpit/CockpitFuelCostModel";

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
/** 星取り表の最小幅 = 比較軸の列 + 相手の列の数 × 1列の幅 (最小520px)。スマホでは横スクロールになる。 */
const MATRIX_AXIS_COL_PX = 128;
const MATRIX_COL_PX = 96;

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
  // 相手が多い表 (SXの競合比較は8列) をスマホ幅で押しつぶさないよう、列の数から表の最小幅を決めて横スクロールで読ませる。
  const minWidth = Math.max(520, MATRIX_AXIS_COL_PX + cols.length * MATRIX_COL_PX);
  return (
    <div className="max-h-[70vh] overflow-auto">
      <table className="w-auto max-w-full border-collapse text-[12px]" style={{ minWidth }}>
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
  const [rowPicker, setRowPicker] = useState(false);

  const editingEntry = entries.find((e) => e.tech_entry_id === editingEntryId);

  return (
    <section data-testid="tech-topic-card" className="rounded-xl border border-[#e5e5e7] bg-white p-4">
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
        <div className="min-w-0">
          <h3 className="text-[13px] font-semibold text-[#1d1d1f]">まだ整理していない技術の断片</h3>
          <p className="mt-1 text-[11px] leading-5 text-[#86868b]">
            毎朝の自動抽出が議事録と月報から拾った技術・用語・競合の事実。ここから区分のトピックへ写して構造化する。
          </p>
        </div>
        {/* 狭いスマホ (幅 375px 未満) で区分の選択と入力欄が右へはみ出していたので、折り返せるようにする。 */}
        <div className="flex min-w-0 flex-wrap items-center gap-2">
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
 * 全体像と区分のタブ (2026-09-14 まさ依頼)
 *
 * 1回目「技術タブのコンテンツが増えてきて、何がどこにあるのか分からなくなってきてるから、
 *  全体感も見えるようにしてほしいし、それぞれのコンテンツへのアクセスもしやすくしてほしい」。
 *  全体像と目次を置き、押すとその位置へスクロールする形にした。
 * 2回目 (同日)「それぞれの項目をクリックするとただそこにスクロールしていくだけになってるけど、
 *  タブ分けした方が見やすいよ」。区分をタブにし、区分の中はトピックを1つずつ開く形に変えた。
 *  全体像は先頭のタブに残し、どの区分に何があるかは引き続き1枚で見える。
 * ------------------------------------------------------------------ */

type TechGroup = {
  domain: string;
  topics: TechTopic[];
  rows: number;
  checks: number;
};

/**
 * 開いている表示。URL の ?tech= と対応する (全体像は付けない / トピックは tech_topic_id / 未整理の断片は fragments /
 * コスト試算（燃料）は cost-fuel)。
 */
type TechView = { kind: "overview" } | { kind: "topic"; topicId: string } | { kind: "fragments" } | { kind: "fuelCost" };

type PagerTarget = { topic: TechTopic; domain: string; crossesDomain: boolean };

const TECH_VIEW_PARAM = "tech";
const TECH_VIEW_FRAGMENTS = "fragments";
const TECH_VIEW_FUEL_COST = "cost-fuel";
const TECH_TAB_OVERVIEW = "overview";
const TECH_TAB_FRAGMENTS = "fragments";
/**
 * コスト試算（燃料）のタブ (2026-09-14 まさ依頼「OSの技術ページに、新たに『コスト試算（燃料）』を追加してほしい」)。
 * 燃料の試算 (project_cost_models.case_kind = 'biodiesel') を持つPJだけに出す。区分のタブの後ろ、未整理の断片の前。
 */
const TECH_TAB_FUEL_COST = "cost-fuel";
const TECH_TAB_FUEL_COST_LABEL = "コスト試算（燃料）";
const TECH_DOMAIN_TAB_PREFIX = "domain:";
const TECH_PANEL_ID = "tech-panel";
const UNCATEGORIZED = "未分類";

function parseTechView(value: string | null): TechView {
  if (!value) return { kind: "overview" };
  if (value === TECH_VIEW_FRAGMENTS) return { kind: "fragments" };
  if (value === TECH_VIEW_FUEL_COST) return { kind: "fuelCost" };
  return { kind: "topic", topicId: value };
}

function techViewParam(view: TechView): string | null {
  if (view.kind === "topic") return view.topicId;
  if (view.kind === "fragments") return TECH_VIEW_FRAGMENTS;
  if (view.kind === "fuelCost") return TECH_VIEW_FUEL_COST;
  return null;
}

function topicDomainOf(topic: Pick<TechTopic, "tech_domain">): string {
  return topic.tech_domain || UNCATEGORIZED;
}

/** 一覧とタブでは「 — 」より後ろの補足を落として短く出す。全文はトピックの見出しとホバーで見える。 */
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

const FOCUS_RING = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#027FDC]";

/** 横に並べたタブが画面からはみ出すとき、選んだものが見える位置まで横にだけ寄せる (ページは縦に動かさない)。 */
function useKeepSelectedInView(ref: React.RefObject<HTMLElement | null>, selectedKey: string) {
  useEffect(() => {
    const list = ref.current;
    const tab = list?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!list || !tab || list.scrollWidth <= list.clientWidth) return;
    const left = tab.offsetLeft;
    const right = left + tab.offsetWidth;
    if (left < list.scrollLeft) list.scrollLeft = Math.max(0, left - 16);
    else if (right > list.scrollLeft + list.clientWidth) list.scrollLeft = right - list.clientWidth + 16;
  }, [ref, selectedKey]);
}

/** 説明帯の下端に並ぶタブ。全体像 → 区分 (トピックの sort_order 順) → コスト試算（燃料）(燃料の試算があるPJだけ) → 未整理の断片。 */
function TechDomainTabs({
  groups,
  fragmentsCount,
  hasFuelCost,
  activeKey,
  onSelect,
}: {
  groups: TechGroup[];
  fragmentsCount: number;
  hasFuelCost: boolean;
  activeKey: string;
  onSelect: (key: string) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  useKeepSelectedInView(listRef, activeKey);
  const items: { key: string; label: string; count: number | null }[] = [
    { key: TECH_TAB_OVERVIEW, label: "全体像", count: null },
    ...groups.map((g) => ({ key: `${TECH_DOMAIN_TAB_PREFIX}${g.domain}`, label: g.domain, count: g.topics.length })),
    ...(hasFuelCost ? [{ key: TECH_TAB_FUEL_COST, label: TECH_TAB_FUEL_COST_LABEL, count: null }] : []),
    ...(fragmentsCount > 0 ? [{ key: TECH_TAB_FRAGMENTS, label: "未整理の断片", count: fragmentsCount }] : []),
  ];
  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label="技術の区分"
      data-testid="tech-domain-tabs"
      className="relative flex gap-1 overflow-x-auto border-t border-[#e5e5e7] px-2"
    >
      {items.map((item) => {
        const selected = item.key === activeKey;
        return (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={TECH_PANEL_ID}
            data-tech-tab={item.key}
            onClick={() => onSelect(item.key)}
            className={`min-h-11 shrink-0 whitespace-nowrap border-b-2 px-2.5 text-[12px] font-semibold transition-colors sm:min-h-10 sm:px-3 ${FOCUS_RING} ${
              selected ? "border-[#027FDC] text-[#1d1d1f]" : "border-transparent text-[#6e6e73] hover:text-[#1d1d1f]"
            }`}
          >
            {item.label}
            {item.count !== null && <span className="ml-1 text-[10px] font-normal tabular-nums text-[#86868b]">{item.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

function TechOverview({
  groups,
  entriesByTopic,
  fragmentsCount,
  hasFuelCost,
  onOpenDomain,
  onOpenTopic,
  onOpenFragments,
  onOpenFuelCost,
}: {
  groups: TechGroup[];
  entriesByTopic: Map<string, TechEntry[]>;
  fragmentsCount: number;
  hasFuelCost: boolean;
  onOpenDomain: (domain: string) => void;
  onOpenTopic: (topicId: string) => void;
  onOpenFragments: () => void;
  onOpenFuelCost: () => void;
}) {
  const totalTopics = groups.reduce((s, g) => s + g.topics.length, 0);
  const totalRows = groups.reduce((s, g) => s + g.rows, 0);
  const totalChecks = groups.reduce((s, g) => s + g.checks, 0);

  return (
    <section data-testid="tech-overview" className="rounded-xl border border-[#e5e5e7] bg-white p-4">
      <p className="text-[11px] text-[#86868b]">
        区分 {groups.length} ・ トピック {totalTopics} ・ 行 {totalRows}
        {totalChecks > 0 && <span className="text-[#b71c1c]"> ・ ⚠ 要確認 {totalChecks}</span>}
        <span className="hidden sm:inline"> — 区分の名前を押すとその区分のタブ、タイトルを押すとそのトピックが開く</span>
      </p>

      <div className="mt-3 grid items-start gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {groups.map((g) => (
          <div key={g.domain} className="min-w-0 rounded-lg border border-[#e5e5e7] bg-[#fafafa] p-3">
            <button
              type="button"
              onClick={() => onOpenDomain(g.domain)}
              className={`group flex min-h-11 w-full items-center justify-between gap-2 rounded text-left sm:min-h-0 ${FOCUS_RING}`}
            >
              <span className="text-[12px] font-semibold text-[#1d1d1f] group-hover:text-[#027FDC]">{g.domain}</span>
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
                      onClick={() => onOpenTopic(t.tech_topic_id)}
                      title={t.summary ?? t.title}
                      className={`group flex min-h-11 w-full items-start gap-1.5 rounded px-1 py-1.5 text-left hover:bg-white sm:min-h-0 sm:py-1 ${FOCUS_RING}`}
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
        {hasFuelCost && (
          <button
            type="button"
            onClick={onOpenFuelCost}
            data-testid="tech-overview-fuel-cost"
            className={`rounded-lg border border-[#d2d2d7] bg-white p-3 text-left hover:bg-[#fafafa] ${FOCUS_RING}`}
          >
            <span className="block text-[12px] font-semibold text-[#1d1d1f]">{TECH_TAB_FUEL_COST_LABEL}</span>
            <span className="mt-1 block text-[11px] leading-5 text-[#86868b]">
              燃料（バイオディーゼル）を作って売るときの、燃料1Lあたりの総コスト。前提を書き換えるとその場で再計算する。
            </span>
          </button>
        )}
        {fragmentsCount > 0 && (
          <button
            type="button"
            onClick={onOpenFragments}
            className={`rounded-lg border border-dashed border-[#d2d2d7] bg-white p-3 text-left hover:bg-[#fafafa] ${FOCUS_RING}`}
          >
            <span className="block text-[12px] font-semibold text-[#1d1d1f]">まだ整理していない技術の断片</span>
            <span className="mt-1 block text-[11px] leading-5 text-[#86868b]">
              自動抽出で拾った事実 {fragmentsCount}件。ここから区分のトピックへ写して整理する。
            </span>
          </button>
        )}
      </div>
    </section>
  );
}

/** 広い画面 (xl) だけ。開いている区分のトピックを左に並べ、スクロールしても見えるように固定する。 */
function TechTopicList({
  group,
  entriesByTopic,
  selectedId,
  onSelect,
}: {
  group: TechGroup;
  entriesByTopic: Map<string, TechEntry[]>;
  selectedId: string;
  onSelect: (topicId: string) => void;
}) {
  return (
    <nav aria-label={`${group.domain}のトピック`} data-testid="tech-topic-list" className="hidden xl:block">
      <div className="sticky top-3 max-h-[calc(100vh-1.5rem)] overflow-y-auto rounded-xl border border-[#e5e5e7] bg-white p-3">
        <p className="mb-2 flex items-baseline justify-between gap-2 text-[11px] font-semibold text-[#1d1d1f]">
          <span className="min-w-0">{group.domain}</span>
          <span className="shrink-0 font-normal tabular-nums text-[#86868b]">{group.topics.length}件</span>
        </p>
        <ol className="border-l border-[#e5e5e7]">
          {group.topics.map((t, i) => {
            const on = t.tech_topic_id === selectedId;
            const checks = topicCheckCount(t, entriesByTopic.get(t.tech_topic_id) ?? []);
            return (
              <li key={t.tech_topic_id}>
                <button
                  type="button"
                  onClick={() => onSelect(t.tech_topic_id)}
                  aria-current={on ? "page" : undefined}
                  title={t.title}
                  className={`-ml-px flex w-full items-start gap-1.5 border-l-2 py-1.5 pl-2 pr-1 text-left text-[11px] leading-4 ${FOCUS_RING} ${
                    on
                      ? "border-[#027FDC] bg-[#eef6fd] font-medium text-[#1d1d1f]"
                      : "border-transparent text-[#4b4b52] hover:border-[#c7c7cc] hover:text-[#1d1d1f]"
                  }`}
                >
                  <span className="shrink-0 tabular-nums text-[#86868b]">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    {shortTopicTitle(t.title)}
                    {checks > 0 && <span className="ml-1 whitespace-nowrap text-[10px] text-[#b71c1c]">⚠{checks}</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}

/** 狭い画面 (xl 未満) だけ。トピックを上に並べる。スマホは横にスクロール、sm 以上は折り返す。1件だけの区分では出さない。 */
function TechTopicChips({
  group,
  entriesByTopic,
  selectedId,
  onSelect,
}: {
  group: TechGroup;
  entriesByTopic: Map<string, TechEntry[]>;
  selectedId: string;
  onSelect: (topicId: string) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  useKeepSelectedInView(listRef, selectedId);
  if (group.topics.length < 2) return null;
  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={`${group.domain}のトピック`}
      data-testid="tech-topic-chips"
      className="relative flex gap-1.5 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0 xl:hidden"
    >
      {group.topics.map((t, i) => {
        const on = t.tech_topic_id === selectedId;
        const checks = topicCheckCount(t, entriesByTopic.get(t.tech_topic_id) ?? []);
        return (
          <button
            key={t.tech_topic_id}
            type="button"
            role="tab"
            aria-selected={on}
            aria-controls={TECH_PANEL_ID}
            onClick={() => onSelect(t.tech_topic_id)}
            title={t.title}
            className={`flex min-h-11 max-w-[16rem] shrink-0 items-center gap-1 rounded-full border px-3 text-[11px] font-medium sm:min-h-8 ${FOCUS_RING} ${
              on ? "border-[#027FDC] bg-[#eef6fd] text-[#1d1d1f]" : "border-[#d2d2d7] bg-white text-[#4b4b52] hover:bg-[#f5f5f7]"
            }`}
          >
            <span className="shrink-0 tabular-nums text-[#86868b]">{i + 1}</span>
            <span className="min-w-0 truncate">{shortTopicTitle(t.title)}</span>
            {checks > 0 && <span className="shrink-0 text-[10px] text-[#b71c1c]">⚠{checks}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** トピックの下の「前のトピック / 次のトピック」。閉鎖系のように問いの順で読ませる区分を、続けて読めるようにする。 */
function TechTopicPager({
  prev,
  next,
  onSelect,
}: {
  prev: PagerTarget | null;
  next: PagerTarget | null;
  onSelect: (topicId: string) => void;
}) {
  if (!prev && !next) return null;
  const card = `min-h-11 min-w-0 rounded-lg border border-[#e5e5e7] bg-white px-3 py-2 hover:bg-[#fafafa] ${FOCUS_RING}`;
  return (
    <nav aria-label="前後のトピック" data-testid="tech-topic-pager" className="grid gap-2 sm:grid-cols-2">
      {prev ? (
        <button type="button" onClick={() => onSelect(prev.topic.tech_topic_id)} className={`${card} text-left`}>
          <span className="block text-[10px] text-[#86868b]">
            {prev.crossesDomain ? `← 前の区分「${prev.domain}」` : "← 前のトピック"}
          </span>
          <span className="block truncate text-[12px] font-medium text-[#1d1d1f]">{shortTopicTitle(prev.topic.title)}</span>
        </button>
      ) : (
        <span aria-hidden="true" className="hidden sm:block" />
      )}
      {next && (
        <button type="button" onClick={() => onSelect(next.topic.tech_topic_id)} className={`${card} text-right`}>
          <span className="block text-[10px] text-[#86868b]">
            {next.crossesDomain ? `次の区分「${next.domain}」 →` : "次のトピック →"}
          </span>
          <span className="block truncate text-[12px] font-medium text-[#1d1d1f]">{shortTopicTitle(next.topic.title)}</span>
        </button>
      )}
    </nav>
  );
}

interface Props {
  projectId: string;
  /** コスト試算（燃料）の「この値を保存」を出すか。PJワークスペースでは false (排水処理のコスト試算タブと同じ)。 */
  costModelEditable?: boolean;
}

export function CockpitTechnology({ projectId, costModelEditable = true }: Props) {
  // 読み込み済みの PJ を state に持ち、PJ を切り替えた直後に前のPJのデータを出さない
  // (cockpit/page.tsx と同じ流儀)。キャッシュ済みなら peek で即描画する。
  const [loaded, setLoaded] = useState<{ projectId: string; data: ProjectTechResponse | null }>(() => ({
    projectId,
    data: peekProjectTech(projectId) ?? null,
  }));
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  // 開いている表示は URL (?tech=) から始め、押したら URL へ書き戻す。再読み込み・共有したリンク・
  // ほかのコックピットタブから戻ったときに、同じトピックが開く。
  const searchParams = useSearchParams();
  const urlView = searchParams.get(TECH_VIEW_PARAM);
  const [view, setView] = useState<TechView>(() => parseTechView(urlView));
  // 画面の外 (アプリ内のリンクなど) で ?tech= が変わったときだけ合わせる。自分で書き換えた直後は同じ値なので何もしない。
  // effect で合わせると描画が二度走るので、前回の値を持って描画中に合わせる。
  const [seenUrlView, setSeenUrlView] = useState(urlView);
  if (urlView !== seenUrlView) {
    setSeenUrlView(urlView);
    if (techViewParam(view) !== urlView) setView(parseTechView(urlView));
  }
  // 区分のタブへ戻ったときは、その区分で最後に開いていたトピックを開く (トピックから離れるときに覚える)。
  const [lastTopicByDomain, setLastTopicByDomain] = useState<Record<string, string>>({});
  const panelRef = useRef<HTMLDivElement>(null);
  const revealPanel = useRef(false);

  // コスト試算（燃料）のタブを出すか。燃料の試算 (case_kind = biodiesel) を持つPJだけ。
  // 技術台帳と並べて読み、両方そろってから描く (タブの並びが後から変わらないように)。キャッシュ済みなら peek で即決まる。
  const peekFuel = () => {
    const hit = peekProjectFuelCostModel(projectId);
    return hit === undefined ? undefined : !!hit.bundle;
  };
  const [fuelLoaded, setFuelLoaded] = useState<{ projectId: string; has: boolean | undefined }>(() => ({ projectId, has: peekFuel() }));
  useEffect(() => {
    let cancelled = false;
    loadProjectFuelCostModel(projectId)
      .then((res) => {
        if (!cancelled) setFuelLoaded({ projectId, has: !!res.bundle });
      })
      .catch(() => {
        if (!cancelled) setFuelLoaded({ projectId, has: false });
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);
  const hasFuelCostRaw = fuelLoaded.projectId === projectId ? fuelLoaded.has : peekFuel();

  const reload = useCallback(
    (force = false) =>
      loadProjectTech(projectId, { force })
        .then((d) => {
          setLoaded({ projectId, data: d });
          return d;
        })
        .catch((e) => {
          setError(e instanceof Error ? e.message : "読み込みに失敗");
          return null;
        }),
    [projectId]
  );

  useEffect(() => {
    void reload();
  }, [projectId, reload]);

  const data = loaded.projectId === projectId ? loaded.data : peekProjectTech(projectId) ?? null;

  // 区分の並びは五十音ではなく、その区分に入っているトピックの sort_order の小さい順。
  // 「培養 → 排水処理」のように、PJが読ませたい順を data 側で決められるようにする。
  const domains = useMemo(() => {
    if (!data) return [];
    const minOrder = new Map<string, number>();
    for (const t of data.topics) {
      const d = topicDomainOf(t);
      const cur = minOrder.get(d);
      if (cur === undefined || t.sort_order < cur) minOrder.set(d, t.sort_order);
    }
    return [...minOrder.keys()].sort((a, b) => {
      if (a === UNCATEGORIZED) return 1;
      if (b === UNCATEGORIZED) return -1;
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
      domains.map((domain) => {
        const topics = (data?.topics ?? []).filter((t) => topicDomainOf(t) === domain).sort(compareTopics);
        return {
          domain,
          topics,
          rows: topics.reduce((s, t) => s + (entriesByTopic.get(t.tech_topic_id)?.length ?? 0), 0),
          checks: topics.reduce((s, t) => s + topicCheckCount(t, entriesByTopic.get(t.tech_topic_id) ?? []), 0),
        };
      }),
    [domains, data, entriesByTopic]
  );

  const selectView = useCallback(
    (next: TechView) => {
      if (view.kind === "topic" && data) {
        const current = data.topics.find((t) => t.tech_topic_id === view.topicId);
        if (current) {
          const domain = topicDomainOf(current);
          setLastTopicByDomain((prev) =>
            prev[domain] === current.tech_topic_id ? prev : { ...prev, [domain]: current.tech_topic_id }
          );
        }
      }
      setView(next);
      revealPanel.current = true;
      // router.replace だと押すたびにサーバへ取りに行くので、履歴を積まずに URL だけ書き換える
      // (Next.js は history.replaceState を useSearchParams に反映する)。
      const url = new URL(window.location.href);
      const value = techViewParam(next);
      if (value) url.searchParams.set(TECH_VIEW_PARAM, value);
      else url.searchParams.delete(TECH_VIEW_PARAM);
      window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    },
    [view, data]
  );

  // 下の方を読んでいて別のトピックへ移ったら、タブと新しいトピックの頭が見える位置まで戻す。
  // 位置へ滑らせて移動するのではなく、表示を差し替えた結果を上から見せる。見えているときは動かさない。
  useLayoutEffect(() => {
    if (!revealPanel.current) return;
    revealPanel.current = false;
    const panel = panelRef.current;
    if (panel && panel.getBoundingClientRect().top < 0) panel.scrollIntoView({ block: "start", behavior: "auto" });
  }, [view]);

  const openTopic = useCallback((topicId: string) => selectView({ kind: "topic", topicId }), [selectView]);

  const openDomain = useCallback(
    (domain: string) => {
      const group = groups.find((g) => g.domain === domain);
      if (!group || group.topics.length === 0) return;
      const remembered = lastTopicByDomain[domain];
      const topicId =
        remembered && group.topics.some((t) => t.tech_topic_id === remembered) ? remembered : group.topics[0].tech_topic_id;
      selectView({ kind: "topic", topicId });
    },
    [groups, lastTopicByDomain, selectView]
  );

  const openTab = useCallback(
    (key: string) => {
      if (key === TECH_TAB_OVERVIEW) selectView({ kind: "overview" });
      else if (key === TECH_TAB_FRAGMENTS) selectView({ kind: "fragments" });
      else if (key === TECH_TAB_FUEL_COST) selectView({ kind: "fuelCost" });
      else openDomain(key.slice(TECH_DOMAIN_TAB_PREFIX.length));
    },
    [openDomain, selectView]
  );

  if (error) {
    return (
      <div className="rounded-xl border border-[#ffcdd2] bg-[#fff5f5] p-4 text-[12px] text-[#b71c1c]">
        技術タブの読み込みに失敗した: {error}
      </div>
    );
  }

  if (!data || hasFuelCostRaw === undefined) {
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

  const hasFuelCost = hasFuelCostRaw === true;
  // URL のトピックが無い (削除した・別PJのリンク) とき、断片が0件のとき、燃料の試算が無いPJで cost-fuel を開いたときは全体像を出す。
  const selectedTopic = view.kind === "topic" ? data.topics.find((t) => t.tech_topic_id === view.topicId) ?? null : null;
  const selectedGroup = selectedTopic ? groups.find((g) => g.domain === topicDomainOf(selectedTopic)) ?? null : null;
  const shownKind: TechView["kind"] =
    view.kind === "topic" && selectedGroup ? "topic"
    : view.kind === "fragments" && data.fragments.length > 0 ? "fragments"
    : view.kind === "fuelCost" && hasFuelCost ? "fuelCost"
    : "overview";
  const activeTabKey =
    shownKind === "topic" && selectedGroup
      ? `${TECH_DOMAIN_TAB_PREFIX}${selectedGroup.domain}`
      : shownKind === "fragments"
        ? TECH_TAB_FRAGMENTS
        : shownKind === "fuelCost"
          ? TECH_TAB_FUEL_COST
          : TECH_TAB_OVERVIEW;
  const orderedTopics = groups.flatMap((g) => g.topics.map((topic) => ({ topic, domain: g.domain })));
  const selectedIndex = selectedTopic ? orderedTopics.findIndex((x) => x.topic.tech_topic_id === selectedTopic.tech_topic_id) : -1;
  const pagerTarget = (i: number): PagerTarget | null => {
    const hit = orderedTopics[i];
    if (!hit || !selectedGroup || selectedIndex < 0) return null;
    return { topic: hit.topic, domain: hit.domain, crossesDomain: hit.domain !== selectedGroup.domain };
  };
  const panelLabel =
    shownKind === "topic" && selectedGroup ? selectedGroup.domain
    : shownKind === "fragments" ? "未整理の断片"
    : shownKind === "fuelCost" ? TECH_TAB_FUEL_COST_LABEL
    : "全体像";

  return (
    <div className="space-y-4" data-testid="cockpit-technology-tab">
      <section className="overflow-hidden rounded-xl border border-[#e5e5e7] bg-white">
        <div className="p-4">
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
                  // 足したトピックを開く。追加 API は id を返さないので、読み直した中から題名と区分が同じ最新のものを探す。
                  const fresh = await reload(true);
                  const hit = fresh?.topics
                    .filter((t) => t.title === row.title && (t.tech_domain ?? null) === (row.tech_domain ?? null))
                    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
                  if (hit) selectView({ kind: "topic", topicId: hit.tech_topic_id });
                }}
              />
            </div>
          )}
        </div>
        {(data.topics.length > 0 || hasFuelCost) && (
          <TechDomainTabs groups={groups} fragmentsCount={data.fragments.length} hasFuelCost={hasFuelCost} activeKey={activeTabKey} onSelect={openTab} />
        )}
      </section>

      {data.topics.length === 0 && shownKind !== "fuelCost" ? (
        <>
          {!adding && (
            <section className="rounded-xl border border-dashed border-[#d2d2d7] bg-white p-5">
              <p className="text-[12px] font-medium text-[#1d1d1f]">このPJの技術トピックはまだ1件もない。</p>
              <p className="mt-2 text-[11px] leading-5 text-[#86868b]">
                置ける形は4つ。
                {BLOCK_ORDER.map((k) => ` ${BLOCK_KIND_LABEL[k]} = ${BLOCK_KIND_HINT[k]}。`).join("")}
                下の「まだ整理していない技術の断片」に自動で拾った事実が並んでいるので、そこから写して作る。
              </p>
            </section>
          )}
          <FragmentTable fragments={data.fragments} />
        </>
      ) : (
        <div ref={panelRef} id={TECH_PANEL_ID} role="tabpanel" aria-label={panelLabel} className="scroll-mt-16">
          {shownKind === "overview" && (
            <TechOverview
              groups={groups}
              entriesByTopic={entriesByTopic}
              fragmentsCount={data.fragments.length}
              hasFuelCost={hasFuelCost}
              onOpenDomain={openDomain}
              onOpenTopic={openTopic}
              onOpenFragments={() => selectView({ kind: "fragments" })}
              onOpenFuelCost={() => selectView({ kind: "fuelCost" })}
            />
          )}
          {shownKind === "fuelCost" && (
            <div data-testid="tech-fuel-cost">
              <CockpitFuelCostModel projectId={projectId} allowEdit={costModelEditable} />
            </div>
          )}
          {shownKind === "fragments" && <FragmentTable fragments={data.fragments} />}
          {shownKind === "topic" && selectedTopic && selectedGroup && (
            <div className="xl:grid xl:grid-cols-[228px_minmax(0,1fr)] xl:gap-4">
              <TechTopicList
                group={selectedGroup}
                entriesByTopic={entriesByTopic}
                selectedId={selectedTopic.tech_topic_id}
                onSelect={openTopic}
              />
              <div className="min-w-0 space-y-3">
                <TechTopicChips
                  group={selectedGroup}
                  entriesByTopic={entriesByTopic}
                  selectedId={selectedTopic.tech_topic_id}
                  onSelect={openTopic}
                />
                <TopicCard
                  key={selectedTopic.tech_topic_id}
                  topic={selectedTopic}
                  entries={entriesByTopic.get(selectedTopic.tech_topic_id) ?? []}
                  canEdit={data.canEdit}
                  projectId={projectId}
                  onChanged={() => reload(true)}
                />
                <TechTopicPager
                  prev={pagerTarget(selectedIndex - 1)}
                  next={pagerTarget(selectedIndex + 1)}
                  onSelect={openTopic}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
